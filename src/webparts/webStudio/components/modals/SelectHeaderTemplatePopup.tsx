
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore, getTranslation, CONTAINER_TEMPLATE_FEATURES, getLocalizedText, getItemTranslation, getGlobalDefaultImage } from '../../store';
import { translateText } from '../../services/geminiService';
import { Container, ContainerType, MultilingualText } from '../../types';
import { GenericModal, TabButton, BindPageTitleDescriptionField } from './SharedModals';
import { baseMultilingualText, compareContainersByOrder, hasContainerSectionContent, getPlainTextFromHtml } from '../../utils/containerContentHelpers';
import { buildContainerFromOrgTemplate, canManageTemplates, countPublishedTemplatesForCategory, isSiteAdmin, CATEGORY_TO_CONTAINER_TYPE, getBuiltinPresetSettings, isTemplateManagedCategory, normalizeSliderTemplateSettings, normalizeMapTemplateSettings, getTemplatePreviewId, normalizeCardGridTemplateSettings, buildPreviewContainerFromSectionTemplate } from '../../utils/templatePermissions';
import { MODAL_Z } from '../../utils/modalZIndex';
import {
    getDataGridCardBorderClass,
    getDataGridCardImageBorderClass,
    getDataGridCardLayout,
    getDataGridCardTitleStyle,
    getDataGridCardDescStyle,
    getDataGridEditorGridStyle,
    getDataGridOrderedLabel,
    getDataGridSectionHeaderPresentation,
    getDataGridSectionBgStyle,
    getDataGridCardBgStyle,
    getDataGridPreviewCardClassName,
    renderDataGridPreviewRichText,
    withDataGridPreviewBgFallback,
} from '../../utils/dataGridCardPreview';
import { buildDataGridPreviewItemsFromStore, type DataGridPreviewDisplayItem } from '../../utils/dataGridContentSort';
import { SectionTypeTemplateArea, BuiltinPresetGallery, BuiltinPresetDef, buildBuiltinPresetDraftTemplate } from './SectionTemplatePanels';
import { SectionTemplateFullEditorModal } from './ContainerEditor';
import { SectionTemplate } from '../../types';
import { TemplateSkeletonPreview } from '../common/TemplateSkeletonPreview';
import { getGeoChartThemeColors } from '../../utils/geoChartTheme';
import { getOptionalEnabledLanguages } from '../../utils/siteLanguages';
import { useImageOptimizer } from '../../../../hooks/useImageOptimizer';
import ImageOptimizationFeedback from '../../../../components/ImageOptimizationFeedback';
import JoditRichTextEditor from '../JoditEditor';
import EuropawahlPortal from '../Map/Briefwahl/EuropawahlPortal';
import { SliderImageRadiusEditor } from './SliderManager';
import { DEFAULT_SLIDER_IMAGE_SETTINGS, parseSliderImageSettings } from '../../utils/sliderImageRadius';
import { getNestedPortalZFromStore, TEMPLATE_PREVIEW_NESTED_LAYER } from '../../utils/modalZIndex';
import { defaultSectionSpacingSettings } from '../../utils/sectionSpacing';
import type { SliderImageSettings } from '../../types';
import {
    LayoutGrid, List as ListIcon, Play,
    ChevronLeft, ChevronRight, Check, RefreshCw, Plus,
    Upload, ArrowUp, ArrowDown, Globe, Wand2,
    Search, MapPin, X, Smartphone, Tablet, Monitor, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    MoreHorizontal, Circle, Square, Trash2, Settings, Image as ImageIcon
} from 'lucide-react';

// --- GEOCHART PREVIEW COMPONENT ---
const GEO_COUNTRY_ISO: Record<string, string> = {
    'USA': 'US', 'Germany': 'DE', 'France': 'FR', 'UK': 'GB', 'India': 'IN', 'China': 'CN'
};
const GEO_CONTINENT_CODE: Record<string, string> = {
    'Europe': '150', 'Asia': '142', 'North America': '021', 'South America': '005', 'Africa': '002', 'Oceania': '009'
};
const GEO_CONTINENT_COUNTRIES: Record<string, string[]> = {
    'Europe': ['DE', 'FR', 'GB', 'IT', 'ES', 'NL', 'PL', 'SE', 'NO', 'FI', 'DK', 'AT', 'BE', 'CH', 'PT', 'GR', 'CZ', 'HU', 'RO', 'UA'],
    'Asia': ['CN', 'IN', 'JP', 'KR', 'ID', 'TH', 'VN', 'MY', 'PH', 'BD', 'PK', 'IR', 'TR', 'SA', 'AE'],
    'North America': ['US', 'CA', 'MX', 'CU', 'GT', 'PA', 'CR', 'DO'],
    'South America': ['BR', 'AR', 'CO', 'PE', 'CL', 'VE', 'EC', 'BO', 'PY', 'UY'],
    'Africa': ['ZA', 'NG', 'ET', 'EG', 'KE', 'TZ', 'GH', 'DZ', 'MA', 'MZ', 'CI', 'MG'],
    'Oceania': ['AU', 'NZ', 'PG', 'FJ', 'SB']
};

const buildPreviewData = (mapType: string, selectedRegion?: string) => {
    if (mapType === 'Country' && selectedRegion) {
        const iso = GEO_COUNTRY_ISO[selectedRegion] || selectedRegion;
        return [['Country', 'Value'], [iso, 100]];
    }
    if (mapType === 'Continent' && selectedRegion) {
        const countries = GEO_CONTINENT_COUNTRIES[selectedRegion] || [];
        return [['Country', 'Value'], ...countries.map((c, i) => [c, 80 + i * 5])];
    }
    return [
        ['Country', 'Value'],
        ['DE', 200], ['FR', 150], ['GB', 180], ['IN', 220], ['US', 300],
        ['CN', 260], ['BR', 140], ['AU', 110], ['CA', 130], ['ZA', 90],
        ['JP', 170], ['RU', 160], ['IT', 145], ['ES', 135], ['AR', 120]
    ];
};

const GeoChartPreview = ({ mapType, selectedRegion }: { mapType: string; selectedRegion?: string }) => {
    const { themeConfig } = useStore();
    const divRef = useRef<HTMLDivElement>(null);
    const primaryColor = themeConfig['--primary-color'];

    const getRegion = () => {
        if (mapType === 'Country' && selectedRegion) return GEO_COUNTRY_ISO[selectedRegion] || 'world';
        if (mapType === 'Continent' && selectedRegion) return GEO_CONTINENT_CODE[selectedRegion] || 'world';
        return 'world';
    };

    const drawChart = () => {
        const g = (window as any).google;
        if (!divRef.current) return;

        if (mapType === 'Briefwahl') {
            divRef.current.innerHTML = `<div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#f0f7f4; color:#005437; border:2px dashed #00543722;">
                <div style="font-size:24px; font-weight:800; font-style:italic; margin-bottom:10px;">Briefwahl 2025</div>
                <div style="font-size:12px; opacity:0.7;">Interactive Information Portal</div>
            </div>`;
            return;
        }

        if (!g?.visualization) return;
        const data = g.visualization.arrayToDataTable(buildPreviewData(mapType, selectedRegion));
        const chartTheme = getGeoChartThemeColors(primaryColor);
        const options = {
            region: getRegion(),
            displayMode: 'region',
            resolution: 'countries',
            colorAxis: { minValue: 0, colors: [chartTheme.colorAxisMin, chartTheme.colorAxisMax] },
            backgroundColor: chartTheme.backgroundColor,
            datalessRegionColor: chartTheme.datalessRegionColor,
            legend: 'none',
        };
        new g.visualization.GeoChart(divRef.current).draw(data, options);
    };

    useEffect(() => {
        if (mapType === 'Europawahl') return; // Rendered via React component below.
        const g = (window as any).google;
        if (g?.visualization?.GeoChart) {
            drawChart();
        } else if (g?.charts) {
            g.charts.setOnLoadCallback(drawChart);
        } else {
            const existing = document.querySelector('script[src*="showchart.js"]');
            if (existing) {
                const t = setInterval(() => { if ((window as any).google?.visualization) { clearInterval(t); drawChart(); } }, 200);
                return () => clearInterval(t);
            }
            const s = document.createElement('script');
            s.src = 'https://hhhhteams.sharepoint.com/sites/HHHH/SiteAssets/showchart.js';
            s.onload = () => {
                (window as any).google.charts.load('current', { packages: ['geochart'] });
                (window as any).google.charts.setOnLoadCallback(drawChart);
            };
            document.head.appendChild(s);
        }
    }, [mapType, selectedRegion, primaryColor]);

    if (mapType === 'Europawahl') {
        return (
            <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
                <EuropawahlPortal />
            </div>
        );
    }

    return <div ref={divRef} style={{ width: '100%', height: '100%' }} />;
};

/** Thin wrapper for built-in preset cards that only have a previewId. */
const SkeletonPreview = ({
    previewId,
    containerType = ContainerType.HERO,
    settings,
}: {
    previewId: string;
    containerType?: ContainerType;
    settings?: Record<string, unknown>;
}) => (
    <TemplateSkeletonPreview
        containerType={containerType}
        settings={settings}
        previewId={previewId}
    />
);

const CATEGORY_TITLE_KEYS: Record<string, string> = {
    HEADER: 'TITLE_SELECT_TMPL_HEADER',
    SLIDER: 'TITLE_SELECT_TMPL_SLIDER',
    DATA_GRID: 'TITLE_SELECT_TMPL_DATA_GRID',
    CONTACT_FORM: 'TITLE_SELECT_TMPL_CONTACT_FORM',
    TABLE_VIEW: 'TITLE_SELECT_TMPL_TABLE_VIEW',
    MAP: 'TITLE_SELECT_TMPL_MAP',
    CONTAINER_SECTION: 'TITLE_SELECT_TMPL_CONTAINER_SECTION'
};

const TABS: { id: string; labelKey: string }[] = [
    { id: 'HEADER', labelKey: 'TAB_CONTAINER_HEADER' },
    { id: 'SLIDER', labelKey: 'TAB_CONTAINER_SLIDER' },
    { id: 'DATA_GRID', labelKey: 'TAB_CONTAINER_DATA_GRID' },
    { id: 'CONTACT_FORM', labelKey: 'TAB_CONTAINER_CONTACT_FORM' },
    { id: 'TABLE_VIEW', labelKey: 'TAB_CONTAINER_TABLE_VIEW' },
    { id: 'MAP', labelKey: 'TAB_CONTAINER_MAP' },
    { id: 'CONTAINER_SECTION', labelKey: 'TAB_CONTAINER_CONTAINER_SECTION' }
];

const DATA_SOURCES = [
    'News', 'Event', 'Document', 'SmartPages', 'Container Items', 'Contact'
];

interface TemplateItem {
    id: string;
    labelKey: string;
    descKey: string;
    type: ContainerType;
    previewId: string;
}

const TEMPLATES: Record<string, TemplateItem[]> = {
    HEADER: [
        { id: 'page_content', labelKey: 'HERO_TMPL_TEXT_HEADER', descKey: 'HERO_TMPL_TEXT_HEADER_DESC', type: ContainerType.HERO, previewId: 'CONTENT' },
        { id: 'color_header', labelKey: 'HERO_TMPL_COLOR_BG', descKey: 'HERO_TMPL_COLOR_BG_DESC', type: ContainerType.HERO, previewId: 'COLOR_BG' },
        { id: 'hero_img', labelKey: 'HERO_TMPL_IMAGE_BG', descKey: 'HERO_TMPL_IMAGE_BG_DESC', type: ContainerType.HERO, previewId: 'HERO' },
        { id: 'visual_text', labelKey: 'HERO_TMPL_IMAGE_TEXT', descKey: 'HERO_TMPL_IMAGE_TEXT_DESC', type: ContainerType.HERO, previewId: 'VISUAL' },
    ],
    SLIDER: [
        { id: 'img_gallery', labelKey: 'TMPL_IMG_GALLERY_LABEL', descKey: 'TMPL_IMG_GALLERY_DESC', type: ContainerType.SLIDER, previewId: 'GALLERY' },
        { id: 'img_text', labelKey: 'TMPL_IMG_TEXT_LABEL', descKey: 'TMPL_IMG_TEXT_DESC', type: ContainerType.SLIDER, previewId: 'SLIDER' },
    ],
    DATA_GRID: [
        { id: 'cards_grid_3', labelKey: 'TMPL_CARDS_GRID_3_LABEL', descKey: 'TMPL_CARDS_GRID_3_DESC', type: ContainerType.CARD_GRID, previewId: 'CARD_GRID' },
        { id: 'cards_2col', labelKey: 'TMPL_CARDS_2COL_LABEL', descKey: 'TMPL_CARDS_2COL_DESC', type: ContainerType.CARD_GRID, previewId: 'CARD_GRID' },
        { id: 'cards_slider', labelKey: 'TMPL_CARDS_SLIDER_LABEL', descKey: 'TMPL_CARDS_SLIDER_DESC', type: ContainerType.CARD_GRID, previewId: 'CARD_GRID' },
    ],
    CONTACT_FORM: [
        { id: 'contact_centered', labelKey: 'TMPL_CONTACT_CENTERED_LABEL', descKey: 'TMPL_CONTACT_CENTERED_DESC', type: ContainerType.CONTACT_FORM, previewId: 'CONTACT' },
        { id: 'contact_left', labelKey: 'TMPL_CONTACT_LEFT_LABEL', descKey: 'TMPL_CONTACT_LEFT_DESC', type: ContainerType.CONTACT_FORM, previewId: 'CONTACT' },
    ],
    TABLE_VIEW: [],
    MAP: [
        { id: 'map_world', labelKey: 'TMPL_MAP_WORLD_LABEL', descKey: 'TMPL_MAP_WORLD_DESC', type: ContainerType.MAP, previewId: 'MAP_WORLD' },
        { id: 'map_continent', labelKey: 'TMPL_MAP_CONTINENT_LABEL', descKey: 'TMPL_MAP_CONTINENT_DESC', type: ContainerType.MAP, previewId: 'MAP_CONTINENT' },
        { id: 'map_country', labelKey: 'TMPL_MAP_COUNTRY_LABEL', descKey: 'TMPL_MAP_COUNTRY_DESC', type: ContainerType.MAP, previewId: 'MAP_COUNTRY' },
        { id: 'map_briefwahl', labelKey: 'TMPL_MAP_BRIEFWAHL_LABEL', descKey: 'TMPL_MAP_BRIEFWAHL_DESC', type: ContainerType.MAP, previewId: 'MAP_BRIEFWAHL' },
        { id: 'map_europawahl', labelKey: 'TMPL_MAP_EUROPAWAHL_LABEL', descKey: 'TMPL_MAP_EUROPAWAHL_DESC', type: ContainerType.MAP, previewId: 'MAP_EUROPAWAHL' },
    ],
    CONTAINER_SECTION: [
        { id: 'container_section', labelKey: 'TMPL_CONTAINER_SECTION_CARD_LABEL', descKey: 'TMPL_CONTAINER_SECTION_CARD_DESC', type: ContainerType.CONTAINER_SECTION, previewId: 'CONTAINER_SECTION' },
    ]
};

// --- TYPES ---
interface ContactField {
    id: string;
    label: string;
    placeholder: string;
    type: 'text' | 'email' | 'textarea' | 'number';
    required: boolean;
}

interface ContactConfigType {
    heading: string;
    subheading: string;
    description: string;
    showHeader?: boolean;
    showSubheading?: boolean;
    showDescription?: boolean;
    alignment: 'center' | 'left';
    bgType: 'none' | 'color' | 'site-color' | 'image';
    bgColor: string;
    bgImage: string;
    fields: ContactField[];
    buttonText: string;
}

const DEFAULT_CONTACT_FORM_FIELDS: ContactField[] = [
    { id: 'f1', label: 'First Name', placeholder: 'e.g. John', type: 'text', required: true },
    { id: 'f2', label: 'Last Name', placeholder: 'e.g. Doe', type: 'text', required: true },
    { id: 'f3', label: 'Email', placeholder: 'name@example.com', type: 'email', required: true },
    { id: 'f4', label: 'Message', placeholder: 'Your message...', type: 'textarea', required: true }
];

