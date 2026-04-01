import { prisma } from "./database.server";
import type { Prisma } from "@prisma/client";
import { createAuditLogs } from "./log.server";
import { UserStatus } from "~/interfaces/base";
import { FieldValidationError } from "./base.server";
import type { IWalletCredentials } from "~/interfaces";
import type { ITransactionCredentials } from "~/interfaces/transaction";
import { notifyAdminNewWithdrawal, notifyAdminNewDeposit } from "./email.server";

// create wallet when user register
export async function createWallet(data: IWalletCredentials, userId: string) {
  if (!data) throw new Error("Missing model creation data!");

  const auditBase = {
    action: "CREATE_WALLET",
    customer: userId,
  };

  try {
    const orConditions: Prisma.walletWhereInput[] = [];
    if (data.customer) {
      orConditions.push({ customer: { id: data.customer } });
    }
    if (data.model) {
      orConditions.push({ model: { id: data.model } });
    }

    const existingWallet = await prisma.wallet.findFirst({
      where: {
        OR: orConditions.length > 0 ? orConditions : undefined,
      },
    });

    if (existingWallet) {
      const error = new Error("The wallet already exists!") as any;
      error.status = 422;
      throw error;
    }

    const wallet = await prisma.wallet.create({
      data: {
        totalBalance: 0,
        totalPending: 0,
        totalSpend: 0,
        totalWithdraw: 0,
        totalRefunded: 0,
        // Deprecated fields - kept for backwards compatibility
        totalRecharge: 0,
        totalDeposit: 0,
        status: UserStatus.ACTIVE,
        ...(data.customer && { customer: { connect: { id: data.customer } } }),
        ...(data.model && { model: { connect: { id: data.model } } }),
      },
    });

    if (wallet.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Create wallet: ${wallet.id} successfully.`,
        status: "success",
        onSuccess: wallet,
      });
    }

    return wallet;
  } catch (error) {
    console.error("CREATE_WALLET_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Crate wallet failed!`,
      status: "failed",
      onError: error,
    });
    throw new Error("Failed to create wallet account!");
  }
}

// top-up money to user wallet
export async function topUpWallet(
  paymentSlip: string[],
  amount: number,
  userId: string
) {
  if (!amount || amount <= 0) throw new Error("Invalid top-up amount!");
  if (amount < 10000) {
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "wallet.topup.minimumAmountError",
    });
  }
  if (!paymentSlip || paymentSlip.length === 0) {
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "wallet.topup.paymentSlipRequired",
    });
  }

  const auditBase = {
    action: "TOPUP_WALLET",
    customer: userId,
  };

  try {
    const customerData = await prisma.customer.findUnique({
      where: {
        id: userId,
      },
      include: {
        Wallet: {
          select: {
            id: true,
          },
        },
      },
    });

    const walletId = customerData?.Wallet?.[0]?.id;

    if (!walletId)
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Wallet id is missing!",
      });

    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The wallet does not exist!",
      });
    }

    const createTopUpTransaction = await prisma.transaction_history.create({
      data: {
        identifier: "recharge",
        amount,
        paymentSlip,
        status: "pending",
        comission: 0,
        fee: 0,
        customerId: userId,
      },
    });

    if (createTopUpTransaction.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Top-up wallet: ${createTopUpTransaction.id} successfully.`,
        status: "success",
        onSuccess: createTopUpTransaction,
      });

      // Get customer name for notification
      const customerName = customerData?.firstName
        ? `${customerData.firstName} ${customerData.lastName || ""}`
        : "Customer";

      // Send notification to admin
      notifyAdminNewDeposit({
        id: createTopUpTransaction.id,
        amount,
        customerName,
      });
    }
    return createTopUpTransaction;
  } catch (error) {
    console.error("TOPUP_WALLET_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Top-up wallet failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to top-up wallet account!",
    });
  }
}

// get customer transactions with pagination
export async function getCustomerTransactions(
  customerId: string,
  page: number = 1,
  limit: number = 10
) {
  if (!customerId) throw new Error("Missing customer id!");
  if (page < 1) page = 1;
  if (limit < 1) limit = 10;

  const skip = (page - 1) * limit;

  try {
    const [transactions, totalCount] = await Promise.all([
      prisma.transaction_history.findMany({
        where: { customerId, customerHidden: { not: true } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.transaction_history.count({
        where: { customerId, customerHidden: { not: true } },
      }),
    ]);

    return {
      transactions,
      pagination: {
        currentPage: page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: skip + limit < totalCount,
        hasPreviousPage: page > 1,
      },
    };
  } catch (error) {
    console.error("GET_CUSTOMER_TRANSACTIONS_FAILED", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to get customer transactions!",
    });
  }
}

// get single transaction by id
export async function getTransaction(id: string, customerId: string) {
  try {
    return await prisma.transaction_history.findFirst({
      where: { id, customerId: customerId },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (error) {
    console.error("GET_TRANSACTIONS_FAILED", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to fetch transactions!",
    });
  }
}

// Booking-related transaction identifiers that cannot be edited/deleted by users
const BOOKING_TRANSACTION_IDENTIFIERS = [
  "booking_hold",
  "booking_earning",
  "booking_refund",
];

// delete transaction by id
export async function deleteTransaction(
  transactionId: string,
  customerId: string
) {
  if (!customerId) throw new Error("Missing customer id!");
  if (!transactionId) throw new Error("Missing transaction id!");

  const auditBase = {
    action: "DELETE_TRANSACTION",
    customer: customerId,
  };

  try {
    const transaction = await prisma.transaction_history.findUnique({
      where: {
        id: transactionId,
      },
    });

    if (!transaction) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The transaction does not exist!",
      });
    }

    if (transaction.customerId !== customerId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to delete this transaction!",
      });
    }

    if (
      transaction.status === "approved" ||
      transaction.status === "rejected"
    ) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message:
          "This transaction can't be deleted. Please contect admin to process!",
      });
    }

    // Prevent deletion of booking-related transactions
    if (BOOKING_TRANSACTION_IDENTIFIERS.includes(transaction.identifier)) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message:
          "Booking transactions cannot be deleted. Please contact admin for assistance.",
      });
    }

    const hiddenTransaction = await prisma.transaction_history.update({
      where: { id: transactionId },
      data: {
        customerHidden: true,
      },
    });

    if (hiddenTransaction.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Hide transaction: ${hiddenTransaction.id} from customer successfully.`,
        status: "success",
        onSuccess: hiddenTransaction,
      });
    }
    return hiddenTransaction;
  } catch (error) {
    console.error("DELETE_TRANSACTION_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Hide transaction failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to delete transaction!",
    });
  }
}

