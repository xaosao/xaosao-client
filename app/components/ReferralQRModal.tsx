import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Download, Camera, ArrowLeft } from 'lucide-react';

interface ReferralQRModalProps {
    isOpen: boolean;
    onClose: () => void;
    referralLink: string;
    modelName: string;
    modelProfile: string;
    type: 'model' | 'customer';
}

function loadImage(src: string, crossOrigin = true): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (crossOrigin) img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load: ${src}`));
        img.src = src;
    });
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

async function generateQRImage(
    qrCanvasRef: React.RefObject<HTMLDivElement | null>,
    modelProfile: string,
    modelName: string,
): Promise<string> {
    const scale = 3;
    const W = 360 * scale;
    const headerH = 120 * scale;
    const cardMarginX = 24 * scale;
    const cardW = W - cardMarginX * 2;
    const profileSize = 80 * scale;
    const qrSize = 200 * scale;
    const cardTopOverlap = 30 * scale;

    const nameFontSize = 16 * scale;
    const qrPadding = 8 * scale;
    const qrBorderWidth = 2 * scale;
    const brandFontSize = 13 * scale;
    const descFontSize = 11 * scale;
    const cardPadding = 20 * scale;
    const cardContentH = cardTopOverlap + 26 * scale + nameFontSize + 12 * scale +
        qrBorderWidth * 2 + qrPadding * 2 + qrSize +
        16 * scale + brandFontSize + 8 * scale + descFontSize + cardPadding;
    const cardTop = headerH - cardTopOverlap;
    const totalH = cardTop + cardContentH + 20 * scale;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, totalH);

    const grad = ctx.createLinearGradient(0, 0, 0, headerH);
    grad.addColorStop(0, '#e11d48');
    grad.addColorStop(1, '#f43f5e');
    ctx.fillStyle = grad;
    drawRoundedRect(ctx, 0, 0, W, headerH + 20 * scale, 0);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.arc(W - 10 * scale, -20 * scale, 50 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10 * scale, headerH + 10 * scale, 40 * scale, 0, Math.PI * 2);
    ctx.fill();

    // White card (before profile so profile overlays)
    const cardRadius = 16 * scale;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 10 * scale;
    ctx.shadowOffsetY = 4 * scale;
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, cardMarginX, cardTop, cardW, cardContentH, cardRadius);
    ctx.fill();
    ctx.restore();

    // Profile image
    const profileX = W / 2;
    const profileY = headerH / 2 + 15 * scale;
    try {
        const profileImg = await loadImage(modelProfile);
        ctx.save();
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(profileImg, profileX - profileSize / 2, profileY - profileSize / 2, profileSize, profileSize);
        ctx.restore();
    } catch {
        ctx.fillStyle = '#f3f4f6';
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 8 * scale;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    let curY = cardTop + cardTopOverlap + 30 * scale;
    ctx.fillStyle = '#1f2937';
    ctx.font = `bold ${nameFontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(modelName.toUpperCase(), W / 2, curY + nameFontSize);
    curY += nameFontSize + 16 * scale;

    const qrTotalSize = qrSize + qrPadding * 2 + qrBorderWidth * 2;
    const qrBoxX = (W - qrTotalSize) / 2;
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = qrBorderWidth;
    drawRoundedRect(ctx, qrBoxX, curY, qrTotalSize, qrTotalSize, 8 * scale);
    ctx.stroke();

    const qrCanvasEl = qrCanvasRef.current?.querySelector('canvas');
    if (qrCanvasEl) {
        const qrDrawX = qrBoxX + qrBorderWidth + qrPadding;
        const qrDrawY = curY + qrBorderWidth + qrPadding;
        ctx.drawImage(qrCanvasEl, qrDrawX, qrDrawY, qrSize, qrSize);
    }
    curY += qrTotalSize + 16 * scale;

    try {
        const logoImg = await loadImage('/images/icon.png', false);
        const logoSize = 18 * scale;
        const brandText = 'xaosao-ເຊົ່າສາວ';
        ctx.font = `bold ${brandFontSize}px sans-serif`;
        const brandTextW = ctx.measureText(brandText).width;
        const totalBrandW = logoSize + 6 * scale + brandTextW;
        const brandStartX = (W - totalBrandW) / 2;
        ctx.drawImage(logoImg, brandStartX, curY - logoSize / 2 - 2 * scale, logoSize, logoSize);
        ctx.fillStyle = '#e11d48';
        ctx.textAlign = 'left';
        ctx.fillText(brandText, brandStartX + logoSize + 6 * scale, curY);
    } catch {
        ctx.fillStyle = '#e11d48';
        ctx.font = `bold ${brandFontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('xaosao-ເຊົ່າສາວ', W / 2, curY);
    }
    curY += brandFontSize + 4 * scale;

    ctx.fillStyle = '#6b7280';
    ctx.font = `${descFontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('ເປັນພື້ນທີ່ລວບລວມບ່າວ-ສາວທີ່ໂສດ ແລະ ພ້ອມທີ່ເປັນຄູ່ໃຫ້ທ່ານ.', W / 2, curY);

    return canvas.toDataURL('image/png');
}

function getIsMobile() {
    return typeof navigator !== 'undefined' && /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
}

export function ReferralQRModal({ isOpen, onClose, referralLink, modelName, modelProfile, type }: ReferralQRModalProps) {
    const qrCanvasRef = React.useRef<HTMLDivElement>(null);
    const [loading, setLoading] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(false);
    const [previewDataUrl, setPreviewDataUrl] = React.useState<string | null>(null);

    React.useEffect(() => {
        setIsMobile(getIsMobile());
    }, []);

    React.useEffect(() => {
        if (!isOpen) setPreviewDataUrl(null);
    }, [isOpen]);

    if (!isOpen) return null;

    // Desktop: direct file download
    const handleDownload = async () => {
        setLoading(true);
        try {
            const dataUrl = await generateQRImage(qrCanvasRef, modelProfile, modelName);
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.style.display = 'none';
            link.download = `xaosao-qr-${type}-${Date.now()}.png`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            console.error('Failed to download:', err);
        } finally {
            setLoading(false);
        }
    };

    // Mobile: generate image for long-press save
    const handleCapture = async () => {
        setLoading(true);
        try {
            const dataUrl = await generateQRImage(qrCanvasRef, modelProfile, modelName);

            // Try Web Share API first (works on production HTTPS)
            if (navigator.share && navigator.canShare && window.isSecureContext) {
                try {
                    const res = await fetch(dataUrl);
                    const blob = await res.blob();
                    const file = new File([blob], `xaosao-qr-${type}-${Date.now()}.png`, { type: 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: 'XaoSao QR Code' });
                        return;
                    }
                } catch { /* fall through to preview */ }
            }

            setPreviewDataUrl(dataUrl);
        } catch (err) {
            console.error('Failed to capture:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setPreviewDataUrl(null);
        onClose();
    };

    // Mobile preview: show image for long-press saving
    if (previewDataUrl) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    onClick={handleClose}
                />
                <div className="bg-white rounded-lg relative w-full max-w-sm animate-slide-up sm:animate-none overflow-hidden">
                    <div className="flex items-center gap-2 p-3 border-b">
                        <button
                            type="button"
                            onClick={() => setPreviewDataUrl(null)}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <p className="text-sm font-medium text-gray-700">ກົດຄ້າງທີ່ຮູບເພື່ອບັນທຶກ</p>
                    </div>
                    <div className="p-4">
                        <img
                            src={previewDataUrl}
                            alt="QR Code"
                            className="w-full rounded-lg shadow-md"
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={handleClose}
            />

            <div className="bg-white rounded-lg relative w-full max-w-sm animate-slide-up sm:animate-none">
                <button
                    type="button"
                    onClick={handleClose}
                    className="absolute -top-2 -right-2 z-10 p-1 bg-white rounded shadow-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                    <X className="w-4 h-4 text-gray-600" />
                </button>

                <div className="rounded-lg overflow-hidden">
                    <div className="bg-gradient-to-b from-rose-600 to-rose-500 pt-8 pb-16 flex flex-col items-center relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-12 translate-y-12" />

                        <div className="relative z-30">
                            <div className="w-22 h-22 rounded-full border-3 border-white overflow-hidden shadow-lg">
                                <img
                                    src={modelProfile}
                                    alt={modelName}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white -mt-28 mx-4 rounded-xl shadow-lg relative z-10 p-5">
                        <p className="text-center text-lg font-bold text-gray-800 mb-3 mt-10 uppercase">
                            {modelName}
                        </p>

                        <div ref={qrCanvasRef} className="flex justify-center">
                            <div className="border border-rose-500 rounded-lg p-2">
                                <QRCodeCanvas
                                    value={referralLink}
                                    size={200}
                                    level="H"
                                    includeMargin={false}
                                    imageSettings={{
                                        src: '/images/icon.png',
                                        height: 40,
                                        width: 40,
                                        excavate: true,
                                    }}
                                />
                            </div>
                        </div>
                        <div className="bg-white px-4 pb-5 pt-3">
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <img src="/images/icon.png" alt="Xaosao" className="w-5 h-5 rounded" />
                                    <p className="text-sm font-bold text-rose-600">xaosao-ເຊົ່າສາວ</p>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    ເປັນພື້ນທີ່ລວບລວມບ່າວ-ສາວທີ່ໂສດ ແລະ ພ້ອມທີ່ເປັນຄູ່ໃຫ້ທ່ານ.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 space-y-3">
                    {isMobile ? (
                        <>
                            <button
                                type="button"
                                onClick={handleCapture}
                                disabled={loading}
                                className="text-white bg-rose-500 w-full flex items-center justify-center gap-2 p-3 rounded-md shadow-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <Download className="w-5 h-5 text-white" />
                                <span className="font-medium">
                                    {loading ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ QR'}
                                </span>
                            </button>
                            <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
                                <Camera className="w-3.5 h-3.5" />
                                ຫຼື ກົດປຸ່ມ Volume + Power ເພື່ອບັນທຶກໜ້າຈໍ
                            </p>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={loading}
                            className="text-white bg-rose-500 w-full flex items-center justify-center gap-2 p-3 rounded-md shadow-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <Download className="w-5 h-5 text-white" />
                            <span className="font-medium">
                                {loading ? 'ກຳລັງດາວໂຫຼດ...' : 'ດາວໂຫຼດ QR'}
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