const DEFAULT_CONTACT_CONFIG: ContactConfigType = {
    heading: 'Contact us',
    subheading: 'We look forward to your message',
    description: '',
    showHeader: true,
    showSubheading: true,
    showDescription: true,
    alignment: 'center',
    bgType: 'none',
    bgColor: '#ffffff',
    bgImage: '',
    fields: DEFAULT_CONTACT_FORM_FIELDS,
    buttonText: 'Send message'
};

const normalizeFieldType = (value: any): ContactField['type'] => {
    if (value === 'email' || value === 'textarea' || value === 'number') return value;
    return 'text';
};

const normalizeContactConfigFromSettings = (settings: any): ContactConfigType => {
    const safeSettings = settings || {};
    const rawFields = Array.isArray(safeSettings.fields) && safeSettings.fields.length > 0
        ? safeSettings.fields
        : DEFAULT_CONTACT_FORM_FIELDS;

    const normalizedBgImage = safeSettings.bgImage || safeSettings.backgroundImage || '';
    const normalizedBgColor = safeSettings.bgColor || safeSettings.backgroundColor || '#ffffff';
    const rawBgType = typeof safeSettings.bgType === 'string' ? safeSettings.bgType.toLowerCase() : '';
    const normalizedBgType = (
        rawBgType === 'none' ||
        rawBgType === 'color' ||
        rawBgType === 'image' ||
        rawBgType === 'site-color' ||
        rawBgType === 'sitecolor' ||
        rawBgType === 'site'
    )
        ? (rawBgType === 'sitecolor' || rawBgType === 'site' ? 'site-color' : rawBgType)
        : (
            (safeSettings.backgroundColor === 'site-color')
                ? 'site-color'
                : ((safeSettings.bgImage || safeSettings.backgroundImage)
                    ? 'image'
                    : ((safeSettings.bgColor || safeSettings.backgroundColor) ? 'color' : 'none'))
        );
    const rawAlignment = String(safeSettings.alignment || safeSettings.align || 'center').toLowerCase();
    const normalizedAlignment = rawAlignment === 'left' ? 'left' : 'center';

    return {
        heading: safeSettings.heading || '',
        subheading: safeSettings.subheading || '',
        description: safeSettings.description || '',
        showHeader: safeSettings.showHeader !== false,
        showSubheading: safeSettings.showSubheading !== false,
        showDescription: safeSettings.showDescription !== false,
        alignment: normalizedAlignment,
        bgType: normalizedBgType,
        bgColor: normalizedBgColor,
        bgImage: normalizedBgImage,
        fields: rawFields.map((f: any, index: number) => ({
            id: f?.id || `f_${index + 1}`,
            label: f?.label || '',
            placeholder: f?.placeholder || '',
            type: normalizeFieldType(f?.type),
            required: !!f?.required
        })),
        buttonText: safeSettings.buttonText || safeSettings.btnName || DEFAULT_CONTACT_CONFIG.buttonText
    };
};

interface HeaderConfigType {
    containerTitle: string;
    heading: string;
    translations: Record<string, { containerTitle: string; heading: string }>;
    layoutVariant?: 'img_left' | 'img_right';
    bgImage?: string;
    imageSettings?: SliderImageSettings;
}

interface TableColumn {
    id: string;
    header: string;
}

interface TableConfigType {
    title: string;
    columns: TableColumn[];
    enableGlobalSearch: boolean;
    enableColumnSearch: boolean;
    enableSorting: boolean;
}

interface MapConfigType {
    title: string;
    mapType: 'World' | 'Continent' | 'Country' | 'Briefwahl' | 'Europawahl';
    selectedRegion: string;
    locationSearch: string;
}

// --- VISUAL CONFIGURATION HELPERS ---
interface ToggleOption {
    value: string | number;
    label: string;
    icon?: React.ElementType;
}

interface VisualToggleProps {
    options: ToggleOption[];
    value: string | number;
    onChange: (value: any) => void;
    label?: string;
}

