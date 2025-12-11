"use client"

import { useState } from "react"
import { format } from "date-fns"
import { useTranslation } from "react-i18next"
import { AlertCircle, Calendar1, CalendarIcon, Loader } from "lucide-react"
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
import type { IServiceBookingCredentials, IServiceBookingResponse, ISingleServiceBooking } from "~/interfaces/service"

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
   const dayAmount = bookingData.endDate
      ? calculateDayAmount(String(bookingData.startDate), String(bookingData.endDate))
      : calculateDayAmount(String(bookingData.startDate), "");

   try {
      bookingData.price = parseFormattedNumber(bookingData.price)
      bookingData.dayAmount = parseFormattedNumber(dayAmount)

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

   const isSubmitting =
      navigation.state !== "idle" && navigation.formMethod === "POST";

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
               <div className="space-y-6">
                  <div>
                     <div className="grid gap-6 md:grid-cols-2">
                        <input
                           type="hidden"
                           name="price"
                           value={service.customRate ? service.customRate : service.service.baseRate}
                        />
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
                        <span className="text-muted-foreground">{t('booking.edit.summary.pricePerDay')}</span>
                        <span className="font-medium">{formatCurrency(service.customRate ? service.customRate : service.service.baseRate)}</span>
                     </div>

                     <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t('booking.edit.summary.numberOfDays')}</span>
                        <span className="font-medium">{calculateDayAmount(String(startDate), endDate ? String(endDate) : "")} {t('booking.days')}</span>
                     </div>

                     <div className="border-t pt-3 mt-3">
                        <div className="flex justify-between items-center">
                           <span className="text-sm font-bold">{t('booking.edit.summary.totalPrice')}</span>
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
