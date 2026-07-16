import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore, getTranslation } from '../../store';
import { useNestedPortalZ, getNestedPortalZFromStore } from '../../utils/modalZIndex';
import { Container, ContainerType, MultilingualText } from '../../types';
import { GenericModal, TabButton } from './SharedModals';
import { baseMultilingualText } from '../../utils/containerContentHelpers';
import { defaultSectionSpacingSettings } from '../../utils/sectionSpacing';
import { getOptionalEnabledLanguages } from '../../utils/siteLanguages';
import { useImageOptimizer } from '../../../../hooks/useImageOptimizer';
import ImageOptimizationFeedback from '../../../../components/ImageOptimizationFeedback';
import JoditRichTextEditor from '../JoditEditor';
import {
    X,
    Smartphone, Tablet, Monitor, AlignLeft, AlignCenter, AlignRight,
    MoreHorizontal, Circle, Square, LayoutGrid, List as ListIcon, Play,
    ChevronLeft, ChevronRight, Check, RefreshCw, Eye, Plus, Edit3,
    Upload, Trash2, ArrowUp, ArrowDown, Settings, Globe, Wand2, AlignJustify,
    Image as ImageIcon
} from 'lucide-react';

const TABS = [
    { id: 'HEADER', label: 'Kopfbereich' },
    { id: 'SLIDER', label: 'Slider' },
    { id: 'DATA_GRID', label: 'Cards' },
    { id: 'CONTACT_FORM', label: 'Contact Form' },
    { id: 'TABLE', label: 'Tabellenansicht' }
];

const DATA_SOURCES = [
    'News', 'Event', 'Document', 'Smart Pages', 'Container Items', 'Contact'
];

interface TemplateItem {
    id: string;
    label: string;
    desc: string;
    type: ContainerType;
    previewId: string;
}

