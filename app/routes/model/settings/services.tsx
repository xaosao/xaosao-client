import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Form, useLoaderData, useNavigation, redirect } from "react-router";
import { Briefcase, Check, Loader, SquarePen, Trash2, Plus, X } from "lucide-react";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

// components:
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";

// services:
import {
  getServicesForModel,
  applyForService,
  cancelServiceApplication,
  updateServiceApplication,
} from "~/services/service.server";
import { requireModelSession } from "~/services/model-auth.server";
import { formatMoney } from "~/utils/functions/moneyFormat";
import type { BillingType } from "~/interfaces/service";

export const meta: MetaFunction = () => {
  return [
    { title: "Services - Model Settings" },
    { name: "description", content: "Manage your service offerings" },
  ];
};

interface MassageVariant {
  id?: string;
  name: string;
  pricePerHour: number;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  baseRate: number;
  commission: number;
  status: string;
  billingType: BillingType;
  hourlyRate: number | null;
  oneTimePrice: number | null;
  oneNightPrice: number | null;
  minuteRate: number | null;
  isApplied: boolean;
  modelServiceId: string | null;
  customRate: number | null;
  customHourlyRate: number | null;
  customOneTimePrice: number | null;
  customOneNightPrice: number | null;
  customMinuteRate: number | null;
  isAvailable: boolean;
  massageVariants?: MassageVariant[];
  serviceLocation?: string | null;
}

