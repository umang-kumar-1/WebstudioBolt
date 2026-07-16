import React from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, MapPin } from 'lucide-react';
import { useStore } from '../../store';
import { ContainerType } from '../../types';
import { getTemplatePreviewId } from '../../utils/templatePermissions';

export interface TemplateSkeletonPreviewProps {
    containerType: ContainerType;
    settings?: Record<string, unknown>;
    /** Legacy: pass previewId directly instead of deriving from settings. */
    previewId?: string;
    className?: string;
}

const Pill = ({
    width,
    height = 8,
    color,
    className = '',
}: {
    width: string;
    height?: number;
    color: string;
    className?: string;
}) => (
    <div
        className={className}
        style={{ width, height, borderRadius: 9999, backgroundColor: color }}
    />
);

const CardItemSkeleton = ({
    primaryColor,
    imgPos = 'top',
    border = 'sharp',
    compact = false,
}: {
    primaryColor: string;
    imgPos?: string;
    border?: string;
    compact?: boolean;
}) => {
    const radius = border === 'rounded' ? 8 : border === 'none' ? 0 : 4;
    const showImage = imgPos !== 'none';
    const imageLeft = imgPos === 'left';
    const imageRight = imgPos === 'right';
    const imageTop = imgPos === 'top' || !imgPos;

    const imageBlock = showImage ? (
        <div
            className={`flex items-center justify-center shrink-0 ${imageTop ? 'w-full' : 'w-2/5'}`}
            style={{
                backgroundColor: `${primaryColor}22`,
                borderRadius: imageTop ? `${radius}px ${radius}px 0 0` : radius,
                minHeight: imageTop ? (compact ? 28 : 40) : (compact ? 48 : 64),
            }}
        >
            <ImageIcon className="w-4 h-4 opacity-40" style={{ color: primaryColor }} />
        </div>
    ) : null;

    const textBlock = (
        <div className={`flex flex-col gap-1 p-2 flex-1 min-w-0 ${imageTop ? '' : 'justify-center'}`}>
            <Pill width="80%" height={compact ? 5 : 6} color={primaryColor} />
            <Pill width="100%" height={4} color="#cbd5e1" />
            <Pill width="70%" height={4} color="#e2e8f0" />
        </div>
    );

    if (imageLeft || imageRight) {
        return (
            <div className="flex flex-row overflow-hidden border border-gray-100 bg-white h-full" style={{ borderRadius: radius }}>
                {imageLeft && imageBlock}
                {textBlock}
                {imageRight && imageBlock}
            </div>
        );
    }

    return (
        <div className="flex flex-col overflow-hidden border border-gray-100 bg-white h-full" style={{ borderRadius: radius }}>
            {imageTop && imageBlock}
            {textBlock}
        </div>
    );
};

const HeroSkeleton = ({ previewId, primaryColor }: { previewId: string; primaryColor: string }) => {
    switch (previewId) {
        case 'HERO':
            return (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 relative overflow-hidden" style={{ backgroundColor: primaryColor }}>
                    <div className="relative z-10 w-full flex flex-col items-center gap-1.5">
                        <Pill width="75%" color="rgba(255,255,255,0.4)" />
                        <Pill width="65%" color="rgba(255,255,255,0.4)" />
                        <div className="w-12 h-10 border-2 border-white/20 rounded-md flex items-center justify-center my-1">
                            <ImageIcon className="w-5 h-5 text-white/30" />
                        </div>
                        <Pill width="55%" height={6} color="rgba(255,255,255,0.3)" />
                        <Pill width="45%" height={6} color="rgba(255,255,255,0.3)" />
                    </div>
                </div>
            );
        case 'COLOR_BG':
            return (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 gap-2" style={{ backgroundColor: primaryColor }}>
                    <Pill width="75%" color="rgba(255,255,255,0.5)" />
                    <Pill width="65%" color="rgba(255,255,255,0.4)" />
                    <Pill width="50%" color="rgba(255,255,255,0.3)" />
                </div>
            );
        case 'VISUAL':
            return (
                <div className="w-full h-full flex flex-row items-stretch overflow-hidden bg-white">
                    <div className="w-1/2 h-full flex items-center justify-center shrink-0" style={{ backgroundColor: primaryColor }}>
                        <div className="w-10 h-8 border-2 border-white/30 rounded-md flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-white/50" />
                        </div>
                    </div>
                    <div className="w-1/2 h-full flex flex-col justify-center px-2 py-1 gap-1.5">
                        <Pill width="100%" height={8} color={primaryColor} />
                        <Pill width="76%" height={7} color="#475569" />
                        <Pill width="100%" height={4} color="#cbd5e1" />
                        <Pill width="82%" height={4} color="#cbd5e1" />
                        <Pill width="38px" height={14} color={primaryColor} className="mt-0.5" />
                    </div>
                </div>
            );
        default:
            return (
                <div className="w-full h-full bg-white flex flex-col items-center justify-center p-4 gap-2">
                    <Pill width="60%" height={12} color="#94a3b8" />
                    <Pill width="100%" height={8} color="#e2e8f0" className="mt-1" />
                    <Pill width="100%" height={8} color="#e2e8f0" />
                    <Pill width="80%" height={8} color="#e2e8f0" />
                </div>
            );
    }
};

