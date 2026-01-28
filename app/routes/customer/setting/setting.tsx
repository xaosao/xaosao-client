import React, { useState, useCallback } from "react";
import type { Route } from "./+types/setting";
import { useTranslation } from 'react-i18next';
import { Form, redirect, useActionData, useNavigate, useNavigation, type LoaderFunction } from "react-router";
import { User, Lock, Bell, Globe, Flag, Trash2, LogOut, Eye, EyeOff, ChevronLeft, ChevronRight, Loader, AlertCircle, Boxes, X, Check } from "lucide-react";
import { usePushNotifications } from "~/hooks/usePushNotifications";

// components
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import LanguageSwitcher from "~/components/LanguageSwitcher";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

// service and interface
import { useIsMobile } from "~/hooks/use-mobile";
import { capitalize } from "~/utils/functions/textFormat";
import { requireUserSession, destroyUserSession } from "~/services/auths.server";
import type { ICustomerCredentials, ICustomerResponse, ICustomerSettingCredentials } from "~/interfaces/customer";
import { validateICustomerSettingInputs, validateReportUpInputs, validateUpdateProfileInputs } from "~/services/validation.server";
import { changeCustomerPassword, createReport, deleteAccount, getCustomerProfile, updateCustomerSetting, updateProfile } from "~/services/profile.server";
import { prisma } from "~/services/database.server";

type NotificationType = "push" | "sms"; // "email" disabled for now

interface LoaderReturn {
    customerData: ICustomerResponse;
    walletBalance: number;
}

interface TransactionProps {
    loaderData: LoaderReturn;
}

// Helper function for error handling
const handleError = (error: any, actionType: string) => {
    if (error?.payload) {
        return {
            success: error.payload.success,
            error: error.payload.error,
            message: error.payload.message,
            showError: actionType
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
                showError: actionType
            };
        }
    }

    return {
        success: false,
        error: true,
        message: error || "Failed to process. Try again later!",
        showError: actionType
    };
};

export const loader: LoaderFunction = async ({ request }) => {
    const customerId = await requireUserSession(request);
    const customerData = await getCustomerProfile(customerId);

    // Get wallet balance for delete account warning
    const wallet = await prisma.wallet.findFirst({
        where: { customerId },
        select: { totalBalance: true },
    });

    return {
        customerData,
        walletBalance: wallet?.totalBalance || 0,
    };
};

