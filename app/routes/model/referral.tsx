import React from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { LoaderFunctionArgs } from 'react-router';
import { Copy, Share2, Users, Gift, CheckCircle, Sparkles, UserPlus, BadgeCheck, Wallet, Star, Crown, AlertCircle, TrendingUp, ArrowLeft, X, ShieldCheck, ShieldAlert, QrCode } from 'lucide-react';

import { formatCurrency } from '~/utils';
import { Button } from '~/components/ui/button';
import { ReferralQRModal } from '~/components/ReferralQRModal';
import { requireModelSession } from '~/services/model-auth.server';
import { getReferralStats } from '~/services/referral.server';

interface LoaderReturn {
    referralStats: Awaited<ReturnType<typeof getReferralStats>>;
}

export async function loader({ request }: LoaderFunctionArgs) {
    const modelId = await requireModelSession(request);

    // Get real referral stats from database
    const referralStats = await getReferralStats(modelId);

    return { referralStats };
}

export default function ModelReferralPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { referralStats } = useLoaderData<LoaderReturn>();
    const [copied, setCopied] = React.useState<'code' | 'link' | 'customerLink' | null>(null);
    const [shareModalOpen, setShareModalOpen] = React.useState<'model' | 'customer' | null>(null);
    const [qrModalOpen, setQrModalOpen] = React.useState<'model' | 'customer' | null>(null);

    const isSpecialOrPartner = referralStats.modelType === 'special' || referralStats.modelType === 'partner';

    // Social media share functions
    const socialShareOptions = [
        {
            name: 'WhatsApp',
            icon: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
            ),
            color: 'bg-green-500 hover:bg-green-600',
            // Use whatsapp:// protocol for mobile apps, falls back to web
            getShareUrl: (link: string, text: string) => `https://api.whatsapp.com/send?text=${encodeURIComponent(text + '\n\n' + link)}`
        },
        {
            name: 'Line',
            icon: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
            ),
            color: 'bg-green-500 hover:bg-green-600',
            // Line share URL
            getShareUrl: (link: string, text: string) => `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
        },
        {
            name: 'Facebook',
            icon: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
            ),
            color: 'bg-blue-600 hover:bg-blue-700',
            getShareUrl: (link: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`
        },
        {
            name: 'Telegram',
            icon: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
            ),
            color: 'bg-sky-500 hover:bg-sky-600',
            getShareUrl: (link: string, text: string) => `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
        },
        {
            name: 'X',
            icon: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
            ),
            color: 'bg-black hover:bg-gray-800',
            getShareUrl: (link: string, text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`
        },
        {
            name: 'Message',
            icon: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
                    <path d="M7 9h10v2H7zm0-3h10v2H7z" />
                </svg>
            ),
            color: 'bg-green-600 hover:bg-green-700',
            // SMS protocol works on both iOS and Android
            getShareUrl: (link: string, text: string) => `sms:?&body=${encodeURIComponent(text + '\n\n' + link)}`
        },
    ];

    const handleSocialShare = (option: typeof socialShareOptions[0], link: string, isCustomer: boolean) => {
        const text = isCustomer
            ? t('modelReferral.shareCustomerText', 'Join XaoSao and connect with amazing models!')
            : t('modelReferral.shareText', { code: referralStats.referralCode });

        const shareUrl = option.getShareUrl(link, text);
        window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
        setShareModalOpen(null);
    };

    // Fallback copy method for mobile HTTP (non-HTTPS) environments
    const fallbackCopyToClipboard = (text: string): boolean => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
        } catch (err) {
            document.body.removeChild(textArea);
            return false;
        }
    };

    const copyToClipboard = async (text: string, type: 'code' | 'link' | 'customerLink') => {
        try {
            // Try modern clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for HTTP or older browsers
                const success = fallbackCopyToClipboard(text);
                if (!success) throw new Error('Fallback copy failed');
            }
            setCopied(type);
            setTimeout(() => setCopied(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            // Last resort: show alert with text to copy manually
            alert(`${t('modelReferral.copyManually', 'Copy this link:')}\n\n${text}`);
        }
    };

    // Get model type badge info
    const getModelTypeBadge = () => {
        switch (referralStats.modelType) {
            case 'partner':
                return {
                    icon: Crown,
                    label: t('modelReferral.modelTypes.partner', 'Partner'),
                    color: 'bg-purple-100 text-purple-700',
                    description: t('modelReferral.modelTypes.partnerDesc', '4% per booking, 40% per subscription')
                };
            case 'special':
                return {
                    icon: Star,
                    label: t('modelReferral.modelTypes.special', 'Special'),
                    color: 'bg-amber-100 text-amber-700',
                    description: t('modelReferral.modelTypes.specialDesc', '2% per booking, 20% per subscription')
                };
            default:
                return {
                    icon: Users,
                    label: t('modelReferral.modelTypes.normal', 'Normal'),
                    color: 'bg-gray-100 text-gray-700',
                    description: t('modelReferral.modelTypes.normalDesc', '50,000 Kip per referral')
                };
        }
    };

    const typeBadge = getModelTypeBadge();
    const TypeIcon = typeBadge.icon;

    return (
        <div className="min-h-screen mb-16 sm:mb-0">
            <div className="max-w-3xl mx-auto p-4 space-y-4 my-4">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
                    <div className='flex gap-2'>
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="block sm:hidden text-sm inline-flex items-center gap-2 p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-4 h-4" />{t('wallet.topup.back')}
                        </button>
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${typeBadge.color}`}>
                            <TypeIcon className="w-4 h-4" />
                            <span className="font-semibold text-sm">{typeBadge.label}</span>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">{typeBadge.description}</p>
                </div>

                {/* Commission Eligibility Status for Special/Partner */}
                {isSpecialOrPartner && (
                    <div className={`rounded-lg p-4 ${referralStats.commissionEligible ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                        <div className="flex items-start gap-3">
                            {referralStats.commissionEligible ? (
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            )}
                            <div>
                                <p className={`font-medium ${referralStats.commissionEligible ? 'text-green-800' : 'text-amber-800'}`}>
                                    {referralStats.commissionEligible
                                        ? t('modelReferral.eligibleForCommission', 'Commission Eligible')
                                        : t('modelReferral.notEligibleYet', 'Not Eligible Yet')}
                                </p>
                                {!referralStats.commissionEligible && (
                                    <p className="text-sm text-amber-700 mt-1">{referralStats.commissionEligibilityReason}</p>
                                )}
                                {referralStats.commissionEligible && (
                                    <p className="text-sm text-green-700 mt-1">
                                        {t('modelReferral.earningCommissions', 'You are earning commissions from your referrals!')}
                                    </p>
                                )}
                            </div>
                        </div>
                        {/* Progress indicators */}
                        {!referralStats.commissionEligible && (
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">{t('modelReferral.modelsReferred', 'Models referred')}:</span>
                                    <span className="font-medium">{referralStats.upgradeProgress?.currentApprovedModels || 0} / {referralStats.upgradeProgress?.modelThreshold || 20}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-amber-500 h-2 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, ((referralStats.upgradeProgress?.currentApprovedModels || 0) / (referralStats.upgradeProgress?.modelThreshold || 20)) * 100)}%` }}
                                    />
                                </div>
                                {referralStats.modelType === 'partner' && (
                                    <>
                                        <div className="flex items-center justify-between text-sm mt-2">
                                            <span className="text-gray-600">{t('modelReferral.commissionEarnings', 'Commission earnings')}:</span>
                                            <span className="font-medium">{formatCurrency(referralStats.upgradeProgress?.currentCommissionEarnings || 0)} / {formatCurrency(referralStats.upgradeProgress?.earningsThreshold || 2000000)}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-purple-500 h-2 rounded-full transition-all"
                                                style={{ width: `${Math.min(100, referralStats.upgradeProgress?.partnerEarningsProgress || 0)}%` }}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Main Referral Card */}
                <div className="bg-gradient-to-r from-rose-600 to-rose-400 rounded-md p-6 text-white relative overflow-hidden shadow-xl space-y-4">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-16 translate-y-16"></div>
                    <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-white/5 rounded-full"></div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-0 sm:mb-4">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Gift className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-lg">{t('modelReferral.rewardInfo.title')}</p>
                                <p className="text-xs text-white/90">
                                    {referralStats.modelType === 'normal'
                                        ? t('modelReferral.rewardInfo.description')
                                        : t('modelReferral.rewardInfo.commissionDescription', 'Earn commissions from your referrals!')}
                                </p>
                            </div>
                        </div>

                        {/* Model Referral Link */}
                        <div className="flex flex-col sm:flex-row gap-4 mt-4 sm:mt-8">
                            <div className="w-full gap-3">
                                <p className="text-xs text-white mb-2 uppercase tracking-wide font-medium flex items-center gap-2">
                                    <UserPlus className="w-3 h-3" />
                                    {t('modelReferral.modelReferralLink', 'Model Referral Link')}
                                </p>
                                <div className="bg-white/20 flex items-center bg-gray-50 rounded-md p-3 relative z-20">
                                    <input
                                        type="text"
                                        readOnly
                                        value={referralStats.referralLink}
                                        className="flex-1 text-sm bg-transparent text-white truncate outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShareModalOpen('model')}
                                        className="text-rose-500 hover:text-rose-600 p-2 cursor-pointer hover:bg-white/20 rounded-md transition-colors flex items-center gap-1"
                                    >
                                        <Share2 className="w-5 h-5 text-white" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setQrModalOpen('model')}
                                        className="text-rose-500 hover:text-rose-600 p-2 cursor-pointer hover:bg-white/20 rounded-md transition-colors flex items-center gap-1"
                                    >
                                        <QrCode className="w-5 h-5 text-white" />
                                    </button>
                                </div>
                                {copied === 'link' && (
                                    <p className="text-xs text-green-300 mt-2">{t('modelReferral.linkCopied')}</p>
                                )}
                                <p className="text-xs text-white/70 mt-1">
                                    {referralStats.modelType === 'normal'
                                        ? t('modelReferral.earnPerModel', 'Earn 50,000 Kip for each approved model')
                                        : t('modelReferral.earnCommissionPerModel', 'Earn {rate}% of each referred model\'s bookings', { rate: referralStats.modelType === 'partner' ? 4 : 2 })}
                                </p>
                            </div>
                        </div>

                        {/* Customer Referral Link - Only for special/partner models */}
                        {isSpecialOrPartner && referralStats.customerReferralLink && (
                            <div className="flex flex-col sm:flex-row gap-4 mt-4">
                                <div className="w-full gap-3">
                                    <p className="text-xs text-white mb-2 uppercase tracking-wide font-medium flex items-center gap-2">
                                        <Users className="w-3 h-3" />
                                        {t('modelReferral.customerReferralLink', 'Customer Referral Link')}
                                    </p>
                                    <div className="bg-white/20 flex items-center bg-gray-50 rounded-md p-3 relative z-20">
                                        <input
                                            type="text"
                                            readOnly
                                            value={referralStats.customerReferralLink}
                                            className="flex-1 text-sm bg-transparent text-white truncate outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShareModalOpen('customer')}
                                            className="text-rose-500 hover:text-rose-600 p-2 cursor-pointer hover:bg-white/20 rounded-md transition-colors flex items-center gap-1"
                                        >
                                            <Share2 className="w-5 h-5 text-white" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setQrModalOpen('customer')}
                                            className="text-rose-500 hover:text-rose-600 p-2 cursor-pointer hover:bg-white/20 rounded-md transition-colors flex items-center gap-1"
                                        >
                                            <QrCode className="w-5 h-5 text-white" />
                                        </button>
                                    </div>
                                    {copied === 'customerLink' && (
                                        <p className="text-xs text-green-300 mt-2">{t('modelReferral.linkCopied')}</p>
                                    )}
                                    <p className="text-xs text-white/70 mt-1">
                                        {isSpecialOrPartner
                                            ? t('modelReferral.earnSubscriptionCommission', 'Earn {rate}% of each referred customer\'s subscriptions', { rate: referralStats.modelType === 'partner' ? 40 : 20 })
                                            : t('modelReferral.inviteCustomers', 'Invite customers to join XaoSao')}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Statistics Grid */}
                        <div className={`grid ${isSpecialOrPartner ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'} gap-3 mt-4`}>
                            <div className="flex items-center justify-center gap-3 border border-white/30 rounded-md bg-white py-2 px-3">
                                <div className="p-2 bg-blue-100 rounded-md">
                                    <UserPlus className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className='text-white'>
                                    <p className="text-sm sm:text-xl text-gray-800">{referralStats.stats.totalReferredModels}</p>
                                    <p className="text-xs text-gray-500">{t('modelReferral.stats.modelsReferred', 'Models')}</p>
                                </div>
                            </div>

                            {/* Customer count - only for special/partner */}
                            {isSpecialOrPartner && (
                                <div className="flex items-center justify-center gap-3 border border-white/30 rounded-md bg-white py-2 px-3">
                                    <div className="p-2 bg-purple-100 rounded-md">
                                        <Users className="w-4 h-4 text-purple-600" />
                                    </div>
                                    <div className='text-white'>
                                        <p className="text-sm sm:text-xl text-gray-800">{referralStats.stats.totalReferredCustomers}</p>
                                        <p className="text-xs text-gray-500">{t('modelReferral.stats.customersReferred', 'Customers')}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-center gap-3 bg-white py-2 px-3 rounded-md border border-white/30">
                                <div className="p-2 bg-rose-100 rounded-md">
                                    <Wallet className="w-4 h-4 text-rose-600" />
                                </div>
                                <div className='text-white space-y-1'>
                                    <p className="text-sm sm:text-xl text-gray-800">{formatCurrency(referralStats.stats.modelReferralEarnings)}</p>
                                    <p className="text-xs text-gray-500">{t('modelReferral.stats.totalEarnings')}</p>
                                </div>
                            </div>

                            {/* Commissions - only for special/partner */}
                            {isSpecialOrPartner && (
                                <div className="flex items-center justify-center gap-3 bg-white py-2 px-3 rounded-md border border-white/30">
                                    <div className="p-2 bg-green-100 rounded-md">
                                        <TrendingUp className="w-4 h-4 text-green-600" />
                                    </div>
                                    <div className='text-white space-y-1'>
                                        <p className="text-sm sm:text-xl text-gray-800">{formatCurrency(referralStats.stats.totalCommissionEarnings)}</p>
                                        <p className="text-xs text-gray-500">{t('modelReferral.stats.commissions', 'Commissions')}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Earnings Breakdown for Special/Partner */}
                {isSpecialOrPartner && (referralStats.stats.bookingCommissionEarnings > 0 || referralStats.stats.subscriptionCommissionEarnings > 0) && (
                    <div className="bg-white rounded-md p-5 shadow-sm border border-gray-100">
                        <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            {t('modelReferral.earningsBreakdown', 'Earnings Breakdown')}
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-md">
                                        <Users className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800">{t('modelReferral.bookingCommissions', 'Booking Commissions')}</p>
                                        <p className="text-xs text-gray-500">{referralStats.modelType === 'partner' ? '4%' : '2%'} {t('modelReferral.ofBookings', 'of each booking')}</p>
                                    </div>
                                </div>
                                <p className="font-semibold text-green-600">{formatCurrency(referralStats.stats.bookingCommissionEarnings)}</p>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 rounded-md">
                                        <Star className="w-4 h-4 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800">{t('modelReferral.subscriptionCommissions', 'Subscription Commissions')}</p>
                                        <p className="text-xs text-gray-500">{referralStats.modelType === 'partner' ? '40%' : '20%'} {t('modelReferral.ofSubscriptions', 'of each subscription')}</p>
                                    </div>
                                </div>
                                <p className="font-semibold text-green-600">{formatCurrency(referralStats.stats.subscriptionCommissionEarnings)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* How It Works */}
                <div className="bg-white rounded-md p-5 shadow-sm border border-gray-100">
                    <h3 className="text-base font-semibold text-gray-800 mb-5 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-rose-500" />
                        {t('modelReferral.howItWorks.title')}
                    </h3>

                    <div className="space-y-0">
                        <div className="flex gap-4">
                            <div className="flex flex-col items-center">
                                <div className="p-2 bg-gradient-to-br from-rose-500 to-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-200">
                                    <Share2 className="w-4 h-4 text-white" />
                                </div>
                                <div className="w-0.5 h-full bg-gradient-to-b from-rose-300 to-rose-200 my-2"></div>
                            </div>
                            <div className="pb-6">
                                <p className="font-semibold text-gray-800">{t('modelReferral.howItWorks.step1.title')}</p>
                                <p className="text-sm text-gray-500 mt-1">{t('modelReferral.howItWorks.step1.description')}</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex flex-col items-center">
                                <div className="p-2 bg-gradient-to-br from-rose-500 to-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-200">
                                    <UserPlus className="w-4 h-4 text-white" />
                                </div>
                                <div className="w-0.5 h-full bg-gradient-to-b from-rose-200 to-emerald-200 my-2"></div>
                            </div>
                            <div className="pb-6">
                                <p className="font-semibold text-gray-800">{t('modelReferral.howItWorks.step2.title')}</p>
                                <p className="text-sm text-gray-500 mt-1">{t('modelReferral.howItWorks.step2.description')}</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex flex-col items-center">
                                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
                                    <Gift className="w-4 h-4 text-white" />
                                </div>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800">{t('modelReferral.howItWorks.step3.title')}</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    {referralStats.modelType === 'normal'
                                        ? t('modelReferral.howItWorks.step3.description')
                                        : t('modelReferral.howItWorks.step3.commissionDescription', 'Earn commissions from their activity!')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Referred Models List */}
                {referralStats.referredModels.length > 0 && (
                    <div className="bg-white rounded-sm p-5 shadow border border-gray-100">
                        <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <UserPlus className="w-4 h-4 text-rose-500" />
                            {t('modelReferral.referredModels')} ({referralStats.stats.totalReferredModels})
                        </h3>
                        <div className="space-y-3">
                            {referralStats.referredModels.map((model) => (
                                <div
                                    key={model.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={model.profile || "https://xaosao.b-cdn.net/default-image.png"}
                                            alt={model.firstName}
                                            className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm"
                                        />
                                        <div>
                                            <div className="flex items-center gap-1">
                                                <p className="font-medium text-gray-800">{model.firstName}</p>
                                                {model.status === 'active' && (
                                                    <BadgeCheck className="w-4 h-4 text-rose-500" />
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500">@{model.username}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-medium ${model.status === "active"
                                                ? "bg-green-100 text-green-700"
                                                : model.status === "pending"
                                                    ? "bg-amber-100 text-amber-700"
                                                    : "bg-red-100 text-red-700"
                                                }`}
                                        >
                                            {model.status === 'active' ? 'Approved' : model.status === 'pending' ? 'Pending' : model.status}
                                        </span>
                                        {model.status === 'active' && referralStats.modelType === 'normal' && (
                                            <p className="text-xs text-green-600 mt-1 font-medium">+50,000 Kip</p>
                                        )}
                                        {model.status === 'active' && isSpecialOrPartner && (
                                            <p className="text-xs text-blue-600 mt-1 font-medium">{referralStats.modelType === 'partner' ? '4%' : '2%'} commission</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Referred Customers List - Only for special/partner models */}
                {isSpecialOrPartner && referralStats.referredCustomers && referralStats.referredCustomers.length > 0 && (
                    <div className="bg-white rounded-sm p-5 shadow border border-gray-100">
                        <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Users className="w-4 h-4 text-purple-500" />
                            {t('modelReferral.referredCustomers', 'Referred Customers')} ({referralStats.stats.totalReferredCustomers})
                        </h3>
                        <div className="space-y-3">
                            {referralStats.referredCustomers.map((customer) => (
                                <div
                                    key={customer.id}
                                    className={`flex items-center justify-between p-3 rounded-xl transition-colors ${customer.isPhoneVerified
                                        ? 'bg-gray-50 hover:bg-gray-100'
                                        : 'bg-amber-50 hover:bg-amber-100 border border-amber-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <img
                                                src={customer.profile || "https://xaosao.b-cdn.net/default-image.png"}
                                                alt={customer.firstName}
                                                className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm"
                                            />
                                            {/* Verification indicator on avatar */}
                                            <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full ${customer.isPhoneVerified ? 'bg-green-500' : 'bg-amber-500'
                                                }`}>
                                                {customer.isPhoneVerified
                                                    ? <ShieldCheck className="w-3 h-3 text-white" />
                                                    : <ShieldAlert className="w-3 h-3 text-white" />
                                                }
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1">
                                                <p className="font-medium text-gray-800">{customer.firstName} {customer.lastName}</p>
                                                {customer.isPhoneVerified && (
                                                    <BadgeCheck className="w-4 h-4 text-purple-500" />
                                                )}
                                            </div>
                                            <p className={`text-xs ${customer.isPhoneVerified ? 'text-gray-500' : 'text-amber-600'}`}>
                                                {customer.isPhoneVerified
                                                    ? t('modelReferral.phoneVerified', 'Phone Verified')
                                                    : t('modelReferral.pendingVerification', 'Pending OTP Verification')
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right space-y-1">
                                        {/* Verification status badge */}
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${customer.isPhoneVerified
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {customer.isPhoneVerified
                                                ? t('modelReferral.verified', 'Verified')
                                                : t('modelReferral.unverified', 'Unverified')
                                            }
                                        </span>
                                        {isSpecialOrPartner && customer.isPhoneVerified && (
                                            <p className="text-xs text-purple-600 font-medium">
                                                {referralStats.modelType === 'partner' ? '40%' : '20%'} {t('modelReferral.subscription', 'subscription')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {referralStats.referredModels.length === 0 && (isSpecialOrPartner ? (!referralStats.referredCustomers || referralStats.referredCustomers.length === 0) : true) && (
                    <div className="bg-white rounded-md p-8 border border-gray-100 text-center">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500 mb-4">{t('modelReferral.noReferrals')}</p>
                        <Button
                            onClick={() => setShareModalOpen('model')}
                            className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl cursor-pointer"
                        >
                            <Share2 className="w-4 h-4" />
                            {t('modelReferral.shareLink')}
                        </Button>
                    </div>
                )}

                {/* Upgrade Progress for Normal Models */}
                {referralStats.modelType === 'normal' && (
                    <div className="bg-gradient-to-r from-amber-50 to-purple-50 rounded-md p-5 border border-amber-200">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-100 rounded-lg">
                                <Star className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-gray-800">
                                    {t('modelReferral.upgradeToSpecial', 'Upgrade to Special')}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                    {t('modelReferral.upgradeToSpecialDesc', 'Refer {{count}} more models to automatically become a Special model and earn commissions!', {
                                        count: referralStats.upgradeProgress?.modelsUntilSpecial || 0
                                    })}
                                </p>

                                {/* Progress Bar */}
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-sm mb-1">
                                        <span className="text-gray-600">{t('modelReferral.modelsReferred', 'Models referred')}</span>
                                        <span className="font-medium text-amber-700">
                                            {referralStats.upgradeProgress?.currentApprovedModels || 0} / {referralStats.upgradeProgress?.modelThreshold || 20}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div
                                            className="bg-gradient-to-r from-amber-400 to-amber-500 h-2.5 rounded-full transition-all"
                                            style={{ width: `${Math.min(100, referralStats.upgradeProgress?.specialProgress || 0)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Benefits Preview */}
                                <div className="mt-4 p-3 bg-white/60 rounded-lg border border-amber-100">
                                    <p className="text-xs font-medium text-gray-700 mb-2">{t('modelReferral.specialBenefits', 'Special benefits:')}</p>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                                            2% {t('modelReferral.perBooking', 'per booking')}
                                        </span>
                                        <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                                            20% {t('modelReferral.perSubscription', 'per subscription')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Upgrade Progress for Special Models */}
                {referralStats.modelType === 'special' && (
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-md p-5 border border-purple-200">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Crown className="w-5 h-5 text-purple-600" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-gray-800">
                                    {t('modelReferral.upgradeToPartner', 'Upgrade to Partner')}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                    {t('modelReferral.upgradeToPartnerDesc', 'Meet both requirements below to automatically become a Partner!')}
                                </p>

                                {/* Models Progress */}
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-sm mb-1">
                                        <span className="text-gray-600">{t('modelReferral.modelsReferred', 'Models referred')}</span>
                                        <span className={`font-medium ${(referralStats.upgradeProgress?.partnerModelProgress || 0) >= 100 ? 'text-green-600' : 'text-purple-700'}`}>
                                            {referralStats.upgradeProgress?.currentApprovedModels || 0} / {referralStats.upgradeProgress?.modelThreshold || 20}
                                            {(referralStats.upgradeProgress?.partnerModelProgress || 0) >= 100 && ' ✓'}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all ${(referralStats.upgradeProgress?.partnerModelProgress || 0) >= 100 ? 'bg-green-500' : 'bg-purple-500'}`}
                                            style={{ width: `${Math.min(100, referralStats.upgradeProgress?.partnerModelProgress || 0)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Earnings Progress */}
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-sm mb-1">
                                        <span className="text-gray-600">{t('modelReferral.commissionEarnings', 'Commission earnings')}</span>
                                        <span className={`font-medium ${(referralStats.upgradeProgress?.partnerEarningsProgress || 0) >= 100 ? 'text-green-600' : 'text-purple-700'}`}>
                                            {formatCurrency(referralStats.upgradeProgress?.currentCommissionEarnings || 0)} / {formatCurrency(referralStats.upgradeProgress?.earningsThreshold || 2000000)}
                                            {(referralStats.upgradeProgress?.partnerEarningsProgress || 0) >= 100 && ' ✓'}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all ${(referralStats.upgradeProgress?.partnerEarningsProgress || 0) >= 100 ? 'bg-green-500' : 'bg-purple-500'}`}
                                            style={{ width: `${Math.min(100, referralStats.upgradeProgress?.partnerEarningsProgress || 0)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Benefits Preview */}
                                <div className="mt-4 p-3 bg-white/60 rounded-lg border border-purple-100">
                                    <p className="text-xs font-medium text-gray-700 mb-2">{t('modelReferral.partnerBenefits', 'Partner benefits:')}</p>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                                            4% {t('modelReferral.perBooking', 'per booking')}
                                        </span>
                                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                                            40% {t('modelReferral.perSubscription', 'per subscription')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Share Modal */}
            {shareModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setShareModalOpen(null)}
                    />

                    {/* Modal Content */}
                    <div className="relative bg-white w-full sm:w-96 rounded-t-2xl sm:rounded-2xl p-6 pb-8 sm:pb-6 animate-slide-up sm:animate-none">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-gray-800">
                                {t('modelReferral.shareVia', 'Share via')}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShareModalOpen(null)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Social Media Options */}
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            {socialShareOptions.map((option) => (
                                <button
                                    key={option.name}
                                    type="button"
                                    onClick={() => handleSocialShare(
                                        option,
                                        shareModalOpen === 'customer' ? referralStats.customerReferralLink! : referralStats.referralLink,
                                        shareModalOpen === 'customer'
                                    )}
                                    className="flex flex-col items-center gap-2 cursor-pointer group"
                                >
                                    <div className={`p-3 rounded-full text-white ${option.color} transition-transform group-hover:scale-110`}>
                                        {option.icon}
                                    </div>
                                    <span className="text-xs text-gray-600">{option.name}</span>
                                </button>
                            ))}
                        </div>

                        {/* Copy Link Option */}
                        <div className="border-t border-gray-200 pt-4">
                            <button
                                type="button"
                                onClick={() => {
                                    const link = shareModalOpen === 'customer' ? referralStats.customerReferralLink! : referralStats.referralLink;
                                    copyToClipboard(link, shareModalOpen === 'customer' ? 'customerLink' : 'link');
                                    setShareModalOpen(null);
                                }}
                                className="w-full flex items-center justify-center gap-2 p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                            >
                                <Copy className="w-5 h-5 text-gray-600" />
                                <span className="font-medium text-gray-700">{t('modelReferral.copyLink', 'Copy Link')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Code Modal */}
            <ReferralQRModal
                isOpen={qrModalOpen !== null}
                onClose={() => setQrModalOpen(null)}
                referralLink={qrModalOpen === 'customer' ? (referralStats.customerReferralLink || '') : referralStats.referralLink}
                modelName={referralStats.modelName}
                modelProfile={referralStats.modelProfile}
                type={qrModalOpen || 'model'}
            />
        </div>
    );
}