const CardGridSkeleton = ({ settings, primaryColor }: { settings: Record<string, unknown>; primaryColor: string }) => {
    const columns = Math.min(3, Math.max(1, Number(settings.columns) || 3));
    const layout = String(settings.layout || 'grid');
    const imgPos = String(settings.imgPos || settings.imagePosition || 'top');
    const border = String(settings.border || settings.cardBorder || 'sharp');

    if (layout === 'slider') {
        return (
            <div className="w-full h-full flex items-center justify-between px-2 bg-gray-50">
                <ChevronLeft className="w-4 h-4 text-gray-400 shrink-0" />
                <div className="flex-1 flex gap-2 px-1 overflow-hidden">
                    {Array.from({ length: Math.min(columns, 3) }).map((_, i) => (
                        <div key={i} className="flex-1 min-w-0 h-full">
                            <CardItemSkeleton primaryColor={primaryColor} imgPos={imgPos} border={border} compact />
                        </div>
                    ))}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </div>
        );
    }

    return (
        <div className="w-full h-full p-2 bg-gray-50">
            <div className="grid gap-2 h-full" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                {Array.from({ length: columns }).map((_, i) => (
                    <CardItemSkeleton key={i} primaryColor={primaryColor} imgPos={imgPos} border={border} compact />
                ))}
            </div>
        </div>
    );
};

const ContactFormSkeleton = ({ settings, primaryColor }: { settings: Record<string, unknown>; primaryColor: string }) => {
    const align = String(settings.alignment || 'center');
    const bgType = String(settings.bgType || 'none');
    const bgColor = bgType === 'color' ? String(settings.bgColor || primaryColor) : '#f8fafc';

    return (
        <div
            className="w-full h-full flex flex-col p-4"
            style={{
                backgroundColor: bgType === 'color' ? `${bgColor}33` : '#ffffff',
                alignItems: align === 'center' ? 'center' : 'flex-start',
            }}
        >
            <Pill width="55%" height={8} color={primaryColor} />
            <Pill width="40%" height={5} color="#94a3b8" className="mt-1" />
            <div className="w-full mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <div className="h-6 border border-gray-200 rounded-sm bg-white" />
                    <div className="h-6 border border-gray-200 rounded-sm bg-white" />
                </div>
                <div className="h-6 border border-gray-200 rounded-sm bg-white w-full" />
                <div className="h-10 border border-gray-200 rounded-sm bg-white w-full" />
                <Pill width="60px" height={18} color={primaryColor} className="mt-1" />
            </div>
        </div>
    );
};

