"use client"

import { useState } from "react"
import { format } from "date-fns"
import { useTranslation } from 'react-i18next';
import { AlertCircle, CalendarIcon, Loader, X, Wallet, Phone, Video, Clock } from "lucide-react"
import { Form, Link, redirect, useActionData, useLoaderData, useNavigate, useNavigation, useParams, type LoaderFunctionArgs } from "react-router"

// components:
import Modal from "~/components/ui/model"
import { Button } from "~/components/ui/button"
import { Calendar } from "~/components/ui/calendar"
import { Label } from "~/components/ui/label"
import { Input } from "~/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"

// utils:
import { cn } from "~/lib/utils"
import type { Route } from "./+types/profile.call"
import { getModelService } from "~/services/model.server";
import { requireUserSession } from "~/services/auths.server";
import { formatCurrency } from "~/utils"
import { prisma } from "~/services/database.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
   const customerId = await requireUserSession(request);
   const service = await getModelService(params.modelId!, params.serviceId!);

   // Get customer wallet balance
   const wallet = await prisma.wallet.findFirst({
      where: { customerId, status: "active" },
   });

   return { service, walletBalance: wallet?.totalBalance || 0 };
}

export async function action({ params, request }: Route.ActionArgs) {
   const { createCallBooking } = await import("~/services/call-booking.server")
   const modelServiceId = params.serviceId
   const customerId = await requireUserSession(request)

   const formData = await request.formData()
   const callType = formData.get('callType') as 'audio' | 'video'
   const callTiming = formData.get('callTiming') as 'immediate' | 'scheduled'
   const scheduledTime = formData.get('scheduledTime') as string | null

   try {
      const result = await createCallBooking({
         customerId,
         modelServiceId: modelServiceId!,
         callType,
         scheduledTime: callTiming === 'scheduled' && scheduledTime ? new Date(scheduledTime) : null,
      });

      if (result.success && result.booking) {
         // Redirect to waiting/call page
         if (callTiming === 'immediate') {
            return redirect(`/customer/call/${result.booking.id}/waiting`);
         } else {
            return redirect(`/customer/dates-history?toastMessage=${encodeURIComponent("callService.success.scheduled")}&toastType=success`);
         }
      }

      return result;
   } catch (error: any) {
      if (error?.payload) {
         return error.payload;
      }

      return {
         success: false,
         error: true,
         message: error.message || "callService.errors.bookingFailed",
      };
   }
}

