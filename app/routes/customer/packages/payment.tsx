import React from "react";
import type { Route } from "./+types/package";
import { AlertCircle, CheckCircle, Loader, Wallet, ArrowRight, Check } from "lucide-react";
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation, type LoaderFunction } from "react-router";
import { useTranslation } from "react-i18next";

// components
import Modal from "~/components/ui/model";

// service and type:
import { formatCurrency } from "~/utils";
import { requireUserSession } from "~/services/auths.server";;
import { getPackage } from "~/services/package.server";
import { capitalize } from "~/utils/functions/textFormat";
import type { ISubscriptionPlanWithCurrentResponse } from "~/interfaces/packages";

interface LoaderData {
   plan: ISubscriptionPlanWithCurrentResponse;
   wallet: {
      id: string;
      totalBalance: number;
      totalRecharge: number;
      totalDeposit: number;
   } | null;
   currentSubscription: {
      planName: string;
      endDate: Date;
      remainingDays: number;
   } | null;
   remainingDays: number;
}

export const loader: LoaderFunction = async ({ params, request }) => {
   const packageId = await params.id;
   const customerId = await requireUserSession(request);
   const { getWalletByCustomerId } = await import("~/services/wallet.server");
   const { prisma } = await import("~/services/database.server");

   const plan = await getPackage(packageId!, customerId);

   // Get user's wallet balance
   let wallet = null;
   try {
      wallet = await getWalletByCustomerId(customerId);
   } catch (error) {
      console.error("Error fetching wallet:", error);
   }

   // Check for existing active subscription
   let currentSubscription = null;
   let remainingDays = 0;
   try {
      const existingSub = await prisma.subscription.findFirst({
         where: {
            customerId,
            status: "active",
            endDate: { gte: new Date() },
         },
         include: {
            plan: {
               select: {
                  name: true,
                  price: true,
                  durationDays: true,
               },
            },
         },
      });

      if (existingSub) {
         const now = new Date();
         const endDate = new Date(existingSub.endDate);
         const timeDiff = endDate.getTime() - now.getTime();
         remainingDays = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));

         currentSubscription = {
            planName: existingSub.plan.name,
            endDate: existingSub.endDate,
            remainingDays,
         };
      }
   } catch (error) {
      console.error("Error fetching current subscription:", error);
   }

   return { plan, wallet, currentSubscription, remainingDays };
}

export async function action({ request }: Route.ActionArgs) {
   const customerId = await requireUserSession(request);
   const formData = await request.formData();
   const planId = formData.get("planId") as string;

   if (request.method === "POST") {
      try {
         // Use wallet payment
         const { createSubscriptionWithWallet } = await import("~/services/package.server");
         const res = await createSubscriptionWithWallet(customerId, planId);
         if (res.id) {
            return redirect(`/customer/packages?toastMessage=Subscription+activated+successfully!&toastType=success`);
         }
      } catch (error: any) {
         console.error("Error creating subscription:", error);
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
            message: error?.message || error || "Failed to create subscription!",
         };
      }
   }
   return { success: false, error: true, message: "Invalid request method!" };
}