export async function action({ request }: Route.ActionArgs) {
    const customerId = await requireUserSession(request);
    const formData = await request.formData();
    const data = Object.fromEntries(formData);
    const actionType = data.currectAction as string;

    const customerData = Object.fromEntries(formData) as Partial<ICustomerCredentials>;
    // Convert whatsapp to number for validation
    if (customerData.whatsapp) {
        customerData.whatsapp = Number(customerData.whatsapp) as any;
    }
    const customerSettingData: ICustomerSettingCredentials = {
        twofactorEnabled: formData.get("twofactorEnabled") === "true",
        defaultLanguage: formData.get("defaultLanguage") as string,
        defaultTheme: formData.get("defaultTheme") as string,
        notifications_email: formData.get("notifications_email") === "true",
        notifications_push: formData.get("notifications_push") === "true",
        notifications_sms: formData.get("notifications_sms") === "true",
    };

    try {
        // PATCH requests
        if (request.method === "PATCH") {
            switch (actionType) {
                case "isbasic":
                    await validateUpdateProfileInputs(customerData as ICustomerCredentials);
                    const basicRes = await updateProfile(customerId, customerData as ICustomerCredentials);
                    if (basicRes.id) {
                        return redirect("/customer/setting?toastMessage=Update+basic+information+successfully!&toastType=success");
                    }
                    break;

                case "ispassword":
                    if (!data.old_password) {
                        return { success: false, error: true, message: "Please enter old password!", showError: actionType };
                    }
                    if (data.new_password !== data.con_new_password) {
                        return { success: false, error: true, message: "The new password not match. Check and try again!", showError: actionType };
                    }
                    const passwordRes = await changeCustomerPassword(customerId, data.old_password as string, data.new_password as string);
                    if (passwordRes.id) {
                        return redirect("/customer/setting?toastMessage=Change+password+successfully!&toastType=success");
                    }
                    break;

                case "defaultLanguage":
                    await validateICustomerSettingInputs(customerSettingData);
                    const langRes = await updateCustomerSetting(customerId, customerSettingData);
                    if (langRes.id) {
                        return redirect("/customer/setting?toastMessage=Update+customer+default+language+successful!&toastType=success");
                    }
                    break;

                case "defaultTheme":
                    await validateICustomerSettingInputs(customerSettingData);
                    const themeRes = await updateCustomerSetting(customerId, customerSettingData);
                    if (themeRes.id) {
                        return redirect("/customer/setting?toastMessage=Update+customer+default+theme+successful!&toastType=success");
                    }
                    break;

                case "notifications":
                    await validateICustomerSettingInputs(customerSettingData);
                    const notiRes = await updateCustomerSetting(customerId, customerSettingData);
                    if (notiRes.id) {
                        return redirect("/customer/setting?toastMessage=Update+profile+setting+notification+successful!&toastType=success");
                    }
                    break;

                case "twoFactorAuthentication":
                    await validateICustomerSettingInputs(customerSettingData);
                    const twoFaRes = await updateCustomerSetting(customerId, customerSettingData);
                    if (twoFaRes.id) {
                        return redirect("/customer/setting?toastMessage=Two+Factor+Authenticaton+is+enabled+successful!&toastType=success");
                    }
                    break;

                default:
                    return {
                        success: false,
                        error: true,
                        message: "Failed to process. Try again later!",
                        showError: actionType
                    };
            }
        }

        // POST requests
        if (request.method === "POST" && actionType === "report") {
            await validateReportUpInputs({
                type: data.type as string,
                title: data.title as string,
                description: data.description as string,
            });
            const reportRes = await createReport(customerId, data.type as string, data.title as string, data.description as string);
            if (reportRes.id) {
                return redirect("/customer/setting?toastMessage=Submit+Report+successful!++Thank+you.&toastType=success");
            }
        }

        // DELETE requests
        if (request.method === "DELETE") {
            const deleteRes = await deleteAccount(customerId);
            if (deleteRes.id) {
                // Clear session and cookies before redirecting
                return await destroyUserSession(request);
            }
        }
    } catch (error: any) {
        return handleError(error, actionType);
    }

    return { success: false, error: true, message: "Invalid request method!", showError: actionType };
}

// Error Alert Component
const ErrorAlert: React.FC<{ message: string }> = ({ message }) => (
    <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        <span className="text-red-500 text-sm">{capitalize(message)}</span>
    </div>
);

