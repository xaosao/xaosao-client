import {
  Eye,
  Trash,
  EyeOff,
  Wallet,
  Search,
  Loader,
  EyeIcon,
  Upload,
  FilePenLine,
  ArrowDownToLine,
  Star,
} from "lucide-react";
import {
  Link,
  Form,
  Outlet,
  useNavigation,
  useSearchParams,
  useLoaderData,
  useActionData,
} from "react-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

// Services and Utils
import { formatCurrency, formatCurrency1 } from "~/utils";
import type { IWalletResponse } from "~/interfaces";
import { capitalize } from "~/utils/functions/textFormat";

const statusConfig: Record<string, { className: string }> = {
  pending: {
    className: "bg-amber-100 text-amber-600",
  },
  approved: {
    className: "bg-green-100 text-green-600",
  },
  rejected: {
    className: "bg-red-100 text-red-600",
  },
  held: {
    className: "bg-blue-100 text-blue-600",
  },
  released: {
    className: "bg-emerald-100 text-emerald-600",
  },
};
import type { IModelBank } from "~/interfaces/model-profile";
import type { PaginationProps } from "~/interfaces/pagination";
import { getModelBanks, createModelBank } from "~/services/model-profile.server";
import { requireModelSession } from "~/services/model-auth.server";
import { uploadFileToBunnyServer } from "~/services/upload.server";
import type { ITransactionResponse } from "~/interfaces/transaction";

import {
  withdrawFunds,
  getModelWalletSummary,
  getModelTransactions,
} from "~/services/wallet.server";

// components
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import Pagination from "~/components/ui/pagination";
import { Separator } from "~/components/ui/separator";

interface WalletSummary extends IWalletResponse {
  totalIncome: number;
  totalAvailable: number;
  pendingBalance: number;
}

interface LoaderReturn {
  wallet: WalletSummary;
  transactions: ITransactionResponse[];
  pagination: PaginationProps;
  banks: IModelBank[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || 1);
  const take = 10;

  const [wallet, { transactions, pagination }, banks] = await Promise.all([
    getModelWalletSummary(modelId),
    getModelTransactions(modelId, page, take),
    getModelBanks(modelId),
  ]);

  return { wallet, transactions, pagination, banks };
}

interface ActionResponse {
  success: boolean;
  message: string;
  type: "success" | "error";
  actionType: string;
}