const TEMPLATES: Record<string, TemplateItem[]> = {
    HEADER: [
        { id: 'page_content', label: 'Text Header', desc: 'A clear, direct layout for important information and updates.', type: ContainerType.HERO, previewId: 'CONTENT' },
        { id: 'color_header', label: 'Header with color background', desc: 'Solid color background behind your title and content. Quick to brand and easy to read.', type: ContainerType.HERO, previewId: 'COLOR_BG' },
        { id: 'hero_img', label: 'Header with image background', desc: 'Full-width header with a background image and overlay text. Ideal for landing pages.', type: ContainerType.HERO, previewId: 'HERO' },
        { id: 'visual_text', label: 'Image & Text', desc: 'Balance visuals and copy effectively. Ideal for feature highlights or introductions.', type: ContainerType.HERO, previewId: 'VISUAL' },
    ],
    SLIDER: [
        { id: 'img_gallery', label: 'Image Gallery Carousel', desc: 'A gallery-style carousel with a main image and thumbnail navigation.', type: ContainerType.SLIDER, previewId: 'GALLERY' },
        { id: 'img_text', label: 'Image / Text Slider', desc: 'A classic slider that showcases one item at a time with navigation arrows.', type: ContainerType.SLIDER, previewId: 'SLIDER' },
    ],
    DATA_GRID: [],
    CONTACT_FORM: [],
    TABLE: [
        { id: 'table_view', label: 'Tabellenansicht', desc: 'Verbinden und zeigen Sie SharePoint-Listen in einer dynamischen Tabelle an.', type: ContainerType.TABLE, previewId: 'TABLE' }
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
    alignment: 'center' | 'left';
    letterCase?: string;
    bgType: 'none' | 'color' | 'image';
    bgColor: string;
    bgImage: string;
    fields: ContactField[];
    buttonText: string;
}

interface HeaderConfigType {
    containerTitle: string;
    heading: string;
    translations: Record<string, { containerTitle: string; heading: string }>;
}

interface DataGridConfigType {
    title: string;
    source: string;
    columns: number;
    ordering: string;
    layout: string;
    speed: number;
    autoplay: boolean;
    imgPos: string;
    border: string;
    imgBorder: string;
}

interface ToggleOption {
    value: string | number;
    label: string;
    icon?: React.ElementType;
}

interface VisualToggleProps {
    options: ToggleOption[];
    value: string | number;
    onChange: (value: string | number) => void;
    label?: string;
}

// --- VISUAL CONFIGURATION HELPERS ---
const VisualToggle: React.FC<VisualToggleProps> = ({ options, value, onChange, label }) => {
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

// Images are now fetched from SharePoint Picture Library dynamically

// --- PREVIEW COMPONENTS ---
/** Primary CTA styling aligned with live hero buttons (see PreviewArea `HERO_SITE_PRIMARY_BTN`). */
const PREVIEW_PRIMARY_BTN_CLASS =
    'btn-primary !rounded-sm inline-flex items-center justify-center font-bold text-sm shadow-sm transition-all hover:shadow-lg active:scale-[0.98] tracking-wider';
const PREVIEW_PAGE_CONTENT_BTN_CLASS =
    'btn-page-content-cta !rounded-sm inline-flex items-center justify-center font-bold text-sm shadow-sm transition-all hover:shadow-lg active:scale-[0.98] tracking-wider';

/** Header with color background — design 4.1 light grey (not white / site primary). */
const COLOR_HEADER_PREVIEW_BG = '#ebebeb';

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
            <button onClick={onClose} className="fixed top-6 right-6 z-50 bg-black/20 hover:bg-black/40 text-white backdrop-blur-md p-2 rounded-full shadow-lg transition-colors border border-white/20">
                <X className="w-6 h-6" />
            </button>
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
    const { themeConfig } = useStore();
    const [current, setCurrent] = useState(0);
    const slides = [
        { title: 'Image Showcase Carousel', sub: 'Primary Display with Thumbnail Previews', desc: 'A visual gallery featuring a primary display with clickable thumbnail previews.', img: '' },
        { title: 'Corporate Strategy 2025', sub: 'Growth & Expansion', desc: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.', img: '' },
        { title: 'Employee Wellness Program', sub: 'Health & Balance', desc: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.', img: '' },
    ];
    const next = () => setCurrent((p) => (p + 1) % slides.length);
    const prev = () => setCurrent((p) => (p - 1 + slides.length) % slides.length);


    if (type === 'img_gallery') {
        return (
            <div className="w-full h-full bg-white relative overflow-y-auto flex items-center justify-center" style={{ fontFamily: themeConfig['--font-family-base'] }}>
                <button onClick={onClose} className="fixed top-6 right-6 z-50 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
                <div className="w-full max-w-6xl px-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold" style={{ color: themeConfig['--primary-color'] }}>Image Gallery Carousel</h1>
                        <p className="text-gray-500 mt-3" style={{ color: themeConfig['--text-secondary'] }}>A gallery-style carousel with a main image and thumbnail navigation.</p>
                    </div>
                    <div className="flex flex-col lg:flex-row gap-12 items-center bg-white">
                        <div className="flex-1 space-y-6">
                            <h2 className="text-2xl font-bold" style={{ color: themeConfig['--heading-color'] }}>{slides[current].title}</h2>
                            <h3 className="text-lg font-medium" style={{ color: themeConfig['--text-secondary'] }}>{slides[current].sub}</h3>
                            <p className="text-sm leading-relaxed" style={{ color: themeConfig['--text-primary'] }}>{slides[current].desc}</p>
                            <div className="flex gap-2 pt-4">
                                <button onClick={prev} className="p-2 bg-gray-200 rounded-sm hover:bg-gray-300 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                                <button onClick={next} className="p-2 text-white rounded-sm hover:opacity-90 transition-colors" style={{ backgroundColor: themeConfig['--primary-color'] }}><ChevronRight className="w-5 h-5" /></button>
                            </div>
                        </div>
                        <div className="flex-1 w-full h-[400px] relative">
                            <div className="w-full h-full rounded-lg overflow-hidden shadow-2xl relative bg-gray-100 flex items-center justify-center">
                                <ImageIcon className="w-12 h-12 text-gray-300" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div className="w-full h-full bg-white relative overflow-y-auto" style={{ fontFamily: themeConfig['--font-family-base'] }}>
            <button onClick={onClose} className="fixed top-6 right-6 z-50 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
            <div className="w-full h-[600px] relative overflow-hidden group bg-gray-900">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundColor: themeConfig['--brand-dark'] }}></div>
                <div className="absolute inset-0 bg-black/40" style={{ backgroundColor: `${themeConfig['--brand-dark']}cc` }}></div>
                <div className="absolute inset-0 flex items-center px-20">
                    <div className="max-w-4xl text-white space-y-4">
                        <h2 className="text-5xl font-bold" style={{ color: 'white' }}>{slides[current].title}</h2>
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

// --- CONFIG WIZARDS ---

const HeaderConfigPanel = ({ config, setConfig, onBack }: { config: HeaderConfigType, setConfig: (c: HeaderConfigType) => void, onBack: () => void }) => {
    const [activeTab, setActiveTab] = useState<'CONTENT' | 'TRANSLATION'>('CONTENT');
    const { currentLanguage, themeConfig, siteConfig } = useStore();
    const showTranslationTab = getOptionalEnabledLanguages(siteConfig).length > 0;
    const translationLanguage = 'de';

    const updateConfig = (key: keyof HeaderConfigType, value: any) => {
        setConfig({ ...config, [key]: value });
    };

    const updateUebersetzung = (field: 'containerTitle' | 'heading', value: string) => {
        setConfig({
            ...config,
            translations: {
                ...config.translations,
                [translationLanguage]: {
                    ...config.translations[translationLanguage] || {},
                    [field]: value
                }
            }
        });
    };

    const getTranslatedValue = (field: 'containerTitle' | 'heading') => {
        return config.translations[translationLanguage]?.[field] || '';
    };

    const handleSuggestAI = () => {
        // Mock AI Suggestion
        updateUebersetzung('containerTitle', `[${translationLanguage.toUpperCase()}] ${config.containerTitle}`);
        updateUebersetzung('heading', `[${translationLanguage.toUpperCase()}] ${config.heading}`);
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            <div className="px-8 pt-6 pb-2 border-b border-gray-100 bg-white flex justify-between items-center">
                <h3 className="text-xl font-bold" style={{ color: themeConfig['--primary-color'] }}>Kopfbereich konfigurieren</h3>
                <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-800 underline">Change Template</button>
            </div>

            <div className="flex border-b border-gray-200 px-8 bg-white">
                <TabButton active={activeTab === 'CONTENT'} label="Inhalt verwalten" onClick={() => setActiveTab('CONTENT')} />
                {showTranslationTab && (
                    <TabButton active={activeTab === 'TRANSLATION'} label={getTranslation('TAB_TRANSLATION', currentLanguage)} onClick={() => setActiveTab('TRANSLATION')} />
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="w-full space-y-8 bg-white p-8 shadow-sm border border-gray-200 rounded-sm">
                    {activeTab === 'CONTENT' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_CONTAINER_TITLE_SHORT', currentLanguage)}</label>
                                <input
                                    className="w-full border border-gray-300 p-2.5 text-sm rounded-sm outline-none transition-all"
                                    style={{ '--tw-ring-color': themeConfig['--primary-color'] } as any}
                                    onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${themeConfig['--primary-color']}`}
                                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                                    value={config.containerTitle}
                                    onChange={(e) => updateConfig('containerTitle', e.target.value)}
                                    placeholder="Enter Container Title"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_HEADING', currentLanguage)}</label>
                                <input
                                    className="w-full border border-gray-300 p-2.5 text-sm rounded-sm outline-none transition-all"
                                    style={{ '--tw-ring-color': themeConfig['--primary-color'] } as any}
                                    onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${themeConfig['--primary-color']}`}
                                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                                    value={config.heading}
                                    onChange={(e) => updateConfig('heading', e.target.value)}
                                    placeholder="Enter Main Heading"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'TRANSLATION' && showTranslationTab && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                    <Globe className="w-3 h-3" /> Target: {currentLanguage.toUpperCase()}
                                </div>
                                <button onClick={handleSuggestAI} className="text-xs font-bold flex items-center gap-1.5 hover:bg-blue-50 px-3 py-1.5 rounded-sm transition-colors border border-transparent hover:border-blue-100" style={{ color: themeConfig['--primary-color'] }}>
                                    <Wand2 className="w-3 h-3" /> Suggest with AI
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                {/* Originals */}
                                <div className="space-y-6 opacity-70 pointer-events-none">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">{getTranslation('LABEL_ORIGINAL_CONTAINER_TITLE', currentLanguage)}</label>
                                        <div className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm rounded-sm">{config.containerTitle || <span className="italic">{getTranslation('LABEL_EMPTY', currentLanguage)}</span>}</div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">{getTranslation('LABEL_ORIGINAL_HEADING', currentLanguage)}</label>
                                        <div className="w-full p-2.5 bg-gray-50 border border-gray-200 text-sm rounded-sm">{config.heading || <span className="italic">{getTranslation('LABEL_EMPTY', currentLanguage)}</span>}</div>
                                    </div>
                                </div>

                                {/* Uebersetzungs */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">{getTranslation('LABEL_TRANSLATED_CONTAINER_TITLE', currentLanguage)}</label>
                                        <input
                                            className="w-full border border-gray-300 p-2.5 text-sm rounded-sm outline-none transition-all"
                                            style={{ '--tw-ring-color': themeConfig['--primary-color'] } as any}
                                            onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${themeConfig['--primary-color']}`}
                                            onBlur={(e) => e.target.style.boxShadow = 'none'}
                                            value={getTranslatedValue('containerTitle')}
                                            onChange={(e) => updateUebersetzung('containerTitle', e.target.value)}
                                            placeholder={`Enter ${currentLanguage.toUpperCase()} translation`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">{getTranslation('LABEL_TRANSLATED_HEADING', currentLanguage)}</label>
                                        <input
                                            className="w-full border border-gray-300 p-2.5 text-sm rounded-sm outline-none transition-all"
                                            style={{ '--tw-ring-color': themeConfig['--primary-color'] } as any}
                                            onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${themeConfig['--primary-color']}`}
                                            onBlur={(e) => e.target.style.boxShadow = 'none'}
                                            value={getTranslatedValue('heading')}
                                            onChange={(e) => updateUebersetzung('heading', e.target.value)}
                                            placeholder={`Enter ${currentLanguage.toUpperCase()} translation`}
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

const DataGridConfigPanel = ({ config, setConfig }: { config: DataGridConfigType, setConfig: (c: DataGridConfigType) => void }) => {
    const { themeConfig, currentLanguage } = useStore();
    const updateConfig = (key: keyof DataGridConfigType, value: any) => {
        setConfig({ ...config, [key]: value });
    };
    const isSliderLayout = config.layout === 'slider';

    return (
        <div className="h-full overflow-y-auto p-8 bg-gray-50">
            <div className="w-full space-y-8 bg-white p-8 shadow-sm border border-gray-200 rounded-sm">

                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{getTranslation('LABEL_CONTAINER_TITLE_SHORT', currentLanguage)} <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <input className="w-full border p-2 pl-3 text-sm border-gray-300" value={config.title} onChange={e => updateConfig('title', e.target.value)} placeholder={getTranslation('PLACEHOLDER_ENTER_CONTAINER_TITLE', currentLanguage)} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{getTranslation('LABEL_DATA_SOURCE', currentLanguage)} <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <select className="w-full border p-2 text-sm border-gray-300" value={config.source} onChange={e => updateConfig('source', e.target.value)}>
                                {DATA_SOURCES.map(ds => <option key={ds} value={ds}>{ds}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                    <VisualToggle label="Columns" value={config.columns} onChange={(v: any) => updateConfig('columns', v)} options={[{ value: 1, label: '1 Column', icon: Smartphone }, { value: 2, label: '2 Columns', icon: Tablet }, { value: 3, label: '3 Columns', icon: Monitor }]} />
                </div>

                <div>
                    <VisualToggle
                        label={getTranslation('LABEL_ORDERING_TYPE', currentLanguage)}
                        value={config.ordering}
                        onChange={(v: any) => updateConfig('ordering', v)}
                        options={[
                            { value: '123', label: '123' },
                            { value: 'III', label: 'I II III' },
                            { value: 'IIIII', label: 'IIIII', icon: AlignJustify },
                            { value: 'ABC', label: 'ABC' },
                            { value: 'abc', label: 'abc' },
                            { value: 'dots', label: '...', icon: MoreHorizontal },
                            { value: 'none', label: getTranslation('LABEL_NONE', currentLanguage), icon: X }
                        ]}
                    />
                </div>

                <div className="grid grid-cols-2 gap-8 pt-4">
                    <VisualToggle label={getTranslation('LABEL_CARD_LAYOUT', currentLanguage)} value={config.layout} onChange={(v: any) => updateConfig('layout', v)} options={[{ value: 'grid', label: 'Grid', icon: LayoutGrid }, { value: 'slider', label: 'Slider', icon: ListIcon }]} />

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
                            {config.autoplay
                                ? getTranslation('MSG_CARD_SLIDER_AUTOPLAY_ON', currentLanguage)
                                : getTranslation('MSG_CARD_SLIDER_AUTOPLAY_OFF', currentLanguage)}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-4">
                    <VisualToggle
                        label={getTranslation('LABEL_CARD_BORDER', currentLanguage)}
                        value={config.border}
                        onChange={(v: any) => updateConfig('border', v)}
                        options={[
                            { value: 'sharp', label: getTranslation('LABEL_SHARP', currentLanguage), icon: Square },
                            { value: 'rounded', label: getTranslation('LABEL_ROUNDED', currentLanguage), icon: Square },
                            { value: 'none', label: getTranslation('LABEL_NONE', currentLanguage), icon: X }
                        ]}
                    />
                    <VisualToggle
                        label={getTranslation('LABEL_IMAGE_POSITION', currentLanguage)}
                        value={config.imgPos}
                        onChange={(v: any) => updateConfig('imgPos', v)}
                        options={[
                            { value: 'left', label: getTranslation('LABEL_LEFT', currentLanguage), icon: AlignLeft },
                            { value: 'top', label: getTranslation('LABEL_TOP', currentLanguage), icon: AlignCenter },
                            { value: 'right', label: getTranslation('LABEL_RIGHT', currentLanguage), icon: AlignRight },
                            { value: 'none', label: getTranslation('LABEL_NONE', currentLanguage), icon: X }
                        ]}
                    />
                </div>

                <div className="pt-4">
                    <VisualToggle
                        label={getTranslation('LABEL_IMAGE_BORDER_SECTION', currentLanguage)}
                        value={config.imgBorder || config.border || 'sharp'}
                        onChange={(v: any) => updateConfig('imgBorder', v)}
                        options={[
                            { value: 'sharp', label: getTranslation('LABEL_SHARP_CORNERS', currentLanguage), icon: Square },
                            { value: 'rounded', label: getTranslation('LABEL_ROUNDED_CORNERS', currentLanguage), icon: Square },
                            { value: 'circle', label: getTranslation('LABEL_CIRCLE', currentLanguage), icon: Circle },
                            { value: 'halfcircle', label: getTranslation('LABEL_HALFCIRCLE', currentLanguage), icon: Circle }
                        ]}
                    />
                </div>

            </div>
        </div>
    );
};

// --- CONTACT FORM RENDERER (Shared) ---
const ContactFormRenderer = ({ config }: { config: ContactConfigType }) => {
    const { themeConfig, currentLanguage } = useStore();
    return (
        <div
            className="bg-white p-10 w-full max-w-xl shadow-xl border border-gray-200 rounded-sm relative transition-all duration-300 mx-auto"
            style={{
                backgroundColor: config.bgType === 'color' ? config.bgColor : 'white',
                backgroundImage: config.bgType === 'image' && config.bgImage ? `url("${config.bgImage}")` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }}
        >
            {/* Overlay if image bg to ensure text readability */}
            {config.bgType === 'image' && <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-sm z-0"></div>}

            <div className={`relative z-10 text-${config.alignment === 'center' ? 'center' : 'left'} mb-8`}>
                {config.heading && <h2 className="text-3xl font-bold mb-2" style={{ color: themeConfig['--primary-color'] }}>{config.heading}</h2>}
                {config.subheading && <p className="text-gray-500 text-sm font-medium">{config.subheading}</p>}
                {config.description && <div className="text-gray-400 text-xs mt-2" dangerouslySetInnerHTML={{ __html: config.description }} />}
            </div>

            <div className="relative z-10 space-y-4">
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
                    <input className="w-full border border-gray-300 p-2 text-sm bg-white rounded-sm" placeholder={getTranslation('PLACEHOLDER_ENTER_CAPTCHA', currentLanguage)} disabled />
                </div>

                <button
                    className="w-full text-white py-3 font-bold text-sm shadow-md opacity-80 cursor-not-allowed tracking-wider rounded-sm mt-4"
                    style={{ backgroundColor: themeConfig['--primary-color'] }}
                >
                    {config.buttonText || 'Send Message'}
                </button>
            </div>
        </div>
    );
};

// --- CONTACT FORM EDIT MODAL (New Popup) ---
const ContactFormEditModal = ({ initialConfig, onSave, onCancel }: { initialConfig: ContactConfigType, onSave: (c: ContactConfigType) => void, onCancel: () => void }) => {
    const { themeConfig, currentLanguage } = useStore();
    const [activeTab, setActiveTab] = useState<'TEXT' | 'PREVIEW'>('TEXT');
    const [config, setConfig] = useState<ContactConfigType>(initialConfig);
    const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
    const imageOptimizer = useImageOptimizer();

    // Field Management
    const addField = () => {
        const newField: ContactField = {
            id: `f_${Date.now()}`,
            label: 'New Field',
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
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" style={{ zIndex: getNestedPortalZFromStore(0) }}>
            <GenericModal
                title={getTranslation('TITLE_EDIT_CONTACT_FORM_TEMPLATE', currentLanguage)}
                onClose={onCancel}
                width="w-[80vw] min-w-[80vw] max-w-[80vw]"
                noFooter={true}
                noBodyPadding={true}
                bodyOverflow="hidden"
            >
                <div className="flex flex-col h-full min-h-0 bg-white" style={{ fontFamily: themeConfig['--font-family-base'] }}>
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
                            TEXT
                        </button>
                        <button
                            onClick={() => setActiveTab('PREVIEW')}
                            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'PREVIEW' ? '' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            style={{
                                color: activeTab === 'PREVIEW' ? themeConfig['--primary-color'] : undefined,
                                borderBottomColor: activeTab === 'PREVIEW' ? themeConfig['--primary-color'] : 'transparent'
                            }}
                        >
                            PREVIEW
                        </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto p-8 bg-gray-50">
                        {activeTab === 'TEXT' && (
                            <div className="w-full space-y-8 animate-in slide-in-from-left-4 duration-300">

                                {/* Heading Section */}
                                <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                    <h4 className="font-bold border-b pb-2 mb-4 uppercase text-xs tracking-wider" style={{ color: themeConfig['--heading-color'] }}>Heading Section</h4>
                                    <div className="grid grid-cols-2 gap-6 mb-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_HEADING', currentLanguage)}</label>
                                            <input className="w-full border border-gray-300 p-2 text-sm rounded-sm" value={config.heading} onChange={(e) => setConfig({ ...config, heading: e.target.value })} placeholder="Form Title" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_SUBHEADING', currentLanguage)}</label>
                                            <input className="w-full border border-gray-300 p-2 text-sm rounded-sm" value={config.subheading} onChange={(e) => setConfig({ ...config, subheading: e.target.value })} placeholder="Optional Subtitle" />
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_DESCRIPTION', currentLanguage)}</label>
                                        <JoditRichTextEditor
                                            value={config.description}
                                            onChange={(val: string) => setConfig({ ...config, description: val })}
                                            placeholder="Short description..."
                                            height={160}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_ALIGNMENT', currentLanguage)}</label>
                                        <div className="flex gap-4">
                                            {['Center', 'Left'].map(align => (
                                                <button
                                                    key={align}
                                                    onClick={() => setConfig({ ...config, alignment: align.toLowerCase() as any })}
                                                    className={`flex-1 py-2 text-sm font-medium border rounded-sm transition-colors ${config.alignment === align.toLowerCase() ? 'text-white' : 'bg-white text-gray-600'}`}
                                                    style={{ backgroundColor: config.alignment === align.toLowerCase() ? themeConfig['--primary-color'] : '#fff' }}
                                                >
                                                    {align}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Background Section */}
                                <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                    <h4 className="font-bold border-b pb-2 mb-4 uppercase text-xs tracking-wider" style={{ color: themeConfig['--heading-color'] }}>Background Section</h4>
                                    <div className="flex gap-2 mb-4">
                                        <button onClick={() => setConfig({ ...config, bgType: 'none' })} className="flex-1 py-2 text-sm font-bold border rounded-sm transition-colors" style={{ backgroundColor: config.bgType === 'none' ? themeConfig['--primary-color'] : '#fff', color: config.bgType === 'none' ? '#fff' : '#374151' }}>No Background</button>
                                        <button onClick={() => setConfig({ ...config, bgType: 'color' })} className="flex-1 py-2 text-sm font-bold border rounded-sm transition-colors" style={{ backgroundColor: config.bgType === 'color' ? themeConfig['--primary-color'] : '#fff', color: config.bgType === 'color' ? '#fff' : '#374151' }}>Color</button>
                                        <button onClick={() => setConfig({ ...config, bgType: 'image' })} className="flex-1 py-2 text-sm font-bold border rounded-sm transition-colors" style={{ backgroundColor: config.bgType === 'image' ? themeConfig['--primary-color'] : '#fff', color: config.bgType === 'image' ? '#fff' : '#374151' }}>Image</button>
                                    </div>
                                    {config.bgType === 'color' && (
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm text-gray-600">{getTranslation('LABEL_COLOR_SHORT', currentLanguage)}:</label>
                                            <input type="color" value={config.bgColor || '#ffffff'} onChange={(e) => setConfig({ ...config, bgColor: e.target.value })} className="h-8 w-8 border cursor-pointer" />
                                        </div>
                                    )}
                                    {config.bgType === 'image' && (
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-sm text-sm font-bold text-gray-600 hover:bg-gray-50 w-full justify-center cursor-pointer">
                                                <Upload className="w-4 h-4" /> {config.bgImage ? 'Change Image' : 'Upload Image'}
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
                                        <h4 className="font-bold border-b pb-2 mb-4 uppercase text-xs tracking-wider" style={{ color: themeConfig['--heading-color'] }}>Input Fields</h4>
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
                                                        <div className="text-xs text-gray-400 capitalize">{field.type} {field.required ? '(Required)' : ''}</div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setEditingFieldId(editingFieldId === field.id ? null : field.id)} className="p-1 hover:bg-blue-50 rounded-sm transition-colors" style={{ color: themeConfig['--primary-color'] }}><Settings className="w-4 h-4" /></button>
                                                        <button onClick={() => deleteField(field.id)} className="text-red-500 p-1 hover:bg-red-50 rounded-sm transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                </div>

                                                {/* Inline Field Editor */}
                                                {editingFieldId === field.id && (
                                                    <div className="p-4 bg-gray-50 border-t border-gray-200 grid grid-cols-2 gap-4">
                                                        <div><label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LBL_LABEL_TEXT', currentLanguage)}</label><input className="w-full border p-1.5 text-sm" value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} /></div>
                                                        <div><label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_PLACEHOLDER', currentLanguage)}</label><input className="w-full border p-1.5 text-sm" value={field.placeholder} onChange={e => updateField(field.id, { placeholder: e.target.value })} /></div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-500 mb-1">{getTranslation('LABEL_TYPE_FIELD', currentLanguage)}</label>
                                                            <select className="w-full border p-1.5 text-sm" value={field.type} onChange={e => updateField(field.id, { type: e.target.value as any })}>
                                                                <option value="text">Text</option>
                                                                <option value="email">Email</option>
                                                                <option value="textarea">Text Area</option>
                                                                <option value="number">Number</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex items-end pb-2">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })} />
                                                                <span className="text-sm text-gray-700">{getTranslation('LABEL_REQUIRED_FIELD_CHECK', currentLanguage)}</span>
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
                                            <Plus className="w-4 h-4" /> Add New Field
                                        </button>
                                    </div>
                                </div>

                                {/* Button Text */}
                                <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_BUTTON_TEXT', currentLanguage)}</label>
                                    <input className="w-full border p-2 text-sm rounded-sm" value={config.buttonText} onChange={(e) => setConfig({ ...config, buttonText: e.target.value })} placeholder="Send Message" />
                                </div>

                            </div>
                        )}

                        {activeTab === 'PREVIEW' && (
                            <div className="flex justify-center p-8 min-h-full animate-in zoom-in-95 duration-300">
                                <ContactFormRenderer config={config} />
                            </div>
                        )}
                    </div>

                    {/* Footer — fixed at bottom; only content above scrolls */}
                    <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3">
                        <button onClick={onCancel} className="px-6 py-2 border bg-white font-bold hover:bg-gray-100 rounded-sm" style={{ color: themeConfig['--text-primary'], borderColor: themeConfig['--border-color'] }}>Abbrechen</button>
                        <button
                            onClick={() => onSave(config)}
                            className="px-8 py-2 text-white text-sm font-bold rounded-sm shadow-sm hover:opacity-90 flex items-center gap-2 transition-opacity"
                            style={{ backgroundColor: themeConfig['--primary-color'] }}
                        >
                            <Check className="w-4 h-4" /> Konfiguration speichern
                        </button>
                    </div>
                </div>
            </GenericModal>
        </div>,
        document.body
    );
};

// --- MAIN SELECTOR POPUP ---
export const SelectHeaderTemplatePopup = ({ pageId, onClose }: { pageId: string, onClose: () => void }) => {
    const { addContainer, themeConfig, setEditingContainerId, currentLanguage, defaultImageUrl } = useStore();
    const [selectedCategory, setSelectedCategory] = useState('HEADER');
    const [previewType, setPreviewType] = useState<string | null>(null);
    const [selectedHeaderId, setSelectedHeaderId] = useState<string | null>(null);
    const [selectedSliderId, setSelectedSliderId] = useState<string | null>(null);
    const [isEditingContact, setIsEditingContact] = useState(false);

    // NEW: Header Configuration State
    const [isConfiguringHeader, setIsConfiguringHeader] = useState(false);
    const [headerConfig, setHeaderConfig] = useState<HeaderConfigType>({
        containerTitle: 'Hero Section',
        heading: '',
        translations: {}
    });

    // Config States
    const [dataGridConfig, setDataGridConfig] = useState<DataGridConfigType>({
        title: '',
        source: 'News',
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
        heading: getTranslation('LABEL_CONTACT_US', currentLanguage),
        subheading: getTranslation('LABEL_CONTACT_US_SUBHEADING', currentLanguage),
        description: '',
        alignment: 'center',
        letterCase: 'uppercase',
        bgType: 'color',
        bgColor: '#2f5596',
        bgImage: '',
        fields: [
            { id: 'f1', label: getTranslation('LABEL_FIRST_NAME', currentLanguage), placeholder: getTranslation('PLACEHOLDER_FIRST_NAME_EXAMPLE', currentLanguage), type: 'text', required: true },
            { id: 'f2', label: getTranslation('LABEL_LAST_NAME', currentLanguage), placeholder: getTranslation('PLACEHOLDER_LAST_NAME_EXAMPLE', currentLanguage), type: 'text', required: true },
            { id: 'f3', label: getTranslation('LABEL_EMAIL', currentLanguage), placeholder: getTranslation('PLACEHOLDER_EMAIL_EXAMPLE', currentLanguage), type: 'email', required: true },
            { id: 'f4', label: getTranslation('LABEL_COUNTRY', currentLanguage), placeholder: 'e.g. Germany', type: 'text', required: true },
            { id: 'f5', label: getTranslation('LABEL_MESSAGE', currentLanguage), placeholder: getTranslation('PLACEHOLDER_MESSAGE_EXAMPLE', currentLanguage), type: 'textarea', required: true }
        ],
        buttonText: getTranslation('LABEL_SEND_MESSAGE', currentLanguage)
    });

    // Helper: Select Logic
    const handleSelect = (tmpl: TemplateItem) => {
        if (selectedCategory === 'HEADER') {
            setSelectedHeaderId(tmpl.id);
            const defaultHeading =
                tmpl.id === 'hero_img'
                    ? getTranslation('DEFAULT_HERO_IMG_SAMPLE_HEADING', currentLanguage)
                    : tmpl.id === 'page_content' || tmpl.id === 'visual_text' || tmpl.id === 'color_header'
                        ? getTranslation('DEFAULT_PAGE_CONTENT_PREVIEW_HEADING', currentLanguage)
                        : tmpl.label;
            setHeaderConfig(prev => ({ ...prev, heading: defaultHeading })); // Default heading
            setIsConfiguringHeader(true); // Switch to config view
            setSelectedSliderId(null);
        } else if (selectedCategory === 'SLIDER') {
            setSelectedSliderId(tmpl.id);
            setSelectedHeaderId(null);
        }
    };

    // Helper: Global Save Logic
    const handleGlobalSave = () => {
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
                    bgImage = defaultImageUrl;
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
                        layoutVariant: tmpl.id === 'visual_text' ? 'img_left' : undefined,
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
                newContainer = {
                    id,
                    pageId: pageId,
                    type: tmpl.type,
                    order: 99,
                    isVisible: true,
                    status: 'Draft' as const,
                    settings: {
                        templateId: tmpl.id,
                        templateVariant: tmpl.id === 'img_gallery' ? 1 : 0,
                        source: 'ImageSlider',
                        taggedItems: [],
                        columns: 2,
                        autoplay: true,
                        speed: 5,
                        arrows: true,
                        dots: true,
                        showSlideTitle: true,
                        showSlideDescription: true,
                        ...(tmpl.id === 'img_gallery' ? {
                            align: 'center',
                            ordering: 'ABC',
                            enableCardReadMore: true,
                            readMoreBehavior: 'popup',
                            readMoreDisplayType: 'link',
                            cardTitleRows: '1',
                            titleStyle: 'h2',
                            cardTitleStyle: 'h4',
                            letterCase: 'uppercase',
                            cardLetterCase: 'uppercase',
                        } : {}),
                    },
                    content: { title: baseMultilingualText(tmpl.label) }
                };
            }
        } else if (selectedCategory === 'DATA_GRID') {
            if (!dataGridConfig.title) return;
            newContainer = {
                id,
                pageId: pageId,
                type: ContainerType.CARD_GRID,
                order: 99,
                isVisible: true,
                status: 'Draft' as const,
                settings: dataGridConfig,
                content: { title: baseMultilingualText(dataGridConfig.title) }
            };
        } else if (selectedCategory === 'CONTACT_FORM') {
            newContainer = {
                id,
                pageId: pageId,
                type: ContainerType.CONTACT_FORM,
                order: 99,
                isVisible: true,
                status: 'Draft' as const,
                settings: contactConfig,
                content: { title: baseMultilingualText(contactConfig.heading) }
            };
        } else if (selectedCategory === 'TABLE') {
            newContainer = {
                id,
                pageId: pageId,
                type: ContainerType.TABLE,
                order: 99,
                isVisible: true,
                status: 'Draft' as const,
                settings: {
                    title: 'Neue Tabellenansicht',
                    sourceList: '',
                    selectedColumns: [],
                    alignment: 'left',
                    contentAlignment: 'left',
                    enableGlobalSearch: true,
                    titleColorType: 'site-color',
                    bgColor: '#ffffff',
                    bgType: 'none',
                    thColor: 'site-color',
                    tdColor: 'site-color',
                    theadBgColor: '#f9fafb',
                    fontSize: '14px',
                    searchPlaceholder: 'Search...'
                },
                content: { title: baseMultilingualText('Table View') }
            };
        }

        if (newContainer) {
            addContainer(pageId, newContainer).then(added => {
                if (added) {
                    setEditingContainerId(added.id);
                }
            });
            onClose();
        }
    };

    const isSelected = (tmpl: TemplateItem) => {
        if (selectedCategory === 'HEADER') return selectedHeaderId === tmpl.id;
        if (selectedCategory === 'SLIDER') return selectedSliderId === tmpl.id;
        if (selectedCategory === 'TABLE') return true;
        return false;
    };

    const isSaveDisabled = () => {
        if (selectedCategory === 'HEADER') return !selectedHeaderId;
        if (selectedCategory === 'SLIDER') return !selectedSliderId;
        if (selectedCategory === 'DATA_GRID') return !dataGridConfig.title;
        return false; // Contact Form and Table always selectable
    };

    // --- FULL SCREEN PREVIEW WRAPPER ---
    const FullScreenPreviewWrapper = () => {
        const portalZ = useNestedPortalZ();
        if (!previewType) return null;
        return createPortal(
            <div className="fixed inset-0 bg-black animate-in fade-in duration-200" style={{ zIndex: portalZ }}>
                {(selectedCategory === 'HEADER') && <HeaderPreview type={previewType} onClose={() => setPreviewType(null)} />}
                {(selectedCategory === 'SLIDER') && <SliderPreview type={previewType} onClose={() => setPreviewType(null)} />}
            </div>,
            document.body
        );
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" style={{ zIndex: getNestedPortalZFromStore(20) }}>
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative z-50">
                <GenericModal
                    title={`${TABS.find(t => t.id === selectedCategory)?.label} Vorlage auswaehlen`}
                    onClose={onClose}
                    width="w-[85vw] min-w-[85vw] max-w-[85vw]"
                    noFooter={true}
                    headerIcons={null}
                >
                    <div className="flex flex-col h-full bg-white">
                        <div className="flex flex-1 overflow-hidden relative">
                            {/* LEFT SIDEBAR TABS */}
                            <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col pt-6 flex-shrink-0">
                                {TABS.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => { setSelectedCategory(tab.id); setIsConfiguringHeader(false); }}
                                        className={`text-left px-6 py-4 text-sm font-bold flex justify-between items-center transition-all border-l-4 ${selectedCategory === tab.id ? 'bg-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 border-transparent hover:text-gray-700'}`}
                                        style={{
                                            color: selectedCategory === tab.id ? themeConfig['--primary-color'] : 'inherit',
                                            borderLeftColor: selectedCategory === tab.id ? themeConfig['--primary-color'] : 'transparent'
                                        }}
                                    >
                                        {tab.label}
                                        {selectedCategory === tab.id && <ChevronRight className="w-5 h-5" style={{ color: themeConfig['--primary-color'] }} />}
                                    </button>
                                ))}
                            </div>

                            {/* CONTENT AREA */}
                            <div className="flex-1 bg-white overflow-hidden relative flex flex-col">
                                {/* Header, Slider & Table: List Selection */}
                                {(selectedCategory === 'HEADER' || selectedCategory === 'SLIDER' || selectedCategory === 'TABLE') && !isConfiguringHeader && (
                                    <div className="p-10 overflow-y-auto h-full bg-gray-50">
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
                                            {TEMPLATES[selectedCategory].map((tmpl) => (
                                                <div
                                                    key={tmpl.id}
                                                    onClick={() => handleSelect(tmpl)}
                                                    className={`
                                                        bg-white border rounded-sm shadow-sm transition-all flex flex-col h-full group overflow-hidden cursor-pointer
                                                        ${isSelected(tmpl) ? 'ring-2' : 'hover:shadow-xl hover:-translate-y-1'}
                                                    `}
                                                    style={{
                                                        borderColor: isSelected(tmpl) ? themeConfig['--primary-color'] : '#e5e7eb',
                                                        boxShadow: isSelected(tmpl) ? `0 0 0 2px ${themeConfig['--primary-color']}33` : 'none'
                                                    }}
                                                >
                                                    <div className="h-40 relative overflow-hidden flex items-center justify-center">
                                                        {tmpl.id === 'hero_img' ? (
                                                            <div
                                                                className="absolute inset-0 flex flex-col items-center justify-center p-6"
                                                                style={{ backgroundColor: themeConfig['--primary-color'] }}
                                                            >
                                                                <div className="relative z-10 w-full flex flex-col items-center gap-1.5">
                                                                    <div className="w-3/4 h-2 bg-white opacity-40 rounded-full" />
                                                                    <div className="w-2/3 h-2 bg-white opacity-40 rounded-full" />
                                                                    <div className="w-16 h-12 border-2 border-white/20 rounded-md flex items-center justify-center my-2">
                                                                        <ImageIcon className="w-6 h-6 text-white/30" />
                                                                    </div>
                                                                    <div className="w-3/5 h-1.5 bg-white opacity-30 rounded-full" />
                                                                    <div className="w-1/2 h-1.5 bg-white opacity-30 rounded-full" />
                                                                </div>
                                                            </div>
                                                        ) : tmpl.id === 'visual_text' ? (
                                                            <div className="absolute inset-0 flex flex-row items-stretch overflow-hidden bg-white">
                                                                <div
                                                                    className="w-1/2 h-full flex-shrink-0 flex items-center justify-center"
                                                                    style={{ backgroundColor: themeConfig['--primary-color'] }}
                                                                >
                                                                    <div
                                                                        className="flex items-center justify-center"
                                                                        style={{
                                                                            width: 'min(56%, 4.5rem)',
                                                                            height: 'min(48%, 3.25rem)',
                                                                            borderRadius: '10px',
                                                                            border: '2px solid rgba(255,255,255,0.38)',
                                                                            backgroundColor: 'rgba(255,255,255,0.1)',
                                                                        }}
                                                                    >
                                                                        <ImageIcon
                                                                            className="shrink-0"
                                                                            style={{ width: '1.35rem', height: '1.35rem', color: 'rgba(255,255,255,0.5)', strokeWidth: 2 }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div
                                                                    className="w-1/2 h-full flex flex-col justify-center bg-white min-w-0 px-2 py-1 items-start"
                                                                    style={{ gap: '8px' }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            width: '100%',
                                                                            height: '8px',
                                                                            borderRadius: 9999,
                                                                            backgroundColor: themeConfig['--primary-color'],
                                                                        }}
                                                                    />
                                                                    <div
                                                                        style={{
                                                                            width: '76%',
                                                                            height: '7px',
                                                                            borderRadius: 9999,
                                                                            backgroundColor: '#475569',
                                                                        }}
                                                                    />
                                                                    <div
                                                                        style={{
                                                                            width: '100%',
                                                                            height: '4px',
                                                                            borderRadius: 9999,
                                                                            backgroundColor: '#cbd5e1',
                                                                        }}
                                                                    />
                                                                    <div
                                                                        style={{
                                                                            width: '82%',
                                                                            height: '4px',
                                                                            borderRadius: 9999,
                                                                            backgroundColor: '#cbd5e1',
                                                                        }}
                                                                    />
                                                                    <div
                                                                        style={{
                                                                            alignSelf: 'flex-start',
                                                                            width: '38px',
                                                                            height: '15px',
                                                                            marginTop: '2px',
                                                                            borderRadius: 9999,
                                                                            backgroundColor: themeConfig['--primary-color'],
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="opacity-50 grayscale group-hover:grayscale-0 transition-all duration-500 w-full h-full" style={{ backgroundColor: themeConfig['--brand-light'] }}></div>
                                                                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                                                            </>
                                                        )}
                                                        {isSelected(tmpl) && (
                                                            <div className="absolute top-2 right-2 text-white rounded-full p-1 shadow-md z-20" style={{ backgroundColor: themeConfig['--primary-color'] }}><Check className="w-4 h-4" /></div>
                                                        )}
                                                    </div>

                                                    <div className="p-6 flex-1 flex flex-col">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h4 className="font-bold text-sm transition-colors" style={{ color: isSelected(tmpl) ? themeConfig['--primary-color'] : themeConfig['--heading-color'] }}>{tmpl.label}</h4>
                                                        </div>
                                                        <p className="text-xs leading-relaxed mb-6 flex-1" style={{ color: themeConfig['--text-secondary'] }}>{tmpl.desc}</p>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setPreviewType(tmpl.id); }}
                                                            className="w-full py-2 border text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 rounded-sm"
                                                            style={{
                                                                color: themeConfig['--text-secondary'],
                                                                borderColor: themeConfig['--border-color']
                                                            }}
                                                        >
                                                            <Eye className="w-3 h-3" /> Show Preview
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Header Config Wizard */}
                                {selectedCategory === 'HEADER' && isConfiguringHeader && (
                                    <HeaderConfigPanel
                                        config={headerConfig}
                                        setConfig={setHeaderConfig}
                                        onBack={() => setIsConfiguringHeader(false)}
                                    />
                                )}

                                {/* Data Grid */}
                                {selectedCategory === 'DATA_GRID' && (
                                    <DataGridConfigPanel config={dataGridConfig} setConfig={setDataGridConfig} />
                                )}

                                {/* Contact Form */}
                                {selectedCategory === 'CONTACT_FORM' && (
                                    <div className="p-8 h-full bg-gray-50 flex-col items-center justify-center overflow-y-auto">
                                        <div className="relative group w-full max-w-xl mx-auto">
                                            <div className="absolute top-4 right-4 z-20">
                                                <button
                                                    onClick={() => setIsEditingContact(true)}
                                                    className="p-2 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                                                    style={{ backgroundColor: themeConfig['--primary-color'] }}
                                                    title={getTranslation('TOOLTIP_EDIT_CONTACT_FORM', currentLanguage)}
                                                >
                                                    <Edit3 className="w-5 h-5" />
                                                </button>
                                            </div>
                                            {/* Preview Card */}
                                            <ContactFormRenderer config={contactConfig} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* GLOBAL FOOTER */}
                        <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3 flex-shrink-0 z-10">
                            <button onClick={onClose} className="px-6 py-2 border bg-white text-sm font-bold hover:bg-gray-100 rounded-sm" style={{ color: themeConfig['--text-primary'], borderColor: themeConfig['--border-color'] }}>Abbrechen</button>
                            <button onClick={handleGlobalSave} disabled={isSaveDisabled()} className={`px-8 py-2 text-white text-sm font-bold rounded-sm shadow-sm flex items-center gap-2 ${isSaveDisabled() ? 'bg-gray-300 cursor-not-allowed' : 'hover:opacity-90'}`} style={{ backgroundColor: isSaveDisabled() ? undefined : themeConfig['--primary-color'] }}>
                                <Check className="w-4 h-4" /> Speichern
                            </button>
                        </div>
                    </div>
                </GenericModal>
            </div>

            {/* Child Modals / Overlays */}
            <FullScreenPreviewWrapper />
            {isEditingContact && (
                <ContactFormEditModal
                    initialConfig={contactConfig}
                    onSave={(newConfig) => { setContactConfig(newConfig); setIsEditingContact(false); }}
                    onCancel={() => setIsEditingContact(false)}
                />
            )}
        </div>,
        document.body
    );
};

export const ContainerTemplateSelector = ({ pageId, onClose }: { pageId: string, onClose: () => void }) => {
    return <SelectHeaderTemplatePopup pageId={pageId} onClose={onClose} />;
};
