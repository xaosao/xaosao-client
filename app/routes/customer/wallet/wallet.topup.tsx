import React from "react";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/wallet.topup";
import { Form, redirect, useActionData, useFetcher, useLoaderData, useNavigate, useNavigation, useSubmit, type LoaderFunction } from "react-router";
import { AlertCircle, AlertTriangle, Check, CheckCircle, Clock, Copy, Download, ImageIcon, Loader, QrCode, Upload, X, Wallet } from "lucide-react";

// components
import Modal from "~/components/ui/model";
import { capitalize } from "~/utils/functions/textFormat";
import { uploadFileToBunnyServer } from "~/services/upload.server";
import { requireUserSession } from "~/services/auths.server";
import { validateTopUpInputs } from "~/services/validation.server";
import type { ITransactionCredentials } from "~/interfaces/transaction";
import { formatCurrency, formatCurrency1 } from "~/utils";
import { compressImage } from "~/utils/imageCompression";

const MAX_FILE_SIZE_MB = 50;
const COMPRESSED_MAX_SIZE_MB = 3;

// Deliberately not annotated `LoaderFunction`: that erases the return
// type, so `useLoaderData<typeof loader>()` came back as `undefined` and
// every field read off it was an error. Letting TypeScript infer gives
// the component the real shape.
export const loader = async ({ request }: Route.LoaderArgs) => {
    const customerId = await requireUserSession(request);
    const url = new URL(request.url);
    const suggestedAmount = url.searchParams.get("amount");
    const planId = url.searchParams.get("planId");
    const intentId = url.searchParams.get("intentId");
    const resumeStep = url.searchParams.get("resumeStep");

    if (planId) {
        const { hasPendingSubscription } = await import("~/services/package.server");
        const hasPending = await hasPendingSubscription(customerId);
        if (hasPending) {
            const returnUrl = url.searchParams.get("returnUrl") || "/customer/wallets";
            return redirect(`${returnUrl}?toastMessage=errors.pendingSubscriptionExists&toastType=error`);
        }
    }

    // Payment methods, as configured by an admin in xaosao-admin.
    // Bank defaults to on so an unconfigured install still shows the QR
    // rather than an empty screen.
    let paymentQrUrl = "/images/qr-code.jpeg";
    let bankEnabled = true;
    let cryptoEnabled = false;
    let cryptoAddress = "";
    let cryptoNetwork = "BEP20";
    let usdRate = 21500;
    try {
        const { prisma } = await import("~/services/database.server");
        const rows = await prisma.system_config.findMany({
            where: {
                key: {
                    in: [
                        "payment_qr_code",
                        "payment_bank_enabled",
                        "payment_crypto_enabled",
                        "payment_crypto_address",
                        "payment_crypto_network",
                    ],
                },
            },
            select: { key: true, value: true },
        });
        const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        if (cfg.payment_qr_code) paymentQrUrl = cfg.payment_qr_code;
        bankEnabled = cfg.payment_bank_enabled !== "false";
        cryptoEnabled = cfg.payment_crypto_enabled === "true";
        cryptoAddress = cfg.payment_crypto_address ?? "";
        cryptoNetwork = cfg.payment_crypto_network || "BEP20";
        const rate = Number(cfg.payment_usd_rate);
        if (rate > 0) usdRate = rate;
    } catch {}

    // Customers in Laos keep the flow they already know: kip, bank QR, no
    // method chooser. Everyone else picks a method first and can pay in
    // crypto, priced in dollars. An unknown country counts as Laos — see
    // geo.server for why.
    const { isHomeCountry } = await import("~/services/geo.server");
    const atHome = await isHomeCountry(request);

    // The chooser only earns its step when there is a genuine choice.
    const showMethodChooser = !atHome && bankEnabled && cryptoEnabled;

    return {
        suggestedAmount: suggestedAmount ? parseInt(suggestedAmount, 10) : null,
        planId: planId || null,
        intentId: intentId || null,
        resumeStep: resumeStep ? Number(resumeStep) : null,
        paymentQrUrl,
        bankEnabled,
        cryptoEnabled,
        cryptoAddress,
        cryptoNetwork,
        usdRate,
        atHome,
        showMethodChooser,
    };
};

