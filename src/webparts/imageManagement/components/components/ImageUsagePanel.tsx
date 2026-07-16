import * as React from 'react';
import { useMemo } from 'react';
import {
    MapPin,
    ImageOff,
    LayoutGrid,
    Library,
    Globe,
    FileText,
    Calendar,
    Users,
    Layers,
    Image as ImageLucide,
    Presentation,
} from 'lucide-react';
import { useStore, getTranslation } from './../../../webStudio/store';
import { findImageUsages } from '../../../webStudio/utils/imageUsageFinder';
import {
    buildFriendlyUsageView,
    FriendlyUsageEntry,
    FriendlyUsageView,
} from '../../../webStudio/utils/imageUsageViewModel';
import { Image } from '../types';

interface ImageUsagePanelProps {
    image: Pick<Image, 'src' | 'name' | 'id'> | undefined;
}

const TRANSLATION_KEY_PATTERN = /^[A-Z][A-Z0-9_]+$/;

const resolveLabel = (
    value: string,
    lang: ReturnType<typeof useStore.getState>['currentLanguage']
): string => {
    if (!value) return '';
    if (TRANSLATION_KEY_PATTERN.test(value) && value.includes('_')) {
        const translated = getTranslation(value, lang);
        if (translated !== value) return translated;
    }
    return value;
};

const TYPE_BADGE_STYLES: Record<string, string> = {
    USAGE_TYPE_NEWS: 'bg-sky-50 text-sky-700 border-sky-200',
    USAGE_TYPE_EVENTS: 'bg-violet-50 text-violet-700 border-violet-200',
    USAGE_TYPE_DOCUMENTS: 'bg-amber-50 text-amber-800 border-amber-200',
    USAGE_TYPE_CONTAINER_ITEMS: 'bg-teal-50 text-teal-700 border-teal-200',
    USAGE_TYPE_CONTACTS: 'bg-rose-50 text-rose-700 border-rose-200',
    USAGE_TYPE_SLIDER_ITEMS: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    USAGE_TYPE_SMART_PAGES: 'bg-blue-50 text-blue-700 border-blue-200',
    USAGE_TYPE_SECTION: 'bg-gray-100 text-gray-700 border-gray-200',
    USAGE_TYPE_SITE: 'bg-slate-100 text-slate-700 border-slate-200',
};

const TypeIcon: React.FC<{ typeKey: string; className?: string }> = ({ typeKey, className = 'w-3.5 h-3.5' }) => {
    switch (typeKey) {
        case 'USAGE_TYPE_NEWS':
            return <FileText className={className} aria-hidden />;
        case 'USAGE_TYPE_EVENTS':
            return <Calendar className={className} aria-hidden />;
        case 'USAGE_TYPE_CONTACTS':
            return <Users className={className} aria-hidden />;
        case 'USAGE_TYPE_CONTAINER_ITEMS':
            return <Layers className={className} aria-hidden />;
        case 'USAGE_TYPE_SLIDER_ITEMS':
            return <Presentation className={className} aria-hidden />;
        case 'USAGE_TYPE_SMART_PAGES':
            return <LayoutGrid className={className} aria-hidden />;
        case 'USAGE_TYPE_SITE':
            return <Globe className={className} aria-hidden />;
        default:
            return <ImageLucide className={className} aria-hidden />;
    }
};

