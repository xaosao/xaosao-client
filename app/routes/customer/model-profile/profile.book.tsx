"use client"

import { useState } from "react"
import { format } from "date-fns"
import { AlertCircle, Calendar1, CalendarIcon, Loader, X, Wallet } from "lucide-react"
import { Form, Link, redirect, useActionData, useLoaderData, useNavigate, useNavigation, useParams, type LoaderFunctionArgs } from "react-router"
import { useTranslation } from 'react-i18next';

// components:
import Modal from "~/components/ui/model"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Button } from "~/components/ui/button"
import { Textarea } from "~/components/ui/textarea"
import { Calendar } from "~/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"

// utils:
import { cn } from "~/lib/utils"
import type { Route } from "./+types/profile.book"
import { capitalize } from "~/utils/functions/textFormat"
import { getModelService } from "~/services/model.server";
import { requireUserSession } from "~/services/auths.server";
import { validateServiceBookingInputs } from "~/services/validation.server";
import { calculateDayAmount, formatCurrency, parseFormattedNumber } from "~/utils"
import type { IServiceBookingCredentials, IServiceBookingResponse } from "~/interfaces/service"

export async function loader({ params }: LoaderFunctionArgs) {
   const service = await getModelService(params.modelId!, params.serviceId!);

   return service;
}

