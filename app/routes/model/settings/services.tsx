import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Briefcase, Check, Loader, SquarePen, Trash2 } from "lucide-react";
import { Form, useLoaderData, useNavigation, redirect } from "react-router";
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

export const meta: MetaFunction = () => {
  return [
    { title: "Services - Model Settings" },
    { name: "description", content: "Manage your service offerings" },
  ];
};

interface Service {
  id: string;
  name: string;
  description: string | null;
  baseRate: number;
  commission: number;
  status: string;
  isApplied: boolean;
  modelServiceId: string | null;
  customRate: number | null;
  isAvailable: boolean;
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
  const actionType = formData.get("actionType") as string;

  if (actionType === "apply") {
    const customRate = parseFloat(formData.get("customRate") as string);
    const result = await applyForService(modelId, serviceId, customRate);
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
    const customRate = parseFloat(formData.get("customRate") as string);
    const modelServiceId = formData.get("modelServiceId") as string;
    const result = await updateServiceApplication(
      modelId,
      serviceId,
      modelServiceId,
      customRate
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

  const [customRate, setCustomRate] = useState<string>("");
  const [applyModal, setApplyModal] = useState<Service | null>(null);
  const [editModal, setEditModal] = useState<Service | null>(null);
  const [cancelModal, setCancelModal] = useState<Service | null>(null);

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
    <div className="p-2 sm:p-4 lg:p-0">
      <div className="mb-6 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-lg">
            <Briefcase className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <h1 className="text-md">
              {t("modelServices.title")}
            </h1>
            <p className="text-sm text-gray-600">{t("modelServices.subtitle")}</p>
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
              {/* Icon buttons - sticky top right */}
              {service.isApplied && (
                <div className="absolute top-2 right-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCancelModal(service)}
                    className="p-1.5 rounded-full bg-white border border-gray-300 text-gray-500 hover:bg-gray-500 hover:text-white transition-colors shadow-sm"
                    title={t("modelServices.cancel")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditModal(service);
                      setCustomRate(service.customRate?.toString() || service.baseRate.toString());
                    }}
                    className="p-1.5 rounded-full bg-white border border-rose-300 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors shadow-sm"
                    title={t("modelServices.edit")}
                  >
                    <SquarePen className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className={`px-4 ${service.isApplied ? "text-rose-500" : ""}`}>
                <div className="flex items-center justify-start gap-4">
                  <h3 className={`text-md mb-1 text-rose-500}`}>
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
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {getServiceDescription(service.name, service.description)}
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{t("modelServices.baseRate")}</span>
                    <span className="font-semibold text-gray-900 flex items-center gap-1">
                      {formatMoney(service.baseRate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{t("modelServices.commission")}</span>
                    <span className="font-semibold text-rose-600">
                      {service.commission}%
                    </span>
                  </div>
                  {service.isApplied && service.customRate && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t">
                      <span className="text-gray-600">{t("modelServices.yourRate")}</span>
                      <span className="font-bold text-rose-600 flex items-center gap-1">
                        {formatMoney(service.customRate)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Apply button - only shown when not applied */}
                {!service.isApplied && (
                  <div className="w-full flex items-center justify-center my-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setApplyModal(service);
                        setCustomRate(service.baseRate.toString());
                      }}
                      className="w-full border-rose-300 text-rose-500 hover:bg-rose-500 hover:text-white"
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-md font-normal">{t("modelServices.applyModal.title")}</DialogTitle>
          </DialogHeader>

          {applyModal && (
            <>
              <div className="mb-4 p-4 bg-rose-50 rounded-sm">
                <h3 className="font-semibold text-rose-600 mb-2">{getServiceName(applyModal.name)}</h3>
                <p className="text-sm text-gray-700 mb-3">
                  {getServiceDescription(applyModal.name, applyModal.description)}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t("modelServices.baseRate")}</span>
                    <span className="font-semibold flex items-center gap-1">
                      {formatMoney(applyModal.baseRate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t("modelServices.commission")}</span>
                    <span className="font-semibold text-rose-600">
                      {applyModal.commission}%
                    </span>
                  </div>
                </div>
              </div>

              <Form method="post" className="space-y-4">
                <input type="hidden" name="serviceId" value={applyModal.id} />
                <input type="hidden" name="actionType" value="apply" />

                <div className="space-y-2">
                  <Label htmlFor="customRate">
                    {t("modelServices.customRateLabel")} <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Kip</span>
                    <Input
                      id="customRate"
                      type="number"
                      name="customRate"
                      value={customRate}
                      onChange={(e) => setCustomRate(e.target.value)}
                      step="0.01"
                      min="0"
                      required
                      className="pl-10"
                      placeholder={t("modelServices.enterYourRate")}
                    />
                  </div>
                </div>

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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-md font-normal">{t("modelServices.editModal.title")}</DialogTitle>
          </DialogHeader>

          {editModal && (
            <>
              <div className="mb-4 p-4 bg-rose-50 rounded-sm">
                <h3 className="font-semibold text-rose-600 mb-2">{getServiceName(editModal.name)}</h3>
                <p className="text-sm text-gray-700 mb-3">
                  {getServiceDescription(editModal.name, editModal.description)}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t("modelServices.baseRate")}</span>
                    <span className="font-semibold flex items-center gap-1">
                      {formatMoney(editModal.baseRate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t("modelServices.commission")}</span>
                    <span className="font-semibold text-rose-600">
                      {editModal.commission}%
                    </span>
                  </div>
                </div>
              </div>

              <Form method="post" className="space-y-4">
                <input type="hidden" name="serviceId" value={editModal.id} />
                <input type="hidden" name="modelServiceId" value={editModal.modelServiceId || ""} />
                <input type="hidden" name="actionType" value="edit" />

                <div className="space-y-2">
                  <Label htmlFor="editCustomRate">
                    {t("modelServices.customRateLabel")} <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Kip</span>
                    <Input
                      id="editCustomRate"
                      type="number"
                      name="customRate"
                      value={customRate}
                      onChange={(e) => setCustomRate(e.target.value)}
                      step="0.01"
                      min="0"
                      required
                      className="pl-10"
                      placeholder={t("modelServices.enterYourRate")}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {t("modelServices.editModal.rateHint")}
                  </p>
                </div>

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
      </Dialog>

      {/* Cancel Confirmation Modal */}
      <Dialog open={!!cancelModal} onOpenChange={(open) => !open && setCancelModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-md font-normal">{t("modelServices.cancelModal.title")}</DialogTitle>
          </DialogHeader>

          {cancelModal && (
            <>
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-sm p-4">
                  <p className="text-sm text-red-600">
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
      </Dialog>
    </div>
  );
}
