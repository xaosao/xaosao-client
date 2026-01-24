import { AlertCircle, AlertTriangle, Loader } from "lucide-react";
import {
  Form,
  redirect,
  useActionData,
  useNavigate,
  useNavigation,
  useParams,
  type ActionFunctionArgs,
} from "react-router";
import { useTranslation } from "react-i18next";

// components
import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";
import { capitalize } from "~/utils/functions/textFormat";
import { requireModelSession } from "~/services/model-auth.server";
import { deleteModelTransaction } from "~/services/wallet.server";

export async function action({ params, request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const { transactionId } = params;

  if (!modelId) {
    throw new Response("Model ID is required", { status: 400 });
  }

  if (request.method === "DELETE") {
    try {
      const res = await deleteModelTransaction(transactionId!, modelId);
      if (res.id) {
        return redirect(
          `/model/settings/wallet?toastMessage=${encodeURIComponent("modelWallet.success.deleted")}&toastType=success`
        );
      }
    } catch (error: any) {
      if (error?.payload) {
        return error.payload;
      }
      return {
        success: false,
        error: true,
        message: error || "modelWallet.errors.deleteFailed",
      };
    }
  }

  return { success: false, error: true, message: "modelWallet.errors.invalidRequest" };
}

export default function ModelTransactionDelete() {
  const { t } = useTranslation();
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const isSubmitting =
    navigation.state !== "idle" && navigation.formMethod === "DELETE";

  function closeHandler() {
    navigate("/model/settings/wallet");
  }

  return (
    <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 rounded-md border py-6 px-4">
      <h1 className="text-xl font-bold">{t("modelWallet.delete.title")}</h1>
      <p className="hidden sm:block text-sm text-gray-500 my-2">
        {t("modelWallet.delete.confirmMessage")}&nbsp;{" "}
        <span className="font-bold text-primary">" {transactionId} "</span>
      </p>
      <Form method="delete" className="space-y-4 mt-4">
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-medium">{t("modelWallet.delete.warning")}</p>
              <p>{t("modelWallet.delete.warningMessage")}</p>
            </div>
          </div>
        </div>
        <div>
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
          <Button type="button" variant="outline" onClick={closeHandler}>
            {t("modelWallet.delete.cancel")}
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={isSubmitting}
            className="text-white bg-rose-500"
          >
            {isSubmitting && <Loader className="h-4 w-4 mr-2 animate-spin" />}
            {isSubmitting ? t("modelWallet.delete.deleting") : t("modelWallet.delete.deleteButton")}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