// update transaction by id
export async function updateTransaction(
  transactionId: string,
  customerId: string,
  transactionData: ITransactionCredentials
) {
  if (!customerId) throw new Error("Missing customer id!");
  if (!transactionId) throw new Error("Missing transaction id!");

  const auditBase = {
    action: "UPDATE_TRANSACTION",
    customer: customerId,
  };

  try {
    const transaction = await prisma.transaction_history.findUnique({
      where: {
        id: transactionId,
      },
    });

    if (!transaction) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The transaction does not exist!",
      });
    }

    if (transaction.customerId !== customerId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to edit this transaction!",
      });
    }

    // Prevent editing of booking-related transactions
    if (BOOKING_TRANSACTION_IDENTIFIERS.includes(transaction.identifier)) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message:
          "Booking transactions cannot be edited. Please contact admin for assistance.",
      });
    }

    const updateTransaction = await prisma.transaction_history.update({
      where: { id: transactionId },
      data: {
        amount: +transactionData.amount,
        paymentSlip: transactionData.paymentSlip,
      },
    });

    if (updateTransaction.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Edit transaction: ${updateTransaction.id} successfully.`,
        status: "success",
        onSuccess: updateTransaction,
      });
    }
    return updateTransaction;
  } catch (error: any) {
    console.error("UPDATE_TRANSACTION_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Delete transaction failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to update top-up information!",
    });
  }
}

// get wallet by customer id
export async function getWalletByCustomerId(customerId: string) {
  if (!customerId) throw new Error("Missing customer id!");

  console.log(customerId);
  try {
    const wallet = await prisma.wallet.findFirst({
      where: {
        customerId,
        status: "active",
      },
    });

    if (!wallet) {
      const error = new Error("The wallet does not exist!") as any;
      error.status = 404;
      throw error;
    }

    return wallet;
  } catch (error) {
    console.error("GET_WALLET_FAILED", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to get wallet!",
    });
  }
}

// Get customer wallet summary with balance statuses
export async function getCustomerWalletSummary(customerId: string) {
  if (!customerId) throw new Error("Missing customer id!");

  try {
    const wallet = await prisma.wallet.findFirst({
      where: {
        customerId,
        status: "active",
      },
      select: {
        id: true,
        totalBalance: true,
        totalSpend: true,
        totalRefunded: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        customerId: true,
      },
    });

    if (!wallet) {
      const error = new Error("The wallet does not exist!") as any;
      error.status = 404;
      throw error;
    }

    // Customer wallet fields:
    // - totalBalance: All approved recharges (top-ups)
    // - totalSpend: All spent on bookings/subscriptions
    // - totalRefunded: All approved refunded amount
    // - totalAvailable: totalBalance - totalSpend + totalRefunded

    const totalBalance = wallet.totalBalance || 0;
    const totalSpend = wallet.totalSpend || 0;
    const totalRefunded = wallet.totalRefunded || 0;
    const totalAvailable = totalBalance - totalSpend + totalRefunded;

    return {
      ...wallet,
      // Total recharged: all approved recharges
      totalRecharged: totalBalance,
      // Total available: remaining balance for spending
      totalAvailable: Math.max(0, totalAvailable),
      // Total spent: all spent on bookings/subscriptions
      totalSpent: totalSpend,
      // Total refunded: all refunded amount
      totalRefunded: totalRefunded,
    };
  } catch (error) {
    console.error("GET_CUSTOMER_WALLET_SUMMARY_FAILED", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to get wallet summary!",
    });
  }
}

// get model transactions with pagination
export async function getModelTransactions(
  modelId: string,
  page: number = 1,
  limit: number = 10
) {
  if (!modelId) throw new Error("Missing model id!");
  if (page < 1) page = 1;
  if (limit < 1) limit = 10;

  const skip = (page - 1) * limit;

  try {
    const [transactions, totalCount] = await Promise.all([
      prisma.transaction_history.findMany({
        where: { modelId, modelHidden: { not: true } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.transaction_history.count({
        where: { modelId, modelHidden: { not: true } },
      }),
    ]);

    return {
      transactions,
      pagination: {
        currentPage: page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: skip + limit < totalCount,
        hasPreviousPage: page > 1,
      },
    };
  } catch (error) {
    console.error("GET_MODEL_TRANSACTIONS_FAILED", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to get model transactions!",
    });
  }
}

// get wallet by model id
export async function getWalletByModelId(modelId: string) {
  if (!modelId) throw new Error("Missing model id!");

  try {
    const wallet = await prisma.wallet.findFirst({
      where: {
        modelId,
        status: "active",
      },
    });

    if (!wallet) {
      const error = new Error("The wallet does not exist!") as any;
      error.status = 404;
      throw error;
    }

    return wallet;
  } catch (error) {
    console.error("GET_WALLET_FAILED", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to get wallet!",
    });
  }
}

// get single transaction by id for model
export async function getModelTransaction(id: string, modelId: string) {
  try {
    return await prisma.transaction_history.findFirst({
      where: { id, modelId: modelId },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (error) {
    console.error("GET_TRANSACTIONS_FAILED", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to fetch transactions!",
    });
  }
}

// delete transaction by id for model
export async function deleteModelTransaction(
  transactionId: string,
  modelId: string
) {
  if (!modelId) throw new Error("Missing model id!");
  if (!transactionId) throw new Error("Missing transaction id!");

  const auditBase = {
    action: "DELETE_TRANSACTION",
    model: modelId,
  };

  try {
    const transaction = await prisma.transaction_history.findUnique({
      where: {
        id: transactionId,
      },
    });

    if (!transaction) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The transaction does not exist!",
      });
    }

    if (transaction.modelId !== modelId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to delete this transaction!",
      });
    }

    if (
      transaction.status === "approved" ||
      transaction.status === "rejected"
    ) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message:
          "This transaction can't be deleted. Please contact admin to process!",
      });
    }

    // Prevent deletion of booking-related transactions
    if (BOOKING_TRANSACTION_IDENTIFIERS.includes(transaction.identifier)) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message:
          "Booking transactions cannot be deleted. Please contact admin for assistance.",
      });
    }

    const hiddenTransaction = await prisma.transaction_history.update({
      where: { id: transactionId },
      data: {
        modelHidden: true,
      },
    });

    if (hiddenTransaction.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Hide transaction: ${hiddenTransaction.id} from model successfully.`,
        status: "success",
        onSuccess: hiddenTransaction,
      });
    }
    return hiddenTransaction;
  } catch (error) {
    console.error("DELETE_TRANSACTION_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Hide transaction failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to delete transaction!",
    });
  }
}