export async function action({ request }: Route.ActionArgs) {
    const customerId = await requireUserSession(request);
    const formData = await request.formData();
    const _action = formData.get("_action");

    // ── Create intent (called when customer enters step 2) ──────────────────
    if (_action === "create_intent") {
        try {
            const { createTopUpIntent } = await import("~/services/wallet.server");
            const amount = Number(formData.get("amount"));
            const intent = await createTopUpIntent(amount, customerId);
            return { success: true, intentId: intent.id };
        } catch (error: any) {
            return { success: false, error: true, message: error.message || "Failed to save intent" };
        }
    }

    // ── Main submit (step 3 — slip upload) ──────────────────────────────────
    const { topUpWallet } = await import("~/services/wallet.server");
    const { createPendingSubscription } = await import("~/services/package.server");
    const transactionData = Object.fromEntries(formData) as Partial<ITransactionCredentials>;
    const amount = formData.get("amount");
    const planId = formData.get("planId") as string | null;
    const intentId = formData.get("intentId") as string | null;

    if (request.method === "POST") {
        try {
            const numericAmount = Number(amount);
            const url = new URL(request.url);
            const suggestedAmount = url.searchParams.get("amount");
            const minAmount = suggestedAmount ? Math.max(Number(suggestedAmount), 10000) : 10000;

            if (!numericAmount || numericAmount < minAmount) {
                return { success: false, error: true, message: `wallet.topup.minimumAmount` };
            }

            const vouchers = formData.getAll("voucher");
            const paymentSlipUrls: string[] = [];
            const { resolveUserUploadPath } = await import("~/services/upload.server");
            const slipFolderPath = await resolveUserUploadPath("customer", customerId, "slip");

            for (const voucher of vouchers) {
                if (voucher && voucher instanceof File && voucher.size > 0) {
                    const fileSizeMB = voucher.size / (1024 * 1024);
                    if (fileSizeMB > 4) {
                        return {
                            success: false,
                            error: true,
                            message: `File is too large (${fileSizeMB.toFixed(1)}MB). Please compress the image or use a smaller file.`,
                        };
                    }
                    const buffer = Buffer.from(await voucher.arrayBuffer());
                    const url = await uploadFileToBunnyServer(buffer, voucher.name, voucher.type, slipFolderPath, "slip");
                    paymentSlipUrls.push(url);
                }
            }

            if (paymentSlipUrls.length === 0) {
                return { success: false, error: true, message: "wallet.topup.paymentSlipRequired" };
            }

            transactionData.amount = numericAmount;
            transactionData.paymentSlip = paymentSlipUrls;
            await validateTopUpInputs(transactionData as ITransactionCredentials);
            // Crypto top-ups arrive priced in dollars; `amount` is already
            // the kip equivalent. Pass what was really paid so the admin
            // approving it sees the dollar figure and the rate used.
            const paidCurrency = formData.get("paidCurrency") as string | null;
            const paidAmount = Number(formData.get("paidAmount"));
            const paidRate = Number(formData.get("usdRate"));
            const paidIn =
                paidCurrency && paidAmount > 0 && paidRate > 0
                    ? { currency: paidCurrency, amount: paidAmount, rate: paidRate }
                    : null;

            const res = await topUpWallet(
                paymentSlipUrls,
                Number(amount),
                customerId,
                intentId || undefined,
                paidIn
            );

            if (res.id) {
                if (planId) {
                    try {
                        await createPendingSubscription(customerId, planId, res.id);
                    } catch (subscriptionError: any) {
                        console.error("Error creating pending subscription:", subscriptionError);
                        if (subscriptionError?.payload?.message?.includes("pending subscription")) {
                            return { success: false, error: true, message: subscriptionError.payload.message };
                        }
                    }
                }

                const returnUrl = formData.get("return_url") as string;
                if (returnUrl) {
                    return redirect(`${returnUrl}?toastMessage=wallet.topup.depositSuccess&toastType=success`);
                }
                return redirect(`/customer/wallets?toastMessage=wallet.topup.depositSuccess&toastType=success`);
            }
        } catch (error: any) {
            console.error("Error updating customer:", error);
            if (error?.payload) return error.payload;
            if (error && typeof error === "object" && !Array.isArray(error)) {
                const keys = Object.keys(error);
                if (keys.length > 0) {
                    const firstKey = keys[0];
                    return { success: false, error: true, message: `${firstKey}: ${(error as any)[firstKey]}` };
                }
            }
            return { success: false, error: true, message: error || "Failed to create new top-up!" };
        }
    }
    return { success: false, error: true, message: "Invalid request method!" };
}