interface LoaderData {
  services: Service[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const services = await getServicesForModel(modelId);
  return { services };
}

export async function action({ request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const formData = await request.formData();

  const serviceId = formData.get("serviceId") as string;
  const serviceName = formData.get("serviceName") as string;
  const actionType = formData.get("actionType") as string;
  // const billingType = formData.get("billingType") as BillingType;

  // Build rates object based on billing type
  const buildRates = () => {
    const customRateStr = formData.get("customRate") as string;
    const customHourlyRateStr = formData.get("customHourlyRate") as string;
    const customOneTimePriceStr = formData.get("customOneTimePrice") as string;
    const customOneNightPriceStr = formData.get("customOneNightPrice") as string;
    const customMinuteRateStr = formData.get("customMinuteRate") as string;

    return {
      customRate: customRateStr ? parseFloat(customRateStr) : undefined,
      customHourlyRate: customHourlyRateStr ? parseFloat(customHourlyRateStr) : undefined,
      customOneTimePrice: customOneTimePriceStr ? parseFloat(customOneTimePriceStr) : undefined,
      customOneNightPrice: customOneNightPriceStr ? parseFloat(customOneNightPriceStr) : undefined,
      customMinuteRate: customMinuteRateStr ? parseFloat(customMinuteRateStr) : undefined,
    };
  };

  // Build massage variants array
  const buildMassageVariants = () => {
    const massageVariantsJson = formData.get("massageVariants") as string;
    if (!massageVariantsJson) return undefined;

    try {
      return JSON.parse(massageVariantsJson);
    } catch (error) {
      console.error("Error parsing massage variants:", error);
      return undefined;
    }
  };

  if (actionType === "apply") {
    const rates = buildRates();
    const massageVariants = serviceName?.toLowerCase() === "massage" ? buildMassageVariants() : undefined;
    const serviceLocation = serviceName?.toLowerCase() === "massage" ? (formData.get("serviceLocation") as string) : undefined;
    const result = await applyForService(modelId, serviceId, rates, massageVariants, serviceLocation);
    if (result?.success) {
      return redirect(
        `/model/settings/services?toastMessage=${encodeURIComponent("modelServices.success.applied")}&toastType=success`
      );
    } else {
      return redirect(
        `/model/settings/services?toastMessage=${encodeURIComponent(result?.message || "modelServices.errors.failedToApply")}&toastType=error`
      );
    }
  } else if (actionType === "edit") {
    const rates = buildRates();
    const massageVariants = serviceName?.toLowerCase() === "massage" ? buildMassageVariants() : undefined;
    const serviceLocation = serviceName?.toLowerCase() === "massage" ? (formData.get("serviceLocation") as string) : undefined;
    const modelServiceId = formData.get("modelServiceId") as string;
    const result = await updateServiceApplication(
      modelId,
      serviceId,
      modelServiceId,
      rates,
      massageVariants,
      serviceLocation
    );
    if (result?.success) {
      return redirect(
        `/model/settings/services?toastMessage=${encodeURIComponent("modelServices.success.updated")}&toastType=success`
      );
    } else {
      return redirect(
        `/model/settings/services?toastMessage=${encodeURIComponent(result?.message || "modelServices.errors.failedToUpdate")}&toastType=error`
      );
    }
  } else if (actionType === "cancel") {
    const result = await cancelServiceApplication(modelId, serviceId);
    if (result?.success) {
      return redirect(
        `/model/settings/services?toastMessage=${encodeURIComponent("modelServices.success.canceled")}&toastType=success`
      );
    } else {
      return redirect(
        `/model/settings/services?toastMessage=${encodeURIComponent(result?.message || "modelServices.errors.failedToCancel")}&toastType=error`
      );
    }
  }

  return null;
}

export default function ServicesSettings() {
  const { t } = useTranslation();
  const { services } = useLoaderData<LoaderData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Rate states for different billing types
  const [customRate, setCustomRate] = useState<string>("");
  const [customHourlyRate, setCustomHourlyRate] = useState<string>("");
  const [customOneTimePrice, setCustomOneTimePrice] = useState<string>("");
  const [customOneNightPrice, setCustomOneNightPrice] = useState<string>("");
  const [customMinuteRate, setCustomMinuteRate] = useState<string>("");

  // Massage variants state
  const [massageVariants, setMassageVariants] = useState<MassageVariant[]>([
    { name: "", pricePerHour: 0 }
  ]);

  // Service location state (for massage service)
  const [serviceLocation, setServiceLocation] = useState<string>("");

  const [applyModal, setApplyModal] = useState<Service | null>(null);
  const [editModal, setEditModal] = useState<Service | null>(null);
  const [cancelModal, setCancelModal] = useState<Service | null>(null);

  // Helper functions for massage variants
  const addMassageVariant = () => {
    setMassageVariants([...massageVariants, { name: "", pricePerHour: 0 }]);
  };

  const removeMassageVariant = (index: number) => {
    if (massageVariants.length > 1) {
      setMassageVariants(massageVariants.filter((_, i) => i !== index));
    }
  };

  const updateMassageVariant = (index: number, field: keyof MassageVariant, value: string | number) => {
    const updated = [...massageVariants];
    updated[index] = { ...updated[index], [field]: value };
    setMassageVariants(updated);
  };

  // Format number with commas (e.g., 50000 -> 50,000)
  const formatNumberWithCommas = (value: string | number): string => {
    if (!value && value !== 0) return "";
    const numStr = String(value).replace(/[^0-9]/g, "");
    if (!numStr) return "";
    return Number(numStr).toLocaleString("en-US");
  };

  // Parse formatted string to number (e.g., "50,000" -> 50000)
  const parseFormattedNumber = (value: string): string => {
    return value.replace(/,/g, "");
  };

  // Handle price input change with formatting
  const handlePriceChange = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const numericValue = value.replace(/[^0-9]/g, "");
    setter(formatNumberWithCommas(numericValue));
  };

  // Helper to initialize rates when opening modal
  const initializeRatesForService = (service: Service) => {
    setCustomRate(formatNumberWithCommas(service.customRate?.toString() || service.baseRate.toString()));
    setCustomHourlyRate(formatNumberWithCommas(service.customHourlyRate?.toString() || service.hourlyRate?.toString() || ""));
    setCustomOneTimePrice(formatNumberWithCommas(service.customOneTimePrice?.toString() || service.oneTimePrice?.toString() || ""));
    setCustomOneNightPrice(formatNumberWithCommas(service.customOneNightPrice?.toString() || service.oneNightPrice?.toString() || ""));
    setCustomMinuteRate(formatNumberWithCommas(service.customMinuteRate?.toString() || service.minuteRate?.toString() || ""));

    // Initialize massage variants and service location if applicable
    if (service.name.toLowerCase() === "massage") {
      if (service.massageVariants && service.massageVariants.length > 0) {
        setMassageVariants(service.massageVariants);
      } else {
        setMassageVariants([{ name: "", pricePerHour: 0 }]);
      }
      // Initialize service location for massage
      setServiceLocation(service.serviceLocation || "");
    }
  };

  // Helper to calculate model earnings after commission
  const calculateEarnings = (rate: number, commission: number) => {
    const commissionAmount = (rate * commission) / 100;
    return rate - commissionAmount;
  };

  // Helper function to get translated service name
  const getServiceName = (nameKey: string) => {
    const translatedName = t(`modelServices.serviceItems.${nameKey}.name`);
    return translatedName.includes('modelServices.serviceItems') ? nameKey : translatedName;
  };

  // Helper function to get translated service description
  const getServiceDescription = (nameKey: string, fallbackDescription: string | null) => {
    const translatedDesc = t(`modelServices.serviceItems.${nameKey}.description`);
    if (translatedDesc.includes('modelServices.serviceItems')) {
      return fallbackDescription || t("modelServices.noDescription");
    }
    return translatedDesc;
  };

  // Close modals when form submission starts
  useEffect(() => {
    if (isSubmitting) {
      setApplyModal(null);
      setEditModal(null);
      setCancelModal(null);
    }
  }, [isSubmitting]);

  return (
    <div className="p-0 sm:p-4 lg:p-0">
      <div className="mb-3 sm:mb-6 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-lg">
            <Briefcase className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <h1 className="text-md">
              {t("modelServices.title")}
            </h1>
            <p className="text-xs text-gray-600">{t("modelServices.subtitle")}</p>
          </div>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
          <Briefcase className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-2">{t("modelServices.noServices")}</p>
          <p className="text-sm text-gray-500">
            {t("modelServices.checkBackLater")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map((service) => (
            <div
              key={service.id}
              className={`relative rounded-sm overflow-hidden transition-all hover:shadow-lg space-y-2 py-4 ${service.isApplied ? "border border-rose-500 bg-rose-50" : "bg-white border"
                }`}
            >
              {service.isApplied && (
                <div className="absolute top-2 right-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCancelModal(service)}
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-gray-300 text-gray-500 hover:bg-gray-500 hover:text-white transition-colors shadow-sm text-xs"
                    title={t("modelServices.delete")}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{t("modelServices.delete")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditModal(service);
                      initializeRatesForService(service);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-rose-300 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors shadow-sm text-xs"
                    title={t("modelServices.edit")}
                  >
                    <SquarePen className="w-3 h-3" />
                    <span>{t("modelServices.edit")}</span>
                  </button>
                </div>
              )}

              <div className={`px-4 ${service.isApplied ? "text-rose-500" : ""}`}>
                <div className="flex items-start justify-start">
                  <h3 className={`text-md text-rose-500}`}>
                    {getServiceName(service.name)}
                  </h3>
                  {service.isApplied && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 backdrop-blur-sm rounded-sm text-xs text-rose-500">
                      <Check className="w-3 h-3" />
                      {t("modelServices.applied")}
                    </span>
                  )}
                </div>
              </div>

              <div className="px-4">
                <p className="text-xs text-gray-600 mb-4 line-clamp-2">
                  {getServiceDescription(service.name, service.description)}
                </p>

                <div className="space-y-2 mb-4">

                  {service.billingType === "per_day" && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{t("modelServices.baseRate")}</span>
                        <span className="font-semibold text-gray-900 flex items-center gap-1">
                          {formatMoney(service.baseRate)}/{t("modelServices.day")}
                        </span>
                      </div>
                      {service.isApplied && service.customRate && (
                        <div className="pt-2 border-t space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{t("modelServices.yourRate")}</span>
                            <span className="font-bold text-rose-600 flex items-center gap-1">
                              {formatMoney(service.customRate)}/{t("modelServices.day")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{t("modelServices.youEarn", { defaultValue: "You earn" })}</span>
                            <span className="font-bold text-emerald-600 flex items-center gap-1">
                              {formatMoney(calculateEarnings(service.customRate, service.commission))}/{t("modelServices.day")}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Per Hour - Show base rate (except for massage service) */}
                  {service.billingType === "per_hour" && (
                    <>
                      {/* Massage service - only show variants when applied */}
                      {service.name.toLowerCase() === "massage" ? (
                        service.isApplied && service.massageVariants && service.massageVariants.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-700 mb-2">
                              {t("modelServices.massageTypes")}
                            </div>
                            {service.massageVariants.map((variant, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm bg-white p-2 rounded border">
                                <span className="text-gray-700">{variant.name}</span>
                                <span className="font-semibold text-rose-600">
                                  {formatMoney(variant.pricePerHour)}/{t("modelServices.hour")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      ) : (
                        /* Other per_hour services - show base rate */
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{t("modelServices.baseRate")}</span>
                            <span className="font-semibold text-gray-900 flex items-center gap-1">
                              {formatMoney(service.hourlyRate || 0)}/{t("modelServices.hour")}
                            </span>
                          </div>
                          {service.isApplied && service.customHourlyRate && (
                            <div className="pt-2 border-t space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">{t("modelServices.yourRate")}</span>
                                <span className="font-bold text-rose-600 flex items-center gap-1">
                                  {formatMoney(service.customHourlyRate)}/{t("modelServices.hour")}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">{t("modelServices.youEarn", { defaultValue: "You earn" })}</span>
                                <span className="font-bold text-emerald-600 flex items-center gap-1">
                                  {formatMoney(calculateEarnings(service.customHourlyRate, service.commission))}/{t("modelServices.hour")}
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Per Session - Show one time and one night prices */}
                  {service.billingType === "per_session" && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{t("modelServices.baseRate")} ({t("modelServices.oneTimePrice")})</span>
                        <span className="font-semibold text-gray-900 flex items-center gap-1">
                          {formatMoney(service.oneTimePrice || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{t("modelServices.baseRate")} ({t("modelServices.oneNightPrice")})</span>
                        <span className="font-semibold text-gray-900 flex items-center gap-1">
                          {formatMoney(service.oneNightPrice || 0)}
                        </span>
                      </div>
                      {service.isApplied && (service.customOneTimePrice || service.customOneNightPrice) && (
                        <div className="pt-2 border-t space-y-2">
                          {service.customOneTimePrice && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">{t("modelServices.yourOneTimeRate")}</span>
                                <span className="font-bold text-rose-600 flex items-center gap-1">
                                  {formatMoney(service.customOneTimePrice)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">{t("modelServices.youEarn", { defaultValue: "You earn" })} ({t("modelServices.oneTimePrice")})</span>
                                <span className="font-bold text-emerald-600 flex items-center gap-1">
                                  {formatMoney(calculateEarnings(service.customOneTimePrice, service.commission))}
                                </span>
                              </div>
                            </div>
                          )}
                          {service.customOneNightPrice && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">{t("modelServices.yourOneNightRate")}</span>
                                <span className="font-bold text-rose-600 flex items-center gap-1">
                                  {formatMoney(service.customOneNightPrice)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">{t("modelServices.youEarn", { defaultValue: "You earn" })} ({t("modelServices.oneNightPrice")})</span>
                                <span className="font-bold text-emerald-600 flex items-center gap-1">
                                  {formatMoney(calculateEarnings(service.customOneNightPrice, service.commission))}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Per Minute - Show minute rate (Call Service) */}
                  {service.billingType === "per_minute" && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{t("modelServices.baseRate")}</span>
                        <span className="font-semibold text-gray-900 flex items-center gap-1">
                          {formatMoney(service.minuteRate || 0)}/{t("modelServices.minute", { defaultValue: "min" })}
                        </span>
                      </div>
                      {service.isApplied && service.customMinuteRate && (
                        <div className="pt-2 border-t space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{t("modelServices.yourRate")}</span>
                            <span className="font-bold text-rose-600 flex items-center gap-1">
                              {formatMoney(service.customMinuteRate)}/{t("modelServices.minute", { defaultValue: "min" })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{t("modelServices.youEarn", { defaultValue: "You earn" })}</span>
                            <span className="font-bold text-emerald-600 flex items-center gap-1">
                              {formatMoney(calculateEarnings(service.customMinuteRate, service.commission))}/{t("modelServices.minute", { defaultValue: "min" })}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{t("modelServices.commission")}</span>
                    <span className="font-semibold text-rose-600">
                      {service.commission}%
                    </span>
                  </div>
                </div>

                {/* Apply button - only shown when not applied */}
                {!service.isApplied && (
                  <div className="w-full flex items-center justify-center my-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setApplyModal(service);
                        initializeRatesForService(service);
                      }}
                      className="w-full bg-rose-500 text-white"
                    >
                      {t("modelServices.applyNow")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-6">
        <div className="flex items-start gap-3">
          <Briefcase className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-md text-blue-600 font-medium mb-1">{t("modelServices.aboutTitle")}</p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• {t("modelServices.aboutItem1")}</li>
              <li>• {t("modelServices.aboutItem2")}</li>
              <li>• {t("modelServices.aboutItem3")}</li>
              <li>• {t("modelServices.aboutItem4")}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      <Dialog open={!!applyModal} onOpenChange={(open) => !open && setApplyModal(null)}>
        <DialogContent className="sm:max-w-md px-3 sm:px-4">
          <DialogHeader>
            <DialogTitle className="text-md font-normal">{t("modelServices.applyModal.title")}</DialogTitle>
          </DialogHeader>

          {applyModal && (
            <>
              <Form method="post" className="space-y-4">
                <input type="hidden" name="serviceId" value={applyModal.id} />
                <input type="hidden" name="serviceName" value={applyModal.name} />
                <input type="hidden" name="actionType" value="apply" />
                <input type="hidden" name="billingType" value={applyModal.billingType} />

                {/* Per Day - Custom daily rate */}
                {applyModal.billingType === "per_day" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="customRate">
                        {t("modelServices.customDailyRateLabel")} <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Kip</span>
                        <input type="hidden" name="customRate" value={parseFormattedNumber(customRate)} />
                        <Input
                          id="customRate"
                          type="text"
                          inputMode="numeric"
                          value={customRate}
                          onChange={(e) => handlePriceChange(e.target.value, setCustomRate)}
                          required
                          className="pl-10"
                          placeholder={t("modelServices.enterYourDailyRate")}
                        />
                      </div>
                    </div>

                    {/* Earnings Breakdown */}
                    {customRate && parseFloat(parseFormattedNumber(customRate)) > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                        <h4 className="text-sm font-medium text-emerald-800">
                          {t("modelServices.earningsBreakdown", { defaultValue: "Your Earnings" })}
                        </h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between text-gray-600">
                            <span>{t("modelServices.customerPays", { defaultValue: "Customer pays" })}</span>
                            <span className="font-medium">{formatMoney(parseFloat(parseFormattedNumber(customRate)))}/{t("modelServices.day")}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>{t("modelServices.platformCommission", { defaultValue: "Platform commission" })} ({applyModal.commission}%)</span>
                            <span className="font-medium text-rose-600">
                              -{formatMoney((parseFloat(parseFormattedNumber(customRate)) * applyModal.commission) / 100)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-emerald-200">
                            <span className="font-medium text-emerald-800">{t("modelServices.youReceive", { defaultValue: "You receive" })}</span>
                            <span className="font-bold text-emerald-600">
                              {formatMoney(calculateEarnings(parseFloat(parseFormattedNumber(customRate)), applyModal.commission))}/{t("modelServices.day")}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Per Hour - Custom hourly rate OR Massage variants */}
                {applyModal.billingType === "per_hour" && (
                  <>
                    {applyModal.name.toLowerCase() === "massage" ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">
                            {t("modelServices.massageTypes")} <span className="text-rose-500">*</span>
                          </Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={addMassageVariant}
                            className="h-7 text-xs border-rose-300 text-rose-600 hover:bg-rose-50"
                          >
                            <Plus className="w-3 h-3" />
                            {t("modelServices.addType")}
                          </Button>
                        </div>

                        <input
                          type="hidden"
                          name="massageVariants"
                          value={JSON.stringify(massageVariants)}
                        />

                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {massageVariants.map((variant, index) => (
                            <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded-sm border">
                              <div className="flex-1 space-y-2">
                                <Input
                                  placeholder={t("modelServices.massageTypeName")}
                                  value={variant.name}
                                  onChange={(e) => updateMassageVariant(index, "name", e.target.value)}
                                  required
                                  className="text-sm"
                                />
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Kip</span>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder={t("modelServices.pricePerHour")}
                                    value={variant.pricePerHour ? formatNumberWithCommas(variant.pricePerHour) : ""}
                                    onChange={(e) => {
                                      const numericValue = e.target.value.replace(/[^0-9]/g, "");
                                      updateMassageVariant(index, "pricePerHour", parseFloat(numericValue) || 0);
                                    }}
                                    required
                                    className="pl-10 text-sm"
                                  />
                                </div>
                              </div>
                              {massageVariants.length > 1 && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeMassageVariant(index)}
                                  className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-start text-xs text-orange-500">
                          {t("modelServices.massageVariantsHint")}
                        </p>

                        {/* Service Location for Massage */}
                        <div className="space-y-2 mt-4 pt-4 border-t">
                          <Label htmlFor="serviceLocation">
                            {t("modelServices.serviceLocation")} <span className="text-rose-500">*</span>
                          </Label>
                          <Input
                            id="serviceLocation"
                            name="serviceLocation"
                            value={serviceLocation}
                            onChange={(e) => setServiceLocation(e.target.value)}
                            required
                            placeholder={t("modelServices.serviceLocationPlaceholder")}
                            className="text-xs"
                          />
                          <p className="text-start text-xs text-gray-500">
                            {t("modelServices.serviceLocationHint")}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="customHourlyRate">
                            {t("modelServices.customHourlyRateLabel")} <span className="text-rose-500">*</span>
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Kip</span>
                            <input type="hidden" name="customHourlyRate" value={parseFormattedNumber(customHourlyRate)} />
                            <Input
                              id="customHourlyRate"
                              type="text"
                              inputMode="numeric"
                              value={customHourlyRate}
                              onChange={(e) => handlePriceChange(e.target.value, setCustomHourlyRate)}
                              required
                              className="pl-10"
                              placeholder={t("modelServices.enterYourHourlyRate")}
                            />
                          </div>
                          <p className="text-xs text-gray-500">
                            {t("modelServices.hourlyRateHint")}
                          </p>
                        </div>

                        {/* Earnings Breakdown */}
                        {customHourlyRate && parseFloat(parseFormattedNumber(customHourlyRate)) > 0 && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                            <h4 className="text-sm font-medium text-emerald-800">
                              {t("modelServices.earningsBreakdown", { defaultValue: "Your Earnings" })}
                            </h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between text-gray-600">
                                <span>{t("modelServices.customerPays", { defaultValue: "Customer pays" })}</span>
                                <span className="font-medium">{formatMoney(parseFloat(parseFormattedNumber(customHourlyRate)))}/{t("modelServices.hour")}</span>
                              </div>
                              <div className="flex justify-between text-gray-600">
                                <span>{t("modelServices.platformCommission", { defaultValue: "Platform commission" })} ({applyModal.commission}%)</span>
                                <span className="font-medium text-rose-600">
                                  -{formatMoney((parseFloat(parseFormattedNumber(customHourlyRate)) * applyModal.commission) / 100)}
                                </span>
                              </div>
                              <div className="flex justify-between pt-2 border-t border-emerald-200">
                                <span className="font-medium text-emerald-800">{t("modelServices.youReceive", { defaultValue: "You receive" })}</span>
                                <span className="font-bold text-emerald-600">
                                  {formatMoney(calculateEarnings(parseFloat(parseFormattedNumber(customHourlyRate)), applyModal.commission))}/{t("modelServices.hour")}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Per Session - Custom one time and one night prices */}
                {applyModal.billingType === "per_session" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="customOneTimePrice">
                        {t("modelServices.customOneTimePriceLabel")} <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Kip</span>
                        <input type="hidden" name="customOneTimePrice" value={parseFormattedNumber(customOneTimePrice)} />
                        <Input
                          id="customOneTimePrice"
                          type="text"
                          inputMode="numeric"
                          value={customOneTimePrice}
                          onChange={(e) => handlePriceChange(e.target.value, setCustomOneTimePrice)}
                          required
                          className="pl-10"
                          placeholder={t("modelServices.enterOneTimePrice")}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        {t("modelServices.oneTimePriceHint")}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customOneNightPrice">
                        {t("modelServices.customOneNightPriceLabel")} <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Kip</span>
                        <input type="hidden" name="customOneNightPrice" value={parseFormattedNumber(customOneNightPrice)} />
                        <Input
                          id="customOneNightPrice"
                          type="text"
                          inputMode="numeric"
                          value={customOneNightPrice}
                          onChange={(e) => handlePriceChange(e.target.value, setCustomOneNightPrice)}
                          required
                          className="pl-10"
                          placeholder={t("modelServices.enterOneNightPrice")}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        {t("modelServices.oneNightPriceHint")}
                      </p>
                    </div>

                    {/* Earnings Breakdown */}
                    {(customOneTimePrice && parseFloat(parseFormattedNumber(customOneTimePrice)) > 0) || (customOneNightPrice && parseFloat(parseFormattedNumber(customOneNightPrice)) > 0) ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                        <h4 className="text-sm font-medium text-emerald-800">
                          {t("modelServices.earningsBreakdown", { defaultValue: "Your Earnings" })}
                        </h4>
                        <div className="space-y-1 text-sm">
                          {customOneTimePrice && parseFloat(parseFormattedNumber(customOneTimePrice)) > 0 && (
                            <>
                              <div className="flex justify-between text-gray-600">
                                <span>{t("modelServices.oneTimePrice")} - {t("modelServices.customerPays", { defaultValue: "Customer pays" })}</span>
                                <span className="font-medium">{formatMoney(parseFloat(parseFormattedNumber(customOneTimePrice)))}</span>
                              </div>
                              <div className="flex justify-between text-gray-600">
                                <span>{t("modelServices.platformCommission", { defaultValue: "Platform commission" })} ({applyModal.commission}%)</span>
                                <span className="font-medium text-rose-600">
                                  -{formatMoney((parseFloat(parseFormattedNumber(customOneTimePrice)) * applyModal.commission) / 100)}
                                </span>
                              </div>
                              <div className="flex justify-between pb-2 border-b border-emerald-200">
                                <span className="font-medium text-emerald-800">{t("modelServices.youReceive", { defaultValue: "You receive" })}</span>
                                <span className="font-bold text-emerald-600">
                                  {formatMoney(calculateEarnings(parseFloat(parseFormattedNumber(customOneTimePrice)), applyModal.commission))}
                                </span>
                              </div>
                            </>
                          )}
                          {customOneNightPrice && parseFloat(parseFormattedNumber(customOneNightPrice)) > 0 && (
                            <>
                              <div className="flex justify-between text-gray-600 pt-2">
                                <span>{t("modelServices.oneNightPrice")} - {t("modelServices.customerPays", { defaultValue: "Customer pays" })}</span>
                                <span className="font-medium">{formatMoney(parseFloat(parseFormattedNumber(customOneNightPrice)))}</span>
                              </div>
                              <div className="flex justify-between text-gray-600">
                                <span>{t("modelServices.platformCommission", { defaultValue: "Platform commission" })} ({applyModal.commission}%)</span>
                                <span className="font-medium text-rose-600">
                                  -{formatMoney((parseFloat(parseFormattedNumber(customOneNightPrice)) * applyModal.commission) / 100)}
                                </span>
                              </div>
                              <div className="flex justify-between pt-2">
                                <span className="font-medium text-emerald-800">{t("modelServices.youReceive", { defaultValue: "You receive" })}</span>
                                <span className="font-bold text-emerald-600">
                                  {formatMoney(calculateEarnings(parseFloat(parseFormattedNumber(customOneNightPrice)), applyModal.commission))}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Per Minute - Custom minute rate (Call Service) */}
                {applyModal.billingType === "per_minute" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="customMinuteRate">
                        {t("modelServices.customMinuteRateLabel", { defaultValue: "Your rate per minute" })} <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Kip</span>
                        <input type="hidden" name="customMinuteRate" value={parseFormattedNumber(customMinuteRate)} />
                        <Input
                          id="customMinuteRate"
                          type="text"
                          inputMode="numeric"
                          value={customMinuteRate}
                          onChange={(e) => handlePriceChange(e.target.value, setCustomMinuteRate)}
                          required
                          className="pl-10"
                          placeholder={t("modelServices.enterMinuteRate", { defaultValue: "Enter rate per minute..." })}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        {t("modelServices.minuteRateHint", { defaultValue: "Set your rate for voice/video calls. Customers will be charged per minute." })}
                      </p>
                    </div>

                    {/* Earnings Breakdown */}
                    {customMinuteRate && parseFloat(parseFormattedNumber(customMinuteRate)) > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                        <h4 className="text-sm font-medium text-emerald-800">
                          {t("modelServices.earningsBreakdown", { defaultValue: "Your Earnings" })}
                        </h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between text-gray-600">
                            <span>{t("modelServices.customerPays", { defaultValue: "Customer pays" })}</span>
                            <span className="font-medium">{formatMoney(parseFloat(parseFormattedNumber(customMinuteRate)))}/{t("modelServices.minute", { defaultValue: "min" })}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>{t("modelServices.platformCommission", { defaultValue: "Platform commission" })} ({applyModal.commission}%)</span>
                            <span className="font-medium text-rose-600">
                              -{formatMoney((parseFloat(parseFormattedNumber(customMinuteRate)) * applyModal.commission) / 100)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-emerald-200">
                            <span className="font-medium text-emerald-800">{t("modelServices.youReceive", { defaultValue: "You receive" })}</span>
                            <span className="font-bold text-emerald-600">
                              {formatMoney(calculateEarnings(parseFloat(parseFormattedNumber(customMinuteRate)), applyModal.commission))}/{t("modelServices.minute", { defaultValue: "min" })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <DialogFooter className="flex flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setApplyModal(null)}
                    className="flex-1"
                  >
                    {t("modelServices.close")}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-rose-500 hover:bg-rose-600"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin mr-2" />
                        {t("modelServices.applying")}
                      </>
                    ) : (
                      t("modelServices.saveAndApply")
                    )}
                  </Button>
                </DialogFooter>
              </Form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editModal} onOpenChange={(open) => !open && setEditModal(null)}>
        <DialogContent className="sm:max-w-md py-6 px-3 sm:px-4">
          <DialogHeader>
            <DialogTitle className="text-md font-normal">{t("modelServices.editModal.title")}</DialogTitle>
          </DialogHeader>

          {editModal && (
            <>
              <Form method="post" className="space-y-4">
                <input type="hidden" name="serviceId" value={editModal.id} />
                <input type="hidden" name="serviceName" value={editModal.name} />
                <input type="hidden" name="modelServiceId" value={editModal.modelServiceId || ""} />
                <input type="hidden" name="actionType" value="edit" />
                <input type="hidden" name="billingType" value={editModal.billingType} />

                {/* Per Day - Custom daily rate */}
                {editModal.billingType === "per_day" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="editCustomRate">
                        {t("modelServices.customDailyRateLabel")} <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Kip</span>
                        <input type="hidden" name="customRate" value={parseFormattedNumber(customRate)} />
                        <Input
                          id="editCustomRate"
                          type="text"
                          inputMode="numeric"
                          value={customRate}
                          onChange={(e) => handlePriceChange(e.target.value, setCustomRate)}
                          required
                          className="pl-10"
                          placeholder={t("modelServices.enterYourDailyRate")}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        {t("modelServices.editModal.rateHint")}
                      </p>
                    </div>

                    {/* Earnings Breakdown */}
                    {customRate && parseFloat(parseFormattedNumber(customRate)) > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                        <h4 className="text-sm font-medium text-emerald-800">
                          {t("modelServices.earningsBreakdown", { defaultValue: "Your Earnings" })}
                        </h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between text-gray-600">
                            <span>{t("modelServices.customerPays", { defaultValue: "Customer pays" })}</span>
                            <span className="font-medium">{formatMoney(parseFloat(parseFormattedNumber(customRate)))}/{t("modelServices.day")}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>{t("modelServices.platformCommission", { defaultValue: "Platform commission" })} ({editModal.commission}%)</span>
                            <span className="font-medium text-rose-600">
                              -{formatMoney((parseFloat(parseFormattedNumber(customRate)) * editModal.commission) / 100)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-emerald-200">
                            <span className="font-medium text-emerald-800">{t("modelServices.youReceive", { defaultValue: "You receive" })}</span>
                            <span className="font-bold text-emerald-600">
                              {formatMoney(calculateEarnings(parseFloat(parseFormattedNumber(customRate)), editModal.commission))}/{t("modelServices.day")}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Per Hour - Custom hourly rate OR Massage variants */}
                {editModal.billingType === "per_hour" && (
                  <>
                    {editModal.name.toLowerCase() === "massage" ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">
                            {t("modelServices.massageTypes")} <span className="text-rose-500">*</span>
                          </Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={addMassageVariant}
                            className="h-7 text-xs border-rose-300 text-rose-600 hover:bg-rose-50"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            {t("modelServices.addType")}
                          </Button>
                        </div>

                        <input
                          type="hidden"
                          name="massageVariants"
                          value={JSON.stringify(massageVariants)}
                        />

                        <div className="space-y-2 max-h-60 overflow-y-scroll border rounded-md p-2">
                          {massageVariants.map((variant, index) => (
                            <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded-sm border">
                              <div className="flex-1 space-y-2">
                                <Input
                                  placeholder={t("modelServices.massageTypeName")}
                                  value={variant.name}
                                  onChange={(e) => updateMassageVariant(index, "name", e.target.value)}
                                  required
                                  className="text-sm"
                                />
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Kip</span>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder={t("modelServices.pricePerHour")}
                                    value={variant.pricePerHour ? formatNumberWithCommas(variant.pricePerHour) : ""}
                                    onChange={(e) => {
                                      const numericValue = e.target.value.replace(/[^0-9]/g, "");
                                      updateMassageVariant(index, "pricePerHour", parseFloat(numericValue) || 0);
                                    }}
                                    required
                                    className="pl-10 text-sm"
                                  />
                                </div>
                              </div>
                              {massageVariants.length > 1 && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeMassageVariant(index)}
                                  className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500">
                          {t("modelServices.massageVariantsHint")}
                        </p>

                        <div className="space-y-2 mt-4 pt-4 border-t">
                          <Label htmlFor="editServiceLocation">
                            {t("modelServices.serviceLocation")} <span className="text-rose-500">*</span>
                          </Label>
                          <Input
                            id="editServiceLocation"
                            name="serviceLocation"
                            value={serviceLocation}
                            onChange={(e) => setServiceLocation(e.target.value)}
                            required
                            placeholder={t("modelServices.serviceLocationPlaceholder")}
                            className="text-sm"
                          />
                          <p className="text-xs text-gray-500">
                            {t("modelServices.serviceLocationHint")}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="editCustomHourlyRate">
                            {t("modelServices.customHourlyRateLabel")} <span className="text-rose-500">*</span>
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Kip</span>
                            <input type="hidden" name="customHourlyRate" value={parseFormattedNumber(customHourlyRate)} />
                            <Input
                              id="editCustomHourlyRate"
                              type="text"
                              inputMode="numeric"
                              value={customHourlyRate}
                              onChange={(e) => handlePriceChange(e.target.value, setCustomHourlyRate)}
                              required
                              className="pl-10"
                              placeholder={t("modelServices.enterYourHourlyRate")}
                            />
                          </div>
                          <p className="text-xs text-gray-500">
                            {t("modelServices.hourlyRateHint")}
                          </p>
                        </div>

                        {/* Earnings Breakdown */}
                        {customHourlyRate && parseFloat(parseFormattedNumber(customHourlyRate)) > 0 && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                            <h4 className="text-sm font-medium text-emerald-800">
                              {t("modelServices.earningsBreakdown", { defaultValue: "Your Earnings" })}
                            </h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between text-gray-600">
                                <span>{t("modelServices.customerPays", { defaultValue: "Customer pays" })}</span>
                                <span className="font-medium">{formatMoney(parseFloat(parseFormattedNumber(customHourlyRate)))}/{t("modelServices.hour")}</span>
                              </div>
                              <div className="flex justify-between text-gray-600">
                                <span>{t("modelServices.platformCommission", { defaultValue: "Platform commission" })} ({editModal.commission}%)</span>
                                <span className="font-medium text-rose-600">
                                  -{formatMoney((parseFloat(parseFormattedNumber(customHourlyRate)) * editModal.commission) / 100)}
                                </span>
                              </div>
                              <div className="flex justify-between pt-2 border-t border-emerald-200">
                                <span className="font-medium text-emerald-800">{t("modelServices.youReceive", { defaultValue: "You receive" })}</span>
                                <span className="font-bold text-emerald-600">
                                  {formatMoney(calculateEarnings(parseFloat(parseFormattedNumber(customHourlyRate)), editModal.commission))}/{t("modelServices.hour")}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Per Session - Custom one time and one night prices */}
                {editModal.billingType === "per_session" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="editCustomOneTimePrice">
                        {t("modelServices.customOneTimePriceLabel")} <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Kip</span>
                        <input type="hidden" name="customOneTimePrice" value={parseFormattedNumber(customOneTimePrice)} />
                        <Input
                          id="editCustomOneTimePrice"
                          type="text"
                          inputMode="numeric"
                          value={customOneTimePrice}
                          onChange={(e) => handlePriceChange(e.target.value, setCustomOneTimePrice)}
                          required
                          className="pl-10"
                          placeholder={t("modelServices.enterOneTimePrice")}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        {t("modelServices.oneTimePriceHint")}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editCustomOneNightPrice">
                        {t("modelServices.customOneNightPriceLabel")} <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Kip</span>
                        <input type="hidden" name="customOneNightPrice" value={parseFormattedNumber(customOneNightPrice)} />
                        <Input
                          id="editCustomOneNightPrice"
                          type="text"
                          inputMode="numeric"
                          value={customOneNightPrice}
                          onChange={(e) => handlePriceChange(e.target.value, setCustomOneNightPrice)}
                          required
                          className="pl-10"
                          placeholder={t("modelServices.enterOneNightPrice")}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        {t("modelServices.oneNightPriceHint")}
                      </p>
                    </div>

                    {/* Earnings Breakdown */}
                    {(customOneTimePrice && parseFloat(parseFormattedNumber(customOneTimePrice)) > 0) || (customOneNightPrice && parseFloat(parseFormattedNumber(customOneNightPrice)) > 0) ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                        <h4 className="text-sm font-medium text-emerald-800">
                          {t("modelServices.earningsBreakdown", { defaultValue: "Your Earnings" })}
                        </h4>
                        <div className="space-y-1 text-sm">
                          {customOneTimePrice && parseFloat(parseFormattedNumber(customOneTimePrice)) > 0 && (
                            <>
                              <div className="flex justify-between text-gray-600">
                                <span>{t("modelServices.oneTimePrice")} - {t("modelServices.customerPays", { defaultValue: "Customer pays" })}</span>
                                <span className="font-medium">{formatMoney(parseFloat(parseFormattedNumber(customOneTimePrice)))}</span>
                              </div>
                              <div className="flex justify-between text-gray-600">
                                <span>{t("modelServices.platformCommission", { defaultValue: "Platform commission" })} ({editModal.commission}%)</span>
                                <span className="font-medium text-rose-600">
                                  -{formatMoney((parseFloat(parseFormattedNumber(customOneTimePrice)) * editModal.commission) / 100)}
                                </span>
                              </div>
                              <div className="flex justify-between pb-2 border-b border-emerald-200">
                                <span className="font-medium text-emerald-800">{t("modelServices.youReceive", { defaultValue: "You receive" })}</span>
                                <span className="font-bold text-emerald-600">
                                  {formatMoney(calculateEarnings(parseFloat(parseFormattedNumber(customOneTimePrice)), editModal.commission))}
                                </span>
                              </div>
                            </>
                          )}
                          {customOneNightPrice && parseFloat(parseFormattedNumber(customOneNightPrice)) > 0 && (
                            <>
                              <div className="flex justify-between text-gray-600 pt-2">
                                <span>{t("modelServices.oneNightPrice")} - {t("modelServices.customerPays", { defaultValue: "Customer pays" })}</span>
                                <span className="font-medium">{formatMoney(parseFloat(parseFormattedNumber(customOneNightPrice)))}</span>
                              </div>
                              <div className="flex justify-between text-gray-600">
                                <span>{t("modelServices.platformCommission", { defaultValue: "Platform commission" })} ({editModal.commission}%)</span>
                                <span className="font-medium text-rose-600">
                                  -{formatMoney((parseFloat(parseFormattedNumber(customOneNightPrice)) * editModal.commission) / 100)}
                                </span>
                              </div>
                              <div className="flex justify-between pt-2">
                                <span className="font-medium text-emerald-800">{t("modelServices.youReceive", { defaultValue: "You receive" })}</span>
                                <span className="font-bold text-emerald-600">
                                  {formatMoney(calculateEarnings(parseFloat(parseFormattedNumber(customOneNightPrice)), editModal.commission))}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Per Minute - Custom minute rate (Call Service) */}
                {editModal.billingType === "per_minute" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="editCustomMinuteRate">
                        {t("modelServices.customMinuteRateLabel", { defaultValue: "Your rate per minute" })} <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Kip</span>
                        <input type="hidden" name="customMinuteRate" value={parseFormattedNumber(customMinuteRate)} />
                        <Input
                          id="editCustomMinuteRate"
                          type="text"
                          inputMode="numeric"
                          value={customMinuteRate}
                          onChange={(e) => handlePriceChange(e.target.value, setCustomMinuteRate)}
                          required
                          className="pl-10"
                          placeholder={t("modelServices.enterMinuteRate", { defaultValue: "Enter rate per minute..." })}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        {t("modelServices.minuteRateHint", { defaultValue: "Set your rate for voice/video calls. Customers will be charged per minute." })}
                      </p>
                    </div>

                    {/* Earnings Breakdown */}
                    {customMinuteRate && parseFloat(parseFormattedNumber(customMinuteRate)) > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                        <h4 className="text-sm font-medium text-emerald-800">
                          {t("modelServices.earningsBreakdown", { defaultValue: "Your Earnings" })}
                        </h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between text-gray-600">
                            <span>{t("modelServices.customerPays", { defaultValue: "Customer pays" })}</span>
                            <span className="font-medium">{formatMoney(parseFloat(parseFormattedNumber(customMinuteRate)))}/{t("modelServices.minute", { defaultValue: "min" })}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>{t("modelServices.platformCommission", { defaultValue: "Platform commission" })} ({editModal.commission}%)</span>
                            <span className="font-medium text-rose-600">
                              -{formatMoney((parseFloat(parseFormattedNumber(customMinuteRate)) * editModal.commission) / 100)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-emerald-200">
                            <span className="font-medium text-emerald-800">{t("modelServices.youReceive", { defaultValue: "You receive" })}</span>
                            <span className="font-bold text-emerald-600">
                              {formatMoney(calculateEarnings(parseFloat(parseFormattedNumber(customMinuteRate)), editModal.commission))}/{t("modelServices.minute", { defaultValue: "min" })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <DialogFooter className="flex flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditModal(null)}
                    className="flex-1"
                  >
                    {t("modelServices.close")}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-rose-500 hover:bg-rose-600"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin mr-2" />
                        {t("modelServices.updating")}
                      </>
                    ) : (
                      t("modelServices.updateRate")
                    )}
                  </Button>
                </DialogFooter>
              </Form>
            </>
          )}
        </DialogContent>
      </Dialog >

      {/* Cancel Confirmation Modal */}
      <Dialog open={!!cancelModal
      } onOpenChange={(open) => !open && setCancelModal(null)}>
        <DialogContent className="sm:max-w-md px-3 sm:px-4">
          <DialogHeader>
            <DialogTitle className="text-md font-normal">{t("modelServices.cancelModal.title")}</DialogTitle>
          </DialogHeader>

          {cancelModal && (
            <>
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-sm p-4">
                  <p className="text-xs text-red-600">
                    {t("modelServices.cancelModal.confirmMessage", { name: getServiceName(cancelModal.name) })}
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  {t("modelServices.cancelModal.warning")}
                </p>
              </div>

              <Form method="post">
                <input type="hidden" name="serviceId" value={cancelModal.id} />
                <input type="hidden" name="actionType" value="cancel" />

                <DialogFooter className="flex flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCancelModal(null)}
                    className="flex-1"
                  >
                    {t("modelServices.cancelModal.keepService")}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin mr-2" />
                        {t("modelServices.canceling")}
                      </>
                    ) : (
                      t("modelServices.cancelModal.confirmCancel")
                    )}
                  </Button>
                </DialogFooter>
              </Form>
            </>
          )}
        </DialogContent>
      </Dialog >
    </div >
  );
}
