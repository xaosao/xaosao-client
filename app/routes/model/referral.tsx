import React from 'react';
import { useLoaderData } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { LoaderFunctionArgs } from 'react-router';
import { Copy, Share2, Users, Gift, CheckCircle, Sparkles, UserPlus, BadgeCheck, Wallet } from 'lucide-react';

import { formatCurrency } from '~/utils';
import { Button } from '~/components/ui/button';
import { requireModelSession } from '~/services/model-auth.server';
import { getReferralStats } from '~/services/referral.server';

interface LoaderReturn {
    referralStats: {
        referralCode: string;
        referralLink: string;
        stats: {
            totalReferred: number;
            approvedReferred: number;
            pendingReferred: number;
            totalEarnings: number;
        };
        referredModels: Array<{
            id: string;
            firstName: string;
            username: string;
            profile: string | null;
            status: string;
            createdAt: Date;
        }>;
    };
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
    const [copied, setCopied] = React.useState<'code' | 'link' | null>(null);

    const copyToClipboard = async (text: string, type: 'code' | 'link') => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(type);
            setTimeout(() => setCopied(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const shareLink = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: t('modelReferral.shareTitle'),
                    text: t('modelReferral.shareText', { code: referralStats.referralCode }),
                    url: referralStats.referralLink,
                });
            } catch {
                copyToClipboard(referralStats.referralLink, 'link');
            }
        } else {
            copyToClipboard(referralStats.referralLink, 'link');
        }
    };

    return (
        <div className="min-h-screen mb-16 sm:mb-0">
            <div className="max-w-3xl mx-auto p-4 space-y-4 my-4">
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
                                <p className="text-xs text-white/90">{t('modelReferral.rewardInfo.description')}</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 mt-4 sm:mt-8">
                            <div className="w-full sm:w-2/5 mb-1 sm:mb-4">
                                <p className="text-xs text-white mb-2 uppercase tracking-wide font-medium">ລະຫັດແນະນໍາ</p>
                                <div className="bg-white/10 backdrop-blur-sm p-2 rounded-md flex items-center justify-between">
                                    <span className="text-sm sm:text-md font-bold tracking-[0.2em] font-mono">
                                        {referralStats.referralCode}
                                    </span>
                                    <button
                                        onClick={() => copyToClipboard(referralStats.referralCode, 'code')}
                                        className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all cursor-pointer"
                                    >
                                        {copied === 'code' ? (
                                            <CheckCircle className="h-4 w-4" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                {copied === 'code' && (
                                    <p className="text-sm text-white/80 mt-2 text-center">{t('modelReferral.copied')}</p>
                                )}
                            </div>

                            <div className="w-full sm:w-3/5 gap-3">
                                <p className="text-xs text-white mb-2 uppercase tracking-wide font-medium">{t('modelReferral.yourLink')}</p>
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
                                    <p className="text-xs text-green-600 mt-2">{t('modelReferral.linkCopied')}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <div className="flex items-center justify-center gap-3 border border-white/30 rounded-md bg-white py-1">
                                <div className="p-2 bg-blue-100 rounded-md">
                                    <Users className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className='text-white'>
                                    <p className="text-sm sm:text-xl text-gray-800">{referralStats.stats.totalReferred}</p>
                                    <p className="text-xs text-gray-500">{t('modelReferral.stats.totalReferred')}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-3 bg-white py-1 rounded-md border border-white/30">
                                <div className="p-2 bg-rose-100 rounded-md">
                                    <Wallet className="w-4 h-4 text-rose-600" />
                                </div>
                                <div className='text-white space-y-1'>
                                    <p className="text-sm sm:text-xl text-gray-800">{formatCurrency(referralStats.stats.totalEarnings)}</p>
                                    <p className="text-xs text-gray-500">{t('modelReferral.stats.totalEarnings')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

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
                                <p className="text-sm text-gray-500 mt-1">{t('modelReferral.howItWorks.step3.description')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {referralStats.referredModels.length > 0 && (
                    <div className="bg-white rounded-sm p-5 shadow border border-gray-100">
                        <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Users className="w-4 h-4 text-rose-500" />
                            {t('modelReferral.referredModels')}
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
                                        {model.status === 'active' && (
                                            <p className="text-xs text-green-600 mt-1 font-medium">+50,000 Kip</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {referralStats.referredModels.length === 0 && (
                    <div className="bg-white rounded-md p-8 border border-gray-100 text-center">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500 mb-4">{t('modelReferral.noReferrals')}</p>
                        <Button
                            onClick={shareLink}
                            className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl cursor-pointer"
                        >
                            <Share2 className="w-4 h-4" />
                            {t('modelReferral.shareLink')}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
