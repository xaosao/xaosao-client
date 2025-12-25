"use client"

import { useState } from "react"
import { format } from "date-fns"
import { useTranslation } from "react-i18next"
import { AlertCircle, Calendar1, CalendarIcon, Loader, Clock, Moon } from "lucide-react"
import { Form, redirect, useActionData, useNavigate, useNavigation, type LoaderFunction } from "react-router"

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
import type { Route } from "./+types/booking.edit"
import { capitalize } from "~/utils/functions/textFormat"
import { calculateDayAmount, formatCurrency, parseFormattedNumber } from "~/utils"
import { getAllMyServiceBooking, updateServiceBooking } from "~/services/booking.server"
import { requireUserSession } from "~/services/auths.server";
import { getModelService } from "~/services/model.server";
import { validateServiceBookingInputs } from "~/services/validation.server";
import type { IServiceBookingCredentials, IServiceBookingResponse, ISingleServiceBooking, SessionType, BillingType } from "~/interfaces/service"

interface LoaderReturn {
   service: IServiceBookingResponse;
   dateBooking: ISingleServiceBooking;
}

interface TransactionProps {
   loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ params }) => {
   const dateBooking = await getAllMyServiceBooking(params.id!)
   const service = await getModelService(dateBooking?.modelId!, dateBooking?.modelServiceId!)

   return { dateBooking, service };
}