// update transaction by id for model
export async function updateModelTransaction(
  transactionId: string,
  modelId: string,
  transactionData: ITransactionCredentials
) {
  if (!modelId) throw new Error("Missing model id!");
  if (!transactionId) throw new Error("Missing transaction id!");

  const auditBase = {
    action: "UPDATE_TRANSACTION",
    model: modelId,
  };

  try {
    const transaction = await prisma.transaction_history.findUnique({
      where: {
        id: transactionId,
      },
    });

    if (!transaction) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The transaction does not exist!",
      });
    }

    if (transaction.modelId !== modelId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Unauthorized to edit this transaction!",
      });
    }

    // Prevent editing of booking-related transactions
    if (BOOKING_TRANSACTION_IDENTIFIERS.includes(transaction.identifier)) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message:
          "Booking transactions cannot be edited. Please contact admin for assistance.",
      });
    }

    const updateTransaction = await prisma.transaction_history.update({
      where: { id: transactionId },
      data: {
        amount: +transactionData.amount,
        paymentSlip: transactionData.paymentSlip,
      },
    });

    if (updateTransaction.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Edit transaction: ${updateTransaction.id} successfully.`,
        status: "success",
        onSuccess: updateTransaction,
      });
    }
    return updateTransaction;
  } catch (error: any) {
    console.error("UPDATE_TRANSACTION_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Update transaction failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to update withdrawal information!",
    });
  }
}

// withdraw funds for models
export async function withdrawFunds(
  modelId: string,
  amount: number,
  bankAccount: string
) {
  if (!modelId) throw new Error("Missing model id!");
  if (!amount || amount <= 0) throw new Error("Invalid withdrawal amount!");
  if (amount < 10000) throw new Error("Minimum withdrawal amount is 10,000 LAK");

  const auditBase = {
    action: "WITHDRAW_FUNDS",
    model: modelId,
  };

  try {
    // Get model's wallet
    const wallet = await prisma.wallet.findFirst({
      where: {
        modelId,
        status: "active",
      },
    });

    if (!wallet) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Wallet not found!",
      });
    }

    // Calculate available balance for withdrawal
    // Model wallet: totalAvailable = totalBalance - totalWithdraw
    const totalBalance = wallet.totalBalance || 0;
    const totalWithdraw = wallet.totalWithdraw || 0;
    const totalAvailable = totalBalance - totalWithdraw;

    // Sum pending withdrawal requests to prevent over-withdrawal
    const pendingWithdrawals = await prisma.transaction_history.aggregate({
      where: {
        modelId,
        identifier: "withdrawal",
        status: "pending",
        modelHidden: { not: true },
      },
      _sum: { amount: true },
    });
    const totalPendingWithdrawals = pendingWithdrawals._sum.amount || 0;
    const withdrawableBalance = Math.max(0, totalAvailable - totalPendingWithdrawals);

    // Check if sufficient withdrawable balance (accounting for pending requests)
    if (withdrawableBalance < amount) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: `Insufficient balance! Available to withdraw: ${withdrawableBalance.toLocaleString()} LAK`,
      });
    }

    // Create withdrawal transaction with pending status
    const withdrawalTransaction = await prisma.transaction_history.create({
      data: {
        identifier: "withdrawal",
        amount,
        paymentSlip: [],
        status: "pending",
        comission: 0,
        fee: 0,
        modelId: modelId,
        reason: `Withdrawal to bank account: ${bankAccount}`,
      },
    });

    if (withdrawalTransaction.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Withdrawal request: ${withdrawalTransaction.id} - ${amount} to ${bankAccount}`,
        status: "success",
        onSuccess: withdrawalTransaction,
      });

      // Get model name for email notification
      const model = await prisma.model.findUnique({
        where: { id: modelId },
        select: { firstName: true, lastName: true },
      });

      console.log("PK:::: prepare to send withdrawal notification email");

      // Send email notification to admin about new withdrawal request
      notifyAdminNewWithdrawal({
        id: withdrawalTransaction.id,
        amount,
        bankAccount,
        modelName: model ? `${model.firstName} ${model.lastName || ""}` : "Unknown",
      });
    }

    return {
      success: true,
      error: false,
      message: "Withdrawal request submitted successfully! Awaiting admin approval.",
    };
  } catch (error) {
    console.error("WITHDRAW_FUNDS_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Withdrawal request failed!`,
      status: "failed",
      onError: error,
    });

    // Re-throw FieldValidationError as-is
    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to process withdrawal request!",
    });
  }
}

