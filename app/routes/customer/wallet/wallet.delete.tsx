import { AlertCircle, AlertTriangle, Info, Loader } from "lucide-react";
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation, useParams, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";

// components
import Modal from "~/components/ui/model";
import { Button } from "~/components/ui/button";
import { capitalize } from "~/utils/functions/textFormat";
import { requireUserSession } from "~/services/auths.server";
import { deleteTransaction, getTransaction } from "~/services/wallet.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
   const customerId = await requireUserSession(request);
   const transaction = await getTransaction(params.transactionId!, customerId);
   return { transaction };
}

export async function action({ params, request }: ActionFunctionArgs) {
   const customerId = await requireUserSession(request);
   const { transactionId } = params;

   if (!customerId) {
      throw new Response("Customer ID is required", { status: 400 });
   }

   if (request.method === "DELETE") {
      try {
         const res = await deleteTransaction(transactionId!, customerId);
         if (res.id) {
            return redirect(`/customer/wallets?toastMessage=Delete+your+transaction+successfully!&toastType=success`);
         }
      } catch (error: any) {
         if (error?.payload) {
            return error.payload;
         }
         return {
            success: false,
            error: true,
            message: error || "Failed to delete transaction!",
         };
      }
   }

   return { success: false, error: true, message: "Invalid request method!" };
}


export default function CustomersDeleted() {
   const { t } = useTranslation();
   const { transactionId } = useParams();
   const { transaction } = useLoaderData<typeof loader>();
   const navigate = useNavigate();
   const navigation = useNavigation();
   const actionData = useActionData<typeof action>()
   const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "DELETE";

   const isRecharge = transaction?.identifier === "recharge";

   function closeHandler() {
      navigate("/customer/wallets");
   }

   return (
      <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 rounded-xl border">
         <h1 className="text-xl font-bold">{isRecharge ? t('wallet.cancel.title') : t('wallet.delete.title')}</h1>
         <p className="hidden sm:block text-sm text-gray-500 my-2">
            {isRecharge ? t('wallet.cancel.description') : t('wallet.delete.description')}&nbsp;
            <span className="font-bold text-primary">" {transactionId} "</span>
         </p>
         <Form method="delete" className="space-y-4 mt-4">
            {isRecharge && (
               <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                     <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                     <div className="text-sm text-blue-800">
                        <p className="font-medium">{t('wallet.cancel.securityTitle')}</p>
                        <p className="mt-1">{t('wallet.cancel.securityMessage')}</p>
                     </div>
                  </div>
               </div>
            )}
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
               <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-800">
                     <p className="font-medium">{isRecharge ? t('wallet.cancel.warningTitle') : t('wallet.delete.warningTitle')}</p>
                     <p>{isRecharge ? t('wallet.cancel.warningMessage') : t('wallet.delete.warningMessage')}</p>
                  </div>
               </div>
            </div>
            <div>
               {actionData?.error && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                     <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                     <span className="text-red-500 text-sm">
                        {capitalize(actionData.message)}
                     </span>
                  </div>
               )}
            </div>
            <div className="flex justify-end space-x-2 pt-4">
               <Button type="button" variant="outline" onClick={closeHandler}>
                  {isRecharge ? t('wallet.cancel.goBack') : t('wallet.delete.cancel')}
               </Button>
               <Button type="submit" variant="destructive" disabled={isSubmitting} className="text-white bg-rose-500">
                  {isSubmitting && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                  {isRecharge
                     ? (isSubmitting ? t('wallet.cancel.cancelling') : t('wallet.cancel.confirmCancel'))
                     : (isSubmitting ? t('wallet.delete.deleting') : t('wallet.delete.delete'))
                  }
               </Button>
            </div>
         </Form>
      </Modal>
   );
}
