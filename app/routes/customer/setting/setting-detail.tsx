import React from "react";
import { useTranslation } from "react-i18next";
import { Form, redirect, useActionData, useNavigate, useNavigation, useSearchParams, type LoaderFunction } from "react-router";
import { AlertCircle, ArrowLeft, Bell, Eye, EyeOff, Flag, Globe, Loader, Lock, Moon, Shield, Sun, Trash2, User } from "lucide-react";

// component
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import LanguageSwitcher from "~/components/LanguageSwitcher";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

// service and interface
import type { Route } from "./+types/setting-detail";
import { capitalize } from "~/utils/functions/textFormat";
import { requireUserSession } from "~/services/auths.server";
import type { ICustomerCredentials, ICustomerResponse, ICustomerSettingCredentials } from "~/interfaces/customer";
import { changeCustomerPassword, createReport, deleteAccount, getCustomerProfile, updateCustomerSetting, updateProfile } from "~/services/profile.server";

type NotificationType = "email" | "push" | "sms";

interface LoaderReturn {
   customerData: ICustomerResponse;
   tab: string;
}

interface TransactionProps {
   loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ params, request }) => {
   const tab = params.tab;
   const customerId = await requireUserSession(request)
   const customerData = await getCustomerProfile(customerId)

   return { customerData, tab }
}

export async function action({ request }: Route.ActionArgs) {
   const customerId = await requireUserSession(request)
   const formData = await request.formData()
   const data = Object.fromEntries(formData)
   const customerData = Object.fromEntries(formData) as Partial<ICustomerCredentials>
   const customerSettingData: ICustomerSettingCredentials = {
      twofactorEnabled: formData.get("twofactorEnabled") === "true",
      defaultLanguage: formData.get("defaultLanguage") as string,
      defaultTheme: formData.get("defaultTheme") as string,
      notifications_email: formData.get("notifications_email") === "true",
      notifications_push: formData.get("notifications_push") === "true",
      notifications_sms: formData.get("notifications_sms") === "true",
   };

   if (request.method === "PATCH") {
      try {
         if (data.currectAction === "isbasic") {
            const res = await updateProfile(customerId, customerData as ICustomerCredentials);
            if (res.id) {
               return redirect("/customer/setting?toastMessage=Update+basic+information+successfully!&toastType=success");
            }
         } else if (data.currectAction === "ispassword") {
            if (!data.old_password) {
               return { success: false, error: true, message: "Please enter old password!", showError: data.currectAction };
            } else if (data.new_password !== data.con_new_password) {
               return { success: false, error: true, message: "The new password not match. Check and try again!", showError: data.currectAction };
            } else {
               const res = await changeCustomerPassword(customerId, data.old_password as string, data.new_password as string)
               if (res.id) {
                  console.log("Change password success!!")
                  return redirect("/customer/setting?toastMessage=Change+password+successfully!&toastType=success");
               }
            }
         } else if (data.currectAction === "defaultLanguage") {
            const res = await updateCustomerSetting(
               customerId,
               customerSettingData as ICustomerSettingCredentials
            )
            if (res.id) {
               console.log("Update customer profile setting [language] successful!")
               return redirect("/customer/setting?toastMessage=Update+customer+default+language+successful!&toastType=success");
            }
         } else if (data.currectAction === "defaultTheme") {
            const res = await updateCustomerSetting(
               customerId,
               customerSettingData as ICustomerSettingCredentials
            )
            if (res.id) {
               console.log("Update customer profile setting [theme] successful!")
               return redirect("/customer/setting?toastMessage=Update+customer+default+theme+successful!&toastType=success");
            }
         } else if (data.currectAction === "notifications") {
            const res = await updateCustomerSetting(
               customerId,
               customerSettingData as ICustomerSettingCredentials
            )
            if (res.id) {
               console.log("Update customer profile setting notification successful!")
               return redirect("/customer/setting?toastMessage=Update+profile+setting+notification+successful!&toastType=success");
            }
         } else if (data.currectAction === "twoFactorAuthentication") {
            const res = await updateCustomerSetting(
               customerId,
               customerSettingData as ICustomerSettingCredentials
            )
            if (res.id) {
               console.log("Update customer profile setting notification successful!")
               return redirect("/customer/setting?toastMessage=Two+Factor+Authenticaton+is+enabled+successful!&toastType=success");
            }
         } else {
            return {
               success: false,
               error: true,
               message: "Failed to process. Try again later!",
               showError: data.currectAction
            };
         }
      } catch (error: any) {
         if (error?.payload) {
            return {
               success: error.payload.success,
               error: error.payload.error,
               message: error.payload.message,
               showError: data.currectAction
            };
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
                  showError: data.currectAction
               };
            }
         }

         return {
            success: false,
            error: true,
            message: error || "Failed to process. Try again later!",
            showError: data.currectAction
         };
      }
   }

   if (request.method === "POST") {
      try {
         if (data.currectAction === "report") {
            console.log("AABB::", data.type as string, data.title as string, data.description as string)
            const res = await createReport(customerId, data.type as string, data.title as string, data.description as string);
            if (res.id) {
               return redirect("/customer/setting?toastMessage=Submit+Report+successful!++Thank+you.&toastType=success");
            }
         }
      } catch (error: any) {
         console.error("Error to report:", error);

         if (error?.payload) {
            console.log("Payload:", error.payload);
            return {
               success: error.payload.success,
               error: error.payload.error,
               message: error.payload.message,
               showError: data.currectAction
            };
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
                  showError: data.currectAction
               };
            }
         }

         return {
            success: false,
            error: true,
            message: error || "Failed to process. Try again later!",
            showError: data.currectAction
         };
      }
   }

   if (request.method === "DELETE") {
      try {
         const res = await deleteAccount(customerId);
         if (res.id) {
            return redirect("/login?toastMessage=Your+account+was+deleted+succesful!&toastType=success");
         }
      } catch (error: any) {
         console.error("Error to delete account:", error);

         if (error?.payload) {
            console.log("Payload:", error.payload);
            return {
               success: error.payload.success,
               error: error.payload.error,
               message: error.payload.message,
               showError: data.currectAction
            };
         }
         return {
            success: false,
            error: true,
            message: error || "Failed to process. Try again later!",
            showError: data.currectAction
         };
      }
   }

   return { success: false, error: true, message: "Invalid request method!" };
}