export default function CallServiceBooking() {
   const navigate = useNavigate()
   const navigation = useNavigation()
   const params = useParams()
   const { t } = useTranslation();
   const [callType, setCallType] = useState<'audio' | 'video'>('video')
   const [callTiming, setCallTiming] = useState<'immediate' | 'scheduled'>('immediate')
   const [scheduledDate, setScheduledDate] = useState<Date>()

   const actionData = useActionData<typeof action>()
   const loaderData = useLoaderData<typeof loader>();
   const service = loaderData.service;
   const walletBalance = loaderData.walletBalance;
   const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "POST";

   // Get minute rate
   const minuteRate = service.customMinuteRate || service.service.minuteRate || 0;

   // Calculate max minutes based on wallet balance
   const maxMinutes = minuteRate > 0 ? Math.floor(walletBalance / minuteRate) : 0;

   function closeHandler() {
      navigate(`/customer/user-profile/${params.modelId}`);
   }

   // Helper function to check if a date can be selected
   const isDateDisabled = (date: Date): boolean => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dateToCheck = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      if (dateToCheck < today) return true;
      if (dateToCheck > today) return false;

      const oneHourFromNow = new Date(now.getTime() + 1 * 60 * 60 * 1000);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      return oneHourFromNow > endOfDay;
   };

   return (
      <Modal onClose={closeHandler} className="h-screen sm:h-auto w-full sm:w-96 py-8 sm:py-4 px-4 border rounded-xl">
         <div className="space-y-4 sm:space-y-6">
            <div className="space-y-2 mt-10 sm:mt-0">
               <div className="text-lg font-bold text-balance flex items-center gap-2">
                  <Phone className="w-5 h-5 text-rose-500" />
                  {t('callService.title', { defaultValue: 'Call Service' })}
               </div>
               <div className="text-sm text-muted-foreground">
                  {t('callService.description', { defaultValue: 'Voice or video call with per-minute billing' })}
               </div>
            </div>

            {/* Rate Info */}
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
               <div className="flex items-center justify-between text-sm">
                  <span className="text-rose-700 font-medium">{t('callService.ratePerMinute', { defaultValue: 'Rate per minute' })}</span>
                  <span className="text-rose-800 font-bold">{formatCurrency(minuteRate)}</span>
               </div>
               <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-rose-700">{t('callService.yourBalance', { defaultValue: 'Your balance' })}</span>
                  <span className="text-rose-800">{formatCurrency(walletBalance)}</span>
               </div>
               <div className="flex items-center justify-between text-sm mt-1 pt-2 border-t border-rose-200">
                  <span className="text-rose-700">{t('callService.maxCallTime', { defaultValue: 'Max call time' })}</span>
                  <span className="text-rose-800 font-medium">{maxMinutes} {t('callService.minutes', { defaultValue: 'minutes' })}</span>
               </div>
            </div>

            <Form method="post" className="space-y-4">
               <input type="hidden" name="callType" value={callType} />
               <input type="hidden" name="callTiming" value={callTiming} />
               {scheduledDate && (
                  <input type="hidden" name="scheduledTime" value={scheduledDate.toISOString()} />
               )}

               {/* Call Type Selection */}
               <div className="space-y-2">
                  <Label className="text-sm font-medium">
                     {t('callService.callType', { defaultValue: 'Call Type' })} <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                     <button
                        type="button"
                        onClick={() => setCallType('audio')}
                        className={cn(
                           "flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all",
                           callType === 'audio'
                              ? "border-rose-500 bg-rose-50 text-rose-700"
                              : "border-gray-200 hover:border-gray-300"
                        )}
                     >
                        <Phone className="w-6 h-6 mb-2" />
                        <span className="text-sm font-medium">{t('callService.audioCall', { defaultValue: 'Audio Call' })}</span>
                     </button>
                     <button
                        type="button"
                        onClick={() => setCallType('video')}
                        className={cn(
                           "flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all",
                           callType === 'video'
                              ? "border-rose-500 bg-rose-50 text-rose-700"
                              : "border-gray-200 hover:border-gray-300"
                        )}
                     >
                        <Video className="w-6 h-6 mb-2" />
                        <span className="text-sm font-medium">{t('callService.videoCall', { defaultValue: 'Video Call' })}</span>
                     </button>
                  </div>
               </div>

               {/* Call Timing Selection */}
               <div className="space-y-2">
                  <Label className="text-sm font-medium">
                     {t('callService.callTiming', { defaultValue: 'When to call' })} <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                     <button
                        type="button"
                        onClick={() => setCallTiming('immediate')}
                        className={cn(
                           "flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all",
                           callTiming === 'immediate'
                              ? "border-rose-500 bg-rose-50 text-rose-700"
                              : "border-gray-200 hover:border-gray-300"
                        )}
                     >
                        <Phone className="w-5 h-5 mb-1" />
                        <span className="text-sm font-medium">{t('callService.callNow', { defaultValue: 'Call Now' })}</span>
                     </button>
                     <button
                        type="button"
                        onClick={() => setCallTiming('scheduled')}
                        className={cn(
                           "flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all",
                           callTiming === 'scheduled'
                              ? "border-rose-500 bg-rose-50 text-rose-700"
                              : "border-gray-200 hover:border-gray-300"
                        )}
                     >
                        <Clock className="w-5 h-5 mb-1" />
                        <span className="text-sm font-medium">{t('callService.scheduleLater', { defaultValue: 'Schedule' })}</span>
                     </button>
                  </div>
               </div>

               {/* Scheduled Time Picker (only show when scheduled) */}
               {callTiming === 'scheduled' && (
                  <div className="space-y-2">
                     <Label className="text-sm font-medium">
                        {t('callService.scheduledTime', { defaultValue: 'Scheduled Time' })} <span className="text-destructive">*</span>
                     </Label>
                     <Popover>
                        <PopoverTrigger asChild>
                           <Button
                              variant="outline"
                              className={cn(
                                 "w-full justify-start text-left font-normal h-11",
                                 !scheduledDate && "text-muted-foreground",
                              )}
                           >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {scheduledDate ? format(scheduledDate, "PPP p") : t('callService.pickDateTime', { defaultValue: 'Pick date & time' })}
                           </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 space-y-3" align="start">
                           <Calendar
                              mode="single"
                              selected={scheduledDate}
                              onSelect={setScheduledDate}
                              disabled={isDateDisabled}
                              initialFocus
                           />
                           <div className="p-2 space-y-1">
                              <Label className="text-sm font-medium text-gray-700">
                                 {t('callService.selectTime', { defaultValue: 'Select Time' })}
                              </Label>
                              <Input
                                 required
                                 type="time"
                                 className="w-full"
                                 onChange={(e) => {
                                    if (!scheduledDate) return;
                                    const [hours, minutes] = e.target.value.split(":").map(Number);
                                    const newDate = new Date(scheduledDate);
                                    newDate.setHours(hours);
                                    newDate.setMinutes(minutes);
                                    setScheduledDate(newDate);
                                 }}
                              />
                           </div>
                        </PopoverContent>
                     </Popover>
                  </div>
               )}

               {/* Insufficient Balance Warning */}
               {maxMinutes < 1 && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-3">
                     <div className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span className="text-amber-700 text-sm">
                           {t('callService.insufficientBalance', { defaultValue: 'You need at least 1 minute worth of balance to make a call.' })}
                        </span>
                     </div>
                     <Link
                        to="/customer/wallet-topup"
                        className="inline-flex items-center justify-center gap-2 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-md transition-colors text-sm font-medium w-full"
                     >
                        <Wallet className="w-4 h-4" />
                        {t('callService.topupNow', { defaultValue: 'Top up now' })}
                     </Link>
                  </div>
               )}

               {/* Error Display */}
               {actionData?.error && (
                  <div className="p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2">
                     <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                     <span className="text-red-500 text-sm">
                        {t(actionData.message, { defaultValue: actionData.message })}
                     </span>
                  </div>
               )}

               {/* Action Buttons */}
               <div className="flex justify-end space-x-2 pt-4">
                  <Button
                     type="button"
                     variant="outline"
                     onClick={closeHandler}
                     className="text-gray-500 border border-gray-300"
                  >
                     <X className="w-4 h-4 mr-1" />
                     {t('common.cancel', { defaultValue: 'Cancel' })}
                  </Button>
                  <Button
                     type="submit"
                     disabled={isSubmitting || maxMinutes < 1}
                     className="flex gap-2 bg-rose-500 text-white hover:bg-rose-600"
                  >
                     {isSubmitting ? (
                        <Loader className="w-4 h-4 animate-spin" />
                     ) : callType === 'video' ? (
                        <Video className="w-4 h-4" />
                     ) : (
                        <Phone className="w-4 h-4" />
                     )}
                     {callTiming === 'immediate'
                        ? t('callService.startCall', { defaultValue: 'Start Call' })
                        : t('callService.scheduleCall', { defaultValue: 'Schedule Call' })}
                  </Button>
               </div>
            </Form>
         </div>
      </Modal>
   )
}