const TypeBadge: React.FC<{ typeKey: string; lang: ReturnType<typeof useStore.getState>['currentLanguage'] }> = ({
    typeKey,
    lang,
}) => {
    const label = resolveLabel(typeKey, lang);
    const style = TYPE_BADGE_STYLES[typeKey] || TYPE_BADGE_STYLES.USAGE_TYPE_SECTION;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${style}`}>
            <TypeIcon typeKey={typeKey} />
            {label}
        </span>
    );
};

const UsageSummary: React.FC<{
    view: FriendlyUsageView;
    lang: ReturnType<typeof useStore.getState>['currentLanguage'];
}> = ({ view, lang }) => {
    const parts: string[] = [];

    if (view.pageLocationCount > 0) {
        parts.push(
            getTranslation('LABEL_IMAGE_USAGE_SUMMARY_PAGES', lang).replace('{0}', String(view.pageLocationCount))
        );
    }
    if (view.contentCount > 0) {
        parts.push(
            getTranslation('LABEL_IMAGE_USAGE_SUMMARY_CONTENT', lang).replace('{0}', String(view.contentCount))
        );
    }
    if (view.siteCount > 0) {
        parts.push(getTranslation('LABEL_IMAGE_USAGE_SUMMARY_SITE', lang));
    }

    if (!parts.length) return null;

    return (
        <p className="m-0 px-3 py-2 text-xs text-gray-600 bg-gray-50 border-b border-gray-100 leading-relaxed">
            {parts.join(' · ')}
        </p>
    );
};

const LocationLine: React.FC<{
    page: string;
    section: string;
}> = ({ page, section }) => (
    <li className="flex items-baseline gap-1.5 text-sm text-gray-700 leading-snug">
        <span className="text-[var(--primary-color,#1d4ed8)] shrink-0" aria-hidden>•</span>
        <span>
            <span className="font-medium text-gray-900">{page}</span>
            <span className="text-gray-400 mx-1.5" aria-hidden>→</span>
            <span>{section}</span>
        </span>
    </li>
);

const UsageCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2.5 shadow-sm">{children}</div>
);

const renderPageEntry = (
    entry: FriendlyUsageEntry,
    lang: ReturnType<typeof useStore.getState>['currentLanguage']
): React.ReactNode => {
    if (entry.kind === 'page-item') {
        const locationCount = entry.locations.length;
        return (
            <UsageCard key={`page-item-${entry.itemLabel}-${entry.itemTypeKey}`}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <TypeBadge typeKey={entry.itemTypeKey} lang={lang} />
                    <span className="text-sm font-semibold text-gray-900 leading-snug">{entry.itemLabel}</span>
                </div>
                <p className="m-0 mb-1.5 text-xs text-gray-500">
                    {locationCount === 1
                        ? getTranslation('LABEL_IMAGE_USAGE_SHOWN_ON_ONE', lang)
                        : getTranslation('LABEL_IMAGE_USAGE_SHOWN_ON_MANY', lang).replace('{0}', String(locationCount))}
                </p>
                <ul className="m-0 p-0 list-none space-y-1">
                    {entry.locations.map((loc) => (
                        <LocationLine
                            key={`${loc.pageLabel}-${loc.sectionLabel}`}
                            page={resolveLabel(loc.pageLabel, lang)}
                            section={resolveLabel(loc.sectionLabel, lang)}
                        />
                    ))}
                </ul>
            </UsageCard>
        );
    }

    if (entry.kind === 'section-direct') {
        const roleLabel =
            entry.usageRoleKey === 'USAGE_ROLE_SECTION_BACKGROUND'
                ? getTranslation('LABEL_IMAGE_USAGE_SECTION_BG', lang)
                : getTranslation('LABEL_IMAGE_USAGE_SLIDE', lang);
        return (
            <UsageCard key={`section-${entry.pageLabel}-${entry.sectionLabel}-${entry.usageRoleKey}`}>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                    <TypeBadge typeKey="USAGE_TYPE_SECTION" lang={lang} />
                    <span className="text-xs font-medium text-gray-500">{roleLabel}</span>
                </div>
                <LocationLine
                    page={resolveLabel(entry.pageLabel, lang)}
                    section={resolveLabel(entry.sectionLabel, lang)}
                />
                {entry.itemLabel &&
                    entry.itemLabel !== entry.sectionLabel &&
                    entry.usageRoleKey === 'USAGE_ROLE_SLIDE_IMAGE' && (
                        <p className="m-0 mt-1.5 text-xs text-gray-500 pl-4">
                            {getTranslation('LABEL_IMAGE_USAGE_SLIDE_NAMED', lang).replace('{0}', entry.itemLabel)}
                        </p>
                    )}
            </UsageCard>
        );
    }

    if (entry.kind === 'page-thumbnail') {
        return (
            <UsageCard key={`thumb-${entry.pageLabel}`}>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                    <TypeBadge typeKey="USAGE_TYPE_SMART_PAGES" lang={lang} />
                    <span className="text-xs font-medium text-gray-500">
                        {getTranslation('USAGE_ROLE_PAGE_IMAGE', lang)}
                    </span>
                </div>
                <p className="m-0 text-sm text-gray-800">
                    <span className="font-medium">{resolveLabel(entry.pageLabel, lang)}</span>
                </p>
            </UsageCard>
        );
    }

    return null;
};

const renderContentEntry = (
    entry: FriendlyUsageEntry,
    lang: ReturnType<typeof useStore.getState>['currentLanguage']
): React.ReactNode => {
    if (entry.kind !== 'content') return null;
    const typeLabel = resolveLabel(entry.itemTypeKey, lang);
    return (
        <UsageCard key={`content-${entry.itemTypeKey}-${entry.itemLabel}`}>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <TypeBadge typeKey={entry.itemTypeKey} lang={lang} />
                <span className="text-sm font-semibold text-gray-900">{entry.itemLabel}</span>
            </div>
            <p className="m-0 text-xs text-gray-500 leading-relaxed">
                {getTranslation('LABEL_IMAGE_USAGE_NOT_ON_PAGE', lang).replace('{0}', typeLabel)}
            </p>
        </UsageCard>
    );
};

const renderSiteEntry = (
    entry: FriendlyUsageEntry,
    lang: ReturnType<typeof useStore.getState>['currentLanguage']
): React.ReactNode => {
    if (entry.kind !== 'site') return null;

    const title = resolveLabel(entry.itemLabel, lang);
    const description =
        entry.usageRoleKey === 'USAGE_ROLE_FOOTER_LOGO'
            ? getTranslation('LABEL_IMAGE_USAGE_AS_FOOTER_LOGO', lang)
            : getTranslation('LABEL_IMAGE_USAGE_AS_HEADER_LOGO', lang);

    return (
        <UsageCard key={`site-${entry.usageRoleKey}`}>
            <div className="flex flex-wrap items-center gap-2 mb-1">
                <TypeBadge typeKey="USAGE_TYPE_SITE" lang={lang} />
                <span className="text-sm font-semibold text-gray-900">{title}</span>
            </div>
            <p className="m-0 text-xs text-gray-500 leading-relaxed">{description}</p>
        </UsageCard>
    );
};

const UsageSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, icon, children }) => (
    <section className="space-y-2">
        <h6 className="flex items-center gap-1.5 m-0 text-[11px] font-bold uppercase tracking-wide text-gray-500">
            {icon}
            {title}
        </h6>
        <div className="space-y-2">{children}</div>
    </section>
);

const ImageUsagePanel: React.FC<ImageUsagePanelProps> = ({ image }) => {
    const {
        currentLanguage,
        pages,
        news,
        events,
        documents,
        containerItems,
        contacts,
        sliderItems,
        siteConfig,
    } = useStore();

    const view = useMemo(() => {
        if (!image?.src && !image?.name) {
            return buildFriendlyUsageView([]);
        }
        const usages = findImageUsages(
            { url: image.src || '', name: image.name || '', id: image.id },
            { pages, news, events, documents, containerItems, contacts, sliderItems, siteConfig },
            currentLanguage
        );
        return buildFriendlyUsageView(usages);
    }, [
        image?.src,
        image?.name,
        image?.id,
        pages,
        news,
        events,
        documents,
        containerItems,
        contacts,
        sliderItems,
        siteConfig,
        currentLanguage,
    ]);

    if (!image) return null;

    const hasUsages = view.totalCount > 0;

    return (
        <div className="mt-4 border border-gray-200 rounded-md bg-white overflow-hidden shadow-sm">
            <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2 bg-gradient-to-r from-white to-blue-50/50">
                <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 shrink-0 text-[var(--primary-color,#1d4ed8)]" aria-hidden />
                    <h6 className="text-sm font-semibold text-gray-900 truncate m-0">
                        {getTranslation('LABEL_IMAGE_USAGE', currentLanguage)}
                    </h6>
                </div>
                {hasUsages && (
                    <span className="text-[11px] font-semibold text-gray-500 shrink-0 tabular-nums">
                        {getTranslation('LABEL_IMAGE_USAGE_COUNT', currentLanguage).replace(
                            '{0}',
                            String(view.totalCount)
                        )}
                    </span>
                )}
            </div>

            {hasUsages && <UsageSummary view={view} lang={currentLanguage} />}

            <div className="p-3 max-h-52 overflow-y-auto space-y-4">
                {!hasUsages ? (
                    <div className="flex items-start gap-2.5 text-sm text-gray-500 py-1">
                        <ImageOff className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" aria-hidden />
                        <p className="m-0 leading-relaxed">
                            {getTranslation('LABEL_IMAGE_NOT_USED', currentLanguage)}
                        </p>
                    </div>
                ) : (
                    <>
                        {view.pages.length > 0 && (
                            <UsageSection
                                title={getTranslation('LABEL_IMAGE_USAGE_GROUP_PAGES', currentLanguage)}
                                icon={<LayoutGrid className="w-3.5 h-3.5" aria-hidden />}
                            >
                                {view.pages.map((entry) => renderPageEntry(entry, currentLanguage))}
                            </UsageSection>
                        )}

                        {view.content.length > 0 && (
                            <UsageSection
                                title={getTranslation('LABEL_IMAGE_USAGE_GROUP_CONTENT', currentLanguage)}
                                icon={<Library className="w-3.5 h-3.5" aria-hidden />}
                            >
                                {view.content.map((entry) => renderContentEntry(entry, currentLanguage))}
                            </UsageSection>
                        )}

                        {view.site.length > 0 && (
                            <UsageSection
                                title={getTranslation('LABEL_IMAGE_USAGE_GROUP_SITE', currentLanguage)}
                                icon={<Globe className="w-3.5 h-3.5" aria-hidden />}
                            >
                                {view.site.map((entry) => renderSiteEntry(entry, currentLanguage))}
                            </UsageSection>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ImageUsagePanel;