const VisualToggle = ({ options, value, onChange, label }: VisualToggleProps) => {
    const { themeConfig } = useStore();
    return (
        <div className="mb-4">
            {label && <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{label}</label>}
            <div className="flex bg-gray-100 rounded-sm p-1 gap-1">
                {options.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-2 rounded-sm transition-all ${value === opt.value ? 'bg-white shadow-sm ring-1' : 'text-gray-500 hover:text-gray-700'}`}
                        style={{
                            color: value === opt.value ? themeConfig['--primary-color'] : undefined,
                            boxShadow: value === opt.value ? `0 0 0 1px ${themeConfig['--primary-color']}` : undefined
                        }}
                    >
                        {opt.icon && <opt.icon className="w-3.5 h-3.5" />}
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

// --- DUMMY ASSETS ---
// --- PREVIEW COMPONENTS ---
/** Primary CTA styling aligned with live hero buttons (see PreviewArea `HERO_SITE_PRIMARY_BTN`). */
const PREVIEW_PRIMARY_BTN_CLASS =
    'btn-primary !rounded-sm inline-flex items-center justify-center font-bold text-sm shadow-sm transition-all hover:shadow-lg active:scale-[0.98] tracking-wider';
const PREVIEW_PAGE_CONTENT_BTN_CLASS =
    'btn-page-content-cta !rounded-sm inline-flex items-center justify-center font-bold text-sm shadow-sm transition-all hover:shadow-lg active:scale-[0.98] tracking-wider';

/** Header with color background — design 4.1 light grey (not white / site primary). */
const COLOR_HEADER_PREVIEW_BG = '#ebebeb';

const FullScreenPreviewCloseButton = ({ onClose }: { onClose: () => void }) => (
    <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="ws-fullscreen-preview-close fixed top-6 right-6 z-50 flex items-center justify-center transition-colors"
    >
        <X className="w-6 h-6" strokeWidth={2.25} />
    </button>
);

const HeaderPreview = ({ type, onClose }: { type: string, onClose: () => void }) => {
    const { themeConfig, currentLanguage, defaultImageUrl } = useStore();

    return (
        <div
            className={`w-full h-full relative overflow-y-auto ${type === 'color_header' ? '' : 'bg-white'}`}
            style={{
                fontFamily: themeConfig['--font-family-base'],
                ...(type === 'color_header' ? { backgroundColor: COLOR_HEADER_PREVIEW_BG } : {}),
            }}
        >
            <FullScreenPreviewCloseButton onClose={onClose} />
            {type === 'hero_img' && (
                <div
                    className="w-full min-h-full relative flex flex-col items-center justify-center py-20 px-6"
                    style={{
                        backgroundImage: defaultImageUrl ? `url("${defaultImageUrl}")` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                >
                    <div className="absolute inset-0 bg-black/45 z-0" />
                    <div className="relative z-10 flex flex-col items-center text-center max-w-3xl gap-4">
                        <div
                            role="heading"
                            aria-level={1}
                            className="font-bold tracking-tight uppercase drop-shadow-md"
                            style={{ fontSize: 'clamp(1.75rem, 5vw, 3rem)', color: '#ffffff', ['--heading-h1-color' as string]: '#ffffff' }}
                        >
                            {getTranslation('DEFAULT_HERO_IMG_SAMPLE_HEADING', currentLanguage)}
                        </div>
                        <p
                            className="text-lg md:text-xl font-medium drop-shadow max-w-2xl"
                            style={{ color: '#ffffff' }}
                        >
                            {getTranslation('DEFAULT_HERO_IMG_SAMPLE_SUBHEADING', currentLanguage)}
                        </p>
                        <button
                            type="button"
                            className="mt-2 px-8 py-3 text-white text-sm font-bold rounded-sm shadow-lg pointer-events-none"
                            style={{ backgroundColor: themeConfig['--primary-color'] }}
                        >
                            {getTranslation('DEFAULT_HERO_IMG_SAMPLE_BTN', currentLanguage)}
                        </button>
                    </div>
                </div>
            )}
            {type === 'color_header' && (
                <div
                    className="w-full h-full min-h-full flex flex-col items-center justify-center px-8 py-24"
                    style={{ backgroundColor: COLOR_HEADER_PREVIEW_BG, fontFamily: themeConfig['--font-family-base'] }}
                >
                    <div
                        className="relative z-10 text-center max-w-7xl mx-auto w-full flex flex-col items-center"
                        style={{ gap: '1rem' }}
                    >
                        <div
                            role="heading"
                            aria-level={1}
                            className="font-bold uppercase tracking-tight max-w-xl mx-auto w-full leading-tight"
                            style={{
                                fontFamily: themeConfig['--font-family-secondary'],
                                color: themeConfig['--primary-color'],
                                fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
                            }}
                        >
                            {getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_HEADING', currentLanguage)}
                        </div>
                        <p
                            className="text-lg font-medium max-w-xl mx-auto w-full m-0 leading-snug"
                            style={{ color: themeConfig['--primary-color'] }}
                        >
                            {getTranslation('DEFAULT_HERO_IMG_SAMPLE_SUBHEADING', currentLanguage)}
                        </p>
                        <button type="button" className={`${PREVIEW_PRIMARY_BTN_CLASS} pointer-events-none`}>
                            {getTranslation('DEFAULT_HERO_IMG_SAMPLE_BTN', currentLanguage)}
                        </button>
                    </div>
                </div>
            )}
            {type === 'page_content' && (
                <div
                    className="w-full min-h-full bg-white flex flex-col items-center justify-center py-20 px-8"
                    style={{ fontFamily: themeConfig['--font-family-base'] }}
                >
                    <div className="w-full max-w-7xl mx-auto flex flex-col items-center text-center">
                        <div
                            role="heading"
                            aria-level={1}
                            className="font-bold tracking-tight leading-[1.15] w-full max-w-xl mx-auto"
                            style={{
                                fontFamily: themeConfig['--font-family-secondary'],
                                color: themeConfig['--heading-color'],
                                fontSize: 'clamp(2rem, 4.2vw, 2.75rem)',
                            }}
                        >
                            {getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_HEADING', currentLanguage)}
                        </div>
                        <p
                            className="font-bold leading-snug w-full max-w-xl mx-auto mt-2"
                            style={{
                                color: themeConfig['--text-primary'],
                                fontSize: 'clamp(1.125rem, 2.2vw, 1.5rem)',
                            }}
                        >
                            {getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_SUBHEADING', currentLanguage)}
                        </p>
                        <p
                            className="leading-relaxed w-full max-w-7xl mx-auto mt-2 text-sm"
                            style={{ color: themeConfig['--text-primary'] }}
                        >
                            {getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_BODY', currentLanguage)}
                        </p>
                        <button
                            type="button"
                            className={`${PREVIEW_PAGE_CONTENT_BTN_CLASS} pointer-events-none min-w-[10.5rem] mt-8`}
                        >
                            {getTranslation('DEFAULT_HERO_IMG_SAMPLE_BTN', currentLanguage)}
                        </button>
                    </div>
                </div>
            )}
            {type === 'visual_text' && (
                <div className="w-full min-h-full bg-white flex flex-col items-center justify-center py-10 px-6">
                    <div className="w-full max-w-7xl flex flex-col md:flex-row min-h-[20rem] md:min-h-[26rem] overflow-hidden border border-gray-100 shadow-sm">
                        <div className="w-full md:w-1/2 relative min-h-[14rem] md:min-h-0">
                            <div
                                className="absolute inset-0 bg-cover bg-center"
                                style={{ backgroundImage: defaultImageUrl ? `url("${defaultImageUrl}")` : 'none' }}
                            />
                        </div>
                        <div className="w-full md:w-1/2 flex items-center bg-white px-8 py-12 md:px-12 md:py-16">
                            <div
                                className="w-full max-w-xl flex flex-col text-left"
                                style={{ gap: '1rem', fontFamily: themeConfig['--font-family-base'] }}
                            >
                                <div
                                    role="heading"
                                    aria-level={1}
                                    className="font-bold uppercase tracking-tight leading-tight"
                                    style={{
                                        fontFamily: themeConfig['--font-family-secondary'],
                                        color: themeConfig['--heading-color'],
                                        fontSize: 'clamp(1.35rem, 2.8vw, 1.875rem)',
                                    }}
                                >
                                    {getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_HEADING', currentLanguage)}
                                </div>
                                <p className="font-semibold text-lg leading-snug m-0" style={{ color: themeConfig['--text-primary'] }}>
                                    {getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_SUBHEADING', currentLanguage)}
                                </p>
                                <p className="text-sm leading-relaxed m-0" style={{ color: themeConfig['--text-primary'] }}>
                                    {getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_BODY', currentLanguage)}
                                </p>
                                <button type="button" className={`${PREVIEW_PRIMARY_BTN_CLASS} self-start pointer-events-none`}>
                                    {getTranslation('DEFAULT_HERO_IMG_SAMPLE_BTN', currentLanguage)}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SliderPreview = ({ type, onClose }: { type: string, onClose: () => void }) => {
    const { themeConfig, defaultImageUrl } = useStore();
    const [current, setCurrent] = useState(0);
    const slides = [
        { title: 'Image Showcase Carousel', sub: 'Primary Display with Thumbnail Previews', desc: 'A visual gallery featuring a primary display with clickable thumbnail previews.', img: defaultImageUrl },
        { title: 'Corporate Strategy 2025', sub: 'Growth & Expansion', desc: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.', img: defaultImageUrl },
        { title: 'Employee Wellness Program', sub: 'Health & Balance', desc: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.', img: defaultImageUrl },
    ];
    const next = () => setCurrent((p) => (p + 1) % slides.length);
    const prev = () => setCurrent((p) => (p - 1 + slides.length) % slides.length);

    if (type === 'img_gallery') {
        return (
            <div className="w-full h-full bg-white relative overflow-y-auto flex items-center justify-center" style={{ fontFamily: themeConfig['--font-family-base'] }}>
                <FullScreenPreviewCloseButton onClose={onClose} />
                <div className="w-full max-w-6xl px-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold" style={{ color: themeConfig['--primary-color'], fontSize: themeConfig['--font-size-h2'] }}>Image Gallery Carousel</h1>
                        <p className="text-gray-500 mt-3" style={{ color: themeConfig['--text-secondary'] }}>A gallery-style carousel with a main image and thumbnail navigation.</p>
                    </div>
                    <div className="flex flex-col lg:flex-row gap-12 items-center bg-white">
                        <div className="flex-1 space-y-6">
                            <h2 className="text-2xl font-bold" style={{ color: themeConfig['--heading-color'], fontSize: themeConfig['--font-size-h3'] }}>{slides[current].title}</h2>
                            <h3 className="text-lg font-medium" style={{ color: themeConfig['--text-secondary'] }}>{slides[current].sub}</h3>
                            <p className="text-sm leading-relaxed" style={{ color: themeConfig['--text-primary'] }}>{slides[current].desc}</p>
                            <div className="flex gap-2 pt-4">
                                <button onClick={prev} className="p-2 bg-gray-200 rounded-sm hover:bg-gray-300 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                                <button onClick={next} className="p-2 text-white rounded-sm hover:opacity-90 transition-colors" style={{ backgroundColor: themeConfig['--primary-color'] }}><ChevronRight className="w-5 h-5" /></button>
                            </div>
                        </div>
                        <div className="flex-1 w-full h-[400px] relative">
                            <div className="w-full h-full rounded-lg overflow-hidden shadow-2xl relative bg-gray-100 flex items-center justify-center">
                                {slides[current].img ? <img src={slides[current].img} className="w-full h-full object-cover" /> : <div className="text-gray-300">Slide {current + 1} Image</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div className="w-full h-full bg-white relative overflow-y-auto" style={{ fontFamily: themeConfig['--font-family-base'] }}>
            <FullScreenPreviewCloseButton onClose={onClose} />
            <div className="w-full h-[600px] relative overflow-hidden group bg-gray-900">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: slides[current].img ? `url(${slides[current].img})` : 'none' }}></div>
                <div className="absolute inset-0 bg-black/40" style={{ backgroundColor: `${themeConfig['--primary-color']}44` }}></div>
                <div className="absolute inset-0 flex items-center px-20">
                    <div className="max-w-4xl text-white space-y-4">
                        <h2 className="text-5xl font-bold" style={{ fontSize: themeConfig['--font-size-h1'] }}>{slides[current].title}</h2>
                        <h3 className="text-2xl font-semibold opacity-90">{slides[current].sub}</h3>
                        <p className="text-lg opacity-80 max-w-2xl leading-relaxed">{slides[current].desc}</p>
                    </div>
                </div>
                <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 p-3 rounded-sm hover:bg-white transition-colors" style={{ color: themeConfig['--primary-color'] }}><ChevronLeft className="w-6 h-6" /></button>
                <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 p-3 rounded-sm hover:bg-white transition-colors" style={{ color: themeConfig['--primary-color'] }}><ChevronRight className="w-6 h-6" /></button>
            </div>
        </div>
    );
};

const ContainerSectionPreview = ({ type, onClose }: { type: string, onClose: () => void }) => {
    const { themeConfig, currentLanguage } = useStore();

    if (type === 'container_section') {
        const headline = getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_HEADING', currentLanguage).toUpperCase();
        const body = getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_BODY', currentLanguage);
        const titleColor = themeConfig['--primary-color'] || '#1e3a5f';

        return (
            <div className="w-full h-full bg-white relative overflow-y-auto" style={{ fontFamily: themeConfig['--font-family-base'] }}>
                <FullScreenPreviewCloseButton onClose={onClose} />
                <div className="w-full max-w-7xl mx-auto px-6 py-16">
                    <h1
                        className="font-bold uppercase tracking-wider mb-0"
                        style={{
                            color: titleColor,
                            fontSize: themeConfig['--font-size-h1'] || '1.5rem',
                            fontFamily: themeConfig['--font-family-secondary'] || 'inherit',
                            fontWeight: themeConfig['--font-weight-bold'] || '700',
                            borderBottom: `2px solid ${titleColor}`,
                            paddingBottom: '0.75rem',
                            textAlign: 'left',
                        }}
                    >
                        {headline}
                    </h1>
                    <div className="py-10">
                        <p
                            className="leading-relaxed m-0"
                            style={{
                                fontFamily: themeConfig['--font-family-base'] || 'inherit',
                                fontSize: themeConfig['--font-size-base'] || '1rem',
                                color: themeConfig['--text-primary'] || '#333',
                                lineHeight: '1.8',
                                fontWeight: 500,
                                textAlign: 'left',
                            }}
                        >
                            {body}
                        </p>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const resolveHeroPreviewType = (settings: Record<string, unknown>): string => {
    const templateId = String(settings.templateId || '');
    if (['hero_img', 'color_header', 'page_content', 'visual_text'].includes(templateId)) {
        return templateId;
    }
    const previewId = getTemplatePreviewId({ containerType: ContainerType.HERO, settings });
    const map: Record<string, string> = {
        COLOR_BG: 'color_header',
        HERO: 'hero_img',
        VISUAL: 'visual_text',
        CONTENT: 'page_content',
    };
    return map[previewId] || 'page_content';
};

const resolveSliderPreviewType = (settings: Record<string, unknown>): string => {
    const templateId = String(settings.templateId || '');
    if (templateId === 'img_text' || templateId === 'img_gallery') return templateId;
    return getTemplatePreviewId({ containerType: ContainerType.SLIDER, settings }) === 'SLIDER' ? 'img_text' : 'img_gallery';
};

const ContactFormFullPreview = ({
    settings,
    onClose,
}: {
    settings: Record<string, unknown>;
    onClose: () => void;
}) => {
    const { currentLanguage } = useStore();
    const t = (key: string) => getTranslation(key, currentLanguage);
    const config = normalizeContactConfigFromSettings({
        ...settings,
        heading: settings.heading || t('LABEL_CONTACT_US'),
        subheading: settings.subheading || t('LABEL_CONTACT_US_SUBHEADING'),
        description: settings.description || '',
        buttonText: settings.buttonText || t('LABEL_SEND_MESSAGE'),
        fields: settings.fields || DEFAULT_CONTACT_FORM_FIELDS,
    });

    return (
        <div className="w-full h-full bg-slate-100 relative overflow-y-auto">
            <FullScreenPreviewCloseButton onClose={onClose} />
            <div className="min-h-full flex items-center justify-center px-6 py-16">
                <div className="w-full max-w-3xl">
                    <ContactFormRenderer config={config} previewMode />
                </div>
            </div>
        </div>
    );
};

const CardGridPreview = ({
    template,
    settings,
    onClose,
}: {
    template: SectionTemplate;
    settings: Record<string, unknown>;
    onClose: () => void;
}) => {
    const {
        themeConfig,
        defaultImageUrl,
        currentLanguage,
        news,
        events,
        documents,
        containerItems,
        contacts,
        pages,
    } = useStore();
    const normalized = normalizeCardGridTemplateSettings(settings);
    const columns = Number(normalized.columns) || 3;
    const isSliderLayout = normalized.layout === 'slider';
    const cardLayout = getDataGridCardLayout(normalized, columns);
    const borderClass = getDataGridCardBorderClass(normalized);
    const titleStyle = getDataGridCardTitleStyle(normalized, themeConfig);
    const descStyle = getDataGridCardDescStyle(normalized, themeConfig);
    const headerPresentation = getDataGridSectionHeaderPresentation(normalized, themeConfig);
    const sectionBgStyle = withDataGridPreviewBgFallback(getDataGridSectionBgStyle(normalized));
    const cardBgStyle = withDataGridPreviewBgFallback(getDataGridCardBgStyle(normalized));
    const sectionTitle = getLocalizedText(template.content?.title as MultilingualText | undefined, currentLanguage)
        || getLocalizedText(normalized.containerTitle as MultilingualText | undefined, currentLanguage)
        || template.title
        || String(normalized.source || 'News');
    const sectionSubtitle = getLocalizedText(template.content?.subtitle as MultilingualText | undefined, currentLanguage)
        || getLocalizedText(normalized.subheading as MultilingualText | undefined, currentLanguage);
    const sectionDescription = getLocalizedText(template.content?.description as MultilingualText | undefined, currentLanguage)
        || getLocalizedText(normalized.description as MultilingualText | undefined, currentLanguage);
    const ordering = String(normalized.ordering || '123');
    const isNumbered = ordering !== 'none';
    const useOldCardLayout = !!normalized.useOldCardLayout;
    const source = String(normalized.source || 'News');

    const sampleCards: DataGridPreviewDisplayItem[] = [
        {
            id: 'sample-1',
            title: getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_HEADING', currentLanguage),
            desc: getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_BODY', currentLanguage),
            img: defaultImageUrl || '',
            originalItem: {},
        },
        {
            id: 'sample-2',
            title: getTranslation('DEFAULT_HERO_IMG_SAMPLE_SUBHEADING', currentLanguage),
            desc: getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_BODY', currentLanguage),
            img: defaultImageUrl || '',
            originalItem: {},
        },
        {
            id: 'sample-3',
            title: getTranslation('DEFAULT_HERO_IMG_SAMPLE_HEADING', currentLanguage),
            desc: getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_BODY', currentLanguage),
            img: defaultImageUrl || '',
            originalItem: {},
        },
    ];

    const taggedItems = useMemo(() => {
        const gridSettings = normalizeCardGridTemplateSettings(settings);
        return buildDataGridPreviewItemsFromStore(
            gridSettings,
            { news, events, documents, pages, contacts, containerItems },
            { getItemTranslation, getLocalizedText, getGlobalDefaultImage },
            currentLanguage
        );
    }, [
        settings,
        news,
        events,
        documents,
        pages,
        contacts,
        containerItems,
        currentLanguage,
    ]);

    const displayItems: DataGridPreviewDisplayItem[] = taggedItems.length > 0 ? taggedItems : sampleCards;
    const visibleCount = isSliderLayout
        ? Math.min(Math.max(displayItems.length, columns, 2), Math.max(displayItems.length, 3))
        : displayItems.length;

    const renderCardImage = (item: DataGridPreviewDisplayItem) => {
        const hasVisual = !!item.img || source === 'Document';
        if (normalized.imgPos === 'none' || !hasVisual) return null;
        const imageSrc = item.img || defaultImageUrl || '';
        return (
            <div
                className={`${cardLayout.img} ${getDataGridCardImageBorderClass(normalized)} bg-gray-100`}
                style={cardLayout.imgStyle}
            >
                {imageSrc ? (
                    <img src={imageSrc} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center min-h-[8rem]">
                        <ImageIcon className="w-8 h-8 text-gray-300" />
                    </div>
                )}
            </div>
        );
    };

    const renderCardBody = (item: DataGridPreviewDisplayItem, index: number) => {
        if (useOldCardLayout) {
            return (
                <div className="flex-1 flex flex-row items-stretch gap-4 p-4 min-w-0">
                    {isNumbered && (
                        <div
                            className="select-none flex-shrink-0 leading-none"
                            style={{
                                fontSize: '3rem',
                                fontWeight: 700,
                                fontFamily: 'var(--font-family-secondary, sans-serif)',
                                color: 'var(--border-color)',
                                lineHeight: 1,
                                minWidth: '3.5rem',
                            }}
                        >
                            {getDataGridOrderedLabel(index, ordering)}
                        </div>
                    )}
                    <div className="flex flex-col flex-1 min-w-0 justify-center gap-2">
                        <h3 className="font-bold leading-snug" style={titleStyle}>{item.title}</h3>
                        {item.desc && renderDataGridPreviewRichText(
                            item.desc,
                            'text-sm leading-relaxed desc-clamp-5 [&_a]:text-[var(--link-color)] [&_a]:underline',
                            descStyle
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div
                className="ws-data-grid-card-body flex-1 flex flex-col text-left min-h-0"
                style={{ padding: '1.75rem 1.5rem 2.25rem', boxSizing: 'border-box' }}
            >
                {isNumbered ? (
                    <div className="ws-data-grid-card-numbered-row flex flex-row items-start flex-1 min-h-0">
                        <div
                            className={`select-none leading-none flex-shrink-0 ${ordering === 'IIIII' ? 'text-2xl tracking-tighter' : 'text-5xl'}`}
                            style={{
                                fontWeight: 700,
                                fontFamily: 'var(--font-family-secondary, sans-serif)',
                                letterSpacing: '-0.02em',
                                lineHeight: 1,
                                color: 'var(--border-color, #e5e7eb)',
                            }}
                        >
                            {getDataGridOrderedLabel(index, ordering)}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0 min-h-0 gap-2">
                            <h3 className="ws-card-title-container font-bold leading-snug" style={titleStyle}>{item.title}</h3>
                            {item.desc && (
                                <div className="ws-data-grid-card-desc flex-1 min-h-0">
                                    {renderDataGridPreviewRichText(
                                        item.desc,
                                        'text-sm leading-relaxed desc-clamp-5 [&_a]:text-[var(--link-color)] [&_a]:underline [&_a]:break-words',
                                        descStyle
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 justify-center">
                        <h3 className="ws-card-title-container font-bold leading-snug" style={titleStyle}>{item.title}</h3>
                        {item.desc && renderDataGridPreviewRichText(
                            item.desc,
                            'text-sm leading-relaxed desc-clamp-5 [&_a]:text-[var(--link-color)] [&_a]:underline',
                            descStyle
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderCard = (item: DataGridPreviewDisplayItem, index: number) => (
        <div
            key={String(item.id)}
            className={getDataGridPreviewCardClassName(normalized, borderClass, cardLayout.card)}
            style={cardBgStyle}
        >
            {renderCardImage(item)}
            {renderCardBody(item, index)}
        </div>
    );

    return (
        <div
            className="w-full h-full bg-white relative overflow-y-auto"
            style={{ ...sectionBgStyle, fontFamily: themeConfig['--font-family-base'] }}
        >
            <FullScreenPreviewCloseButton onClose={onClose} />
            <div className="py-16 ws-page-width">
                <div className="mb-10 pb-4">
                    <div className={`flex items-end ${headerPresentation.headerWrapClass}`}>
                        <div className={headerPresentation.headerTextClass}>
                            {normalized.showHeader !== false && sectionTitle && (
                                <h2
                                    className={`${headerPresentation.titleTypoStyle.fontWeight ? '' : 'font-bold'} tracking-tight ${headerPresentation.sectionLetterCaseClass} ${headerPresentation.titleColor.className || ''}`}
                                    style={{
                                        fontFamily: 'var(--font-family-secondary)',
                                        ...headerPresentation.titleColor.style,
                                        ...headerPresentation.titleTypoStyle,
                                        ...(headerPresentation.sectionTextTransform ? { textTransform: headerPresentation.sectionTextTransform } : {}),
                                    }}
                                >
                                    {sectionTitle}
                                </h2>
                            )}
                            {normalized.showSubheading !== false && sectionSubtitle && (
                                <p
                                    className={`text-lg ${headerPresentation.subtitleTypoStyle.fontWeight ? '' : 'font-medium'} ${headerPresentation.centeredSubheadingClass} ${headerPresentation.subtitleColor.className || ''}`}
                                    style={{
                                        ...headerPresentation.subtitleColor.style,
                                        ...headerPresentation.subtitleTypoStyle,
                                    }}
                                >
                                    {sectionSubtitle}
                                </p>
                            )}
                            {normalized.showDescription !== false && sectionDescription && (
                                renderDataGridPreviewRichText(
                                    sectionDescription,
                                    `text-sm leading-relaxed max-w-4xl mt-4 ${headerPresentation.descColor.className || ''}`,
                                    {
                                        ...headerPresentation.descColor.style,
                                        ...headerPresentation.descTypoStyle,
                                    }
                                )
                            )}
                        </div>
                    </div>
                </div>

                {isSliderLayout ? (
                    <div className="flex items-stretch gap-4 overflow-x-auto pb-4">
                        {displayItems.slice(0, visibleCount).map((item, index) => (
                            <div
                                key={String(item.id)}
                                className={getDataGridPreviewCardClassName(normalized, borderClass, 'flex-col', { isSlider: true })}
                                style={{ width: '18rem', flex: '0 0 18rem', maxWidth: '18rem', ...cardBgStyle }}
                            >
                                {normalized.imgPos !== 'none' && (
                                    <div className={`${cardLayout.img} ${getDataGridCardImageBorderClass(normalized)} bg-gray-100`}>
                                        {(item.img || defaultImageUrl) ? (
                                            <img src={item.img || defaultImageUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ImageIcon className="w-8 h-8 text-gray-300" />
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="p-4 flex-1 flex flex-col gap-2">
                                    {isNumbered && (
                                        <span className="text-2xl font-bold" style={{ color: 'var(--border-color, #e5e7eb)' }}>
                                            {getDataGridOrderedLabel(index, ordering)}
                                        </span>
                                    )}
                                    <h3 className="font-bold leading-snug" style={titleStyle}>{item.title}</h3>
                                    {item.desc && renderDataGridPreviewRichText(
                                        item.desc,
                                        'text-sm leading-relaxed desc-clamp-5',
                                        descStyle
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div
                        className="ws-card-grid"
                        style={getDataGridEditorGridStyle(columns, String(normalized.cardGap || ''))}
                    >
                        {displayItems.map((item, index) => renderCard(item, index))}
                    </div>
                )}
            </div>
        </div>
    );
};

const MapFullPreview = ({
    settings,
    onClose,
}: {
    settings: Record<string, unknown>;
    onClose: () => void;
}) => {
    const { themeConfig, currentLanguage } = useStore();
    const t = (key: string) => getTranslation(key, currentLanguage);
    const mapType = String(settings.mapType || 'World');
    const selectedRegion = String(settings.selectedRegion || '');
    const title = String(settings.title || t('LABEL_ENTER_MAP_TITLE'));

    return (
        <div
            className="w-full h-full bg-white relative overflow-y-auto"
            style={{ fontFamily: themeConfig['--font-family-base'] }}
        >
            <FullScreenPreviewCloseButton onClose={onClose} />
            <div className="max-w-7xl mx-auto px-8 py-12">
                {title && (
                    <h2 className="text-2xl font-bold mb-6" style={{ color: themeConfig['--primary-color'] }}>
                        {title}
                    </h2>
                )}
                <div className="w-full border border-gray-200 rounded-sm overflow-hidden shadow-sm" style={{ height: 'min(70vh, 520px)' }}>
                    <GeoChartPreview mapType={mapType} selectedRegion={selectedRegion} />
                </div>
            </div>
        </div>
    );
};

const OrgTemplatePreviewOverlay = ({
    template,
    onClose,
}: {
    template: SectionTemplate;
    onClose: () => void;
}) => {
    const previewZ = getNestedPortalZFromStore(TEMPLATE_PREVIEW_NESTED_LAYER);
    const { defaultImageUrl, currentLanguage } = useStore();
    const previewContainer = useMemo(
        () => buildPreviewContainerFromSectionTemplate(template, { defaultImageUrl }),
        [template, defaultImageUrl]
    );
    const [PreviewBlock, setPreviewBlock] = useState<React.ComponentType<{
        container: Container;
        lang?: typeof currentLanguage;
        isMainHero?: boolean;
    }> | null>(null);

    useEffect(() => {
        let active = true;
        import('../PreviewArea').then((module) => {
            if (active) setPreviewBlock(() => module.PreviewContainerBlock);
        });
        return () => { active = false; };
    }, []);

    return createPortal(
        <div
            className="ws-template-fullscreen-preview-overlay"
            role="dialog"
            aria-modal="true"
            style={{ zIndex: previewZ }}
            onClick={onClose}
        >
            <div
                className="w-full h-full relative overflow-y-auto bg-white"
                onClick={(e) => e.stopPropagation()}
            >
                <FullScreenPreviewCloseButton onClose={onClose} />
                {PreviewBlock ? (
                    <PreviewBlock
                        container={previewContainer}
                        lang={currentLanguage}
                        isMainHero={previewContainer.type === ContainerType.HERO}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-sm text-gray-400">
                        {getTranslation('BTN_SHOW_PREVIEW', currentLanguage)}…
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

// --- CONFIG WIZARDS ---

const HeaderConfigPanel = ({
    config,
    setConfig,
    onBack,
    templateId,
}: {
    config: HeaderConfigType;
    setConfig: (c: HeaderConfigType) => void;
    onBack: () => void;
    templateId: string | null;
}) => {
    const [activeTab, setActiveTab] = useState<'CONTENT' | 'TRANSLATION'>('CONTENT');
    const { currentLanguage, themeConfig, defaultImageUrl, siteConfig } = useStore();
    const showTranslationTab = useMemo(
        () => getOptionalEnabledLanguages(siteConfig).length > 0,
        [siteConfig?.languages]
    );
    const translationLanguage = 'de';
    const t = (key: string) => getTranslation(key, currentLanguage);
    const [isTranslating, setIsTranslating] = useState(false);
    const imageOptimizer = useImageOptimizer();
    const isVisualTextTemplate = templateId === 'visual_text';

    const updateConfig = (key: keyof HeaderConfigType, value: any) => {
        setConfig({ ...config, [key]: value });
    };

    const updateUebersetzung = (field: 'containerTitle' | 'heading', value: string) => {
        setConfig({
            ...config,
            translations: {
                ...config.translations,
                [translationLanguage]: {
                    ...config.translations[translationLanguage],
                    [field]: value
                }
            }
        });
    };

    const getTranslatedValue = (field: 'containerTitle' | 'heading') => {
        return config.translations[translationLanguage]?.[field] || '';
    };

    const handleSuggestAI = async () => {
        setIsTranslating(true);
        try {
            const [translatedTitle, translatedHeading] = await Promise.all([
                config.containerTitle ? translateText(config.containerTitle, translationLanguage) : Promise.resolve(''),
                config.heading ? translateText(config.heading, translationLanguage) : Promise.resolve('')
            ]);

            setConfig({
                ...config,
                translations: {
                    ...config.translations,
                    [translationLanguage]: {
                        ...config.translations[translationLanguage],
                        containerTitle: translatedTitle || config.translations[translationLanguage]?.containerTitle || '',
                        heading: translatedHeading || config.translations[translationLanguage]?.heading || ''
                    }
                }
            });
        } catch (error) {
            console.error(error);
        } finally {
            setIsTranslating(false);
        }
    };

    const handleHeroImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        imageOptimizer.prepareFile(file)
            .then((prepared) => setConfig({ ...config, bgImage: prepared.previewUrl }))
            .catch(console.error);
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            <div className="px-8 pt-6 pb-2 border-b border-gray-100 bg-white flex justify-between items-center">
                <h3 className="text-xl font-bold" style={{ color: themeConfig['--primary-color'] }}>{t('TITLE_CONFIGURE_HEADER')}</h3>
                <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-800 underline">{t('LINK_CHANGE_TEMPLATE')}</button>
            </div>

            <div className="flex border-b border-gray-200 px-8 bg-white">
                <TabButton active={activeTab === 'CONTENT'} label={t('TAB_MANAGE_CONTENT')} onClick={() => setActiveTab('CONTENT')} />
                {showTranslationTab && (
                    <TabButton active={activeTab === 'TRANSLATION'} label={t('TAB_TRANSLATION_UI')} onClick={() => setActiveTab('TRANSLATION')} />
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="w-full space-y-8 bg-white p-8 shadow-sm border border-gray-200 rounded-sm">
                    {activeTab === 'CONTENT' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('LABEL_CONTAINER_TITLE_SHORT')}</label>
                                <input
                                    className="w-full border border-gray-300 p-2.5 text-sm rounded-sm outline-none transition-all"
                                    onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${themeConfig['--primary-color']}`}
                                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                                    value={config.containerTitle}
                                    onChange={(e) => updateConfig('containerTitle', e.target.value)}
                                    placeholder={t('PLACEHOLDER_ENTER_CONTAINER_TITLE')}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('LABEL_HEADING')}</label>
                                <input
                                    className="w-full border border-gray-300 p-2.5 text-sm rounded-sm outline-none transition-all"
                                    onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${themeConfig['--primary-color']}`}
                                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                                    value={config.heading}
                                    onChange={(e) => updateConfig('heading', e.target.value)}
                                    placeholder={t('PLACEHOLDER_ENTER_MAIN_HEADING')}
                                />
                            </div>

                            {isVisualTextTemplate && (
                                <div className="pt-6 border-t border-gray-100 space-y-6">
                                    <h4 className="font-bold text-gray-800 border-b pb-2 uppercase text-xs tracking-wider">
                                        {t('LABEL_TEMPLATE_DESIGN')}
                                    </h4>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                            {t('HERO_TMPL_IMAGE_TEXT')}
                                        </label>
                                        <div className="flex gap-4">
                                            <button
                                                type="button"
                                                onClick={() => updateConfig('layoutVariant', 'img_left')}
                                                className={`flex-1 py-3 px-2 text-xs font-bold border rounded-sm transition-colors ${(config.layoutVariant || 'img_left') === 'img_left' ? 'text-white' : 'bg-white text-gray-600'}`}
                                                style={{ backgroundColor: (config.layoutVariant || 'img_left') === 'img_left' ? themeConfig['--primary-color'] : '#fff' }}
                                            >
                                                {t('LABEL_IMG_LEFT_TEXT_RIGHT')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateConfig('layoutVariant', 'img_right')}
                                                className={`flex-1 py-3 px-2 text-xs font-bold border rounded-sm transition-colors ${config.layoutVariant === 'img_right' ? 'text-white' : 'bg-white text-gray-600'}`}
                                                style={{ backgroundColor: config.layoutVariant === 'img_right' ? themeConfig['--primary-color'] : '#fff' }}
                                            >
                                                {t('LABEL_TEXT_LEFT_IMG_RIGHT')}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('LABEL_IMAGE')}</label>
                                        <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-sm text-sm font-bold text-gray-600 hover:bg-gray-50 w-full justify-center cursor-pointer">
                                            <Upload className="w-4 h-4" />
                                            {config.bgImage ? t('BTN_CHANGE_IMAGE') : t('BTN_UPLOAD_IMAGE')}
                                            <input type="file" className="hidden" onChange={handleHeroImageUpload} accept="image/*" disabled={imageOptimizer.isOptimizing} />
                                        </label>
                                        <ImageOptimizationFeedback stats={imageOptimizer.stats} isProcessing={imageOptimizer.isOptimizing} className="mt-1" />
                                        {(config.bgImage || defaultImageUrl) && (
                                            <img
                                                src={config.bgImage || defaultImageUrl}
                                                alt=""
                                                className="h-20 object-cover border border-gray-300 rounded-sm mt-2"
                                            />
                                        )}
                                    </div>

                                    <SliderImageRadiusEditor
                                        imageSettings={parseSliderImageSettings(config.imageSettings)}
                                        currentLanguage={currentLanguage}
                                        onChange={(imageSettings) => updateConfig('imageSettings', imageSettings)}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'TRANSLATION' && showTranslationTab && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                    <Globe className="w-3 h-3" /> {t('LABEL_TARGET_LANG')}: {currentLanguage.toUpperCase()}
                                </div>
                                <button onClick={handleSuggestAI} disabled={isTranslating} className={`text-xs font-bold flex items-center gap-1.5 hover:bg-blue-50 px-3 py-1.5 rounded-sm transition-colors border border-transparent hover:border-blue-100 ${isTranslating ? 'opacity-50 cursor-wait' : ''}`} style={{ color: themeConfig['--primary-color'] }}>
                                    <Wand2 className={`w-3 h-3 ${isTranslating ? 'animate-pulse' : ''}`} /> {isTranslating ? t('MSG_TRANSLATING') : t('LABEL_SUGGEST_WITH_AI')}
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                {/* Originals */}
                                <div className="space-y-6 opacity-70 pointer-events-none">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">{t('LABEL_ORIGINAL_CONTAINER_TITLE')}</label>
                                        <div className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm rounded-sm">{config.containerTitle || <span className="italic">{t('LABEL_EMPTY')}</span>}</div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">{t('LABEL_ORIGINAL_HEADING')}</label>
                                        <div className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm rounded-sm">{config.heading || <span className="italic">{t('LABEL_EMPTY')}</span>}</div>
                                    </div>
                                </div>

                                {/* Uebersetzungs */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">{t('LABEL_TRANSLATED_TITLE')}</label>
                                        <input
                                            className="w-full border border-gray-300 p-2.5 text-sm rounded-sm outline-none transition-all"
                                            onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${themeConfig['--primary-color']}`}
                                            onBlur={(e) => e.target.style.boxShadow = 'none'}
                                            value={getTranslatedValue('containerTitle')}
                                            onChange={(e) => updateUebersetzung('containerTitle', e.target.value)}
                                            placeholder={`${t('PLACEHOLDER_TRANSLATION_INPUT')} (${currentLanguage.toUpperCase()})`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">{t('LABEL_TRANSLATED_HEADING_FIELD')}</label>
                                        <input
                                            className="w-full border border-gray-300 p-2.5 text-sm rounded-sm outline-none transition-all"
                                            onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${themeConfig['--primary-color']}`}
                                            onBlur={(e) => e.target.style.boxShadow = 'none'}
                                            value={getTranslatedValue('heading')}
                                            onChange={(e) => updateUebersetzung('heading', e.target.value)}
                                            placeholder={`${t('PLACEHOLDER_TRANSLATION_INPUT')} (${currentLanguage.toUpperCase()})`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface DataGridConfigType {
    title: string;
    source: string;
    showAllWithoutTagging: boolean;
    columns: number;
    ordering: string;
    layout: string;
    speed: number;
    autoplay: boolean;
    imgPos: string;
    border: string;
    imgBorder: string;
}

const DataGridConfigPanel = ({ config, setConfig }: { config: DataGridConfigType, setConfig: (c: DataGridConfigType) => void }) => {
    const { themeConfig, currentLanguage } = useStore();
    const t = (key: string) => getTranslation(key, currentLanguage);
    const updateConfig = (key: keyof DataGridConfigType, value: any) => {
        setConfig({ ...config, [key]: value });
    };
    const isSliderLayout = config.layout === 'slider';

    return (
        <div className="h-full overflow-y-auto p-8 bg-gray-50">
            <div className="w-full space-y-8 bg-white p-8 shadow-sm border border-gray-200 rounded-sm">

                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('LABEL_CONTAINER_TITLE_SHORT')} <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <input className="w-full border p-2 pl-3 text-sm border-gray-300" value={config.title} onChange={e => updateConfig('title', e.target.value)} placeholder={t('PLACEHOLDER_ENTER_CONTAINER_TITLE')} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('LABEL_DATA_SOURCE')} <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <select className="w-full border p-2 text-sm border-gray-300" value={config.source} onChange={e => updateConfig('source', e.target.value)}>
                                {DATA_SOURCES.map(ds => (
                                    <option key={ds} value={ds}>
                                        {ds === 'Container Items' ? t('DATA_SOURCE_CONTAINER_ITEMS') : ds}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <label className="flex items-start gap-2 mt-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={!!config.showAllWithoutTagging}
                                onChange={e => updateConfig('showAllWithoutTagging', e.target.checked)}
                                className="w-4 h-4 mt-0.5 accent-[var(--primary-color)] cursor-pointer flex-shrink-0"
                            />
                            <span className="text-sm text-gray-700 group-hover:text-gray-900 leading-snug">
                                {t('LABEL_SHOW_ALL_WITHOUT_TAGGING')}
                            </span>
                        </label>
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                    <VisualToggle label="Columns" value={config.columns} onChange={(v: any) => updateConfig('columns', v)} options={[{ value: 1, label: '1 Column', icon: Smartphone }, { value: 2, label: '2 Columns', icon: Tablet }, { value: 3, label: '3 Columns', icon: Monitor }]} />
                </div>

                <div>
                    <VisualToggle
                        label={t('LABEL_ORDERING_TYPE')}
                        value={config.ordering}
                        onChange={(v: any) => updateConfig('ordering', v)}
                        options={[
                            { value: '123', label: '123' },
                            { value: 'III', label: 'I II III' },
                            { value: 'IIIII', label: 'IIIII', icon: AlignJustify },
                            { value: 'ABC', label: 'ABC' },
                            { value: 'abc', label: 'abc' },
                            { value: 'dots', label: '...', icon: MoreHorizontal },
                            { value: 'none', label: t('LABEL_NONE'), icon: X }
                        ]}
                    />
                </div>

                <div className="grid grid-cols-2 gap-8 pt-4">
                    <VisualToggle label={t('LABEL_CARD_LAYOUT')} value={config.layout} onChange={(v: any) => updateConfig('layout', v)} options={[{ value: 'grid', label: 'Grid', icon: LayoutGrid }, { value: 'slider', label: 'Slider', icon: ListIcon }]} />

                    <div className={!isSliderLayout ? 'opacity-50 pointer-events-none' : ''}>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase">{getTranslation('LABEL_SLIDER_SPEED', currentLanguage)}</label>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{getTranslation('LABEL_AUTOPLAY', currentLanguage)}</span>
                                <div
                                    onClick={() => isSliderLayout && updateConfig('autoplay', !config.autoplay)}
                                    className={`w-8 h-4 rounded-full p-0.5 transition-colors ${isSliderLayout ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                    style={{ backgroundColor: config.autoplay ? themeConfig['--primary-color'] : '#d1d5db' }}
                                >
                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${config.autoplay ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 bg-gray-100 p-3 rounded-sm">
                            <Play className="w-4 h-4 text-gray-400" />
                            <input
                                type="range" min="1" max="10" step="0.5" value={config.speed}
                                onChange={(e) => updateConfig('speed', parseFloat(e.target.value))}
                                disabled={!isSliderLayout}
                                className={`w-full h-1 rounded-lg appearance-none ${isSliderLayout ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                style={{
                                    accentColor: themeConfig['--primary-color'],
                                    background: '#d1d5db'
                                }}
                            />
                            <span className="text-xs font-mono w-8 text-right">{config.speed}s</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 italic">
                            {config.autoplay ? t('MSG_CARD_SLIDER_AUTOPLAY_ON') : t('MSG_CARD_SLIDER_AUTOPLAY_OFF')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-4">
                    <VisualToggle
                        label={t('LABEL_CARD_BORDER')}
                        value={config.border}
                        onChange={(v: any) => updateConfig('border', v)}
                        options={[
                            { value: 'sharp', label: t('LABEL_SHARP'), icon: Square },
                            { value: 'rounded', label: t('LABEL_ROUNDED'), icon: Square },
                            { value: 'none', label: t('LABEL_NONE'), icon: X }
                        ]}
                    />
                    <VisualToggle
                        label={t('LABEL_IMAGE_POSITION')}
                        value={config.imgPos}
                        onChange={(v: any) => updateConfig('imgPos', v)}
                        options={[
                            { value: 'left', label: t('LABEL_LEFT'), icon: AlignLeft },
                            { value: 'top', label: t('LABEL_TOP'), icon: AlignCenter },
                            { value: 'right', label: t('LABEL_RIGHT'), icon: AlignRight },
                            { value: 'none', label: t('LABEL_NONE'), icon: X }
                        ]}
                    />
                </div>

                <div className="pt-4">
                    <VisualToggle
                        label={t('LABEL_IMAGE_BORDER_SECTION')}
                        value={config.imgBorder || config.border || 'sharp'}
                        onChange={(v: any) => updateConfig('imgBorder', v)}
                        options={[
                            { value: 'sharp', label: t('LABEL_SHARP_CORNERS'), icon: Square },
                            { value: 'rounded', label: t('LABEL_ROUNDED_CORNERS'), icon: Square },
                            { value: 'circle', label: t('LABEL_CIRCLE'), icon: Circle },
                            { value: 'halfcircle', label: t('LABEL_HALFCIRCLE'), icon: Circle }
                        ]}
                    />
                </div>

            </div>
        </div>
    );
};

const TableConfigPanel = ({ config, setConfig }: { config: TableConfigType, setConfig: (c: TableConfigType) => void }) => {
    const { themeConfig, currentLanguage } = useStore();
    const t = (key: string) => getTranslation(key, currentLanguage);
    const addColumn = () => {
        const newCol = { id: `col_${Date.now()}`, header: 'New Column' };
        setConfig({ ...config, columns: [...config.columns, newCol] });
    };

    const removeColumn = (id: string) => {
        setConfig({ ...config, columns: config.columns.filter(c => c.id !== id) });
    };

    const updateColumn = (id: string, header: string) => {
        setConfig({ ...config, columns: config.columns.map(c => c.id === id ? { ...c, header } : c) });
    };

    return (
        <div className="h-full overflow-y-auto p-8 bg-gray-50 flex flex-col gap-8">
            <div className="w-full space-y-8 bg-white p-8 shadow-sm border border-gray-200 rounded-sm">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">{t('LABEL_CONTAINER_TITLE_SHORT')} <span className="text-red-500">*</span></label>
                    <input className="w-full border p-2 pl-3 text-sm border-gray-300" value={config.title} onChange={e => setConfig({ ...config, title: e.target.value })} placeholder={t('PLACEHOLDER_ENTER_CONTAINER_TITLE')} />
                </div>

                {/* Features */}
                <div className="bg-gray-50 p-4 rounded-sm border border-gray-100">
                    <h5 className="text-xs font-bold text-gray-500 uppercase mb-3">{t('LABEL_TABLE_FEATURES')}</h5>
                    <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={config.enableGlobalSearch} onChange={e => setConfig({ ...config, enableGlobalSearch: e.target.checked })} className="focus:ring-1" style={{ color: themeConfig['--primary-color'] }} />
                            <span className="text-sm font-medium text-gray-700">{t('LABEL_ENABLE_GLOBAL_SEARCH')}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={config.enableColumnSearch} onChange={e => setConfig({ ...config, enableColumnSearch: e.target.checked })} className="focus:ring-1" style={{ color: themeConfig['--primary-color'] }} />
                            <span className="text-sm font-medium text-gray-700">{t('LABEL_ENABLE_COLUMN_SEARCH')}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={config.enableSorting} onChange={e => setConfig({ ...config, enableSorting: e.target.checked })} className="focus:ring-1" style={{ color: themeConfig['--primary-color'] }} />
                            <span className="text-sm font-medium text-gray-700">{t('LABEL_ENABLE_SORTING')}</span>
                        </label>
                    </div>
                </div>

                {/* Columns */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h5 className="text-xs font-bold text-gray-500 uppercase">{t('LABEL_MANAGE_COLUMNS')}</h5>
                        <button onClick={addColumn} className="text-xs font-bold hover:underline flex items-center gap-1" style={{ color: themeConfig['--primary-color'] }}><Plus className="w-3 h-3" /> {t('LABEL_ADD_COLUMN')}</button>
                    </div>
                    <div className="space-y-2">
                        {config.columns.map((col, idx) => (
                            <div key={col.id} className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 font-mono w-6 text-center">{idx + 1}</span>
                                <input
                                    className="flex-1 border p-2 text-sm rounded-sm"
                                    value={col.header}
                                    onChange={(e) => updateColumn(col.id, e.target.value)}
                                    placeholder={t('LABEL_COLUMN_HEADER_NAME')}
                                />
                                <button onClick={() => removeColumn(col.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                        {config.columns.length === 0 && <div className="text-sm text-gray-400 italic text-center p-4 border border-dashed border-gray-300 rounded-sm">{t('LABEL_NO_COLUMNS_DEFINED')}</div>}
                    </div>
                </div>
            </div>

            {/* Preview */}
            <div className="w-full">
                <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden">
                    <div className="p-3 bg-gray-100 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">{t('TABLE_PREVIEW_HEADER')}</div>
                    <div className="p-4 overflow-x-auto">
                        <div className="flex justify-between mb-4">
                            {config.enableGlobalSearch && (
                                <div className="relative w-64">
                                    <input className="w-full border pl-8 p-1.5 text-sm rounded-sm" placeholder="Search..." disabled />
                                    <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-2.5" />
                                </div>
                            )}
                        </div>
                        <table className="w-full border-collapse text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                                <tr>
                                    {config.columns.map(col => (
                                        <th key={col.id} className="p-3 border-r border-gray-200 last:border-0 whitespace-nowrap">
                                            <div className="flex items-center justify-between gap-2">
                                                <span>{col.header}</span>
                                                {config.enableSorting && <ArrowUp className="w-3 h-3 text-gray-400" />}
                                            </div>
                                            {config.enableColumnSearch && <input className="w-full border mt-2 p-1 text-xs font-normal" placeholder={`Search ${col.header}`} disabled />}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-gray-100"><td colSpan={config.columns.length} className="p-3 text-gray-400 italic text-center">{t('MSG_TABLE_PREVIEW_PLACEHOLDER')}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MapConfigPanel = ({ config, setConfig }: { config: MapConfigType, setConfig: (c: MapConfigType) => void }) => {
    const { currentLanguage } = useStore();
    const t = (key: string) => getTranslation(key, currentLanguage);
    return (
        <div className="h-full overflow-y-auto p-8 bg-gray-50 flex flex-col gap-8">
            <div className="w-full space-y-8 bg-white p-8 shadow-sm border border-gray-200 rounded-sm">
                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('LABEL_CONTAINER_TITLE_SHORT')} <span className="text-red-500">*</span></label>
                        <input className="w-full border p-2 pl-3 text-sm border-gray-300" value={config.title} onChange={e => setConfig({ ...config, title: e.target.value })} placeholder={t('PLACEHOLDER_ENTER_CONTAINER_TITLE')} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('LABEL_MAP_TYPE')}</label>
                        <select className="w-full border p-2 text-sm border-gray-300" value={config.mapType} onChange={e => setConfig({ ...config, mapType: e.target.value as MapConfigType['mapType'] })}>
                            <option value="World">{t('LABEL_WORLD_MAP')}</option>
                            <option value="Continent">{t('LABEL_CONTINENT_MAP')}</option>
                            <option value="Country">{t('LABEL_COUNTRY_MAP')}</option>
                            <option value="Briefwahl">{t('MAP_TYPE_BRIEFWAHL')}</option>
                            <option value="Europawahl">{t('MAP_TYPE_EUROPAWAHL')}</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                    {config.mapType === 'Continent' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('LABEL_SELECT_CONTINENT')}</label>
                            <select className="w-full border p-2 text-sm border-gray-300" value={config.selectedRegion} onChange={e => setConfig({ ...config, selectedRegion: e.target.value })}>
                                <option value="">{t('LABEL_SELECT_DASH')}</option>
                                <option value="Europe">{t('LABEL_EUROPE')}</option>
                                <option value="Asia">{t('LABEL_ASIA')}</option>
                                <option value="North America">{t('LABEL_NORTH_AMERICA')}</option>
                                <option value="South America">{t('LABEL_SOUTH_AMERICA')}</option>
                                <option value="Africa">{t('LABEL_AFRICA')}</option>
                                <option value="Oceania">{t('LABEL_OCEANIA')}</option>
                            </select>
                        </div>
                    )}
                    {config.mapType === 'Country' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('LABEL_SELECT_COUNTRY')}</label>
                            <select className="w-full border p-2 text-sm border-gray-300" value={config.selectedRegion} onChange={e => setConfig({ ...config, selectedRegion: e.target.value })}>
                                <option value="">{t('LABEL_SELECT_DASH')}</option>
                                <option value="USA">{t('LABEL_USA')}</option>
                                <option value="Germany">{t('LABEL_GERMANY')}</option>
                                <option value="France">{t('LABEL_FRANCE')}</option>
                                <option value="UK">{t('LABEL_UK')}</option>
                                <option value="India">{t('LABEL_INDIA')}</option>
                                <option value="China">{t('LABEL_CHINA')}</option>
                            </select>
                        </div>
                    )}
                    <div className="col-span-1">
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('LABEL_INITIAL_LOCATION_SEARCH')}</label>
                        <div className="relative">
                            <input className="w-full border py-2 pl-8 text-sm border-gray-300" value={config.locationSearch} onChange={e => setConfig({ ...config, locationSearch: e.target.value })} placeholder={t('LABEL_LOCATION_SEARCH_PLACEHOLDER')} />
                            <MapPin className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Map Preview — live GeoChart */}
            <div className="w-full bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm" style={{ height: '320px' }}>
                <GeoChartPreview mapType={config.mapType} selectedRegion={config.selectedRegion} />
            </div>
        </div>
    );
};

// --- CONTAINER SECTION CONFIG ---
interface ContainerSectionConfigType {
    title: string;
    body: string;
    showTitleUnderline: boolean;
    bindPageTitleDescription?: boolean;
}

const ContainerSectionConfigPanel = ({
    config,
    setConfig,
    pageTitle,
    pageDescription,
}: {
    config: ContainerSectionConfigType;
    setConfig: (c: ContainerSectionConfigType) => void;
    pageTitle: string;
    pageDescription: string;
}) => {
    const { themeConfig, currentLanguage } = useStore();
    const t = (key: string) => getTranslation(key, currentLanguage);
    const titleColor = themeConfig['--primary-color'] || '#1e3a5f';
    const showTitleLine = config.showTitleUnderline !== false;
    const bindPage = config.bindPageTitleDescription === true;
    const previewTitle = bindPage ? pageTitle : config.title;
    const previewBody = bindPage ? pageDescription : config.body;
    const showPreview = bindPage || hasContainerSectionContent(config);

    return (
        <div className="h-full overflow-y-auto p-8 bg-gray-50 flex flex-col gap-8">
            <div className="w-full space-y-8 bg-white p-8 shadow-sm border border-gray-200 rounded-sm">
                <BindPageTitleDescriptionField
                    checked={bindPage}
                    onChange={(checked) => setConfig({ ...config, bindPageTitleDescription: checked })}
                />
                <div className={bindPage ? 'opacity-50 pointer-events-none' : undefined}>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('LABEL_HEADING')}</label>
                        <input
                            className="w-full border p-2 pl-3 text-sm border-gray-300"
                            value={config.title}
                            onChange={e => setConfig({ ...config, title: e.target.value })}
                            placeholder="e.g. Privacy Policy"
                            disabled={bindPage}
                            onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${themeConfig['--primary-color']}`}
                            onBlur={(e) => e.target.style.boxShadow = 'none'}
                        />
                    </div>
                    {config.title.trim() && !bindPage && (
                        <label className="flex items-center gap-2 cursor-pointer select-none mt-4">
                            <input
                                type="checkbox"
                                checked={showTitleLine}
                                onChange={e => setConfig({ ...config, showTitleUnderline: e.target.checked })}
                                className="focus:ring-1"
                                style={{ color: themeConfig['--primary-color'] }}
                            />
                            <span className="text-sm text-gray-700">{t('LABEL_SHOW_TITLE_UNDERLINE')}</span>
                        </label>
                    )}
                    <div className="mt-6">
                        <label className="block text-sm font-bold text-gray-700 mb-2">{t('LABEL_PAGE_CONTENT_RICH_TEXT')}</label>
                        <JoditRichTextEditor
                            value={config.body}
                            onChange={(val: string) => setConfig({ ...config, body: val })}
                            placeholder={t('LABEL_WRITE_PAGE_CONTENT_HERE')}
                            height={320}
                        />
                    </div>
                </div>
                {bindPage && previewTitle.trim() && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showTitleLine}
                            onChange={e => setConfig({ ...config, showTitleUnderline: e.target.checked })}
                            className="focus:ring-1"
                            style={{ color: themeConfig['--primary-color'] }}
                        />
                        <span className="text-sm text-gray-700">{t('LABEL_SHOW_TITLE_UNDERLINE')}</span>
                    </label>
                )}
            </div>

            {/* Live Content Preview */}
            {showPreview && (
                <div className="w-full bg-white border border-gray-200 rounded-sm shadow-sm p-8">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">{t('LABEL_CONTENT_PREVIEW')}</p>
                    {previewTitle && (
                        <h2
                            className="font-bold uppercase tracking-wider"
                            style={{
                                color: titleColor,
                                borderBottom: showTitleLine ? `2px solid ${titleColor}` : 'none',
                                paddingBottom: showTitleLine ? '8px' : '0',
                                marginBottom: showTitleLine ? '1rem' : '0.5rem',
                            }}
                        >
                            {previewTitle}
                        </h2>
                    )}
                    {previewBody && getPlainTextFromHtml(previewBody).length > 0 && (
                        <div
                            className="jodit-wysiwyg prose prose-sm max-w-none text-gray-700 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: previewBody }}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

// --- CONTACT FORM RENDERER (Shared) ---
const ContactFormRenderer = ({ config, previewMode }: { config: ContactConfigType; previewMode?: boolean }) => {
    const { themeConfig, currentLanguage } = useStore();
    const resolvedAlignment = String(config.alignment || 'center').toLowerCase() === 'left' ? 'left' : 'center';
    const resolvedBgColor = config.bgColor || '#ffffff';
    const resolvedBgImage = config.bgImage || '';
    const bgTypeNormalized = String(config.bgType || '').toLowerCase();
    const resolvedBgType = (
        bgTypeNormalized === 'none' ||
        bgTypeNormalized === 'color' ||
        bgTypeNormalized === 'image' ||
        bgTypeNormalized === 'site-color' ||
        bgTypeNormalized === 'site' ||
        bgTypeNormalized === 'sitecolor'
    )
        ? ((bgTypeNormalized === 'site' || bgTypeNormalized === 'sitecolor') ? 'site-color' : bgTypeNormalized)
        : (resolvedBgImage ? 'image' : (resolvedBgColor ? 'color' : 'none'));
    const resolvedSectionBgColor = resolvedBgType === 'site-color'
        ? (themeConfig['--bg-body'] || '#f8fafc')
        : (resolvedBgType === 'color' ? resolvedBgColor : 'transparent');
    const sectionPadding = previewMode ? 'p-4' : 'p-10';
    const cardPadding = previewMode ? 'p-6' : 'p-10';
    const headerMargin = previewMode ? 'mb-4' : 'mb-8';

    return (
        <div
            className={`w-full ${sectionPadding} rounded-sm relative transition-all duration-300 mx-auto ${previewMode ? '' : 'border border-gray-200'}`}
            style={{
                backgroundColor: resolvedSectionBgColor,
                backgroundImage: resolvedBgType === 'image' && resolvedBgImage ? `url("${resolvedBgImage}")` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }}
        >
            {/* Overlay if image bg to ensure text readability */}
            {resolvedBgType === 'image' && <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-sm z-0"></div>}

            <div className={`relative z-10 bg-white ${cardPadding} w-full max-w-xl shadow-xl border border-gray-200 rounded-sm mx-auto`}>
                <div className={`${resolvedAlignment === 'center' ? 'text-center' : 'text-left'} ${headerMargin}`}>
                    {(config.showHeader !== false) && config.heading && <h2 className="text-3xl font-bold mb-2" style={{ color: themeConfig['--primary-color'] }}>{config.heading}</h2>}
                    {(config.showSubheading !== false) && config.subheading && <p className="text-gray-500 text-sm font-medium">{config.subheading}</p>}
                    {(config.showDescription !== false) && config.description && <div className="text-gray-400 text-xs mt-2" dangerouslySetInnerHTML={{ __html: config.description }} />}
                </div>

                <div className="space-y-4">
                    {config.fields.map((f: ContactField) => (
                        <div key={f.id}>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                {f.label} {f.required && <span className="text-red-500">*</span>}
                            </label>
                            {f.type === 'textarea' ? (
                                <textarea className="w-full border border-gray-300 p-2 text-sm bg-white rounded-sm resize-none h-24" placeholder={f.placeholder} disabled />
                            ) : (
                                <input className="w-full border border-gray-300 p-2 text-sm bg-white rounded-sm" placeholder={f.placeholder} disabled />
                            )}
                        </div>
                    ))}

                    <div className="flex items-start gap-2 mt-4">
                        <div className="w-4 h-4 border border-gray-300 bg-white mt-0.5 rounded-sm"></div>
                        <span className="text-xs text-gray-500 leading-tight">{getTranslation('LABEL_PRIVACY_POLICY_CONSENT', currentLanguage)}</span>
                    </div>

                    <div className="pt-4">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Captcha <RefreshCw className="inline w-3 h-3 ml-1" /></label>
                        <div className="mb-2 flex h-[58px] w-[180px] items-center justify-center rounded-sm border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-500">Server CAPTCHA image</div>
                        <input className="w-full border border-gray-300 p-2 text-sm bg-white rounded-sm" placeholder="Captcha eingeben" disabled />
                    </div>

                    <button
                        className="w-full text-white py-3 font-bold text-sm shadow-md opacity-80 cursor-not-allowed tracking-wider rounded-sm mt-4"
                        style={{ backgroundColor: themeConfig['--primary-color'] }}
                    >
                        {config.buttonText || getTranslation('LABEL_SEND_MESSAGE', currentLanguage)}
                    </button>
                </div>
            </div>
        </div>
    );
};

const VisibilityToggle = ({
    checked,
    onCheckedChange,
    ariaLabel
}: {
    checked: boolean;
    onCheckedChange: (next: boolean) => void;
    ariaLabel: string;
}) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        onClick={() => onCheckedChange(!checked)}
        className="shrink-0 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] focus-visible:ring-offset-1"
    >
        <span className={`relative block w-9 h-5 rounded-full transition-colors ${checked ? 'bg-[var(--primary-color)]' : 'bg-gray-300'}`}>
            <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-150"
                style={{ left: checked ? '16px' : '2px' }}
            />
        </span>
    </button>
);

// --- CONTACT FORM EDIT MODAL (New Popup) ---
const ContactFormEditModal = ({ initialConfig, onSave, onCancel }: { initialConfig: ContactConfigType, onSave: (c: ContactConfigType) => void, onCancel: () => void }) => {
    const { themeConfig, currentLanguage } = useStore();
    const nestedModalZ = getNestedPortalZFromStore(20);
    const t = (key: string) => getTranslation(key, currentLanguage);
    const [activeTab, setActiveTab] = useState<'TEXT' | 'PREVIEW'>('TEXT');
    const [config, setConfig] = useState<ContactConfigType>(initialConfig);
    const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
    const imageOptimizer = useImageOptimizer();

    // Field Management
    const addField = () => {
        const newField: ContactField = {
            id: `f_${Date.now()}`,
            label: getTranslation('LABEL_NEW_FIELD', currentLanguage),
            placeholder: '',
            type: 'text',
            required: false
        };
        setConfig(prev => ({ ...prev, fields: [...prev.fields, newField] }));
    };

    const updateField = (id: string, updates: Partial<ContactField>) => {
        setConfig(prev => ({
            ...prev,
            fields: prev.fields.map(f => f.id === id ? { ...f, ...updates } : f)
        }));
    };

    const deleteField = (id: string) => {
        setConfig(prev => ({ ...prev, fields: prev.fields.filter(f => f.id !== id) }));
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === config.fields.length - 1)) return;
        const newFields = [...config.fields];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [newFields[index], newFields[swapIndex]] = [newFields[swapIndex], newFields[index]];
        setConfig(prev => ({ ...prev, fields: newFields }));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        imageOptimizer.prepareFile(file)
            .then((prepared) => setConfig(prev => ({ ...prev, bgImage: prepared.previewUrl })))
            .catch(console.error);
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" style={{ zIndex: nestedModalZ }}>
            <GenericModal
                title={t('TITLE_EDIT_CONTACT_FORM_TEMPLATE')}
                onClose={onCancel}
                width="w-[80vw] min-w-[1000px]"
                noFooter={true}
                noBodyPadding={true}
                bodyOverflow="hidden"
            >
                <div className="flex flex-col h-full min-h-0 bg-white">
                    {/* Tabs */}
                    <div className="flex flex-shrink-0 border-b border-gray-200 px-6 mt-2">
                        <button
                            onClick={() => setActiveTab('TEXT')}
                            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'TEXT' ? '' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            style={{
                                color: activeTab === 'TEXT' ? themeConfig['--primary-color'] : undefined,
                                borderBottomColor: activeTab === 'TEXT' ? themeConfig['--primary-color'] : 'transparent'
                            }}
                        >
                            {t('TAB_TEXT_UPPER')}
                        </button>
                        <button
                            onClick={() => setActiveTab('PREVIEW')}
                            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'PREVIEW' ? '' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            style={{
                                color: activeTab === 'PREVIEW' ? themeConfig['--primary-color'] : undefined,
                                borderBottomColor: activeTab === 'PREVIEW' ? themeConfig['--primary-color'] : 'transparent'
                            }}
                        >
                            {t('TAB_PREVIEW_UPPER')}
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto p-8 bg-gray-50">
                        {activeTab === 'TEXT' && (
                            <div className="w-full space-y-8 animate-in slide-in-from-left-4 duration-300">

                                {/* Heading Section */}
                                <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                    <h4 className="font-bold text-gray-700 border-b pb-2 mb-4 uppercase text-xs tracking-wider">{t('SECTION_HEADING_BLOCK')}</h4>
                                    <div className="grid grid-cols-2 gap-6 mb-4">
                                        <div className="space-y-2 min-w-0">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <label className="text-xs font-bold text-gray-500 uppercase shrink-0">{t('LABEL_HEADING')}</label>
                                                <div className="flex items-center gap-2 ml-auto shrink-0">
                                                    <span className="text-xs font-medium text-gray-600">{t('LABEL_SHOW_HEADER')}</span>
                                                    <VisibilityToggle
                                                        checked={config.showHeader !== false}
                                                        onCheckedChange={(v) => setConfig(prev => ({ ...prev, showHeader: v }))}
                                                        ariaLabel={t('LABEL_SHOW_HEADER')}
                                                    />
                                                </div>
                                            </div>
                                            {(config.showHeader !== false) && (
                                                <input className="w-full min-w-0 border border-gray-300 p-2 text-sm rounded-sm" value={config.heading} onChange={(e) => setConfig(prev => ({ ...prev, heading: e.target.value }))} placeholder={t('PLACEHOLDER_FORM_TITLE')} />
                                            )}
                                        </div>
                                        <div className="space-y-2 min-w-0">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <label className="text-xs font-bold text-gray-500 uppercase shrink-0">{t('LABEL_SUBHEADING')}</label>
                                                <div className="flex items-center gap-2 ml-auto shrink-0">
                                                    <span className="text-xs font-medium text-gray-600">{t('LABEL_SHOW_SUBHEADING')}</span>
                                                    <VisibilityToggle
                                                        checked={config.showSubheading !== false}
                                                        onCheckedChange={(v) => setConfig(prev => ({ ...prev, showSubheading: v }))}
                                                        ariaLabel={t('LABEL_SHOW_SUBHEADING')}
                                                    />
                                                </div>
                                            </div>
                                            {(config.showSubheading !== false) && (
                                                <input className="w-full min-w-0 border border-gray-300 p-2 text-sm rounded-sm" value={config.subheading} onChange={(e) => setConfig(prev => ({ ...prev, subheading: e.target.value }))} placeholder={t('PLACEHOLDER_OPTIONAL_SUBTITLE')} />
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2 mb-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <label className="text-xs font-bold text-gray-500 uppercase shrink-0">{t('LABEL_DESCRIPTION')}</label>
                                            <div className="flex items-center gap-2 ml-auto shrink-0">
                                                <span className="text-xs font-medium text-gray-600">{t('LABEL_SHOW_DESC')}</span>
                                                <VisibilityToggle
                                                    checked={config.showDescription !== false}
                                                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, showDescription: v }))}
                                                    ariaLabel={t('LABEL_SHOW_DESC')}
                                                />
                                            </div>
                                        </div>
                                        {(config.showDescription !== false) && (
                                            <JoditRichTextEditor
                                                value={config.description}
                                                onChange={(val: string) => setConfig(prev => ({ ...prev, description: val }))}
                                                placeholder={t('PLACEHOLDER_SHORT_DESCRIPTION')}
                                                height={160}
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('LABEL_ALIGNMENT_BLOCK')}</label>
                                        <div className="flex gap-4">
                                            {[
                                                { id: 'Center', align: 'center' as const, labelKey: 'ALIGN_CENTER_LABEL' },
                                                { id: 'Left', align: 'left' as const, labelKey: 'ALIGN_LEFT_LABEL' }
                                            ].map(({ id, align, labelKey }) => (
                                                <button
                                                    key={id}
                                                    onClick={() => setConfig(prev => ({ ...prev, alignment: align }))}
                                                    className={`flex-1 py-2 text-sm font-medium border rounded-sm transition-colors ${config.alignment === align ? 'text-white' : 'bg-white text-gray-600'}`}
                                                    style={{ backgroundColor: config.alignment === align ? themeConfig['--primary-color'] : '#fff' }}
                                                >
                                                    {t(labelKey)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Background Section */}
                                <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                    <h4 className="font-bold text-gray-700 border-b pb-2 mb-4 uppercase text-xs tracking-wider">{t('SECTION_BACKGROUND_BLOCK')}</h4>
                                    <div className="flex gap-2 mb-4">
                                        <button onClick={() => setConfig(prev => ({ ...prev, bgType: 'none' }))} className="flex-1 py-2 text-sm font-bold border rounded-sm transition-colors" style={{ backgroundColor: config.bgType === 'none' ? themeConfig['--primary-color'] : '#fff', color: config.bgType === 'none' ? '#fff' : '#374151' }}>{t('BG_NONE')}</button>
                                        <button onClick={() => setConfig(prev => ({ ...prev, bgType: 'color' }))} className="flex-1 py-2 text-sm font-bold border rounded-sm transition-colors" style={{ backgroundColor: config.bgType === 'color' ? themeConfig['--primary-color'] : '#fff', color: config.bgType === 'color' ? '#fff' : '#374151' }}>{t('BG_COLOR')}</button>
                                        <button onClick={() => setConfig(prev => ({ ...prev, bgType: 'site-color' }))} className="flex-1 py-2 text-sm font-bold border rounded-sm transition-colors" style={{ backgroundColor: config.bgType === 'site-color' ? themeConfig['--primary-color'] : '#fff', color: config.bgType === 'site-color' ? '#fff' : '#374151' }}>{t('BG_SITE_COLOR')}</button>
                                        <button onClick={() => setConfig(prev => ({ ...prev, bgType: 'image' }))} className="flex-1 py-2 text-sm font-bold border rounded-sm transition-colors" style={{ backgroundColor: config.bgType === 'image' ? themeConfig['--primary-color'] : '#fff', color: config.bgType === 'image' ? '#fff' : '#374151' }}>{t('BG_IMAGE')}</button>
                                    </div>
                                    {config.bgType === 'site-color' && (
                                        <div className="text-sm text-gray-600">
                                            {t('MSG_USES_SITE_BG_FROM_THEME')}
                                        </div>
                                    )}
                                    {config.bgType === 'color' && (
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm text-gray-600">{t('LABEL_COLOR_SHORT')}:</label>
                                            <input type="color" value={config.bgColor || '#ffffff'} onChange={(e) => setConfig(prev => ({ ...prev, bgColor: e.target.value }))} className="h-8 w-8 border cursor-pointer" />
                                        </div>
                                    )}
                                    {config.bgType === 'image' && (
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-sm text-sm font-bold text-gray-600 hover:bg-gray-50 w-full justify-center cursor-pointer">
                                                <Upload className="w-4 h-4" /> {config.bgImage ? t('BTN_CHANGE_IMAGE') : t('BTN_UPLOAD_IMAGE')}
                                                <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" disabled={imageOptimizer.isOptimizing} />
                                            </label>
                                            <ImageOptimizationFeedback stats={imageOptimizer.stats} isProcessing={imageOptimizer.isOptimizing} className="mt-1" />
                                            {config.bgImage && <img src={config.bgImage} alt="Preview" className="h-20 object-cover border border-gray-300 rounded-sm" />}
                                        </div>
                                    )}
                                </div>

                                {/* Input Fields Section */}
                                <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                    <div className="flex justify-between items-center border-b pb-2 mb-4">
                                        <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider">{t('LABEL_INPUT_FIELDS')}</h4>
                                    </div>
                                    <div className="space-y-3">
                                        {config.fields.map((field, idx) => (
                                            <div key={field.id} className="border border-gray-200 bg-white rounded-sm">
                                                <div className="flex items-center gap-3 p-3 bg-white hover:bg-gray-50 transition-colors">
                                                    <div className="flex flex-col gap-1">
                                                        <button onClick={() => moveField(idx, 'up')} disabled={idx === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                                                        <button onClick={() => moveField(idx, 'down')} disabled={idx === config.fields.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-medium text-sm text-gray-700">{field.label}</div>
                                                        <div className="text-xs text-gray-400 capitalize">{field.type} {field.required ? t('LABEL_FIELD_REQUIRED_SUFFIX') : ''}</div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setEditingFieldId(editingFieldId === field.id ? null : field.id)} className="p-1 hover:bg-blue-50 rounded-sm transition-colors" style={{ color: themeConfig['--primary-color'] }}><Settings className="w-4 h-4" /></button>
                                                        <button onClick={() => deleteField(field.id)} className="text-red-500 p-1 hover:bg-red-50 rounded-sm"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                </div>

                                                {/* Inline Field Editor */}
                                                {editingFieldId === field.id && (
                                                    <div className="p-4 bg-gray-50 border-t border-gray-200 grid grid-cols-2 gap-4">
                                                        <div><label className="block text-xs font-bold text-gray-500 mb-1">{t('LABEL_FIELD_LABEL')}</label><input className="w-full border p-1.5 text-sm" value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} /></div>
                                                        <div><label className="block text-xs font-bold text-gray-500 mb-1">{t('LABEL_FIELD_PLACEHOLDER')}</label><input className="w-full border p-1.5 text-sm" value={field.placeholder} onChange={e => updateField(field.id, { placeholder: e.target.value })} /></div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-500 mb-1">{t('LABEL_TYPE_FIELD')}</label>
                                                            <select className="w-full border p-1.5 text-sm" value={field.type} onChange={e => updateField(field.id, { type: e.target.value as ContactField['type'] })}>
                                                                <option value="text">Text</option>
                                                                <option value="email">Email</option>
                                                                <option value="textarea">Text Area</option>
                                                                <option value="number">Number</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex items-end pb-2">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })} />
                                                                <span className="text-sm text-gray-700">{t('LABEL_REQUIRED_FIELD_CHECK')}</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <button
                                            onClick={addField}
                                            className="w-full py-2 border-2 border-dashed border-gray-300 font-bold text-sm flex items-center justify-center gap-2 transition-all mt-4"
                                            style={{ color: themeConfig['--text-secondary'] }}
                                        >
                                            <Plus className="w-4 h-4" /> {t('LABEL_ADD_FIELD')}
                                        </button>
                                    </div>
                                </div>

                                {/* Button Text */}
                                <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('LABEL_BUTTON_NAME')}</label>
                                    <input className="w-full border p-2 text-sm rounded-sm" value={config.buttonText} onChange={(e) => setConfig(prev => ({ ...prev, buttonText: e.target.value }))} placeholder={t('LABEL_SEND_MESSAGE')} />
                                </div>

                            </div>
                        )}

                        {activeTab === 'PREVIEW' && (
                            <div className="py-6 px-8 animate-in zoom-in-95 duration-300">
                                <ContactFormRenderer config={config} previewMode />
                            </div>
                        )}
                    </div>

                    {/* Footer — fixed at bottom; only content above scrolls */}
                    <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3">
                        <button type="button" onClick={onCancel} className="btn-secondary inline-flex items-center justify-center gap-2">{t('BTN_CANCEL')}</button>
                        <button
                            type="button"
                            onClick={() => onSave(config)}
                            className="btn-primary inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                        >
                            <Check className="w-4 h-4" /> {t('BTN_SAVE_CONFIG')}
                        </button>
                    </div>
                </div>
            </GenericModal>
        </div>,
        document.body
    );
};

// --- MAIN SELECTOR POPUP ---
export const SelectHeaderTemplatePopup = ({
    pageId,
    onClose,
    insertAtIndex,
}: {
    pageId: string;
    onClose: () => void;
    insertAtIndex?: number;
}) => {
    const { addContainer, updateContainer, pages, themeConfig, currentLanguage, defaultImageUrl, reorderContainers, webStudioUserRole, getPublishedTemplatesForType, sectionTemplates } = useStore();
    const nestedModalZ = getNestedPortalZFromStore(0);
    const previewModalZ = getNestedPortalZFromStore(TEMPLATE_PREVIEW_NESTED_LAYER);
    const t = (key: string) => getTranslation(key, currentLanguage);
    const isSuperAdminUser = canManageTemplates(webStudioUserRole);
    const isSiteAdminUser = isSiteAdmin(webStudioUserRole);
    const currentPage = useMemo(() => pages.find(p => p.id === pageId), [pages, pageId]);
    const boundPageTitle = getLocalizedText(currentPage?.title, currentLanguage);
    const boundPageDescription = currentPage?.description || '';
    const visibleTabs = useMemo(() => {
        return TABS.filter(tab => {
            if (!CONTAINER_TEMPLATE_FEATURES.enableTableAndMapView && (tab.id === 'TABLE_VIEW' || tab.id === 'MAP')) {
                return false;
            }
            if (isSuperAdminUser) return true;
            if (tab.id === 'TABLE_VIEW') return false;
            if (!isTemplateManagedCategory(tab.id)) return false;
            return countPublishedTemplatesForCategory(tab.id, sectionTemplates) > 0;
        });
    }, [isSuperAdminUser, sectionTemplates]);
    const [selectedCategory, setSelectedCategory] = useState('HEADER');

    useEffect(() => {
        if (!visibleTabs.some(tab => tab.id === selectedCategory)) {
            setSelectedCategory(visibleTabs[0]?.id || 'HEADER');
        }
    }, [visibleTabs, selectedCategory]);

    useEffect(() => {
        if (
            !CONTAINER_TEMPLATE_FEATURES.enableTableAndMapView
            && (selectedCategory === 'TABLE_VIEW' || selectedCategory === 'MAP')
        ) {
            setSelectedCategory('HEADER');
        }
    }, [selectedCategory]);
    const [selectedHeaderId, setSelectedHeaderId] = useState<string | null>(null);
    const [selectedSliderId, setSelectedSliderId] = useState<string | null>(null);
    const [previewType, setPreviewType] = useState<string | null>(null);
    const [isEditingContact, setIsEditingContact] = useState(false);
    const [pendingContactContainerSave, setPendingContactContainerSave] = useState(false);

    // NEW: Header Configuration State
    const [isConfiguringHeader, setIsConfiguringHeader] = useState(false);
    const [headerConfig, setHeaderConfig] = useState<HeaderConfigType>({
        containerTitle: 'Hero Section',
        heading: '',
        translations: {}
    });

    // Config States
    const [dataGridConfig, setDataGridConfig] = useState({
        title: '',
        source: 'News',
        showAllWithoutTagging: false,
        columns: 3,
        ordering: '123',
        layout: 'grid',
        speed: 5,
        autoplay: false,
        imgPos: 'top',
        border: 'sharp',
        imgBorder: 'sharp'
    });

    const [contactConfig, setContactConfig] = useState<ContactConfigType>({
        heading: t('LABEL_CONTACT_US'),
        subheading: t('LABEL_CONTACT_US_SUBHEADING'),
        description: '',
        alignment: 'center',
        bgType: 'color',
        bgColor: '#2f5596',
        bgImage: '',
        fields: [
            { id: 'f1', label: t('LABEL_FIRST_NAME'), placeholder: t('PLACEHOLDER_FIRST_NAME_EXAMPLE'), type: 'text', required: true },
            { id: 'f2', label: t('LABEL_LAST_NAME'), placeholder: t('PLACEHOLDER_LAST_NAME_EXAMPLE'), type: 'text', required: true },
            { id: 'f3', label: t('LABEL_EMAIL'), placeholder: t('PLACEHOLDER_EMAIL_EXAMPLE'), type: 'email', required: true },
            { id: 'f4', label: t('LABEL_COUNTRY'), placeholder: 'e.g. Germany', type: 'text', required: true },
            { id: 'f5', label: t('LABEL_MESSAGE'), placeholder: t('PLACEHOLDER_MESSAGE_EXAMPLE'), type: 'textarea', required: true }
        ],
        buttonText: t('LABEL_SEND_MESSAGE')
    });

    const existingContactContainer = useMemo(() => {
        const page = pages.find(p => p.id === pageId);
        if (!page) return null;
        const contactContainers = page.containers.filter(c => c.type === ContainerType.CONTACT_FORM);
        if (contactContainers.length === 0) return null;
        return [...contactContainers].sort((a, b) => (b.order || 0) - (a.order || 0))[0];
    }, [pages, pageId]);

    useEffect(() => {
        if (selectedCategory !== 'CONTACT_FORM') return;
        if (existingContactContainer?.settings) {
            setContactConfig(normalizeContactConfigFromSettings(existingContactContainer.settings));
            return;
        }
        setContactConfig({
            heading: t('LABEL_CONTACT_US'),
            subheading: t('LABEL_CONTACT_US_SUBHEADING'),
            description: '',
            alignment: 'center',
            bgType: 'color',
            bgColor: '#2f5596',
            bgImage: '',
            fields: [
                { id: 'f1', label: t('LABEL_FIRST_NAME'), placeholder: t('PLACEHOLDER_FIRST_NAME_EXAMPLE'), type: 'text', required: true },
                { id: 'f2', label: t('LABEL_LAST_NAME'), placeholder: t('PLACEHOLDER_LAST_NAME_EXAMPLE'), type: 'text', required: true },
                { id: 'f3', label: t('LABEL_EMAIL'), placeholder: t('PLACEHOLDER_EMAIL_EXAMPLE'), type: 'email', required: true },
                { id: 'f4', label: t('LABEL_COUNTRY'), placeholder: 'e.g. Germany', type: 'text', required: true },
                { id: 'f5', label: t('LABEL_MESSAGE'), placeholder: t('PLACEHOLDER_MESSAGE_EXAMPLE'), type: 'textarea', required: true }
            ],
            buttonText: t('LABEL_SEND_MESSAGE')
        });
    }, [selectedCategory, existingContactContainer?.id, currentLanguage]);

    // --- NEW: Table View & Map Configurations ---
    const [tableConfig, setTableConfig] = useState<TableConfigType>({
        title: 'Table Container',
        columns: [
            { id: 'c1', header: 'ID' },
            { id: 'c2', header: 'Title' },
            { id: 'c3', header: 'Status' }
        ],
        enableGlobalSearch: true,
        enableColumnSearch: true,
        enableSorting: true
    });

    const [containerSectionConfig, setContainerSectionConfig] = useState<ContainerSectionConfigType>({
        title: '',
        body: '',
        showTitleUnderline: true,
        bindPageTitleDescription: false,
    });
    const [selectedContainerSectionId, setSelectedContainerSectionId] = useState<string | null>(null);
    const [selectedOrgTemplateId, setSelectedOrgTemplateId] = useState<string | null>(null);
    const [selectedBuiltinPresetId, setSelectedBuiltinPresetId] = useState<string | null>(null);
    const [showTemplateEditor, setShowTemplateEditor] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<SectionTemplate | null>(null);
    const [orgTemplatePreview, setOrgTemplatePreview] = useState<SectionTemplate | null>(null);

    const publishedForCategory = useMemo(() => {
        const type = CATEGORY_TO_CONTAINER_TYPE[selectedCategory];
        return type ? getPublishedTemplatesForType(type) : [];
    }, [selectedCategory, getPublishedTemplatesForType]);

    const siteAdminMustUseTemplates = isSiteAdminUser;
    const showBuiltinPresets = isSuperAdminUser;

    // Helper: Select Logic
    const handleSelect = (tmpl: TemplateItem) => {
        setSelectedOrgTemplateId(null);
        setSelectedBuiltinPresetId(tmpl.id);
        if (selectedCategory === 'HEADER') {
            setSelectedHeaderId(tmpl.id);
            const defaultHeading =
                tmpl.id === 'hero_img'
                    ? getTranslation('DEFAULT_HERO_IMG_SAMPLE_HEADING', currentLanguage)
                    : tmpl.id === 'page_content' || tmpl.id === 'visual_text' || tmpl.id === 'color_header'
                        ? getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_HEADING', currentLanguage)
                        : getTranslation(tmpl.labelKey, currentLanguage);
            setHeaderConfig(prev => ({
                ...prev,
                heading: defaultHeading,
                ...(tmpl.id === 'visual_text'
                    ? {
                        layoutVariant: 'img_left' as const,
                        bgImage: defaultImageUrl,
                        imageSettings: parseSliderImageSettings(DEFAULT_SLIDER_IMAGE_SETTINGS),
                    }
                    : {}),
            }));
            setIsConfiguringHeader(true); // Switch to config view
            setSelectedSliderId(null);
        } else if (selectedCategory === 'SLIDER') {
            setSelectedSliderId(tmpl.id);
            setSelectedHeaderId(null);
            setIsConfiguringHeader(false);
        } else if (selectedCategory === 'CONTAINER_SECTION') {
            setSelectedContainerSectionId(tmpl.id);
        } else if (selectedCategory === 'DATA_GRID' || selectedCategory === 'CONTACT_FORM' || selectedCategory === 'MAP') {
            setSelectedHeaderId(null);
            setSelectedSliderId(null);
            setIsConfiguringHeader(false);
        }
    };

    const handleEditBuiltinPreset = (preset: BuiltinPresetDef) => {
        setEditingTemplate(buildBuiltinPresetDraftTemplate(
            selectedCategory,
            preset.id,
            t(preset.labelKey),
            t(preset.descKey)
        ));
        setShowTemplateEditor(true);
    };

    const handleBuiltinPreview = (preset: BuiltinPresetDef) => {
        setOrgTemplatePreview({
            id: `builtin_${preset.id}`,
            title: t(preset.labelKey),
            description: t(preset.descKey),
            containerType: preset.type,
            status: 'Draft',
            settings: getBuiltinPresetSettings(selectedCategory, preset.id),
            content: {},
            editableFields: [],
            sortOrder: 0,
        });
    };

    const saveContactFormToPage = async (config: ContactConfigType) => {
        const id = existingContactContainer?.id || `c_${Date.now()}`;
        let newContainer: Container | null = null;
        let shouldUpdateExistingContact = false;

        if (existingContactContainer) {
            newContainer = {
                ...existingContactContainer,
                settings: {
                    ...config,
                    align: config.alignment,
                    backgroundColor: config.bgType === 'site-color' ? 'site-color' : config.bgColor,
                    backgroundImage: config.bgImage
                },
                content: {
                    ...(existingContactContainer.content || {}),
                    title: baseMultilingualText(config.heading)
                }
            };
            shouldUpdateExistingContact = true;
        } else {
            newContainer = {
                id,
                pageId: pageId,
                type: ContainerType.CONTACT_FORM,
                order: 99,
                isVisible: true,
                status: 'Draft' as const,
                settings: {
                    ...config,
                    align: config.alignment,
                    backgroundColor: config.bgType === 'site-color' ? 'site-color' : config.bgColor,
                    backgroundImage: config.bgImage
                },
                content: { title: baseMultilingualText(config.heading) }
            };
        }

        if (newContainer) {
            if (shouldUpdateExistingContact) {
                await updateContainer(pageId, newContainer);
                onClose();
            } else {
                await finalizeContainerAdd(newContainer);
            }
        }
    };

    const finalizeContainerAdd = async (container: Container) => {
        const added = await addContainer(pageId, container);
        if (!added) return;

        if (insertAtIndex != null && insertAtIndex >= 0) {
            const page = useStore.getState().pages.find(p => p.id === pageId);
            if (page) {
                const sorted = [...page.containers].sort(compareContainersByOrder);
                const newOne = sorted.find(c => c.id === added.id);
                if (newOne) {
                    const rest = sorted.filter(c => c.id !== newOne.id);
                    rest.splice(insertAtIndex, 0, newOne);
                    await reorderContainers(pageId, rest);
                }
            }
        }
        onClose();
    };

    // Helper: Global Save Logic
    const handleGlobalSave = async () => {
        if (selectedOrgTemplateId) {
            const orgTemplate = publishedForCategory.find(tmpl => tmpl.id === selectedOrgTemplateId)
                || useStore.getState().sectionTemplates.find(tmpl => tmpl.id === selectedOrgTemplateId);
            if (orgTemplate) {
                const newContainer = buildContainerFromOrgTemplate(orgTemplate, {
                    pageId,
                    defaultImageUrl,
                });
                await finalizeContainerAdd(newContainer);
                return;
            }
        }

        if (selectedCategory === 'CONTACT_FORM' && !selectedOrgTemplateId && !selectedBuiltinPresetId) {
            setPendingContactContainerSave(true);
            setIsEditingContact(true);
            return;
        }

        const id = `c_${Date.now()}`;
        let newContainer: Container | null = null;

        if (selectedCategory === 'HEADER' && selectedHeaderId) {
            const tmpl = TEMPLATES.HEADER.find(t => t.id === selectedHeaderId);
            if (tmpl) {
                // FIXED: Explicitly set background type and image for persistence
                let bgType = 'none';
                let bgImage = '';
                let bgColor = '#ffffff';
                let minHeight = 'medium';

                if (tmpl.id === 'hero_img') {
                    bgType = 'image';
                    bgImage = defaultImageUrl;
                } else if (tmpl.id === 'color_header') {
                    bgType = 'color';
                    bgColor = COLOR_HEADER_PREVIEW_BG;
                } else if (tmpl.id === 'visual_text') {
                    bgType = 'layout';
                    bgImage = headerConfig.bgImage || defaultImageUrl;
                    minHeight = 'medium';
                }

                const titleObj = baseMultilingualText(headerConfig.heading);
                const containerTitleObj = baseMultilingualText(headerConfig.containerTitle);

                const isHeroImg = tmpl.id === 'hero_img';
                const isPageContent = tmpl.id === 'page_content';
                const isVisualText = tmpl.id === 'visual_text';
                const isColorHeader = tmpl.id === 'color_header';
                const heroSampleSubtitle = baseMultilingualText(getTranslation('DEFAULT_HERO_IMG_SAMPLE_SUBHEADING', 'en'));
                const heroSampleBtn = baseMultilingualText(getTranslation('DEFAULT_HERO_IMG_SAMPLE_BTN', 'en'));
                const emptyRichText = baseMultilingualText('');
                const pageContentSubtitle = baseMultilingualText(getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_SUBHEADING', 'en'));
                const pageContentDescription = baseMultilingualText(`<p>${getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_BODY', 'en')}</p>`);

                newContainer = {
                    id,
                    pageId: pageId,
                    type: tmpl.type,
                    order: 99,
                    isVisible: true,
                    status: 'Draft' as const,
                    settings: {
                        ...defaultSectionSpacingSettings(),
                        templateId: tmpl.id,
                        templateVariant: tmpl.id === 'hero_img' ? 1 : (tmpl.id === 'page_content' || tmpl.id === 'color_header' ? 1 : 2),
                        minHeight,
                        bgType, // Important for persistence
                        bgImage, // Important for persistence
                        bgColor,
                        layoutVariant: tmpl.id === 'visual_text' ? (headerConfig.layoutVariant || 'img_left') : undefined,
                        ...(isVisualText
                            ? { imageSettings: parseSliderImageSettings(headerConfig.imageSettings) }
                            : {}),
                        align: tmpl.id === 'visual_text' ? 'left' : 'center',
                        ...(isHeroImg
                            ? {
                                titleColor: 'white',
                                subtitleColor: 'white',
                                descColor: 'white',
                                letterCase: 'uppercase',
                                btnEnabled: true,
                                btnName: heroSampleBtn,
                                showDescription: false
                            }
                            : {}),
                        ...(isPageContent || isVisualText
                            ? {
                                btnEnabled: true,
                                btnName: heroSampleBtn,
                                titleColor: 'site',
                                subtitleColor: 'site',
                                labelColor: 'site',
                                descColor: 'site',
                                ...(isPageContent ? { letterCase: 'sentence' } : {}),
                                ...(isVisualText ? { letterCase: 'uppercase', bgColor: '#ffffff' } : {})
                            }
                            : {}),
                        ...(isColorHeader
                            ? {
                                titleColor: 'site',
                                subtitleColor: 'site',
                                letterCase: 'uppercase',
                                btnEnabled: true,
                                btnName: heroSampleBtn,
                                showDescription: false,
                                align: 'center'
                            }
                            : {})
                    },
                    content: {
                        title: titleObj,
                        containerTitle: containerTitleObj,
                        ...(isHeroImg ? { subtitle: heroSampleSubtitle, description: emptyRichText } : {}),
                        ...((isPageContent || isVisualText) ? { subtitle: pageContentSubtitle, description: pageContentDescription } : {}),
                        ...(isColorHeader ? { subtitle: heroSampleSubtitle, description: emptyRichText } : {})
                    }
                };
            }
        } else if (selectedCategory === 'SLIDER' && selectedSliderId) {
            const tmpl = TEMPLATES.SLIDER.find(t => t.id === selectedSliderId);
            if (tmpl) {
                const settings = normalizeSliderTemplateSettings({
                    ...getBuiltinPresetSettings('SLIDER', tmpl.id),
                    taggedItems: [],
                    slides: [],
                });
                newContainer = {
                    id,
                    pageId: pageId,
                    type: tmpl.type,
                    order: 99,
                    isVisible: true,
                    status: 'Draft' as const,
                    settings,
                    content: {
                        title: baseMultilingualText(getTranslation(tmpl.labelKey, 'en'))
                    }
                };
            }
        } else if (selectedCategory === 'DATA_GRID' && selectedBuiltinPresetId) {
            const settings = getBuiltinPresetSettings('DATA_GRID', selectedBuiltinPresetId);
            const preset = TEMPLATES.DATA_GRID.find(p => p.id === selectedBuiltinPresetId);
            newContainer = {
                id,
                pageId: pageId,
                type: ContainerType.CARD_GRID,
                order: 99,
                isVisible: true,
                status: 'Draft' as const,
                settings,
                content: { title: baseMultilingualText(preset ? t(preset.labelKey) : '') }
            };
        } else if (selectedCategory === 'CONTACT_FORM' && selectedBuiltinPresetId) {
            const settings = getBuiltinPresetSettings('CONTACT_FORM', selectedBuiltinPresetId);
            const preset = TEMPLATES.CONTACT_FORM.find(p => p.id === selectedBuiltinPresetId);
            newContainer = {
                id,
                pageId: pageId,
                type: ContainerType.CONTACT_FORM,
                order: 99,
                isVisible: true,
                status: 'Draft' as const,
                settings: {
                    ...settings,
                    heading: contactConfig.heading || t('LABEL_CONTACT_US'),
                    subheading: contactConfig.subheading || t('LABEL_CONTACT_US_SUBHEADING'),
                    description: contactConfig.description || '',
                    fields: contactConfig.fields,
                    buttonText: contactConfig.buttonText || t('LABEL_SEND_MESSAGE'),
                    showHeader: true,
                    showSubheading: true,
                    showDescription: true,
                },
                content: { title: baseMultilingualText(preset ? t(preset.labelKey) : t('LABEL_CONTACT_US')) }
            };
        } else if (selectedCategory === 'MAP' && selectedBuiltinPresetId) {
            const settings = normalizeMapTemplateSettings(getBuiltinPresetSettings('MAP', selectedBuiltinPresetId));
            const preset = TEMPLATES.MAP.find(p => p.id === selectedBuiltinPresetId);
            newContainer = {
                id,
                pageId: pageId,
                type: ContainerType.MAP,
                order: 99,
                isVisible: true,
                status: 'Draft' as const,
                settings,
                content: { title: baseMultilingualText(preset ? t(preset.labelKey) : '') }
            };
        } else if (selectedCategory === 'TABLE_VIEW') {
            if (!tableConfig.title) return;
            newContainer = {
                id,
                pageId: pageId,
                type: ContainerType.TABLE,
                order: 99,
                isVisible: true,
                status: 'Draft' as const,
                settings: tableConfig,
                content: { title: baseMultilingualText(tableConfig.title) }
            };
        } else if (selectedCategory === 'CONTAINER_SECTION') {
            if (!hasContainerSectionContent(containerSectionConfig)) return;
            newContainer = {
                id,
                pageId: pageId,
                type: ContainerType.CONTAINER_SECTION,
                order: 99,
                isVisible: true,
                status: 'Draft' as const,
                settings: {
                    body: containerSectionConfig.body,
                    showTitleUnderline: containerSectionConfig.showTitleUnderline,
                    bindPageTitleDescription: containerSectionConfig.bindPageTitleDescription === true,
                    letterCase: 'uppercase',
                    titleColor: 'site',
                    descColor: 'editorText',
                    titleStyle: 'h1',
                    descStyle: 'paragraph',
                },
                content: { title: baseMultilingualText(containerSectionConfig.title) }
            };
        }

        if (newContainer) {
            await finalizeContainerAdd(newContainer);
        }
    };

    const isSelected = (tmpl: TemplateItem) => {
        if (selectedBuiltinPresetId === tmpl.id) return true;
        if (selectedCategory === 'HEADER') return selectedHeaderId === tmpl.id;
        if (selectedCategory === 'SLIDER') return selectedSliderId === tmpl.id;
        if (selectedCategory === 'CONTAINER_SECTION') return selectedContainerSectionId === tmpl.id;
        if (selectedCategory === 'DATA_GRID' || selectedCategory === 'CONTACT_FORM' || selectedCategory === 'MAP') return selectedBuiltinPresetId === tmpl.id;
        return false;
    };

    const isSaveDisabled = () => {
        if (selectedOrgTemplateId) return false;
        if (siteAdminMustUseTemplates) return !selectedOrgTemplateId;
        if (selectedCategory === 'HEADER') return !selectedHeaderId && !selectedBuiltinPresetId;
        if (selectedCategory === 'SLIDER') return !selectedSliderId && !selectedBuiltinPresetId;
        if (selectedCategory === 'DATA_GRID') return !selectedBuiltinPresetId;
        if (selectedCategory === 'CONTACT_FORM') return !selectedBuiltinPresetId;
        if (selectedCategory === 'TABLE_VIEW') return !tableConfig.title || tableConfig.columns.length === 0;
        if (selectedCategory === 'MAP') return !selectedOrgTemplateId && !selectedBuiltinPresetId;
        if (selectedCategory === 'CONTAINER_SECTION') return !hasContainerSectionContent(containerSectionConfig) && !selectedBuiltinPresetId;
        return false;
    };

    // --- FULL SCREEN PREVIEW WRAPPER ---
    // --- FULL SCREEN PREVIEW WRAPPER ---
    const FullScreenPreviewWrapper = () => {
        if (!previewType) return null;
        return createPortal(
            <div className="fixed inset-0 bg-black animate-in fade-in duration-200" style={{ zIndex: previewModalZ }}>
                {(selectedCategory === 'HEADER') && <HeaderPreview type={previewType} onClose={() => setPreviewType(null)} />}
                {(selectedCategory === 'SLIDER') && <SliderPreview type={previewType} onClose={() => setPreviewType(null)} />}
                {(selectedCategory === 'CONTAINER_SECTION') && <ContainerSectionPreview type={previewType} onClose={() => setPreviewType(null)} />}
            </div>,
            document.body
        );
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" style={{ zIndex: nestedModalZ }}>
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative z-50">
                <GenericModal
                    title={t(CATEGORY_TITLE_KEYS[selectedCategory] || 'TITLE_SELECT_TMPL_HEADER')}
                    onClose={onClose}
                    width="w-[90vw] min-w-[1000px] max-w-[1400px]"
                    heightClass="h-[85vh] min-h-[600px] max-h-[90vh]"
                    noFooter={true}
                    headerIcons={null}
                    bodyOverflow="hidden"
                    noBodyPadding
                    hasActiveSubModal={showTemplateEditor}
                    customFooterClassName="bg-white"
                    customFooter={(
                        <div className="flex justify-end gap-3 w-full">
                            <button
                                type="button"
                                onClick={onClose}
                                className="btn-secondary inline-flex items-center justify-center gap-2"
                            >
                                {t('BTN_CANCEL')}
                            </button>
                            <button
                                type="button"
                                onClick={handleGlobalSave}
                                disabled={isSaveDisabled()}
                                className={`btn-primary inline-flex items-center justify-center gap-2 transition-opacity ${isSaveDisabled() ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                            >
                                {t('BTN_CONTINUE')}
                            </button>
                        </div>
                    )}
                >
                    <div className="flex flex-col flex-1 min-h-0 h-full bg-white">
                        <div className="flex flex-1 min-h-0 overflow-hidden relative">
                            {/* LEFT SIDEBAR TABS */}
                            <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col pt-6 flex-shrink-0">
                                {visibleTabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setSelectedCategory(tab.id);
                                            setIsConfiguringHeader(false);
                                            setSelectedContainerSectionId(null);
                                            setSelectedOrgTemplateId(null);
                                            setSelectedBuiltinPresetId(null);
                                        }}
                                        className={`text-left px-6 py-4 text-sm font-bold flex justify-between items-center transition-all border-l-4 ${selectedCategory === tab.id ? 'bg-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 border-transparent hover:text-gray-700'}`}
                                        style={{
                                            color: selectedCategory === tab.id ? themeConfig['--primary-color'] : 'inherit',
                                            borderLeftColor: selectedCategory === tab.id ? themeConfig['--primary-color'] : 'transparent'
                                        }}
                                    >
                                        {t(tab.labelKey)}
                                        {selectedCategory === tab.id && <ChevronRight className="w-5 h-5" />}
                                    </button>
                                ))}
                            </div>

                            {/* CONTENT AREA */}
                            <div className="flex-1 min-h-0 bg-white overflow-hidden relative flex flex-col">
                                {isTemplateManagedCategory(selectedCategory) && !isConfiguringHeader && (
                                    <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 p-8 lg:p-10">
                                        <SectionTypeTemplateArea
                                            categoryId={selectedCategory}
                                            isSuperAdmin={isSuperAdminUser}
                                            selectedTemplateId={selectedOrgTemplateId}
                                            onSelect={(tmpl) => {
                                                setSelectedOrgTemplateId(tmpl.id);
                                                setSelectedBuiltinPresetId(null);
                                                setSelectedHeaderId(null);
                                                setSelectedSliderId(null);
                                                setSelectedContainerSectionId(null);
                                                setIsConfiguringHeader(false);
                                            }}
                                            onCreateTemplate={() => { setEditingTemplate(null); setShowTemplateEditor(true); }}
                                            onEditTemplate={(tmpl) => { setEditingTemplate(tmpl); setShowTemplateEditor(true); }}
                                            onPreviewTemplate={(tmpl) => setOrgTemplatePreview(tmpl)}
                                        />

                                        {showBuiltinPresets && !selectedOrgTemplateId && (
                                            <BuiltinPresetGallery
                                                categoryId={selectedCategory}
                                                presets={TEMPLATES[selectedCategory] || []}
                                                selectedPresetId={selectedBuiltinPresetId}
                                                isSuperAdmin={isSuperAdminUser}
                                                hasOrgTemplates={publishedForCategory.length > 0 || (isSuperAdminUser && useStore.getState().sectionTemplates.some(t => t.containerType === CATEGORY_TO_CONTAINER_TYPE[selectedCategory]))}
                                                onSelect={(preset) => handleSelect(preset as TemplateItem)}
                                                onPreview={handleBuiltinPreview}
                                                onEditPreset={handleEditBuiltinPreset}
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Header Config Wizard — only after picking a built-in header preset */}
                                {selectedCategory === 'HEADER' && isConfiguringHeader && (
                                    <HeaderConfigPanel
                                        config={headerConfig}
                                        setConfig={setHeaderConfig}
                                        onBack={() => setIsConfiguringHeader(false)}
                                        templateId={selectedHeaderId}
                                    />
                                )}

                                {/* Table View */}
                                {CONTAINER_TEMPLATE_FEATURES.enableTableAndMapView && selectedCategory === 'TABLE_VIEW' && (
                                    <TableConfigPanel config={tableConfig} setConfig={setTableConfig} />
                                )}

                                {/* Container Section */}
                                {selectedCategory === 'CONTAINER_SECTION' && selectedContainerSectionId && (
                                    <ContainerSectionConfigPanel
                                        config={containerSectionConfig}
                                        setConfig={setContainerSectionConfig}
                                        pageTitle={boundPageTitle}
                                        pageDescription={boundPageDescription}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </GenericModal>
            </div>

            {/* Child Modals / Overlays */}
            {showTemplateEditor && isTemplateManagedCategory(selectedCategory) && (
                <SectionTemplateFullEditorModal
                    template={editingTemplate}
                    categoryId={selectedCategory}
                    onClose={() => { setShowTemplateEditor(false); setEditingTemplate(null); }}
                    onSaved={(saved) => {
                        setSelectedBuiltinPresetId(null);
                        if (saved.status === 'Published') {
                            setSelectedOrgTemplateId(saved.id);
                            setSelectedHeaderId(null);
                            setSelectedSliderId(null);
                            setSelectedContainerSectionId(null);
                            setIsConfiguringHeader(false);
                        }
                    }}
                />
            )}
            {orgTemplatePreview && (
                <OrgTemplatePreviewOverlay
                    template={orgTemplatePreview}
                    onClose={() => setOrgTemplatePreview(null)}
                />
            )}
            {isEditingContact && (
                <ContactFormEditModal
                    initialConfig={contactConfig}
                    onSave={(newConfig) => {
                        setContactConfig(newConfig);
                        setIsEditingContact(false);
                        if (pendingContactContainerSave) {
                            setPendingContactContainerSave(false);
                            void saveContactFormToPage(newConfig);
                        }
                    }}
                    onCancel={() => {
                        setIsEditingContact(false);
                        setPendingContactContainerSave(false);
                    }}
                />
            )}
        </div>,
        document.body
    );
};

export const ContainerTemplateSelector = ({
    pageId,
    onClose,
    insertAtIndex,
}: {
    pageId: string;
    onClose: () => void;
    insertAtIndex?: number;
}) => {
    return <SelectHeaderTemplatePopup pageId={pageId} onClose={onClose} insertAtIndex={insertAtIndex} />;
};