export default function SettingPage({ loaderData }: TransactionProps) {
   const { t } = useTranslation();
   const tab = loaderData.tab
   const { customerData } = loaderData;
   const navigate = useNavigate()
   const navigation = useNavigation()
   const [searchParams] = useSearchParams();

   const actionData = useActionData<typeof action>()
   const isSubmitting =
      navigation.state !== "idle" && navigation.formMethod === "PATCH"
   const isCreating =
      navigation.state !== "idle" && navigation.formMethod === "POST"
   const isDeleting =
      navigation.state !== "idle" && navigation.formMethod === "DELETE"
   const toastMessage = searchParams.get("toastMessage");
   const toastType = searchParams.get("toastType");

   const showToast = (message: string, type: "success" | "error" | "warning" = "success", duration = 3000) => {
      searchParams.set("toastMessage", message);
      searchParams.set("toastType", type);
      searchParams.set("toastDuration", String(duration));
      navigate({ search: searchParams.toString() }, { replace: true });
   };

   React.useEffect(() => {
      if (toastMessage) {
         showToast(toastMessage, toastType as any);
      }
   }, [toastMessage, toastType]);

   const [darkMode, setDarkMode] = React.useState(customerData.defaultTheme === "dark");
   const [deleteAccount, setDeleteAccount] = React.useState("");
   const [showPassword, setShowPassword] = React.useState(false)
   const [showNewPassword, setShowNewPassword] = React.useState(false)
   const [showConNewPassword, setShowConNewPassword] = React.useState(false)
   const [notifications, setNotifications] = React.useState({
      email: customerData.sendMailNoti,
      push: customerData.sendPushNoti,
      sms: customerData.sendSMSNoti,
   });

   const handleNotificationChange = (type: NotificationType) => {
      setNotifications((prev) => ({
         ...prev,
         [type]: !prev[type],
      }));
   };

   if (isSubmitting || isCreating || isDeleting) {
      return (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="flex items-center justify-center bg-white p-6 rounded-xl shadow-md gap-2">
               {isSubmitting ? <Loader className="w-4 h-4 animate-spin" /> : ""}
               <p className="text-gray-600">{t('profile.processing')}</p>
            </div>
         </div>
      );
   }

   return (
      <>
         <div className="w-full py-6 px-4 h-full overflow-y-auto"
            style={{
               msOverflowStyle: 'none',
               scrollbarWidth: 'none',
            }}
         >
            <div className="space-y-12">
               {tab === "basic" &&
                  <div>
                     {actionData?.error && actionData.showError === "isbasic" &&
                        <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                           <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                           <span className="text-red-500 text-sm">
                              {capitalize(actionData.message)}
                           </span>
                        </div>
                     }

                     <Form method="patch" className="space-y-4">
                        <button type="button" onClick={() => navigate("/customer/setting")} className="text-gray-500 flex items-center justify-center mb-6">
                           <ArrowLeft className="text-gray-500" size={18} />&nbsp;{t('settings.common.back')}
                        </button>
                        <section id="basic" className="scroll-mt-6 space-y-2">
                           <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                              <User className="text-rose-500" size={20} />
                              {t('settings.basic.title')}
                           </h3>
                           <input type="text" name="profile" defaultValue={customerData.profile} className="hidden" />
                           <input type="hidden" name="currectAction" defaultValue="isbasic" />
                           <input
                              type="text"
                              name="interest"
                              defaultValue={
                                 customerData.interests ? Object.values(customerData.interests).join(", ") : ""
                              }
                              className="hidden"
                           />

                           <div className="space-y-2">
                              <div>
                                 <Label htmlFor="whatsapp" className="text-gray-500 text-sm">
                                    {t('settings.basic.firstName')} <span className="text-rose-500">*</span>
                                 </Label>
                                 <Input
                                    required
                                    id="first_name"
                                    type="text"
                                    name="firstName"
                                    defaultValue={customerData.firstName}
                                    placeholder={t('settings.basic.firstNamePlaceholder')}
                                    className="text-sm mt-1 border-gray-200 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                 />
                              </div>
                              <div>
                                 <Label htmlFor="whatsapp" className="text-gray-500 text-sm">
                                    {t('settings.basic.lastName')} <span className="text-rose-500">*</span>
                                 </Label>
                                 <Input
                                    required
                                    id="last_name"
                                    type="text"
                                    name="lastName"
                                    defaultValue={customerData.lastName}
                                    placeholder={t('settings.basic.lastNamePlaceholder')}
                                    className="text-sm mt-1 border-gray-200 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                 />
                              </div>
                              <div className="gap-2 sm:gap-4">
                                 <Label htmlFor="dob" className="text-gray-500 text-sm">
                                    {t('settings.basic.dob')}<span className="text-rose-500">*</span>
                                 </Label>
                                 <div className="relative">
                                    <Input
                                       required
                                       id="dob"
                                       type="date"
                                       name="dob"
                                       defaultValue={new Date(customerData.dob).toISOString().split("T")[0]}
                                       className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                       style={{ colorScheme: 'light' }}
                                    />
                                 </div>
                              </div>
                              <div className="gap-2 sm:gap-4">
                                 <Label htmlFor="dob" className="text-gray-500 text-sm mb-1">
                                    {t('settings.basic.gender')}<span className="text-rose-500">*</span>
                                 </Label>
                                 <Select name="gender" required defaultValue={customerData.gender}>
                                    <SelectTrigger className="bg-background rounded-md h-14 text-foreground font-medium px-6 w-full">
                                       <SelectValue placeholder={t('settings.basic.selectGender')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                       <SelectItem value="male">{t('settings.basic.male')}</SelectItem>
                                       <SelectItem value="female">{t('settings.basic.female')}</SelectItem>
                                       <SelectItem value="other">{t('settings.basic.other')}</SelectItem>
                                    </SelectContent>
                                 </Select>
                              </div>
                              <div className="gap-2 sm:gap-4">
                                 <Label htmlFor="dob" className="text-gray-500 text-sm mb-1">
                                    {t('settings.basic.relationshipStatus')}<span className="text-rose-500">*</span>
                                 </Label>
                                 <Select name="relationship_status" required defaultValue={customerData.relationshipStatus ?? "single"}>
                                    <SelectTrigger className="bg-background rounded-md h-14 text-foreground font-medium px-6 w-full">
                                       <SelectValue placeholder={t('settings.basic.selectRelationshipStatus')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                       <SelectItem value="Single">{t('settings.basic.single')}</SelectItem>
                                       <SelectItem value="Married">{t('settings.basic.married')}</SelectItem>
                                       <SelectItem value="Relationship">{t('settings.basic.inARelationship')}</SelectItem>
                                       <SelectItem value="Divorced">{t('settings.basic.divorced')}</SelectItem>
                                       <SelectItem value="Widowed">{t('settings.basic.widowed')}</SelectItem>
                                    </SelectContent>
                                 </Select>
                              </div>
                              <div className="gap-2 sm:gap-4">
                                 <Label htmlFor="whatsapp" className="text-gray-500 text-sm">
                                    {t('settings.basic.whatsapp')}<span className="text-rose-500">*</span>
                                 </Label>
                                 <Input
                                    required
                                    id="whatsapp"
                                    type="number"
                                    name="whatsapp"
                                    defaultValue={customerData.whatsapp}
                                    placeholder={t('settings.basic.whatsappPlaceholder')}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                 />
                              </div>
                              <div className="gap-2 sm:gap-4">
                                 <Label htmlFor="bio" className="text-gray-500 text-sm">
                                    {t('settings.basic.bio')}
                                 </Label>
                                 <Input
                                    id="bio"
                                    type="text"
                                    name="bio"
                                    defaultValue={customerData.bio || ""}
                                    placeholder={t('settings.basic.bioPlaceholder')}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                 />
                              </div>
                              <div className="gap-2 sm:gap-4">
                                 <Label htmlFor="career" className="text-gray-500 text-sm">
                                    {t('settings.basic.career')}
                                 </Label>
                                 <Input
                                    id="career"
                                    type="text"
                                    name="career"
                                    defaultValue={customerData.career || ""}
                                    placeholder={t('settings.basic.careerPlaceholder')}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                 />
                              </div>
                              <div className="gap-2 sm:gap-4">
                                 <Label htmlFor="education" className="text-gray-500 text-sm">
                                    {t('settings.basic.education')}
                                 </Label>
                                 <Input
                                    id="education"
                                    type="text"
                                    name="education"
                                    defaultValue={customerData.education || ""}
                                    placeholder={t('settings.basic.educationPlaceholder')}
                                    className="text-sm mt-1 border-gray-200 text-gray-700 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                 />
                              </div>
                              <div className="flex items-center justify-end">
                                 <Button
                                    type="submit"
                                    className="cursor-pointer text-sm bg-rose-100 hover:bg-rose-200 hover:bg-rose-200 border border-rose-300 text-rose-500 hover:text-rose-600 font-medium"
                                 >
                                    {t('settings.basic.saveChange')}
                                 </Button>
                              </div>
                           </div>
                        </section>
                     </Form>
                  </div>
               }

               {tab === "password" &&
                  <div>
                     {actionData?.error && actionData.showError === "ispassword" &&
                        <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                           <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                           <span className="text-red-500 text-sm">
                              {capitalize(actionData.message)}
                           </span>
                        </div>
                     }
                     <Form method="patch" className="space-y-4">
                        <button type="button" onClick={() => navigate("/customer/setting")} className="text-gray-500 flex items-center justify-center mb-6">
                           <ArrowLeft className="text-gray-500" size={18} />&nbsp;{t('settings.common.back')}
                        </button>
                        <section id="password" className="scroll-mt-6 space-y-2">
                           <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                              <Lock className="text-rose-500" size={20} />
                              {t('settings.password.title')}
                           </h3>
                           <input type="text" name="currectAction" defaultValue={"ispassword"} className="hidden" />
                           <div className="space-y-4 mt-4">
                              <div>
                                 <Label htmlFor="password" className="text-gray-500 text-sm">
                                    {t('settings.password.oldPassword')} <span className="text-rose-500">*</span>
                                 </Label>
                                 <div className="relative mt-1">
                                    <Input
                                       required
                                       id="old_password"
                                       type={showPassword ? "text" : "password"}
                                       name="old_password"
                                       placeholder="************"
                                       className="border-gray-300 text-gray-500 placeholder-gray-400 focus:border-rose-500 pr-10 backdrop-blur-sm"
                                    />
                                    <button
                                       type="button"
                                       onClick={() => setShowPassword(!showPassword)}
                                       className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                    >
                                       {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                 </div>
                              </div>

                              <div>
                                 <Label htmlFor="password" className="text-gray-500 text-sm">
                                    {t('settings.password.newPassword')} <span className="text-rose-500">*</span>
                                 </Label>
                                 <div className="relative mt-1">
                                    <Input
                                       required
                                       id="new_password"
                                       type={showNewPassword ? "text" : "password"}
                                       name="new_password"
                                       placeholder="************"
                                       className="border-gray-300 text-gray-500 placeholder-gray-400 focus:border-rose-500 pr-10 backdrop-blur-sm"
                                    />
                                    <button
                                       type="button"
                                       onClick={() => setShowNewPassword(!showNewPassword)}
                                       className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                    >
                                       {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                 </div>
                              </div>

                              <div>
                                 <Label htmlFor="password" className="text-gray-500 text-sm">
                                    {t('settings.password.confirmNewPassword')} <span className="text-rose-500">*</span>
                                 </Label>
                                 <div className="relative mt-1">
                                    <Input
                                       required
                                       id="con_new_password"
                                       type={showConNewPassword ? "text" : "password"}
                                       name="con_new_password"
                                       placeholder="************"
                                       className="border-gray-300 text-gray-500 placeholder-gray-400 focus:border-rose-500 pr-10 backdrop-blur-sm"
                                    />
                                    <button
                                       type="button"
                                       onClick={() => setShowConNewPassword(!showConNewPassword)}
                                       className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                    >
                                       {showConNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                 </div>
                              </div>
                              <div className="flex items-center justify-end">
                                 <Button
                                    type="submit"
                                    className="cursor-pointer text-sm bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-500 hover:text-rose-600 font-medium"
                                 >
                                    {t('settings.basic.saveChange')}
                                 </Button>
                              </div>
                           </div>
                        </section>
                     </Form>
                  </div>
               }

               {/* {tab === "twofa" &&
                  <div>
                     {actionData?.error && actionData.showError === "twoFactorAuthentication" &&
                        <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                           <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                           <span className="text-red-500 text-sm">
                              {capitalize(actionData.message)}
                           </span>
                        </div>
                     }
                     <Form method="patch" className="space-y-4">
                        <button type="button" onClick={() => navigate("/customer/setting")} className="text-gray-500 flex items-center justify-center mb-6">
                           <ArrowLeft className="text-gray-500" size={18} />&nbsp;{t('settings.common.back')}
                        </button>
                        <section id="twofa" className="scroll-mt-6 space-y-3">
                           <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                              <Shield className="text-rose-500" size={20} />
                              {t('settings.twofa.title')}
                           </h3>

                           <input
                              type="hidden"
                              name="currectAction"
                              defaultValue="twoFactorAuthentication"
                           />
                           <input type="hidden" name="defaultLanguage" defaultValue={customerData.defaultLanguage} />
                           <input type="hidden" name="defaultTheme" defaultValue={customerData.defaultTheme} />
                           <input type="hidden" name="emailNotification" defaultValue={String(customerData.sendMailNoti)} />
                           <input type="hidden" name="pushNotification" defaultValue={String(customerData.sendPushNoti)} />
                           <input type="hidden" name="smsNotification" defaultValue={String(customerData.sendSMSNoti)} />
                           <input type="hidden" name="twofactorEnabled" value={String(customerData.twofactorEnabled ? false : true)} />

                           <div className="space-y-4">
                              <div className="p-4 border border-gray-200 rounded-lg">
                                 <h4 className="text-sm font-medium text-gray-800 mb-2">
                                    {t('settings.twofa.setupTitle')}
                                 </h4>
                                 <ol className="ml-2 space-y-2 text-sm text-gray-700">
                                    <li>
                                       - {t('settings.twofa.instruction1')}
                                    </li>
                                    <li>
                                       - {t('settings.twofa.instruction2')}
                                    </li>
                                 </ol>
                              </div>
                           </div>

                           <div className="flex items-center justify-end">
                              <Button
                                 type="submit"
                                 className="cursor-pointer text-sm bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-500 hover:text-rose-600 font-medium"
                              >
                                 {customerData.twofactorEnabled ? t('settings.twofa.disable') : t('settings.twofa.enable')}
                              </Button>
                           </div>
                        </section>
                     </Form>
                  </div>
               } */}

               {tab === "notification" &&
                  <div>
                     {actionData?.error && actionData.showError === "defaultLanguage" &&
                        <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                           <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                           <span className="text-red-500 text-sm">
                              {capitalize(actionData.message)}
                           </span>
                        </div>
                     }
                     <Form method="patch" className="space-y-4">
                        <button type="button" onClick={() => navigate("/customer/setting")} className="text-gray-500 flex items-center justify-center mb-6">
                           <ArrowLeft className="text-gray-500" size={18} />&nbsp;{t('settings.common.back')}
                        </button>
                        <section id="notification" className="scroll-mt-6 space-y-2">
                           <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                              <Bell className="text-rose-500" size={20} />
                              {t('settings.notification.title')}
                           </h3>
                           <input
                              type="hidden"
                              name="currectAction"
                              defaultValue="notifications"
                           />
                           <input type="hidden" name="defaultLanguage" defaultValue={customerData.defaultLanguage} />
                           <input type="hidden" name="defaultTheme" defaultValue={customerData.defaultTheme} />
                           <input type="hidden" name="twofactorEnabled" value={String(customerData.twofactorEnabled)} />
                           {Object.entries(notifications).map(([type, enabled]) => (
                              <input
                                 key={type}
                                 type="hidden"
                                 name={`notifications_${type}`}
                                 value={enabled ? "true" : "false"}
                              />
                           ))}

                           <div className="space-y-4">
                              {Object.entries(notifications).map(([type, enabled]) => (
                                 <div
                                    key={type}
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                                 >
                                    <div>
                                       <h4 className="text-sm font-medium text-gray-800 capitalize">
                                          {t(`settings.notification.${type}Title`)}
                                       </h4>
                                       <p className="text-sm text-gray-600">
                                          {t(`settings.notification.${type}Description`)}
                                       </p>
                                    </div>
                                    <button
                                       type="button"
                                       onClick={() => handleNotificationChange(type as NotificationType)}
                                       className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-rose-500" : "bg-gray-300"
                                          }`}
                                    >
                                       <span
                                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"
                                             }`}
                                       />
                                    </button>
                                 </div>
                              ))}
                           </div>
                        </section>
                        <div className="flex items-center justify-end">
                           <Button
                              type="submit"
                              className="cursor-pointer text-sm bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-500 hover:text-rose-600 font-medium"
                           >
                              {t('settings.basic.saveChange')}
                           </Button>
                        </div>
                     </Form>
                  </div>
               }

               {tab === "language" &&
                  <div>
                     <button type="button" onClick={() => navigate("/customer/setting")} className="text-gray-500 flex items-center justify-center mb-6">
                        <ArrowLeft className="text-gray-500" size={18} />&nbsp;{t('settings.common.back')}
                     </button>
                     <section id="language" className="scroll-mt-6 space-y-4 mt-4">
                        <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                           <Globe className="text-rose-500" size={20} />
                           {t('settings.language.title')}
                        </h3>
                        <div className="space-y-4">
                           <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.language.selectLanguage')}</label>
                              <LanguageSwitcher />
                           </div>
                        </div>
                     </section>
                  </div>
                  // <div>
                  // {actionData?.error && actionData.showError === "defaultLanguage" &&
                  //    <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                  //       <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  //       <span className="text-red-500 text-sm">
                  //          {capitalize(actionData.message)}
                  //       </span>
                  //    </div>
                  // }
                  //    <Form method="patch" className="space-y-4">
                  //       <button type="button" onClick={() => navigate("/customer/setting")} className="text-gray-500 flex items-center justify-center mb-6">
                  //          <ArrowLeft className="text-gray-500" size={18} />&nbsp;{t('settings.common.back')}
                  //       </button>
                  //       <section id="language" className="scroll-mt-6 space-y-2">
                  //          <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                  //             <Globe className="text-rose-500" size={20} />
                  //             {t('settings.language.title')}
                  //          </h3>
                  //          <input type="hidden" name="currectAction" defaultValue="defaultLanguage" />
                  //          <input type="hidden" name="defaultTheme" defaultValue={customerData.defaultTheme} />
                  //          <input type="hidden" name="emailNotification" defaultValue={String(customerData.sendMailNoti)} />
                  //          <input type="hidden" name="pushNotification" defaultValue={String(customerData.sendPushNoti)} />
                  //          <input type="hidden" name="smsNotification" defaultValue={String(customerData.sendSMSNoti)} />
                  //          <input type="hidden" name="twofactorEnabled" value={String(customerData.twofactorEnabled)} />
                  //          <div className="space-y-4">
                  //             <div>
                  //                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.language.selectLanguage')}</label>
                  //                <select
                  //                   defaultValue={customerData.defaultLanguage}
                  //                   name="defaultLanguage"
                  //                   className="text-sm w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  //                >
                  //                   <option value="en">{t('settings.language.english')}</option>
                  //                   <option value="th">{t('settings.language.thai')}</option>
                  //                   <option value="la">{t('settings.language.lao')}</option>
                  //                </select>
                  //             </div>
                  //          </div>
                  //       </section>
                  //       <div className="flex items-center justify-end">
                  //          <Button
                  //             type="submit"
                  //             className="cursor-pointer text-sm bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-500 hover:text-rose-600 font-medium"
                  //          >
                  //             {t('settings.basic.saveChange')}
                  //          </Button>
                  //       </div>
                  //    </Form>
                  // </div>
               }

               {tab === "mode" &&
                  <div>
                     {actionData?.error && actionData.showError === "defaultTheme" &&
                        <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                           <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                           <span className="text-red-500 text-sm">
                              {capitalize(actionData.message)}
                           </span>
                        </div>
                     }
                     <Form method="patch" className="space-y-4">
                        <button type="button" onClick={() => navigate("/customer/setting")} className="text-gray-500 flex items-center justify-center mb-6">
                           <ArrowLeft className="text-gray-500" size={18} />&nbsp;{t('settings.common.back')}
                        </button>
                        <section id="mode" className="scroll-mt-6">
                           <h3 className="text-md font-semibold mb-6 text-gray-800 flex items-center gap-2">
                              {darkMode ? (
                                 <Moon className="text-rose-500" size={20} />
                              ) : (
                                 <Sun className="text-rose-500" size={20} />
                              )}
                              {t('settings.theme.title')}
                           </h3>

                           <input
                              type="hidden"
                              name="defaultTheme"
                              value={darkMode ? "dark" : "light"}
                           />
                           <input type="hidden" name="currectAction" defaultValue="defaultTheme" />
                           <input type="hidden" name="defaultLanguage" defaultValue={customerData.defaultLanguage} />
                           <input type="hidden" name="emailNotification" defaultValue={String(customerData.sendMailNoti)} />
                           <input type="hidden" name="pushNotification" defaultValue={String(customerData.sendPushNoti)} />
                           <input type="hidden" name="smsNotification" defaultValue={String(customerData.sendSMSNoti)} />
                           <input type="hidden" name="twofactorEnabled" value={String(customerData.twofactorEnabled)} />
                           <div className="space-y-4">
                              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                 <div>
                                    <h4 className="font-medium text-gray-800">{t('settings.theme.darkModeTitle')}</h4>
                                    <p className="text-sm text-gray-600">
                                       {t('settings.theme.darkModeDescription')}
                                    </p>
                                 </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div
                                    className={`${!darkMode ? "border-2 border-rose-500" : "border-2 border-gray-300"}
                                                                         p-4 bg-white rounded-lg cursor-pointer hover:border-rose-500 transition-colors`}
                                    onClick={() => setDarkMode(false)}
                                 >
                                    <div className="w-full h-16 bg-gray-100 rounded mb-2"></div>
                                    <p className="text-sm font-medium text-center">{t('settings.theme.lightTheme')}</p>
                                 </div>

                                 <div
                                    className={`${darkMode ? "border-2 border-rose-500" : "border-2 border-gray-300"}
                                                                         p-4 bg-gray-800 rounded-lg cursor-pointer hover:border-rose-500 transition-colors`}
                                    onClick={() => setDarkMode(true)}
                                 >
                                    <div className="w-full h-16 bg-gray-700 rounded mb-2"></div>
                                    <p className="text-sm font-medium text-center text-white">{t('settings.theme.darkTheme')}</p>
                                 </div>
                              </div>
                           </div>
                        </section>
                        <div className="flex items-center justify-end">
                           <Button
                              type="submit"
                              className="cursor-pointer text-sm bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-500 hover:text-rose-600 font-medium"
                           >
                              {t('settings.basic.saveChange')}
                           </Button>
                        </div>
                     </Form>
                  </div>
               }

               {tab === "report" &&
                  <div>
                     {actionData?.error && actionData.showError === "report" &&
                        <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                           <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                           <span className="text-red-500 text-sm">
                              {capitalize(actionData.message)}
                           </span>
                        </div>
                     }
                     <Form method="post" className="space-y-4">
                        <button type="button" onClick={() => navigate("/customer/setting")} className="text-gray-500 flex items-center justify-center mb-6">
                           <ArrowLeft className="text-gray-500" size={18} />&nbsp;{t('settings.common.back')}
                        </button>
                        <section id="report" className="scroll-mt-6 space-y-2">
                           <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                              <Flag className="text-rose-500" size={18} />
                              {t('settings.report.title')}
                           </h3>
                           <input type="text" name="currectAction" defaultValue="report" className="hidden" />
                           <div className="space-y-4">
                              <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.report.issueType')}</label>
                                 <select name="type" className="text-sm w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent">
                                    <option>{t('settings.report.bug')}</option>
                                    <option>{t('settings.report.feature')}</option>
                                    <option>{t('settings.report.account')}</option>
                                    <option>{t('settings.report.payment')}</option>
                                    <option>{t('settings.report.other')}</option>
                                 </select>
                              </div>
                              <div>
                                 <Label htmlFor="title" className="text-gray-500 text-sm">
                                    {t('settings.report.titleLabel')}
                                 </Label>
                                 <Input
                                    required
                                    id="title"
                                    type="text"
                                    name="title"
                                    placeholder={t('settings.report.titlePlaceholder')}
                                    className="text-sm mt-1 border-gray-200 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                 />
                              </div>
                              <div>
                                 <label className="block text-sm font-medium text-gray-500 mb-2">{t('settings.report.descriptionLabel')}</label>
                                 <textarea
                                    rows={5}
                                    name="description"
                                    className="text-sm w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                                    placeholder={t('settings.report.descriptionPlaceholder')}
                                 />
                              </div>
                              <div className="flex items-center justify-end">
                                 <Button
                                    type="submit"
                                    className="flex cursor-pointer text-sm bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-500 hover:text-rose-600 font-medium"
                                 >
                                    {t('settings.report.submitButton')}
                                 </Button>
                              </div>
                           </div>
                        </section>
                     </Form>
                  </div>
               }

               {tab === "delete" &&
                  <div>
                     {actionData?.error && actionData.showError === "deleteAccount" &&
                        <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                           <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                           <span className="text-red-500 text-sm">
                              {capitalize(actionData.message)}
                           </span>
                        </div>
                     }
                     <Form method="delete" className="space-y-4">
                        <button type="button" onClick={() => navigate("/customer/setting")} className="text-gray-500 flex items-center justify-center mb-6">
                           <ArrowLeft className="text-gray-500" size={18} />&nbsp;{t('settings.common.back')}
                        </button>
                        <section id="delete" className="scroll-mt-6">
                           <h3 className="text-md font-semibold mb-6 text-gray-800 flex items-center gap-2">
                              <Trash2 className="text-rose-500" size={20} />
                              {t('settings.deleteAccount.title')}
                           </h3>
                           <input type="text" name="currectAction" defaultValue="deleteAccount" className="hidden" />
                           <div className="space-y-4">
                              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                 <h4 className="font-medium text-red-800 mb-2">⚠️ {t('settings.deleteAccount.warning')}</h4>
                                 <p className="text-sm text-red-700">
                                    {t('settings.deleteAccount.warningMessage')}
                                 </p>
                              </div>
                              <div>
                                 <Label htmlFor="whatsapp" className="text-gray-500 text-sm">
                                    {t('settings.deleteAccount.confirmLabel')}
                                 </Label>
                                 <Input
                                    required
                                    id="delete"
                                    type="text"
                                    name="delete"
                                    value={deleteAccount}
                                    onChange={(e) => setDeleteAccount(e.target.value)}
                                    placeholder={t('settings.deleteAccount.confirmPlaceholder')}
                                    className="mt-1 border-gray-200 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                 />
                              </div>
                              <div className="flex items-center justify-end">
                                 <Button
                                    type="submit"
                                    disabled={deleteAccount === "DELETE" ? false : true}
                                    className="flex cursor-pointer text-sm bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-500 font-medium"
                                 >
                                    {t('settings.deleteAccount.deleteButton')}
                                 </Button>
                              </div>
                           </div>
                        </section>
                     </Form>
                  </div>
               }
            </div>
         </div>
      </>
   )
}