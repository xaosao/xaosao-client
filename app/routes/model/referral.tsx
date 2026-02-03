import React from 'react';
import { useLoaderData } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { LoaderFunctionArgs } from 'react-router';
import { Copy, Share2, Users, Gift, CheckCircle, Sparkles, UserPlus, BadgeCheck, Wallet, Star, Crown, AlertCircle, TrendingUp, ArrowLeft } from 'lucide-react';

import { formatCurrency } from '~/utils';
import { Button } from '~/components/ui/button';
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
    const { referralStats } = useLoaderData<LoaderReturn>();
    const [copied, setCopied] = React.useState<'code' | 'link' | 'customerLink' | null>(null);

    const isSpecialOrPartner = referralStats.modelType === 'special' || referralStats.modelType === 'partner';

    const copyToClipboard = async (text: string, type: 'code' | 'link' | 'customerLink') => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(type);
            setTimeout(() => setCopied(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const shareLink = async (link: string, isCustomerLink = false) => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: isCustomerLink ? t('modelReferral.shareCustomerTitle', 'Invite customers to XaoSao') : t('modelReferral.shareTitle'),
                    text: isCustomerLink
                        ? t('modelReferral.shareCustomerText', 'Join XaoSao and connect with amazing models!')
                        : t('modelReferral.shareText', { code: referralStats.referralCode }),
                    url: link,
                });
            } catch {
                copyToClipboard(link, isCustomerLink ? 'customerLink' : 'link');
            }
        } else {
            copyToClipboard(link, isCustomerLink ? 'customerLink' : 'link');
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
                        <div className={`block sm:hidden text-sm inline-flex items-center gap-2 p-2 rounded-full`} >
                            <ArrowLeft className="w-4 h-4" />{t('wallet.topup.back')}
                        </div>
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
                                    <span className="text-gray-600">Models referred:</span>
                                    <span className="font-medium">{referralStats.stats.totalReferredModels} / 2</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-amber-500 h-2 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (referralStats.stats.totalReferredModels / 2) * 100)}%` }}
                                    />
                                </div>
                                {referralStats.modelType === 'partner' && (
                                    <>
                                        <div className="flex items-center justify-between text-sm mt-2">
                                            <span className="text-gray-600">Referral earnings:</span>
                                            <span className="font-medium">{formatCurrency(referralStats.stats.modelReferralEarnings)} / 100,000 Kip</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-purple-500 h-2 rounded-full transition-all"
                                                style={{ width: `${Math.min(100, (referralStats.stats.modelReferralEarnings / 100000) * 100)}%` }}
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
                                <div className="bg-white/20 flex items-center gap-2 bg-gray-50 rounded-md p-3">
                                    <input
                                        type="text"
                                        readOnly
                                        value={referralStats.referralLink}
                                        className="flex-1 text-sm bg-transparent text-white truncate outline-none"
                                    />
                                    <button
                                        onClick={() => copyToClipboard(referralStats.referralLink, 'link')}
                                        className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer"
                                    >
                                        {copied === 'link' ? (
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <Copy className="w-4 h-4 text-white" />
                                        )}
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
                                    <div className="bg-white/20 flex items-center gap-2 bg-gray-50 rounded-md p-3">
                                        <input
                                            type="text"
                                            readOnly
                                            value={referralStats.customerReferralLink}
                                            className="flex-1 text-sm bg-transparent text-white truncate outline-none"
                                        />
                                        <button
                                            onClick={() => copyToClipboard(referralStats.customerReferralLink!, 'customerLink')}
                                            className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer"
                                        >
                                            {copied === 'customerLink' ? (
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <Copy className="w-4 h-4 text-white" />
                                            )}
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
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={customer.profile || "https://xaosao.b-cdn.net/default-image.png"}
                                            alt={customer.firstName}
                                            className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm"
                                        />
                                        <div>
                                            <div className="flex items-center gap-1">
                                                <p className="font-medium text-gray-800">{customer.firstName} {customer.lastName}</p>
                                                {customer.status === 'active' && (
                                                    <BadgeCheck className="w-4 h-4 text-purple-500" />
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500">{t('modelReferral.customer', 'Customer')}</p>
                                        </div>
                                    </div>
                                    {isSpecialOrPartner && (
                                        <div className="text-right">
                                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                                {referralStats.modelType === 'partner' ? '40%' : '20%'} {t('modelReferral.subscription', 'subscription')}
                                            </span>
                                        </div>
                                    )}
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
                            onClick={() => shareLink(referralStats.referralLink)}
                            className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl cursor-pointer"
                        >
                            <Share2 className="w-4 h-4" />
                            {t('modelReferral.shareLink')}
                        </Button>
                    </div>
                )}

                {/* Upgrade Info for Normal Models */}
                {referralStats.modelType === 'normal' && (
                    <div className="bg-gradient-to-r from-purple-50 to-amber-50 rounded-md p-5 border border-purple-100">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Crown className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800">{t('modelReferral.upgradeTitle', 'Want to earn more?')}</p>
                                <p className="text-sm text-gray-600 mt-1">
                                    {t('modelReferral.upgradeDescription', 'Contact admin to become a Special or Partner model and earn percentage commissions from your referrals!')}
                                </p>
                                <div className="flex flex-wrap gap-3 mt-3">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Star className="w-4 h-4 text-amber-500" />
                                        <span className="text-gray-700">{t('modelReferral.upgradeSpecial', 'Special: 2% per booking, 20% per subscription')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Crown className="w-4 h-4 text-purple-500" />
                                        <span className="text-gray-700">{t('modelReferral.upgradePartner', 'Partner: 4% per booking, 40% per subscription')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