// Get model wallet summary with balance statuses
export async function getModelWalletSummary(modelId: string) {
  if (!modelId) throw new Error("Missing model id!");

  try {
    // Get wallet with all balance fields
    const wallet = await prisma.wallet.findFirst({
      where: {
        modelId,
        status: "active",
      },
      select: {
        id: true,
        totalBalance: true,
        totalPending: true,
        totalWithdraw: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        modelId: true,
        customerId: true,
      },
    });

    if (!wallet) {
      const error = new Error("The wallet does not exist!") as any;
      error.status = 404;
      throw error;
    }

    // Model wallet fields:
    // - totalBalance: All approved earnings (booking_earning + referral)
    // - totalPending: Pending earnings from confirmed bookings
    // - totalWithdraw: Total approved withdrawals
    // - totalAvailable: totalBalance - totalWithdraw (what can be withdrawn)

    const totalBalance = wallet.totalBalance || 0;
    const totalPending = wallet.totalPending || 0;
    const totalWithdraw = wallet.totalWithdraw || 0;
    const totalAvailable = totalBalance - totalWithdraw;

    // Sum of pending withdrawal requests (not yet approved)
    const pendingWithdrawals = await prisma.transaction_history.aggregate({
      where: {
        modelId,
        identifier: "withdrawal",
        status: "pending",
        modelHidden: { not: true },
      },
      _sum: { amount: true },
    });
    const totalPendingWithdrawals = pendingWithdrawals._sum.amount || 0;
    const withdrawableBalance = Math.max(0, totalAvailable - totalPendingWithdrawals);

    return {
      ...wallet,
      // Total income: all approved earnings (same as totalBalance for models)
      totalIncome: totalBalance,
      // Total available: remaining balance for withdrawal (totalBalance - totalWithdraw)
      totalAvailable: Math.max(0, totalAvailable),
      // Pending: from ongoing bookings (will become available when completed)
      pendingBalance: Math.round(totalPending),
      // Total withdrawn: all approved withdrawals
      totalWithdrawn: totalWithdraw,
      // Withdrawable: available minus pending withdrawal requests
      withdrawableBalance,
    };
  } catch (error: any) {
    console.error("GET_MODEL_WALLET_SUMMARY_FAILED", error);
    // Preserve original error message for debugging
    const errorMessage = error?.message || "Failed to get wallet summary!";
    throw new FieldValidationError({
      success: false,
      error: true,
      message: errorMessage,
    });
  }
}