export async function action({ params, request }: Route.ActionArgs) {
   const { createServiceBooking } = await import("~/services/booking.server")
   const modelId = params.modelId
   const modelServiceId = params.serviceId
   const customerId = await requireUserSession(request)

   const formData = await request.formData()
   const bookingData = Object.fromEntries(formData) as Partial<IServiceBookingCredentials>
   const dayAmount = calculateDayAmount(String(bookingData?.startDate), String(bookingData?.endDate))

   try {
      bookingData.price = parseFormattedNumber(bookingData.price)
      bookingData.dayAmount = parseFormattedNumber(dayAmount)

      await validateServiceBookingInputs(bookingData as IServiceBookingCredentials);
      const res = await createServiceBooking(customerId, modelId, modelServiceId, bookingData as IServiceBookingCredentials);
      if (res.id) {
         return redirect(`/customer/dates-history?toastMessage=Book+service+successfully!&toastType=success`);
      }
   } catch (error: any) {
      if (error?.payload) {
         return error.payload;
      }

      if (error && typeof error === "object" && !Array.isArray(error)) {
         const keys = Object.keys(error)
         if (keys.length > 0) {
            const firstKey = keys[0]
            const firstMessage = (error as Record<string, any>)[firstKey]

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

export default function ServiceBooking() {
   const navigate = useNavigate()
   const navigation = useNavigation()
   const params = useParams()
   const { t } = useTranslation();
   const [startDate, setStartDate] = useState<Date>()
   const [endDate, setEndDate] = useState<Date>()

   const actionData = useActionData<typeof action>()
   const service = useLoaderData<IServiceBookingResponse>();
   const isSubmitting =
      navigation.state !== "idle" && navigation.formMethod === "POST";

   function closeHandler() {
      navigate(`/customer/user-profile/${params.modelId}`);
   }

   // Helper function to get translated service name
   const getServiceName = (serviceName: string): string => {
      if (!serviceName) return t("booking.serviceUnavailable");
      return t(`modelServices.serviceItems.${serviceName}.name`, { defaultValue: serviceName });
   };

   // Helper function to get translated service description
   const getServiceDescription = (nameKey: string, fallbackDescription: string | null): string => {
      const translatedDesc = t(`modelServices.serviceItems.${nameKey}.description`);
      if (translatedDesc.includes('modelServices.serviceItems')) {
         return fallbackDescription || t("modelServices.noDescription");
      }
      return translatedDesc;
   };

   // Helper function to check if a date can be selected (allows today if 1+ hour from now)
   const isDateDisabled = (date: Date): boolean => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dateToCheck = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      // Past dates are always disabled
      if (dateToCheck < today) return true;

      // Future dates are always allowed
      if (dateToCheck > today) return false;

      // For today: allow if there's at least 1 hour remaining in the day
      // (time validation will be done when user selects the time)
      const oneHourFromNow = new Date(now.getTime() + 1 * 60 * 60 * 1000);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      // Disable today only if less than 1 hour left in the day
      return oneHourFromNow > endOfDay;
   };

   return (
      <Modal onClose={closeHandler} className="h-screen sm:h-auto w-full sm:w-3/6 py-8 sm:py-4 px-4 border rounded-xl">
         <div className="space-y-3 sm:space-y-6">
            <div className="space-y-2 mt-10 sm:mt-0">
               <div className="text-md font-bold text-balance">{getServiceName(service.service.name)}</div>
               <div className="text-sm leading-relaxed">
                  {getServiceDescription(service.service.name, service.service.description)}
               </div>
            </div>

            <Form method="post" className="space-y-4">
               <div className="space-y-6">
                  <div>
                     <div className="grid gap-3 sm:gap-6 md:grid-cols-2">
                        <input
                           type="hidden"
                           name="price"
                           value={service.customRate ? service.customRate : service.service.baseRate}
                        />
                        <div className="space-y-2">
                           <Label htmlFor="start-date" className="text-sm font-medium">
                              {t('profileBook.startDate')} <span className="text-destructive">*</span>
                           </Label>
                           <Popover>
                              <PopoverTrigger asChild>
                                 <Button
                                    id="start-date"
                                    variant="outline"
                                    className={cn(
                                       "w-full justify-start text-left font-normal h-11",
                                       !startDate && "text-muted-foreground",
                                    )}
                                 >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {startDate ? format(startDate, "PPP p") : t('profileBook.pickDateTime')}
                                 </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 space-y-3" align="start">
                                 <Calendar
                                    mode="single"
                                    selected={startDate}
                                    onSelect={setStartDate}
                                    disabled={isDateDisabled}
                                    initialFocus
                                 />
                                 <div className="p-2">
                                    <Input
                                       required
                                       type="time"
                                       name="startDate"
                                       className="w-full"
                                       placeholder="Dates"
                                       onChange={(e) => {
                                          if (!startDate) return;
                                          const [hours, minutes] = e.target.value.split(":").map(Number);
                                          const newDate = new Date(startDate);
                                          newDate.setHours(hours);
                                          newDate.setMinutes(minutes);

                                          // Check if the selected datetime is at least 1 hour from now
                                          const now = new Date();
                                          const oneHourFromNow = new Date(now.getTime() + 1 * 60 * 60 * 1000);

                                          if (newDate < oneHourFromNow) {
                                             // Set to 1 hour from now if selected time is too soon
                                             const minAllowedTime = new Date(oneHourFromNow);
                                             minAllowedTime.setSeconds(0);
                                             minAllowedTime.setMilliseconds(0);
                                             setStartDate(minAllowedTime);
                                          } else {
                                             setStartDate(newDate);
                                          }
                                       }}
                                    />
                                    {startDate && (() => {
                                       const now = new Date();
                                       const oneHourFromNow = new Date(now.getTime() + 1 * 60 * 60 * 1000);
                                       const isToday = startDate.toDateString() === now.toDateString();
                                       if (isToday) {
                                          const minHour = oneHourFromNow.getHours().toString().padStart(2, '0');
                                          const minMinute = oneHourFromNow.getMinutes().toString().padStart(2, '0');
                                          return (
                                             <p className="text-xs text-amber-600 mt-1">
                                                {t('profileBook.minTimeToday', { time: `${minHour}:${minMinute}`, defaultValue: `Minimum time for today: ${minHour}:${minMinute}` })}
                                             </p>
                                          );
                                       }
                                       return null;
                                    })()}
                                 </div>
                              </PopoverContent>
                           </Popover>

                           {startDate && (
                              <input
                                 placeholder="Date"
                                 type="hidden"
                                 name="startDate"
                                 value={startDate.toISOString()}
                              />
                           )}
                        </div>

                        <div className="space-y-2">
                           <Label htmlFor="end-date" className="text-sm font-medium">
                              {t('profileBook.endDate')}
                           </Label>
                           <Popover>
                              <PopoverTrigger asChild>
                                 <Button
                                    id="end-date"
                                    variant="outline"
                                    className={cn(
                                       "w-full justify-start text-left font-normal h-11",
                                       !endDate && "text-muted-foreground",
                                    )}
                                 >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {endDate ? format(endDate, "PPP p") : t('profileBook.pickDateTime')}
                                 </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 space-y-3" align="start">
                                 <Calendar
                                    mode="single"
                                    selected={endDate}
                                    onSelect={setEndDate}
                                    disabled={(date) => {
                                       if (!startDate) return isDateDisabled(date);
                                       return date < startDate;
                                    }}
                                    initialFocus
                                 />
                                 <div className="p-2">
                                    <Input
                                       type="time"
                                       name="endDate"
                                       className="w-full"
                                       onChange={(e) => {
                                          if (!endDate) return;
                                          const [hours, minutes] = e.target.value.split(":").map(Number);
                                          const newDate = new Date(endDate);
                                          newDate.setHours(hours);
                                          newDate.setMinutes(minutes);
                                          setEndDate(newDate);
                                       }}
                                    />
                                 </div>
                              </PopoverContent>
                           </Popover>
                           {endDate && (
                              <input
                                 type="hidden"
                                 name="endDate"
                                 value={endDate.toISOString()}
                              />
                           )}
                        </div>

                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="space-y-2">
                     <Label htmlFor="meeting-location" className="text-sm font-medium">
                        {t('profileBook.location')} <span className="text-destructive">*</span>
                     </Label>
                     <Input
                        name="location"
                        id="meeting-location"
                        placeholder={t('profileBook.locationPlaceholder')}
                        className="h-11 text-sm"
                     />
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="space-y-2">
                     <Label htmlFor="dress-code" className="text-sm font-medium">
                        {t('profileBook.preferredAttire')}
                     </Label>
                     <Textarea
                        name="preferred"
                        id="dress-code"
                        placeholder={t('profileBook.attirePlaceholder')}
                        className="min-h-[100px] resize-none text-sm"
                     />
                  </div>
               </div>

               <div className="space-y-2 ">
                  <h3 className="text-sm font-bold">{t('profileBook.summary')}</h3>

                  <div className="space-y-3 bg-secondary/30 p-2 rounded-lg">
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t('profileBook.pricePerDay')}</span>
                        <span className="font-medium">{formatCurrency(service.customRate ? service.customRate : service.service.baseRate)}</span>
                     </div>

                     <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t('profileBook.numberOfDays')}</span>
                        <span className="font-medium">{calculateDayAmount(String(startDate), endDate ? String(endDate) : "")} {t('profileBook.days')}</span>
                     </div>

                     <div className="border-t pt-3 mt-3">
                        <div className="flex justify-between items-center">
                           <span className="text-sm font-bold">{t('profileBook.totalPrice')}</span>
                           <span className="text-md font-bold text-primary">
                              {
                                 formatCurrency((service.customRate ? service.customRate : service.service.baseRate)
                                    *
                                    calculateDayAmount(String(startDate), endDate ? String(endDate) : ""))
                              }
                           </span>
                        </div>
                     </div>
                  </div>
               </div>

               <div>
                  {actionData?.error && (
                     <div className="mb-4 space-y-3">
                        <div className="p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                           <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                           <span className="text-red-500 text-sm">
                              {actionData.message?.toLowerCase().includes('insufficient balance') ? (() => {
                                 // Parse the amounts from the error message
                                 const match = actionData.message.match(/need\s+([\d,]+)\s+LAK\s+but\s+have\s+([\d,]+)\s+LAK/i);
                                 if (match) {
                                    return t('profileBook.insufficientBalance', {
                                       required: match[1],
                                       current: match[2]
                                    });
                                 }
                                 return t('profileBook.insufficientBalanceGeneric');
                              })() : capitalize(actionData.message)}
                           </span>
                        </div>

                        {/* Show recharge button if insufficient balance */}
                        {actionData.message?.toLowerCase().includes('insufficient balance') && (
                           <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-3">
                              <div className="flex items-start space-x-2">
                                 <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                 <span className="text-amber-700 text-sm">
                                    {t('profileBook.rechargeWarning')}
                                 </span>
                              </div>
                              <Link
                                 to="/customer/wallet-topup"
                                 className="inline-flex items-center justify-center gap-2 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-md transition-colors text-sm font-medium"
                              >
                                 <Wallet className="w-4 h-4" />
                                 {t('profileBook.rechargeNow')}
                              </Link>
                           </div>
                        )}
                     </div>
                  )}
               </div>

               <div className="flex justify-end space-x-2 pt-4">
                  <Button
                     type="button"
                     variant="outline"
                     onClick={closeHandler}
                     className="text-gray-500 border border-gray-300"
                  >
                     <X />
                     {t('profileBook.close')}
                  </Button>
                  <Button
                     type="submit"
                     variant="outline"
                     className="flex gap-2 bg-rose-500 text-white hover:bg-rose-600 hover:text-white"
                  >
                     {isSubmitting ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Calendar1 />}
                     {isSubmitting ? t('profileBook.booking') : t('profileBook.bookNow')}
                  </Button>
               </div>
            </Form>
         </div>
      </Modal>
   )
}
