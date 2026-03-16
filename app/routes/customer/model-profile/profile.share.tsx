import { useState } from 'react';
import { Copy, Check, X } from 'lucide-react';
import { useLoaderData, useNavigate, useParams, type LoaderFunction } from 'react-router';
import { useTranslation } from 'react-i18next';

import { getModel } from '~/services/model.server';
import type { ISinglemodelResponse } from '~/interfaces';
import { requireUserSession } from '~/services/auths.server';

interface LoaderReturn {
    model: ISinglemodelResponse
}

interface ProfilePageProps {
    loaderData: LoaderReturn
}

export const loader: LoaderFunction = async ({ params, request }) => {
    await requireUserSession(request)
    const modelId = params.userId
    const model = await getModel(modelId as string)

    return { model, VITE_FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL }
}

const socialShareOptions = [
    {
        name: 'WhatsApp',
        icon: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
        ),
        color: 'bg-green-500 hover:bg-green-600',
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
        getShareUrl: (link: string, text: string) => `sms:?&body=${encodeURIComponent(text + '\n\n' + link)}`
    },
];

export default function ShareProfilePage({ loaderData }: ProfilePageProps) {
    const navigate = useNavigate()
    const { t } = useTranslation();
    const { userId } = useParams<{ userId: string }>();
    const { VITE_FRONTEND_URL } = useLoaderData() as { VITE_FRONTEND_URL: string };

    const [linkCopied, setLinkCopied] = useState(false);
    const { model } = loaderData
    const url = `${VITE_FRONTEND_URL}dashboard/user-profile/${userId}`

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

    const copyToClipboard = async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(url);
            } else {
                const success = fallbackCopyToClipboard(url);
                if (!success) throw new Error('Fallback copy failed');
            }
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            alert(`${t('modelReferral.copyManually', 'Copy this link:')}\n\n${url}`);
        }
    };

    const handleSocialShare = (option: typeof socialShareOptions[0]) => {
        const text = t('profileShare.shareText', {
            name: model.firstName,
            defaultValue: `Check out ${model.firstName}'s profile on XaoSao!`
        });
        const shareUrl = option.getShareUrl(url, text);
        window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
    };

    const closeHandler = () => {
        navigate(`/customer/user-profile/${userId}`)
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={closeHandler}
            />

            {/* Modal Content */}
            <div className="relative bg-white w-full sm:w-96 rounded-t-2xl sm:rounded-2xl p-6 pb-8 sm:pb-6 animate-slide-up sm:animate-none">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-800">
                        {t('profileShare.shareVia', 'Share via')}
                    </h3>
                    <button
                        type="button"
                        onClick={closeHandler}
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
                            onClick={() => handleSocialShare(option)}
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
                        onClick={copyToClipboard}
                        className="w-full flex items-center justify-center gap-2 p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                        {linkCopied ? (
                            <>
                                <Check className="w-5 h-5 text-green-600" />
                                <span className="font-medium text-green-700">{t('profileShare.copied', 'Copied!')}</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-5 h-5 text-gray-600" />
                                <span className="font-medium text-gray-700">{t('profileShare.copyLink', 'Copy Link')}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