const SliderSkeleton = ({ previewId, primaryColor, bgBody }: { previewId: string; primaryColor: string; bgBody: string }) => {
    if (previewId === 'SLIDER') {
        return (
            <div className="w-full h-full flex items-center justify-between p-3 relative" style={{ backgroundColor: bgBody }}>
                <ChevronLeft className="w-4 h-4 text-gray-400" />
                <div className="flex-1 flex flex-col items-center">
                    <div className="w-12 h-12 bg-white border border-gray-100 rounded-md flex items-center justify-center mb-2 shadow-sm">
                        <ImageIcon className="w-6 h-6 opacity-30" style={{ color: primaryColor }} />
                    </div>
                    <Pill width="50%" height={8} color={`${primaryColor}55`} />
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
        );
    }
    return (
        <div className="w-full h-full bg-white p-3 flex flex-col gap-2">
            <div className="flex-1 border border-gray-100 rounded-md flex items-center justify-center" style={{ backgroundColor: bgBody }}>
                <ImageIcon className="w-7 h-7 opacity-30" style={{ color: primaryColor }} />
            </div>
            <div className="flex justify-center gap-1.5">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="w-5 h-5 border border-gray-100 rounded-sm bg-white" />
                ))}
            </div>
        </div>
    );
};

const MapSkeleton = ({ previewId, primaryColor }: { previewId: string; primaryColor: string }) => {
    const label =
        previewId === 'MAP_BRIEFWAHL'
            ? 'Briefwahl'
            : previewId === 'MAP_EUROPAWAHL'
                ? 'Europawahl'
                : previewId === 'MAP_CONTINENT'
                    ? 'Continent'
                    : previewId === 'MAP_COUNTRY'
                        ? 'Country'
                        : 'World';

    return (
        <div className="w-full h-full bg-slate-50 flex flex-col p-3 gap-2">
            <Pill width="35%" height={8} color="#64748b" />
            <div
                className="flex-1 border border-slate-200 rounded-md flex items-center justify-center relative overflow-hidden"
                style={{ backgroundColor: `${primaryColor}12` }}
            >
                <div className="absolute inset-3 border border-dashed rounded-sm opacity-40" style={{ borderColor: primaryColor }} />
                <div className="relative z-10 flex flex-col items-center gap-1">
                    <MapPin className="w-5 h-5" style={{ color: primaryColor }} />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
                </div>
            </div>
        </div>
    );
};

/** Settings-aware skeleton thumbnail for template picker cards. */
export const TemplateSkeletonPreview: React.FC<TemplateSkeletonPreviewProps> = ({
    containerType,
    settings = {},
    previewId: previewIdProp,
    className = '',
}) => {
    const { themeConfig } = useStore();
    const primaryColor = themeConfig['--primary-color'] || '#1e40af';
    const bgBody = themeConfig['--bg-body'] || '#f1f5f9';

    const previewId = previewIdProp || getTemplatePreviewId({ containerType, settings });

    let content: React.ReactNode;
    switch (containerType) {
        case ContainerType.HERO:
            content = <HeroSkeleton previewId={previewId} primaryColor={primaryColor} />;
            break;
        case ContainerType.SLIDER:
            content = <SliderSkeleton previewId={previewId} primaryColor={primaryColor} bgBody={bgBody} />;
            break;
        case ContainerType.CARD_GRID:
        case ContainerType.DATA_GRID:
            content = <CardGridSkeleton settings={settings} primaryColor={primaryColor} />;
            break;
        case ContainerType.CONTACT_FORM:
            content = <ContactFormSkeleton settings={settings} primaryColor={primaryColor} />;
            break;
        case ContainerType.CONTAINER_SECTION:
            content = (
                <div className="w-full h-full bg-white flex flex-col p-4 gap-1.5">
                    <Pill width="40%" height={12} color="#64748b" />
                    <div className="w-full h-px bg-slate-100 mt-1" />
                    <Pill width="100%" height={6} color="#e2e8f0" />
                    <Pill width="100%" height={6} color="#e2e8f0" />
                    <Pill width="80%" height={6} color="#e2e8f0" />
                    <Pill width="100%" height={6} color="#e2e8f0" />
                    <Pill width="60%" height={6} color="#e2e8f0" />
                </div>
            );
            break;
        case ContainerType.MAP:
            content = <MapSkeleton previewId={previewId} primaryColor={primaryColor} />;
            break;
        default:
            content = (
                <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-gray-200" />
                </div>
            );
    }

    return <div className={`w-full h-full ${className}`}>{content}</div>;
};

export default TemplateSkeletonPreview;
