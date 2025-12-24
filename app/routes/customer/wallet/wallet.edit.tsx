import React, { useState } from "react"
import type { Route } from "./+types/wallet.edit"
import { AlertCircle, ArrowLeft, FileText, Loader, Upload } from "lucide-react"
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation, type LoaderFunctionArgs } from "react-router"
import { useTranslation } from "react-i18next"

// components
import Modal from "~/components/ui/model"
import { Button } from "~/components/ui/button"

// utils and service
import { downloadImage } from "~/utils/functions/download"
import { capitalize, extractFilenameFromCDNSafe } from "~/utils/functions/textFormat"
import { deleteFileFromBunny, uploadFileToBunnyServer } from "~/services/upload.server"
import type { ITransactionCredentials, ITransactionResponse } from "~/interfaces/transaction"
import { requireUserSession } from "~/services/auths.server";
import { getTransaction, updateTransaction } from "~/services/wallet.server";
import { validateTopUpInputs } from "~/services/validation.server";
import { formatCurrency, parseFormattedNumber } from "~/utils"

export async function loader({ params, request }: LoaderFunctionArgs) {
   const customerId = await requireUserSession(request);
   const transaction = await getTransaction(params.transactionId!, customerId);
   return transaction;
}

export async function action({ params, request }: Route.ActionArgs) {
   const customerId = await requireUserSession(request)
   const transactionId = params.transactionId || "";
   const formData = await request.formData();
   const transactionData = Object.fromEntries(formData) as Partial<ITransactionCredentials>;

   const file = formData.get("paymentSlip") as File | null;
   const originPaymentSlip = formData.get("originPaymentSlip");

   if (request.method === "PATCH") {
      try {
         if (file && file instanceof File && file.size > 0) {
            if (originPaymentSlip) {
               await deleteFileFromBunny(extractFilenameFromCDNSafe(originPaymentSlip as string))
            }
            const buffer = Buffer.from(await file.arrayBuffer());
            const url = await uploadFileToBunnyServer(buffer, file.name, file.type);
            transactionData.paymentSlip = url;

         } else {
            transactionData.paymentSlip = formData.get("originPaymentSlip") as string;
         }

         transactionData.amount = parseFormattedNumber(transactionData.amount);

         await validateTopUpInputs(transactionData as ITransactionCredentials);

         const res = await updateTransaction(transactionId, customerId, transactionData as ITransactionCredentials);
         if (res.id) {
            return redirect(`/customer/wallets?toastMessage=Update+your+transaction+successfully!&toastType=success`);
         }
      } catch (error: any) {
         console.error("Error updating customer:", error);

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
            message: error || "Failed to edit top-up information!",
         };
      }
   }
   return { success: false, error: true, message: "Invalid request method!" };
}