export async function action({ params, request }: Route.ActionArgs) {
   const id = params.id
   const customerId = await requireUserSession(request)

   const formData = await request.formData()
   const bookingData = Object.fromEntries(formData) as Partial<IServiceBookingCredentials>
   const billingType = formData.get("billingType") as BillingType;

   // Calculate day amount only for per_day billing
   const dayAmount = billingType === 'per_day'
      ? (bookingData.endDate
         ? calculateDayAmount(String(bookingData.startDate), String(bookingData.endDate))
         : calculateDayAmount(String(bookingData.startDate), ""))
      : undefined;

   try {
      bookingData.price = parseFormattedNumber(bookingData.price)

      // Set appropriate fields based on billing type
      if (billingType === 'per_day') {
         bookingData.dayAmount = parseFormattedNumber(dayAmount)
         bookingData.hours = undefined;
         bookingData.sessionType = undefined;
      } else if (billingType === 'per_hour') {
         bookingData.hours = parseFormattedNumber(bookingData.hours);
         bookingData.dayAmount = undefined;
         bookingData.sessionType = undefined;
      } else if (billingType === 'per_session') {
         bookingData.sessionType = formData.get("sessionType") as SessionType;
         bookingData.hours = undefined;
         bookingData.dayAmount = undefined;
      }

      await validateServiceBookingInputs(bookingData as IServiceBookingCredentials);
      const res = await updateServiceBooking(id, customerId, bookingData as IServiceBookingCredentials);
      if (res.id) {
         return redirect(`/customer/dates-history?toastMessage=Date+booking+is+update+successfully!&toastType=success`);
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

export default function EditServiceBooking({ loaderData }: TransactionProps) {
   const { t } = useTranslation()
   const navigate = useNavigate()
   const navigation = useNavigation()

   const actionData = useActionData<typeof action>()
   const { dateBooking, service } = loaderData;

   const billingType = service?.service?.billingType || 'per_day';

   const getServiceName = (): string => {
      const serviceName = service?.service?.name;
      if (!serviceName) return t("booking.serviceUnavailable");
      return t(`modelServices.serviceItems.${serviceName}.name`, { defaultValue: serviceName });
   };

   const getServiceDescription = (): string => {
      const serviceName = service?.service?.name;
      if (!serviceName) return "";
      return t(`modelServices.serviceItems.${serviceName}.description`, { defaultValue: service?.service?.description || "" });
   };

   const [startDate, setStartDate] = useState<Date | undefined>(
      dateBooking?.startDate ? new Date(dateBooking.startDate) : undefined
   );

   const [endDate, setEndDate] = useState<Date | undefined>(
      dateBooking?.endDate ? new Date(dateBooking.endDate) : undefined
   );

   // State for per_hour services
   const [hours, setHours] = useState<number>(dateBooking?.hours || 2);

   // State for per_session services
   const [sessionType, setSessionType] = useState<SessionType>(
      dateBooking?.sessionType || 'one_time'
   );

   const isSubmitting =
      navigation.state !== "idle" && navigation.formMethod === "POST";

   // Get the appropriate rate based on billing type
   const getRate = (): number => {
      if (billingType === 'per_hour') {
         return service.customHourlyRate || service.service.hourlyRate || service.customRate || service.service.baseRate;
      } else if (billingType === 'per_session') {
         if (sessionType === 'one_time') {
            return service.customOneTimePrice || service.service.oneTimePrice || service.customRate || service.service.baseRate;
         } else {
            return service.customOneNightPrice || service.service.oneNightPrice || service.customRate || service.service.baseRate;
         }
      }
      return service.customRate || service.service.baseRate;
   };

   // Calculate total price based on billing type
   const calculateTotalPrice = (): number => {
      const rate = getRate();
      if (billingType === 'per_hour') {
         return rate * hours;
      } else if (billingType === 'per_session') {
         return rate; // Session price is fixed
      }
      // per_day billing
      const days = calculateDayAmount(String(startDate), endDate ? String(endDate) : "");
      return rate * days;
   };

   // Get rate label based on billing type
   const getRateLabel = (): string => {
      if (billingType === 'per_hour') {
         return t('booking.edit.summary.pricePerHour');
      } else if (billingType === 'per_session') {
         return sessionType === 'one_time'
            ? t('profileBook.oneTimePrice')
            : t('profileBook.oneNightPrice');
      }
      return t('booking.edit.summary.pricePerDay');
   };

   // Get quantity label based on billing type
   const getQuantityLabel = (): string => {
      if (billingType === 'per_hour') {
         return t('booking.edit.summary.numberOfHours');
      } else if (billingType === 'per_session') {
         return t('booking.edit.summary.sessionType');
      }
      return t('booking.edit.summary.numberOfDays');
   };

   // Get quantity value based on billing type
   const getQuantityValue = (): string => {
      if (billingType === 'per_hour') {
         return `${hours} ${hours !== 1 ? t('profileBook.hours') : t('modelServices.hour')}`;
      } else if (billingType === 'per_session') {
         return sessionType === 'one_time' ? t('profileBook.oneTime') : t('profileBook.oneNight');
      }
      const days = calculateDayAmount(String(startDate), endDate ? String(endDate) : "");
      return `${days} ${t('booking.days')}`;
   };

   function closeHandler() {
      navigate("/customer/dates-history");
   }

   return (
      <Modal onClose={closeHandler} className="h-screen sm:h-auto w-full sm:w-3/6 py-8 sm:py-4 px-4 border rounded-xl">
         <div className="space-y-6">
            <div className="space-y-2">
               <div className="text-md font-bold text-balance">{getServiceName()}</div>
               <div className="text-sm leading-relaxed">
                  {getServiceDescription()}
               </div>
            </div>

            <Form method="post" className="space-y-4">
               {/* Hidden inputs for billing type, price, hours, sessionType */}
               <input type="hidden" name="billingType" value={billingType} />
               <input type="hidden" name="price" value={calculateTotalPrice()} />
               {billingType === 'per_hour' && (
                  <input type="hidden" name="hours" value={hours} />
               )}
               {billingType === 'per_session' && (
                  <input type="hidden" name="sessionType" value={sessionType} />
               )}

               <div className="space-y-6">
                  <div>
                     <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                           <Label htmlFor="start-date" className="text-sm font-medium">
                              {t('booking.edit.startDate')} <span className="text-destructive">*</span>
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
                                    {startDate ? format(startDate, "PPP p") : t('booking.edit.pickDateTime')}
                                 </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 space-y-3" align="start">
                                 <Calendar
                                    mode="single"
                                    selected={startDate}
                                    onSelect={setStartDate}
                                    disabled={(date) => date < new Date()}
                                    initialFocus
                                 />
                                 <div className="p-2">
                                    <Input
                                       required
                                       type="time"
                                       name="startDate"
                                       className="w-full"
                                       defaultValue={String(dateBooking.startDate)}
                                       onChange={(e) => {
                                          if (!startDate) return;
                                          const [hours, minutes] = e.target.value.split(":").map(Number);
                                          const newDate = new Date(startDate);
                                          newDate.setHours(hours);
                                          newDate.setMinutes(minutes);
                                          setStartDate(newDate);
                                       }}
                                    />
                                 </div>
                              </PopoverContent>
                           </Popover>

                           {startDate && (
                              <input
                                 type="hidden"
                                 name="startDate"
                                 value={startDate.toISOString()}
                              />
                           )}
                        </div>

                        <div className="space-y-2">
                           <Label htmlFor="end-date" className="text-sm font-medium">
                              {t('booking.edit.endDate')}
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
                                    {endDate ? format(endDate, "PPP p") : t('booking.edit.pickDateTime')}
                                 </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 space-y-3" align="start">
                                 <Calendar
                                    mode="single"
                                    selected={endDate}
                                    onSelect={setEndDate}
                                    disabled={(date) => {
                                       if (!startDate) return date < new Date();
                                       return date < startDate;
                                    }}
                                    initialFocus
                                 />
                                 <div className="p-2">
                                    <Input
                                       type="time"
                                       name="endDate"
                                       className="w-full"
                                       defaultValue={String(dateBooking.endDate)}
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

                  {/* Hours selector for per_hour services */}
                  {billingType === 'per_hour' && (
                     <div className="space-y-2">
                        <Label className="text-sm font-medium">
                           {t('profileBook.selectHours')} <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex items-center gap-3">
                           <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setHours(Math.max(2, hours - 1))}
                              disabled={hours <= 2}
                           >
                              -
                           </Button>
                           <div className="flex items-center gap-2 px-4 py-2 border rounded-md min-w-[80px] justify-center">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{hours}</span>
                           </div>
                           <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setHours(Math.min(10, hours + 1))}
                              disabled={hours >= 10}
                           >
                              +
                           </Button>
                           <span className="text-sm text-muted-foreground">
                              {hours !== 1 ? t('profileBook.hours') : t('modelServices.hour')}
                           </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{t('profileBook.hoursHint')}</p>
                     </div>
                  )}

                  {/* Session type selector for per_session services */}
                  {billingType === 'per_session' && (
                     <div className="space-y-2">
                        <Label className="text-sm font-medium">
                           {t('profileBook.selectSessionType')} <span className="text-destructive">*</span>
                        </Label>
                        <div className="grid grid-cols-2 gap-4">
                           <button
                              type="button"
                              onClick={() => setSessionType('one_time')}
                              className={cn(
                                 "flex flex-col items-center justify-between rounded-md border-2 p-4 hover:bg-accent cursor-pointer transition-colors",
                                 sessionType === 'one_time' ? "border-rose-500 bg-rose-50" : "border-muted"
                              )}
                           >
                              <Clock className="mb-2 h-6 w-6" />
                              <span className="text-sm font-medium">{t('profileBook.oneTime')}</span>
                              <span className="text-xs text-muted-foreground">{t('profileBook.oneTimeDescription')}</span>
                              <span className="mt-2 text-sm font-bold text-rose-600">
                                 {formatCurrency(service.customOneTimePrice || service.service.oneTimePrice || 0)}
                              </span>
                           </button>
                           <button
                              type="button"
                              onClick={() => setSessionType('one_night')}
                              className={cn(
                                 "flex flex-col items-center justify-between rounded-md border-2 p-4 hover:bg-accent cursor-pointer transition-colors",
                                 sessionType === 'one_night' ? "border-rose-500 bg-rose-50" : "border-muted"
                              )}
                           >
                              <Moon className="mb-2 h-6 w-6" />
                              <span className="text-sm font-medium">{t('profileBook.oneNight')}</span>
                              <span className="text-xs text-muted-foreground">{t('profileBook.oneNightDescription')}</span>
                              <span className="mt-2 text-sm font-bold text-rose-600">
                                 {formatCurrency(service.customOneNightPrice || service.service.oneNightPrice || 0)}
                              </span>
                           </button>
                        </div>
                     </div>
                  )}
               </div>

               <div className="space-y-4">
                  <div className="space-y-2">
                     <Label htmlFor="meeting-location" className="text-sm font-medium">
                        {t('booking.edit.location')} <span className="text-destructive">*</span>
                     </Label>
                     <Input
                        name="location"
                        id="meeting-location"
                        placeholder={t('booking.edit.locationPlaceholder')}
                        className="h-11 text-sm"
                        defaultValue={dateBooking.location}
                     />
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="space-y-2">
                     <Label htmlFor="dress-code" className="text-sm font-medium">
                        {t('booking.edit.preferredAttire')}
                     </Label>
                     <Textarea
                        name="preferred"
                        id="dress-code"
                        defaultValue={dateBooking.preferredAttire}
                        placeholder={t('booking.edit.attirePlaceholder')}
                        className="min-h-[100px] resize-none text-sm"
                     />
                  </div>
               </div>

               <div className="space-y-2 ">
                  <h3 className="text-sm font-bold">{t('booking.edit.summary.title')}</h3>

                  <div className="space-y-3 bg-secondary/30 p-2 rounded-lg">
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{getRateLabel()}</span>
                        <span className="font-medium">{formatCurrency(getRate())}</span>
                     </div>

                     {billingType !== 'per_session' && (
                        <div className="flex justify-between items-center text-sm">
                           <span className="text-muted-foreground">{getQuantityLabel()}</span>
                           <span className="font-medium">{getQuantityValue()}</span>
                        </div>
                     )}

                     {billingType === 'per_session' && (
                        <div className="flex justify-between items-center text-sm">
                           <span className="text-muted-foreground">{getQuantityLabel()}</span>
                           <span className="font-medium">{getQuantityValue()}</span>
                        </div>
                     )}

                     <div className="border-t pt-3 mt-3">
                        <div className="flex justify-between items-center">
                           <span className="text-sm font-bold">{t('booking.edit.summary.totalPrice')}</span>
                           <span className="text-md font-bold text-primary">
                              {formatCurrency(calculateTotalPrice())}
                           </span>
                        </div>
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
                  <Button
                     type="button"
                     variant="outline"
                     onClick={closeHandler}
                     className="bg-gray-500 text-white hover:bg-gray-600 hover:text-white"
                  >
                     {t('booking.edit.close')}
                  </Button>
                  <Button
                     type="submit"
                     variant="outline"
                     className="flex gap-2 bg-rose-500 text-white hover:bg-rose-600 hover:text-white"
                  >
                     {isSubmitting ? <Loader className="w-4 h-4 animate-spin" /> : <Calendar1 />}
                     {isSubmitting ? t('booking.edit.saving') : t('booking.edit.saveChange')}
                  </Button>
               </div>
            </Form>
         </div>
      </Modal>
   )
}