export default function WalletTopUpPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const submit = useSubmit();
    const actionData = useActionData<typeof action>();
    const loaderData = useLoaderData<typeof loader>();
    const intentFetcher = useFetcher<{ success: boolean; intentId?: string }>();

    const {
        suggestedAmount, planId, intentId: loaderIntentId, resumeStep, paymentQrUrl,
        bankEnabled, cryptoEnabled, cryptoAddress, cryptoNetwork,
        usdRate, atHome, showMethodChooser,
    } = loaderData;

    const [paymentMethod, setPaymentMethod] = React.useState<string>(
        loaderData.bankEnabled ? "qr" : "crypto"
    );

    // Foreign customers pick a method before anything else; customers in
    // Laos never see this and go straight into the kip flow.
    const [methodPicked, setMethodPicked] = React.useState<boolean>(
        !loaderData.showMethodChooser
    );

    // Crypto is priced in dollars. The kip figure is what actually gets
    // stored and credited — the conversion uses the admin's rate, and an
    // admin confirms the exact kip when approving, so a rate that drifted
    // between order and payment is caught there rather than here.
    const payingInUsd = paymentMethod === "crypto";
    const toKip = React.useCallback(
        (usd: number) => Math.round(usd * usdRate),
        [usdRate]
    );
    // Amounts are entered in whatever currency the chosen method uses:
    // kip for the bank, dollars for crypto. `amount` always holds the
    // figure in the DISPLAYED currency; `amountInKip` below is what gets
    // submitted.
    const MIN_AMOUNT = payingInUsd
        ? 5
        : suggestedAmount || 10000;

    const [step, setStep] = React.useState<number>(resumeStep || 1);
    const [dragOver, setDragOver] = React.useState<boolean>(false);
    const [amount, setAmount] = React.useState<number>(suggestedAmount || 0);
    const [copiedAccount, setCopiedAccount] = React.useState<boolean>(false);
    const [uploadedFiles, setUploadedFiles] = React.useState<File[]>([]);
    const [previewSlips, setPreviewSlips] = React.useState<string[]>([]);
    const [isCompressing, setIsCompressing] = React.useState<boolean>(false);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [showExamplePreview, setShowExamplePreview] = React.useState(false);
    const [returnUrl, setReturnUrl] = React.useState<string>("");

    // intentId — from URL (resume flow) or created fresh when entering step 2
    const [intentId, setIntentId] = React.useState<string | null>(loaderIntentId);

    // Warning modal state
    // pendingAction: 'proceed' = going step1→2,  'goback' = going step2→1
    const [showSlipWarning, setShowSlipWarning] = React.useState(false);
    const [pendingAction, setPendingAction] = React.useState<'proceed' | 'goback' | null>(null);

    const MAX_SLIPS = 3;

    React.useEffect(() => {
        try {
            const storedReturnUrl = sessionStorage.getItem("topup_return_url");
            if (storedReturnUrl) setReturnUrl(storedReturnUrl);
        } catch {}
    }, []);

    // When the intent fetcher returns a new intentId, store it
    React.useEffect(() => {
        if (intentFetcher.data?.success && intentFetcher.data.intentId) {
            setIntentId(intentFetcher.data.intentId);
        }
    }, [intentFetcher.data]);

    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "POST";
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const quickAmounts = payingInUsd
        ? [5, 10, 20, 50, 100]
        : [50000, 100000, 200000, 500000, 1000000];

    /** Kip equivalent of what the customer typed, for storage. */
    const amountInKip = payingInUsd ? toKip(amount) : amount;


    const bankAccount = "1234567890123456";
    const bankName = "ທະນະຄານການຄ້າມະຫາຊົນ";
    const accountName = "XAOSAO XAOSAO";

    // Only the methods an admin switched on. If they turn the bank off and
    // crypto on, the QR option disappears entirely rather than sitting
    // there pointing at a QR nobody is watching.
    const paymentMethods = [
        ...(bankEnabled
            ? [{
                id: "qr",
                name: t('wallet.topup.qrCode'),
                icon: QrCode,
                description: t('wallet.topup.qrCodeDescription'),
            }]
            : []),
        ...(cryptoEnabled
            ? [{
                id: "crypto",
                name: t('wallet.topup.crypto', { defaultValue: 'Cryptocurrency' }),
                icon: Wallet,
                description: t('wallet.topup.cryptoDescription', {
                    defaultValue: `Send to our ${cryptoNetwork} wallet`,
                }),
            }]
            : []),
    ];

    function closeHandler() {
        let storedUrl: string | null = null;
        try { storedUrl = sessionStorage.getItem("topup_return_url"); } catch {}
        if (storedUrl) {
            try { sessionStorage.removeItem("topup_return_url"); } catch {}
            navigate(storedUrl);
        } else {
            navigate("/customer/wallets");
        }
    }

    // Intercept step transitions that need the warning modal
    function handleContinue() {
        if (step === 1) {
            // Show warning before proceeding to step 2
            setPendingAction('proceed');
            setShowSlipWarning(true);
        } else if (step === 2) {
            setStep(3);
        } else if (step === 3) {
            handleManualSubmit();
        }
    }

    function handleBack() {
        if (step === 2) {
            // Show warning before going back to step 1
            setPendingAction('goback');
            setShowSlipWarning(true);
        } else if (step > 1) {
            setStep(step - 1);
        }
    }

    // Called when the customer confirms the warning modal
    function handleWarningConfirm() {
        setShowSlipWarning(false);
        if (pendingAction === 'proceed') {
            // Create the intent record and move to step 2
            const fd = new FormData();
            fd.append("_action", "create_intent");
            // Always kip: the wallet, the transaction and the admin's
            // approval screen all work in kip. Dollars are display only.
            fd.append("amount", String(amountInKip));
            intentFetcher.submit(fd, { method: "post" });
            setStep(2);
        } else if (pendingAction === 'goback') {
            setStep(1);
        }
        setPendingAction(null);
    }

    function handleWarningCancel() {
        setShowSlipWarning(false);
        setPendingAction(null);
        // Stay exactly where we are — no step change
    }

    const downloadQR = () => {
        const link = document.createElement("a");
        link.href = paymentQrUrl;
        link.download = "payment-qr-code.jpeg";
        link.click();
    };

    const copyAccountNumber = () => {
        navigator.clipboard.writeText(bankAccount);
        setCopiedAccount(true);
        setTimeout(() => setCopiedAccount(false), 2000);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        if (uploadedFiles.length >= MAX_SLIPS) return;
        const droppedFiles = Array.from(e.dataTransfer.files).filter(
            file => file.type.startsWith("image/") || file.type === "application/pdf"
        );
        if (droppedFiles.length > 0) handleFileUpload(droppedFiles);
    };

    const isWebpFile = (file: File): boolean => {
        const type = file.type.toLowerCase();
        const name = file.name.toLowerCase();
        return type === 'image/webp' || name.endsWith('.webp');
    };

    const handleFileUpload = async (files: File[]) => {
        setUploadError(null);
        const remaining = MAX_SLIPS - uploadedFiles.length;
        if (remaining <= 0) {
            setUploadError(t('wallet.topup.maxSlipsReached', { defaultValue: `Maximum ${MAX_SLIPS} payment slips allowed.` }));
            return;
        }
        const filesToProcess = files.slice(0, remaining);
        if (files.length > remaining) {
            setUploadError(t('wallet.topup.someFilesSkipped', { defaultValue: `Only ${remaining} more slip(s) allowed. Extra files were skipped.` }));
        }

        const processedFiles: File[] = [];
        const newPreviews: string[] = [];

        for (const file of filesToProcess) {
            if (isWebpFile(file)) {
                setUploadError(t('wallet.topup.webpNotSupported', { defaultValue: 'WebP format is not supported. Please use JPG or PNG instead.' }));
                continue;
            }
            const fileSizeMB = file.size / (1024 * 1024);
            if (fileSizeMB > MAX_FILE_SIZE_MB) {
                setUploadError(t('wallet.topup.fileTooLarge', { defaultValue: `File is too large (${fileSizeMB.toFixed(1)}MB). Maximum allowed size is ${MAX_FILE_SIZE_MB}MB.`, size: fileSizeMB.toFixed(1), maxSize: MAX_FILE_SIZE_MB }));
                continue;
            }
            let processedFile = file;
            if (file.type.startsWith("image/") && file.type !== "application/pdf") {
                try {
                    setIsCompressing(true);
                    processedFile = await compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.8, maxSizeMB: COMPRESSED_MAX_SIZE_MB });
                } catch (compressionError: any) {
                    console.error('[TopUp] Compression error:', compressionError);
                    setUploadError(compressionError.message || t('wallet.topup.compressionFailed', { defaultValue: 'Failed to process image. Please try a different file.' }));
                    continue;
                } finally {
                    setIsCompressing(false);
                }
            }
            const finalSizeMB = processedFile.size / (1024 * 1024);
            if (finalSizeMB > 4) {
                setUploadError(t('wallet.topup.fileTooLargeAfterCompression', { defaultValue: `File is still too large after compression (${finalSizeMB.toFixed(1)}MB). Please use a smaller image.`, size: finalSizeMB.toFixed(1) }));
                continue;
            }
            processedFiles.push(processedFile);
            newPreviews.push(URL.createObjectURL(processedFile));
        }

        if (processedFiles.length > 0) {
            const allFiles = [...uploadedFiles, ...processedFiles];
            setUploadedFiles(allFiles);
            setPreviewSlips(prev => [...prev, ...newPreviews]);
            if (fileInputRef.current) {
                const dt = new DataTransfer();
                allFiles.forEach(f => dt.items.add(f));
                fileInputRef.current.files = dt.files;
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) handleFileUpload(Array.from(files));
        if (e.target) e.target.value = "";
    };

    const removeFile = (index: number) => {
        const newFiles = uploadedFiles.filter((_, i) => i !== index);
        const newPreviews = previewSlips.filter((_, i) => i !== index);
        setUploadedFiles(newFiles);
        setPreviewSlips(newPreviews);
        setUploadError(null);
        if (fileInputRef.current) {
            const dt = new DataTransfer();
            newFiles.forEach(f => dt.items.add(f));
            fileInputRef.current.files = dt.files;
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(false); };

    const handleManualSubmit = () => {
        const formData = new FormData();
        formData.append("amount", String(amountInKip ?? 0));
        // Carried so the admin approving this can see what the customer
        // actually paid, and at what rate, rather than reverse-engineering
        // it from a kip figure.
        if (payingInUsd) {
            formData.append("paidCurrency", "USD");
            formData.append("paidAmount", String(amount ?? 0));
            formData.append("usdRate", String(usdRate));
        }
        if (planId) formData.append("planId", planId);
        if (returnUrl) formData.append("return_url", returnUrl);
        if (intentId) formData.append("intentId", intentId);
        uploadedFiles.forEach(file => formData.append("voucher", file));
        submit(formData, { method: "post", encType: "multipart/form-data" });
    };

    const canProceed = () => {
        switch (step) {
            case 1: return amount && amount >= MIN_AMOUNT;
            case 2: return paymentMethod;
            case 3: return uploadedFiles.length > 0 && !uploadError && !isCompressing;
            default: return false;
        }
    };

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="p-0 sm:p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('wallet.topup.amount')}{" "}
                                <span className="font-semibold text-gray-900">
                                    ({payingInUsd ? "USD" : "LAK"})
                                </span>{" "}
                                <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="amount"
                                    value={amount != null ? amount.toLocaleString() : ""}
                                    onChange={(e) => {
                                        const rawValue = e.target.value.replace(/,/g, '');
                                        if (rawValue === '') { setAmount(0); }
                                        else { const n = Number(rawValue); if (!isNaN(n)) setAmount(n); }
                                    }}
                                    placeholder={t('wallet.topup.amountPlaceholder')}
                                    className={`block w-full p-4 py-2 border rounded-md text-md font-semibold focus:ring-1 focus:ring-rose-200 focus:border-rose-500 outline-none transition-colors ${amount > 0 && amount < MIN_AMOUNT ? 'border-red-500' : 'border-gray-300'}`}
                                />
                            </div>
                            {amount > 0 && amount < MIN_AMOUNT && (
                                <p className="text-xs text-red-500 mt-1">
                                    {payingInUsd
                                        ? t('wallet.topup.minimumAmountUsd', {
                                            defaultValue: `Minimum amount is $${MIN_AMOUNT}`,
                                            amount: MIN_AMOUNT,
                                        })
                                        : t('wallet.topup.minimumAmount', { defaultValue: `Minimum amount is ${MIN_AMOUNT.toLocaleString()} Kip`, amount: MIN_AMOUNT.toLocaleString() })}
                                </p>
                            )}
                            {/* The kip figure is what actually lands in the
                                wallet, so show it rather than leaving the
                                customer to guess at the conversion. */}
                            {payingInUsd && amount >= MIN_AMOUNT && (
                                <p className="mt-1 text-xs text-gray-500">
                                    {t('wallet.topup.usdApprox', {
                                        defaultValue: `≈ ${amountInKip.toLocaleString()} ₭ at ${usdRate.toLocaleString()} ₭ per $1`,
                                        kip: amountInKip.toLocaleString(),
                                        rate: usdRate.toLocaleString(),
                                    })}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                {t('wallet.topup.quickAmount')} {payingInUsd ? "(USD)" : "(Kip)"}
                            </label>
                            <div className="grid grid-cols-5 gap-1 sm:gap-2">
                                {quickAmounts.map((quickAmount) => (
                                    <button
                                        type="button"
                                        key={quickAmount}
                                        onClick={() => setAmount(quickAmount)}
                                        className={`cursor-pointer py-2 px-1 sm:px-3 border rounded-lg text-xs font-medium transition-colors ${amount === quickAmount ? "border-rose-500 bg-rose-500 text-white" : "border-gray-200 hover:border-rose-500 hover:text-rose-500"}`}
                                    >
                                        {payingInUsd ? `$${quickAmount}` : formatCurrency1(quickAmount)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="p-0 sm:p-4 space-y-4">
                        <div>
                            <div className="flex items-center justify-between gap-2">
                                {paymentMethods.map((method) => (
                                    <button
                                        key={method.id}
                                        type="button"
                                        onClick={() => setPaymentMethod(method.id)}
                                        className={`cursor-pointer w-full py-2 px-4 border rounded-md flex items-start sm:items-center space-x-3 transition-colors ${paymentMethod === method.id ? "border-rose-500 bg-rose-50" : "border-gray-200 hover:border-gray-300"}`}
                                    >
                                        <method.icon className={`hidden sm:block h-6 w-6 ${paymentMethod === method.id ? "text-rose-500" : "text-gray-400"}`} />
                                        <div className="text-left">
                                            <div className="text-sm font-medium text-gray-900">{method.name}</div>
                                            <div className="text-xs sm:text-sm text-gray-500">{method.description}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {paymentMethod === "qr" && (
                            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center">
                                <div className="w-48 mx-auto mb-4 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                                    <img src={paymentQrUrl} alt="QR-code" className="w-full h-auto object-contain" />
                                </div>
                                <button
                                    type="button"
                                    onClick={downloadQR}
                                    className="inline-flex items-center space-x-2 px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
                                >
                                    <Download className="h-4 w-4" />
                                    <span className="text-sm">{t('wallet.topup.downloadQRCode')}</span>
                                </button>
                                <p className="text-sm text-gray-500 mt-2">
                                    {t('wallet.topup.scanQRInstruction')}
                                </p>
                            </div>
                        )}

                        {paymentMethod === "crypto" && (
                            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-gray-900">
                                        {t('wallet.topup.crypto', { defaultValue: 'Cryptocurrency' })}
                                    </h4>
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                        {cryptoNetwork}
                                    </span>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-500">
                                        {t('wallet.topup.cryptoAddressLabel', { defaultValue: 'Wallet address' })}
                                    </p>
                                    <p className="mt-1 break-all rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-900">
                                        {cryptoAddress}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard?.writeText(cryptoAddress).catch(() => {});
                                    }}
                                    className="inline-flex items-center space-x-2 rounded-lg bg-rose-500 px-4 py-2 text-white transition-colors hover:bg-rose-600"
                                >
                                    <span className="text-sm">
                                        {t('wallet.topup.copyAddress', { defaultValue: 'Copy address' })}
                                    </span>
                                </button>

                                {/* The network warning is the important part: the
                                    same 0x address exists on several chains, and
                                    sending over the wrong one loses the money. */}
                                <p className="text-xs text-amber-700">
                                    {t('wallet.topup.cryptoNetworkWarning', {
                                        defaultValue: `Send only over the ${cryptoNetwork} network. Funds sent on another network cannot be recovered.`,
                                    })}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {t('wallet.topup.scanQRInstruction')}
                                </p>
                            </div>
                        )}

                        {paymentMethod === "bank" && (
                            <div className="bg-white border border-gray-200 rounded-xl p-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-4">{t('wallet.topup.bankTransferDetails')}</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <div className="text-sm text-gray-600">{t('wallet.topup.bankName')}</div>
                                            <div className="text-sm font-medium">{bankName}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <div className="text-sm text-gray-600">{t('wallet.topup.accountName')}</div>
                                            <div className="text-sm font-medium">{accountName}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <div className="text-sm text-gray-600">{t('wallet.topup.accountNumber')}</div>
                                            <div className="text-sm font-mono font-medium">{bankAccount}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={copyAccountNumber}
                                            className="flex items-center space-x-1 p-2 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors cursor-pointer"
                                        >
                                            {copiedAccount ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Reminder shown inline on step 2 so customer never forgets */}
                        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-700">
                                {t('wallet.topup.slipReminderInline', { defaultValue: 'ຫຼັງຈາກໂອນເງິນສຳເລັດ, ກະລຸນາກັບມາອັບໂຫລດໃບຊຳລະເງິນໃນຂັ້ນຕອນຕໍ່ໄປ.' })}
                            </p>
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="p-0 sm:p-6 space-y-3 sm:space-y-6">
                        <div>
                            <input type="text" name="amount" value={amount ?? 0} className="hidden" readOnly />
                            {uploadedFiles.length > 0 && (
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {uploadedFiles.map((file, index) => (
                                        <div key={index} className="relative border border-green-300 bg-green-50 rounded-lg p-2 text-center">
                                            {previewSlips[index] && (
                                                <img src={previewSlips[index]} alt={`Slip ${index + 1}`} className="h-20 w-full object-contain rounded" />
                                            )}
                                            <p className="text-[10px] text-green-700 mt-1 truncate">{file.name}</p>
                                            <button
                                                type="button"
                                                onClick={() => removeFile(index)}
                                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center cursor-pointer hover:bg-red-600"
                                            >
                                                x
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                className={`border-2 border-dashed rounded-xl p-2 text-center transition-colors ${dragOver ? "border-rose-500 bg-rose-50" : isCompressing ? "border-blue-500 bg-blue-50" : uploadedFiles.length >= MAX_SLIPS ? "border-gray-200 bg-gray-50" : "border-gray-300 hover:border-gray-400"}`}
                            >
                                {isCompressing ? (
                                    <div className="space-y-4 py-4">
                                        <Loader className="h-8 w-8 text-blue-500 mx-auto animate-spin" />
                                        <div>
                                            <div className="font-medium text-blue-700">{t('wallet.topup.compressing', { defaultValue: 'Compressing image...' })}</div>
                                            <div className="text-sm text-blue-500 mt-1">{t('wallet.topup.pleaseWait', { defaultValue: 'Please wait' })}</div>
                                        </div>
                                    </div>
                                ) : uploadedFiles.length >= MAX_SLIPS ? (
                                    <div className="py-3">
                                        <p className="text-sm text-gray-500">
                                            {t('wallet.topup.maxSlipsReached', { defaultValue: `Maximum ${MAX_SLIPS} payment slips uploaded.` })}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <Upload className="h-6 w-6 text-gray-400 mx-auto" />
                                        <div>
                                            <div className="font-medium text-gray-700">
                                                {uploadedFiles.length > 0
                                                    ? t('wallet.topup.addMoreSlips', { defaultValue: 'Add more payment slips' })
                                                    : t('wallet.topup.dropVoucherHere')
                                                }
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                {t('wallet.topup.slipCount', { defaultValue: `${uploadedFiles.length}/${MAX_SLIPS} slips uploaded`, current: uploadedFiles.length, max: MAX_SLIPS })}
                                            </div>
                                        </div>
                                        <label
                                            htmlFor="file-upload"
                                            className="text-sm inline-block px-4 py-2 bg-rose-500 text-white rounded-lg cursor-pointer hover:bg-rose-600 transition-colors"
                                        >
                                            {t('wallet.topup.chooseFile')}
                                        </label>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    ref={fileInputRef}
                                    name="voucher"
                                    multiple
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="file-upload"
                                />
                            </div>

                            <p className="text-xs text-gray-500 mt-2">{t('wallet.topup.supportedFormats')}</p>
                            {uploadError && (
                                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded-lg">
                                    <p className="text-red-600 text-xs text-center">{uploadError}</p>
                                </div>
                            )}
                        </div>

                        {uploadedFiles.length === 0 && (
                            <div className="rounded-lg p-3">
                                <div className="flex items-center space-x-2 mb-2">
                                    <ImageIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                    <p className="text-xs font-medium text-blue-700">
                                        {t('wallet.topup.exampleSlip', { defaultValue: 'Example payment slip' })}
                                    </p>
                                </div>
                                <button type="button" onClick={() => setShowExamplePreview(true)} className="w-full cursor-pointer">
                                    <img src="/images/payment.jpg" alt="Example payment slip" className="max-h-40 object-contain object-left rounded-md bg-white" />
                                </button>
                            </div>
                        )}

                        {showExamplePreview && (
                            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowExamplePreview(false)}>
                                <button
                                    type="button"
                                    onClick={() => setShowExamplePreview(false)}
                                    className="absolute top-4 right-4 z-50 w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                                <img src="/images/payment.jpg" alt="Example payment slip" className="max-w-full max-h-[85vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
                            </div>
                        )}

                        <div className="p-4 bg-amber-50 rounded-lg">
                            <div className="flex items-start space-x-2">
                                <Clock className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-amber-700">
                                    <strong>{t('wallet.topup.processingTime')}</strong> {t('wallet.topup.processingTimeDescription')}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="p-0 sm:p-6 text-center space-y-4">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle className="h-6 w-6 text-green-500" />
                        </div>
                        <h3 className="text-md font-semibold text-gray-900 mb-2">{t('wallet.topup.requestSubmitted')}</h3>
                        <p className="text-sm text-gray-600">{t('wallet.topup.requestSubmittedDescription')}</p>
                    </div>
                );

            default:
                return null;
        }
    };

    // Method first, for customers outside Laos. Shown instead of the step
    // flow rather than as a step zero, so the progress dots and the
    // back/next wiring below stay exactly as they were.
    if (!methodPicked) {
        return (
            <Modal onClose={closeHandler} className="w-full h-screen sm:h-auto sm:w-2/4 space-y-2 py-8 px-2 sm:px-4 sm:p-0 border">
                <div className="px-6 pt-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {t('wallet.topup.choosePaymentMethod', { defaultValue: 'How would you like to pay?' })}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        {t('wallet.topup.choosePaymentMethodHint', {
                            defaultValue: 'Pick a method to continue. Crypto is priced in US dollars.',
                        })}
                    </p>
                </div>

                <div className="px-6 py-6 space-y-3">
                    {bankEnabled && (
                        <button
                            type="button"
                            onClick={() => { setPaymentMethod("qr"); setMethodPicked(true); }}
                            className="w-full rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-rose-400 hover:bg-rose-50"
                        >
                            <div className="flex items-center space-x-3">
                                <QrCode className="h-6 w-6 text-rose-500" />
                                <div>
                                    <div className="text-sm font-medium text-gray-900">
                                        {t('wallet.topup.qrCode')}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {t('wallet.topup.qrCodeDescription')}
                                    </div>
                                    <div className="mt-1 text-xs font-medium text-gray-700">₭ LAK</div>
                                </div>
                            </div>
                        </button>
                    )}

                    {cryptoEnabled && (
                        <button
                            type="button"
                            onClick={() => { setPaymentMethod("crypto"); setMethodPicked(true); }}
                            className="w-full rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-rose-400 hover:bg-rose-50"
                        >
                            <div className="flex items-center space-x-3">
                                <Wallet className="h-6 w-6 text-rose-500" />
                                <div>
                                    <div className="text-sm font-medium text-gray-900">
                                        {t('wallet.topup.crypto', { defaultValue: 'Cryptocurrency' })}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {t('wallet.topup.cryptoDescription', {
                                            defaultValue: `Send to our ${cryptoNetwork} wallet`,
                                        })}
                                    </div>
                                    <div className="mt-1 text-xs font-medium text-gray-700">$ USD</div>
                                </div>
                            </div>
                        </button>
                    )}
                </div>

                <div className="px-6 pb-6">
                    <button
                        type="button"
                        onClick={closeHandler}
                        className="text-sm text-gray-500 underline"
                    >
                        {t('common.cancel', { defaultValue: 'Cancel' })}
                    </button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal onClose={closeHandler} className="w-full h-screen sm:h-auto sm:w-2/4 space-y-2 py-8 px-2 sm:px-4 sm:p-0 border">
            {/* ── Slip warning modal ─────────────────────────────────────── */}
            {showSlipWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">
                                {t('wallet.topup.warningTitle', { defaultValue: 'ຈຳໄວ້!' })}
                            </h3>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            {t('wallet.topup.warningMessage', {
                                defaultValue: 'ຫຼັງຈາກທ່ານໂອນເງິນສຳເລັດ, ທ່ານ​ຕ້ອງ​ກັບ​ມາ​ອັບ​ໂຫລດ​ໃບ​ຊຳ​ລະ​ເງິນ ເພື່ອ​ສຳ​ເລັດ​ການ​ເຕີມ​ເງິນ. ຖ້າ​ທ່ານ​ບໍ່​ອັບ​ໂຫລດ, ຍອດ​ເງິນ​ຂອງ​ທ່ານ​ຈະ​ບໍ່​ຖືກ​ອັບ​ເດດ.',
                            })}
                        </p>
                        <div className="flex gap-3 pt-1">
                            <button
                                type="button"
                                onClick={handleWarningCancel}
                                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                                {pendingAction === 'proceed'
                                    ? t('wallet.topup.warningCancel', { defaultValue: 'ຍ້ອນກັບ' })
                                    : t('wallet.topup.warningStay', { defaultValue: 'ຢູ່ໜ້ານີ້' })}
                            </button>
                            <button
                                type="button"
                                onClick={handleWarningConfirm}
                                className="flex-1 px-4 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors cursor-pointer"
                            >
                                {pendingAction === 'proceed'
                                    ? t('wallet.topup.warningProceed', { defaultValue: 'ເຂົ້າໃຈແລ້ວ, ດຳເນີນຕໍ່' })
                                    : t('wallet.topup.warningGoBack', { defaultValue: 'ເຂົ້າໃຈແລ້ວ, ຍ້ອນກັບ' })}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Form method="post" encType="multipart/form-data" className="space-y-4 mt-10 sm:mt-0">
                {returnUrl && <input type="hidden" name="return_url" value={returnUrl} />}
                {planId && <input type="hidden" name="planId" value={planId} />}
                {intentId && <input type="hidden" name="intentId" value={intentId} />}

                <div className="space-y-1">
                    <h1 className="text-lg text-gray-800">
                        {step === 1 && t('wallet.topup.steps.amount')}
                        {step === 2 && t('wallet.topup.steps.payment')}
                        {step === 3 && t('wallet.topup.steps.upload')}
                        {step === 4 && t('wallet.topup.steps.confirmation')}
                    </h1>
                </div>

                {renderStepContent()}

                <div className="px-8">
                    {actionData?.error && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-lg flex items-center space-x-2 backdrop-blur-sm">
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <span className="text-red-500 text-sm">{capitalize(t(actionData.message))}</span>
                        </div>
                    )}
                </div>

                <div className="px-6 flex items-center justify-between mt-8 pb-20 sm:pb-4">
                    <div className="flex space-x-1">
                        {[1, 2, 3, 4].map((stepNum) => (
                            <div
                                key={stepNum}
                                className={`w-2 h-2 rounded-full ${stepNum === step ? "bg-rose-500" : stepNum < step ? "bg-green-500" : "bg-gray-300"}`}
                            />
                        ))}
                    </div>

                    <div className="flex space-x-3">
                        {step === 1 && (
                            <button
                                type="button"
                                onClick={() => navigate("/customer/wallets")}
                                className="cursor-pointer px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                            >
                                {t('wallet.topup.close')}
                            </button>
                        )}
                        {step > 1 && step < 4 && (
                            <button
                                type="button"
                                onClick={handleBack}
                                className="cursor-pointer px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                            >
                                {t('wallet.topup.back')}
                            </button>
                        )}

                        {step < 4 ? (
                            <button
                                type="button"
                                onClick={handleContinue}
                                disabled={!canProceed()}
                                className="flex items-center justify-center text-sm cursor-pointer px-6 py-2 bg-rose-500 text-white rounded-md hover:bg-rose-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                                {step === 3 && isSubmitting && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                                {step === 3 ? isSubmitting ? t('wallet.topup.submitting') : t('wallet.topup.submit') : t('wallet.topup.continue')}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={closeHandler}
                                className="text-sm cursor-pointer px-6 py-2 bg-rose-500 text-white rounded-md hover:bg-rose-600 transition-colors"
                            >
                                {t('wallet.topup.done')}
                            </button>
                        )}
                    </div>
                </div>
            </Form>
        </Modal>
    );
}
