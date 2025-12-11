import {
  useLoaderData,
  useNavigate,
  type LoaderFunctionArgs,
} from "react-router";
import { useTranslation } from "react-i18next";
import { Clock, Check, X, Calendar } from "lucide-react";

// components
import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";

// utils and service
import { formatCurrency } from "~/utils";
import { capitalize } from "~/utils/functions/textFormat";
import { getModelTransaction } from "~/services/wallet.server";
import { requireModelSession } from "~/services/model-auth.server";
import type { ITransactionResponse } from "~/interfaces/transaction";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const transaction = await getModelTransaction(params.transactionId!, modelId);
  return transaction;
}

export default function ModelTransactionDetails() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const transaction = useLoaderData<ITransactionResponse>();

  function closeHandler() {
    navigate("/model/settings/wallet");
  }

  return (
    <Modal
      onClose={closeHandler}
      className="h-screen sm:h-auto w-full py-8 sm:py-4 px-4 sm:w-3/6 p-4 border rounded-xl"
    >
      <div className="space-y-4 mt-10 sm:mt-0">
        <div className="mt-4 sm:mt-0 px-4">
          <h3 className="flex items-center text-black text-md font-bold">
            {t("modelWallet.detail.title")}
          </h3>
          <p className="text-gray-500 text-sm">
            {t("modelWallet.detail.subtitle")}
          </p>
        </div>
        <div className="space-y-2 px-4">
          <div className="space-y-4">
            <hr />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                <label className="text-sm font-medium text-gray-500">
                  {t("modelWallet.detail.transactionId")}
                </label>
                <p className="mt-0 sm:mt-1 text-sm font-mono">
                  {transaction?.id}
                </p>
              </div>
              <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                <label className="text-sm font-medium text-gray-500">
                  {t("modelWallet.detail.type")}
                </label>
                <p className="mt-0 sm:mt-1 text-sm font-mono">
                  {transaction?.identifier}
                </p>
              </div>
              <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                <label className="text-sm font-medium text-gray-500">
                  {t("modelWallet.detail.amount")}
                </label>
                <p
                  className={`mt-0 sm:mt-1 text-lg font-semibold ${transaction?.identifier === "withdrawal"
                    ? "text-red-600"
                    : "text-green-600"
                    }`}
                >
                  {transaction?.identifier === "withdrawal" ? "- " : "+ "}
                  {formatCurrency(transaction?.amount)}
                </p>
              </div>
              <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                <label className="text-sm font-medium text-gray-500">
                  {t("modelWallet.detail.createdAt")}
                </label>
                <p className="mt-0 sm:mt-1 text-sm">
                  {transaction?.createdAt.toDateString()}
                </p>
              </div>
              <div className="flex flow-row sm:flex-col items-start justify-start space-x-3 sm:space-x-0">
                <label className="text-sm font-medium text-gray-500">
                  {t("modelWallet.detail.status")}
                </label>
                <br />
                <button
                  className={`text-center text-xs px-2 py-1 rounded-sm ${transaction.status === "approved"
                    ? "bg-green-100 text-green-600"
                    : transaction.status === "rejected"
                      ? "bg-red-100 text-red-600"
                      : "bg-orange-100 text-orange-600"
                    }`}
                >
                  {capitalize(transaction.status)}
                </button>
              </div>
              {transaction?.rejectReason && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    {t("modelWallet.detail.rejectReason")}
                  </label>
                  <p className="mt-1 text-sm">{transaction?.rejectReason}</p>
                </div>
              )}
            </div>
            <hr />
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{t("modelWallet.detail.created")}</p>
                  <p className="text-xs text-gray-500">
                    {transaction?.createdAt.toDateString()}
                  </p>
                </div>
              </div>

              {transaction?.status === "approved" && (
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-green-50 border border-green-300">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{t("modelWallet.detail.approved")}</p>
                    <p className="text-xs text-gray-500">
                      {transaction?.updatedAt.toDateString()}
                    </p>
                  </div>
                </div>
              )}

              {transaction?.status === "rejected" && (
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-red-50">
                    <X className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{t("modelWallet.detail.rejected")}</p>
                    <p className="text-xs text-gray-500">
                      {transaction?.updatedAt.toDateString()}
                    </p>
                  </div>
                </div>
              )}

              {transaction?.status === "pending" && (
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-yellow-50">
                    <Clock className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{t("modelWallet.detail.pending")}</p>
                    <p className="text-xs text-gray-500">
                      {t("modelWallet.detail.waitingApproval")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            variant="outline"
            onClick={closeHandler}
            className="bg-rose-500 text-white hover:bg-rose-600 hover:text-white"
          >
            {t("modelWallet.detail.close")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
