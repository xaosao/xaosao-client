import React, { useState } from "react";
import { AlertCircle, Loader } from "lucide-react";
import type { Route } from "./+types/edit.$transactionId";
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  type LoaderFunctionArgs,
} from "react-router";
import { useTranslation } from "react-i18next";

// components
import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";

// utils and service
import {
  extractFilenameFromCDNSafe,
} from "~/utils/functions/textFormat";
import {
  deleteFileFromBunny,
  uploadFileToBunnyServer,
} from "~/services/upload.server";
import type {
  ITransactionCredentials,
  ITransactionResponse,
} from "~/interfaces/transaction";
import { requireModelSession } from "~/services/model-auth.server";
import {
  getModelTransaction,
  updateModelTransaction,
  getModelWalletSummary,
} from "~/services/wallet.server";
import { validateTopUpInputs } from "~/services/validation.server";
import { formatCurrency, parseFormattedNumber } from "~/utils";

interface LoaderData {
  transaction: ITransactionResponse;
  availableBalance: number;
}

export async function loader({ params, request }: LoaderFunctionArgs): Promise<LoaderData> {
  const modelId = await requireModelSession(request);
  const [transaction, walletSummary] = await Promise.all([
    getModelTransaction(params.transactionId!, modelId),
    getModelWalletSummary(modelId),
  ]);

  if (!transaction) {
    throw new Response("Transaction not found", { status: 404 });
  }

  return {
    transaction: transaction as unknown as ITransactionResponse,
    availableBalance: walletSummary.totalAvailable,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const modelId = await requireModelSession(request);
  const transactionId = params.transactionId || "";
  const formData = await request.formData();
  const transactionData = Object.fromEntries(
    formData
  ) as Partial<ITransactionCredentials>;

  const file = formData.get("paymentSlip") as File | null;
  const originPaymentSlip = formData.get("originPaymentSlip");

  if (request.method === "PATCH") {
    try {
      if (file && file instanceof File && file.size > 0) {
        if (originPaymentSlip) {
          await deleteFileFromBunny(
            extractFilenameFromCDNSafe(originPaymentSlip as string)
          );
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const url = await uploadFileToBunnyServer(buffer, file.name, file.type);
        transactionData.paymentSlip = url;
      } else {
        transactionData.paymentSlip = formData.get(
          "originPaymentSlip"
        ) as string;
      }

      transactionData.amount = parseFormattedNumber(transactionData.amount);

      await validateTopUpInputs(transactionData as ITransactionCredentials);

      const res = await updateModelTransaction(
        transactionId,
        modelId,
        transactionData as ITransactionCredentials
      );
      if (res.id) {
        return redirect(
          `/model/settings/wallet?toastMessage=${encodeURIComponent("modelWallet.success.updated")}&toastType=success`
        );
      }
    } catch (error: any) {
      console.error("Error updating transaction:", error);

      if (error?.payload) {
        return error.payload;
      }
      if (error && typeof error === "object" && !Array.isArray(error)) {
        const keys = Object.keys(error);
        if (keys.length > 0) {
          const firstKey = keys[0];
          const firstMessage = (error as Record<string, any>)[firstKey];

          return {
            success: false,
            error: true,
            message: `${firstKey}: ${firstMessage}`,
          };
        }
      }

      return {
        success: false,
        error: true,
        message: error || "modelWallet.errors.updateFailed",
      };
    }
  }
  return { success: false, error: true, message: "modelWallet.errors.invalidRequest" };
}

export default function ModelTransactionEdit() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const { transaction, availableBalance } = useLoaderData<LoaderData>();
  const [amount, setAmount] = React.useState<number>(transaction.amount || 0);
  const [amountError, setAmountError] = useState<string | null>(null);
  const isSubmitting =
    navigation.state !== "idle" && navigation.formMethod === "PATCH";

  const [previewSlip, setPreviewSlip] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Validate amount against available balance (for withdrawal transactions)
  const validateAmount = (newAmount: number) => {
    if (transaction.identifier === "withdrawal" && newAmount > availableBalance) {
      setAmountError(t("modelWallet.errors.insufficientBalance", {
        defaultValue: "Withdrawal amount exceeds available balance"
      }));
      return false;
    }
    if (newAmount <= 0) {
      setAmountError(t("modelWallet.errors.invalidAmount", {
        defaultValue: "Please enter a valid amount"
      }));
      return false;
    }
    setAmountError(null);
    return true;
  };

  // Handle amount change with validation
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, "");
    if (rawValue === "") {
      setAmount(0);
      setAmountError(null);
    } else {
      const numValue = Number(rawValue);
      if (!isNaN(numValue)) {
        setAmount(numValue);
        validateAmount(numValue);
      }
    }
  };

  // Check if file is WebP format
  const isWebpFile = (file: File): boolean => {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    return type === "image/webp" || name.endsWith(".webp");
  };

  function closeHandler() {
    navigate("/model/settings/wallet");
  }

  // When user uploads a new file
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    console.log("File selected:", file);
    setUploadError(null);

    if (file) {
      // Block WebP files
      if (isWebpFile(file)) {
        setUploadError(
          t("modelWallet.edit.webpNotSupported", {
            defaultValue:
              "WebP format is not supported. Please use JPG or PNG instead.",
          })
        );
        setSelectedFile(null);
        setPreviewSlip(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      setSelectedFile(file); // Store the actual file

      // Create object URL for preview (more reliable on iOS)
      try {
        const objectUrl = URL.createObjectURL(file);
        console.log("Preview URL created:", objectUrl);
        setPreviewSlip(objectUrl);
      } catch (error) {
        console.error("Error creating preview:", error);

        // Fallback to FileReader if URL.createObjectURL fails
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          console.log("FileReader preview created");
          setPreviewSlip(base64);
        };
        reader.onerror = (error) => {
          console.error("FileReader error:", error);
        };
        reader.readAsDataURL(file);
      }
    }
  }

  // Cleanup object URL when component unmounts or preview changes
  React.useEffect(() => {
    return () => {
      if (previewSlip && previewSlip.startsWith("blob:")) {
        URL.revokeObjectURL(previewSlip);
      }
    };
  }, [previewSlip]);

  // Trigger hidden file input
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function triggerFileSelect() {
    console.log("Triggering file select");
    fileInputRef.current?.click();
  }

  const quickAmounts = [50000, 100000, 200000, 500000, 1000000];

  return (
    <Modal
      onClose={closeHandler}
      className="h-screen sm:h-auto w-full sm:w-3/5 py-8 sm:py-4 px-4 border rounded-xl"
    >
      <Form method="patch" className="space-y-4" encType="multipart/form-data">
        <div className="mt-10 sm:mt-0">
          <h3 className="flex items-center text-black text-md font-bold">
            {t("modelWallet.edit.title")}
          </h3>
          <p className="text-gray-500 text-sm ml-2">
            {t("modelWallet.edit.subtitle")}
          </p>
        </div>

        <div className="space-y-2 px-2 sm:px-4">
          <div className="space-y-4">
            <hr />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">
                  {t("modelWallet.edit.transactionId")}
                </label>
                <p className="mt-1 text-sm font-mono">{transaction?.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">
                  {t("modelWallet.edit.type")}
                </label>
                <p className="mt-1 text-sm font-mono">
                  {transaction?.identifier}
                </p>
              </div>
            </div>
            <hr />

            {/* Available Balance Display (for withdrawal transactions) */}
            {transaction.identifier === "withdrawal" && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t("modelWallet.availableBalance")}</span>
                  <span className="text-lg font-bold text-rose-600">
                    {formatCurrency(availableBalance)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("modelWallet.edit.amount")} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="amount"
                    value={amount != null ? amount.toLocaleString() : ""}
                    onChange={handleAmountChange}
                    placeholder="0.00"
                    className={`block w-full p-4 py-2 border rounded-md text-md font-semibold focus:ring-1 focus:ring-rose-200 focus:border-rose-500 outline-none transition-colors ${
                      amountError ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                </div>
                {amountError && (
                  <p className="mt-1 text-xs text-red-500">{amountError}</p>
                )}
              </div>
            </div>

            {uploadError && (
              <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded-lg">
                <p className="text-red-600 text-xs text-center">{uploadError}</p>
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              name="paymentSlip"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              className="hidden"
              name="originPaymentSlip"
              defaultValue={transaction.paymentSlip}
            />
          </div>
        </div>

        <div className="px-8">
          {actionData?.error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-red-500 text-sm">
                {t(actionData.message)}
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={closeHandler}
            className="bg-gray-500 text-white hover:bg-gray-600 hover:text-white"
          >
            {t("modelWallet.edit.close")}
          </Button>
          <Button
            type="submit"
            variant="outline"
            disabled={isSubmitting || !!uploadError || !!amountError || amount <= 0}
            className="flex gap-2 bg-rose-500 text-white hover:bg-rose-600 hover:text-white disabled:opacity-50"
          >
            {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
            {isSubmitting ? t("modelWallet.edit.saving") : t("modelWallet.edit.saveChange")}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