export async function action({ request }: ActionFunctionArgs): Promise<ActionResponse> {
  const modelId = await requireModelSession(request);
  const formData = await request.formData();

  const actionType = formData.get("actionType") as string;

  // Handle creating a bank from wallet page (inline upload)
  if (actionType === "createBank") {
    const qrCodeFile = formData.get("qr_code_file") as File;

    if (!qrCodeFile || !(qrCodeFile instanceof File) || qrCodeFile.size === 0) {
      return {
        success: false,
        message: "modelWallet.errors.qrCodeRequired",
        type: "error",
        actionType,
      };
    }

    try {
      const buffer = Buffer.from(await qrCodeFile.arrayBuffer());
      const qrCodeUrl = await uploadFileToBunnyServer(buffer, qrCodeFile.name, qrCodeFile.type);

      await createModelBank(modelId, {
        qr_code: qrCodeUrl,
        isDefault: true, // First bank is always default
      });

      return {
        success: true,
        message: "modelWallet.success.bankCreated",
        type: "success",
        actionType,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "modelWallet.errors.bankCreateFailed",
        type: "error",
        actionType,
      };
    }
  }

  // Handle withdrawal with bank creation (when no banks exist)
  if (actionType === "withdrawAndCreateBank") {
    const qrCodeFile = formData.get("qr_code_file") as File;
    const amount = parseFloat(formData.get("amount") as string);

    if (!qrCodeFile || !(qrCodeFile instanceof File) || qrCodeFile.size === 0) {
      return {
        success: false,
        message: "modelWallet.errors.qrCodeRequired",
        type: "error",
        actionType,
      };
    }

    if (!amount || amount <= 0) {
      return {
        success: false,
        message: "modelWallet.errors.invalidAmount",
        type: "error",
        actionType,
      };
    }

    try {
      // Step 1: Upload QR code to CDN
      const buffer = Buffer.from(await qrCodeFile.arrayBuffer());
      const qrCodeUrl = await uploadFileToBunnyServer(buffer, qrCodeFile.name, qrCodeFile.type);

      // Step 2: Create bank with uploaded QR code
      const newBank = await createModelBank(modelId, {
        qr_code: qrCodeUrl,
        isDefault: true, // First bank is always default
      });

      // Step 3: Create withdrawal with the new bank
      const result = await withdrawFunds(modelId, amount, newBank.id);

      if (result?.success) {
        return {
          success: true,
          message: "modelWallet.success.withdrawalSubmitted",
          type: "success",
          actionType,
        };
      } else {
        return {
          success: false,
          message: result?.message || "modelWallet.errors.withdrawalFailed",
          type: "error",
          actionType,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "modelWallet.errors.withdrawalFailed",
        type: "error",
        actionType,
      };
    }
  }

  if (actionType === "withdraw") {
    const amount = parseFloat(formData.get("amount") as string);
    const bankAccount = formData.get("bankAccount") as string;

    const result = await withdrawFunds(modelId, amount, bankAccount);

    if (result?.success) {
      return {
        success: true,
        message: "modelWallet.success.withdrawalSubmitted",
        type: "success",
        actionType,
      };
    } else {
      return {
        success: false,
        message: result?.message || "modelWallet.errors.withdrawalFailed",
        type: "error",
        actionType,
      };
    }
  }

  return {
    success: false,
    message: "Invalid action",
    type: "error",
    actionType: "",
  };
}

export default function ModelWalletPage() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const actionData = useActionData<ActionResponse>();

  // Track form submission state (submitting = when form is being submitted)
  const isSubmitting = navigation.state === "submitting";
  const isLoading = navigation.state === "loading";
  const { wallet, transactions, pagination, banks } = useLoaderData<LoaderReturn>();

  // Toast state - managed locally instead of URL params
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [isBalanceVisible, setIsBalanceVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("All");
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [withdrawError, setWithdrawError] = useState<string>("");

  // QR Code upload states (for inline upload when no banks exist)
  const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
  const [qrCodePreview, setQrCodePreview] = useState<string | null>(null);
  const qrCodeInputRef = React.useRef<HTMLInputElement>(null);

  // Handle action response - show toast and close modal on success
  React.useEffect(() => {
    if (actionData) {
      // Show toast message
      setToast({ message: actionData.message, type: actionData.type });

      // Close modal on success
      if (actionData.success) {
        setWithdrawModal(false);
      }

      // Auto-hide toast after 3 seconds
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [actionData]);

  // Auto-select default bank when modal opens
  React.useEffect(() => {
    if (withdrawModal && banks.length > 0 && !selectedBank) {
      // Find the default bank or select the first one
      const defaultBank = banks.find(bank => bank.isDefault);
      setSelectedBank(defaultBank?.id || banks[0].id);
    }
  }, [withdrawModal, banks, selectedBank]);

  // Reset states when modal closes
  React.useEffect(() => {
    if (!withdrawModal) {
      setQrCodeFile(null);
      setQrCodePreview(null);
      setWithdrawAmount("");
      setWithdrawError("");
      // Don't reset selectedBank - keep the selection for next time
    }
  }, [withdrawModal]);

  // Validate withdrawal amount against available balance
  const validateWithdrawAmount = (formattedAmount: string) => {
    const rawAmount = parseFloat(formattedAmount.replace(/,/g, "")) || 0;
    if (rawAmount > wallet.totalBalance) {
      setWithdrawError(t("modelWallet.errors.insufficientBalance", {
        defaultValue: "Withdrawal amount exceeds available balance"
      }));
      return false;
    }
    if (rawAmount <= 0) {
      setWithdrawError(t("modelWallet.errors.invalidAmount", {
        defaultValue: "Please enter a valid amount"
      }));
      return false;
    }
    setWithdrawError("");
    return true;
  };

  // Handle withdraw amount change with validation
  const handleWithdrawAmountChange = (value: string) => {
    const formatted = formatNumberWithCommas(value);
    setWithdrawAmount(formatted);
    if (formatted) {
      validateWithdrawAmount(formatted);
    } else {
      setWithdrawError("");
    }
  };

  // Handle QR code file selection
  const handleQrCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setQrCodeFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setQrCodePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove selected QR code
  const handleRemoveQrCode = () => {
    setQrCodeFile(null);
    setQrCodePreview(null);
    if (qrCodeInputRef.current) {
      qrCodeInputRef.current.value = "";
    }
  };

  // Format number with commas (e.g., 1000000 -> 1,000,000)
  const formatNumberWithCommas = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, "");
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Get raw numeric value (remove commas)
  const getRawAmount = (value: string) => {
    return value.replace(/,/g, "");
  };

  // Safety reset: ensure body styles are clean when wallet page renders
  // This handles cases where modal cleanup didn't run properly during navigation
  React.useEffect(() => {
    // Only reset if body has modal-related styles applied
    if (document.body.style.position === 'fixed') {
      const scrollY = Math.abs(parseInt(document.body.style.top || '0', 10));
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
    }
  }, []);

  const tabs = [
    { key: "All", label: t("modelWallet.tabs.all") },
    { key: "Approved", label: t("modelWallet.tabs.approved") },
    { key: "Pending", label: t("modelWallet.tabs.pending") },
    { key: "Failed", label: t("modelWallet.tabs.failed") },
  ];


  const filteredTransactions = transactions.filter((transaction) => {
    const matchesTab =
      activeTab === "All" ||
      (activeTab === "Approved" && transaction.status === "approved") ||
      (activeTab === "Failed" && transaction.status === "rejected") ||
      (activeTab === "Pending" && transaction.status === "pending");
    return matchesTab;
  });

  // Check if navigating to a child modal route (edit/delete/detail)
  const isNavigatingToModal = navigation.location?.pathname?.includes('/wallet/edit/') ||
    navigation.location?.pathname?.includes('/wallet/delete/') ||
    navigation.location?.pathname?.includes('/wallet/detail/');

  // Only show full-page loading when not navigating to modals
  if (isLoading && !isNavigatingToModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2">
          <Loader className="w-4 h-4 text-rose-500 animate-spin" />
          <p className="text-rose-600">{t("modelWallet.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full p-0 sm:p-4 lg:p-0">
        <div className="w-full space-y-2">
          <div className="flex gap-2">

            <div className="w-full sm:w-3/5 bg-gradient-to-r from-rose-600 to-rose-400 rounded-md py-3 sm:py-4 px-3 sm:px-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full -translate-x-10 translate-y-10"></div>
              <div className="relative z-10 space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Wallet size={18} className="sm:w-6 sm:h-6" />
                    <span className="font-medium text-sm sm:text-base">{t("modelWallet.totalBalance")} (Kip)</span>
                  </div>
                  <button
                    onClick={() => setIsBalanceVisible(!isBalanceVisible)}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                  >
                    {isBalanceVisible ? (
                      <Eye size={16} className="sm:w-5 sm:h-5" />
                    ) : (
                      <EyeOff size={16} className="sm:w-5 sm:h-5" />
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  <div>
                    <h2 className="text-sm sm:text-lg font-semibold">
                      {isBalanceVisible
                        ? formatCurrency1(wallet.totalIncome)
                        : "******"}
                    </h2>
                    <p className="text-white/80 text-xs sm:text-lg">{t("modelWallet.totalEarnings")}</p>
                  </div>

                  <div>
                    <p className="text-sm sm:text-lg font-semibold text-green-400">
                      {isBalanceVisible
                        ? formatCurrency1(wallet.totalAvailable)
                        : "******"}
                    </p>
                    <p className="text-white/80 text-[10px] sm:text-xs">{t("modelWallet.availableBalance")}</p>
                  </div>

                  <div>
                    <p className="text-sm sm:text-lg font-semibold text-amber-200">
                      {isBalanceVisible
                        ? formatCurrency1(wallet.pendingBalance)
                        : "******"}
                    </p>
                    <p className="text-white/80 text-[10px] sm:text-xs">{t("modelWallet.pendingBalance", { defaultValue: "Pending" })}</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setWithdrawModal(true)}
              className="hidden cursor-pointer sm:flex w-full sm:w-2/5 items-center justify-center border border-rose-500 rounded-md gap-2 hover:bg-rose-50 py-3"
            >
              <ArrowDownToLine className="text-gray-500" size={14} />
              <span className="text-sm text-gray-500">{t("modelWallet.withdrawFunds")}</span>
            </button>
          </div>

          <div className="bg-white rounded-md overflow-hidden">
            <div className="py-2 sm:py-4 px-0 sm:px-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md sm:text-md font-normal text-gray-600">
                  {t("modelWallet.withdrawalHistory")}
                </h3>
              </div>

              <div className="space-y-4 flex flex-col sm:flex-row items-start justify-between">
                <div className="flex gap-0 sm:gap-2 overflow-x-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`cursor-pointer py-1 rounded-sm whitespace-nowrap font-medium text-sm transition-colors ${activeTab === tab.key
                        ? "px-4 bg-rose-100 text-rose-600 border border-rose-300"
                        : "px-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            <div className="divide-y divide-gray-100">
              {filteredTransactions && filteredTransactions.length > 0 ? (
                filteredTransactions.map((transaction, index: number) => (
                  <div
                    key={transaction.id}
                    className="p-2 sm:p-4 hover:bg-gray-50 transition-colors group"
                  >
                    {/* Mobile Card Layout */}
                    <div className="sm:hidden">
                      <div className="flex flex-col gap-3">
                        {/* Top row: Icon, Info, Status */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`p-2.5 rounded-lg ${statusConfig[transaction.status]?.className.split(' ')[0] || 'bg-gray-100'}`}>
                              <span className={`text-xs font-semibold ${statusConfig[transaction.status]?.className.split(' ')[1] || 'text-gray-600'}`}>
                                LAK
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 text-sm truncate">
                                {t(`transactionTypes.${transaction.identifier}`, { defaultValue: capitalize(transaction.identifier) })}
                              </h4>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {transaction.createdAt.toDateString()}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <p className={`font-bold text-base ${transaction.identifier === "withdrawal" ? "text-red-600" : "text-green-600"}`}>
                                  {transaction.identifier === "withdrawal" ? "-" : "+"}
                                  {formatCurrency(transaction.amount)}
                                </p>
                              </div>
                            </div>
                          </div>
                          {/* Status at top right */}
                          <span className={`inline-block text-xs px-2 py-1 rounded-sm ${statusConfig[transaction.status]?.className || 'bg-gray-100 text-gray-600'}`}>
                            {t(`walletStatus.${transaction.status}`, { defaultValue: capitalize(transaction.status) })}
                          </span>
                        </div>
                        {/* Bottom row: Action buttons */}
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/model/settings/wallet/detail/${transaction.id}`}
                            className="border bg-gray-100 flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                          >
                            <EyeIcon className="h-3 w-3" />
                            <span>{t("modelWallet.menu.viewDetails")}</span>
                          </Link>
                          {transaction.status === "pending" && (
                            <Link
                              to={`/model/settings/wallet/edit/${transaction.id}`}
                              className="border border-blue-300 bg-blue-50 flex items-center gap-1 px-2 py-1 text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                            >
                              <FilePenLine className="h-3 w-3" />
                              <span>{t("modelWallet.menu.edit")}</span>
                            </Link>
                          )}
                          {transaction.status === "pending" && (
                            <Link
                              to={`/model/settings/wallet/delete/${transaction.id}`}
                              className="border border-rose-300 bg-rose-50 flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash className="h-3 w-3" />
                              <span>{t("modelWallet.menu.delete")}</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Desktop Table Layout */}
                    <div className="hidden sm:flex flex-col gap-3">
                      {/* Top row: Info and Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center justify-start space-x-8">
                          <p className="text-gray-500">{index + 1}</p>
                          <div className="flex items-center gap-4">
                            <div
                              className={`p-3 rounded-md ${statusConfig[transaction.status]?.className.split(' ')[0] || 'bg-gray-100'}`}
                            >
                              <span
                                className={statusConfig[transaction.status]?.className.split(' ')[1] || 'text-gray-600'}
                              >
                                LAK
                              </span>
                            </div>

                            <div>
                              <h4 className="font-medium text-gray-900">
                                {t(`transactionTypes.${transaction.identifier}`, { defaultValue: capitalize(transaction.identifier) })}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500">
                                  {transaction.createdAt.toDateString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-center">
                            <p
                              className={`font-semibold ${transaction.identifier === "withdrawal"
                                ? "text-red-600"
                                : "text-green-600"
                                }`}
                            >
                              {transaction.identifier === "withdrawal"
                                ? "-"
                                : "+"}
                              {formatCurrency(transaction.amount)}
                            </p>
                          </div>
                        </div>
                        {/* Status at top right */}
                        <p
                          className={`text-center text-xs px-2 py-1 rounded-sm ${statusConfig[transaction.status]?.className || 'bg-gray-100 text-gray-600'}`}
                        >
                          {t(`walletStatus.${transaction.status}`, { defaultValue: capitalize(transaction.status) })}
                        </p>
                      </div>
                      {/* Bottom row: Action buttons at right */}
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/model/settings/wallet/detail/${transaction.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                        >
                          <EyeIcon className="h-3 w-3" />
                          <span>{t("modelWallet.menu.viewDetails")}</span>
                        </Link>
                        {transaction.status === "pending" && (
                          <Link
                            to={`/model/settings/wallet/edit/${transaction.id}`}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
                          >
                            <FilePenLine className="h-3 w-3" />
                            <span>{t("modelWallet.menu.edit")}</span>
                          </Link>
                        )}
                        {transaction.status === "pending" && (
                          <Link
                            to={`/model/settings/wallet/delete/${transaction.id}`}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 transition-colors"
                          >
                            <Trash className="h-3 w-3" />
                            <span>{t("modelWallet.menu.delete")}</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search size={24} className="text-gray-400" />
                  </div>
                  <h4 className="text-gray-900 font-medium mb-2">
                    {t("modelWallet.noTransactions")}
                  </h4>
                  <p className="text-gray-600 text-sm">
                    {t("modelWallet.noTransactionsHint")}
                  </p>
                </div>
              )}
              {pagination.totalPages > 1 && (
                <Pagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  totalCount={pagination.totalCount}
                  limit={pagination.limit}
                  hasNextPage={pagination.hasNextPage}
                  hasPreviousPage={pagination.hasPreviousPage}
                  baseUrl=""
                  searchParams={searchParams}
                />
              )}
            </div>
          </div>

          <button
            onClick={() => setWithdrawModal(true)}
            className="text-sm sm:hidden fixed bottom-18 right-4 bg-rose-500 hover:bg-rose-600 text-white rounded-lg py-2 px-4 shadow-lg flex items-center justify-center z-9"
          >
            <ArrowDownToLine className="h-3 w-3" /> {t("modelWallet.withdraw")}
          </button>
        </div>
      </div>

      <Dialog open={withdrawModal} onOpenChange={setWithdrawModal}>
        <DialogContent className="sm:max-w-lg px-3 sm:px-8">
          <DialogHeader>
            <DialogTitle className="text-md font-normal">{t("modelWallet.withdrawFunds")}</DialogTitle>
          </DialogHeader>

          <div className="mb-4 p-4 bg-rose-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">{t("modelWallet.availableBalance")}</p>
            <h3 className="text-lg font-bold text-rose-600 flex items-center gap-1">
              {formatCurrency(wallet.totalBalance)}
            </h3>
          </div>

          {banks.length > 0 ? (
            /* Withdraw Form - when banks exist */
            <Form method="post" className="space-y-6">
              <input type="hidden" name="actionType" value="withdraw" />

              <div className="space-y-2">
                <Label>
                  {t("modelWallet.modal.bankAccount")} <span className="text-rose-500">*</span>
                </Label>
                <input type="hidden" name="bankAccount" value={selectedBank} />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-48 overflow-y-auto p-1">
                  {banks.map((bank) => (
                    <div
                      key={bank.id}
                      onClick={() => setSelectedBank(bank.id)}
                      className={`relative cursor-pointer rounded-lg border-2 p-2 transition-all ${selectedBank === bank.id
                        ? "border-rose-500 bg-rose-50"
                        : "border-gray-200 hover:border-gray-300"
                        }`}
                    >
                      <img
                        src={bank.qr_code}
                        alt="QR Code"
                        className="w-full h-20 object-contain rounded"
                      />
                      {/* Default badge */}
                      {bank.isDefault && (
                        <div className="absolute top-1 left-1 bg-amber-500 text-white text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Star className="w-2 h-2" fill="currentColor" />
                          <span>{t("modelWallet.modal.default", { defaultValue: "Default" })}</span>
                        </div>
                      )}
                      {/* Selected checkmark */}
                      {selectedBank === bank.id && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  {t("modelWallet.modal.selectBankHint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">
                  {t("modelWallet.modal.withdrawalAmount")} <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Kip</span>
                  <input type="hidden" name="amount" value={getRawAmount(withdrawAmount)} />
                  <Input
                    id="amount"
                    type="text"
                    inputMode="numeric"
                    value={withdrawAmount}
                    onChange={(e) => handleWithdrawAmountChange(e.target.value)}
                    required
                    className={`pl-10 text-sm ${withdrawError ? "border-red-500 focus:border-red-500" : ""}`}
                    placeholder={t("modelWallet.modal.enterAmount")}
                  />
                </div>
                {withdrawError && (
                  <p className="text-xs text-red-500">{withdrawError}</p>
                )}
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-sm">
                <p className="text-xs text-blue-800">
                  <strong>{t("modelWallet.modal.note")}</strong> {t("modelWallet.modal.withdrawNote")}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWithdrawModal(false)}
                  disabled={isSubmitting}
                  className="w-1/2"
                >
                  {t("modelWallet.modal.close")}
                </Button>
                <Button
                  type="submit"
                  disabled={!selectedBank || isSubmitting || !!withdrawError || !withdrawAmount}
                  className="w-1/2 bg-rose-500 text-white cursor-pointer hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <><Loader className="w-4 h-4 animate-spin mr-1" /> {t("modelWallet.modal.processing", { defaultValue: "Processing..." })}</>
                  ) : (
                    t("modelWallet.withdraw")
                  )}
                </Button>
              </div>
            </Form>
          ) : (
            /* Upload QR Code + Withdrawal Form - when no banks exist */
            <Form method="post" className="space-y-6" encType="multipart/form-data">
              <input type="hidden" name="actionType" value="withdrawAndCreateBank" />

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-sm mb-4">
                <p className="text-xs text-amber-800">
                  {t("modelWallet.modal.noBanksMessage", { defaultValue: "Please upload your bank QR code and enter withdrawal amount below." })}
                </p>
              </div>

              <div className="space-y-2">
                <Label>
                  {t("modelWallet.modal.uploadQrCode", { defaultValue: "Upload QR Code" })} <span className="text-rose-500">*</span>
                </Label>

                <input
                  ref={qrCodeInputRef}
                  type="file"
                  name="qr_code_file"
                  accept="image/*"
                  onChange={handleQrCodeChange}
                  className="hidden"
                />

                {qrCodePreview ? (
                  <div className="relative w-full max-w-[200px] mx-auto">
                    <img
                      src={qrCodePreview}
                      alt="QR Preview"
                      className="w-full h-40 object-contain border border-gray-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveQrCode}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 cursor-pointer"
                    >
                      <span className="text-xs">×</span>
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => qrCodeInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-rose-400 hover:bg-rose-50/50 transition-colors"
                  >
                    <Upload className="w-5 h-5 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      {t("modelWallet.modal.clickToUpload", { defaultValue: "Click to upload your QR code" })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {t("modelWallet.modal.supportedFormats", { defaultValue: "JPG, PNG, GIF" })}
                    </p>
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  {t("modelWallet.modal.qrCodeHint", { defaultValue: "This QR code will be saved for this withdrawal." })}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">
                  {t("modelWallet.modal.withdrawalAmount")} <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Kip</span>
                  <input type="hidden" name="amount" value={getRawAmount(withdrawAmount)} />
                  <Input
                    id="amount"
                    type="text"
                    inputMode="numeric"
                    value={withdrawAmount}
                    onChange={(e) => handleWithdrawAmountChange(e.target.value)}
                    required
                    className={`pl-10 text-sm ${withdrawError ? "border-red-500 focus:border-red-500" : ""}`}
                    placeholder={t("modelWallet.modal.enterAmount")}
                  />
                </div>
                {withdrawError && (
                  <p className="text-xs text-red-500">{withdrawError}</p>
                )}
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-sm">
                <p className="text-xs text-blue-800">
                  <strong>{t("modelWallet.modal.note")}</strong> {t("modelWallet.modal.withdrawNote")}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWithdrawModal(false)}
                  disabled={isSubmitting}
                  className="w-1/2"
                >
                  {t("modelWallet.modal.close")}
                </Button>
                <Button
                  type="submit"
                  disabled={!qrCodeFile || isSubmitting || !!withdrawError || !withdrawAmount}
                  className="w-1/2 bg-rose-500 text-white cursor-pointer hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <><Loader className="w-4 h-4 animate-spin mr-1" /> {t("modelWallet.modal.processing", { defaultValue: "Processing..." })}</>
                  ) : (
                    t("modelWallet.modal.withdrawAndUpload", { defaultValue: "Withdraw" })
                  )}
                </Button>
              </div>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${toast.type === "success"
            ? "bg-green-500 text-white"
            : "bg-red-500 text-white"
            }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === "success" ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="text-sm">{t(toast.message)}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 hover:opacity-80"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <Outlet />
    </>
  );
}