export default function SubscriptionPaymentPage() {
   const navigate = useNavigate();
   const navigation = useNavigation();
   const actionData = useActionData<typeof action>();
   const { plan, wallet, currentSubscription, remainingDays } = useLoaderData<LoaderData>();
   const { t } = useTranslation();

   const [showConfirmation, setShowConfirmation] = React.useState<boolean>(false);

   const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "POST";

   const hasInsufficientBalance = wallet && wallet.totalBalance < plan.price;
   const hasSufficientBalance = wallet && wallet.totalBalance >= plan.price;
   const isUpgrade = currentSubscription !== null;
   const totalDays = plan.durationDays + remainingDays;

   function closeHandler() {
      navigate("/customer/packages");
   }

   function handleTopUpRedirect() {
      // Calculate deficit amount (package price - current balance)
      const deficit = Math.max(plan.price - wallet.totalBalance, 10000);
      navigate(`/customer/wallet-topup?amount=${deficit}`);
   }

   function handleConfirmPayment() {
      setShowConfirmation(true);
   }

   return (
      <Modal onClose={closeHandler} className="container w-full sm:w-1/2 h-screen sm:h-auto space-y-4 py-8 px-6 border">
         {!showConfirmation ? (
            <>
               <div className="space-y-4">
                  <h1 className="text-md text-gray-900">{t('packages.payment.title')}</h1>
                  {isUpgrade && (
                     <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-2">
                        <h2 className="text-sm font-semibold text-orange-700 flex items-center space-x-2">
                           <AlertCircle className="h-4 w-4" />
                           <span>{t('packages.payment.upgradeTitle')}</span>
                        </h2>
                        <div className="text-sm text-orange-600 space-y-1">
                           <p>{t('packages.payment.currentPlan')}: <span className="font-medium text-black">{currentSubscription?.planName}</span></p>
                           <p>{t('packages.payment.remainingDays')}: <span className="font-medium text-black">{remainingDays} days</span></p>
                           <p className="text-xs pt-1">
                              {t('packages.payment.upgradeNote', { days: remainingDays, plural: remainingDays !== 1 ? 's' : '' })}
                           </p>
                        </div>
                     </div>
                  )}

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                     <h2 className="text-sm text-gray-700">{t('packages.payment.newPackageDetails')}</h2>
                     <div className="text-sm text-gray-600 space-y-1">
                        <p>{t('packages.payment.name')}: <span className="text-black font-medium">{plan.name}</span></p>
                        <p>{t('packages.payment.price')}: <span className="text-black font-medium">{formatCurrency(plan.price)}</span></p>
                        <p>{t('packages.payment.baseDuration')}: <span className="text-black font-medium">{plan.durationDays} {t('packages.payment.days')}</span></p>
                        {isUpgrade && (
                           <>
                              <p>{t('packages.payment.carriedOver')}: <span className="text-black font-medium">{remainingDays} {t('packages.payment.days')}</span></p>
                              <p className="pt-2 border-t">{t('packages.payment.totalDuration')}: <span className="text-black font-bold text-base">{totalDays} {t('packages.payment.days')}</span></p>
                           </>
                        )}
                     </div>
                  </div>

                  <div className={`border rounded-lg p-4 space-y-2 ${hasInsufficientBalance ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                     }`}>
                     <div className="flex items-center space-x-2">
                        <Wallet className={`h-5 w-5 ${hasInsufficientBalance ? 'text-red-500' : 'text-green-500'}`} />
                        <h2 className="text-sm font-semibold text-gray-700">{t('packages.payment.walletBalance')}</h2>
                     </div>
                     <div className="text-xl font-bold">
                        {wallet ? formatCurrency(wallet.totalBalance) : 'N/A'}
                     </div>
                     {hasInsufficientBalance && (
                        <p className="text-sm text-red-600">
                           {t('packages.payment.insufficientBalance', { amount: formatCurrency(plan.price - wallet.totalBalance) })}
                        </p>
                     )}
                     {hasSufficientBalance && (
                        <p className="text-sm text-green-600">
                           {t('packages.payment.sufficientBalance')}
                        </p>
                     )}
                  </div>

                  {actionData?.error && (
                     <div className="p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span className="text-red-500 text-sm">
                           {capitalize(actionData.message)}
                        </span>
                     </div>
                  )}

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                     <p className="text-sm text-blue-700">
                        {t('packages.payment.paymentMethodNote')}
                     </p>
                  </div>
               </div>

               <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                  <button
                     type="button"
                     onClick={closeHandler}
                     disabled={isSubmitting}
                     className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                     {t('packages.payment.cancel')}
                  </button>

                  {hasInsufficientBalance ? (
                     <button
                        type="button"
                        onClick={handleTopUpRedirect}
                        className="text-sm cursor-pointer flex items-center space-x-2 px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                     >
                        <Wallet className="h-4 w-4" />
                        <span>{t('packages.payment.topUpWallet')}</span>
                        <ArrowRight className="h-4 w-4" />
                     </button>
                  ) : (
                     <button
                        type="button"
                        onClick={handleConfirmPayment}
                        disabled={!wallet || isSubmitting}
                        className="text-sm cursor-pointer flex items-center space-x-2 px-6 py-2 bg-rose-500 text-white rounded-md hover:bg-rose-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                     >
                        <span>{t('packages.payment.proceedToPayment')}</span>
                     </button>
                  )}
               </div>
            </>
         ) : (
            <Form method="post" className="space-y-4">
               <div className="text-center space-y-4">
                  <div className="w-12 h-12 bg-rose-500 rounded-full flex items-center justify-center mx-auto">
                     <Check className="h-6 w-6 text-white" />
                  </div>

                  <h2 className="text-lg text-gray-900">{t('packages.payment.confirmPayment')}</h2>

                  <div className="text-left bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                     {isUpgrade ? (
                        <>
                           <p className="text-sm text-gray-600">
                              {t('packages.payment.upgradeMessage', { planName: plan.name })}
                           </p>
                           <p className="text-sm text-gray-600">
                              {t('packages.payment.currentPlanInfo', { planName: currentSubscription?.planName, days: remainingDays })}
                           </p>
                           <div className="border-t pt-2 mt-2">
                              <p className="text-sm text-gray-600">
                                 {t('packages.payment.newPlanDuration', { days: plan.durationDays })}
                              </p>
                              <p className="text-sm text-gray-600">
                                 Carried over: <span className="font-semibold text-black">+ {remainingDays} {t('packages.payment.days')}</span>
                              </p>
                              <p className="text-sm text-gray-600 font-semibold">
                                 Total duration: <span className="text-black text-base">{totalDays} {t('packages.payment.days')}</span>
                              </p>
                           </div>
                        </>
                     ) : (
                        <p className="text-sm text-gray-600">
                           {t('packages.payment.subscribeMessage', { planName: plan.name })}
                        </p>
                     )}
                     <div className="border-t pt-2 mt-2 space-y-2">
                        <p className="text-sm text-gray-600">
                           {t('packages.payment.amountDeducted')}: <span className="font-semibold text-black">{formatCurrency(plan.price)}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                           {t('packages.payment.currentBalance')}: <span className="font-semibold text-black">{wallet && formatCurrency(wallet.totalBalance)}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                           {t('packages.payment.balanceAfter')}: <span className="font-semibold text-black">{wallet && formatCurrency(wallet.totalBalance - plan.price)}</span>
                        </p>
                     </div>
                  </div>

                  <p className="text-sm text-gray-600">
                     {t('packages.payment.confirmQuestion')}
                  </p>
               </div>

               <input type="hidden" name="planId" value={plan.id} />

               {actionData?.error && (
                  <div className="p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2">
                     <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                     <span className="text-red-500 text-sm">
                        {capitalize(actionData.message)}
                     </span>
                  </div>
               )}

               <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                  <button
                     type="button"
                     onClick={() => setShowConfirmation(false)}
                     disabled={isSubmitting}
                     className="text-sm cursor-pointer px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                     {t('packages.payment.back')}
                  </button>

                  <button
                     type="submit"
                     disabled={isSubmitting}
                     className="text-sm cursor-pointer flex items-center space-x-2 px-6 py-2 bg-rose-500 text-white rounded-md hover:bg-rose-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                     {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
                     {!isSubmitting && <CheckCircle className="h-4 w-4" />}
                     <span>{isSubmitting ? t('packages.payment.processing') : t('packages.payment.confirmPayment')}</span>
                  </button>
               </div>
            </Form>
         )}
      </Modal>
   );
}