// deduct balance from wallet for subscription payment
export async function deductFromWallet(
  customerId: string,
  amount: number,
  planId: string,
  planName: string
) {
  if (!customerId) throw new Error("Missing customer id!");
  if (!amount || amount <= 0) throw new Error("Invalid deduction amount!");

  const auditBase = {
    action: "WALLET_DEDUCTION",
    customer: customerId,
  };

  try {
    const wallet = await prisma.wallet.findFirst({
      where: {
        customerId,
        status: "active",
      },
      select: {
        id: true,
        totalBalance: true,
        totalSpend: true,
        totalRefunded: true,
      },
    });

    if (!wallet) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Wallet not found!",
      });
    }

    // Calculate available balance: totalBalance - totalSpend + totalRefunded
    // Refunds are added back because they restore previously spent funds
    const totalBalance = wallet.totalBalance || 0;
    const totalSpend = wallet.totalSpend || 0;
    const totalRefunded = wallet.totalRefunded || 0;
    const availableBalance = totalBalance - totalSpend + totalRefunded;

    if (availableBalance < amount) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Insufficient wallet balance!",
      });
    }

    // Increment totalSpend (customer is spending on subscription)
    // Customer wallet fields:
    // - totalBalance: all recharged (unchanged)
    // - totalSpend: all spent (incremented here)
    // - totalAvailable = totalBalance - totalSpend
    const updatedWallet = await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        totalSpend: {
          increment: amount,
        },
      },
    });

    // Create transaction record with approved status
    const transaction = await prisma.transaction_history.create({
      data: {
        identifier: "subscription",
        amount: amount,
        paymentSlip: [], // No payment slip needed for wallet payment
        status: "approved",
        comission: 0,
        fee: 0,
        customerId,
        reason: `Subscription payment for ${planName} (Plan ID: ${planId})`,
      },
    });

    if (transaction.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Wallet deduction: ${transaction.id} - ${amount} for subscription ${planName}`,
        status: "success",
        onSuccess: { transaction, updatedWallet },
      });
    }

    return { wallet: updatedWallet, transaction };
  } catch (error) {
    console.error("WALLET_DEDUCTION_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Wallet deduction failed!`,
      status: "failed",
      onError: error,
    });

    // Re-throw FieldValidationError as-is
    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to deduct from wallet!",
    });
  }
}