// Password Input Component
const PasswordInput: React.FC<{
    id: string;
    name: string;
    label: string;
    placeholder: string;
    required?: boolean;
}> = ({ id, name, label, placeholder, required = false }) => {
    const [show, setShow] = useState(false);

    return (
        <div>
            <Label htmlFor={id} className="text-gray-500 text-sm">
                {label} {required && <span className="text-rose-500">*</span>}
            </Label>
            <div className="relative mt-1">
                <Input
                    required={required}
                    id={id}
                    type={show ? "text" : "password"}
                    name={name}
                    placeholder={placeholder}
                    className="text-sm border-gray-300 text-gray-500 placeholder-gray-400 focus:border-rose-500 pr-10 backdrop-blur-sm"
                />
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
};

export default function SettingPage({ loaderData }: TransactionProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const navigation = useNavigation();
    // const [searchParams] = useSearchParams();
    const { customerData, walletBalance } = loaderData;
    const actionData = useActionData<typeof action>();
    const isMobile = useIsMobile();

    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "PATCH";
    const isCreating = navigation.state !== "idle" && navigation.formMethod === "POST";
    const isDeleting = navigation.state !== "idle" && navigation.formMethod === "DELETE";

    // const [darkMode, setDarkMode] = useState(customerData.defaultTheme === "dark");
    const [activeSection, setActiveSection] = useState('basic');
    const [notifications, setNotifications] = useState({
        // email: customerData.sendMailNoti, // Email notification disabled for now
        push: customerData.sendPushNoti,
        sms: customerData.sendSMSNoti,
    });
    const [deleteAccountText, setDeleteAccountText] = useState("");
    const [showPushDialog, setShowPushDialog] = useState(false);
    const [pushSuccess, setPushSuccess] = useState(false);

    // Push notifications hook
    const {
        isSubscribed: isPushSubscribed,
        isLoading: isPushLoading,
        permission: pushPermission,
        error: pushError,
        subscribe: subscribePush,
        unsubscribe: unsubscribePush,
    } = usePushNotifications({ userType: "customer" });

    const menuItems = [
        { id: 'basic', label: t('settings.menu.basic'), icon: User },
        { id: 'password', label: t('settings.menu.password'), icon: Lock },
        // { id: 'twofa', label: t('settings.menu.twofa'), icon: Shield },
        { id: 'notification', label: t('settings.menu.notification'), icon: Bell },
        { id: 'language', label: t('settings.menu.language'), icon: Globe },
        // { id: 'mode', label: t('settings.menu.mode'), icon: darkMode ? Moon : Sun },
        { id: 'report', label: t('settings.menu.report'), icon: Flag },
        { id: 'delete', label: t('settings.menu.delete'), icon: Trash2 },
    ];

    const scrollToSection = useCallback((sectionId: string) => {
        setActiveSection(sectionId);
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest'
            });
        }
    }, []);

    const handleNotificationChange = useCallback((type: NotificationType) => {
        // For push notifications, show dialog if trying to enable and not subscribed
        if (type === "push") {
            if (!notifications.push && !isPushSubscribed) {
                // Trying to enable push - show the dialog first
                setShowPushDialog(true);
                setPushSuccess(false);
                return;
            } else if (notifications.push && isPushSubscribed) {
                // Trying to disable push - unsubscribe
                unsubscribePush();
            }
        }
        setNotifications(prev => ({
            ...prev,
            [type]: !prev[type],
        }));
    }, [notifications.push, isPushSubscribed, unsubscribePush]);

    const handleEnablePush = useCallback(async () => {
        const success = await subscribePush();
        if (success) {
            setPushSuccess(true);
            // Update local state
            setNotifications(prev => ({
                ...prev,
                push: true,
            }));
            // Auto close after showing success
            setTimeout(() => {
                setShowPushDialog(false);
                setPushSuccess(false);
            }, 2000);
        }
    }, [subscribePush]);

    const handleDismissPushDialog = useCallback(() => {
        setShowPushDialog(false);
        setPushSuccess(false);
    }, []);

    if (isSubmitting || isCreating || isDeleting) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                <div className="flex items-center justify-center bg-white p-6 rounded-xl shadow-md gap-2">
                    <Loader className="w-4 h-4 animate-spin" />
                    <p className="text-gray-600">{t('settings.common.processing')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-start justify-start gap-4 p-2 sm:p-6 h-screen overflow-hidden">
            {/* Sidebar */}
            <div className="w-full sm:w-1/4 sm:border sm:border-gray-200 rounded-lg p-0 sm:p-4 h-full overflow-y-auto space-y-4">
                <div className="flex items-center justify-start gap-2 mt-8 sm:mt-0">
                    <ChevronLeft onClick={() => navigate("/customer/profile")} className="block sm:hidden cursor-pointer" />
                    <h2 className="text-lg font-semibold text-gray-800">{t('settings.title')}</h2>
                </div>
                <nav className="space-y-2 px-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div
                                key={item.id}
                                onClick={() => isMobile ? navigate(`/customer/setting-detail/${item.id}`) : scrollToSection(item.id)}
                                className={`cursor-pointer w-full flex items-center justify-between sm:justify-start gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 ${activeSection === item.id
                                    ? 'bg-rose-100 hover:bg-rose-200 text-rose-600'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                                    }`}
                            >
                                <div className="flex items-start gap-2">
                                    <Icon size={16} />
                                    <span className="text-sm font-medium">{item.label}</span>
                                </div>
                                <ChevronRight size={16} className="block sm:hidden" />
                            </div>
                        );
                    })}

                </nav>
                <div className="flex items-center justify-start gap-2 mt-8 sm:mt-0">
                    <ChevronLeft onClick={() => navigate("/customer/profile")} className="block sm:hidden cursor-pointer" />
                    <h2 className="text-lg font-semibold text-gray-800">{t('navigation.packages')}</h2>
                </div>
                <div
                    onClick={() => navigate("/customer/packages")}
                    className={`cursor-pointer w-full flex items-center justify-between sm:justify-start gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 text-gray-600 hover:bg-gray-100 hover:text-gray-800`}
                >
                    <div className="flex items-start gap-2">
                        <Boxes size={16} />
                        <span className="text-sm font-medium">{t('navigation.packages')}</span>
                    </div>
                    <ChevronRight size={16} className="block sm:hidden" />
                </div>

                <div className="px-8 sm:px-0 mt-4">
                    <Form method="post" action="/logout">
                        <button
                            type="submit"
                            className="w-full flex items-center justify-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 text-rose-500 border border-rose-300 cursor-pointer hover:bg-rose-100 mt-4"
                        >
                            <LogOut size={16} />
                            <span className="text-sm font-medium">{t('settings.common.logout')}</span>
                        </button>
                    </Form>
                </div>
            </div>

            {/* Main Content */}
            <div className="hidden sm:block w-3/4 border border-gray-200 rounded-lg p-6 h-full overflow-y-auto"
                style={{
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none',
                }}
            >
                <div className="space-y-12">
                    {/* Basic Information */}
                    {actionData?.error && actionData.showError === "isbasic" && <ErrorAlert message={actionData.message} />}
                    <Form method="patch">
                        <section id="basic" className="scroll-mt-6 space-y-2">
                            <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                                <User className="text-rose-500" size={20} />
                                {t('settings.basic.title')}
                            </h3>
                            <input type="hidden" name="profile" defaultValue={customerData.profile} />
                            <input type="hidden" name="currectAction" defaultValue="isbasic" />
                            <input
                                type="hidden"
                                name="interest"
                                defaultValue={customerData.interests ? Object.values(customerData.interests).join(", ") : ""}
                            />

                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="first_name" className="text-gray-500 text-sm">
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
                                    <Label htmlFor="last_name" className="text-gray-500 text-sm">
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
                                <div>
                                    <Label htmlFor="dob" className="text-gray-500 text-sm">
                                        {t('settings.basic.dob')}<span className="text-rose-500">*</span>
                                    </Label>
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
                                <div>
                                    <Label htmlFor="gender" className="text-gray-500 text-sm mb-1">
                                        {t('settings.basic.gender')}<span className="text-rose-500">*</span>
                                    </Label>
                                    <Select name="gender" required defaultValue={customerData.gender}>
                                        <SelectTrigger className="bg-background rounded-md h-14 text-foreground font-medium px-6 w-full">
                                            <SelectValue placeholder={t('settings.basic.genderPlaceholder')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="male">{t('settings.basic.male')}</SelectItem>
                                            <SelectItem value="female">{t('settings.basic.female')}</SelectItem>
                                            <SelectItem value="other">{t('settings.basic.other')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="relationshipStatus" className="text-gray-500 text-sm mb-1">
                                        {t('settings.basic.relationshipStatus')}<span className="text-rose-500">*</span>
                                    </Label>
                                    <Select name="relationshipStatus" required defaultValue={customerData.relationshipStatus ?? "single"}>
                                        <SelectTrigger className="bg-background rounded-md h-14 text-foreground font-medium px-6 w-full">
                                            <SelectValue placeholder={t('settings.basic.relationshipStatusPlaceholder')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Single">{t('settings.basic.single')}</SelectItem>
                                            <SelectItem value="Married">{t('settings.basic.married')}</SelectItem>
                                            <SelectItem value="Relationship">{t('settings.basic.relationship')}</SelectItem>
                                            <SelectItem value="Divorced">{t('settings.basic.divorced')}</SelectItem>
                                            <SelectItem value="Widowed">{t('settings.basic.widowed')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
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
                                <div>
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
                                <div>
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
                                <div>
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
                                        className="cursor-pointer text-sm bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-500 hover:text-rose-600 font-medium"
                                    >
                                        {t('settings.basic.saveChange')}
                                    </Button>
                                </div>
                            </div>
                        </section>
                    </Form>

                    {/* Password */}
                    {actionData?.error && actionData.showError === "ispassword" && <ErrorAlert message={actionData.message} />}
                    <Form method="patch">
                        <section id="password" className="scroll-mt-6 space-y-2">
                            <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                                <Lock className="text-rose-500" size={20} />
                                {t('settings.password.title')}
                            </h3>
                            <input type="hidden" name="currectAction" defaultValue="ispassword" />
                            <div className="space-y-4 mt-4">
                                <PasswordInput
                                    id="old_password"
                                    name="old_password"
                                    label={t('settings.password.oldPassword')}
                                    placeholder={t('settings.password.passwordPlaceholder')}
                                    required
                                />
                                <PasswordInput
                                    id="new_password"
                                    name="new_password"
                                    label={t('settings.password.newPassword')}
                                    placeholder={t('settings.password.passwordPlaceholder')}
                                    required
                                />
                                <PasswordInput
                                    id="con_new_password"
                                    name="con_new_password"
                                    label={t('settings.password.confirmPassword')}
                                    placeholder={t('settings.password.passwordPlaceholder')}
                                    required
                                />
                                <div className="flex items-center justify-end">
                                    <Button
                                        type="submit"
                                        className="cursor-pointer text-sm bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-500 hover:text-rose-600 font-medium"
                                    >
                                        {t('settings.password.saveChange')}
                                    </Button>
                                </div>
                            </div>
                        </section>
                    </Form>

                    {/* 2FA */}
                    {/* {actionData?.error && actionData.showError === "twoFactorAuthentication" && <ErrorAlert message={actionData.message} />}
                    <Form method="patch">
                        <section id="twofa" className="scroll-mt-6 space-y-3">
                            <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                                <Shield className="text-rose-500" size={20} />
                                {t('settings.twofa.title')}
                            </h3>

                            <input type="hidden" name="currectAction" defaultValue="twoFactorAuthentication" />
                            <input type="hidden" name="defaultLanguage" defaultValue={customerData.defaultLanguage} />
                            <input type="hidden" name="defaultTheme" defaultValue={customerData.defaultTheme} />
                            <input type="hidden" name="notifications_email" defaultValue={String(customerData.sendMailNoti)} />
                            <input type="hidden" name="notifications_push" defaultValue={String(customerData.sendPushNoti)} />
                            <input type="hidden" name="notifications_sms" defaultValue={String(customerData.sendSMSNoti)} />
                            <input type="hidden" name="twofactorEnabled" value={String(!customerData.twofactorEnabled)} />

                            <div className="space-y-4">
                                <div className="p-4 border border-gray-200 rounded-lg">
                                    <h4 className="text-sm font-medium text-gray-800 mb-2">
                                        {t('settings.twofa.subtitle')}
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
                    </Form> */}

                    {/* Notifications */}
                    {actionData?.error && actionData.showError === "notifications" && <ErrorAlert message={actionData.message} />}
                    <Form method="patch" className="space-y-4">
                        <section id="notification" className="scroll-mt-6 space-y-2">
                            <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                                <Bell className="text-rose-500" size={20} />
                                {t('settings.notification.title')}
                            </h3>
                            <input type="hidden" name="currectAction" defaultValue="notifications" />
                            <input type="hidden" name="defaultLanguage" defaultValue={customerData.defaultLanguage} />
                            <input type="hidden" name="defaultTheme" defaultValue={customerData.defaultTheme} />
                            <input type="hidden" name="twofactorEnabled" value={String(customerData.twofactorEnabled)} />
                            {/* Keep email notification value for server */}
                            <input type="hidden" name="notifications_email" value={String(customerData.sendMailNoti)} />
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
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-medium text-gray-800 capitalize">
                                                {t(`settings.notification.${type}Title`)}
                                            </h4>
                                            <p className="text-xs text-gray-600">
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
                                {t('settings.notification.saveChange')}
                            </Button>
                        </div>
                    </Form>

                    {/* Language Switcher */}
                    {actionData?.error && actionData.showError === "defaultLanguage" && <ErrorAlert message={actionData.message} />}
                    <section id="language" className="scroll-mt-6 space-y-4">
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

                    {/* Theme Mode */}
                    {/* {actionData?.error && actionData.showError === "defaultTheme" && <ErrorAlert message={actionData.message} />}
                    <Form method="patch" className="space-y-4">
                        <section id="mode" className="scroll-mt-6">
                            <h3 className="text-md font-semibold mb-6 text-gray-800 flex items-center gap-2">
                                {darkMode ? (
                                    <Moon className="text-rose-500" size={20} />
                                ) : (
                                    <Sun className="text-rose-500" size={20} />
                                )}
                                {t('settings.theme.title')}
                            </h3>

                            <input type="hidden" name="defaultTheme" value={darkMode ? "dark" : "light"} />
                            <input type="hidden" name="currectAction" defaultValue="defaultTheme" />
                            <input type="hidden" name="defaultLanguage" defaultValue={customerData.defaultLanguage} />
                            <input type="hidden" name="notifications_email" defaultValue={String(customerData.sendMailNoti)} />
                            <input type="hidden" name="notifications_push" defaultValue={String(customerData.sendPushNoti)} />
                            <input type="hidden" name="notifications_sms" defaultValue={String(customerData.sendSMSNoti)} />
                            <input type="hidden" name="twofactorEnabled" value={String(customerData.twofactorEnabled)} />

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <div>
                                        <h4 className="font-medium text-gray-800">{t('settings.theme.darkMode')}</h4>
                                        <p className="text-sm text-gray-600">
                                            {t('settings.theme.darkModeDescription')}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div
                                        className={`${!darkMode ? "border-2 border-rose-500" : "border-2 border-gray-300"
                                            } p-4 bg-white rounded-lg cursor-pointer hover:border-rose-500 transition-colors`}
                                        onClick={() => setDarkMode(false)}
                                    >
                                        <div className="w-full h-16 bg-gray-100 rounded mb-2"></div>
                                        <p className="text-sm font-medium text-center">{t('settings.theme.light')}</p>
                                    </div>

                                    <div
                                        className={`${darkMode ? "border-2 border-rose-500" : "border-2 border-gray-300"
                                            } p-4 bg-gray-800 rounded-lg cursor-pointer hover:border-rose-500 transition-colors`}
                                        onClick={() => setDarkMode(true)}
                                    >
                                        <div className="w-full h-16 bg-gray-700 rounded mb-2"></div>
                                        <p className="text-sm font-medium text-center text-white">{t('settings.theme.dark')}</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                        <div className="flex items-center justify-end">
                            <Button
                                type="submit"
                                className="cursor-pointer text-sm bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-500 hover:text-rose-600 font-medium"
                            >
                                {t('settings.theme.saveChange')}
                            </Button>
                        </div>
                    </Form> */}

                    {/* Report */}
                    {actionData?.error && actionData.showError === "report" && <ErrorAlert message={actionData.message} />}
                    <Form method="post" className="space-y-4">
                        <section id="report" className="scroll-mt-6 space-y-2">
                            <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                                <Flag className="text-rose-500" size={18} />
                                {t('settings.report.title')}
                            </h3>
                            <input type="hidden" name="currectAction" defaultValue="report" />
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
                                    <label className="block text-sm font-medium text-gray-500 mb-2">{t('settings.report.description')}</label>
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
                                        {t('settings.report.submit')}
                                    </Button>
                                </div>
                            </div>
                        </section>
                    </Form>

                    {/* Delete Account */}
                    {actionData?.error && actionData.showError === "deleteAccount" && <ErrorAlert message={actionData.message} />}
                    <Form method="delete" className="space-y-4">
                        <section id="delete" className="scroll-mt-6">
                            <h3 className="text-md font-semibold mb-6 text-gray-800 flex items-center gap-2">
                                <Trash2 className="text-rose-500" size={20} />
                                {t('settings.deleteAccount.title')}
                            </h3>
                            <input type="hidden" name="currectAction" defaultValue="deleteAccount" />
                            <div className="space-y-4">
                                {walletBalance > 0 && (
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                                        <h4 className="font-medium text-amber-800">💰 {t('settings.deleteAccount.balanceWarningTitle', { defaultValue: 'Wallet Balance Detected' })}</h4>
                                        <p className="text-sm text-amber-700">
                                            {t('settings.deleteAccount.balanceWarningMessage', {
                                                defaultValue: 'You have {{balance}} KIP in your wallet.',
                                                balance: walletBalance.toLocaleString()
                                            })}
                                        </p>
                                    </div>
                                )}
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <h4 className="font-medium text-red-800 mb-2">⚠️ {t('settings.deleteAccount.warning')}</h4>
                                    <p className="text-sm text-red-700">
                                        {walletBalance > 0
                                            ? t('settings.deleteAccount.softDeleteMessage', {
                                                defaultValue: 'Your account will be deactivated and can be recovered within 7 days. After 7 days, it will be permanently deleted along with your remaining balance.'
                                            })
                                            : t('settings.deleteAccount.hardDeleteMessage', {
                                                defaultValue: 'Your account will be permanently deleted immediately. This action cannot be undone.'
                                            })
                                        }
                                    </p>
                                </div>
                                <div>
                                    <Label htmlFor="delete" className="text-gray-500 text-sm">
                                        {t('settings.deleteAccount.confirmLabel')}
                                    </Label>
                                    <Input
                                        required
                                        id="delete"
                                        type="text"
                                        name="delete"
                                        value={deleteAccountText}
                                        onChange={(e) => setDeleteAccountText(e.target.value)}
                                        placeholder={t('settings.deleteAccount.confirmPlaceholder')}
                                        className="mt-1 border-gray-200 placeholder-gray-200 focus:border-pink-500 backdrop-blur-sm"
                                    />
                                </div>
                                <div className="flex items-center justify-end">
                                    <Button
                                        type="submit"
                                        disabled={deleteAccountText !== "DELETE"}
                                        className="flex cursor-pointer text-sm bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {t('settings.deleteAccount.button')}
                                    </Button>
                                </div>
                            </div>
                        </section>
                    </Form>
                </div>
            </div>

            {/* Push Notification Enable Dialog */}
            {showPushDialog && (
                <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300">
                        {/* Header */}
                        <div className="relative p-4 border-b">
                            <button
                                onClick={handleDismissPushDialog}
                                className="absolute right-4 top-4 p-1 rounded-full hover:bg-gray-100"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="w-14 h-14 rounded-xl shadow-md bg-rose-500 flex items-center justify-center">
                                    {pushSuccess ? (
                                        <Check className="w-8 h-8 text-white" />
                                    ) : (
                                        <Bell className="w-8 h-8 text-white" />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        {pushSuccess
                                            ? t("push.enabled", { defaultValue: "Notifications Enabled!" })
                                            : t("push.title", { defaultValue: "Stay Updated" })}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {pushSuccess
                                            ? t("push.enabledDesc", { defaultValue: "You'll receive important updates" })
                                            : t("push.subtitle", { defaultValue: "Enable push notifications" })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4">
                            {pushSuccess ? (
                                <p className="text-sm text-gray-600 text-center">
                                    {t("push.successMessage", {
                                        defaultValue: "You'll now receive notifications for bookings, messages, and updates.",
                                    })}
                                </p>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-600">
                                        {t("push.description", {
                                            defaultValue:
                                                "Get notified about new bookings, messages, and important updates even when you're not using the app.",
                                        })}
                                    </p>

                                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                            <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                                                <Bell className="w-4 h-4 text-rose-500" />
                                            </div>
                                            <span>{t("push.benefitCustomer1", { defaultValue: "Booking confirmations" })}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                            <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                                                <Bell className="w-4 h-4 text-rose-500" />
                                            </div>
                                            <span>{t("push.benefitMessages", { defaultValue: "New messages" })}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                            <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                                                <Bell className="w-4 h-4 text-rose-500" />
                                            </div>
                                            <span>{t("push.benefitCustomer3", { defaultValue: "Service updates" })}</span>
                                        </div>
                                    </div>
                                </>
                            )}

                            {pushError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-sm text-red-600">{pushError}</p>
                                </div>
                            )}

                            {pushPermission === "denied" && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    <p className="text-sm text-amber-800">
                                        {t("push.permissionDenied", {
                                            defaultValue:
                                                "Notifications are blocked. Please enable them in your browser settings.",
                                        })}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t flex gap-3">
                            {!pushSuccess && (
                                <>
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={handleDismissPushDialog}
                                        disabled={isPushLoading}
                                    >
                                        {t("push.notNow", { defaultValue: "Not Now" })}
                                    </Button>
                                    <Button
                                        className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
                                        onClick={handleEnablePush}
                                        disabled={isPushLoading || pushPermission === "denied"}
                                    >
                                        {isPushLoading ? (
                                            <span className="flex items-center gap-2">
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                {t("push.enabling", { defaultValue: "Enabling..." })}
                                            </span>
                                        ) : (
                                            <>
                                                <Bell className="w-4 h-4 mr-2" />
                                                {t("push.enable", { defaultValue: "Enable Notifications" })}
                                            </>
                                        )}
                                    </Button>
                                </>
                            )}
                        </div>

                        {/* Safe area padding for iOS */}
                        <div className="h-safe-area-inset-bottom" />
                    </div>
                </div>
            )}
        </div>
    );
}