export default function TransactionEdit() {
   const { t } = useTranslation();
   const navigate = useNavigate();
   const navigation = useNavigation();
   const actionData = useActionData<typeof action>()
   const transaction = useLoaderData<ITransactionResponse>();
   const [amount, setAmount] = React.useState<number>(transaction.amount || 0);
   const isSubmitting =
      navigation.state !== "idle" && navigation.formMethod === "PATCH";

   const [previewSlip, setPreviewSlip] = useState<string | null>(null);
   const [selectedFile, setSelectedFile] = useState<File | null>(null);
   const [uploadError, setUploadError] = useState<string | null>(null);

   // Check if file is WebP format
   const isWebpFile = (file: File): boolean => {
      const type = file.type.toLowerCase();
      const name = file.name.toLowerCase();
      return type === 'image/webp' || name.endsWith('.webp');
   };

   const handleDownloadSlip = async () => {
      if (transaction?.paymentSlip) {
         downloadImage(transaction.paymentSlip, `payment-slip-${transaction.identifier}.jpg`);
      }
   };

   function closeHandler() {
      navigate("/customer/wallets");
   }

   // When user uploads a new file
   function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      console.log("File selected:", file);
      setUploadError(null);

      if (file) {
         // Block WebP files
         if (isWebpFile(file)) {
            setUploadError(t('wallet.edit.webpNotSupported', { defaultValue: 'WebP format is not supported. Please use JPG or PNG instead.' }));
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
         if (previewSlip && previewSlip.startsWith('blob:')) {
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
      <Modal onClose={closeHandler} className="h-screen sm:h-auto w-full sm:w-3/5 py-8 sm:py-4 px-4 border rounded-xl">
         <Form method="patch" className="space-y-4" encType="multipart/form-data">
            <div className="mt-10 sm:mt-0">
               <h3 className="flex items-center text-black text-md font-bold">{t('wallet.edit.title')}</h3>
               <p className="text-gray-500 text-sm ml-2">{t('wallet.edit.subtitle')}</p>
            </div>

            <div className="space-y-2 px-2 sm:px-4">
               <div className="space-y-4">
                  <hr />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label className="text-sm font-medium text-gray-500">{t('wallet.edit.transactionId')}</label>
                        <p className="mt-1 text-sm font-mono">{transaction?.id}</p>
                     </div>
                     <div>
                        <label className="text-sm font-medium text-gray-500">{t('wallet.edit.identifier')}</label>
                        <p className="mt-1 text-sm font-mono">{transaction?.identifier}</p>
                     </div>
                  </div>
                  <hr />

                  <div className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                           {t('wallet.edit.amount')} <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                           <input
                              type="text"
                              name="amount"
                              value={amount != null ? amount.toLocaleString() : ""}
                              onChange={(e) => {
                                 const rawValue = e.target.value.replace(/,/g, '');
                                 if (rawValue === '') {
                                    setAmount(0);
                                 } else {
                                    const numValue = Number(rawValue);
                                    if (!isNaN(numValue)) {
                                       setAmount(numValue);
                                    }
                                 }
                              }}
                              placeholder="0.00"
                              className="block w-full p-4 py-2 border border-gray-300 rounded-md text-md font-semibold focus:ring-1 focus:ring-rose-200 focus:border-rose-500 outline-none transition-colors"
                           />
                        </div>
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                           {t('wallet.edit.quickAmount')}
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                           {quickAmounts.map((quickAmount) => (
                              <button
                                 type="button"
                                 key={quickAmount}
                                 onClick={() => setAmount(quickAmount)}
                                 className="cursor-pointer py-2 px-3 border border-gray-200 rounded-lg text-sm font-medium hover:border-rose-500 hover:text-rose-500 transition-colors"
                              >
                                 {formatCurrency(quickAmount)}
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-start justify-between sm:space-x-3 space-y-4 sm:space-y-0">
                     <div className="flex flex-col space-y-2 w-full sm:w-auto">
                        <p className="text-sm font-medium">{t('wallet.edit.paymentSlip')}</p>
                        {previewSlip ? (
                           <div className="space-y-2">
                              <img
                                 src={previewSlip}
                                 alt="New slip preview"
                                 className="mt-2 w-full sm:w-auto h-48 sm:h-28 object-contain rounded-md border border-green-500"
                              />
                              <p className="text-xs text-green-600">{t('wallet.edit.newFile')}: {selectedFile?.name}</p>
                           </div>
                        ) : transaction?.paymentSlip ? (
                           <img
                              src={transaction.paymentSlip}
                              alt="Existing slip"
                              className="mt-2 w-full sm:w-auto h-48 sm:h-28 object-contain rounded-md border"
                           />
                        ) : (
                           <p className="text-sm text-gray-500">{t('wallet.edit.noSlipUploaded')}</p>
                        )}
                     </div>
                     <div className="flex space-x-2">
                        {transaction?.paymentSlip && !previewSlip && (
                           <Button variant="outline" size="sm" onClick={handleDownloadSlip}>
                              <FileText className="h-3 w-3 mr-1" />
                              {t('wallet.edit.download')}
                           </Button>
                        )}
                        <Button type="button" variant="outline" size="sm" onClick={triggerFileSelect}>
                           <Upload className="h-3 w-3 mr-1" />
                           {t('wallet.edit.uploadNew')}
                        </Button>
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
                  <input className="hidden" name="originPaymentSlip" defaultValue={transaction.paymentSlip} />
               </div>
            </div>

            <div className="px-8">
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
               <Button
                  type="button"
                  variant="outline"
                  onClick={closeHandler}
                  className="bg-gray-500 text-white hover:bg-gray-600 hover:text-white"
               >
                  {t('wallet.edit.close')}
               </Button>
               <Button
                  type="submit"
                  variant="outline"
                  disabled={isSubmitting || !!uploadError}
                  className="flex gap-2 bg-rose-500 text-white hover:bg-rose-600 hover:text-white disabled:opacity-50"
               >
                  {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? t('wallet.edit.saving') : t('wallet.edit.saveChange')}
               </Button>
            </div>
         </Form>
      </Modal>
   )
}