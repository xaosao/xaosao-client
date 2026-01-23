"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { useTranslation } from 'react-i18next';
import { AlertCircle, Briefcase, Calendar1, CalendarIcon, Loader, X, Wallet, Clock, Moon, Video } from "lucide-react"
import { Form, Link, redirect, useActionData, useLoaderData, useNavigate, useNavigation, useParams, type LoaderFunctionArgs } from "react-router"

// components:
import Modal from "~/components/ui/model"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Button } from "~/components/ui/button"
import { Textarea } from "~/components/ui/textarea"
import { Calendar } from "~/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"

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
   const { getModelBookedSlots } = await import("~/services/booking.server");
   const service = await getModelService(params.modelId!, params.serviceId!);
   const { bookedSlots } = await getModelBookedSlots(params.modelId!);

   return { service, bookedSlots };
}

export async function action({ params, request }: Route.ActionArgs) {
   const { createServiceBooking } = await import("~/services/booking.server")
   const modelId = params.modelId
   const modelServiceId = params.serviceId
   const customerId = await requireUserSession(request)

   const formData = await request.formData()
   const bookingData = Object.fromEntries(formData) as Partial<IServiceBookingCredentials>
   const billingType = formData.get('billingType') as string

   try {
      bookingData.price = parseFormattedNumber(bookingData.price)

      // Handle different billing types
      if (billingType === 'per_day') {
         const dayAmount = calculateDayAmount(String(bookingData?.startDate), String(bookingData?.endDate))
         bookingData.dayAmount = parseFormattedNumber(dayAmount)
      } else if (billingType === 'per_hour') {
         bookingData.hours = parseFormattedNumber(bookingData.hours)
         // Handle massage variant ID
         const variantId = formData.get('modelServiceVariantId') as string;
         if (variantId) {
            bookingData.modelServiceVariantId = variantId;
         }
      } else if (billingType === 'per_session') {
         bookingData.sessionType = formData.get('sessionType') as 'one_time' | 'one_night'
      } else if (billingType === 'per_minute') {
         bookingData.minutes = parseFormattedNumber(bookingData.minutes)
         // For call service, location is not required - set a default value
         // Note: "Online" instead of "Online Call" to avoid SQL injection filter (blocks word "call")
         bookingData.location = 'Online'
      }

      await validateServiceBookingInputs(bookingData as IServiceBookingCredentials);
      const res = await createServiceBooking(customerId, modelId, modelServiceId, bookingData as IServiceBookingCredentials);
      if (res.id) {
         return redirect(`/customer/dates-history?toastMessage=${encodeURIComponent("profileBook.success.booked")}&toastType=success`);
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
         message: error || "profileBook.errors.bookingFailed",
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
   const [selectedHours, setSelectedHours] = useState<number>(1)
   const [selectedMinutes, setSelectedMinutes] = useState<number>(30) // Default 30 minutes for call service
   const [selectedSessionType, setSelectedSessionType] = useState<'one_time' | 'one_night'>('one_time')
   const [selectedMassageVariantId, setSelectedMassageVariantId] = useState<string>("")

   // Duration options for call service (in minutes)
   const callDurationOptions = [
      { value: 5, label: '5', unit: 'minutes' },
      { value: 10, label: '10', unit: 'minutes' },
      { value: 20, label: '20', unit: 'minutes' },
      { value: 30, label: '30', unit: 'minutes' },
      { value: 60, label: '1', unit: 'hour' },
      { value: 120, label: '2', unit: 'hours' },
      { value: 180, label: '3', unit: 'hours' },
      { value: 300, label: '5', unit: 'hours' },
      { value: 600, label: '10', unit: 'hours' },
   ]

   const actionData = useActionData<typeof action>()
   const loaderData = useLoaderData<{ service: IServiceBookingResponse; bookedSlots: Array<{ startDate: Date; endDate: Date | null; hours: number | null; serviceName: string; isDateOnly: boolean }> }>();
   const service = loaderData.service;
   const bookedSlots = loaderData.bookedSlots || [];
   const isSubmitting =
      navigation.state !== "idle" && navigation.formMethod === "POST";

   // Get billing type from service (default to per_day for backward compatibility)
   const billingType = service.service.billingType || 'per_day';

   // Auto-select first massage variant when component loads
   useEffect(() => {
      if (service.service.name.toLowerCase() === 'massage' && service.model_service_variant && service.model_service_variant.length > 0 && !selectedMassageVariantId) {
         setSelectedMassageVariantId(service.model_service_variant[0].id);
      }
   }, [service, selectedMassageVariantId]);

   // Calculate price based on billing type
   const calculateTotalPrice = () => {
      if (billingType === 'per_hour') {
         // For massage service, use selected variant price
         if (service.service.name.toLowerCase() === 'massage' && service.model_service_variant && service.model_service_variant.length > 0) {
            const selectedVariant = service.model_service_variant.find(v => v.id === selectedMassageVariantId);
            if (selectedVariant) {
               return selectedVariant.pricePerHour * selectedHours;
            }
            // Default to first variant if none selected
            return service.model_service_variant[0].pricePerHour * selectedHours;
         }
         const hourlyRate = service.customHourlyRate || service.service.hourlyRate || 0;
         return hourlyRate * selectedHours;
      } else if (billingType === 'per_session') {
         if (selectedSessionType === 'one_time') {
            return service.customOneTimePrice || service.service.oneTimePrice || 0;
         } else {
            return service.customOneNightPrice || service.service.oneNightPrice || 0;
         }
      } else if (billingType === 'per_minute') {
         // For call service, calculate price based on minutes
         const minuteRate = service.customMinuteRate || service.service.minuteRate || 0;
         return minuteRate * selectedMinutes;
      } else {
         // per_day
         const dailyRate = service.customRate || service.service.baseRate;
         const days = calculateDayAmount(String(startDate), endDate ? String(endDate) : "");
         return dailyRate * days;
      }
   };

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

   // Helper function to format booked slots for display
   const formatBookedSlot = (slot: { startDate: Date; endDate: Date | null; hours: number | null; serviceName: string; isDateOnly: boolean }) => {
      const start = new Date(slot.startDate);
      const end = slot.endDate
         ? new Date(slot.endDate)
         : slot.hours
            ? new Date(start.getTime() + slot.hours * 60 * 60 * 1000)
            : null;

      if (slot.isDateOnly) {
         // For date-only services (hmongNewYear, traveling), show date range
         if (end && end.toDateString() !== start.toDateString()) {
            return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
         }
         return format(start, 'MMM d, yyyy');
      } else {
         // For time-based services (drinkingPartner, sleepPartner), show date + time
         if (end) {
            return `${format(start, 'MMM d, HH:mm')} - ${format(end, 'HH:mm')}`;
         }
         return format(start, 'MMM d, yyyy HH:mm');
      }
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

            {/* Display model's booked time slots */}
            {bookedSlots.length > 0 && (
               <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                     <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                     <div className="text-sm text-amber-800">
                        <p className="font-medium mb-1">{t('profileBook.unavailableTimes', { defaultValue: 'Unavailable times:' })}</p>
                        <ul className="space-y-1">
                           {bookedSlots.slice(0, 5).map((slot, index) => (
                              <li key={index} className="text-amber-700">
                                 • {formatBookedSlot(slot)}
                              </li>
                           ))}
                           {bookedSlots.length > 5 && (
                              <li className="text-amber-600 italic">
                                 {t('profileBook.andMoreSlots', { count: bookedSlots.length - 5, defaultValue: `...and ${bookedSlots.length - 5} more` })}
                              </li>
                           )}
                        </ul>
                     </div>
                  </div>
               </div>
            )}

            <Form method="post" className="space-y-4">
               {/* Hidden fields for billing type and calculated price */}
               <input type="hidden" name="billingType" value={billingType} />
               <input type="hidden" name="price" value={calculateTotalPrice()} />
               {billingType === 'per_hour' && (
                  <input type="hidden" name="hours" value={selectedHours} />
               )}
               {billingType === 'per_session' && (
                  <input type="hidden" name="sessionType" value={selectedSessionType} />
               )}
               {billingType === 'per_minute' && (
                  <input type="hidden" name="minutes" value={selectedMinutes} />
               )}
               {service.service.name.toLowerCase() === 'massage' && selectedMassageVariantId && (
                  <input type="hidden" name="modelServiceVariantId" value={selectedMassageVariantId} />
               )}

               <div className="space-y-6">
                  <div>
                     <div className="grid gap-3 sm:gap-6 md:grid-cols-2">
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
                                 <div className="p-2 space-y-1">
                                    <Label className="text-sm font-medium text-gray-700">
                                       {t('profileBook.selectTime', { defaultValue: 'Select Time' })}
                                    </Label>
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

                        {/* For per_day: Show End Date picker */}
                        {billingType === 'per_day' && (
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
                                    <div className="p-2 space-y-1">
                                       <Label className="text-sm font-medium text-gray-700">
                                          {t('profileBook.selectTime', { defaultValue: 'Select Time' })}
                                       </Label>
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
                        )}

                        {/* For per_hour: Show Hours selector */}
                        {billingType === 'per_hour' && (
                           <div className="space-y-2">
                              <Label htmlFor="hours-select" className="text-sm font-medium">
                                 {t('profileBook.numberOfHours')} <span className="text-destructive">*</span>
                              </Label>
                              <Select
                                 value={String(selectedHours)}
                                 onValueChange={(value) => setSelectedHours(Number(value))}
                              >
                                 <SelectTrigger id="hours-select" className="w-full h-11">
                                    <Clock className="mr-2 h-4 w-4" />
                                    <SelectValue placeholder={t('profileBook.selectHours')} />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((hour) => (
                                       <SelectItem key={hour} value={String(hour)}>
                                          {hour} {hour === 1 ? t('profileBook.hour') : t('profileBook.hours')}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </div>
                        )}

                        {/* For per_session: Show Session Type selector */}
                        {billingType === 'per_session' && (
                           <div className="space-y-2">
                              <Label htmlFor="session-type-select" className="text-sm font-medium">
                                 {t('profileBook.sessionType')} <span className="text-destructive">*</span>
                              </Label>
                              <Select
                                 value={selectedSessionType}
                                 onValueChange={(value: 'one_time' | 'one_night') => setSelectedSessionType(value)}
                              >
                                 <SelectTrigger id="session-type-select" className="w-full h-11">
                                    <Moon className="mr-2 h-4 w-4" />
                                    <SelectValue placeholder={t('profileBook.selectSessionType')} />
                                 </SelectTrigger>
                                 <SelectContent>
                                    <SelectItem value="one_time">
                                       {t('profileBook.oneTime')} ({t('profileBook.oneTimeDesc')})
                                    </SelectItem>
                                    <SelectItem value="one_night">
                                       {t('profileBook.oneNight')} ({t('profileBook.oneNightDesc')})
                                    </SelectItem>
                                 </SelectContent>
                              </Select>
                           </div>
                        )}

                        {/* For per_minute (Call Service): Show Duration selector */}
                        {billingType === 'per_minute' && (
                           <div className="space-y-2">
                              <Label htmlFor="call-duration-select" className="text-sm font-medium">
                                 {t('profileBook.callDuration', { defaultValue: 'Call Duration' })} <span className="text-destructive">*</span>
                              </Label>
                              <Select
                                 value={String(selectedMinutes)}
                                 onValueChange={(value) => setSelectedMinutes(Number(value))}
                              >
                                 <SelectTrigger id="call-duration-select" className="w-full h-11">
                                    <Video className="mr-2 h-4 w-4" />
                                    <SelectValue placeholder={t('profileBook.selectDuration', { defaultValue: 'Select duration' })} />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {callDurationOptions.map((option) => (
                                       <SelectItem key={option.value} value={String(option.value)}>
                                          {option.label} {option.unit === 'minutes'
                                             ? t('profileBook.minutes', { defaultValue: 'minutes' })
                                             : option.unit === 'hour'
                                                ? t('profileBook.hour')
                                                : t('profileBook.hours')}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </div>
                        )}

                     </div>
                  </div>
               </div>

               {/* Hide location and attire for call service (per_minute) */}
               {billingType !== 'per_minute' && (
                  <>
                     <div className="grid gap-3 sm:gap-6 md:grid-cols-2">
                        {/* For massage service: Show massage type selector first */}
                        {billingType === 'per_hour' && service.service.name.toLowerCase() === 'massage' && service.model_service_variant && service.model_service_variant.length > 0 && (
                           <div className="space-y-2">
                              <Label htmlFor="massage-type-select" className="text-sm font-medium">
                                 {t('profileBook.massageType')} <span className="text-destructive">*</span>
                              </Label>
                              <Select
                                 value={selectedMassageVariantId}
                                 onValueChange={setSelectedMassageVariantId}
                              >
                                 <SelectTrigger id="massage-type-select" className="w-full h-11">
                                    <Briefcase className="mr-2 h-4 w-4" />
                                    <SelectValue placeholder={t('profileBook.selectMassageType')} />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {service.model_service_variant.map((variant) => (
                                       <SelectItem key={variant.id} value={variant.id}>
                                          {variant.name} - {formatCurrency(variant.pricePerHour)}/{t('profileBook.hour')}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </div>
                        )}

                        <div className="space-y-4">
                           <div className="space-y-2">
                              <Label htmlFor="meeting-location" className="text-sm font-medium">
                                 {t('profileBook.location')} <span className="text-destructive">*</span>
                              </Label>
                              {service.service.name.toLowerCase() === 'massage' ? (
                                 <>
                                    <Input
                                       id="meeting-location"
                                       value={service.serviceLocation || t('profileBook.noAddressAvailable')}
                                       className="h-11 text-sm bg-gray-100"
                                       readOnly
                                    />
                                    <input type="hidden" name="location" value={service.serviceLocation || ''} />
                                 </>
                              ) : (
                                 <Input
                                    name="location"
                                    id="meeting-location"
                                    placeholder={t('profileBook.locationPlaceholder')}
                                    className="h-11 text-sm"
                                 />
                              )}
                           </div>
                        </div>
                     </div>
                     {/* Hide Preferred Attire for massage service */}
                     {service.service.name.toLowerCase() !== 'massage' && (
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
                     )}
                  </>
               )}

               <div className="space-y-2 ">
                  <h3 className="text-sm font-bold">{t('profileBook.summary')}</h3>

                  <div className="space-y-3 bg-secondary/30 p-2 rounded-lg">
                     {/* Per Day Summary */}
                     {billingType === 'per_day' && (
                        <>
                           <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">{t('profileBook.pricePerDay')}</span>
                              <span className="font-medium">{formatCurrency(service.customRate || service.service.baseRate)}</span>
                           </div>
                           <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">{t('profileBook.numberOfDays')}</span>
                              <span className="font-medium">{calculateDayAmount(String(startDate), endDate ? String(endDate) : "")} {t('profileBook.days')}</span>
                           </div>
                        </>
                     )}

                     {/* Per Hour Summary */}
                     {billingType === 'per_hour' && (
                        <>
                           {service.service.name.toLowerCase() === 'massage' && service.model_service_variant && service.model_service_variant.length > 0 ? (
                              <>
                                 {(() => {
                                    const selectedVariant = service.model_service_variant.find(v => v.id === selectedMassageVariantId) || service.model_service_variant[0];
                                    return (
                                       <>
                                          <div className="flex justify-between items-center text-sm">
                                             <span className="text-muted-foreground">{t('profileBook.massageType')}</span>
                                             <span className="font-medium">{selectedVariant.name}</span>
                                          </div>
                                          <div className="flex justify-between items-center text-sm">
                                             <span className="text-muted-foreground">{t('profileBook.pricePerHour')}</span>
                                             <span className="font-medium">{formatCurrency(selectedVariant.pricePerHour)}</span>
                                          </div>
                                       </>
                                    );
                                 })()}
                                 <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">{t('profileBook.numberOfHours')}</span>
                                    <span className="font-medium">{selectedHours} {selectedHours === 1 ? t('profileBook.hour') : t('profileBook.hours')}</span>
                                 </div>
                              </>
                           ) : (
                              <>
                                 <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">{t('profileBook.pricePerHour')}</span>
                                    <span className="font-medium">{formatCurrency(service.customHourlyRate || service.service.hourlyRate || 0)}</span>
                                 </div>
                                 <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">{t('profileBook.numberOfHours')}</span>
                                    <span className="font-medium">{selectedHours} {selectedHours === 1 ? t('profileBook.hour') : t('profileBook.hours')}</span>
                                 </div>
                              </>
                           )}
                        </>
                     )}

                     {/* Per Session Summary */}
                     {billingType === 'per_session' && (
                        <>
                           <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">{t('profileBook.sessionType')}</span>
                              <span className="font-medium">
                                 {selectedSessionType === 'one_time'
                                    ? t('profileBook.oneTime')
                                    : t('profileBook.oneNight')}
                              </span>
                           </div>
                           <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">{t('profileBook.sessionPrice')}</span>
                              <span className="font-medium">
                                 {formatCurrency(
                                    selectedSessionType === 'one_time'
                                       ? (service.customOneTimePrice || service.service.oneTimePrice || 0)
                                       : (service.customOneNightPrice || service.service.oneNightPrice || 0)
                                 )}
                              </span>
                           </div>
                        </>
                     )}

                     {/* Per Minute Summary (Call Service) */}
                     {billingType === 'per_minute' && (
                        <>
                           <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">{t('profileBook.pricePerMinute', { defaultValue: 'Price per minute' })}</span>
                              <span className="font-medium">{formatCurrency(service.customMinuteRate || service.service.minuteRate || 0)}</span>
                           </div>
                           <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">{t('profileBook.callDuration', { defaultValue: 'Call Duration' })}</span>
                              <span className="font-medium">
                                 {selectedMinutes >= 60
                                    ? `${Math.floor(selectedMinutes / 60)} ${Math.floor(selectedMinutes / 60) === 1 ? t('profileBook.hour') : t('profileBook.hours')}`
                                    : `${selectedMinutes} ${t('profileBook.minutes', { defaultValue: 'minutes' })}`
                                 }
                              </span>
                           </div>
                        </>
                     )}

                     <div className="border-t pt-3 mt-3">
                        <div className="flex justify-between items-center">
                           <span className="text-sm font-bold">{t('profileBook.totalPrice')}</span>
                           <span className="text-md font-bold text-primary">
                              {formatCurrency(calculateTotalPrice())}
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
                              })() : capitalize(t(actionData.message, { defaultValue: actionData.message }))}
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
