import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useStore, getLocalizedText, getItemTranslation, getGlobalTranslation, getTranslation, getGlobalDefaultImage } from '../store';
import { getNestedPortalZFromStore } from '../utils/modalZIndex';
import { resolveHeroOverlayBackground } from '../utils/heroImageOverlay';
import { useSPContext } from '../contexts/SPServiceContext';
import { ContainerType, ViewMode, NavItem, ModalType, ContactQuery, LanguageCode } from '../types';
import {
    Pencil, CheckCircle, Check, Plus,
    AlertTriangle, ChevronDown, MapPin, Mail, Phone,
    ChevronLeft, ChevronRight, ChevronUp,
    RefreshCw, FileText, FileSpreadsheet, Presentation, Link as LinkIcon, File, FileX,
    Globe, Search, X, Info, Menu,
    ImageIcon, Calendar
} from 'lucide-react';
import { Linkedin, Facebook, Twitter, Instagram } from './common/SocialIcons';
import { IoCalendarOutline as IoCalendarOutlineIcon } from 'react-icons/io5';
const IoCalendarOutline = IoCalendarOutlineIcon as any;
import { FaRegFilePdf as FaRegFilePdfIcon } from 'react-icons/fa';
const FaRegFilePdf = FaRegFilePdfIcon as any;
import { FaFacebook as FaFacebookIcon, FaTwitter as FaTwitterIcon, FaLinkedin as FaLinkedinIcon } from 'react-icons/fa';
const FaFacebook = FaFacebookIcon as any;
const FaTwitter = FaTwitterIcon as any;
const FaLinkedin = FaLinkedinIcon as any;
import { FaLink as FaLinkIcon } from 'react-icons/fa6';
const FaLink = FaLinkIcon as any;
import { ReadMoreModal } from './modals/ReadMoreModal';
import { EditTrigger, ConfirmDeleteDialog, TaggedOrderChangeContext } from './modals/SharedModals';
import { NewsEditor } from './modals/NewsManager';
import { EventEditor } from './modals/EventManager';
import { DocumentEditor } from './modals/DocumentManager';
import { ContactEditor } from './modals/ContactManager';
import { ContainerItemEditor } from './modals/ContainerItemManager';
import { SliderItemEditor, EditSlideModal } from './modals/SliderManager';
import { SmartPageEditor } from './modals/SmartPageManager';
import { getListItems, getListFields } from '../services/SPService';
// import Briefwahl2021 from './Briefwahl/Briefwahl2021';
import EuropawahlPortal from './Map/Briefwahl/EuropawahlPortal';
import {
    buildPreviewSectionHash,
    buildSmartPagePreviewUrl,
    findPageByRouteSlug,
    findPreviewSectionElement,
    freezePreviewScrollAtTop,
    getPreviewSectionAnchorFromHash,
    hasPreviewSectionInHash,
    migrateLegacyPreviewSectionHash,
    navigatePreviewToPage,
    navigatePreviewToSection,
    parsePreviewHashRoute,
    scrollPreviewSectionIntoView,
    scrollToPreviewSectionWithRetry,
    slugToPreviewHash as slugToHash,
} from '../utils/previewNavigation';
import { compareContainersByOrder } from '../utils/containerContentHelpers';
import { validateContactField, getFieldA11yProps, contactFieldInputClass, isRequired, interpolateMessage, type FieldErrors } from '../utils/formValidation';
import { getContactApiRoot, requestContactCaptcha, type CaptchaChallenge } from '../services/contactCaptcha';
import { FormFieldError } from './common/FormFieldError';
import {
    buildImageTextSliderDisplayItems,
    isSliderLayoutToken,
    resolveEffectiveSlideDesign,
    getSliderSplitMediaClassName,
    getSliderSplitPlaceholderClassName,
    sanitizeSliderSubtitleForDisplay,
} from '../utils/sliderLayout';
import {
    buildSliderConceptBaseCss,
    resolveGalleryTabWindowStart,
    SLIDER_CONCEPT_VISIBLE_TAB_SLOTS,
} from '../utils/sliderConcept';
import { resolveSlideImageHeight, MOBILE_MAIN_HERO_HEIGHT, isFullViewportHeightMode, resolveHeroMinHeight } from '../utils/slideImageHeight';
import {
    resolveHeaderLogoFontWeight,
    resolveHeaderMenuFontFamily,
    resolveHeaderMenuFontWeight,
} from '../utils/headerNavTypography';
import { useMobileViewport } from '../hooks/useMobileViewport';
import { useTopNavOverflow } from '../hooks/useTopNavOverflow';
import { useNarrowPreview } from '../hooks/useNarrowPreview';
import { withImageCacheBust } from '../utils/imageCache';
import { parseSliderImageSettings, resolveSliderImageRadiusStyle } from '../utils/sliderImageRadius';
import { buildActionButtonInlineStyle, pickActionButtonStyleFields } from '../utils/actionButtonStyle';
import { resolveCardGridGapStyle, resolveSliderCardWidth } from '../utils/cardGridGap';
import { TopNavigationBreadcrumb } from './common/TopNavigationBreadcrumb';
import {
    resolveHeroTypography,
    type ResolvedHeroTypography,
    getEffectiveContactFormLetterCase,
    resolveContactFormLetterCaseCss,
    applyContactFormLetterCaseToText,
    inferHeroTypographyStyle,
} from '../heroTypographyPresets';
import {
    getEnabledSiteLanguages,
    LANGUAGE_DISPLAY_NAMES,
    shouldShowLanguageSelector,
} from '../utils/siteLanguages';
import {
    getHeroThemeColors,
    hasHeroColorStyle,
    resolveHeroDescriptionColor,
    resolveHeroSubtitleColor,
    resolveHeroTitleColor,
} from '../heroColorSettings';
import './JoditEditor.css';
import moment from 'moment-timezone';
import { applySiteLayoutWidthToTheme } from '../utils/pageWidth';
import { isItemCardSource, normalizeDataGridSource, isSmartPagesSource } from '../utils/cardReadMore';
import { buildDataGridSectionItems, sortTaggedSliderItems, sourceSupportsItemSortOrder } from '../utils/dataGridContentSort';
import { isHeroActionButtonVisible, resolveContainerWithLiveTemplate, isImageTextSliderContainer } from '../utils/templatePermissions';
import { getGeoChartThemeColors } from '../utils/geoChartTheme';
import { SelectHeaderTemplatePopup } from './modals/SelectHeaderTemplatePopup';
import {
    buildCardTitleFontFamilyImportantCss,
    resolveCardTitleFontFamily,
    buildCardTitleCustomCss,
} from '../utils/fontCatalog';
import {
    hasCustomSectionSpacing,
    resolveSectionSpacingPadding,
    sectionSpacingClassName,
    withDefaultHeroSectionSpacing,
} from '../utils/sectionSpacing';


/** Hero / header primary CTA — rounded + bold to align with Web Studio chrome when theme radius is 0. */
const HERO_SITE_PRIMARY_BTN =
    'btn-primary ws-hero-action-btn inline-flex items-center justify-center text-sm shadow-sm transition-all hover:shadow-lg active:scale-[0.98] tracking-wider';

/** Text header (`page_content`): CTA fill matches heading color (template reference). */
const PAGE_CONTENT_PRIMARY_BTN =
    'btn-page-content-cta ws-hero-action-btn inline-flex items-center justify-center text-sm shadow-sm transition-all hover:shadow-lg active:scale-[0.98] tracking-wider';


const stripHtml = (html: string) => {
    if (!html) return "";
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
};

// Helper to resolve color setting into className or style object
const resolveColor = (colorSetting?: string, customHex?: string, defaultClass: string = 'text-inherit', varName?: string): { className?: string; style?: any } => {
    const key = String(colorSetting || '').trim().toLowerCase();

    if (!colorSetting || !key) {
        // Backward compatibility: some older records may only store customHex.
        if (customHex) {
            const style: any = { color: customHex };
            if (varName) style[varName] = customHex;
            return { style };
        }
        return { className: defaultClass };
    }

    let colorValue: string | undefined;
    if (key === 'site' || key === 'site-color' || key === 'sitecolor') colorValue = 'var(--primary-color)';
    else if ((key === 'color' || key === 'custom') && customHex) colorValue = customHex;
    else if (key === 'white') colorValue = '#ffffff';
    else if (key === 'black') colorValue = '#000000';
    else if (String(colorSetting).trim().startsWith('#')) colorValue = String(colorSetting).trim();

    if (colorValue) {
        const style: any = { color: colorValue };
        if (varName && colorValue !== `var(${varName})`) {
            style[varName] = colorValue;
        }
        return { style };
    }

    return { className: defaultClass };
};

// Helper for alignment classes (Tailwind uses start/end instead of left/right)
const getTailwindAlign = (align: string) => {
    if (align === 'left') return 'start';
    if (align === 'right') return 'end';
    return align;
};

// Helper: Convert number to Roman Numeral
const toRoman = (num: number): string => {
    const lookup: [string, number][] = [["M", 1000], ["CM", 900], ["D", 500], ["CD", 400], ["C", 100], ["XC", 90], ["L", 50], ["XL", 40], ["X", 10], ["IX", 9], ["V", 5], ["IV", 4], ["I", 1]];
    let roman = "";
    for (const [letter, value] of lookup) {
        while (num >= value) {
            roman += letter;
            num -= value;
        }
    }
    return roman;
};

// Helper: Get Label based on ordering type
const getOrderedLabel = (index: number, ordering: string = '123'): string => {
    const n = index + 1;
    switch (ordering) {
        case '123': return n.toString().padStart(2, '0');
        case 'III': return toRoman(n);
        case 'IIIII': return 'I'.repeat(n);
        case 'ABC': return String.fromCharCode(64 + n); // A, B, C...
        case 'abc': return String.fromCharCode(96 + n); // a, b, c...
        case 'dots': return '...';
        default: return '';
    }
};

const getContainerAnchor = (c: any) => {
    const title = c.title || '';
    if (!title) return `container-${c.id}`;
    return title.toLowerCase().trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '')
        .replace(/-+/g, '-');
};

/** SharePoint settings often store ids as strings while runtime ids may be numbers */
const matchesContainerId = (containerId: any, btnId: any) =>
    btnId != null && containerId != null && String(containerId) === String(btnId);

/** btnConfig keys from JSON are usually strings; container.id may be number — direct [id] can miss */
const getPerContainerBtnConfig = (btnConfig: Record<string, any> | undefined, containerId: any): any | undefined => {
    if (!btnConfig || containerId == null) return undefined;
    const keys = Object.keys(btnConfig);
    const direct = btnConfig[containerId as keyof typeof btnConfig];
    if (direct !== undefined) return direct;
    const sid = String(containerId);
    if (btnConfig[sid] !== undefined) return btnConfig[sid];
    const matchKey = keys.find(k => String(k) === sid);
    if (matchKey !== undefined) return btnConfig[matchKey];
    return undefined;
};

const toPxLineHeight = (value: any): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const raw = String(value).trim();
    if (!raw) return undefined;
    return raw.endsWith('px') ? raw : `${raw}px`;
};
const toPxCssValue = (value: any): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const raw = String(value).trim();
    if (!raw) return undefined;
    return raw.endsWith('px') ? raw : `${raw}px`;
};

/** Applies hero typography preset or custom settings for live preview. */
const heroTypographyToStyle = (
    typo: ResolvedHeroTypography,
    cssVarKey?: string
): React.CSSProperties => {
    const style: Record<string, string | number> = {};
    if (typo.fontSize) {
        style.fontSize = typo.fontSize;
        if (cssVarKey) style[cssVarKey] = typo.fontSize;
    }
    if (typo.fontWeight != null && typo.fontWeight !== '') {
        style.fontWeight = typo.fontWeight;
    }
    if (typo.lineHeight) {
        style.lineHeight = typo.lineHeight;
    }
    return style as React.CSSProperties;
};

const normalizeLinkValue = (value: string) => decodeURIComponent((value || '').trim());

/** Single-segment paths like "report.pdf" should stay relative; scheme-less hostnames must not (browser would resolve them on the current site). */
const CTA_SINGLE_SEGMENT_FILE_EXT = /^[^.?#\\/]+\.(pdf|docx?|xlsb?|xlsx?|pptx?|txt|csv|zip|png|jpe?g|gif|svg|webp)$/i;

/**
 * Browsers treat href="www.example.com" as a path on the current origin. Prefix https:// when the value
 * is clearly a hostname (host part contains a dot) so external CTAs open the intended destination.
 */
function resolveSchemelessCtaHref(raw: string): string {
    const t = (raw || '').trim();
    if (!t) return '#';
    const low = t.toLowerCase();
    if (low.startsWith('#')) return t;
    if (low.startsWith('javascript:') || low.startsWith('mailto:') || low.startsWith('tel:') || low.startsWith('data:')) return t;
    if (/^[a-zA-Z][\w+.-]*:/.test(t)) return t;
    if (t.startsWith('//')) return t;
    if (t.startsWith('/')) return t;
    if (!t.includes('/') && !t.includes('\\') && CTA_SINGLE_SEGMENT_FILE_EXT.test(t)) return t;
    const hostPart = t.split(/[/?#]/)[0] || '';
    if (hostPart && !hostPart.startsWith('.') && hostPart.includes('.')) return `https://${t}`;
    return t;
}

/** Aligns with handleInternalLink: full https URLs to this web are in-app navigation (same tab); only external origins open a new tab. */
function isSameWebPreviewLink(url: string, siteUrl: string): boolean {
    const normalize = (link: string) => {
        if (!link) return '';
        const [withoutHash] = link.split('#');
        return withoutHash.replace(/\/+$/, '').toLowerCase();
    };
    const normalizedInput = normalize(url);
    const normalizedSite = normalize(siteUrl);
    if (
        !normalizedInput || normalizedInput === '' || normalizedInput === '#' || normalizedInput === 'javascript:void(0)'
    ) {
        return true;
    }
    return normalizedInput.startsWith(normalizedSite);
}
const isContainerLinkType = (value?: string) => {
    const normalized = (value || '').toLowerCase().trim();
    return normalized === 'container' || normalized === 'go to container' || normalized === 'goto container';
};


// --- GEOCHART COMPONENT ---
const COUNTRY_ISO: Record<string, string> = {
    'USA': 'US', 'Germany': 'DE', 'France': 'FR', 'UK': 'GB', 'India': 'IN', 'China': 'CN'
};
const CONTINENT_CODE: Record<string, string> = {
    'Europe': '150', 'Asia': '142', 'North America': '021', 'South America': '005', 'Africa': '002', 'Oceania': '009'
};
const CONTINENT_COUNTRIES: Record<string, string[]> = {
    'Europe': ['DE', 'FR', 'GB', 'IT', 'ES', 'NL', 'PL', 'SE', 'NO', 'FI', 'DK', 'AT', 'BE', 'CH', 'PT', 'GR', 'CZ', 'HU', 'RO', 'UA'],
    'Asia': ['CN', 'IN', 'JP', 'KR', 'ID', 'TH', 'VN', 'MY', 'PH', 'BD', 'PK', 'IR', 'TR', 'SA', 'AE'],
    'North America': ['US', 'CA', 'MX', 'CU', 'GT', 'PA', 'CR', 'DO'],
    'South America': ['BR', 'AR', 'CO', 'PE', 'CL', 'VE', 'EC', 'BO', 'PY', 'UY'],
    'Africa': ['ZA', 'NG', 'ET', 'EG', 'KE', 'TZ', 'GH', 'DZ', 'MA', 'MZ', 'CI', 'MG'],
    'Oceania': ['AU', 'NZ', 'PG', 'FJ', 'SB']
};

const buildChartData = (mapType: string, selectedRegion?: string, selectedState?: string) => {
    if (mapType === 'Country' && selectedRegion) {
        const iso = COUNTRY_ISO[selectedRegion] || selectedRegion;
        // If a specific state is selected, highlight only that state
        if (selectedState) {
            return [['Region', 'Value'], [selectedState, 100]];
        }
        return [['Country', 'Value'], [iso, 100]];
    }
    if (mapType === 'Continent' && selectedRegion) {
        const countries = CONTINENT_COUNTRIES[selectedRegion] || [];
        return [['Country', 'Value'], ...countries.map((c, i) => [c, 80 + i * 5])];
    }
    // World: all major countries
    return [
        ['Country', 'Value'],
        ['DE', 200], ['FR', 150], ['GB', 180], ['IN', 220], ['US', 300],
        ['CN', 260], ['BR', 140], ['AU', 110], ['CA', 130], ['ZA', 90],
        ['JP', 170], ['RU', 160], ['IT', 145], ['ES', 135], ['AR', 120]
    ];
};

const GeoChartMap = ({ mapType, selectedRegion, selectedState, height = 400 }: {
    mapType: string; selectedRegion?: string; selectedState?: string; height?: number;
}) => {
    const { themeConfig } = useStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const primaryColor = themeConfig['--primary-color'];
    const getRegion = () => {
        if (mapType === 'Country' && selectedRegion) return COUNTRY_ISO[selectedRegion] || 'world';
        if (mapType === 'Continent' && selectedRegion) return CONTINENT_CODE[selectedRegion] || 'world';
        return 'world';
    };

    const drawChart = () => {
        const g = (window as any).google;
        if (!containerRef.current || !g?.visualization) return;

        const region = getRegion();
        // Match logic and colors from SelectHeaderTemplatePopup.tsx for consistency
        const resolution = (mapType === 'Country' && selectedRegion && selectedState) ? 'provinces' : 'countries';
        const data = g.visualization.arrayToDataTable(buildChartData(mapType, selectedRegion, selectedState));

        const chartTheme = getGeoChartThemeColors(primaryColor);
        const options = {
            region,
            displayMode: 'region',
            resolution,
            colorAxis: { minValue: 0, colors: [chartTheme.colorAxisMin, chartTheme.colorAxisMax] },
            backgroundColor: chartTheme.backgroundColor,
            datalessRegionColor: chartTheme.datalessRegionColor,
            defaultColor: chartTheme.defaultColor,
            legend: 'none',
        };
        const chart = new g.visualization.GeoChart(containerRef.current);
        chart.draw(data, options);
    };

    useEffect(() => {
        const g = (window as any).google;
        if (g?.visualization?.GeoChart) {
            drawChart();
        } else if (g?.charts) {
            g.charts.setOnLoadCallback(drawChart);
        } else {
            const existing = document.querySelector('script[src*="showchart.js"]');
            if (existing) {
                const wait = setInterval(() => {
                    if ((window as any).google?.visualization) { clearInterval(wait); drawChart(); }
                }, 200);
                return () => clearInterval(wait);
            }
            const script = document.createElement('script');
            script.src = 'https://hhhhteams.sharepoint.com/sites/HHHH/SiteAssets/showchart.js';
            script.onload = () => {
                (window as any).google.charts.load('current', { packages: ['geochart'] });
                (window as any).google.charts.setOnLoadCallback(drawChart);
            };
            document.head.appendChild(script);
        }
    }, [mapType, selectedRegion, selectedState, primaryColor]);

    return <div ref={containerRef} style={{ width: '100%', height: `${height}px` }} />;
};

const styleObjToImportantCss = (style?: React.CSSProperties): string => {
    if (!style) return '';
    return Object.entries(style)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => {
            const cssProp = key.startsWith('--') ? key : key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
            const cssValue = typeof value === 'number' && !['fontWeight', 'lineHeight', 'opacity', 'zIndex'].includes(key)
                ? `${value}px`
                : String(value);
            return `${cssProp}: ${cssValue} !important;`;
        })
        .join(' ');
};

const ensureLinksOpenInNewTab = (html: string): string => {
    if (!html || typeof DOMParser === 'undefined') return html;
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const anchors = doc.querySelectorAll('a[href]');
        anchors.forEach((anchor) => {
            const href = (anchor.getAttribute('href') || '').trim().toLowerCase();
            if (!href.startsWith('mailto:') && !href.startsWith('tel:')) {
                anchor.setAttribute('target', '_blank');
                anchor.setAttribute('rel', 'noopener noreferrer');
            }
        });
        return doc.body.innerHTML;
    } catch {
        return html;
    }
};

const normalizeLetterCaseValue = (rawValue: any): 'uppercase' | 'lowercase' | 'capitalize' | 'normal-case' => {
    const value = String(rawValue || '').trim().toLowerCase();
    if (!value || value === 'none' || value === 'normal-case') return 'normal-case';

    if (
        value === 'uppercase' ||
        value === 'grossbuchstaben' ||
        value === 'majuscules' ||
        value === 'mayúsculas' ||
        value === 'mayusculas'
    ) {
        return 'uppercase';
    }

    if (
        value === 'lowercase' ||
        value === 'kleinbuchstaben' ||
        value === 'minuscules' ||
        value === 'minúsculas' ||
        value === 'minusculas'
    ) {
        return 'lowercase';
    }

    if (
        value === 'capitalize' ||
        value === 'title' ||
        value === 'title case' ||
        value === 'wortanfang groß' ||
        value === 'wortanfang gross' ||
        value === 'casse de titre' ||
        value === 'mayúsculas en cada palabra' ||
        value === 'mayusculas en cada palabra'
    ) {
        return 'capitalize';
    }

    if (
        value === 'sentence' ||
        value === 'sentence case' ||
        value === 'satzanfang groß' ||
        value === 'satzanfang gross' ||
        value === 'casse de phrase' ||
        value === 'mayúscula inicial' ||
        value === 'mayuscula inicial'
    ) {
        return 'normal-case';
    }

    return 'normal-case';
};

/** Maps editor letterCase values to CSS text-transform (inline so it always wins over template defaults). */
const resolveLetterCaseCss = (rawValue: any): 'none' | 'uppercase' | 'lowercase' | 'capitalize' => {
    const tw = normalizeLetterCaseValue(rawValue);
    if (tw === 'normal-case') return 'none';
    return tw;
};

const resolveCardDescColorStyle = (settings: any, customHex?: string): React.CSSProperties => {
    const preset = String(settings?.cardDescColor || '').trim().toLowerCase();
    if (preset === 'bodytext' || preset === 'body-text') return { color: 'var(--text-primary)' };
    if (preset === 'secondarytext' || preset === 'secondary-text') return { color: 'var(--text-secondary, #6b7280)' };
    const resolved = resolveColor(settings?.cardDescColor, customHex ?? settings?.cardDescCustomColor, 'text-gray-600', '--text-secondary');
    return resolved.style || {};
};

/** Card item title/description styles from Cards Editor → Card Style settings. */
const getCardItemTitleStyle = (settings: any, themeConfig: Record<string, string>): React.CSSProperties => {
    const typo = heroTypographyToStyle(resolveHeroTypography(settings, 'cardTitle', themeConfig), '--font-size-h3');
    const color = resolveColor(settings?.cardTitleColor, settings?.cardTitleCustomColor, undefined);
    const letterCss = resolveLetterCaseCss(settings?.cardLetterCase ?? 'uppercase');
    const titleRows = Number(settings?.cardTitleRows || 0);
    const clampStyles = titleRows > 0 ? {
        display: '-webkit-box',
        WebkitLineClamp: titleRows,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    } : {};
    let minHeight: string | undefined;
    if (titleRows > 0) {
        const rawLineHeight = typo.lineHeight !== undefined && typo.lineHeight !== null && typo.lineHeight !== '' ? String(typo.lineHeight).trim() : '1.4';
        if (rawLineHeight.endsWith('px')) {
            const num = parseFloat(rawLineHeight);
            if (!isNaN(num)) {
                minHeight = `${num * titleRows}px`;
            }
        } else if (rawLineHeight.endsWith('rem')) {
            const num = parseFloat(rawLineHeight);
            if (!isNaN(num)) {
                minHeight = `${num * titleRows}rem`;
            }
        } else if (rawLineHeight.endsWith('em')) {
            const num = parseFloat(rawLineHeight);
            if (!isNaN(num)) {
                minHeight = `${num * titleRows}em`;
            }
        } else {
            const num = parseFloat(rawLineHeight);
            if (!isNaN(num)) {
                const factor = num > 10 ? num / 100 : num;
                minHeight = `${factor * titleRows}em`;
            } else {
                minHeight = `${1.4 * titleRows}em`;
            }
        }
    }
    const resolvedFontFamily = resolveCardTitleFontFamily(settings, themeConfig);
    return {
        margin: 0,
        ...typo,
        ...(color.style || {}),
        ...(letterCss !== 'none' ? { textTransform: letterCss } : {}),
        ...(clampStyles as React.CSSProperties),
        ...(minHeight ? { minHeight } : {}),
        fontFamily: resolvedFontFamily,
    };
};

const getEditButtonStyle = (titleStyle: React.CSSProperties): React.CSSProperties => {
    const rawLineHeight = titleStyle.lineHeight;
    let height = '1.375em'; // default to leading-snug
    if (rawLineHeight !== undefined && rawLineHeight !== null && rawLineHeight !== '') {
        const str = String(rawLineHeight).trim();
        if (str.endsWith('px') || str.endsWith('em') || str.endsWith('rem') || str.endsWith('%')) {
            height = str;
        } else {
            const num = parseFloat(str);
            if (!isNaN(num)) {
                height = `${num}em`;
            }
        }
    }
    return {
        fontSize: titleStyle.fontSize || undefined,
        height: height,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
    };
};

const getCardItemDescStyle = (settings: any, themeConfig: Record<string, string>): React.CSSProperties => {
    const typo = heroTypographyToStyle(resolveHeroTypography(settings, 'cardDesc', themeConfig), '--font-size-p');
    return {
        fontFamily: 'var(--font-family-base, sans-serif)',
        lineHeight: '1.6',
        ...typo,
        ...resolveCardDescColorStyle(settings),
    };
};

/** Centered subheading width — styles in custom.css (prebuilt tailwind.css has no md:w-[60%]). */
const WS_CENTERED_SUBHEADING_CLASS = 'ws-section-subheading-width mx-auto';

/** Editor dropdown default when `settings.letterCase` is unset (must match ContainerEditor). */
const getDefaultHeroLetterCase = (settings: any): string =>
    settings?.templateId === 'page_content' ? 'sentence' : 'uppercase';

const getEffectiveHeroLetterCase = (settings: any): string => {
    const raw = settings?.letterCase;
    if (raw != null && String(raw).trim() !== '') return String(raw).trim();
    return getDefaultHeroLetterCase(settings);
};

/** Applies letter case in JS so preview works even when global `h1` / theme CSS blocks `text-transform`. */
const applyLetterCaseToPlainText = (text: string, rawValue: any): string => {
    if (!text) return text;
    const value = String(rawValue ?? '').trim().toLowerCase();
    if (
        !value ||
        value === 'none' ||
        value === 'normal-case' ||
        value === 'sentence' ||
        value === 'sentence case' ||
        value === 'satzanfang groß' ||
        value === 'satzanfang gross' ||
        value === 'casse de phrase' ||
        value === 'mayúscula inicial' ||
        value === 'mayuscula inicial'
    ) {
        return text;
    }
    if (
        value === 'uppercase' ||
        value === 'grossbuchstaben' ||
        value === 'majuscules' ||
        value === 'mayúsculas' ||
        value === 'mayusculas'
    ) {
        return text.toLocaleUpperCase();
    }
    if (
        value === 'lowercase' ||
        value === 'kleinbuchstaben' ||
        value === 'minuscules' ||
        value === 'minúsculas' ||
        value === 'minusculas'
    ) {
        return text.toLocaleLowerCase();
    }
    if (
        value === 'capitalize' ||
        value === 'title' ||
        value === 'title case' ||
        value === 'wortanfang groß' ||
        value === 'wortanfang gross' ||
        value === 'casse de titre' ||
        value === 'mayúsculas en cada palabra' ||
        value === 'mayusculas en cada palabra'
    ) {
        // ES5-safe title case (no \p{} — project tsconfig target is es5)
        return text
            .toLocaleLowerCase()
            .replace(
                /(^|[\s\-–—/([{"'«‹]+)([^\s\-–—/([{"'«‹])/g,
                (_, prefix, char) => `${prefix}${char.toLocaleUpperCase()}`
            );
    }
    return text;
};

const renderRichText = (
    html: string,
    className?: string,
    style?: React.CSSProperties,
    applyStyleToParagraphs: boolean = false,
    descRef?: React.Ref<HTMLDivElement>
) => {
    if (!html) return null;
    let finalHtml = ensureLinksOpenInNewTab(html);

    if (applyStyleToParagraphs && style) {
        const { textAlign: _cardAlign, ...paragraphStyle } = style;
        const pCss = styleObjToImportantCss(paragraphStyle);
        if (pCss) {
            finalHtml = finalHtml.replace(/<p\b([^>]*)>/gi, (fullMatch, attrs) => {
                const styleAttrRegex = /style\s*=\s*["']([^"']*)["']/i;
                if (styleAttrRegex.test(attrs)) {
                    return `<p${attrs.replace(styleAttrRegex, (_m: string, existing: string) => `style="${existing}; ${pCss}"`)}>`;
                }
                return `<p${attrs} style="${pCss}">`;
            });
        }
    }

    const finalClassName = ['jodit-wysiwyg', className].filter(Boolean).join(' ');
    const outerStyle = applyStyleToParagraphs && style
        ? (() => { const { textAlign: _align, ...rest } = style; return rest; })()
        : style;
    return <div ref={descRef} className={finalClassName} style={outerStyle} dangerouslySetInnerHTML={{ __html: finalHtml }} />;
};

// --- HELPER: DOCUMENT ICONS ---
const getDocIcon = (type: string) => {
    switch (type) {
        case 'Word': return <FileText className="w-16 h-16 text-[var(--primary-color)] opacity-80" />;
        case 'Excel': return <FileSpreadsheet className="w-16 h-16 text-green-600 opacity-80" />;
        case 'PDF': return <File className="w-16 h-16 text-red-500 opacity-80" />;
        case 'PPT':
        case 'Presentations': return <Presentation className="w-16 h-16 text-orange-500 opacity-80" />;
        case 'Link': return <LinkIcon className="w-16 h-16 text-[var(--link-color)] opacity-80" />;
        default: return <File className="w-16 h-16 text-gray-400 opacity-80" />;
    }
};

const getSocialAriaLabel = (type: string): string => {
    switch (type) {
        case 'Facebook': return 'Facebook';
        case 'LinkedIn': return 'LinkedIn';
        case 'Twitter': return 'Twitter';
        case 'Instagram': return 'Instagram';
        default: return type ? String(type) : 'Social media';
    }
};

const getSocialIcon = (type: string) => {
    const iconStyle = { color: 'white', width: '20px', height: '20px' };
    const containerClass = "w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-sm";
    const bgStyle = { backgroundColor: 'var(--primary-color)' };

    switch (type) {
        case 'Facebook': return <div className={containerClass} style={bgStyle}><Facebook style={iconStyle} strokeWidth={2.5} /></div>;
        case 'LinkedIn': return <div className={containerClass} style={bgStyle}><Linkedin style={iconStyle} strokeWidth={2.5} /></div>;
        case 'Twitter': return <div className={containerClass} style={bgStyle}><Twitter style={iconStyle} strokeWidth={2.5} /></div>;
        case 'Instagram': return <div className={containerClass} style={bgStyle}><Instagram style={iconStyle} strokeWidth={2.5} /></div>;
        default: return <div className={containerClass} style={bgStyle}><Globe style={iconStyle} strokeWidth={2.5} /></div>;
    }
};

const getContactIcon = (type: string, color: string = 'var(--primary-color)') => {
    const style = { color: color };
    switch (type) {
        case 'Email': return <Mail className="w-5 h-5" style={style} />;
        case 'Phone': return <Phone className="w-5 h-5" style={style} />;
        case 'Address': return <MapPin className="w-5 h-5" style={style} />;
        default: return <Info className="w-5 h-5" style={style} />;
    }
};

const getButtonLabelForLanguage = (value: any, lang: LanguageCode): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value !== 'object') return '';
    return getLocalizedText(value, lang);
};

interface InternalLinkOptions {
    /** Action-button container links: jump to section instantly (no smooth scroll). */
    instant?: boolean;
}

interface ComponentRendererProps {
    container: any;
    lang: LanguageCode;
    pageTitle?: string;
    isMainHero?: boolean;
    onInternalLink: (e: React.MouseEvent, url: string, options?: InternalLinkOptions) => void;
    onNavigateToSection?: (pageId: string, pageSlug: string, anchor: string, containerId?: string | number) => void;
    onOpenDetailsPanel?: (item: any) => void;
}

/** Header with color background — design 4.1 light grey panel. */
const COLOR_HEADER_PREVIEW_BG = '#ebebeb';

// --- RENDERER 1: HEADER / HERO ---
const HeaderRenderer = ({ container, lang, isMainHero, onInternalLink, onNavigateToSection }: ComponentRendererProps) => {
    const { themeConfig, pages, siteConfig, sectionTemplates } = useStore();
    const isMobileViewport = useMobileViewport();
    const { context } = useSPContext();
    const siteUrl = context.pageContext.web.absoluteUrl;
    const { settings, content } = container;
    const isPageContent = settings.templateId === 'page_content';
    const isLayoutSplit = settings.bgType === 'layout';
    const isColorHeaderBanner = settings.templateId === 'color_header' && settings.bgType === 'color';
    const localizedHeaderBtnName = getButtonLabelForLanguage(settings.btnName, lang);
    const templateEditableFields = settings.sectionTemplateId
        ? sectionTemplates.find((t) => t.id === settings.sectionTemplateId)?.editableFields
        : undefined;
    const showHeroActionButton = isHeroActionButtonVisible(
        settings,
        localizedHeaderBtnName,
        templateEditableFields
    );
    const btnHref = settings.btnUrl ? resolveSchemelessCtaHref(settings.btnUrl) : '';
    const btnSameSite = btnHref ? isSameWebPreviewLink(btnHref, siteUrl) : true;

    // Image heroes: unreadable primary-colored h1 under global `h1 { color: var(--heading-h1-color) !important }` unless
    // --heading-h1-color is set on the node. Default missing/site title to white on image backgrounds.
    const titleColorRaw = String(settings.titleColor || '').trim().toLowerCase();
    const imageHeroUseWhiteTitle =
        settings.bgType === 'image' &&
        (!settings.titleColor || titleColorRaw === '' || titleColorRaw === 'site' || titleColorRaw === 'site-color' || titleColorRaw === 'sitecolor');
    const effectiveTitleColorSetting = imageHeroUseWhiteTitle ? 'white' : settings.titleColor;
    const heroTheme = getHeroThemeColors(themeConfig);
    const titleColorStyle = resolveHeroTitleColor(settings, effectiveTitleColorSetting, heroTheme);
    const subtitleColorStyle = resolveHeroSubtitleColor(settings, effectiveTitleColorSetting, heroTheme);
    const descriptionColorStyle = resolveHeroDescriptionColor(settings, heroTheme);
    const textAlign = settings.align === 'left' ? 'text-left' : (settings.align === 'right' ? 'text-right' : 'text-center');
    const effectiveLetterCase = getEffectiveHeroLetterCase(settings);
    const letterCase = normalizeLetterCaseValue(effectiveLetterCase);
    const headingLetterCaseCss = resolveLetterCaseCss(effectiveLetterCase);
    const localizedTitle = getLocalizedText(content.title, lang);
    const displayTitle = applyLetterCaseToPlainText(localizedTitle, effectiveLetterCase);
    const localizedDescription = getLocalizedText(content.description, lang) || '';
    const hasDescription = stripHtml(localizedDescription).trim().length > 0;
    const headerCtaBtnClass = isPageContent ? PAGE_CONTENT_PRIMARY_BTN : HERO_SITE_PRIMARY_BTN;
    const heroBtnInlineStyle = buildActionButtonInlineStyle(settings);
    const titleTypoStyle = heroTypographyToStyle(resolveHeroTypography(settings, 'title', themeConfig), '--font-size-h1');
    const subtitleTypoStyle = heroTypographyToStyle(resolveHeroTypography(settings, 'subtitle', themeConfig), '--font-size-p');
    const descTypoStyle = heroTypographyToStyle(resolveHeroTypography(settings, 'description', themeConfig), '--font-size-p');

    const ContentBlock = () => (
        <div
            className={`relative z-10 mx-auto w-full ${isPageContent || isColorHeaderBanner
                ? 'ws-page-width flex flex-col items-center'
                : isLayoutSplit
                    ? 'w-full flex flex-col'
                    : `ws-page-width ${settings.align === 'center' ? 'items-center' : ''}`
                }`}
            style={isLayoutSplit || isColorHeaderBanner ? { gap: '1rem' } : undefined}
        >
            {(settings.showHeader !== false) && displayTitle && (
                <h1
                    className={`ws-hero-heading ${titleTypoStyle.fontWeight ? '' : 'font-bold'} tracking-tight ${letterCase} ${isPageContent || isColorHeaderBanner ? 'max-w-xl mx-auto w-full' : ''}`}
                    style={{
                        ...((isPageContent || isLayoutSplit || isColorHeaderBanner) ? { fontFamily: themeConfig['--font-family-secondary'] } : {}),
                        textTransform: headingLetterCaseCss,
                        ['--ws-heading-letter-case' as string]: headingLetterCaseCss,
                        ...titleTypoStyle,
                        ...(titleTypoStyle.fontWeight ? { '--font-weight-bold': titleTypoStyle.fontWeight } as any : {}),
                        ...(isLayoutSplit && !hasHeroColorStyle(titleColorStyle, '--ws-heading-color')
                            ? {
                                color: themeConfig['--heading-color'] || heroTheme.primary,
                                ['--ws-heading-color' as string]: themeConfig['--heading-color'] || heroTheme.primary,
                                ['--heading-h1-color' as string]: themeConfig['--heading-color'] || heroTheme.primary,
                            }
                            : {}),
                        ...titleColorStyle,
                    }}
                >
                    {displayTitle}
                </h1>
            )}

            {(settings.showSubheading !== false) && getLocalizedText(content.subtitle, lang) && (
                <p
                    className={
                        isPageContent
                            ? `ws-hero-subheading ${subtitleTypoStyle.fontWeight ? '' : 'font-bold'} ${WS_CENTERED_SUBHEADING_CLASS} mt-2 mb-0`
                            : isColorHeaderBanner
                                ? `ws-hero-subheading ${subtitleTypoStyle.fontWeight ? '' : 'font-medium'} text-lg leading-snug ${WS_CENTERED_SUBHEADING_CLASS} m-0`
                                : isLayoutSplit
                                    ? `ws-hero-subheading ${subtitleTypoStyle.fontWeight ? '' : 'font-semibold'} text-lg leading-snug w-full m-0`
                                    : `ws-hero-subheading ${subtitleTypoStyle.fontWeight ? '' : 'font-medium'} mt-2 mb-2`
                    }
                    style={{
                        ...subtitleTypoStyle,
                        ...(subtitleTypoStyle.fontWeight ? { '--font-weight-bold': subtitleTypoStyle.fontWeight } as any : {}),
                        ...(!hasHeroColorStyle(subtitleColorStyle, '--ws-subheading-color') && isPageContent
                            ? {
                                color: heroTheme.bodyText,
                                ['--ws-subheading-color' as string]: heroTheme.bodyText,
                                ['--heading-h2-color' as string]: heroTheme.bodyText,
                            }
                            : {}),
                        ...(!hasHeroColorStyle(subtitleColorStyle, '--ws-subheading-color') && isLayoutSplit
                            ? {
                                color: heroTheme.bodyText,
                                ['--ws-subheading-color' as string]: heroTheme.bodyText,
                                ['--heading-h2-color' as string]: heroTheme.bodyText,
                            }
                            : {}),
                        ...(!hasHeroColorStyle(subtitleColorStyle, '--ws-subheading-color') && isColorHeaderBanner
                            ? {
                                color: heroTheme.primary,
                                ['--ws-subheading-color' as string]: heroTheme.primary,
                                ['--heading-h2-color' as string]: heroTheme.primary,
                            }
                            : {}),
                        ...subtitleColorStyle,
                    }}
                >
                    {getLocalizedText(content.subtitle, lang)}
                </p>
            )}

            {(settings.showDescription !== false) && hasDescription && (
                <div
                    className={
                        isPageContent
                            ? `ws-hero-description jodit-wysiwyg leading-relaxed text-sm max-w-4xl mt-2 ${settings.align === 'center' ? 'mx-auto' : ''}`
                            : isLayoutSplit
                                ? `ws-hero-description jodit-wysiwyg leading-relaxed text-sm max-w-4xl m-0 ${settings.align === 'center' ? 'mx-auto' : ''}`
                                : `ws-hero-description jodit-wysiwyg text-lg max-w-4xl leading-relaxed ${settings.align === 'center' ? 'mx-auto' : ''}`
                    }
                    style={{
                        ...descTypoStyle,
                        ...(!hasHeroColorStyle(descriptionColorStyle, '--ws-description-color') && (isPageContent || isLayoutSplit)
                            ? {
                                color: heroTheme.bodyText,
                                ['--ws-description-color' as string]: heroTheme.bodyText,
                            }
                            : {}),
                        ...(!descTypoStyle.fontSize && (isPageContent || isLayoutSplit) ? { fontSize: '0.9375rem' } as any : {}),
                        ...descriptionColorStyle,
                    }}
                    dangerouslySetInnerHTML={{ __html: ensureLinksOpenInNewTab(getLocalizedText(content.description, lang) || '') }}
                />
            )}

            {showHeroActionButton && (
                <div
                    className={
                        isColorHeaderBanner
                            ? 'mt-0 flex justify-center'
                            : isLayoutSplit
                                ? 'mt-0 flex justify-start'
                                : `mt-8 ${settings.align === 'center' ? 'flex justify-center' : (settings.align === 'right' ? 'flex justify-end' : '')}`
                    }
                >
                    {(isContainerLinkType(settings.btnLinkType) || (!!settings.btnContainerId && !settings.btnUrl)) && settings.btnContainerId ? (
                        /* ---- Container Scroll Mode ---- */
                        <button
                            onClick={() => {
                                const targetPage = pages.find(p => p.containers?.some(c => matchesContainerId(c.id, settings.btnContainerId)));
                                const targetC = targetPage?.containers?.find(c => matchesContainerId(c.id, settings.btnContainerId));
                                if (targetPage && targetC) {
                                    const anchor = getContainerAnchor(targetC);
                                    if (onNavigateToSection) {
                                        onNavigateToSection(
                                            targetPage.id,
                                            targetPage.slug || '/',
                                            anchor,
                                            settings.btnContainerId
                                        );
                                        return;
                                    }
                                    const finalUrl = buildPreviewSectionHash(targetPage.slug || '/', anchor);

                                    onInternalLink(
                                        { preventDefault: () => { }, stopPropagation: () => { } } as any,
                                        finalUrl,
                                        { instant: true }
                                    );
                                }
                            }}
                            className={headerCtaBtnClass}
                            style={heroBtnInlineStyle}
                        >
                            {localizedHeaderBtnName}
                        </button>
                    ) : settings.btnUrl ? (
                        /* ---- URL Mode ---- */
                        <a
                            href={btnHref}
                            target={btnSameSite ? '_self' : '_blank'}
                            rel={btnSameSite ? undefined : 'noopener noreferrer'}
                            onClick={(e) => onInternalLink(e, btnHref)}
                            className={`${headerCtaBtnClass} no-underline`}
                            style={heroBtnInlineStyle}
                        >
                            {localizedHeaderBtnName}
                        </a>
                    ) : (
                        /* ---- No Link configured (placeholder) ---- */
                        <button
                            className={headerCtaBtnClass}
                            style={heroBtnInlineStyle}
                        >
                            {localizedHeaderBtnName}
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    const heroMinHeight = resolveHeroMinHeight(settings, siteConfig);
    const isFullViewportHero = isFullViewportHeightMode(
        settings.heroHeightMode,
        settings.minHeight
    );
    const layoutSplitViewportStyle: CSSProperties = isMobileViewport && isMainHero && !isFullViewportHero
        ? { minHeight: MOBILE_MAIN_HERO_HEIGHT, height: 'auto', boxSizing: 'border-box' }
        : isFullViewportHero
            ? { minHeight: heroMinHeight, height: heroMinHeight, boxSizing: 'border-box' }
            : settings.heroHeightMode === 'custom'
                ? { minHeight: heroMinHeight, boxSizing: 'border-box' }
                : { minHeight: heroMinHeight, boxSizing: 'border-box' };
    const heroSpacingSettings = withDefaultHeroSectionSpacing(settings);
    const hasSpacing = hasCustomSectionSpacing(heroSpacingSettings);
    const heroViewportStyle: CSSProperties = isLayoutSplit
        ? layoutSplitViewportStyle
        : isMobileViewport
            ? isMainHero
                ? { minHeight: MOBILE_MAIN_HERO_HEIGHT, height: 'auto', boxSizing: 'border-box' }
                : { minHeight: 'auto', height: 'auto', boxSizing: 'border-box' }
            : isFullViewportHero
                ? { minHeight: heroMinHeight, height: heroMinHeight, boxSizing: 'border-box' }
                : settings.heroHeightMode === 'custom'
                    ? { minHeight: heroMinHeight, boxSizing: 'border-box' }
                    : (settings.bgType === 'none' || hasSpacing)
                        ? { minHeight: 'auto' }
                        : { minHeight: heroMinHeight };
    const heroSectionClass = `ws-hero-section${isMainHero ? ' ws-hero-main' : ''}${isFullViewportHero ? ' ws-hero-full-viewport' : ''}${isLayoutSplit ? ' ws-layout-split-height-configured' : ''}${sectionSpacingClassName(heroSpacingSettings) ? ` ${sectionSpacingClassName(heroSpacingSettings)}` : ''}`;
    const heroSectionSpacingStyle = resolveSectionSpacingPadding(heroSpacingSettings);

    // New "Layout Design Section" support (Split Screen) — Image & Text (design 3.1)
    if (settings.bgType === 'layout') {
        const isImgLeft = settings.layoutVariant === 'img_left';
        const layoutImageRadiusStyle = resolveSliderImageRadiusStyle(parseSliderImageSettings(settings.imageSettings));

        return (
            <div
                className={`w-full flex justify-center ${heroSectionClass}`}
                style={{ ...heroViewportStyle, ...heroSectionSpacingStyle }}
            >
                <div
                    className={`w-full ws-page-width ws-layout-split ${isImgLeft ? 'ws-layout-split-img-left' : 'ws-layout-split-img-right'} items-stretch ${heroSectionClass}`}
                    style={heroViewportStyle}
                >
                    {/* Image Side */}
                    <div
                        className="relative min-h-[16rem] ws-layout-split-half ws-layout-split-media self-stretch overflow-hidden"
                        style={layoutImageRadiusStyle}
                    >
                        {settings.bgImage ? (
                            <div
                                className="absolute inset-0 bg-cover bg-center min-h-[16rem] md:min-h-full"
                                style={{ backgroundImage: `url("${settings.bgImage}")` }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-100 min-h-[16rem] md:min-h-full">
                                <span className="text-sm font-bold uppercase tracking-widest">No Image Selected</span>
                            </div>
                        )}
                    </div>
                    {/* Text Side */}
                    <div
                        className="ws-layout-split-half ws-layout-split-text flex items-start justify-center h-auto"
                        style={{ backgroundColor: settings.bgColor || '#ffffff' }}
                    >
                        <div className={textAlign}>
                            <ContentBlock />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Standard Styles
    const resolveHeroBackgroundColor = (): string => {
        if (settings.bgType !== 'color') {
            if (settings.bgType === 'none') {
                return isPageContent ? '#ffffff' : 'transparent';
            }
            return themeConfig['--bg-body'];
        }
        if (!isColorHeaderBanner) {
            return settings.bgColor;
        }
        const raw = String(settings.bgColor || '').trim().toLowerCase();
        if (!raw || raw === '#ffffff' || raw === '#fff' || raw === '#157a44') {
            return COLOR_HEADER_PREVIEW_BG;
        }
        return settings.bgColor;
    };

    const bgStyle: React.CSSProperties = {
        backgroundColor: resolveHeroBackgroundColor(),
        backgroundImage: settings.bgType === 'image' && settings.bgImage ? `url("${settings.bgImage}")` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        ...heroViewportStyle,
        ...heroSectionSpacingStyle,
    };
    const heroOverlayBackground = resolveHeroOverlayBackground(settings);

    return (
        <div className={`w-full relative flex flex-col justify-center ${heroSectionClass} ${textAlign}`} style={bgStyle}>
            {heroOverlayBackground && (
                <div className="absolute inset-0 z-0" style={{ backgroundColor: heroOverlayBackground }} />
            )}
            <ContentBlock />
        </div>
    );
};

// --- RENDERER 2: SLIDER ---
const SliderRenderer = ({ container, lang, onInternalLink }: ComponentRendererProps) => {
    const tmplId = container.settings.templateId;
    const [current, setCurrent] = useState(0);
    const [tabWindowStart, setTabWindowStart] = useState(0);
    const [editingSlide, setEditingSlide] = useState<any | null>(null);
    const [activeReadMoreSlide, setActiveReadMoreSlide] = useState<{ item: any, index: number } | null>(null);
    const [expandedSlideReadMoreById, setExpandedSlideReadMoreById] = useState<Record<string, boolean>>({});
    const { sliderItems, updateSliderItem, deleteSliderItem, viewMode, translationItems, currentLanguage, updateContainer, currentPageId, themeConfig, siteConfig } = useStore();

    // Draggable / swipeable states
    const [startX, setStartX] = useState(0);
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const hasMoved = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleClickCapture = (e: React.MouseEvent) => {
        if (hasMoved.current) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    const { settings: sliderSettings } = container;
    const sliderReadMoreEnabled = !!sliderSettings.enableCardReadMore;
    const sliderReadMoreBehavior = sliderSettings.readMoreBehavior === 'expand' ? 'expand' : 'popup';
    const sliderReadMoreDisplayType = sliderSettings.readMoreDisplayType === 'button' ? 'button' : 'link';
    const sliderReadMoreButtonSize = sliderSettings.readMoreButtonSize === 'lg' ? 'lg' : sliderSettings.readMoreButtonSize === 'sm' ? 'sm' : 'md';
    const sliderReadMoreAlignment = sliderSettings.readMoreAlignment === 'center' || sliderSettings.readMoreAlignment === 'right'
        ? sliderSettings.readMoreAlignment
        : 'left';
    const sliderReadMoreAlignClass = sliderReadMoreAlignment === 'center'
        ? 'self-center mx-auto'
        : sliderReadMoreAlignment === 'right'
            ? 'self-end ml-auto'
            : 'self-start';
    const sliderReadMoreSizeClass = sliderReadMoreButtonSize === 'lg' ? 'text-base' : sliderReadMoreButtonSize === 'sm' ? 'text-xs' : 'text-sm';
    const sliderReadMoreIconClass = sliderReadMoreButtonSize === 'lg' ? 'w-5 h-5' : sliderReadMoreButtonSize === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    const SLIDE_DESC_TRUNCATE_LEN = 200;
    const GALLERY_DESC_CLAMP_LINES = 7;
    const slideDescRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [slideDescOverflowById, setSlideDescOverflowById] = useState<Record<string, boolean>>({});

    const taggedIds = container.settings.taggedItems || [];
    const isImageTextSlider = tmplId !== 'img_gallery' && container.settings?.templateVariant !== 1;
    const taggedSliderItems = isImageTextSlider
        ? buildImageTextSliderDisplayItems(container.settings, sliderItems)
        : taggedIds
            .map((id: any) => sliderItems.find(item => String(item.id) === String(id)))
            .filter(Boolean) as any[];

    const sortedTaggedSliderItems = useMemo(
        () => isImageTextSlider
            ? taggedSliderItems
            : sortTaggedSliderItems(taggedSliderItems, taggedIds, sliderSettings, lang),
        [isImageTextSlider, taggedSliderItems, taggedIds, sliderSettings.sortField, sliderSettings.sortDirection, lang]
    );

    // Shared mapper: build a normalized slide object from a tagged item + any container-level metadata
    const sanitizeImageUrl = (value: any): string => {
        if (typeof value !== 'string') return '';
        const normalized = value.trim();
        if (!normalized || normalized === '[object Object]') return '';
        return normalized;
    };

    const mapTaggedItemToSlide = (item: any) => {
        const containerSlide = (container.settings.slides || []).find((s: any) => String(s.id) === String(item.id)) || {};
        const effectiveDesign = resolveEffectiveSlideDesign(containerSlide, container.settings, {
            preferTemplateDefaults: Boolean(container.settings?.sectionTemplateId),
        });
        let layout = effectiveDesign.layout;
        const rawSub = getItemTranslation(item, lang, 'subtitle') || item.subtitle || '';
        if (!layout && isSliderLayoutToken(rawSub)) {
            layout = rawSub.trim();
        }
        if (!layout) layout = 'text_overlay';
        const displaySub = sanitizeSliderSubtitleForDisplay(rawSub);

        return {
            id: item.id,
            title: getItemTranslation(item, lang, 'title') || item.title || '',
            sub: displaySub,
            subtitle: displaySub,
            desc: getItemTranslation(item, lang, 'description') || item.description || '',
            cta: getItemTranslation(item, lang, 'ctaText') || item.ctaText || '',
            url: item.ctaUrl || containerSlide.url || '',
            img: sanitizeImageUrl(item.imageUrl) || sanitizeImageUrl(containerSlide.image) || sanitizeImageUrl(containerSlide.img) || '',
            image: sanitizeImageUrl(item.imageUrl) || sanitizeImageUrl(containerSlide.image) || sanitizeImageUrl(containerSlide.img) || '',
            layout: layout,
            imageHeightMode: effectiveDesign.imageHeightMode,
            imageCustomHeight: effectiveDesign.imageCustomHeight,
            adjustments: effectiveDesign.adjustments,
            imageSettings: parseSliderImageSettings(container.settings.imageSettings ?? item.imageSettings),
            originalItem: item
        };
    };

    // Both slider types (img_text and img_gallery) are driven by tagged items.
    // For img_gallery, layout metadata is less relevant but the same structure is used.
    const dynamicSlides = sortedTaggedSliderItems.length > 0
        ? sortedTaggedSliderItems.map(mapTaggedItemToSlide)
        : (container.settings.slides || []).map((s: any) => ({
            ...s,
            layout: s.layout || 'text_overlay',
            adjustments: s.adjustments || { zoom: 1, rotate: 0, brightness: 100, contrast: 100 }
        }));

    const sliderTaggedOrderChangeContext = useMemo((): TaggedOrderChangeContext | undefined => {
        const containerSlides: any[] = container.settings.slides || [];
        const containerTagged: string[] = (container.settings.taggedItems || []).map((id: any) => String(id));

        let orderedIds: string[] = [];
        if (containerTagged.length > 0) {
            orderedIds = containerTagged;
        } else if (containerSlides.length > 0) {
            orderedIds = containerSlides.map((slide: any) => String(slide.id));
        } else if (dynamicSlides.length > 0) {
            orderedIds = dynamicSlides.map((slide: any) => String(slide.id));
        } else {
            return undefined;
        }

        if (orderedIds.length < 2) return undefined;

        const items = orderedIds.map((id) => {
            const spItem = sliderItems.find((entry) => String(entry.id) === String(id));
            const slideMeta = containerSlides.find((slide: any) => String(slide.id) === String(id));
            const dynamicSlide = dynamicSlides.find((slide: any) => String(slide.id) === String(id));
            const title =
                (spItem ? getItemTranslation(spItem, currentLanguage, 'title') : '') ||
                dynamicSlide?.title ||
                slideMeta?.title ||
                id;
            return {
                id: String(id),
                title,
                imageUrl: spItem?.imageUrl || dynamicSlide?.img || dynamicSlide?.image || slideMeta?.image || slideMeta?.img,
                status: spItem?.status,
            };
        });

        return {
            taggedIds: orderedIds,
            items,
            onApply: async (result) => {
                const pageId = container.pageId || currentPageId;
                if (!pageId) return;
                const slides = container.settings.slides || [];
                const orderIndex = new Map(result.orderedIds.map((id, i) => [String(id), i]));
                const newSlides = slides.length
                    ? [...slides].sort((a: any, b: any) => {
                        const ai = orderIndex.get(String(a.id)) ?? 9999;
                        const bi = orderIndex.get(String(b.id)) ?? 9999;
                        return ai - bi;
                    })
                    : slides;
                updateContainer(pageId, {
                    ...container,
                    settings: {
                        ...container.settings,
                        taggedItems: result.orderedIds,
                        slides: newSlides,
                    },
                });
            },
        };
    }, [
        container.settings.taggedItems,
        container.settings.slides,
        dynamicSlides,
        container,
        currentLanguage,
        currentPageId,
        sliderItems,
        updateContainer,
    ]);

    const sectionHeaderAlignClass = container.settings.align === 'center' ? 'text-center' : (container.settings.align === 'right' ? 'text-right' : 'text-left');

    const borderClass = container.settings.border === 'rounded' ? 'rounded-xl' : 'rounded-none';

    // Alignment settings for slide content — uses contentAlign if set, falls back to align for backward compatibility
    const slideTextAlign = container.settings.contentAlign || container.settings.align || 'left';
    const slideTextAlignClass = slideTextAlign === 'center' ? 'text-center' : (slideTextAlign === 'right' ? 'text-right' : 'text-left');
    const slideItemsAlignClass = slideTextAlign === 'center' ? 'items-center' : (slideTextAlign === 'right' ? 'items-end' : 'items-start');

    const isGalleryCarousel = tmplId === 'img_gallery' || container.settings?.templateVariant === 1;

    const goToGallerySlide = useCallback((targetIndex: number, source: 'tab' | 'navigate') => {
        const total = dynamicSlides.length;
        if (total === 0) return;
        const clampedIndex = Math.max(0, Math.min(targetIndex, total - 1));

        if (isGalleryCarousel) {
            setTabWindowStart((prevStart) =>
                resolveGalleryTabWindowStart(
                    clampedIndex,
                    prevStart,
                    total,
                    SLIDER_CONCEPT_VISIBLE_TAB_SLOTS,
                    source
                )
            );
        }

        setCurrent(clampedIndex);
    }, [dynamicSlides.length, isGalleryCarousel]);

    // Ensure current index is valid
    useEffect(() => {
        if (current >= dynamicSlides.length) {
            setCurrent(0);
            setTabWindowStart(0);
        }
    }, [dynamicSlides.length, current]);

    const handleDragStart = (clientX: number) => {
        setIsDragging(true);
        setStartX(clientX);
        setDragOffset(0);
        hasMoved.current = false;
    };

    const handleDragMove = (clientX: number) => {
        if (!isDragging) return;
        const offset = clientX - startX;
        const isPastLeft = current === 0 && offset > 0;
        const isPastRight = current === dynamicSlides.length - 1 && offset < 0;
        if (isPastLeft || isPastRight) {
            setDragOffset(offset * 0.3); // rubber-band effect
        } else {
            setDragOffset(offset);
        }
        if (Math.abs(offset) > 10) {
            hasMoved.current = true;
        }
    };

    const handleDragEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);
        const threshold = 80;
        if (dragOffset < -threshold && current < dynamicSlides.length - 1) {
            goToGallerySlide(current + 1, 'navigate');
        } else if (dragOffset > threshold && current > 0) {
            goToGallerySlide(current - 1, 'navigate');
        }
        setDragOffset(0);
    };

    const useSliderCrossfade = isGalleryCarousel || tmplId === 'img_text';
    const sliderCrossfadeMs = 700;

    const measureGallerySlideDescOverflow = useCallback(() => {
        if (!isGalleryCarousel) return;
        const next: Record<string, boolean> = {};
        dynamicSlides.forEach((slide: any, idx: number) => {
            const slideId = String(slide?.id ?? idx);
            const el = slideDescRefs.current[slideId];
            if (!el) {
                next[slideId] = false;
                return;
            }
            next[slideId] = (el.scrollHeight - el.clientHeight) > 1 || (el.scrollWidth - el.clientWidth) > 1;
        });
        setSlideDescOverflowById((prev) => {
            const nextKeys = Object.keys(next);
            if (nextKeys.length === Object.keys(prev).length && nextKeys.every((k) => prev[k] === next[k])) {
                return prev;
            }
            return next;
        });
    }, [dynamicSlides, isGalleryCarousel]);

    useLayoutEffect(() => {
        if (!isGalleryCarousel) return;
        measureGallerySlideDescOverflow();
    }, [measureGallerySlideDescOverflow, current, lang, isGalleryCarousel]);

    useEffect(() => {
        if (!isGalleryCarousel || typeof ResizeObserver === 'undefined') return;
        let rafId = 0;
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => measureGallerySlideDescOverflow());
        });
        Object.values(slideDescRefs.current).forEach((el) => {
            if (el) observer.observe(el);
        });
        return () => {
            cancelAnimationFrame(rafId);
            observer.disconnect();
        };
    }, [measureGallerySlideDescOverflow, dynamicSlides.length, current, isGalleryCarousel]);

    const getSliderSlideOpacity = useCallback((slideIndex: number) => {
        if (!useSliderCrossfade) {
            return 1;
        }
        if (!isDragging || dragOffset === 0) {
            return slideIndex === current ? 1 : 0;
        }
        const progress = Math.min(Math.abs(dragOffset) / 280, 1);
        if (slideIndex === current) {
            return 1 - progress * 0.35;
        }
        if (dragOffset < 0 && slideIndex === current + 1) {
            return progress * 0.65;
        }
        if (dragOffset > 0 && slideIndex === current - 1) {
            return progress * 0.65;
        }
        return 0;
    }, [useSliderCrossfade, isDragging, dragOffset, current]);

    const activeSlide = dynamicSlides[current] || dynamicSlides[0];
    const slideImageRadiusStyle = resolveSliderImageRadiusStyle(activeSlide?.imageSettings);
    const slideViewportHeight = resolveSlideImageHeight(activeSlide, container.settings, siteConfig);
    const sliderTitle = getLocalizedText(container.content.title, lang);
    const showSliderHeader = container.settings.showHeader !== false;
    const showSliderSubheading = container.settings.showSubheading !== false;
    const showSliderDescription = container.settings.showDescription !== false;
    const sliderSubheading = sanitizeSliderSubtitleForDisplay(
        getLocalizedText(container.content?.subtitle, lang)
        || getLocalizedText(container.settings.subheading, lang)
        || ''
    );
    const sliderDescription = getLocalizedText(container.content?.description, lang)
        || (container.settings.description ? getLocalizedText(container.settings.description, lang) : '');

    const next = () => {
        if (current < dynamicSlides.length - 1) {
            goToGallerySlide(current + 1, 'navigate');
        }
    };
    const prev = () => {
        if (current > 0) {
            goToGallerySlide(current - 1, 'navigate');
        }
    };

    const shouldShowGallerySlideReadMore = (slide: any, slideIndex: number) => {
        if (!sliderReadMoreEnabled) return false;
        const slideId = String(slide?.id ?? slideIndex);
        if (sliderReadMoreBehavior === 'expand' && expandedSlideReadMoreById[slideId]) return true;
        return !!slideDescOverflowById[slideId];
    };

    const renderSlideReadMoreControl = (slide: any, slideIndex: number, descHtml: string) => {
        const plainLen = stripHtml(descHtml).length;
        const showReadMore = isGalleryCarousel
            ? shouldShowGallerySlideReadMore(slide, slideIndex)
            : (sliderReadMoreEnabled && plainLen > SLIDE_DESC_TRUNCATE_LEN);
        if (!showReadMore) return null;

        const slideId = String(slide?.id ?? slideIndex);
        const isExpanded = !!expandedSlideReadMoreById[slideId];
        const readMoreLabelKey = (sliderReadMoreBehavior === 'expand' && isExpanded) ? 'BTN_READ_LESS' : 'BTN_READ_MORE';
        const readMoreLabel = getGlobalTranslation(
            readMoreLabelKey,
            translationItems,
            lang,
            getTranslation(readMoreLabelKey, lang)
        );
        const linkClasses = `ws-slider-read-more text-[var(--primary-color)] font-normal ${sliderReadMoreSizeClass} flex items-center gap-1 hover:underline mt-2 ${sliderReadMoreAlignClass} group/read`;
        const buttonClasses = `ws-slider-read-more btn-primary inline-flex items-center justify-center gap-1.5 mt-2 ${sliderReadMoreAlignClass} transition-all active:scale-[0.98] uppercase tracking-wider ${sliderReadMoreSizeClass}`;

        return (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    if (sliderReadMoreBehavior === 'expand') {
                        setExpandedSlideReadMoreById((prev) => ({ ...prev, [slideId]: !prev[slideId] }));
                        return;
                    }
                    setActiveReadMoreSlide({ item: slide, index: slideIndex });
                }}
                className={sliderReadMoreDisplayType === 'button' ? buttonClasses : linkClasses}
            >
                <span>{readMoreLabel}</span>
                {sliderReadMoreDisplayType === 'link' && (
                    <ChevronRight
                        className={`${sliderReadMoreIconClass} flex-shrink-0 transition-transform group-hover/read:translate-x-1`}
                        style={{ color: 'var(--link-color)' }}
                        strokeWidth={2.5}
                    />
                )}
            </button>
        );
    };

    const getSlideDescriptionDisplayHtml = (slide: any, slideIndex: number, descHtml: string) => {
        const plainLen = stripHtml(descHtml).length;
        if (isGalleryCarousel) {
            const slideId = String(slide?.id ?? slideIndex);
            if (sliderReadMoreBehavior === 'expand' && expandedSlideReadMoreById[slideId]) return descHtml;
            return descHtml;
        }
        if (!sliderReadMoreEnabled || plainLen <= SLIDE_DESC_TRUNCATE_LEN) return descHtml;
        const slideId = String(slide?.id ?? slideIndex);
        if (sliderReadMoreBehavior === 'expand' && expandedSlideReadMoreById[slideId]) return descHtml;
        return stripHtml(descHtml).substring(0, SLIDE_DESC_TRUNCATE_LEN).trim() + '...';
    };

    // Autoplay interval slower and premium: add 3 seconds to the delay (5s -> 8s)
    useEffect(() => {
        if (container.settings.autoplay && dynamicSlides.length > 1) {
            const autoplayDelay = ((container.settings.speed || 5) + 3) * 1000;
            const interval = setInterval(() => {
                setCurrent((prev) => {
                    const nextIdx = (prev + 1) % dynamicSlides.length;
                    if (isGalleryCarousel) {
                        setTabWindowStart((prevStart) =>
                            resolveGalleryTabWindowStart(
                                nextIdx,
                                prevStart,
                                dynamicSlides.length,
                                SLIDER_CONCEPT_VISIBLE_TAB_SLOTS,
                                'navigate'
                            )
                        );
                    }
                    return nextIdx;
                });
            }, autoplayDelay);
            return () => clearInterval(interval);
        }
    }, [container.settings.autoplay, container.settings.speed, dynamicSlides.length, isGalleryCarousel]);

    const sliderId = `slider-container-${container.id}`;
    const effectiveSliderLetterCase = getEffectiveHeroLetterCase(container.settings);
    const headerCaseClass = normalizeLetterCaseValue(effectiveSliderLetterCase);
    const displaySliderTitle = applyLetterCaseToPlainText(sliderTitle, effectiveSliderLetterCase);
    const displaySliderTitleOrFallback = displaySliderTitle
        || applyLetterCaseToPlainText('Image Gallery Carousel', effectiveSliderLetterCase);

    // Resolve specific typography colors for Slider
    const slideTitleColor = resolveColor(container.settings.titleColor, container.settings.titleCustomColor, 'var(--heading-h1-color)', '--heading-h1-color');
    const slideSubtitleColor = resolveColor(container.settings.subtitleColor || container.settings.titleColor, container.settings.subtitleCustomColor || container.settings.titleCustomColor, 'var(--heading-h2-color)', '--heading-h2-color');
    const slideDescColor = resolveColor(container.settings.descColor || container.settings.titleColor, container.settings.descCustomColor || container.settings.titleCustomColor, 'var(--text-primary)', '--text-primary');

    const heroTypoCssRules = (typo: ResolvedHeroTypography): string => {
        const rules: string[] = [];
        if (typo.fontSize) rules.push(`font-size: ${typo.fontSize} !important;`);
        if (typo.fontWeight != null && typo.fontWeight !== '') rules.push(`font-weight: ${typo.fontWeight} !important;`);
        if (typo.lineHeight) rules.push(`line-height: ${typo.lineHeight} !important;`);
        return rules.join(' ');
    };
    const slideTitleTypo = resolveHeroTypography(container.settings, 'title', themeConfig);
    const slideSubtitleTypo = resolveHeroTypography(container.settings, 'subtitle', themeConfig);
    const slideDescTypo = resolveHeroTypography(container.settings, 'description', themeConfig);
    const sliderHeadingLetterCss = resolveLetterCaseCss(effectiveSliderLetterCase);
    const cardItemTitleStyle = getCardItemTitleStyle(container.settings, themeConfig);
    const cardItemDescStyle = getCardItemDescStyle(container.settings, themeConfig);
    const cardTitleTypo = resolveHeroTypography(container.settings, 'cardTitle', themeConfig);
    const cardDescTypo = resolveHeroTypography(container.settings, 'cardDesc', themeConfig);
    const cardTitleColor = resolveColor(container.settings.cardTitleColor, container.settings.cardTitleCustomColor, undefined);
    const cardDescColorStyle = resolveCardDescColorStyle(container.settings);
    const cardTitleLetterCss = resolveLetterCaseCss(container.settings?.cardLetterCase ?? 'uppercase');
    const cardTitleCustomCss = buildCardTitleCustomCss(
        `#${sliderId}`,
        cardItemTitleStyle
    );

    const customTypographyCSS = `
        ${buildSliderConceptBaseCss(sliderId, isGalleryCarousel)}
        #${sliderId} .slider-container-title {
            ${heroTypoCssRules(slideTitleTypo)}
            ${slideTitleColor.style?.color ? `color: ${slideTitleColor.style.color} !important;` : ''}
            ${sliderHeadingLetterCss !== 'none' ? `text-transform: ${sliderHeadingLetterCss} !important;` : 'text-transform: none !important;'}
        }
        #${sliderId} .slider-container-subtitle {
            ${heroTypoCssRules(slideSubtitleTypo)}
            ${slideSubtitleColor.style?.color ? `color: ${slideSubtitleColor.style.color} !important;` : ''}
        }
        #${sliderId} .slider-container-desc, #${sliderId} .slider-container-desc * {
            ${heroTypoCssRules(slideDescTypo)}
            ${slideDescColor.style?.color ? `color: ${slideDescColor.style.color} !important;` : ''}
        }
        #${sliderId} .slider-slide-title {
            ${heroTypoCssRules(cardTitleTypo)}
            ${cardTitleColor.style?.color ? `color: ${cardTitleColor.style.color} !important;` : ''}
            ${cardTitleLetterCss !== 'none' ? `text-transform: ${cardTitleLetterCss} !important;` : ''}
        }
        ${cardTitleCustomCss}
        #${sliderId} .slider-slide-desc, #${sliderId} .slider-slide-desc * {
            ${heroTypoCssRules(cardDescTypo)}
            ${cardDescColorStyle.color ? `color: ${cardDescColorStyle.color} !important;` : ''}
        }
        /* Slider Dragging Support */
        .cursor-grab { cursor: grab !important; }
        .cursor-grabbing { cursor: grabbing !important; }
        .scrollbar-none::-webkit-scrollbar { display: none !important; }
        .scrollbar-none { -ms-overflow-style: none !important; scrollbar-width: none !important; }
        @keyframes wsSliderFadeInUp {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;

    if (!activeSlide) {
        return (
            <div
                id={sliderId}
                className={`w-full bg-transparent relative flex items-center justify-center min-h-[400px] ${sectionSpacingClassName(container.settings)}`}
                style={resolveSectionSpacingPadding(container.settings, { top: '4rem', bottom: '4rem' })}
            >
                {customTypographyCSS.trim() ? <style>{customTypographyCSS}</style> : null}
                <div className="w-full ws-page-width text-center space-y-4">
                    {showSliderHeader && (
                        <h2 className={`text-4xl font-bold text-gray-800 slider-container-title ${headerCaseClass} ${slideTitleColor.className || ''}`}>{displaySliderTitleOrFallback}</h2>
                    )}
                    {showSliderSubheading && sliderSubheading && <p className={`text-xl text-gray-500 slider-container-subtitle ${WS_CENTERED_SUBHEADING_CLASS} ${slideSubtitleColor.className || ''}`}>{sliderSubheading}</p>}
                    {showSliderDescription && (
                        <p className={`text-base text-gray-400 max-w-2xl mx-auto slider-container-desc ${slideDescColor.className || ''}`}>
                            {sliderDescription && renderRichText(
                                sliderDescription,
                                `text-sm leading-relaxed max-w-4xl mt-4 ${container.settings.align === 'center' ? 'mx-auto' : ''}`
                            ) || 'Start by adding some dynamic images or content slides to populate your gallery carousel. You can customize the look and behavior in the settings tab.'}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    const renderSlideEditor = () => {
        if (!editingSlide) return null;

        if (isImageTextSlider) {
            return (
                <EditSlideModal
                    slideId={editingSlide.id}
                    allSlides={dynamicSlides}
                    onSave={async (id: string, data: any) => {
                        const existingSlides = container.settings.slides || [];
                        const slideIdx = existingSlides.findIndex((s: any) => s.id === id);
                        let newSlides = [...existingSlides];
                        if (slideIdx >= 0) {
                            newSlides[slideIdx] = { ...newSlides[slideIdx], ...data };
                        } else {
                            newSlides.push({ id, ...data });
                        }
                        updateContainer(container.pageId || currentPageId, { ...container, settings: { ...container.settings, slides: newSlides } });

                        // 2. Sync global SharePoint item if it exists
                        if (editingSlide.originalItem) {
                            const updatedTranslations: any = editingSlide.originalItem.translations ? { ...editingSlide.originalItem.translations } : { [currentLanguage]: {} };
                            if (!updatedTranslations[currentLanguage]) {
                                updatedTranslations[currentLanguage] = {};
                            }
                            updatedTranslations[currentLanguage].title = data.title || '';
                            updatedTranslations[currentLanguage].subtitle = sanitizeSliderSubtitleForDisplay(data.subtitle || '');
                            updatedTranslations[currentLanguage].description = data.desc || '';
                            updatedTranslations[currentLanguage].ctaText = data.buttonText || data.cta || '';

                            const updatedItem = {
                                ...editingSlide.originalItem,
                                title: data.title || '',
                                subtitle: sanitizeSliderSubtitleForDisplay(data.subtitle || ''),
                                description: data.desc || '',
                                imageUrl: data.image || data.img || '',
                                ctaText: data.buttonText || data.cta || '',
                                ctaUrl: data.buttonLink || data.url || '',
                                translations: updatedTranslations
                            };
                            await updateSliderItem(updatedItem);
                        }
                        setEditingSlide(null);
                    }}
                    onClose={() => setEditingSlide(null)}
                    onDelete={async (id: string) => {
                        if (editingSlide.originalItem) {
                            await deleteSliderItem(id);
                        } else {
                            const newSlides = (container.settings.slides || []).filter((s: any) => s.id !== id);
                            updateContainer(container.pageId || currentPageId, { ...container, settings: { ...container.settings, slides: newSlides } });
                        }
                        setEditingSlide(null);
                    }}
                />
            );
        }

        return (
            <SliderItemEditor
                item={editingSlide.originalItem || editingSlide}
                changeOrderContext={sliderTaggedOrderChangeContext}
                onSave={async (updated: any) => {
                    if (editingSlide.originalItem) {
                        await updateSliderItem(updated);

                        // Sync layout/adjustments with container metadata
                        const existingSlides = container.settings.slides || [];
                        const slideIdx = existingSlides.findIndex((s: any) => s.id === updated.id);
                        let newSlides = [...existingSlides];

                        const newlyExtractedObj = {
                            title: updated.title,
                            subtitle: updated.subtitle,
                            layout: updated.layout,
                            adjustments: updated.adjustments,
                            cta: updated.ctaText,
                            url: updated.ctaUrl
                        };

                        if (slideIdx >= 0) {
                            newSlides[slideIdx] = { ...newSlides[slideIdx], ...newlyExtractedObj };
                        } else {
                            newSlides.push({ id: updated.id, ...newlyExtractedObj });
                        }
                        updateContainer(container.pageId || currentPageId, { ...container, settings: { ...container.settings, slides: newSlides } });
                    } else {
                        // Update local slides only
                        const existingSlides = container.settings.slides || [];
                        const slideIdx = existingSlides.findIndex((s: any) => s.id === updated.id);
                        let newSlides = [...existingSlides];
                        if (slideIdx >= 0) {
                            newSlides[slideIdx] = { ...newSlides[slideIdx], ...updated };
                        } else {
                            newSlides.push({ ...updated, id: updated.id });
                        }
                        updateContainer(container.pageId || currentPageId, { ...container, settings: { ...container.settings, slides: newSlides } });
                    }
                    setEditingSlide(null);
                }}
                onCancel={() => setEditingSlide(null)}
                onDelete={async (id: string) => {
                    if (editingSlide.originalItem) {
                        await deleteSliderItem(id);
                    } else {
                        const existingSlides = container.settings.slides || [];
                        const newSlides = existingSlides.filter((s: any) => s.id !== id);
                        updateContainer(container.pageId || currentPageId, { ...container, settings: { ...container.settings, slides: newSlides } });
                    }
                    setEditingSlide(null);
                }}
            />
        );
    };

    // Image Gallery Carousel
    if (isGalleryCarousel) {
        const showTitle = container.settings.showSlideTitle !== false;
        const showDesc = container.settings.showSlideDescription !== false;
        const visibleTabSlides = dynamicSlides.slice(
            tabWindowStart,
            tabWindowStart + SLIDER_CONCEPT_VISIBLE_TAB_SLOTS
        );

        return (
            <>
                <div
                    id={sliderId}
                    ref={containerRef}
                    onMouseDown={(e) => handleDragStart(e.clientX)}
                    onMouseMove={(e) => handleDragMove(e.clientX)}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                    onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
                    onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
                    onTouchEnd={handleDragEnd}
                    onClickCapture={handleClickCapture}
                    className={`ws-gallery-carousel w-full relative flex items-center justify-center bg-transparent select-none cursor-grab active:cursor-grabbing ${sectionSpacingClassName(container.settings)}`}
                    style={resolveSectionSpacingPadding(container.settings, { top: '4rem', bottom: '4rem' })}
                >
                    {customTypographyCSS.trim() ? <style>{customTypographyCSS}</style> : null}
                    <div className="w-full ws-page-width">
                        <div className={`mb-8 ${sectionHeaderAlignClass} w-full`}>
                            {showSliderHeader && sliderTitle && (
                                <h2 className={`${slideTitleColor.className || ''} ${headerCaseClass} font-bold slider-container-title`}>{displaySliderTitle}</h2>
                            )}
                            {showSliderSubheading && sliderSubheading && (
                                <p className={`${slideSubtitleColor.className || ''} slider-container-subtitle ${container.settings.align === 'center' ? WS_CENTERED_SUBHEADING_CLASS : 'w-full'}`}>{sliderSubheading}</p>
                            )}
                            {showSliderDescription && sliderDescription && renderRichText(
                                sliderDescription,
                                `text-sm leading-relaxed max-w-4xl mt-4 ${container.settings.align === 'center' ? 'mx-auto' : ''} ${slideDescColor.className || ''} slider-container-desc`
                            )}
                        </div>

                        {/* Stacked crossfade — fixed min-height viewport so frame never jumps between slides */}
                        <div className="ws-gallery-carousel-viewport w-full relative overflow-hidden bg-transparent">
                            {dynamicSlides.map((slide: any, idx: number) => {
                                const slideSubtitle = sanitizeSliderSubtitleForDisplay(
                                    getLocalizedText(slide.sub || slide.subtitle, lang)
                                );
                                const slideDesc = getLocalizedText(slide.desc, lang);
                                const showSubtitleSeparately = slideSubtitle && slideSubtitle !== slideDesc;
                                const slideImageRadiusStyle = resolveSliderImageRadiusStyle(slide?.imageSettings);
                                const isActiveSlide = idx === current;
                                const slideOpacity = getSliderSlideOpacity(idx);
                                const slideTitleText = getLocalizedText(slide.title, lang);
                                const slideId = String(slide?.id ?? idx);
                                const isDescExpanded = sliderReadMoreBehavior === 'expand' && !!expandedSlideReadMoreById[slideId];
                                const descClampClass = isDescExpanded ? '' : 'desc-clamp-7';

                                return (
                                    <div
                                        key={slide.id ?? idx}
                                        className={`${isActiveSlide ? 'relative' : 'absolute inset-x-0 top-0'} w-full flex flex-col lg:flex-row gap-12 items-stretch lg:items-start bg-transparent`}
                                        style={{
                                            opacity: slideOpacity,
                                            zIndex: isActiveSlide ? 2 : 1,
                                            pointerEvents: isActiveSlide ? 'auto' : 'none',
                                            transition: isDragging ? 'none' : `opacity ${sliderCrossfadeMs}ms ease-in-out`,
                                        }}
                                        aria-hidden={!isActiveSlide}
                                    >
                                        {/* Text side — title top, arrows bottom (concept layout) */}
                                        <div className={`ws-gallery-carousel-text min-w-0 ${slideItemsAlignClass} ${slideTextAlignClass}`}>
                                            {showTitle && (
                                                <div className="flex items-center gap-2 group/slide min-w-0 w-full">
                                                    <h3
                                                        className="slider-slide-title ws-card-title-container ws-slider-slide-title-truncate font-medium"
                                                        style={cardItemTitleStyle}
                                                        title={slideTitleText}
                                                    >
                                                        {slideTitleText}
                                                    </h3>
                                                    {viewMode === ViewMode.EDIT && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingSlide(slide); }}
                                                            className="p-0 border-0 bg-transparent hover:opacity-80 transition-opacity pointer-events-auto flex-shrink-0"
                                                            title={getTranslation('TITLE_EDIT_SLIDE', lang)}
                                                        >
                                                            <Pencil className="w-5 h-5" style={{ color: 'var(--icon-color)' }} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {showDesc && (
                                                <div className={`ws-gallery-carousel-text__body flex flex-col ${slideItemsAlignClass} ${showTitle ? 'mt-6' : ''}`}>
                                                    {showSubtitleSeparately && renderRichText(
                                                        slideSubtitle,
                                                        `font-medium ${slideTextAlignClass} slider-slide-desc`,
                                                        cardItemDescStyle,
                                                        true
                                                    )}
                                                    {slideDesc && (
                                                        <div className={`flex flex-col w-full min-w-0 ${slideItemsAlignClass}`}>
                                                            {renderRichText(
                                                                getSlideDescriptionDisplayHtml(slide, idx, slideDesc),
                                                                `leading-relaxed ${slideTextAlignClass} slider-slide-desc ${descClampClass}`,
                                                                cardItemDescStyle,
                                                                true,
                                                                (el) => { slideDescRefs.current[slideId] = el; }
                                                            )}
                                                            {renderSlideReadMoreControl(slide, idx, slideDesc)}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {slide.cta && (
                                                <a
                                                    href={slide.url || '#'}
                                                    onClick={(e) => {
                                                        if (hasMoved.current) {
                                                            e.preventDefault();
                                                        } else {
                                                            onInternalLink(e, slide.url || '#');
                                                        }
                                                    }}
                                                    className="btn-primary no-underline text-white px-8 py-3 rounded flex items-center justify-center transition-all hover:opacity-90 pointer-events-auto mt-4"
                                                >
                                                    {getLocalizedText(slide.cta, lang)}
                                                </a>
                                            )}
                                            {dynamicSlides.length > 1 && (
                                                <div className="ws-gallery-carousel-text__controls flex items-center gap-3 pointer-events-auto">
                                                    <button
                                                        type="button"
                                                        onClick={prev}
                                                        disabled={current === 0}
                                                        className={`ws-slider-chevron-btn w-8 h-8 flex items-center justify-center shadow-sm transition-all rounded-sm ${current > 0 ? 'btn-primary' : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-40'}`}
                                                    >
                                                        <ChevronLeft
                                                            className="w-5 h-5 flex-shrink-0"
                                                            style={{ color: current > 0 ? 'white' : 'currentColor' }}
                                                            strokeWidth={2.5}
                                                        />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={next}
                                                        disabled={current === dynamicSlides.length - 1}
                                                        className={`ws-slider-chevron-btn w-8 h-8 flex items-center justify-center shadow-sm transition-all rounded-sm ${current < dynamicSlides.length - 1 ? 'btn-primary' : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-40'}`}
                                                    >
                                                        <ChevronRight
                                                            className="w-5 h-5 flex-shrink-0"
                                                            style={{ color: current < dynamicSlides.length - 1 ? 'white' : 'currentColor' }}
                                                            strokeWidth={2.5}
                                                        />
                                                    </button>
                                                    <span className="ws-slider-slide-counter whitespace-nowrap">
                                                        {current + 1} / {dynamicSlides.length}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {/* Image side — fixed frame (img_gallery only); see .ws-gallery-carousel-media */}
                                        <div
                                            className="ws-gallery-carousel-media"
                                            style={{
                                                overflow: 'hidden',
                                                ...slideImageRadiusStyle,
                                                ...(slide?.imageSettings?.radiusPreset === 'full'
                                                    ? { display: 'flex', justifyContent: 'center', alignItems: 'center' }
                                                    : {}),
                                            }}
                                        >
                                            <img
                                                src={slide.img || slide.image || getGlobalDefaultImage()}
                                                className="ws-gallery-carousel-media__img"
                                                style={slide?.imageSettings?.radiusPreset === 'full'
                                                    ? { height: '100%', width: 'auto', maxWidth: 'none', maxHeight: 'none', aspectRatio: '1 / 1', borderRadius: '50%', objectFit: 'cover' }
                                                    : undefined}
                                                alt=""
                                                draggable={false}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Slide nav tabs — aligned under image column on desktop */}
                        {dynamicSlides.length > 1 && (
                            <div className="ws-slider-nav-tabs ws-gallery-carousel-nav-tabs mt-8 pt-4 pointer-events-auto">
                                {visibleTabSlides.map((slide: any, visibleIdx: number) => {
                                    const idx = tabWindowStart + visibleIdx;
                                    const tabTitle = getLocalizedText(slide.title, lang);
                                    const isFirstVisibleTab = visibleIdx === 0;
                                    const isLastVisibleTab = visibleIdx === visibleTabSlides.length - 1;
                                    const tabAlignClass = isFirstVisibleTab
                                        ? 'ws-slider-nav-tab--first'
                                        : isLastVisibleTab
                                            ? 'ws-slider-nav-tab--last'
                                            : 'ws-slider-nav-tab--middle';
                                    return (
                                        <button
                                            key={slide.id ?? idx}
                                            type="button"
                                            onClick={() => goToGallerySlide(idx, 'tab')}
                                            className={`ws-slider-nav-tab flex items-center gap-2 transition-all duration-300 min-w-0 max-w-full ${tabAlignClass} ${idx === current ? 'ws-slider-nav-tab--active' : 'hover:opacity-80'}`}
                                            title={tabTitle}
                                        >
                                            <span className="ws-slider-nav-tab__index flex-shrink-0 leading-none">
                                                {getOrderedLabel(idx, container.settings.ordering)}
                                            </span>
                                            <span
                                                className="ws-slider-nav-tab__label"
                                                style={cardTitleLetterCss !== 'none' ? { textTransform: cardTitleLetterCss } : undefined}
                                            >
                                                {tabTitle}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
                {renderSlideEditor()}
                {activeReadMoreSlide && (
                    <ReadMoreModal
                        item={activeReadMoreSlide.item}
                        index={activeReadMoreSlide.index}
                        imagePosition="right"
                        source="Slider"
                        onClose={() => setActiveReadMoreSlide(null)}
                    />
                )}
            </>
        );
    }

    return (
        <div
            id={sliderId}
            className={`w-full bg-transparent ${sectionSpacingClassName(container.settings)}`}
            style={resolveSectionSpacingPadding(container.settings)}
        >
            {customTypographyCSS.trim() ? <style>{customTypographyCSS}</style> : null}
            {renderSlideEditor()}

            {/* Section Header */}
            {((showSliderHeader && sliderTitle) || (showSliderSubheading && sliderSubheading) || (showSliderDescription && sliderDescription)) && (
                <div className={`pt-10 pb-4 w-full ${sectionHeaderAlignClass}`}>
                    <div className="ws-page-width">
                        {showSliderHeader && sliderTitle && (
                            <h2 className={`${slideTitleColor.className || ''} ${headerCaseClass} font-bold mb-1 slider-container-title`}>{displaySliderTitle}</h2>
                        )}
                        {showSliderSubheading && sliderSubheading && (
                            <p className={`${slideSubtitleColor.className || ''} slider-container-subtitle ${container.settings.align === 'center' ? WS_CENTERED_SUBHEADING_CLASS : 'w-full'}`}>{sliderSubheading}</p>
                        )}
                        {showSliderDescription && sliderDescription && renderRichText(
                            sliderDescription,
                            `text-sm leading-relaxed max-w-4xl mt-4 ${container.settings.align === 'center' ? 'mx-auto' : ''} ${slideDescColor.className || ''} slider-container-desc`
                        )}
                    </div>
                </div>
            )}

            {/* Full-width Slider with overlay arrows */}
            <div
                ref={containerRef}
                onMouseDown={(e) => handleDragStart(e.clientX)}
                onMouseMove={(e) => handleDragMove(e.clientX)}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
                onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
                onTouchEnd={handleDragEnd}
                onClickCapture={handleClickCapture}
                className={`relative w-full overflow-hidden bg-gray-100 ${borderClass} select-none cursor-grab active:cursor-grabbing`}
                style={{ height: slideViewportHeight, minHeight: '12rem', ...slideImageRadiusStyle }}
            >
                {/* Navigation Arrows — overlay over image */}
                {container.settings.arrows !== false && dynamicSlides.length > 1 && (
                    <div className="ws-slider-nav-arrows">
                        <button
                            onClick={prev}
                            disabled={current === 0}
                            className={`ws-slider-chevron-btn w-8 h-8 flex items-center justify-center shadow-sm transition-all rounded-sm pointer-events-auto group ${current > 0 ? 'btn-primary' : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-40'}`}
                        >
                            <ChevronLeft
                                className="w-5 h-5 flex-shrink-0 transition-transform group-hover:-translate-x-0.5"
                                style={{ color: current > 0 ? 'white' : 'currentColor' }}
                                strokeWidth={2.5}
                            />
                        </button>
                        <button
                            onClick={next}
                            disabled={current === dynamicSlides.length - 1}
                            className={`ws-slider-chevron-btn w-8 h-8 flex items-center justify-center shadow-sm transition-all rounded-sm pointer-events-auto group ${current < dynamicSlides.length - 1 ? 'btn-primary' : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-40'}`}
                        >
                            <ChevronRight
                                className="w-5 h-5 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                                style={{ color: current < dynamicSlides.length - 1 ? 'white' : 'currentColor' }}
                                strokeWidth={2.5}
                            />
                        </button>
                    </div>
                )}

                {/* Sliding track — crossfade for split text/image layouts, horizontal slide otherwise */}
                {useSliderCrossfade ? (
                    <div className="relative w-full h-full">
                        {dynamicSlides.map((slide: any, idx: number) => {
                            const slideImageRadiusStyle = resolveSliderImageRadiusStyle(slide?.imageSettings);
                            const isActiveSlide = idx === current;
                            const slideOpacity = getSliderSlideOpacity(idx);
                            return (
                                <div
                                    key={idx}
                                    className="absolute inset-0 w-full h-full overflow-hidden"
                                    style={{
                                        opacity: slideOpacity,
                                        zIndex: isActiveSlide ? 2 : 1,
                                        pointerEvents: isActiveSlide ? 'auto' : 'none',
                                        transition: isDragging ? 'none' : `opacity ${sliderCrossfadeMs}ms ease-in-out`,
                                    }}
                                    aria-hidden={!isActiveSlide}
                                >
                                    {slide.img || slide.image ? (
                                        <img
                                            src={slide.img || slide.image || getGlobalDefaultImage()}
                                            className={getSliderSplitMediaClassName(slide.layout)}
                                            style={{
                                                filter: slide.adjustments ? `brightness(${slide.adjustments.brightness}%) contrast(${slide.adjustments.contrast}%)` : 'none',
                                                transform: slide.adjustments ? `scale(${slide.adjustments.zoom}) rotate(${slide.adjustments.rotate}deg)` : 'none',
                                                ...slideImageRadiusStyle,
                                            }}
                                            draggable={false}
                                        />
                                    ) : (
                                        <div
                                            className={getSliderSplitPlaceholderClassName(slide.layout)}
                                        />
                                    )}

                                    <div className={`absolute flex flex-col ${slide.layout === 'text_overlay' || !slide.layout ? `inset-0 bg-black/40 text-white` : ''} ${slide.layout === 'solid_color' ? `inset-0 bg-gray-800 z-0 text-white` : ''} ${slide.layout === 'split_left_img' ? `right-0 top-0 bottom-0 ws-slider-split-text-panel bg-white text-gray-800 p-12 ${slideItemsAlignClass} ${slideTextAlignClass} ${slideTextAlign === 'left' ? 'pl-16' : (slideTextAlign === 'right' ? 'pr-16' : 'px-16')}` : ''} ${slide.layout === 'split_right_img' ? `left-0 top-0 bottom-0 ws-slider-split-text-panel bg-white text-gray-800 p-12 ${slideItemsAlignClass} ${slideTextAlignClass} ${slideTextAlign === 'left' ? 'pl-16' : (slideTextAlign === 'right' ? 'pr-16' : 'px-16')}` : ''} ${slide.layout === 'text_overlay' || slide.layout === 'solid_color' || !slide.layout ? '' : `${container.settings.overlayPosition === 'bottom' ? 'justify-end' : 'justify-center'}`}`}>
                                        {slide.layout === 'text_overlay' || slide.layout === 'solid_color' || !slide.layout ? (
                                            <div className={`ws-slider-content ws-page-width mx-auto flex flex-col flex-1 min-h-0 ${container.settings.overlayPosition === 'bottom' ? 'justify-end' : 'justify-center'} ${slideItemsAlignClass} ${slideTextAlignClass}`}>
                                                {container.settings.showSlideTitle !== false && slide.title && (
                                                    <h3 className="font-bold mb-4 slider-container-title">{getLocalizedText(slide.title, lang)}</h3>
                                                )}
                                                {slide.subtitle && sanitizeSliderSubtitleForDisplay(getLocalizedText(slide.subtitle, lang)) && (
                                                    <h4 className="font-medium mb-6 slider-container-subtitle opacity-90">{sanitizeSliderSubtitleForDisplay(getLocalizedText(slide.subtitle, lang))}</h4>
                                                )}
                                                {container.settings.showSlideDescription !== false && slide.desc && !isSliderLayoutToken(stripHtml(slide.desc)) && (() => {
                                                    const slideDescLocalized = getLocalizedText(slide.desc, lang);
                                                    return (
                                                        <div className={`flex flex-col ${slideItemsAlignClass} mb-8 max-w-2xl`}>
                                                            <div
                                                                className="jodit-wysiwyg leading-relaxed slider-container-desc opacity-80"
                                                                dangerouslySetInnerHTML={{ __html: ensureLinksOpenInNewTab(getSlideDescriptionDisplayHtml(slide, idx, slideDescLocalized)) }}
                                                            />
                                                            {renderSlideReadMoreControl(slide, idx, slideDescLocalized)}
                                                        </div>
                                                    );
                                                })()}
                                                {slide.cta && (
                                                    <a
                                                        href={slide.url || '#'}
                                                        onClick={(e) => {
                                                            if (hasMoved.current) {
                                                                e.preventDefault();
                                                            } else {
                                                                onInternalLink(e, slide.url || '#');
                                                            }
                                                        }}
                                                        className="btn-primary transition-all hover:opacity-90 inline-flex items-center justify-center no-underline pointer-events-auto"
                                                    >
                                                        {getLocalizedText(slide.cta, lang)}
                                                    </a>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                {container.settings.showSlideTitle !== false && slide.title && (
                                                    <h3 className="font-bold mb-4 slider-container-title">{getLocalizedText(slide.title, lang)}</h3>
                                                )}
                                                {slide.subtitle && sanitizeSliderSubtitleForDisplay(getLocalizedText(slide.subtitle, lang)) && (
                                                    <h4 className="font-medium mb-6 slider-container-subtitle opacity-90">{sanitizeSliderSubtitleForDisplay(getLocalizedText(slide.subtitle, lang))}</h4>
                                                )}
                                                {container.settings.showSlideDescription !== false && slide.desc && !isSliderLayoutToken(stripHtml(slide.desc)) && (() => {
                                                    const slideDescLocalized = getLocalizedText(slide.desc, lang);
                                                    return (
                                                        <div className={`flex flex-col ${slideItemsAlignClass} mb-8 max-w-2xl`}>
                                                            <div
                                                                className="jodit-wysiwyg leading-relaxed slider-container-desc opacity-80"
                                                                dangerouslySetInnerHTML={{ __html: ensureLinksOpenInNewTab(getSlideDescriptionDisplayHtml(slide, idx, slideDescLocalized)) }}
                                                            />
                                                            {renderSlideReadMoreControl(slide, idx, slideDescLocalized)}
                                                        </div>
                                                    );
                                                })()}
                                                {slide.cta && (
                                                    <a
                                                        href={slide.url || '#'}
                                                        onClick={(e) => {
                                                            if (hasMoved.current) {
                                                                e.preventDefault();
                                                            } else {
                                                                onInternalLink(e, slide.url || '#');
                                                            }
                                                        }}
                                                        className="btn-primary transition-all hover:opacity-90 inline-flex items-center justify-center no-underline pointer-events-auto"
                                                    >
                                                        {getLocalizedText(slide.cta, lang)}
                                                    </a>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div
                        className="w-full h-full flex flex-row"
                        style={{
                            transform: `translate3d(calc(-${current * 100}% + ${dragOffset}px), 0, 0)`,
                            transition: isDragging ? 'none' : 'transform 1200ms cubic-bezier(0.25, 1, 0.3, 1)',
                        }}
                    >
                        {dynamicSlides.map((slide: any, idx: number) => {
                            const slideImageRadiusStyle = resolveSliderImageRadiusStyle(slide?.imageSettings);
                            return (
                                <div key={idx} className="w-full min-w-full h-full relative flex-shrink-0 overflow-hidden">
                                    {/* Image side based on layout */}
                                    {slide.img || slide.image ? (
                                        <img
                                            src={slide.img || slide.image || getGlobalDefaultImage()}
                                            className={getSliderSplitMediaClassName(slide.layout)}
                                            style={{
                                                filter: slide.adjustments ? `brightness(${slide.adjustments.brightness}%) contrast(${slide.adjustments.contrast}%)` : 'none',
                                                transform: slide.adjustments ? `scale(${slide.adjustments.zoom}) rotate(${slide.adjustments.rotate}deg)` : 'none',
                                                ...slideImageRadiusStyle,
                                            }}
                                            draggable={false}
                                        />
                                    ) : (
                                        <div
                                            className={getSliderSplitPlaceholderClassName(slide.layout)}
                                        />
                                    )}

                                    {/* Content overlay — text overlay / split screens */}
                                    <div className={`absolute flex flex-col ${slide.layout === 'text_overlay' || !slide.layout ? `inset-0 bg-black/40 text-white` : ''} ${slide.layout === 'solid_color' ? `inset-0 bg-gray-800 z-0 text-white` : ''} ${slide.layout === 'split_left_img' ? `right-0 top-0 bottom-0 ws-slider-split-text-panel bg-white text-gray-800 p-12 ${slideItemsAlignClass} ${slideTextAlignClass} ${slideTextAlign === 'left' ? 'pl-16' : (slideTextAlign === 'right' ? 'pr-16' : 'px-16')}` : ''} ${slide.layout === 'split_right_img' ? `left-0 top-0 bottom-0 ws-slider-split-text-panel bg-white text-gray-800 p-12 ${slideItemsAlignClass} ${slideTextAlignClass} ${slideTextAlign === 'left' ? 'pl-16' : (slideTextAlign === 'right' ? 'pr-16' : 'px-16')}` : ''} ${slide.layout === 'text_overlay' || slide.layout === 'solid_color' || !slide.layout ? '' : `${container.settings.overlayPosition === 'bottom' ? 'justify-end' : 'justify-center'}`}`}>
                                        {slide.layout === 'text_overlay' || slide.layout === 'solid_color' || !slide.layout ? (
                                            <div className={`ws-slider-content ws-page-width mx-auto flex flex-col flex-1 min-h-0 ${container.settings.overlayPosition === 'bottom' ? 'justify-end' : 'justify-center'} ${slideItemsAlignClass} ${slideTextAlignClass}`}>
                                                {container.settings.showSlideTitle !== false && slide.title && (
                                                    <h3 className="font-bold mb-4 slider-container-title">{getLocalizedText(slide.title, lang)}</h3>
                                                )}
                                                {slide.subtitle && sanitizeSliderSubtitleForDisplay(getLocalizedText(slide.subtitle, lang)) && (
                                                    <h4 className="font-medium mb-6 slider-container-subtitle opacity-90">{sanitizeSliderSubtitleForDisplay(getLocalizedText(slide.subtitle, lang))}</h4>
                                                )}
                                                {container.settings.showSlideDescription !== false && slide.desc && !isSliderLayoutToken(stripHtml(slide.desc)) && (() => {
                                                    const slideDescLocalized = getLocalizedText(slide.desc, lang);
                                                    return (
                                                        <div className={`flex flex-col ${slideItemsAlignClass} mb-8 max-w-2xl`}>
                                                            <div
                                                                className="jodit-wysiwyg leading-relaxed slider-container-desc opacity-80"
                                                                dangerouslySetInnerHTML={{ __html: ensureLinksOpenInNewTab(getSlideDescriptionDisplayHtml(slide, idx, slideDescLocalized)) }}
                                                            />
                                                            {renderSlideReadMoreControl(slide, idx, slideDescLocalized)}
                                                        </div>
                                                    );
                                                })()}
                                                {slide.cta && (
                                                    <a
                                                        href={slide.url || '#'}
                                                        onClick={(e) => {
                                                            if (hasMoved.current) {
                                                                e.preventDefault();
                                                            } else {
                                                                onInternalLink(e, slide.url || '#');
                                                            }
                                                        }}
                                                        className="btn-primary transition-all hover:opacity-90 inline-flex items-center justify-center no-underline pointer-events-auto"
                                                    >
                                                        {getLocalizedText(slide.cta, lang)}
                                                    </a>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                {container.settings.showSlideTitle !== false && slide.title && (
                                                    <h3 className="font-bold mb-4 slider-container-title">{getLocalizedText(slide.title, lang)}</h3>
                                                )}
                                                {slide.subtitle && sanitizeSliderSubtitleForDisplay(getLocalizedText(slide.subtitle, lang)) && (
                                                    <h4 className="font-medium mb-6 slider-container-subtitle opacity-90">{sanitizeSliderSubtitleForDisplay(getLocalizedText(slide.subtitle, lang))}</h4>
                                                )}
                                                {container.settings.showSlideDescription !== false && slide.desc && !isSliderLayoutToken(stripHtml(slide.desc)) && (() => {
                                                    const slideDescLocalized = getLocalizedText(slide.desc, lang);
                                                    return (
                                                        <div className={`flex flex-col ${slideItemsAlignClass} mb-8 max-w-2xl`}>
                                                            <div
                                                                className="jodit-wysiwyg leading-relaxed slider-container-desc opacity-80"
                                                                dangerouslySetInnerHTML={{ __html: ensureLinksOpenInNewTab(getSlideDescriptionDisplayHtml(slide, idx, slideDescLocalized)) }}
                                                            />
                                                            {renderSlideReadMoreControl(slide, idx, slideDescLocalized)}
                                                        </div>
                                                    );
                                                })()}
                                                {slide.cta && (
                                                    <a
                                                        href={slide.url || '#'}
                                                        onClick={(e) => {
                                                            if (hasMoved.current) {
                                                                e.preventDefault();
                                                            } else {
                                                                onInternalLink(e, slide.url || '#');
                                                            }
                                                        }}
                                                        className="btn-primary transition-all hover:opacity-90 inline-flex items-center justify-center no-underline pointer-events-auto"
                                                    >
                                                        {getLocalizedText(slide.cta, lang)}
                                                    </a>
                                                )}
                                            </>
                                        )}

                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Dots navigation */}
                {dynamicSlides.length > 1 && (
                    <div className="absolute bottom-5 inset-x-0 flex justify-center items-center gap-2 z-10 pointer-events-auto">
                        {dynamicSlides.map((slideItem: any, i: number) => {
                            const slideLayout = slideItem.layout || 'text_overlay';
                            const isSplitImgText = tmplId === 'img_text' && (slideLayout === 'split_left_img' || slideLayout === 'split_right_img');
                            const isActive = i === current;
                            const dotBg = isActive
                                ? (isSplitImgText ? 'var(--primary-color)' : '#ffffff')
                                : (isSplitImgText ? '#d1d5db' : 'rgba(255, 255, 255, 0.5)');
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    aria-label={`Go to slide ${i + 1}`}
                                    onClick={() => setCurrent(i)}
                                    className={`ws-slider-dot transition-all ${isActive ? 'ws-slider-dot-active' : ''}`}
                                    style={{ backgroundColor: dotBg }}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {activeReadMoreSlide && (
                <ReadMoreModal
                    item={activeReadMoreSlide.item}
                    index={activeReadMoreSlide.index}
                    imagePosition={
                        activeReadMoreSlide.item.layout === 'split_left_img' ? 'left' :
                            activeReadMoreSlide.item.layout === 'split_right_img' ? 'right' :
                                activeReadMoreSlide.item.layout === 'solid_color' ? 'none' : 'top'
                    }
                    onClose={() => setActiveReadMoreSlide(null)}
                />
            )}
        </div>
    );
};


const resolveCardImageSrc = (item: any) => {
    const url = item?.img || item?.imageUrl || '';
    if (!url) return '';
    const token = item?.originalItem?.imageCacheToken || item?.originalItem?.modifiedDate || item?.id;
    return withImageCacheBust(url, token);
};

// --- RENDERER 3: DATA GRID ---
const DataGridRenderer = ({ container, lang, onInternalLink, onNavigateToSection, onOpenDetailsPanel }: ComponentRendererProps) => {
    const isMobileViewport = useMobileViewport();
    const { settings } = container;
    const dataGridSource = normalizeDataGridSource(settings.source) || settings.source || '';
    const { context } = useSPContext();
    const siteUrl = context.pageContext.web.absoluteUrl;
    const {
        news, events, documents, pages, containerItems, contacts, sliderItems,
        updateNews, updateEvent, updateDocument, updateContainerItem, updateContact, updatePage, updateSliderItem,
        updateContainer,
        currentPageId,
        deleteNews, deleteEvent, deleteDocument, deleteContainerItem, deleteContact, deletePage,
        setCurrentPage,
        viewMode,
        browseFlatViewByContainer,
        setBrowseFlatView,
        translationItems,
        themeConfig
    } = useStore();
    const cardItemTitleStyle = getCardItemTitleStyle(settings, themeConfig);
    const cardItemDescStyle = getCardItemDescStyle(settings, themeConfig);
    const gridContainerAnchor = getContainerAnchor(container);
    const cardTitleCustomCss = buildCardTitleCustomCss(
        `#${gridContainerAnchor}`,
        cardItemTitleStyle
    );
    const titleTypoStyle = heroTypographyToStyle(resolveHeroTypography(settings, 'title', themeConfig), '--font-size-h2');
    const subtitleTypoStyle = heroTypographyToStyle(resolveHeroTypography(settings, 'subtitle', themeConfig), '--font-size-p');
    const descTypoStyle = heroTypographyToStyle(resolveHeroTypography(settings, 'description', themeConfig), '--font-size-p');
    const isSliderLayout = settings.layout === 'slider';
    const isNewsOrEventSourceEarly = settings.source === 'News' || settings.source === 'Event';
    const isBrowseAllModeEarly = Boolean(settings.showAllWithoutTagging && isNewsOrEventSourceEarly);
    const isSlider = isBrowseAllModeEarly ? false : isSliderLayout;
    const cols = settings.columns || 3;
    const scrollContainer = useRef<HTMLDivElement>(null);
    const descRefs = useRef<Record<string, HTMLParagraphElement | null>>({});
    const [activeReadMoreItem, setActiveReadMoreItem] = useState<{ item: any, index: number } | null>(null);
    const [editingItem, setEditingItem] = useState<{ item: any, type: string } | null>(null);
    const [pendingDelete, setPendingDelete] = useState<{ id: string, type: string } | null>(null);
    const [descOverflowById, setDescOverflowById] = useState<Record<string, boolean>>({});
    const [expandedReadMoreById, setExpandedReadMoreById] = useState<Record<string, boolean>>({});
    const [browseSearch, setBrowseSearch] = useState('');
    const [browseYear, setBrowseYear] = useState<'all' | number>('all');
    const flatView = !!browseFlatViewByContainer[container.id];
    const requestDelete = (id: string, type: string) => {
        setPendingDelete({ id, type });
    };

    const handleConfirmDelete = () => {
        if (!pendingDelete) return;
        const { id, type } = pendingDelete;

        if (type === 'News') deleteNews(id);
        else if (type === 'Event') deleteEvent(id);
        else if (type === 'Document') deleteDocument(id);
        else if (type === 'Contact') deleteContact(id);
        else if (type === 'Container Items' || type === 'ContainerItems') deleteContainerItem(id);
        else if (isSmartPagesSource(type)) deletePage(id);

        setPendingDelete(null);
        setEditingItem(null);
    };

    const getDeleteEntityLabel = (type: string) => {
        if (isSmartPagesSource(type)) return 'page';
        if (type === 'Container Items' || type === 'ContainerItems') return 'container item';
        return type.toLowerCase();
    };


    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);
    const isCardReadMoreSource = isItemCardSource(settings.source);
    const isCardReadMoreEnabled = isCardReadMoreSource && !!settings.enableCardReadMore;
    const readMoreBehavior = settings.readMoreBehavior === 'expand' ? 'expand' : 'popup';
    const readMoreDisplayType = settings.readMoreDisplayType === 'button' ? 'button' : 'link';
    const readMoreButtonSize = settings.readMoreButtonSize === 'lg' ? 'lg' : settings.readMoreButtonSize === 'sm' ? 'sm' : 'md';
    const readMoreAlignment = settings.readMoreAlignment === 'center' || settings.readMoreAlignment === 'right'
        ? settings.readMoreAlignment
        : 'left';
    const defaultReadMoreAlign = readMoreAlignment === 'center'
        ? 'self-center mx-auto'
        : readMoreAlignment === 'right'
            ? 'self-end ml-auto'
            : 'self-start';
    const readMoreAlignClass = settings.cardAlign === 'center'
        ? 'self-center mx-auto'
        : settings.cardAlign === 'right'
            ? 'self-end ml-auto mr-0'
            : settings.cardAlign === 'left'
                ? 'self-start mr-auto ml-0'
                : defaultReadMoreAlign;

    const isSmartPageGrid = isSmartPagesSource(settings.source);
    const smartPageOpenInNewTab =
        settings.smartPageOpenInNewTab === true || settings.smartPageOpenInNewTab === 'true';

    const resolveSmartPageSlug = (item: any): string | undefined => {
        const slug = item.originalItem?.slug ?? pages.find((page) => String(page.id) === String(item.id))?.slug;
        return slug || undefined;
    };

    const openSmartPage = (e: React.MouseEvent, pageId: string) => {
        e.stopPropagation();
        navigatePreviewToPage(pageId, pages, setCurrentPage);
    };

    const renderGridCardTitle = (
        item: any,
        options?: {
            className?: string;
            style?: React.CSSProperties;
            documentLinkClassName?: string;
        }
    ) => {
        const titleFontFamily = options?.style?.fontFamily || cardItemTitleStyle.fontFamily;
        const titleFontStyle = titleFontFamily ? { fontFamily: titleFontFamily } : undefined;
        const titleAlign = settings.cardAlign || 'left';
        const titleAlignClass = titleAlign === 'center' ? 'text-center' : titleAlign === 'right' ? 'text-right' : 'text-left';

        if (settings.source === 'Document' && item.encodedAbsUrl) {
            let DocIcon = File;
            let docColor = '#757575'; // default gray

            const normalizedType = String(item.type || '').trim().toLowerCase();
            if (normalizedType === 'pdf') {
                DocIcon = FaRegFilePdf;
                docColor = '#ff4d4d'; // bright red for PDF icon in screenshot
            } else if (normalizedType === 'word' || normalizedType === 'doc' || normalizedType === 'docx') {
                DocIcon = FileText;
                docColor = '#185abd'; // blue for Word
            } else if (normalizedType === 'excel' || normalizedType === 'xls' || normalizedType === 'xlsx') {
                DocIcon = FileSpreadsheet;
                docColor = '#107c41'; // green for Excel
            } else if (normalizedType === 'ppt' || normalizedType === 'pptx' || normalizedType === 'presentations') {
                DocIcon = Presentation;
                docColor = '#d24726'; // orange for PowerPoint
            } else if (normalizedType === 'link') {
                DocIcon = LinkIcon;
                docColor = '#607d8b'; // blue-grey for Link
            }

            return (
                <a
                    href={item.encodedAbsUrl + '?web=1'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={options?.documentLinkClassName || 'hover:text-[var(--link-color)] hover:underline transition-colors cursor-pointer'}
                    style={{ color: 'inherit', ...titleFontStyle }}
                >
                    <span className="inline-flex items-center gap-1.5 align-baseline">
                        <DocIcon className="w-4 h-4 shrink-0" style={{ color: docColor }} />
                        <span>{item.title}</span>
                    </span>
                </a>
            );
        }
        if (isSmartPageGrid) {
            const slug = resolveSmartPageSlug(item);
            const pageUrl = slug ? buildSmartPagePreviewUrl(slug) : undefined;
            const titleClassName = `ws-smart-page-card-title ${titleAlignClass} cursor-pointer no-underline hover:no-underline ${options?.className || ''}`;
            const titleStyle = {
                ...options?.style,
                color: 'inherit',
                background: 'none',
                border: 'none',
                padding: 0,
                textAlign: titleAlign as any,
                ...(titleFontFamily
                    ? { fontFamily: titleFontFamily, fontSize: 'inherit', fontWeight: 'inherit', lineHeight: 'inherit' }
                    : { font: 'inherit' }),
            } as React.CSSProperties;

            return (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (smartPageOpenInNewTab && pageUrl) {
                            window.open(pageUrl, '_blank', 'noopener,noreferrer');
                            return;
                        }
                        openSmartPage(e, item.id);
                    }}
                    className={titleClassName}
                    style={titleStyle}
                >
                    {item.title}
                </button>
            );
        }
        const isOpenPanelEnabled = settings.cardTitleOpenPanel && (settings.source === 'News' || settings.source === 'Event');
        if (isOpenPanelEnabled && onOpenDetailsPanel) {
            return (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetailsPanel(item);
                    }}
                    className={`${titleAlignClass} cursor-pointer no-underline hover:underline transition-colors ${options?.className || 'group-hover:text-[var(--primary-color)]'}`}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        color: 'inherit',
                        textAlign: titleAlign as any,
                        ...titleFontStyle
                    }}
                >
                    {item.title}
                </button>
            );
        }
        return (
            <span
                className={options?.className || 'group-hover:text-[var(--primary-color)] transition-colors'}
                style={titleFontStyle}
            >
                {item.title}
            </span>
        );
    };

    const checkScrollBounds = useCallback(() => {
        if (scrollContainer.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.current;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 1);
        }
    }, []);

    useEffect(() => {
        if (!isSlider) return;
        checkScrollBounds();
        const el = scrollContainer.current;
        if (el) {
            el.addEventListener('scroll', checkScrollBounds);
            window.addEventListener('resize', checkScrollBounds);
            return () => {
                el.removeEventListener('scroll', checkScrollBounds);
                window.removeEventListener('resize', checkScrollBounds);
            };
        }
    }, [isSlider, checkScrollBounds, settings.taggedItems, settings.showAllWithoutTagging]);

    const renderActionButton = (item: any, idx: number, isOldLayout = false, showFallbackReadMore = true) => {
        const o = item.originalItem;
        let btnEnabled = o?.btnEnabled;
        let btnName = getButtonLabelForLanguage(o?.btnName, lang);
        let btnLinkType = o?.btnLinkType || 'url';
        let btnUrl = o?.btnUrl;
        let btnContainerId = o?.btnContainerId;
        let btnTargetContainerTitle = o?.btnTargetContainerTitle;

        const perContainer = getPerContainerBtnConfig(o?.btnConfig, container.id);
        let actionButtonStyle = pickActionButtonStyleFields(o);
        if (perContainer && typeof perContainer === 'object') {
            if (perContainer.btnEnabled !== undefined) btnEnabled = perContainer.btnEnabled;
            if (perContainer.btnName !== undefined) btnName = getButtonLabelForLanguage(perContainer.btnName, lang);
            if (perContainer.btnLinkType !== undefined) btnLinkType = perContainer.btnLinkType || 'url';
            if (perContainer.btnUrl !== undefined) btnUrl = perContainer.btnUrl;
            if (perContainer.btnContainerId !== undefined) btnContainerId = perContainer.btnContainerId;
            if (perContainer.btnTargetContainerTitle !== undefined) {
                btnTargetContainerTitle = perContainer.btnTargetContainerTitle;
            }
            actionButtonStyle = pickActionButtonStyleFields(perContainer);
        }
        const actionBtnInlineStyle = buildActionButtonInlineStyle(actionButtonStyle);

        // Prefer item translation entry for non-English languages when available.
        // Container items often store translated button labels in translations[lang].btnName.
        if (lang !== 'en') {
            const translatedBtnName = getItemTranslation(o, lang, 'btnName');
            if (translatedBtnName) {
                btnName = translatedBtnName;
            }
        }

        const hasAction = btnEnabled && btnName;
        const oldLayoutSizeClass = readMoreButtonSize === 'lg' ? 'text-lg' : readMoreButtonSize === 'sm' ? 'text-sm' : 'text-base';
        const standardSizeClass = readMoreButtonSize === 'lg' ? 'text-base' : readMoreButtonSize === 'sm' ? 'text-xs' : 'text-sm';
        const iconSizeClass = readMoreButtonSize === 'lg' ? 'w-5 h-5' : readMoreButtonSize === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
        const oldLayoutLinkClasses = `text-[var(--primary-color)] ${oldLayoutSizeClass} font-bold flex items-center gap-1 hover:underline group/read`;

        const readMoreLinkClasses = isOldLayout
            ? oldLayoutLinkClasses
            : `text-[var(--link-color)] font-bold ${standardSizeClass} flex items-center gap-1.5 hover:underline group/btn mt-auto ${readMoreAlignClass}`;
        const readMoreButtonClasses = isOldLayout
            ? `btn-primary ws-hero-action-btn inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] tracking-wider ${standardSizeClass}`
            : `btn-primary ws-hero-action-btn w-max ${readMoreAlignClass} transition-all active:scale-[0.98] tracking-wider inline-flex items-center justify-center mt-auto ${standardSizeClass}`;
        const fallbackClasses = readMoreDisplayType === 'button' ? readMoreButtonClasses : readMoreLinkClasses;

        const wrapOldLayoutCta = (control: React.ReactNode) => (
            isOldLayout ? (
                <div className={`mt-auto ${readMoreAlignClass}`} style={{ paddingTop: '1.25rem' }}>{control}</div>
            ) : control
        );

        const renderReadMoreControl = (forceShow: boolean) => {
            const shouldShowFallbackReadMore = forceShow ? true : showFallbackReadMore;
            if (!shouldShowFallbackReadMore) return null;

            const isExpanded = !!expandedReadMoreById[item.id];
            const readMoreLabelKey = (isCardReadMoreEnabled && readMoreBehavior === 'expand' && isExpanded)
                ? 'BTN_READ_LESS'
                : 'BTN_READ_MORE';
            const readMoreLabel = getGlobalTranslation(
                readMoreLabelKey,
                translationItems,
                lang,
                getTranslation(readMoreLabelKey, lang)
            );

            return wrapOldLayoutCta(
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isCardReadMoreEnabled && readMoreBehavior === 'expand') {
                            setExpandedReadMoreById((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                            return;
                        }
                        setActiveReadMoreItem({ item, index: idx });
                    }}
                    className={fallbackClasses}
                >
                    <span>{readMoreLabel}</span>
                    {readMoreDisplayType === 'link' && (
                        isOldLayout ? (
                            <ChevronRight className={`${iconSizeClass} flex-shrink-0 transition-transform group-hover/read:translate-x-1`} style={{ color: 'var(--link-color)' }} strokeWidth={2.5} />
                        ) : (
                            <div className="flex items-center gap-0.5 opacity-80 group-hover/btn:opacity-100">
                                {viewMode === ViewMode.EDIT ? <EditTrigger labelKey={readMoreLabelKey} /> : <Info className={`${iconSizeClass} flex-shrink-0`} />}
                                <ChevronRight className={`${iconSizeClass} flex-shrink-0`} />
                            </div>
                        )
                    )}
                </button>
            );
        };

        if (isCardReadMoreEnabled) {
            return renderReadMoreControl(true);
        }

        if (hasAction) {
            const actionBtnBaseClasses = 'btn-primary ws-hero-action-btn inline-flex items-center justify-center transition-all active:scale-[0.98] tracking-wider';
            const effectiveBtnAlignClass = settings.cardAlign === 'left'
                ? 'self-start mr-auto ml-0'
                : settings.cardAlign === 'right'
                    ? 'self-end ml-auto mr-0'
                    : 'self-center mx-auto';
            const btnClasses = isOldLayout
                ? `${actionBtnBaseClasses} gap-1.5`
                : `${actionBtnBaseClasses} w-max ${effectiveBtnAlignClass} mt-auto`;
            if ((isContainerLinkType(btnLinkType) || (!!btnContainerId && !btnUrl)) && (btnContainerId || btnTargetContainerTitle)) {
                let targetPage: (typeof pages)[number] | null = null;
                if (btnContainerId && btnContainerId !== 'custom') {
                    targetPage = pages.find(p => p.containers?.some(c => matchesContainerId(c.id, btnContainerId))) ?? null;
                } else if (btnTargetContainerTitle) {
                    targetPage = pages.find(p => p.containers?.some(c => c.title === btnTargetContainerTitle)) ?? null;
                }

                const anchor = (() => {
                    const targetC = targetPage?.containers?.find(c =>
                        matchesContainerId(c.id, btnContainerId) || (btnTargetContainerTitle && c.title === btnTargetContainerTitle)
                    );
                    return targetC ? getContainerAnchor(targetC) : '';
                })();

                return wrapOldLayoutCta(
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (targetPage && anchor && onNavigateToSection) {
                                onNavigateToSection(
                                    targetPage.id,
                                    targetPage.slug || '/',
                                    anchor,
                                    btnContainerId
                                );
                                return;
                            }
                            const finalUrl = buildPreviewSectionHash(targetPage?.slug || '/', anchor);
                            onInternalLink(e, finalUrl, { instant: true });
                        }}
                        className={btnClasses}
                        style={actionBtnInlineStyle}
                    >
                        <span>{btnName}</span>
                    </button>
                );
            } else if (btnUrl) {
                const btnSameSite = isSameWebPreviewLink(btnUrl, siteUrl);
                return wrapOldLayoutCta(
                    <a
                        href={btnUrl}
                        target={btnSameSite ? '_self' : '_blank'}
                        rel={btnSameSite ? undefined : 'noopener noreferrer'}
                        onClick={(e) => {
                            e.stopPropagation();
                            onInternalLink(e, btnUrl);
                        }}
                        className={btnClasses}
                        style={actionBtnInlineStyle}
                    >
                        <span>{btnName}</span>
                    </a>
                );
            }
        }

        return renderReadMoreControl(false);
    };

    const taggedIds = settings.taggedItems || [];
    const isNewsOrEventSource = isNewsOrEventSourceEarly;
    const isBrowseAllMode = isBrowseAllModeEarly;

    const items = useMemo(() => {
        let allItems: any[] = [];

        if (settings.source === 'News') {
            allItems = news.map(n => ({
                id: n.id,
                title: getItemTranslation(n, lang, 'title'),
                desc: getItemTranslation(n, lang, 'description'),
                date: n.publishDate,
                img: n.imageUrl,
                status: n.status,
                readMoreText: getItemTranslation(n, lang, 'readMoreText'),
                translations: n.translations,
                originalItem: n
            }));
        } else if (settings.source === 'Event') {
            allItems = events.map(e => ({
                id: e.id,
                title: getItemTranslation(e, lang, 'title'),
                desc: getItemTranslation(e, lang, 'description'),
                date: e.startDate,
                endDate: e.endDate || (e as any).EndDate,
                img: e.imageUrl,
                status: e.status,
                readMoreText: getItemTranslation(e, lang, 'readMoreText'),
                translations: e.translations,
                originalItem: e
            }));
        } else if (settings.source === 'Document') {
            allItems = documents.map(d => ({
                id: d.id,
                title: getItemTranslation(d, lang, 'title'),
                desc: getItemTranslation(d, lang, 'description'),
                date: d.date,
                img: d.imageUrl || '',
                status: d.status,
                type: d.type,
                encodedAbsUrl: (d as any).encodedAbsUrl || (d as any).EncodedAbsUrl || '',
                readMoreText: getItemTranslation(d, lang, 'readMoreText'),
                translations: d.translations,
                originalItem: d
            }));
        } else if (settings.source === 'Smart Pages' || settings.source === 'SmartPages') {
            allItems = pages.map(p => ({
                id: p.id,
                title: getLocalizedText(p.title, lang),
                desc: p.description || '',
                date: p.modifiedDate,
                img: p.imageUrl || '',
                status: p.status,
                originalItem: p
            }));
        } else if (settings.source === 'Contacts' || settings.source === 'Contact') {
            allItems = contacts.map(c => ({
                id: c.id,
                title: getItemTranslation(c, lang, 'fullName'),
                jobTitle: getItemTranslation(c, lang, 'jobTitle') || '',
                company: getItemTranslation(c, lang, 'company') || (c as any).company || '',
                desc: getItemTranslation(c, lang, 'description') || '',
                date: c.createdDate,
                img: c.imageUrl || getGlobalDefaultImage(),
                status: c.status,
                readMoreText: '',
                translations: c.translations,
                originalItem: c
            }));
        } else if (settings.source === 'Container Items') {
            allItems = containerItems.map(item => ({
                id: item.id,
                title: getItemTranslation(item, lang, 'title'),
                desc: getItemTranslation(item, lang, 'description'),
                date: item.createdDate || new Date().toISOString(),
                img: item.imageUrl || '',
                status: item.status,
                originalItem: item
            }));
        }

        return buildDataGridSectionItems(allItems, taggedIds, settings.source || '', settings, lang);
    }, [
        settings.source,
        settings.taggedItems,
        settings.showAllWithoutTagging,
        settings.sortField,
        settings.sortDirection,
        lang,
        news,
        events,
        documents,
        pages,
        contacts,
        containerItems,
        taggedIds,
    ]);

    const taggedOrderChangeContext = useMemo((): TaggedOrderChangeContext | undefined => {
        if (settings.showAllWithoutTagging) return undefined;
        if (!sourceSupportsItemSortOrder(settings.source || '')) return undefined;
        const ids: string[] = settings.taggedItems || [];
        if (ids.length < 2) return undefined;

        const source = settings.source;
        let sourceList: any[] = [];
        if (source === 'News') sourceList = news;
        else if (source === 'Event') sourceList = events;
        else if (source === 'Document') sourceList = documents;
        else if (source === 'Container Items') sourceList = containerItems;
        else if (source === 'Smart Pages' || source === 'SmartPages') sourceList = pages;
        else if (source === 'Contact' || source === 'Contacts') sourceList = contacts;
        else if (source === 'ImageSlider') sourceList = sliderItems;
        else return undefined;

        const titleKey = (source === 'Contact' || source === 'Contacts') ? 'fullName' : 'title';
        const tagged = ids
            .map((id: string) => sourceList.find((entry) => String(entry.id) === String(id)))
            .filter(Boolean);

        return {
            taggedIds: ids.map(String),
            items: tagged.map((entry: any) => ({
                id: String(entry.id),
                title: getItemTranslation(entry, lang, titleKey),
                imageUrl: entry.imageUrl,
                status: entry.status,
            })),
            onApply: async (result) => {
                const pageId = container.pageId || currentPageId;
                if (pageId) {
                    updateContainer(pageId, {
                        ...container,
                        settings: { ...container.settings, taggedItems: result.orderedIds },
                    });
                }
            },
        };
    }, [
        settings.showAllWithoutTagging,
        settings.taggedItems,
        settings.source,
        settings.sortField,
        settings.sortDirection,
        news,
        events,
        documents,
        containerItems,
        contacts,
        sliderItems,
        pages,
        container,
        lang,
        currentPageId,
        updateContainer,
    ]);

    useEffect(() => {
        setBrowseSearch('');
        setBrowseYear('all');
    }, [container.id, settings.source]);

    const getBrowseItemYear = useCallback((item: any) => {
        const raw = item.date ?? item.originalItem?.startDate ?? item.originalItem?.publishDate;
        const parsed = moment(raw);
        return parsed.isValid() ? parsed.year() : null;
    }, []);

    const availableYears = useMemo(() => {
        if (!isBrowseAllMode) return [] as number[];
        const years = new Set<number>();
        items.forEach((item: any) => {
            const year = getBrowseItemYear(item);
            if (year) years.add(year);
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [items, isBrowseAllMode, getBrowseItemYear]);

    const displayItems = useMemo(() => {
        if (!isBrowseAllMode) return items;
        let list = items;
        const query = browseSearch.trim().toLowerCase();
        if (query) {
            list = list.filter((item: any) => {
                const title = (item.title || '').toLowerCase();
                const desc = stripHtml(item.desc || '').toLowerCase();
                return title.includes(query) || desc.includes(query);
            });
        }
        if (!flatView && browseYear !== 'all') {
            list = list.filter((item: any) => getBrowseItemYear(item) === browseYear);
        }
        return list;
    }, [items, isBrowseAllMode, browseSearch, browseYear, flatView, getBrowseItemYear]);

    const browseSourceLabel = settings.source === 'News' ? 'News' : 'Event';
    const browseSearchPlaceholder = settings.source === 'News'
        ? getTranslation('PLACEHOLDER_SEARCH_ALL_NEWS', lang)
        : getTranslation('PLACEHOLDER_SEARCH_ALL_EVENTS', lang);

    const handleBrowseClearAll = () => {
        setBrowseSearch('');
        setBrowseYear('all');
    };

    const useFlatBrowseList = isBrowseAllMode && flatView;

    const measureDescriptionOverflow = useCallback(() => {
        const next: Record<string, boolean> = {};
        displayItems.forEach((item: any) => {
            const el = descRefs.current[item.id];
            if (!el) {
                next[item.id] = false;
                return;
            }
            // Detect truncation after line clamp.
            next[item.id] = (el.scrollHeight - el.clientHeight) > 1 || (el.scrollWidth - el.clientWidth) > 1;
        });
        setDescOverflowById((prev) => {
            const prevKeys = Object.keys(prev);
            const nextKeys = Object.keys(next);
            if (prevKeys.length === nextKeys.length && nextKeys.every((k) => prev[k] === next[k])) {
                return prev;
            }
            return next;
        });
    }, [displayItems]);

    const cardGridGapStyle = resolveCardGridGapStyle({
        useFlatBrowseList,
        isSlider,
        useOldCardLayout: settings.useOldCardLayout,
        spacing: settings.spacing,
    });

    const cardWidth = isSlider ? resolveSliderCardWidth(cols, settings.spacing) : 'auto';

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainer.current) {
            const containerWidth = scrollContainer.current.clientWidth;
            const scrollAmount = containerWidth;

            scrollContainer.current.scrollBy({
                left: direction === 'right' ? scrollAmount : -scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const [isDraggingGrid, setIsDraggingGrid] = useState(false);
    const gridStartX = useRef(0);
    const gridScrollLeft = useRef(0);
    const hasGridMoved = useRef(false);

    const handleGridMouseDown = (e: React.MouseEvent) => {
        if (!isSlider || !scrollContainer.current) return;
        setIsDraggingGrid(true);
        gridStartX.current = e.clientX - scrollContainer.current.offsetLeft;
        gridScrollLeft.current = scrollContainer.current.scrollLeft;
        hasGridMoved.current = false;
    };

    const handleGridMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingGrid || !scrollContainer.current) return;
        e.preventDefault();
        const x = e.clientX - scrollContainer.current.offsetLeft;
        const walk = (x - gridStartX.current) * 1.5;
        if (Math.abs(walk) > 5) {
            hasGridMoved.current = true;
        }
        scrollContainer.current.scrollLeft = gridScrollLeft.current - walk;
    };

    const handleGridMouseUpOrLeave = () => {
        if (!isDraggingGrid) return;
        setIsDraggingGrid(false);
    };

    const handleGridClickCapture = (e: React.MouseEvent) => {
        if (hasGridMoved.current) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    useEffect(() => {
        if (isSlider && settings.autoplay) {
            const autoplayDelay = ((settings.speed || 5) + 3) * 1000;
            const interval = setInterval(() => {
                if (scrollContainer.current) {
                    const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.current;
                    if (Math.ceil(scrollLeft + clientWidth) >= scrollWidth - 10) {
                        scrollContainer.current.scrollTo({ left: 0, behavior: 'smooth' });
                    } else {
                        scroll('right');
                    }
                }
            }, autoplayDelay);
            return () => clearInterval(interval);
        }
    }, [isSlider, settings.autoplay, settings.speed]);

    useEffect(() => {
        measureDescriptionOverflow();
        const onResize = () => measureDescriptionOverflow();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [measureDescriptionOverflow, cols, isSlider, settings.useOldCardLayout, settings.ordering, settings.imgBorder, settings.source]);

    useEffect(() => {
        if (!scrollContainer.current || typeof ResizeObserver === 'undefined') return;
        let rafId: number | null = null;
        const observer = new ResizeObserver(() => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => measureDescriptionOverflow());
        });
        observer.observe(scrollContainer.current);
        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            observer.disconnect();
        };
    }, [measureDescriptionOverflow]);

    const borderClass = settings.border === 'rounded' ? 'rounded-lg' : (settings.border === 'circle' ? 'rounded-xl' : 'rounded-none');

    const resolvedBgColor = settings.bgColor || (settings.backgroundColor && settings.backgroundColor !== 'site-color' ? settings.backgroundColor : '#ffffff');
    const resolvedBgImage = settings.bgImage || settings.backgroundImage || '';
    const bgTypeNormalized = String(settings.bgType || '').toLowerCase();
    const resolvedBgType = ((bgTypeNormalized === 'none' || bgTypeNormalized === 'color' || bgTypeNormalized === 'image' || bgTypeNormalized === 'site-color' || bgTypeNormalized === 'site' || bgTypeNormalized === 'sitecolor')
        ? ((bgTypeNormalized === 'site' || bgTypeNormalized === 'sitecolor') ? 'site-color' : bgTypeNormalized)
        : (
            settings.backgroundColor === 'site-color'
                ? 'site-color'
                : ((settings.bgImage || settings.backgroundImage) ? 'image' : ((settings.bgColor || settings.backgroundColor) ? 'color' : 'none'))
        )) as 'none' | 'color' | 'site-color' | 'image';

    const bgStyle: React.CSSProperties = {
        backgroundColor: resolvedBgType === 'site-color' ? 'var(--primary-color)' : (resolvedBgType === 'color' ? resolvedBgColor : 'transparent'),
        backgroundImage: resolvedBgType === 'image' && resolvedBgImage ? `url("${resolvedBgImage}")` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
    };

    const resolvedCardBgColor = settings.cardBgColor || settings.cardBackgroundColor || '#ffffff';
    const cardBgTypeNormalized = String(settings.cardBgType || '').toLowerCase();
    const resolvedCardBgType = ((cardBgTypeNormalized === 'none' || cardBgTypeNormalized === 'color' || cardBgTypeNormalized === 'site-color' || cardBgTypeNormalized === 'site' || cardBgTypeNormalized === 'sitecolor')
        ? ((cardBgTypeNormalized === 'site' || cardBgTypeNormalized === 'sitecolor') ? 'site-color' : cardBgTypeNormalized)
        : (
            settings.cardBackgroundColor === 'site-color'
                ? 'site-color'
                : ((settings.cardBgColor || settings.cardBackgroundColor) ? 'color' : 'none')
        )) as 'none' | 'color' | 'site-color';

    const cardBgStyle: React.CSSProperties = {
        backgroundColor: resolvedCardBgType === 'site-color' ? 'var(--primary-color)' : (resolvedCardBgType === 'color' ? resolvedCardBgColor : 'transparent'),
    };

    const isNumbered = settings.ordering && settings.ordering !== 'none';

    // Strict Layout Classes Calculation (1-column uses featured-image aspect ratio, not a short full-width strip)
    const isSingleColumnGrid = cols === 1 && !isSlider;
    const getLayoutClasses = (): { card: string; img: string; imgStyle?: React.CSSProperties } => {
        const pos = settings.imgPos || 'top';
        switch (pos) {
            case 'left':
                return {
                    card: isSingleColumnGrid ? 'flex-row items-stretch' : 'flex-row items-center',
                    img: isSingleColumnGrid
                        ? 'w-48 sm:w-56 flex-shrink-0 m-0 self-stretch min-h-[12rem]'
                        : 'w-24 h-24 m-4 flex-shrink-0',
                    imgStyle: isSingleColumnGrid ? { minHeight: '12rem' } : undefined,
                };
            case 'right':
                return {
                    card: isSingleColumnGrid ? 'flex-row-reverse items-stretch' : 'flex-row-reverse items-center',
                    img: isSingleColumnGrid
                        ? 'w-48 sm:w-56 flex-shrink-0 m-0 self-stretch min-h-[12rem]'
                        : 'w-24 h-24 m-4 flex-shrink-0',
                    imgStyle: isSingleColumnGrid ? { minHeight: '12rem' } : undefined,
                };
            case 'none':
                return { card: 'flex-col', img: 'hidden' };
            default:
                return {
                    card: 'flex-col',
                    img: isSingleColumnGrid
                        ? 'w-full flex-shrink-0 min-h-[12rem] max-h-[26rem]'
                        : 'w-full h-48 flex-shrink-0',
                    imgStyle: isSingleColumnGrid
                        ? { aspectRatio: '2 / 1', maxHeight: '26rem', width: '100%' }
                        : undefined,
                };
        }
    };
    const layout = getLayoutClasses();
    const sectionLetterCaseClass = normalizeLetterCaseValue(settings.letterCase);
    const sectionTextTransform = sectionLetterCaseClass === 'normal-case' ? undefined : sectionLetterCaseClass;

    const firstTruthyDate = (...values: (string | undefined | null)[]) => {
        for (const value of values) {
            if (value && String(value).trim()) return String(value).trim();
        }
        return undefined;
    };
    const formatGridItemDateLabel = (dateStr?: string) => {
        if (!dateStr) return '';
        const parsed = moment(dateStr);
        if (!parsed.isValid()) return '';
        return parsed.locale(lang).format('DD MMM YYYY');
    };
    const renderNewsEventDate = (item: any) => {
        if (!isNewsOrEventSource) return null;

        const startRaw = firstTruthyDate(
            item.date,
            item.originalItem?.startDate,
            item.originalItem?.publishDate
        );
        if (!startRaw) return null;

        const startLabel = formatGridItemDateLabel(startRaw);
        if (!startLabel) return null;

        const gridDateStyle = {
            color: '#999',
            fontFamily: 'var(--font-family-secondary, sans-serif)',
        } as const;

        return (
            <div
                className="ws-data-grid-card-date inline-flex items-center gap-1.5 w-fit max-w-full"
                style={{ paddingTop: '0.25rem', marginBottom: '0.625rem' }}
            >
                <IoCalendarOutline
                    className="flex-shrink-0"
                    style={{ width: 18, height: 18, color: '#808080' }}
                    aria-hidden
                />
                <span
                    style={{
                        ...gridDateStyle,
                        fontSize: '16px',
                        lineHeight: '1.25',
                        fontWeight: 600,
                    }}
                >
                    {startLabel}
                </span>
            </div>
        );
    };

    return (
        <div className="w-full" style={bgStyle}>
            {cardTitleCustomCss ? <style>{cardTitleCustomCss}</style> : null}
            <div
                className={`ws-page-width relative group/slider ${sectionSpacingClassName(settings)}`}
                style={resolveSectionSpacingPadding(settings, { top: '4rem', bottom: '4rem' })}
            >

                <div className={`mb-8`}>
                    <div className={`flex items-end ${settings.align === 'center' ? 'justify-center relative' :
                        settings.align === 'right' ? 'justify-end relative' :
                            'justify-between'
                        }`}>
                        <div className={`${settings.align === 'center' ? 'text-center w-full' :
                            settings.align === 'right' ? 'text-right' :
                                'text-left'
                            }`}>
                            {(settings.showHeader !== false) && (
                                <h2 className={`${titleTypoStyle.fontWeight ? '' : 'font-bold'} tracking-tight ${sectionLetterCaseClass} ${resolveColor(settings.titleColor, settings.titleCustomColor, 'text-inherit', '--heading-h2-color').className || ''}`}
                                    style={{
                                        fontFamily: 'var(--font-family-secondary)',
                                        ...resolveColor(settings.titleColor, settings.titleCustomColor, 'text-inherit', '--heading-h2-color').style,
                                        ...titleTypoStyle,
                                        ...(titleTypoStyle.fontWeight ? { '--font-weight-bold': titleTypoStyle.fontWeight } as any : {}),
                                        ...(sectionTextTransform ? { textTransform: sectionTextTransform } : {})
                                    }}>
                                    {getLocalizedText(container.content.title, lang)}
                                </h2>
                            )}
                            {(settings.showSubheading !== false) && settings.subheading && (
                                <p className={`text-lg ${subtitleTypoStyle.fontWeight ? '' : 'font-medium'} ${settings.align === 'center' ? WS_CENTERED_SUBHEADING_CLASS : 'w-full'} ${resolveColor(settings.subtitleColor || settings.titleColor, settings.subtitleCustomColor || settings.titleCustomColor, 'text-inherit', '--heading-h2-color').className || ''}`}
                                    style={{
                                        ...resolveColor(settings.subtitleColor || settings.titleColor, settings.subtitleCustomColor || settings.titleCustomColor, 'text-inherit', '--heading-h2-color').style,
                                        ...subtitleTypoStyle,
                                        ...(subtitleTypoStyle.fontWeight ? { '--font-weight-bold': subtitleTypoStyle.fontWeight } as any : {})
                                    }}>
                                    {getLocalizedText(settings.subheading, lang)}
                                </p>
                            )}
                            {(settings.showDescription !== false) && settings.description && (
                                renderRichText(
                                    getLocalizedText(settings.description, lang),
                                    `text-sm leading-relaxed max-w-4xl mt-4 ${settings.align === 'center' ? 'mx-auto' : ''} ${resolveColor(settings.descColor, settings.descCustomColor, '', '--text-primary').className || ''}`,
                                    {
                                        ...resolveColor(settings.descColor, settings.descCustomColor, 'text-[var(--text-secondary)]', '--text-primary').style,
                                        ...descTypoStyle,
                                        ...(descTypoStyle.fontWeight ? { fontWeight: descTypoStyle.fontWeight } as any : {})
                                    } as any,
                                    true
                                )
                            )}
                        </div>

                        {isSlider && displayItems.length > cols && (
                            <div className={`flex gap-2 ${settings.align === 'center' ? 'absolute right-0' : ''}`}>
                                <button
                                    onClick={() => scroll('left')}
                                    disabled={!canScrollLeft}
                                    className={`ws-slider-chevron-btn w-8 h-8 flex items-center justify-center shadow-sm transition-all rounded-sm ${canScrollLeft ? 'btn-primary' : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-40'}`}
                                >
                                    <ChevronLeft className="w-5 h-5 flex-shrink-0" style={{ color: canScrollLeft ? 'white' : 'currentColor' }} />
                                </button>
                                <button
                                    onClick={() => scroll('right')}
                                    disabled={!canScrollRight}
                                    className={`ws-slider-chevron-btn w-8 h-8 flex items-center justify-center shadow-sm transition-all rounded-sm ${canScrollRight ? 'btn-primary' : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-40'}`}
                                >
                                    <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: canScrollRight ? 'white' : 'currentColor' }} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {isBrowseAllMode && (
                    <div className="w-full mb-8 space-y-4">
                        <div className="flex flex-wrap items-center gap-3 w-full">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={browseSearch}
                                    onChange={(e) => setBrowseSearch(e.target.value)}
                                    placeholder={browseSearchPlaceholder}
                                    className="w-full border border-gray-300 py-2.5 pl-10 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[var(--primary-color)] bg-white"
                                    style={{ fontFamily: 'var(--font-family-base, sans-serif)' }}
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-4 shrink-0">
                                <p
                                    className="text-sm text-gray-600 whitespace-nowrap"
                                    style={{ fontFamily: 'var(--font-family-base, sans-serif)' }}
                                >
                                    {getTranslation('MSG_DATA_GRID_SHOWING_OF', lang)
                                        .replace('{0}', String(displayItems.length))
                                        .replace('{1}', String(items.length))
                                        .replace('{2}', browseSourceLabel)}
                                </p>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`text-sm font-bold whitespace-nowrap ${flatView ? 'text-[var(--primary-color)]' : 'text-gray-600'}`}
                                        style={{ fontFamily: 'var(--font-family-base, sans-serif)' }}
                                    >
                                        {getTranslation('LABEL_FLAT_VIEW', lang)}
                                    </span>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={flatView}
                                        onClick={() => {
                                            const next = !flatView;
                                            setBrowseFlatView(container.id, next);
                                            if (next) setBrowseYear('all');
                                        }}
                                        className="relative w-12 h-6 rounded-full transition-colors flex-shrink-0"
                                        style={{
                                            backgroundColor: flatView ? 'var(--primary-color)' : '#d1d5db',
                                            border: flatView ? '1px solid var(--primary-color)' : '1px solid #9ca3af',
                                        }}
                                    >
                                        <span
                                            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all"
                                            style={{ left: flatView ? 'calc(100% - 1.35rem)' : '0.15rem' }}
                                        />
                                    </button>
                                    {!flatView && (
                                        <button
                                            type="button"
                                            onClick={handleBrowseClearAll}
                                            className="text-sm text-[#4a5f6f] underline hover:text-[var(--primary-color)] whitespace-nowrap ml-1"
                                            style={{ fontFamily: 'var(--font-family-base, sans-serif)' }}
                                        >
                                            {getTranslation('LABEL_CLEAR_ALL', lang)}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {!flatView && availableYears.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setBrowseYear('all')}
                                    className={`min-w-[52px] px-3 py-1.5 text-sm border transition-colors ${browseYear === 'all'
                                        ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)] font-semibold'
                                        : 'bg-white text-gray-700 border-gray-300 hover:text-[var(--primary-color)]'
                                        }`}
                                    style={{ fontFamily: 'var(--font-family-base, sans-serif)' }}
                                >
                                    {getTranslation('LABEL_ALL_YEARS', lang)}
                                </button>
                                {availableYears.map((year) => (
                                    <button
                                        key={year}
                                        type="button"
                                        onClick={() => setBrowseYear(year)}
                                        className={`min-w-[52px] px-3 py-1.5 text-sm border transition-colors ${browseYear === year
                                            ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)] font-semibold'
                                            : 'bg-white text-gray-700 border-gray-300 hover:text-[var(--primary-color)]'
                                            }`}
                                        style={{ fontFamily: 'var(--font-family-base, sans-serif)' }}
                                    >
                                        {year}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div
                    ref={scrollContainer}
                    onMouseDown={handleGridMouseDown}
                    onMouseMove={handleGridMouseMove}
                    onMouseUp={handleGridMouseUpOrLeave}
                    onMouseLeave={handleGridMouseUpOrLeave}
                    onClickCapture={handleGridClickCapture}
                    className={`
                ${useFlatBrowseList ? 'flex flex-col gap-4 ws-card-grid-flat' : isSlider ? 'flex flex-nowrap overflow-x-auto scrollbar-none snap-x snap-mandatory ws-card-grid-slider select-none' : 'ws-card-grid'} 
`}
                    style={{
                        ...(useFlatBrowseList || isSlider ? {} : { ['--ws-grid-cols' as string]: String(cols) }),
                        scrollBehavior: 'smooth',
                        cursor: isSlider ? (isDraggingGrid ? 'grabbing' : 'grab') : 'auto',
                        ...cardGridGapStyle,
                    }}
                >
                    {displayItems.map((item: any, idx: number) => {
                        const hasVisual = item.img || settings.source === 'Document';
                        const hasDescOverflow = !!descOverflowById[item.id];
                        const isExpanded = !!expandedReadMoreById[item.id];
                        const cardAlignClass = settings.cardAlign === 'center'
                            ? 'text-center items-center'
                            : settings.cardAlign === 'right'
                                ? 'text-right items-end'
                                : 'text-left items-start';
                        const cardTitleJustifyClass = settings.cardAlign === 'center'
                            ? 'justify-center'
                            : settings.cardAlign === 'right'
                                ? 'justify-end'
                                : 'justify-start';

                        if (useFlatBrowseList) {
                            return (
                                <div
                                    key={item.id}
                                    className="relative flex flex-row gap-4 p-4 bg-white border border-gray-200 group"
                                    style={cardBgStyle}
                                >
                                    {viewMode === ViewMode.EDIT && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingItem({ item: item.originalItem, type: dataGridSource });
                                            }}
                                            className="absolute top-3 right-3 text-gray-400 hover:text-[var(--primary-color)] transition-colors z-10"
                                            aria-label="Edit"
                                        >
                                            <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--icon-color)' }} />
                                        </button>
                                    )}
                                    <div className="w-24 h-24 flex-shrink-0 bg-gray-100 border border-gray-100 overflow-hidden flex items-center justify-center">
                                        {item.img ? (
                                            <img key={resolveCardImageSrc(item)} src={resolveCardImageSrc(item)} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <ImageIcon className="w-8 h-8 text-gray-300" />
                                        )}
                                    </div>
                                    <div className={`flex-1 min-w-0 pr-8 flex flex-col ${cardAlignClass}`}>
                                        {renderNewsEventDate(item)}
                                        <h3
                                            className="ws-card-title-container font-bold text-[var(--primary-color)] mb-2 leading-snug"
                                            style={cardItemTitleStyle}
                                        >
                                            {renderGridCardTitle(item, { style: cardItemTitleStyle as React.CSSProperties })}
                                        </h3>
                                        {item.desc && (
                                            <div className="text-sm text-gray-800 leading-relaxed mb-3">
                                                {renderRichText(
                                                    item.desc,
                                                    `${isExpanded ? '' : 'line-clamp-4'} [&_a]:text-[var(--link-color)] [&_a]:underline [&_a]:break-words`,
                                                    { fontFamily: 'var(--font-family-base, sans-serif)' } as any,
                                                    true
                                                )}
                                            </div>
                                        )}
                                        {renderActionButton(item, idx, true, hasDescOverflow)}
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={item.id}
                                className={`${settings.useOldCardLayout ? 'bg-transparent' : 'bg-white'} ${settings.border !== 'none' ? 'border border-gray-200' : ''} group flex relative box-border
                                ${isSlider && !settings.useOldCardLayout ? 'h-full overflow-hidden transition-shadow duration-300' : ''}
                                ${layout.card}
                                ${borderClass} 
                                ${isSlider ? 'snap-start flex-shrink-0' : ''}
                                ${settings.useOldCardLayout ? '' : settings.imgBorder === 'halfcircle' ? 'overflow-visible' : (!isSlider ? 'overflow-hidden' : '')}`}
                                style={{
                                    width: isSlider ? cardWidth : 'auto',
                                    flex: isSlider ? `0 0 ${cardWidth}` : undefined,
                                    maxWidth: isSlider ? cardWidth : undefined,
                                    marginTop: settings.imgBorder === 'halfcircle' ? '5.5rem' : undefined,
                                    borderLeft: settings.imgBorder === 'halfcircle' ? '4px solid var(--primary-color) !important' : undefined,
                                    minHeight: (isSlider && !settings.useOldCardLayout && !isMobileViewport) ? ((settings.source === 'Contacts' || settings.source === 'Contact' || settings.imgBorder === 'circle' || settings.imgBorder === 'halfcircle') ? '420px' : '460px') : undefined,
                                    ...cardBgStyle
                                }}>
                                {/* Image Area - Responsive & Conditional */}
                                {settings.imgPos !== 'none' && hasVisual && (() => {
                                    const isCircle = settings.imgBorder === 'circle';
                                    const isHalfCircle = settings.imgBorder === 'halfcircle';
                                    const isRounded = settings.imgBorder === 'rounded';

                                    if (isCircle) {
                                        // Circle mode: fixed centered avatar
                                        const align = settings.cardAlign || 'left';
                                        let justifyClass = "justify-center";
                                        let paddingClass = "";
                                        if (align === 'left') {
                                            justifyClass = "justify-start";
                                            paddingClass = "pl-5";
                                        } else if (align === 'right') {
                                            justifyClass = "justify-end";
                                            paddingClass = "pr-5";
                                        }

                                        const wrapperClass = (settings.imgPos === 'left' || settings.imgPos === 'right')
                                            ? `${layout.img} flex items-center justify-center py-4 bg-transparent`
                                            : `w-full flex ${justifyClass} ${paddingClass} pt-8 pb-3 bg-transparent`;
                                        
                                        const circleSizeClass = (settings.imgPos === 'left' || settings.imgPos === 'right') && !isSingleColumnGrid
                                            ? "w-20 h-20"
                                            : "w-40 h-40";

                                        return (
                                            <div className={wrapperClass} style={layout.imgStyle}>
                                                <div className={`${circleSizeClass} rounded-full overflow-hidden flex-shrink-0 bg-gray-100 border-2 border-gray-200`}>
                                                    {item.img ? (
                                                        <img key={resolveCardImageSrc(item)} src={resolveCardImageSrc(item)} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                                                            {getDocIcon(item.type)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }

                                    if (isHalfCircle) {
                                        // Half Circle mode: circular avatar absolutely positioned above the card top border
                                        const imgPos = settings.imgPos || 'top';
                                        const align = settings.cardAlign || 'left';
                                        const halfCircleStyle: React.CSSProperties = { top: '-5rem' };
                                        
                                        if (imgPos === 'left') {
                                            halfCircleStyle.left = '1.5rem';
                                        } else if (imgPos === 'right') {
                                            halfCircleStyle.right = '1.5rem';
                                        } else {
                                            // 'top' position follows CONTENT ALIGNMENT
                                            if (align === 'center') {
                                                halfCircleStyle.left = '50%';
                                                halfCircleStyle.transform = 'translateX(-50%)';
                                            } else if (align === 'right') {
                                                halfCircleStyle.right = '1.5rem';
                                            } else {
                                                halfCircleStyle.left = '1.5rem';
                                            }
                                        }

                                        return (
                                            <div
                                                className="absolute"
                                                style={halfCircleStyle}
                                            >
                                                <div className="w-40 h-40 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 border-4 border-white shadow-lg">
                                                    {item.img ? (
                                                        <img key={resolveCardImageSrc(item)} src={resolveCardImageSrc(item)} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                                                            {getDocIcon(item.type)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }

                                    const imgBorderClass = isRounded
                                        ? (isSlider && (settings.imgPos || 'top') === 'top' ? 'rounded-t-lg overflow-hidden' : 'rounded-xl overflow-hidden')
                                        : 'overflow-hidden';
                                    return (
                                        <div
                                            className={`${layout.img} bg-gray-100 relative flex-shrink-0 flex items-center justify-center ${imgBorderClass}`}
                                            style={layout.imgStyle}
                                        >
                                            {item.img ? (
                                                <img key={resolveCardImageSrc(item)} src={resolveCardImageSrc(item)} alt="" className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105" />
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50 group-hover:bg-gray-100 transition-colors">
                                                    {getDocIcon(item.type)}
                                                    <div className="text-[10px] font-bold uppercase mt-2 opacity-60 tracking-wider">{item.type || 'Item'}</div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* No absolute pencil here, we'll put it inline for contacts or title-based items */}

                                {settings.useOldCardLayout ? (
                                    /* ---- OLD SITE CARD LAYOUT ---- */
                                    <div className="flex-1 flex flex-row items-stretch gap-4 h-full">
                                        {/* Large faded number on the left — controlled by Ordering Type setting */}
                                        {settings.ordering !== 'none' && (
                                            <div
                                                className="select-none flex-shrink-0 leading-none"
                                                style={{
                                                    fontSize: '3rem',
                                                    fontWeight: 700,
                                                    fontFamily: 'var(--font-family-secondary, sans-serif)',
                                                    color: 'var(--border-color)',
                                                    lineHeight: 1,
                                                    minWidth: '3.5rem'
                                                }}
                                            >
                                                {getOrderedLabel(idx, settings.ordering)}
                                            </div>
                                        )}

                                        {/* Content */}
                                        <div className={`flex flex-col flex-1 min-w-0 pr-4 h-full text-${settings.cardAlign || 'left'} items-${settings.cardAlign === 'center' ? 'center' : settings.cardAlign === 'right' ? 'end' : 'start'}`}>
                                            {renderNewsEventDate(item)}
                                            {/* Title */}
                                            <div className={`flex items-start gap-2 mb-2 ${settings.cardAlign === 'center' ? 'justify-center' : settings.cardAlign === 'right' ? 'justify-end' : 'justify-start'}`}>
                                                {(() => {
                                                    const titleStyle = {
                                                        ...cardItemTitleStyle,
                                                        fontSize: cardItemTitleStyle.fontSize || '15px',
                                                        lineHeight: cardItemTitleStyle.lineHeight || '1.4',
                                                    };
                                                    return (
                                                        <>
                                                            <h3
                                                                className={`ws-card-title-container font-bold flex-1 ${isSmartPageGrid ? '' : 'group-hover:text-[var(--link-color)] transition-colors'}`}
                                                                style={{
                                                                    ...titleStyle,
                                                                    minHeight: '2.8em',
                                                                    wordBreak: 'break-word',
                                                                    whiteSpace: 'normal',
                                                                } as any}
                                                            >
                                                                {renderGridCardTitle(item, {
                                                                    style: cardItemTitleStyle as React.CSSProperties,
                                                                })}
                                                            </h3>
                                                            {viewMode === ViewMode.EDIT && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingItem({ item: item.originalItem, type: dataGridSource });
                                                                    }}
                                                                    className="text-[var(--link-color)] opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
                                                                    style={getEditButtonStyle(titleStyle)}
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--icon-color)' }} />
                                                                </button>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>

                                            {/* Description */}
                                            {item.desc && (
                                                <div ref={(el) => { descRefs.current[item.id] = el; }} className="ws-data-grid-card-desc">
                                                    {renderRichText(
                                                        item.desc,
                                                        `flex-1 ${isExpanded ? '' : 'desc-clamp-5'} [&_a]:text-[var(--link-color)] [&_a]:underline [&_a]:break-words`,
                                                        cardItemDescStyle as any,
                                                        true
                                                    )}
                                                </div>
                                            )}

                                            {/* Read More / Action Button */}
                                            {renderActionButton(item, idx, true, hasDescOverflow)}
                                        </div>
                                    </div>
                                ) : (settings.source === 'Contacts' || settings.source === 'Contact' || settings.imgBorder === 'circle') ? (
                                    /* ---- CONTACT / CIRCLE CARD: center-aligned ---- */
                                    <div className={`flex-1 flex flex-col ${cardAlignClass} ${settings.imgBorder === 'halfcircle' ? 'pt-24 px-4 pb-3' : 'p-5'}`}>
                                        {(() => {
                                            const contactStyle = item.originalItem || {};
                                            const fullNameStyle: any = {
                                                ...cardItemTitleStyle,
                                                ...(settings.fullNameFontSize ? { fontSize: toPxCssValue(settings.fullNameFontSize) } : (contactStyle.fullNameFontSize ? { fontSize: toPxCssValue(contactStyle.fullNameFontSize) } : {})),
                                                ...(settings.fullNameFontWeight ? { fontWeight: Number(settings.fullNameFontWeight) } : (contactStyle.fullNameFontWeight ? { fontWeight: Number(contactStyle.fullNameFontWeight) } : {})),
                                                ...(settings.fullNameLineHeight ? { lineHeight: toPxLineHeight(settings.fullNameLineHeight) } : (contactStyle.fullNameLineHeight ? { lineHeight: toPxLineHeight(contactStyle.fullNameLineHeight) } : {})),
                                                ...(settings.fullNameColor ? { color: settings.fullNameColor } : (contactStyle.fullNameColor ? { color: contactStyle.fullNameColor } : {}))
                                            };
                                            const jobTitleStyle: any = {
                                                ...(settings.jobTitleFontSize ? { fontSize: toPxCssValue(settings.jobTitleFontSize) } : (contactStyle.jobTitleFontSize ? { fontSize: toPxCssValue(contactStyle.jobTitleFontSize) } : {})),
                                                ...(settings.jobTitleFontWeight ? { fontWeight: Number(settings.jobTitleFontWeight) } : (contactStyle.jobTitleFontWeight ? { fontWeight: Number(contactStyle.jobTitleFontWeight) } : {})),
                                                ...(settings.jobTitleLineHeight ? { lineHeight: toPxLineHeight(settings.jobTitleLineHeight) } : (contactStyle.jobTitleLineHeight ? { lineHeight: toPxLineHeight(contactStyle.jobTitleLineHeight) } : {})),
                                                ...(settings.jobTitleColor ? { color: settings.jobTitleColor } : (contactStyle.jobTitleColor ? { color: contactStyle.jobTitleColor } : {}))
                                            };
                                            return (
                                                <>
                                                    <div className={`flex items-center ${cardTitleJustifyClass} gap-2 mb-1`}>
                                                        <h3 className="font-bold tracking-wider group-hover:text-[var(--primary-color)] transition-colors ws-card-title-container" style={fullNameStyle}>
                                                            {item.title}
                                                        </h3>
                                                        {viewMode === ViewMode.EDIT && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingItem({ item: item.originalItem, type: dataGridSource || 'News' });
                                                                }}
                                                                className="text-[var(--primary-color)] opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--icon-color)' }} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {(item.jobTitle || item.company) && (
                                                        <div className="text-sm text-gray-500 font-medium mb-3" style={jobTitleStyle}>
                                                            {item.jobTitle}
                                                            {item.jobTitle && item.company
                                                                ? ` ${lang === 'de' ? 'bei' : 'at'} ${item.company}`
                                                                : item.company}
                                                        </div>
                                                    )}
                                                    {item.desc && (
                                                        <div ref={(el) => { descRefs.current[item.id] = el; }} className="ws-data-grid-card-desc">
                                                            {renderRichText(
                                                                item.desc,
                                                                "text-base mb-4 flex-1 leading-relaxed [&_a]:text-[var(--link-color)] [&_a]:underline [&_a]:break-words",
                                                                cardItemDescStyle as any,
                                                                true
                                                            )}
                                                        </div>
                                                    )}
                                                    {renderActionButton(item, idx, false, false)}
                                                </>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    /* ---- REGULAR CARD: left-aligned, numbered layout ---- */
                                    (() => {
                                        const cardActionButton = renderActionButton(item, idx, false, hasDescOverflow);
                                        const cardCtaStyle = { paddingTop: '0.875rem', paddingBottom: '0.75rem', marginBottom: '0.25rem' } as const;
                                        const hasNoBgAndBorder = resolvedCardBgType === 'none' && (!settings.border || settings.border === 'none');
                                        const imgPos = settings.imgPos || 'top';
                                        let paddingClass = '';
                                        if (hasNoBgAndBorder) {
                                            if (imgPos === 'left') {
                                                paddingClass = 'no-bg-border-left-img';
                                            } else if (imgPos === 'right') {
                                                paddingClass = 'no-bg-border-right-img';
                                            } else {
                                                paddingClass = 'no-bg-border';
                                            }
                                        }
                                        return (
                                            <div
                                                className={`ws-data-grid-card-body flex-1 flex flex-col ${cardAlignClass} min-h-0 ${paddingClass}`}
                                                style={{ padding: '1rem 1.5rem 2.25rem', boxSizing: 'border-box' }}
                                            >
                                                {isNumbered ? (
                                                    /* Numbered: number left, all content right */
                                                    <div className="ws-data-grid-card-numbered-row flex flex-row items-start flex-1 min-h-0">
                                                        {/* Number */}
                                                        <div
                                                            className={`select-none leading-none flex-shrink-0 ${settings.ordering === 'IIIII' ? 'text-2xl tracking-tighter' : 'text-5xl'}`}
                                                            style={{
                                                                fontWeight: 700,
                                                                fontFamily: 'var(--font-family-secondary, sans-serif)',
                                                                letterSpacing: '-0.02em',
                                                                lineHeight: 1,
                                                                color: 'var(--border-color, #e5e7eb)',
                                                            }}
                                                        >
                                                            {getOrderedLabel(idx, settings.ordering)}
                                                        </div>

                                                        {/* Content column */}
                                                        <div className={`flex flex-col flex-1 min-w-0 min-h-0 items-${settings.cardAlign === 'center' ? 'center' : settings.cardAlign === 'right' ? 'end' : 'start'} text-${settings.cardAlign || 'left'}`}>
                                                            {renderNewsEventDate(item)}
                                                            <div className={`flex items-start gap-2 mb-2 mt-1 ${cardTitleJustifyClass}`}>
                                                                <h3 className="ws-card-title-container font-bold leading-snug flex-1" style={cardItemTitleStyle}>
                                                                    {renderGridCardTitle(item, {
                                                                        style: cardItemTitleStyle as React.CSSProperties,
                                                                        documentLinkClassName: 'hover:text-[var(--link-color)] hover:underline transition-colors cursor-pointer',
                                                                    })}
                                                                </h3>
                                                                {viewMode === ViewMode.EDIT && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingItem({ item: item.originalItem, type: dataGridSource });
                                                                        }}
                                                                        className="text-[var(--primary-color)] opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
                                                                        style={getEditButtonStyle(cardItemTitleStyle)}
                                                                    >
                                                                        <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--icon-color)' }} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {item.desc && (
                                                                <div ref={(el) => { descRefs.current[item.id] = el; }} className="ws-data-grid-card-desc flex-1 min-h-0">
                                                                    {renderRichText(
                                                                        item.desc,
                                                                        `text-sm leading-relaxed ${isExpanded ? '' : 'desc-clamp-5'} [&_a]:text-[var(--link-color)] [&_a]:underline [&_a]:break-words`,
                                                                        cardItemDescStyle as any,
                                                                        true
                                                                    )}
                                                                </div>
                                                            )}
                                                            {cardActionButton && (
                                                                <div className="ws-data-grid-card-cta mt-auto" style={cardCtaStyle}>
                                                                    {cardActionButton}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* Non-numbered: date + stacked layout */
                                                    <>
                                                        {renderNewsEventDate(item)}
                                                        <div className={`flex items-start gap-2 ${cardTitleJustifyClass}`}>
                                                            <h3 className="ws-card-title-container font-bold leading-snug flex-1" style={cardItemTitleStyle}>
                                                                {renderGridCardTitle(item, {
                                                                    style: cardItemTitleStyle as React.CSSProperties,
                                                                    documentLinkClassName: 'hover:text-[var(--primary-color)] hover:underline transition-colors cursor-pointer',
                                                                })}
                                                            </h3>
                                                            {viewMode === ViewMode.EDIT && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingItem({ item: item.originalItem, type: dataGridSource });
                                                                    }}
                                                                    className="text-[var(--primary-color)] opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
                                                                    style={getEditButtonStyle(cardItemTitleStyle)}
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--icon-color)' }} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {item.desc && (
                                                            <div ref={(el) => { descRefs.current[item.id] = el; }} className="ws-data-grid-card-desc">
                                                                {renderRichText(
                                                                    item.desc,
                                                                    `text-sm mb-4 flex-1 leading-relaxed ${isExpanded ? '' : 'desc-clamp-5'} [&_a]:text-[var(--link-color)] [&_a]:underline [&_a]:break-words`,
                                                                    { ...cardItemDescStyle, textOverflow: 'ellipsis' } as any,
                                                                    true
                                                                )}
                                                            </div>
                                                        )}
                                                        {cardActionButton && (
                                                            <div className="ws-data-grid-card-cta" style={cardCtaStyle}>
                                                                {cardActionButton}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })()
                                )}
                            </div>
                        );
                    })}

                    {displayItems.length === 0 && (
                        <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-200 rounded-sm bg-gray-50/50 w-full flex flex-col items-center justify-center">
                            <AlertTriangle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--icon-color)' }} />
                            <p className="text-gray-500 font-medium">
                                {isBrowseAllMode
                                    ? getTranslation('MSG_DATA_GRID_NO_MATCHING_ITEMS', lang)
                                    : getGlobalTranslation('LABEL_NO_ITEMS_TAGGED', useStore.getState().translationItems, lang as any, 'No items tagged for display.')}
                            </p>
                            {!isBrowseAllMode && (
                                <p className="text-xs text-gray-400">{getTranslation('MSG_EDIT_CONTAINER_TO_LINK_ITEMS', lang)}</p>
                            )}
                        </div>
                    )}
                </div>

                {
                    activeReadMoreItem && (
                        <ReadMoreModal
                            item={activeReadMoreItem.item}
                            index={activeReadMoreItem.index}
                            isNumbered={isNumbered}
                            imagePosition={settings.imgPos}
                            imgBorder={settings.imgBorder}
                            source={settings.source}
                            onClose={() => setActiveReadMoreItem(null)}
                        />
                    )
                }

                {
                    editingItem && editingItem.type === 'News' && (
                        <NewsEditor
                            item={editingItem.item}
                            onSave={(updated: any) => { updateNews(updated); setEditingItem(null); }}
                            onCancel={() => setEditingItem(null)}
                            onDelete={(id: string) => requestDelete(id, editingItem.type)}
                        />
                    )
                }

                {
                    editingItem && editingItem.type === 'Event' && (
                        <EventEditor
                            item={editingItem.item}
                            onSave={(updated: any) => { updateEvent(updated); setEditingItem(null); }}
                            onCancel={() => setEditingItem(null)}
                            onDelete={(id: string) => requestDelete(id, editingItem.type)}
                        />
                    )
                }

                {
                    editingItem && editingItem.type === 'Document' && (
                        <DocumentEditor
                            item={editingItem.item}
                            changeOrderContext={taggedOrderChangeContext}
                            onSave={(updated: any) => { updateDocument(updated); setEditingItem(null); }}
                            onCancel={() => setEditingItem(null)}
                            onDelete={(id: string) => requestDelete(id, editingItem.type)}
                        />
                    )
                }
                {
                    editingItem && editingItem.type === 'Contact' && (
                        <ContactEditor
                            item={editingItem.item}
                            containerId={container.id}
                            changeOrderContext={taggedOrderChangeContext}
                            onSave={(updated: any) => { updateContact(updated); setEditingItem(null); }}
                            onCancel={() => setEditingItem(null)}
                            onDelete={(id: string) => requestDelete(id, editingItem.type)}
                        />
                    )
                }
                {
                    editingItem && (editingItem.type === 'Container Items' || editingItem.type === 'ContainerItems') && (
                        <ContainerItemEditor
                            item={editingItem.item}
                            containerId={container.id}
                            changeOrderContext={taggedOrderChangeContext}
                            onSave={(updated: any) => { updateContainerItem(updated); setEditingItem(null); }}
                            onCancel={() => setEditingItem(null)}
                            onDelete={(id: string) => requestDelete(id, editingItem.type)}
                        />
                    )
                }
                {
                    editingItem && isSmartPagesSource(editingItem.type) && (
                        <SmartPageEditor
                            item={editingItem.item}
                            onSave={(updated: any) => { updatePage(updated); setEditingItem(null); }}
                            onCancel={() => setEditingItem(null)}
                            onDelete={(id: string) => requestDelete(id, editingItem.type)}
                        />
                    )
                }
                {
                    pendingDelete && (
                        <ConfirmDeleteDialog
                            title={`Delete ${isSmartPagesSource(pendingDelete.type) ? 'Page' : pendingDelete.type}`}
                            message={`Are you sure you want to delete this ${getDeleteEntityLabel(pendingDelete.type)}? This action cannot be undone.`}
                            onConfirm={handleConfirmDelete}
                            onCancel={() => setPendingDelete(null)}
                        />
                    )
                }
            </div>
        </div >
    );
};

// --- RENDERER 4: CONTACT FORM (UPDATED) ---
const ContactFormRenderer = ({ container, lang, pageTitle, onInternalLink }: ComponentRendererProps) => {
    const { themeConfig } = useStore();
    const { settings } = container;
    const titleTypoStyle = heroTypographyToStyle(resolveHeroTypography(settings, 'title', themeConfig), '--font-size-h2');
    const subtitleTypoStyle = heroTypographyToStyle(resolveHeroTypography(settings, 'subtitle', themeConfig), '--font-size-p');
    const descTypoStyle = heroTypographyToStyle(resolveHeroTypography(settings, 'description', themeConfig), '--font-size-p');
    const effectiveContactLetterCase = getEffectiveContactFormLetterCase(settings);
    const headingLetterCaseCss = resolveContactFormLetterCaseCss(effectiveContactLetterCase);
    const fields = useMemo(() => {
        const existing = Array.isArray(settings.fields) ? settings.fields : [];
        const hasCountry = existing.some((f: any) => normalizeText(String(f?.label || '')) === 'country');
        if (hasCountry) return existing;
        const countryField = {
            id: 'f_country',
            label: getTranslation('LABEL_COUNTRY', lang),
            placeholder: 'e.g. Germany',
            type: 'text',
            required: true,
        };
        const messageIdx = existing.findIndex((f: any) => normalizeText(String(f?.label || '')) === 'message');
        if (messageIdx === -1) return [...existing, countryField];
        const copy = [...existing];
        copy.splice(messageIdx, 0, countryField);
        return copy;
    }, [settings.fields, lang]);
    function normalizeText(value: string) {
        return value.toLowerCase().trim().replace(/\s+/g, ' ');
    }
    const getLocalizedContactFieldText = (value: string, type: 'label' | 'placeholder'): string => {
        const normalized = normalizeText(value || '');
        const map: Record<string, string> = type === 'label'
            ? {
                'first name': 'LABEL_FIRST_NAME',
                'last name': 'LABEL_LAST_NAME',
                'email': 'LABEL_EMAIL',
                'e-mail': 'LABEL_EMAIL',
                'country': 'LABEL_COUNTRY',
                'message': 'LABEL_MESSAGE'
            }
            : {
                'e.g. john': 'PLACEHOLDER_FIRST_NAME_EXAMPLE',
                'e.g. doe': 'PLACEHOLDER_LAST_NAME_EXAMPLE',
                'name@example.com': 'PLACEHOLDER_EMAIL_EXAMPLE',
                'country': 'PLACEHOLDER_COUNTRY',
                'your message...': 'PLACEHOLDER_MESSAGE_EXAMPLE'
            };
        const key = map[normalized];
        return key ? getTranslation(key, lang) : value;
    };
    const resolvedAlignment = (() => {
        const raw = String(settings.alignment || settings.align || 'center').toLowerCase();
        if (raw === 'left') return 'left';
        if (raw === 'right') return 'right';
        return 'center';
    })();
    const resolvedBgColor = settings.bgColor || (settings.backgroundColor && settings.backgroundColor !== 'site-color' ? settings.backgroundColor : '#ffffff');
    const resolvedBgImage = settings.bgImage || settings.backgroundImage || '';
    const bgTypeNormalized = String(settings.bgType || '').toLowerCase();
    const resolvedBgType = ((bgTypeNormalized === 'none' || bgTypeNormalized === 'color' || bgTypeNormalized === 'image' || bgTypeNormalized === 'site-color' || bgTypeNormalized === 'site' || bgTypeNormalized === 'sitecolor')
        ? ((bgTypeNormalized === 'site' || bgTypeNormalized === 'sitecolor') ? 'site-color' : bgTypeNormalized)
        : (
            settings.backgroundColor === 'site-color'
                ? 'site-color'
                : ((settings.bgImage || settings.backgroundImage) ? 'image' : ((settings.bgColor || settings.backgroundColor) ? 'color' : 'none'))
        )) as 'none' | 'color' | 'site-color' | 'image';
    const titleColor = resolveColor(settings.titleColor, settings.titleCustomColor, 'text-[var(--primary-color)]', '--heading-h2-color');
    const subtitleColor = resolveColor(settings.subtitleColor || settings.titleColor, settings.subtitleCustomColor || settings.titleCustomColor, 'text-[var(--text-secondary)]', '--heading-h2-color');
    const descColor = resolveColor(settings.descColor || settings.titleColor, settings.descCustomColor || settings.titleCustomColor, 'text-[var(--text-secondary)]', '--text-primary');
    const labelColor = resolveColor(settings.labelColor || settings.descColor || settings.titleColor, settings.labelCustomColor || settings.descCustomColor || settings.titleCustomColor, 'text-gray-500', '--text-primary');
    const labelTypoStyle = heroTypographyToStyle(resolveHeroTypography(settings, 'label', themeConfig), '--font-size-p');
    const labelTypographyStyle: any = {
        ...labelColor.style,
        ...labelTypoStyle,
    };
    const contactCardRadiusStyle = resolveSliderImageRadiusStyle(parseSliderImageSettings(settings.formCardRadiusSettings));

    // State for form data and UI feedback
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [captchaValue, setCaptchaValue] = useState('');
    const [captchaChallenge, setCaptchaChallenge] = useState<CaptchaChallenge | null>(null);
    const [captchaLoading, setCaptchaLoading] = useState(false);
    const [captchaError, setCaptchaError] = useState<string | null>(null);
    const [honeypotValue, setHoneypotValue] = useState('');

    const validationMessages = useMemo(() => ({
        requiredNamed: getTranslation('MSG_FIELD_REQUIRED_NAMED', lang),
        invalidEmail: getTranslation('MSG_INVALID_EMAIL', lang),
        privacy: getTranslation('MSG_ACCEPT_PRIVACY', lang),
        captcha: getTranslation('MSG_INCORRECT_CAPTCHA', lang),
    }), [lang]);
    const completeRequiredFieldsHint = useMemo(() => {
        const msg = getTranslation('MSG_COMPLETE_REQUIRED_FIELDS', lang);
        return msg === 'MSG_COMPLETE_REQUIRED_FIELDS' ? 'Complete all required fields to continue.' : msg;
    }, [lang]);

    const getContactFieldDomId = (fieldKey: string) => `contact-${container.id}-${fieldKey}`;

    const getFieldError = (fieldKey: string, value?: unknown): string | undefined => {
        if (fieldKey === 'privacy') {
            return privacyAccepted ? undefined : validationMessages.privacy;
        }
        if (fieldKey === 'captcha') {
            return isRequired(captchaValue) && !!captchaChallenge?.captchaId ? undefined : validationMessages.captcha;
        }
        const field = fields.find((f: any) => f.id === fieldKey);
        if (!field) return undefined;
        const fieldLabel = getLocalizedContactFieldText(field.label, 'label');
        const fieldValue = value ?? formData[fieldKey];
        if (field.required && !isRequired(fieldValue)) {
            const baseRequiredMessage = interpolateMessage(validationMessages.requiredNamed, fieldLabel);
            return `${baseRequiredMessage} ${completeRequiredFieldsHint}`;
        }
        return validateContactField(field, value ?? formData[fieldKey], {
            requiredNamed: validationMessages.requiredNamed,
            invalidEmail: validationMessages.invalidEmail,
        }, fieldLabel);
    };

    const shouldShowError = (fieldKey: string) => (touched[fieldKey] || submitAttempted) && !!errors[fieldKey];

    const validateAllFields = (): FieldErrors => {
        const nextErrors: FieldErrors = {};
        fields.forEach((f: any) => {
            const err = getFieldError(f.id, formData[f.id]);
            if (err) nextErrors[f.id] = err;
        });
        if (!privacyAccepted) nextErrors.privacy = validationMessages.privacy;
        if (!isRequired(captchaValue) || !captchaChallenge?.captchaId) nextErrors.captcha = validationMessages.captcha;
        return nextErrors;
    };

    const loadCaptcha = useCallback(async (previousCaptchaId?: string) => {
        setCaptchaLoading(true);
        setCaptchaError(null);
        try {
            const challenge = await requestContactCaptcha(previousCaptchaId);
            setCaptchaChallenge(challenge);
        } catch (error) {
            setCaptchaChallenge(null);
            setCaptchaError(error instanceof Error ? error.message : 'Unable to load CAPTCHA.');
        } finally {
            setCaptchaLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadCaptcha();
    }, [loadCaptcha]);

    const handleRefreshCaptcha = () => {
        void loadCaptcha(captchaChallenge?.captchaId);
        setCaptchaValue('');
        setErrors(prev => ({ ...prev, captcha: undefined }));
    };

    const handleInputChange = (id: string, value: any) => {
        setFormData(prev => ({ ...prev, [id]: value }));
        if (submitError) setSubmitError(null);
        if (touched[id] || submitAttempted) {
            const err = getFieldError(id, value);
            setErrors(prev => ({ ...prev, [id]: err }));
        } else if (errors[id]) {
            setErrors(prev => ({ ...prev, [id]: undefined }));
        }
    };

    const handleFieldBlur = (fieldKey: string) => {
        setTouched(prev => ({ ...prev, [fieldKey]: true }));
        const err = getFieldError(fieldKey);
        setErrors(prev => ({ ...prev, [fieldKey]: err }));
    };

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSubmitAttempted(true);
        setSubmitError(null);

        const newErrors = validateAllFields();
        const hasError = Object.values(newErrors).some(Boolean);

        if (hasError) {
            setErrors(newErrors);
            setStatus('ERROR');
            const firstInvalidKey = fields.find((f: any) => newErrors[f.id])?.id
                || (newErrors.privacy ? 'privacy' : undefined)
                || (newErrors.captcha ? 'captcha' : undefined);
            if (firstInvalidKey) {
                requestAnimationFrame(() => {
                    document.getElementById(getContactFieldDomId(firstInvalidKey))?.focus();
                });
            }
            return;
        }
        // Try to find email field for primary identifier
        const emailField = fields.find((f: any) => f.type === 'email' || f.label.toLowerCase().includes('email'));
        const userEmail = emailField ? formData[emailField.id] : undefined;

        // Find Names for display if possible (best effort)
        const firstNameField = fields.find((f: any) => f.label.toLowerCase().includes('first name'));
        const lastNameField = fields.find((f: any) => f.label.toLowerCase().includes('last name'));

        // 3. Construct Payload (DYNAMICALLY COLLECT ALL FIELDS)
        const query: ContactQuery = {
            id: `cq_${Date.now()}`,
            pageId: container.pageId,
            pageName: pageTitle || 'Unknown Page',
            containerId: container.id,
            created: new Date().toISOString(),
            status: 'New',
            email: userEmail,
            firstName: firstNameField ? formData[firstNameField.id] : undefined,
            lastName: lastNameField ? formData[lastNameField.id] : undefined,
            smartPage: pageTitle, // Legacy support
            captchaId: captchaChallenge?.captchaId,
            captchaAnswer: captchaValue,
            website: honeypotValue,
            fields: [
                ...fields.map((f: any) => {
                    // Normalize value for string storage
                    let storedValue = formData[f.id];
                    if (Array.isArray(storedValue)) {
                        storedValue = storedValue.join(', ');
                    } else if (!storedValue) {
                        storedValue = '';
                    }

                    return {
                        id: f.id,
                        label: f.label,
                        value: String(storedValue),
                        type: f.type
                    };
                }),
                {
                    id: 'privacy_policy',
                    label: getTranslation('LBL_PRIVACY_POLICY', lang),
                    value: 'Accepted',
                    type: 'checkbox'
                }
            ]
        };

        // 4. Submit to the PHP API so CAPTCHA and anti-spam checks stay server-side.
        setStatus('LOADING');
        fetch(`${getContactApiRoot()}/ContactForm.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(query)
        }).then(async (res) => {
            const result = await res.json().catch(async () => ({ error: await res.text().catch(() => '') }));
            if (!res.ok || !result?.success) {
                throw new Error(result?.error || 'Submission failed. Please try again.');
            }

            setStatus('SUCCESS');
            setFormData({});
            setPrivacyAccepted(false);
            setCaptchaValue('');
            setHoneypotValue('');
            void loadCaptcha(captchaChallenge?.captchaId);
            setErrors({});
            setTouched({});
            setSubmitAttempted(false);
            setTimeout(() => setStatus('IDLE'), 5000);
        }).catch((err) => {
            setStatus('ERROR');
            setSubmitError(err instanceof Error ? err.message : String(err));
            setCaptchaValue('');
            setErrors(prev => ({ ...prev, captcha: validationMessages.captcha }));
            void loadCaptcha(captchaChallenge?.captchaId);
        });
    };

    const formCardRef = useRef<HTMLDivElement>(null);
    const captchaAnchorRef = useRef<HTMLDivElement>(null);
    const [overlapPx, setOverlapPx] = useState(144);

    const measureContactFormOverlap = useCallback(() => {
        if (!formCardRef.current || !captchaAnchorRef.current) return;
        const cardTop = formCardRef.current.getBoundingClientRect().top;
        const captchaTop = captchaAnchorRef.current.getBoundingClientRect().top;
        setOverlapPx(Math.max(96, Math.ceil(captchaTop - cardTop)));
    }, []);

    useLayoutEffect(() => {
        measureContactFormOverlap();
        const observer = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => measureContactFormOverlap())
            : null;
        if (formCardRef.current && observer) {
            observer.observe(formCardRef.current);
        }
        window.addEventListener('resize', measureContactFormOverlap);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', measureContactFormOverlap);
        };
    }, [fields, status, measureContactFormOverlap]);

    const contactSectionStyle = {
        '--ws-contact-overlap': `${overlapPx}px`,
        ...resolveSectionSpacingPadding(settings),
    } as CSSProperties;
    const contactHeroStyle: CSSProperties = {
        backgroundColor: resolvedBgType === 'color' ? resolvedBgColor : (resolvedBgType === 'site-color' ? 'var(--primary-color)' : 'transparent'),
        backgroundImage: resolvedBgType === 'image' && resolvedBgImage ? `url("${resolvedBgImage}")` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
    };

    return (
        <div className={`w-full relative ws-contact-form-section ${sectionSpacingClassName(settings)}`} style={contactSectionStyle}>
            {/* Top Background Area */}
            <div className="w-full ws-contact-hero relative" style={contactHeroStyle}>
                {resolvedBgType === 'image' && <div className="absolute inset-0 bg-black/50 z-0"></div>}

                {/* Heading & Intro */}
                <div className={`relative z-10 max-w-2xl mx-auto ${resolvedAlignment === 'left' ? 'text-left' : resolvedAlignment === 'right' ? 'text-right' : 'text-center'}`}>
                    {(settings.showHeader !== false) && settings.heading && (
                        <h2 className={`text-3xl ${titleTypoStyle.fontWeight ? '' : 'font-bold'} mb-[12px] ${titleColor.className || ''}`}
                            style={{ fontFamily: 'var(--font-family-secondary, sans-serif)', ...titleColor.style, ...titleTypoStyle, textTransform: headingLetterCaseCss }}>
                            {applyContactFormLetterCaseToText(getLocalizedText(settings.heading, lang), effectiveContactLetterCase)}
                        </h2>
                    )}
                    {(settings.showSubheading !== false) && settings.subheading && (
                        <p className={`mb-[20px] ${subtitleTypoStyle.fontWeight ? '' : 'font-medium'} ${subtitleColor.className || ''}`}
                            style={{ fontFamily: 'var(--font-family-base, sans-serif)', ...subtitleColor.style, ...subtitleTypoStyle, textTransform: 'none' }}>
                            {getLocalizedText(settings.subheading, lang)}
                        </p>
                    )}
                    {(settings.showDescription !== false) && settings.description && (
                        <div className={`mt-2 ${descColor.className || ''}`}
                            style={{ fontFamily: 'var(--font-family-base, sans-serif)', ...descColor.style, ...descTypoStyle, textTransform: 'none' }}>
                            {renderRichText(getLocalizedText(settings.description, lang), "", { ...descColor.style, ...descTypoStyle, textTransform: 'none' }, true)}
                        </div>
                    )}
                </div>
            </div>

            {/* Form Card Overlapping Area */}
            <div className="w-full ws-contact-form-overlap relative z-20">
                <div
                    ref={formCardRef}
                    className="ws-contact-form-width mx-auto bg-white ws-contact-form-card shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 relative"
                    style={{
                        ...contactCardRadiusStyle,
                        ['--ws-contact-card-radius' as any]: contactCardRadiusStyle.borderRadius,
                    }}
                >
                    {/* Success Message Overlay */}
                    {status === 'SUCCESS' ? (
                        <div className="absolute inset-0 z-20 bg-white flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in-95" role="status" aria-live="polite">
                            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-6 ring-8 ring-green-50">
                                <CheckCircle className="w-10 h-10" style={{ color: 'var(--status-success, #16a34a)' }} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">{getTranslation('MSG_MESSAGE_RECEIVED_TITLE', lang)}</h3>
                            <p className="text-gray-500 max-w-xs mx-auto">{getTranslation('MSG_MESSAGE_RECEIVED_DESC', lang)}</p>
                            <button
                                onClick={() => setStatus('IDLE')}
                                className="btn-secondary mt-8 transition-colors"
                            >
                                {getTranslation('BTN_SEND_ANOTHER_MESSAGE', lang)}
                            </button>
                        </div>
                    ) : null}

                    <form
                        className="space-y-4"
                        noValidate
                        onSubmit={handleSubmit}
                        aria-label={getLocalizedText(settings.heading, lang) || getTranslation('LABEL_CONTACT_US', lang)}
                    >
                        <input
                            type="text"
                            name="website"
                            value={honeypotValue}
                            onChange={(e) => setHoneypotValue(e.target.value)}
                            tabIndex={-1}
                            autoComplete="off"
                            aria-hidden="true"
                            className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden opacity-0"
                        />
                        {fields.map((f: any) => {
                            const fieldDomId = getContactFieldDomId(f.id);
                            const fieldError = shouldShowError(f.id) ? errors[f.id] : undefined;
                            const a11y = getFieldA11yProps(fieldDomId, fieldError);
                            const fieldClass = `${contactFieldInputClass(!!fieldError)}${f.type === 'textarea' ? ' resize-none h-28' : ''}`;

                            return (
                            <div key={f.id} className={`ws-form-field${fieldError ? ' ws-form-field--invalid' : ''}`}>
                                <label htmlFor={fieldDomId} className={`ws-form-field__label ${labelColor.className || ''}`} style={{ fontFamily: 'var(--font-family-base, sans-serif)', ...labelTypographyStyle }}>
                                    {getLocalizedContactFieldText(f.label, 'label')}
                                    {f.required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
                                </label>

                                {f.type === 'textarea' ? (
                                    <textarea
                                        id={a11y.id}
                                        name={f.id}
                                        className={fieldClass}
                                        placeholder={getLocalizedContactFieldText(f.placeholder || '', 'placeholder')}
                                        value={formData[f.id] || ''}
                                        onChange={(e) => handleInputChange(f.id, e.target.value)}
                                        onBlur={() => handleFieldBlur(f.id)}
                                        aria-invalid={a11y['aria-invalid']}
                                        aria-describedby={a11y['aria-describedby']}
                                        aria-required={f.required || undefined}
                                    />
                                ) : f.type === 'select' ? (
                                    <select
                                        id={a11y.id}
                                        name={f.id}
                                        className={fieldClass}
                                        value={formData[f.id] || ''}
                                        onChange={(e) => handleInputChange(f.id, e.target.value)}
                                        onBlur={() => handleFieldBlur(f.id)}
                                        aria-invalid={a11y['aria-invalid']}
                                        aria-describedby={a11y['aria-describedby']}
                                        aria-required={f.required || undefined}
                                    >
                                        <option value="" disabled>{getLocalizedContactFieldText(f.placeholder || '', 'placeholder') || getTranslation('PLACEHOLDER_SELECT_OPTION', lang)}</option>
                                        {(f.options && f.options.length > 0 ? f.options : ['Option 1', 'Option 2', 'Option 3']).map((opt: string, i: number) => (
                                            <option key={`${f.id}-opt-${i}`} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        id={a11y.id}
                                        name={f.id}
                                        className={fieldClass}
                                        type={f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : 'text'}
                                        placeholder={getLocalizedContactFieldText(f.placeholder || '', 'placeholder')}
                                        value={formData[f.id] || ''}
                                        onChange={(e) => handleInputChange(f.id, e.target.value)}
                                        onBlur={() => handleFieldBlur(f.id)}
                                        aria-invalid={a11y['aria-invalid']}
                                        aria-describedby={a11y['aria-describedby']}
                                        aria-required={f.required || undefined}
                                        autoComplete={f.type === 'email' ? 'email' : f.label?.toLowerCase().includes('first') ? 'given-name' : f.label?.toLowerCase().includes('last') ? 'family-name' : undefined}
                                    />
                                )}

                                {fieldError && a11y.errorId && (
                                    <FormFieldError id={a11y.errorId} message={fieldError} />
                                )}
                            </div>
                            );
                        })}

                        <div className={`ws-form-field${shouldShowError('privacy') ? ' ws-form-field--invalid' : ''}`}>
                            <label htmlFor={getContactFieldDomId('privacy')} className="flex items-start gap-2 cursor-pointer group">
                            <div className="relative flex items-center justify-center mt-0.5 w-4 h-4 flex-shrink-0">
                                <input
                                    type="checkbox"
                                    id={getContactFieldDomId('privacy')}
                                    className={`h-4 w-4 cursor-pointer appearance-none border focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:outline-none transition-colors rounded-sm ${privacyAccepted ? 'bg-[var(--primary-color)] border-[var(--primary-color)]' : shouldShowError('privacy') ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
                                    checked={privacyAccepted}
                                    onChange={(e) => {
                                        setPrivacyAccepted(e.target.checked);
                                        if (touched.privacy || submitAttempted) {
                                            setErrors(prev => ({ ...prev, privacy: e.target.checked ? undefined : validationMessages.privacy }));
                                        }
                                    }}
                                    onBlur={() => handleFieldBlur('privacy')}
                                    aria-invalid={shouldShowError('privacy') || undefined}
                                    aria-describedby={shouldShowError('privacy') ? `${getContactFieldDomId('privacy')}-error` : undefined}
                                    aria-required="true"
                                />
                                {privacyAccepted && (
                                    <Check className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-white" />
                                )}
                            </div>
                            <span className={`text-sm text-gray-600 leading-snug select-none group-hover:text-gray-800 ${labelColor.className || ''}`} style={{ fontFamily: 'var(--font-family-base, sans-serif)', ...labelTypographyStyle }}>
                                {getTranslation('LABEL_PRIVACY_POLICY_CONSENT', lang)}
                            </span>
                        </label>
                        {shouldShowError('privacy') && errors.privacy && (
                            <FormFieldError id={`${getContactFieldDomId('privacy')}-error`} message={errors.privacy} />
                        )}
                        </div>

                        <div className={`ws-form-field${shouldShowError('captcha') ? ' ws-form-field--invalid' : ''}`} ref={captchaAnchorRef}>
                            <label htmlFor={getContactFieldDomId('captcha')} className={`ws-form-field__label ${labelColor.className || ''}`} style={{ fontFamily: 'var(--font-family-base, sans-serif)', ...labelTypographyStyle }}>
                                {getTranslation('LABEL_CAPTCHA', lang)}
                                <button
                                    type="button"
                                    onClick={handleRefreshCaptcha}
                                    disabled={captchaLoading}
                                    className="inline-flex items-center ml-2 text-[var(--link-color)] hover:text-[var(--link-hover-color)] transition-colors"
                                    title={getTranslation('BTN_REFRESH_CAPTCHA', lang)}
                                    aria-label={getTranslation('BTN_REFRESH_CAPTCHA', lang)}
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                            </label>
                            <div className="mb-2 flex items-center gap-3">
                                {captchaChallenge?.image ? (
                                    <img
                                        src={captchaChallenge.image}
                                        alt="CAPTCHA challenge"
                                        className="h-[58px] w-[180px] rounded-sm border border-gray-200 bg-white"
                                        draggable={false}
                                    />
                                ) : (
                                    <div className="flex h-[58px] w-[180px] items-center justify-center rounded-sm border border-gray-200 bg-gray-50 text-xs text-gray-500" role="status" aria-live="polite">
                                        {captchaLoading ? 'Loading CAPTCHA...' : 'CAPTCHA unavailable'}
                                    </div>
                                )}
                            </div>
                            <input
                                id={getContactFieldDomId('captcha')}
                                name="captcha"
                                className={contactFieldInputClass(!!shouldShowError('captcha'))}
                                placeholder={getTranslation('PLACEHOLDER_ENTER_CAPTCHA', lang)}
                                value={captchaValue}
                                onChange={(e) => {
                                    setCaptchaValue(e.target.value);
                                    if (touched.captcha || submitAttempted) {
                                        const err = isRequired(e.target.value) && !!captchaChallenge?.captchaId ? undefined : validationMessages.captcha;
                                        setErrors(prev => ({ ...prev, captcha: err }));
                                    }
                                }}
                                onBlur={() => handleFieldBlur('captcha')}
                                aria-invalid={shouldShowError('captcha') || undefined}
                                aria-describedby={shouldShowError('captcha') ? `${getContactFieldDomId('captcha')}-error` : undefined}
                                aria-required="true"
                                autoComplete="off"
                            />
                            {captchaError && (
                                <span role="alert" className="mt-1 block text-xs text-red-600">{captchaError}</span>
                            )}
                            {shouldShowError('captcha') && errors.captcha && (
                                <FormFieldError id={`${getContactFieldDomId('captcha')}-error`} message={errors.captcha} />
                            )}
                        </div>

                        {submitError && (
                            <span role="alert" aria-live="assertive" className="ws-form-submit-error">{submitError}</span>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'LOADING'}
                            aria-busy={status === 'LOADING'}
                            className={`w-full active:scale-[0.98] mt-6 transition-all btn-primary py-3 text-sm font-semibold tracking-wide ${status === 'LOADING' ? 'opacity-70 cursor-wait' : ''}`}
                            style={{ fontFamily: 'var(--font-family-base, sans-serif)' }}
                        >
                            {status === 'LOADING'
                                ? getTranslation('MSG_SENDING', lang)
                                : getLocalizedText(settings.buttonText || getTranslation('LABEL_SEND_MESSAGE', lang), lang)}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// --- RENDERER 5: TABLE VIEW ---
const TableRenderer = ({ container, lang }: ComponentRendererProps) => {
    const { settings, content } = container;
    const sourceList = settings.sourceList;
    const selectedColumns = settings.selectedColumns || [];

    const [items, setItems] = useState<any[]>([]);
    const [fields, setFields] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // State for global search, column filters, sorting, and detail modal
    const [searchQuery, setSearchQuery] = useState('');
    const [colFilters, setColFilters] = useState<Record<string, string>>({});
    const [sortState, setSortState] = useState<{ columnId: string | null, direction: 'asc' | 'desc' | null }>({ columnId: null, direction: null });
    const [detailItem, setDetailItem] = useState<any | null>(null);

    const loadData = async () => {
        if (!sourceList) return;
        setLoading(true);
        try {
            const [_items, _fields] = await Promise.all([
                getListItems(sourceList),
                getListFields(sourceList)
            ]);
            setItems(_items || []);
            setFields(_fields || []);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [sourceList, settings.lastUpdated]);

    // Handle column filter change
    const handleFilterChange = (colId: string, value: string) => {
        setColFilters(prev => ({ ...prev, [colId]: value }));
    };

    // Handle sort toggle
    const handleSort = (key: string) => {
        setSortState(current => {
            if (current.columnId !== key) return { columnId: key, direction: 'asc' };
            if (current.direction === 'asc') return { columnId: key, direction: 'desc' };
            return { columnId: null, direction: null };
        });
    };

    const handleAction = (row: any, colId: string, config: any) => {
        if (!config || config.action === 'none') return;
        if (config.action === 'modal') {
            setDetailItem(row);
        } else if (config.action === 'link') {
            const val = row[colId];
            const url = typeof val === 'object' ? (val.Url || val) : val;
            if (url && typeof url === 'string') {
                window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
            }
        }
    };

    const displayFields = selectedColumns.map((id: string) => fields.find(f => f.InternalName === id)).filter(Boolean);

    const processedRows = useMemo(() => {
        let result = [...items];

        // 1. Column Filters
        Object.keys(colFilters).forEach((colId: string) => {
            const term = colFilters[colId].toLowerCase();
            if (term) {
                result = result.filter((row: any) => {
                    const val = row[colId];
                    const strVal = typeof val === 'object' ? (val.Description || val.Url || JSON.stringify(val)) : String(val || '');
                    return strVal.toLowerCase().includes(term);
                });
            }
        });

        // 2. Global Search
        if (settings.enableGlobalSearch && searchQuery) {
            const term = searchQuery.toLowerCase();
            result = result.filter((row: any) =>
                selectedColumns.some((colId: string) => {
                    const val = row[colId];
                    const strVal = typeof val === 'object' ? (val.Description || val.Url || JSON.stringify(val)) : String(val || '');
                    return strVal.toLowerCase().includes(term);
                })
            );
        }

        // 3. Sort
        if (sortState.columnId && sortState.direction) {
            result.sort((a, b) => {
                const valA = a[sortState.columnId!] || '';
                const valB = b[sortState.columnId!] || '';

                // Handle numbers correctly (e.g. "001", "002")
                const numA = parseFloat(String(valA));
                const numB = parseFloat(String(valB));

                if (!isNaN(numA) && !isNaN(numB)) {
                    return sortState.direction === 'asc' ? numA - numB : numB - numA;
                }

                const strA = String(valA).toLowerCase();
                const strB = String(valB).toLowerCase();
                if (strA < strB) return sortState.direction === 'asc' ? -1 : 1;
                if (strA > strB) return sortState.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [items, colFilters, searchQuery, sortState, settings.enableGlobalSearch, selectedColumns]);

    const titleColor = resolveColor(settings.titleColorType || settings.titleColor, settings.titleCustomColor, 'text-inherit', '--heading-h2-color');
    const contentColor = resolveColor(settings.contentColorType, settings.contentCustomColor, 'text-gray-600');
    const alignment = settings.alignment || 'left';
    const contentAlign = settings.contentAlignment || 'left';

    return (
        <div
            className={`ws-page-width animate-in fade-in duration-700 ${sectionSpacingClassName(settings)}`}
            style={resolveSectionSpacingPadding(settings, { top: '4rem', bottom: '4rem' })}
        >
            <div className={`mb-12 flex flex-col ${alignment === 'center' ? 'items-center' : (alignment === 'right' ? 'items-end' : 'items-start')}`}>
                <h2 className={`font-bold mb-4 tracking-tight ${titleColor.className || ''} ${alignment === 'center' ? 'text-center' : (alignment === 'right' ? 'text-right' : 'text-left')}`}
                    style={{
                        ...titleColor.style,
                        color: titleColor.style?.color || '#157a44',
                        fontWeight: settings.titleFontWeight ? Number(settings.titleFontWeight) : 700,
                        fontSize: settings.titleFontSize ? (String(settings.titleFontSize).endsWith('px') ? settings.titleFontSize : `${settings.titleFontSize}px`) : '42px',
                        '--font-size-h2': settings.titleFontSize ? (String(settings.titleFontSize).endsWith('px') ? settings.titleFontSize : `${settings.titleFontSize}px`) : '42px',
                        lineHeight: settings.titleLineHeight ? toPxLineHeight(settings.titleLineHeight) : '1.2'
                    } as any}>
                    {getLocalizedText(content.title, lang) || getLocalizedText(settings.title, lang) || (typeof settings.title === 'string' ? settings.title : '')}
                </h2>

                {(getLocalizedText(content.subtitle, lang) || getLocalizedText(settings.subheading, lang)) && (
                    <p className={`text-lg mb-4 ${alignment === 'center' ? `text-center ${WS_CENTERED_SUBHEADING_CLASS}` : 'w-full'} ${alignment === 'right' ? 'text-right' : (alignment === 'center' ? 'text-center' : 'text-left')}`}
                        style={{
                            fontWeight: settings.subtitleFontWeight ? Number(settings.subtitleFontWeight) : 'inherit',
                            fontSize: settings.subtitleFontSize ? (String(settings.subtitleFontSize).endsWith('px') ? settings.subtitleFontSize : `${settings.subtitleFontSize}px`) : '18px',
                            color: resolveColor(settings.subtitleColorType || settings.subtitleColor, settings.subtitleCustomColor).style?.color || '#666666',
                            lineHeight: settings.subtitleLineHeight ? toPxLineHeight(settings.subtitleLineHeight) : undefined
                        }}>
                        {getLocalizedText(content.subtitle, lang) || getLocalizedText(settings.subheading, lang)}
                    </p>
                )}

                {(getLocalizedText(content.description, lang) || getLocalizedText(settings.description, lang)) && (
                    <div className={`jodit-wysiwyg text-base mb-8 w-full ${alignment === 'center' ? 'mx-auto text-center' : (alignment === 'right' ? 'ml-auto text-right' : 'text-left')}`}
                        style={{
                            fontSize: settings.descriptionFontSize ? (String(settings.descriptionFontSize).endsWith('px') ? settings.descriptionFontSize : `${settings.descriptionFontSize}px`) : '16px',
                            color: resolveColor(settings.descColorType || settings.descColor, settings.descCustomColor).style?.color || '#555555',
                            lineHeight: settings.descLineHeight ? toPxLineHeight(settings.descLineHeight) : undefined
                        }}
                        dangerouslySetInnerHTML={{ __html: ensureLinksOpenInNewTab(getLocalizedText(content.description, lang) || getLocalizedText(settings.description, lang)) }}
                    />
                )}

                {(settings.enableGlobalSearch || settings.showTableTitleBar) && (
                    <div
                        className={`transition-all duration-300 mb-0 ${settings.headerBarWidth === 'table' ? 'w-full' : 'w-full relative'}`}
                        style={{
                            backgroundColor: settings.headerBarBgColor || (settings.enableGlobalSearch && !settings.showTableTitleBar ? (settings.searchBgColor || '#ededed') : '#157a44'),
                        }}
                    >
                        <div className={`${settings.headerBarWidth === 'table' ? 'w-full' : 'ws-page-width'}`}>
                            <div className="ws-table-title-row items-stretch min-h-[48px] font-bold">
                                {settings.showTableTitleBar && (
                                    <div
                                        className="ws-table-title-side flex items-center px-6 py-3 font-bold tracking-wide flex-grow truncate"
                                        style={{
                                            color: settings.headerBarTextColor || '#ffffff',
                                            fontFamily: 'var(--font-family-secondary, sans-serif)',
                                            fontSize: settings.headerBarFontSize ? (String(settings.headerBarFontSize).endsWith('px') ? settings.headerBarFontSize : `${settings.headerBarFontSize}px`) : '18px'
                                        }}
                                    >
                                        {getLocalizedText(content.titleBar, lang)}
                                    </div>
                                )}

                                {settings.enableGlobalSearch && (
                                    <div
                                        className={`ws-table-title-side flex items-center gap-4 p-1 overflow-hidden transition-all duration-300 ${settings.showTableTitleBar ? 'ws-table-title-side-narrow border-l border-white/20' : 'w-full'} ml-auto`}
                                        style={{
                                            backgroundColor: settings.showTableTitleBar ? 'transparent' : (settings.searchBgColor || '#ededed')
                                        }}
                                    >
                                        <div className="pl-4">
                                            <Search
                                                className="w-4 h-4"
                                                style={{ color: settings.showTableTitleBar ? (settings.headerBarTextColor || '#ffffff') : (settings.searchTextColor || '#157a44') }}
                                            />
                                        </div>
                                        <input
                                            className={`flex-1 bg-transparent border-none py-2 px-1 outline-none font-bold placeholder-gray-500/60`}
                                            style={{
                                                color: settings.showTableTitleBar ? (settings.headerBarTextColor || '#ffffff') : (settings.searchTextColor || '#333333'),
                                                fontSize: (settings.headerBarFontSize || settings.searchFontSize) ? (String(settings.headerBarFontSize || settings.searchFontSize).endsWith('px') ? (settings.headerBarFontSize || settings.searchFontSize) : `${settings.headerBarFontSize || settings.searchFontSize}px`) : '16px'
                                            }}
                                            placeholder={settings.searchPlaceholder || getTranslation('PLACEHOLDER_LOCATION_SEARCH', lang)}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery('')}
                                                className={`p-4 transition-colors ${settings.showTableTitleBar ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-red-500'}`}
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white border border-gray-100 rounded-none overflow-hidden min-h-[400px] relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
                        <RefreshCw className="w-10 h-10 text-[var(--primary-color)] animate-spin mb-4" />
                        <span className="font-bold text-gray-400 uppercase tracking-widest text-xs">Synchronizing with SharePoint</span>
                    </div>
                )}

                {!sourceList ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-none flex items-center justify-center mb-4 border border-gray-100">
                            <Info className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-gray-400 font-bold uppercase tracking-widest text-sm italic">No Data Source Configured</h3>
                    </div>
                ) : (
                    <div className="overflow-x-auto overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                        <table className="w-full text-left border-collapse relative" style={{ fontSize: settings.fontSize || '14px' }}>
                            <thead className="sticky top-0 z-20 shadow-sm">
                                <tr className="bg-white border-b border-gray-200">
                                    {displayFields.map((f: any) => {
                                        const isSorted = sortState.columnId === f.InternalName;
                                        const isAsc = isSorted && sortState.direction === 'asc';
                                        const isDesc = isSorted && sortState.direction === 'desc';
                                        const isImage = f.TypeAsString === 'URL' && (f.InternalName.toLowerCase().includes('image') || f.InternalName.toLowerCase().includes('img') || f.Title.toLowerCase().includes('bild'));

                                        return (
                                            <th key={f.InternalName} className={`p-1 py-4 align-middle ${isImage ? 'w-20' : 'w-auto'}`}>
                                                {!isImage ? (
                                                    <div className="relative flex items-center px-2">
                                                        <input
                                                            type="text"
                                                            className="w-full border border-gray-300 bg-white rounded-none py-2.5 pl-4 pr-10 text-[16px] focus:outline-none focus:ring-1 focus:ring-[#157a44] font-medium text-gray-700 placeholder-gray-400"
                                                            placeholder={f.Title}
                                                            value={colFilters[f.InternalName] || ''}
                                                            onChange={(e) => handleFilterChange(f.InternalName, e.target.value)}
                                                        />
                                                        <div
                                                            className="absolute right-6 top-0 bottom-0 flex flex-col justify-center cursor-pointer text-gray-300 hover:text-[#157a44] group"
                                                            onClick={() => handleSort(f.InternalName)}
                                                        >
                                                            <ChevronUp className={`w-3.5 h-3.5 -mb-1 ${isAsc ? 'text-[#157a44]' : 'group-hover:text-gray-400'}`} />
                                                            <ChevronDown className={`w-3.5 h-3.5 ${isDesc ? 'text-[#157a44]' : 'group-hover:text-gray-400'}`} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-full" />
                                                )}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {processedRows.map((row: any, idx: number) => (
                                    <tr key={row.Id || row.ID || idx} className="border-b border-gray-200 hover:bg-gray-50/50 transition-all duration-200">
                                        {displayFields.map((f: any) => {
                                            const config = settings.columnConfigs?.[f.InternalName] || {};
                                            const isModal = config.action === 'modal';
                                            const isLink = config.action === 'link';
                                            const clickable = isModal || isLink;

                                            return (
                                                <td
                                                    key={f.InternalName}
                                                    onClick={() => clickable && handleAction(row, f.InternalName, config)}
                                                    className={`p-4 py-3 ${contentAlign === 'center' ? 'text-center' : (contentAlign === 'right' ? 'text-right' : 'text-left')} ${clickable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                                                    style={contentColor.style}
                                                >
                                                    <div className={`flex items-center gap-4`}>
                                                        {(() => {
                                                            const val = row[f.InternalName];
                                                            if (!val) return <span className="text-gray-300 italic opacity-50">—</span>;

                                                            // 1. Image Column Handling
                                                            const isImageCol = (f.TypeAsString === 'URL' || f.TypeAsString === 'Image') && (f.InternalName.toLowerCase().includes('image') || f.InternalName.toLowerCase().includes('img') || f.Title.toLowerCase().includes('bild') || f.InternalName.toLowerCase().includes('logo'));
                                                            if (isImageCol) {
                                                                const url = val.Url || val;
                                                                return (
                                                                    <div className="flex-shrink-0 flex justify-center" style={{ width: '70px', height: '70px' }}>
                                                                        <img
                                                                            src={url}
                                                                            alt="Logo"
                                                                            style={{
                                                                                width: '70px',
                                                                                height: '70px',
                                                                                objectFit: 'cover',
                                                                                borderRadius: '50%',
                                                                                display: 'block'
                                                                            }}
                                                                            className="border border-gray-100 shadow-sm bg-white"
                                                                        />
                                                                    </div>
                                                                );
                                                            }

                                                            // 2. Link Column Handling (or explicit Link Action)
                                                            const isUrlField = f.TypeAsString === 'URL';
                                                            if (isUrlField) {
                                                                const url = val.Url || val;
                                                                const desc = val.Description || url;
                                                                return (
                                                                    <a
                                                                        href={url.startsWith('http') ? url : `https://${url}`}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        onClick={(e) => e.stopPropagation()} // Prevent row click
                                                                        className="text-[#157a44] font-bold hover:underline transition-all text-[18px]"
                                                                    >
                                                                        {desc}
                                                                    </a>
                                                                );
                                                            }

                                                            // 3. Name Style (usually first text field that isn't an ID)
                                                            const isFirstName = f.InternalName === displayFields.find((df: any) =>
                                                                !df.InternalName.toLowerCase().includes('id') &&
                                                                !df.InternalName.toLowerCase().includes('no') &&
                                                                df.TypeAsString !== 'URL' &&
                                                                df.TypeAsString !== 'Computed' &&
                                                                df.TypeAsString !== 'DateTime'
                                                            )?.InternalName;

                                                            const highlightColor = resolveColor(settings.titleColorType, settings.titleCustomColor).style?.color || '#157a44';
                                                            const isWahlkreis = f.InternalName.toLowerCase().includes('wahlkreis') || f.Title.toLowerCase().includes('wahlkreis');

                                                            if (isFirstName) {
                                                                return <span className="font-bold text-[20px] whitespace-nowrap" style={{ color: highlightColor }}>{String(val)}</span>;
                                                            }

                                                            if (isWahlkreis) {
                                                                return <span className="font-medium text-[18px]" style={{ color: highlightColor }}>{String(val)}</span>;
                                                            }

                                                            // Default Text Styles
                                                            if (f.TypeAsString === 'DateTime') return <span className="font-medium text-gray-500 text-[16px]">{new Date(val).toLocaleDateString()}</span>;
                                                            if (typeof val === 'object') return <span className="font-medium text-gray-700 text-[16px]">{val.Title || val.Name || '...'}</span>;

                                                            return <span className={`block font-medium text-gray-700 text-[16px]`}>{String(val)}</span>;
                                                        })()}
                                                        {clickable && !f.InternalName.toLowerCase().includes('image') && !f.TypeAsString.includes('URL') && <ChevronRight className="w-4 h-4 text-[#157a44] opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                {!loading && processedRows.length === 0 && (
                                    <tr>
                                        <td colSpan={displayFields.length || 1} className="p-24 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="p-4 bg-gray-50 rounded-none mb-4">
                                                    <Search className="w-10 h-10 text-gray-200" />
                                                </div>
                                                <h4 className="font-bold text-gray-400 uppercase tracking-widest text-xs">
                                                    {getTranslation('MSG_DATA_GRID_NO_MATCHING_ITEMS', lang)}
                                                </h4>
                                                <button onClick={() => { setSearchQuery(''); setColFilters({}); }} className="mt-4 text-xs font-bold text-[var(--primary-color)] hover:underline uppercase">
                                                    {getTranslation('BTN_CLEAR_FILTERS', lang)}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* DETAIL MODAL */}
            {detailItem && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300" style={{ zIndex: getNestedPortalZFromStore(0) }}>
                    <div className="bg-white rounded-none shadow-2xl max-w-xl w-full flex flex-col overflow-hidden border border-gray-100 transform animate-in zoom-in-95 duration-300 relative">
                        {/* Close button */}
                        <button
                            onClick={() => setDetailItem(null)}
                            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 rounded-none transition-all hover:rotate-90 z-[100]"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        {/* Top Context Header */}
                        <div className="px-8 pt-10 pb-4">
                            <h4 className="text-xl text-gray-800 font-medium">
                                {(() => {
                                    const contextField = fields.find(f =>
                                        ['Wahlkreis', 'Category', 'Description'].includes(f.InternalName) ||
                                        f.Title.toLowerCase().includes('wahlkreis')
                                    );
                                    const val = contextField ? detailItem[contextField.InternalName] : null;
                                    return val ? String(val) : (lang === 'de' ? 'Details' : 'Details');
                                })()}
                            </h4>
                        </div>

                        <div className="px-8 py-4 flex gap-8">
                            {/* Profile Image (Left) */}
                            <div className="w-40 h-40 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-100 shadow-sm">
                                {(() => {
                                    const imgField = fields.find(f =>
                                        f.TypeAsString === 'URL' && (f.InternalName.toLowerCase().includes('image') || f.InternalName.toLowerCase().includes('img') || f.Title.toLowerCase().includes('bild'))
                                    );
                                    const val = imgField ? detailItem[imgField.InternalName] : null;
                                    const url = val ? (val.Url || val) : null;

                                    return url ? (
                                        <img src={url} className="w-full h-full object-cover" alt={lang === 'de' ? 'Profilbild' : 'Profile'} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <ImageIcon className="w-12 h-12 text-gray-200" />
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Info Section (Right) */}
                            <div className="flex-1 flex flex-col justify-center">
                                <h1 className="text-4xl font-bold text-[#157a44] mb-2 leading-tight">
                                    {detailItem[fields[0].InternalName] || detailItem.Title || (lang === 'de' ? 'Unbenannt' : 'Unnamed')}
                                </h1>
                                {(() => {
                                    const linkField = fields.find(f =>
                                        f.TypeAsString === 'URL' && !f.InternalName.toLowerCase().includes('image') && !f.InternalName.toLowerCase().includes('img')
                                    );
                                    const val = linkField ? detailItem[linkField.InternalName] : null;
                                    const url = val ? (val.Url || val) : null;
                                    const desc = val ? (val.Description || url) : null;

                                    return url ? (
                                        <a href={url} target="_blank" rel="noreferrer" className="text-[#157a44] hover:underline flex items-center gap-2 text-lg font-medium">
                                            {desc}
                                        </a>
                                    ) : null;
                                })()}
                            </div>
                        </div>

                        {/* Custom Footer */}
                        <div className="px-8 py-8 mt-4 flex items-center justify-between border-t border-gray-100 bg-gray-50/20">
                            <button className="text-[#157a44] text-[13px] font-medium hover:underline flex items-center gap-1.5 transition-all">
                                Falsche Informationen melden
                            </button>
                            <span className="text-[13px] text-gray-500 font-medium">
                                Alle Angaben ohne Gewähr
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// --- RENDERER 6: MAP ---
const MapRenderer = ({ container, lang, onInternalLink }: ComponentRendererProps) => {
    const { settings, content } = container;

    // When the user picks the "Europawahl" map type, render the dedicated
    // EuropawahlPortal component from the existing Map folder directly.
    if (settings.mapType === 'Europawahl') {
        const titleText = getLocalizedText(content.title, lang);
        return (
            <div
                className={`ws-page-width ${sectionSpacingClassName(settings)}`}
                style={resolveSectionSpacingPadding(settings)}
            >
                {titleText && (
                    <h2 className={`font-bold mb-4 ${resolveColor(settings.titleColor, settings.titleCustomColor, 'text-inherit', '--heading-h2-color').className || ''}`}
                        style={resolveColor(settings.titleColor, settings.titleCustomColor, 'text-inherit', '--heading-h2-color').style}>
                        {titleText}
                    </h2>
                )}
                <EuropawahlPortal />
            </div>
        );
    }

    return (
        <div
            className={`ws-page-width ${sectionSpacingClassName(settings)}`}
            style={resolveSectionSpacingPadding(settings, { top: '4rem', bottom: '4rem' })}
        >
            <h2 className={`font-bold mb-8 ${resolveColor(settings.titleColor, settings.titleCustomColor, 'text-inherit', '--heading-h2-color').className || ''}`}
                style={resolveColor(settings.titleColor, settings.titleCustomColor, 'text-inherit', '--heading-h2-color').style}>
                {getLocalizedText(content.title, lang)}
            </h2>

            <div className="bg-transparent border border-gray-200 rounded-sm overflow-hidden relative shadow-sm hover:shadow-md transition-shadow">
                {/* GeoChart Map */}
                <GeoChartMap
                    mapType={settings.mapType || 'World'}
                    selectedRegion={settings.selectedRegion}
                    selectedState={settings.selectedState}
                    height={480}
                />

                {/* Label Overlay */}
                <div className="absolute top-4 left-4 z-10 pointer-events-none">
                    <div className="bg-white/95 backdrop-blur-sm px-4 py-2 rounded-sm shadow-md border-l-4 border-[var(--primary-color)] flex items-center gap-3">
                        {settings.mapType === 'World' ? (
                            <Globe className="w-5 h-5 text-gray-500" />
                        ) : (
                            <MapPin className="w-5 h-5 text-[var(--primary-color)]" />
                        )}
                        <div>
                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5">{settings.mapType || 'World'} View</span>
                            <span className="block text-sm font-bold text-gray-800 leading-none">
                                {settings.selectedState ? settings.selectedState.split('-')[1] : (settings.selectedRegion || settings.mapType || 'World')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- RENDERER: CONTAINER SECTION ---
const ContainerSectionRenderer = ({ container, lang, onInternalLink }: ComponentRendererProps) => {
    const { themeConfig, pages } = useStore();
    const { settings, content } = container;
    const page = pages.find((p) => p.id === container.pageId);
    const bindPage = settings?.bindPageTitleDescription === true;
    const rawTitle = bindPage
        ? getLocalizedText(page?.title, lang)
        : getLocalizedText(content?.title, lang);
    const body = bindPage
        ? (page?.description || '')
        : (lang === 'en'
            ? (settings?.body || '')
            : (settings?.translations?.[lang]?.body || settings?.body || ''));

    const effectiveLetterCase = (() => {
        const raw = settings?.letterCase;
        if (raw != null && String(raw).trim() !== '') return String(raw).trim();
        return 'uppercase';
    })();
    const displayTitle = applyLetterCaseToPlainText(rawTitle, effectiveLetterCase);

    const heroTheme = getHeroThemeColors(themeConfig);
    const titleColorStyle = resolveHeroTitleColor(settings, undefined, heroTheme);
    const descColorStyle = resolveHeroDescriptionColor(settings, heroTheme);
    const titleTypoStyle = heroTypographyToStyle(resolveHeroTypography(settings, 'title', themeConfig), '--font-size-h1');
    const descTypoStyle = heroTypographyToStyle(resolveHeroTypography(settings, 'description', themeConfig), '--font-size-p');

    const bgType = String(settings?.bgType || '').toLowerCase();
    const resolvedBg = (() => {
        if (bgType === 'color') return settings?.bgColor || settings?.backgroundColor || 'transparent';
        if (bgType === 'site-color' || bgType === 'site' || bgType === 'sitecolor') return 'var(--primary-color)';
        return 'transparent';
    })();

    const titleBorderColorLine = titleColorStyle.color || 'var(--primary-color)';
    const alignment = String(settings?.alignment || settings?.align || 'left').toLowerCase();
    const textAlign = alignment === 'center' ? 'center' : 'left';
    const showTitleUnderline = settings?.showTitleUnderline !== false;

    const hasCustomSpacing = hasCustomSectionSpacing(settings);
    const sectionSpacingStyle = resolveSectionSpacingPadding(settings);

    return (
        <div
            className={`w-full ${sectionSpacingClassName(settings)}`}
            style={{
                backgroundColor: 'transparent',
                ...sectionSpacingStyle,
            }}
        >
            {displayTitle && (
                <div
                    className="w-full"
                    style={{
                        backgroundColor: resolvedBg,
                        borderBottom: (resolvedBg !== 'transparent' && showTitleUnderline) ? `2px solid ${titleBorderColorLine}` : 'none'
                    }}
                >
                    <div
                        className="ws-page-width"
                        style={{
                            paddingTop: hasCustomSpacing ? '0px' : '2rem',
                            paddingBottom: hasCustomSpacing ? (body ? '1rem' : '0px') : '2rem',
                        }}
                    >
                        <h1
                            className={`${titleTypoStyle.fontWeight ? '' : 'font-bold'} tracking-wider mb-0`}
                            style={{
                                ...titleColorStyle,
                                ...titleTypoStyle,
                                borderBottom: (resolvedBg === 'transparent' && showTitleUnderline) ? `2px solid ${titleBorderColorLine}` : 'none',
                                fontFamily: inferHeroTypographyStyle(settings, 'title') === 'paragraph'
                                    ? (themeConfig['--font-family-base'] || 'inherit')
                                    : (themeConfig['--font-family-secondary'] || 'inherit'),
                                textAlign,
                                paddingBottom: (resolvedBg === 'transparent' && showTitleUnderline) ? '0.75rem' : '0',
                            } as React.CSSProperties}
                        >
                            {displayTitle}
                        </h1>
                    </div>
                </div>
            )}

            <div
                className="ws-page-width"
                style={{
                    paddingTop: hasCustomSpacing ? '0px' : '2.5rem',
                    paddingBottom: hasCustomSpacing ? '0px' : '2.5rem',
                }}
            >
                {body && (
                    <div
                        className="jodit-wysiwyg leading-relaxed"
                        style={{
                            fontFamily: themeConfig['--font-family-base'] || 'inherit',
                            ...descTypoStyle,
                            ...descColorStyle,
                            textAlign,
                        }}
                        dangerouslySetInnerHTML={{ __html: ensureLinksOpenInNewTab(body) }}
                    />
                )}
                {!displayTitle && !body && (
                    <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded">
                        <span className="text-sm font-medium">Text Template — Add content via the editor</span>
                    </div>
                )}
            </div>
        </div>
    );
};

/** Add-section tab icon — flat top edge sits on the section divider line. */
const AddSectionIcon = ({ color = '#2f5596', className = '' }: { color?: string; className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 71 21"
        fill="none"
        aria-hidden="true"
        className={className}
        style={{ color }}
    >
        <g clipPath="url(#ws-add-section-clip)">
            <path
                d="M0 0c4.15-.081 8.26.852 11.999 2.725a26.673 26.673 0 0 1 9.518 8.054C25.981 16.916 30.75 20 35.507 20c4.758 0 9.526-3.084 13.99-9.221a26.673 26.673 0 0 1 9.519-8.054A25.648 25.648 0 0 1 71.014 0H0Z"
                fill="currentColor"
            />
            <path
                d="M-.01-.5 0 .5h.995c3.732.074 7.41.983 10.78 2.672l.224-.447-.224.447a26.174 26.174 0 0 1 9.339 7.902c4.504 6.192 9.403 9.426 14.393 9.426s9.89-3.234 14.393-9.425a26.173 26.173 0 0 1 9.34-7.903A25.168 25.168 0 0 1 70.02.5h.995l.01-1a25.988 25.988 0 0 0-1.015 0H1.005A25.99 25.99 0 0 0-.01-.5Z"
                stroke="#fff"
                strokeOpacity=".3"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M34.953 5.9v4.071h-3.915v1.04h3.915v4.105h1.109V11.01h3.915V9.971h-3.915v-4.07h-1.11Z"
                fill="#fff"
            />
        </g>
        <defs>
            <clipPath id="ws-add-section-clip">
                <path fill="#fff" d="M0 0h70v21H0z" />
            </clipPath>
        </defs>
    </svg>
);

// --- MAIN WRAPPER ---
const ContainerWrapper = ({
    container,
    viewMode,
    lang,
    pageTitle,
    isMainHero,
    onInternalLink,
    onNavigateToSection,
    showAddSectionOnHover,
    onAddSection,
    themeConfig,
    onOpenDetailsPanel,
}: {
    container: any;
    viewMode: ViewMode;
    lang: LanguageCode;
    pageTitle: string;
    isMainHero?: boolean;
    onInternalLink: (e: React.MouseEvent, url: string, options?: InternalLinkOptions) => void;
    onNavigateToSection?: (pageId: string, pageSlug: string, anchor: string, containerId?: string | number) => void;
    showAddSectionOnHover?: boolean;
    onAddSection?: () => void;
    themeConfig?: Record<string, string>;
    onOpenDetailsPanel?: (item: any) => void;
}) => {
    const { openModal, setEditingContainerId } = useStore();

    const handleEdit = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingContainerId(container.id);
        if (container.type === ContainerType.SLIDER && isImageTextSliderContainer(container.settings)) {
            openModal(ModalType.SLIDER_MANAGER);
            return;
        }
        openModal(ModalType.CONTAINER_EDITOR);
    };

    const lineColor = themeConfig?.['--add-section-line-color'] || themeConfig?.['--primary-color'] || '#2f5596';
    const lineThickness = themeConfig?.['--add-section-line-thickness'] || '2px';
    const addSectionTooltip = getTranslation('TOOLTIP_ADD_SECTION', lang);

    return (
        <div
            id={getContainerAnchor(container)}
            data-container-id={container.id}
            data-container-title={container.title}
            className={`relative group overflow-visible ${viewMode === ViewMode.EDIT ? 'cursor-pointer' : ''}`}
        >
            {viewMode === ViewMode.EDIT && (
                <div className="absolute top-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => handleEdit(e)}
                        className="p-2 rounded-none shadow-md hover:opacity-90 transition-all"
                        style={{
                            backgroundColor: 'var(--edit-icon-bg)',
                            color: 'var(--edit-icon-color)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--edit-icon-hover-bg)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--edit-icon-bg)')}
                    >
                        <Pencil className="w-5 h-5" style={{ color: 'var(--edit-icon-color)' }} />
                    </button>
                </div>
            )}

            {/* Strict Rendering based on Type */}
            {container.type === ContainerType.HERO && <HeaderRenderer container={container} lang={lang} isMainHero={isMainHero} onInternalLink={onInternalLink} onNavigateToSection={onNavigateToSection} />}
            {container.type === ContainerType.SLIDER && (
                <SliderRenderer container={container} lang={lang} onInternalLink={onInternalLink} />
            )}
            {container.type === ContainerType.CARD_GRID && <DataGridRenderer container={container} lang={lang} onInternalLink={onInternalLink} onNavigateToSection={onNavigateToSection} onOpenDetailsPanel={onOpenDetailsPanel} />}
            {container.type === ContainerType.CONTACT_FORM && <ContactFormRenderer container={container} lang={lang} pageTitle={pageTitle} onInternalLink={onInternalLink} />}
            {container.type === ContainerType.TABLE && <TableRenderer container={container} lang={lang} onInternalLink={onInternalLink} />}
            {container.type === ContainerType.MAP && <MapRenderer container={container} lang={lang} onInternalLink={onInternalLink} />}
            {container.type === ContainerType.CONTAINER_SECTION && <ContainerSectionRenderer container={container} lang={lang} onInternalLink={onInternalLink} />}

            {/* Fallback for other types if any (e.g. IMAGE_TEXT) */}
            {container.type === ContainerType.IMAGE_TEXT && (
                <div className="p-20 text-center text-gray-400 border-2 border-dashed">Standard Image Text Section (Default)</div>
            )}

            {showAddSectionOnHover && onAddSection && (
                <div
                    className="ws-add-section-divider opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ height: '1.575rem', ['--ws-add-section-line-offset' as string]: lineThickness }}
                >
                    <div
                        className="ws-add-section-divider__line"
                        style={{ height: lineThickness, backgroundColor: lineColor }}
                    />
                    <button
                        type="button"
                        aria-label={addSectionTooltip}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onAddSection();
                        }}
                        className="ws-add-section-btn transition-opacity hover:opacity-75"
                    >
                        <span className="ws-add-section-tooltip" role="tooltip">
                            {addSectionTooltip}
                        </span>
                        <AddSectionIcon color={lineColor} />
                    </button>
                </div>
            )}

        </div>
    );
};

// --- RECURSIVE NAV ITEMS ---
interface TopNavItemProps {
    item: NavItem;
    allItems: NavItem[];
    onNavigate: (pageId: string) => void;
    onNavigateToSection: (pageId: string, pageSlug: string, anchor: string, containerId?: string | number) => void;
    activeContainerId?: string | null;
    isFirst?: boolean;
}

const TopNavDropdownItem: React.FC<TopNavItemProps> = ({ item, allItems, onNavigate, onNavigateToSection, activeContainerId, isFirst }) => {
    const { currentLanguage, pages, currentPageId, siteConfig } = useStore();
    const children = allItems.filter(n => n.parentId === item.id && n.isVisible).sort((a, b) => a.order - b.order);
    const hasChildren = children.length > 0;

    const resolveUrl = () => {
        if (item.type === 'External') return item.url || '#';
        const target = pages.find(p => String(p.id) === String(item.pageId));
        if (!target) return '#';

        if (item.type === 'Container' && item.containerId) {
            const targetContainer = target.containers.find(c => String(c.id) === String(item.containerId));
            const title = targetContainer?.title || '';
            const anchor = title ? title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/-+/g, '-') : `container-${item.containerId}`;
            return buildPreviewSectionHash(target.slug || '/', anchor);
        }
        return buildPreviewSectionHash(target.slug || '/');
    };

    const handleClick = (e: React.MouseEvent) => {
        if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
            if (item.type === 'Container' && item.containerId && item.pageId) {
                e.preventDefault();
                const target = pages.find(p => String(p.id) === String(item.pageId));
                if (!target) return;
                const targetContainer = target.containers.find(c => String(c.id) === String(item.containerId));
                const title = targetContainer?.title || '';
                const anchor = title
                    ? title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/-+/g, '-')
                    : `container-${item.containerId}`;
                onNavigateToSection(item.pageId, target.slug || '/', anchor, item.containerId);
            } else if (item.type === 'Page' && item.pageId) {
                e.preventDefault();
                onNavigate(item.pageId);
            }
        }
    };

    const localizedTitle = getItemTranslation(item, currentLanguage, 'title');
    // Scroll-spy: Container nav items activate only when their section is in view.
    // Page nav items activate when navigated to that page (only if no scroll-spy applies).
    const isActive = item.type === 'Container'
        ? activeContainerId === String(item.containerId)
        : (item.type === 'Page' && String(item.pageId) === String(currentPageId) && !activeContainerId);

    return (
        <div className="ws-top-nav-item relative group/menuitem h-full">
            <a
                href={resolveUrl()}
                onClick={handleClick}
                target={item.openInNewTab ? '_blank' : '_self'}
                className={`nav-link top-nav-link text-sm tracking-wide transition-all h-full pr-4 ${isFirst && ((siteConfig.navPosition === 'below_logo' && siteConfig.navAlignment === 'left') || siteConfig.navPosition === 'near_logo') ? 'pl-0' : 'pl-4'}${isActive ? ' active' : ''}`}
            >
                <span>{localizedTitle}</span>
                {hasChildren && <ChevronDown className="w-5 h-5 opacity-50 flex-shrink-0" />}
            </a>

            {/* Dropdown Menu */}
            {hasChildren && (
                <div className="ws-top-nav-dropdown absolute top-full left-0 z-50 min-w-[200px]">
                    <div className="bg-white border border-gray-200 shadow-xl rounded-none py-2">
                        {children.map(child => (
                            <TopNavSubItem key={child.id} item={child} allItems={allItems} onNavigate={onNavigate} onNavigateToSection={onNavigateToSection} activeContainerId={activeContainerId} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const TopNavSubItem: React.FC<TopNavItemProps> = ({ item, allItems, onNavigate, onNavigateToSection, activeContainerId }) => {
    const { currentLanguage, pages, currentPageId } = useStore();
    const children = allItems.filter(n => n.parentId === item.id && n.isVisible).sort((a, b) => a.order - b.order);
    const hasChildren = children.length > 0;
    const [isHovered, setIsHovered] = useState(false);

    const resolveUrl = () => {
        if (item.type === 'External') return item.url || '#';
        const target = pages.find(p => String(p.id) === String(item.pageId));
        if (!target) return '#';

        if (item.type === 'Container' && item.containerId) {
            const targetContainer = target.containers.find(c => String(c.id) === String(item.containerId));
            const title = targetContainer?.title || '';
            const anchor = title ? title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/-+/g, '-') : `container-${item.containerId}`;
            return buildPreviewSectionHash(target.slug || '/', anchor);
        }
        return buildPreviewSectionHash(target.slug || '/');
    };

    const handleClick = (e: React.MouseEvent) => {
        if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
            if (item.type === 'Container' && item.containerId && item.pageId) {
                e.preventDefault();
                const target = pages.find(p => String(p.id) === String(item.pageId));
                if (!target) return;
                const targetContainer = target.containers.find(c => String(c.id) === String(item.containerId));
                const title = targetContainer?.title || '';
                const anchor = title
                    ? title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/-+/g, '-')
                    : `container-${item.containerId}`;
                onNavigateToSection(item.pageId, target.slug || '/', anchor, item.containerId);
            } else if (item.type === 'Page' && item.pageId) {
                e.preventDefault();
                onNavigate(item.pageId);
            }
        }
    };

    const localizedTitle = getItemTranslation(item, currentLanguage, 'title');
    const isActive = item.type === 'Container'
        ? activeContainerId === String(item.containerId)
        : (item.type === 'Page' && String(item.pageId) === String(currentPageId) && !activeContainerId);

    return (
        <div
            className="relative transition-all submenu-item w-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <a
                href={resolveUrl()}
                onClick={handleClick}
                target={item.openInNewTab ? '_blank' : '_self'}
                className={`nav-link submenu-link text-sm flex justify-between items-center transition-all px-4 py-2 w-full${isActive ? ' active' : ''}`}
            >
                {localizedTitle}
                {hasChildren && <ChevronRight className="w-5 h-5 opacity-50" />}
            </a>

            {/* Flyout Menu — only shown when THIS item is hovered */}
            {hasChildren && isHovered && (
                <div className="absolute top-0 z-50 min-w-[200px] submenu-flyout" style={{ right: '100%', left: 'auto' }}>
                    <div className="bg-white border border-gray-200 shadow-xl rounded-none py-2">
                        {children.map(child => (
                            <TopNavSubItem key={child.id} item={child} allItems={allItems} onNavigate={onNavigate} onNavigateToSection={onNavigateToSection} activeContainerId={activeContainerId} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

interface MobileTopNavItemProps extends TopNavItemProps {
    depth?: number;
    onCloseMenu: () => void;
}

const MobileTopNavItem: React.FC<MobileTopNavItemProps> = ({
    item,
    allItems,
    onNavigate,
    onNavigateToSection,
    activeContainerId,
    depth = 0,
    onCloseMenu,
}) => {
    const { currentLanguage, pages, currentPageId } = useStore();
    const [expanded, setExpanded] = useState(false);
    const children = allItems.filter(n => n.parentId === item.id && n.isVisible).sort((a, b) => a.order - b.order);
    const hasChildren = children.length > 0;

    const resolveUrl = () => {
        if (item.type === 'External') return item.url || '#';
        const target = pages.find(p => String(p.id) === String(item.pageId));
        if (!target) return '#';

        if (item.type === 'Container' && item.containerId) {
            const targetContainer = target.containers.find(c => String(c.id) === String(item.containerId));
            const title = targetContainer?.title || '';
            const anchor = title ? title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/-+/g, '-') : `container-${item.containerId}`;
            return buildPreviewSectionHash(target.slug || '/', anchor);
        }
        return buildPreviewSectionHash(target.slug || '/');
    };

    const handleClick = (e: React.MouseEvent) => {
        if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
            if (item.type === 'Container' && item.containerId && item.pageId) {
                e.preventDefault();
                const target = pages.find(p => String(p.id) === String(item.pageId));
                if (!target) return;
                const targetContainer = target.containers.find(c => String(c.id) === String(item.containerId));
                const title = targetContainer?.title || '';
                const anchor = title
                    ? title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/-+/g, '-')
                    : `container-${item.containerId}`;
                onNavigateToSection(item.pageId, target.slug || '/', anchor, item.containerId);
                onCloseMenu();
            } else if (item.type === 'Page' && item.pageId) {
                e.preventDefault();
                onNavigate(item.pageId);
                onCloseMenu();
            } else if (item.type === 'External') {
                onCloseMenu();
            }
        }
    };

    const localizedTitle = getItemTranslation(item, currentLanguage, 'title');
    const isActive = item.type === 'Container'
        ? activeContainerId === String(item.containerId)
        : (item.type === 'Page' && String(item.pageId) === String(currentPageId) && !activeContainerId);

    return (
        <div className="border-b border-gray-100 last:border-b-0">
            <div
                className="flex items-center"
                style={{ paddingLeft: `${12 + depth * 16}px` }}
            >
                <a
                    href={resolveUrl()}
                    onClick={handleClick}
                    target={item.openInNewTab ? '_blank' : '_self'}
                    className={`nav-link top-nav-link flex-1 py-3 pr-2 text-sm tracking-wide transition-colors${isActive ? ' active' : ''}`}
                >
                    {localizedTitle}
                </a>
                {hasChildren && (
                    <button
                        type="button"
                        className="p-3 text-gray-500 hover:text-[var(--primary-color)] shrink-0"
                        aria-expanded={expanded}
                        aria-label={expanded ? 'Collapse submenu' : 'Expand submenu'}
                        onClick={() => setExpanded(prev => !prev)}
                    >
                        <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>
            {hasChildren && expanded && (
                <div>
                    {children.map(child => (
                        <MobileTopNavItem
                            key={child.id}
                            item={child}
                            allItems={allItems}
                            onNavigate={onNavigate}
                            onNavigateToSection={onNavigateToSection}
                            activeContainerId={activeContainerId}
                            depth={depth + 1}
                            onCloseMenu={onCloseMenu}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const LanguageSelector = ({ variant = 'header' }: { variant?: 'header' | 'drawer' }) => {
    const { currentLanguage, setLanguage, siteConfig, themeConfig } = useStore();
    const languages = getEnabledSiteLanguages(siteConfig);
    const [isOpen, setIsOpen] = useState(false);

    if (!shouldShowLanguageSelector(languages)) {
        return null;
    }

    const getLangLabel = (code: LanguageCode) => LANGUAGE_DISPLAY_NAMES[code] || String(code).toUpperCase();

    const headerBg = siteConfig.headerTopBackgroundColor || themeConfig['--header-bg'] || '#ffffff';
    const isLightBg = !headerBg || headerBg === '#ffffff' || headerBg === 'white' || headerBg === '#fff' || headerBg === 'transparent';

    const baseClass = variant === 'drawer'
        ? 'bg-white hover:bg-gray-50 text-gray-700 hover:text-[var(--primary-color)] border border-gray-200'
        : isLightBg
            ? 'bg-white/10 hover:bg-white/20 text-gray-700 hover:text-[var(--primary-color)] border border-gray-100'
            : 'bg-white/10 hover:bg-white/20 text-white border-white/20';

    return (
        <div className={`relative ws-lang-selector ws-lang-selector--${variant}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-sm transition-all duration-300
                    text-[10px] font-bold uppercase tracking-[0.1em]
                    ${isOpen ? 'ws-lang-selector-trigger--open shadow-lg' : baseClass}
                `}
            >
                {String(currentLanguage).toUpperCase()}
                <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 bg-transparent" style={{ zIndex: getNestedPortalZFromStore(10) }} onClick={() => setIsOpen(false)} />
                    <div
                        className="absolute right-0 top-full mt-2 w-max max-w-[calc(100vw-2rem)] overflow-hidden bg-white/95 backdrop-blur-md border border-gray-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] p-1.5 rounded-sm"
                        style={{ zIndex: getNestedPortalZFromStore(11) }}
                    >
                        <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold px-3 py-2 border-b border-gray-100 mb-1 whitespace-nowrap">
                            Select Language
                        </div>
                        {languages.map((lang) => (
                            <button
                                key={lang}
                                type="button"
                                onClick={() => {
                                    setLanguage(lang);
                                    setIsOpen(false);
                                }}
                                className={`
                                    w-full text-left px-3 py-2.5 text-xs font-semibold rounded-sm transition-all flex items-center justify-between
                                    ${currentLanguage === lang
                                        ? 'bg-[var(--primary-color)]/5 text-[var(--primary-color)]'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                                `}
                            >
                                <span>{getLangLabel(lang)}</span>
                                {currentLanguage === lang && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-color)] animate-pulse" />
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const toCssSize = (val: string | undefined): string => {
    if (!val) return 'inherit';
    const trimmed = val.trim();
    if (!trimmed) return 'inherit';
    if (/(px|rem|em|%)$/i.test(trimmed)) return trimmed;
    if (/^-?\d*\.?\d+$/.test(trimmed)) return `${trimmed}px`;
    return trimmed;
};

const DetailsPanel = ({
    item,
    onClose,
    currentLanguage,
    themeConfig
}: {
    item: any;
    onClose: () => void;
    currentLanguage: LanguageCode;
    themeConfig: any;
}) => {
    const [copySuccess, setCopySuccess] = useState(false);

    const images = item.images && item.images.length > 0
        ? item.images
        : (item.img || item.image || item.imageUrl ? [item.img || item.image || item.imageUrl] : []);

    const titleColor = themeConfig?.['--primary-color'] || '#006442';

    const formatDate = (dateStr: any) => {
        if (!dateStr) return '';
        const parsed = moment(dateStr);
        if (!parsed.isValid()) return String(dateStr);
        return parsed.locale(currentLanguage).format('DD MMM YYYY');
    };

    const handleCopyLink = () => {
        const shareUrl = window.location.href;
        navigator.clipboard.writeText(shareUrl).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    const handleShareFacebook = () => {
        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleShareTwitter = () => {
        const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(item.title)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleShareLinkedIn = () => {
        const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const dateVal = item.date || item.originalItem?.startDate || item.originalItem?.publishDate || item.publishDate;

    return createPortal(
        <>
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
                onClick={onClose}
                style={{ zIndex: getNestedPortalZFromStore(0) }}
            />
            <div
                className="fixed top-0 right-0 h-full ws-details-panel bg-white shadow-2xl overflow-y-auto border-l border-gray-200 flex flex-col p-6 animate-in slide-in-from-right duration-300 animate-out slide-out-to-right"
                style={{
                    fontFamily: themeConfig?.['--font-family-base'] || 'var(--font-family-base, sans-serif)',
                    zIndex: getNestedPortalZFromStore(0) + 1
                }}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <IoCalendarOutline
                            className="flex-shrink-0"
                            style={{ width: 18, height: 18, color: '#808080' }}
                            aria-hidden
                        />
                        <span
                            style={{
                                color: '#999',
                                fontFamily: 'var(--font-family-secondary, sans-serif)',
                                fontSize: '16px'

                            }}
                        >
                            {formatDate(dateVal)}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold italic text-gray-800">
                            Share :
                        </span>
                        <button
                            onClick={handleShareFacebook}
                            className="text-gray-400 hover:opacity-80 transition-colors"
                            style={{ color: titleColor }}
                            title="Share on Facebook"
                        >
                            <FaFacebook className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleShareTwitter}
                            className="text-gray-400 hover:opacity-80 transition-colors"
                            style={{ color: titleColor }}
                            title="Share on Twitter"
                        >
                            <FaTwitter className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleShareLinkedIn}
                            className="text-gray-400 hover:opacity-80 transition-colors"
                            style={{ color: titleColor }}
                            title="Share on LinkedIn"
                        >
                            <FaLinkedin className="w-4 h-4" />
                        </button>
                        <div className="relative flex items-center">
                            <button
                                onClick={handleCopyLink}
                                className="text-gray-400 hover:opacity-80 transition-colors"
                                style={{ color: titleColor }}
                                title="Copy Link"
                            >
                                <FaLink className="w-4 h-4" />
                            </button>
                            {copySuccess && (
                                <span className="absolute bottom-full mb-1 right-0 bg-black text-white text-[10px] px-2 py-0.5 rounded shadow-sm whitespace-nowrap z-50">
                                    Copied!
                                </span>
                            )}
                        </div>
                        <div className="h-4 w-px bg-gray-200 mx-1" />
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-black transition-colors"
                            title="Close Panel"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <h2
                    className="text-2xl font-bold mb-6 leading-tight font-gruene"
                    style={{ color: titleColor }}
                >
                    {item.title}
                </h2>

                <div className="flex-1 text-gray-800 leading-relaxed text-sm ws-details-panel-content-wrapper">
                    {images.length > 0 && (
                        <div className="ws-details-panel-img-container">
                            <img
                                src={images[0]}
                                className="ws-details-panel-img"
                                alt=""
                            />
                        </div>
                    )}
                    <div
                        className="jodit-content text-justify"
                        dangerouslySetInnerHTML={{
                            __html: item.readMoreText || item.desc || item.description || (currentLanguage === 'de' ? 'Keine Beschreibung verfügbar.' : 'No description available.')
                        }}
                    />
                </div>
            </div>
        </>,
        document.body
    );
};

const previewNoopLink = (e: React.MouseEvent) => {
    e.preventDefault();
};

/** Renders a single container with the same components used on the live page (for template preview overlays). */
export const PreviewContainerBlock: React.FC<{
    container: any;
    lang?: LanguageCode;
    isMainHero?: boolean;
    pageTitle?: string;
}> = ({ container, lang, isMainHero, pageTitle = '' }) => {
    const { currentLanguage } = useStore();
    const effectiveLang = lang || currentLanguage;

    return (
        <>
            {container.type === ContainerType.HERO && (
                <HeaderRenderer
                    container={container}
                    lang={effectiveLang}
                    isMainHero={isMainHero}
                    onInternalLink={previewNoopLink}
                />
            )}
            {container.type === ContainerType.SLIDER && (
                <SliderRenderer container={container} lang={effectiveLang} onInternalLink={previewNoopLink} />
            )}
            {container.type === ContainerType.CARD_GRID && (
                <DataGridRenderer
                    container={container}
                    lang={effectiveLang}
                    onInternalLink={previewNoopLink}
                />
            )}
            {container.type === ContainerType.CONTACT_FORM && (
                <ContactFormRenderer
                    container={container}
                    lang={effectiveLang}
                    pageTitle={pageTitle}
                    onInternalLink={previewNoopLink}
                />
            )}
            {container.type === ContainerType.TABLE && (
                <TableRenderer container={container} lang={effectiveLang} onInternalLink={previewNoopLink} />
            )}
            {container.type === ContainerType.MAP && (
                <MapRenderer container={container} lang={effectiveLang} onInternalLink={previewNoopLink} />
            )}
            {container.type === ContainerType.CONTAINER_SECTION && (
                <ContainerSectionRenderer container={container} lang={effectiveLang} onInternalLink={previewNoopLink} />
            )}
            {container.type === ContainerType.IMAGE_TEXT && (
                <div className="p-20 text-center text-gray-400 border-2 border-dashed">Standard Image Text Section (Default)</div>
            )}
        </>
    );
};

export const PreviewArea: React.FC = () => {
    const { pages, currentPageId, setCurrentPage, viewMode, siteConfig, currentLanguage, translationItems, openModal, themeConfig, sectionTemplates } = useStore();
    const { context } = useSPContext();
    const activePage = pages.find(p => p.id === currentPageId);
    const previewThemeConfig = useMemo(
        () => applySiteLayoutWidthToTheme(siteConfig, themeConfig),
        [siteConfig.headerWidth, siteConfig.headerWidthCustom, siteConfig.navigationWidth, siteConfig.navigationWidthCustom, themeConfig]
    );
    const sortedContainers = useMemo(
        () => (activePage
            ? [...activePage.containers]
                .sort(compareContainersByOrder)
                .map((container) => resolveContainerWithLiveTemplate(container, sectionTemplates))
            : []),
        [activePage, sectionTemplates]
    );
    const mainHeroContainerId = useMemo(() => {
        const first = sortedContainers.find((c) => c.type === ContainerType.HERO);
        return first?.id ?? null;
    }, [sortedContainers]);
    const footerConfig = siteConfig.footer;
    const [isPageNotFound, setIsPageNotFound] = useState(false);
    const [isAddingSection, setIsAddingSection] = useState(false);
    const [addSectionInsertIndex, setAddSectionInsertIndex] = useState<number | undefined>(undefined);
    const siteHeaderRef = useRef<HTMLElement | null>(null);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [selectedPanelItem, setSelectedPanelItem] = useState<any>(null);

    const openAddSectionPopup = useCallback((insertIndex: number) => {
        setAddSectionInsertIndex(insertIndex);
        setIsAddingSection(true);
    }, []);

    const closeAddSectionPopup = useCallback(() => {
        setIsAddingSection(false);
        setAddSectionInsertIndex(undefined);
    }, []);

    const siteUrl = context.pageContext.web.absoluteUrl;
    const resolveHashTarget = useCallback((hashValue: string) => {
        const { pageId, isNotFound } = parsePreviewHashRoute(hashValue, pages);
        return { pageId, isNotFound };
    }, [pages]);

    // --- SCROLL SPY: track which container section is currently in view ---
    const [activeContainerId, setActiveContainerId] = React.useState<string | null>(null);
    const pendingInstantSectionNavRef = useRef(false);

    useEffect(() => {
        // Gather Container-type root nav items for the current page, in DOM order
        const containerNavItems = siteConfig.navigation
            .filter(n => n.parentId === 'root' && n.isVisible && n.type === 'Container' && n.containerId && String(n.pageId) === String(currentPageId))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        if (containerNavItems.length === 0) {
            setActiveContainerId(null);
            return;
        }

        const scrollRoot = document.getElementById('preview-main-scroll');
        if (!scrollRoot) return;

        // Scroll-threshold: how far from the top of the scroll container a section
        // must pass before it becomes "active". ~120px covers a typical sticky header.
        const THRESHOLD = 120;

        const getActive = () => {
            const rootRect = scrollRoot.getBoundingClientRect();
            const triggerLine = rootRect.top + THRESHOLD;
            const scrollTop = scrollRoot.scrollTop || 0;

            // Keep Home active while user is at the top hero area.
            // Once scrolled beyond threshold, section links can take over.
            if (scrollTop <= THRESHOLD) {
                setActiveContainerId(null);
                return;
            }

            let activeId: string | null = null;
            let maxVisibleHeight = 0;

            // Prefer the section that is most visible inside the scroll viewport.
            // This avoids prematurely activating the next nav item when its top
            // barely crosses the trigger line.
            for (const navItem of containerNavItems) {
                const el = document.querySelector(`[data-container-id="${navItem.containerId}"]`) as HTMLElement | null;
                if (!el) continue;
                const rect = el.getBoundingClientRect();
                const visibleTop = Math.max(rect.top, rootRect.top);
                const visibleBottom = Math.min(rect.bottom, rootRect.bottom);
                const visibleHeight = Math.max(0, visibleBottom - visibleTop);

                if (visibleHeight > maxVisibleHeight) {
                    maxVisibleHeight = visibleHeight;
                    activeId = String(navItem.containerId);
                }
            }

            // If nothing is visible (edge case), fallback to threshold logic.
            if (activeId) {
                setActiveContainerId(activeId);
                return;
            }

            // Walk items in order; keep updating as long as the section's top is above the trigger line.
            // The last one that qualifies is the deepest section the user has scrolled into.
            for (const navItem of containerNavItems) {
                const el = document.querySelector(`[data-container-id="${navItem.containerId}"]`);
                if (!el) continue;
                const rect = el.getBoundingClientRect();
                if (rect.top <= triggerLine) {
                    activeId = String(navItem.containerId);
                }
            }

            // If nothing has passed the trigger yet (user is at the very top),
            // activate the first section that is at least partially visible.
            if (!activeId) {
                for (const navItem of containerNavItems) {
                    const el = document.querySelector(`[data-container-id="${navItem.containerId}"]`);
                    if (!el) continue;
                    const rect = el.getBoundingClientRect();
                    if (rect.bottom > rootRect.top) {
                        activeId = String(navItem.containerId);
                        break;
                    }
                }
            }

            setActiveContainerId(activeId);
        };

        // Run immediately and on every scroll
        getActive();
        scrollRoot.addEventListener('scroll', getActive, { passive: true });
        return () => scrollRoot.removeEventListener('scroll', getActive);
    }, [currentPageId, siteConfig.navigation]);

    // --- URL SYNC HELPERS (slug hash + full navigation: ../utils/previewNavigation) ---

    const navigateToPage = useCallback((pageId: string) => {
        setIsPageNotFound(false);
        navigatePreviewToPage(pageId, pages, setCurrentPage);
    }, [pages, setCurrentPage]);

    const navigateToSection = useCallback((
        pageId: string,
        _pageSlug: string,
        anchor: string,
        _containerId?: string | number
    ) => {
        pendingInstantSectionNavRef.current = true;
        navigatePreviewToSection({
            pageId,
            anchor,
            currentPageId,
            pages,
            setCurrentPage,
            setIsPageNotFound,
        });
    }, [currentPageId, pages, setCurrentPage]);

    const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

    useEffect(() => {
        if (mobileNavOpen) {
            document.body.classList.add('ws-mobile-nav-body-lock');
        } else {
            document.body.classList.remove('ws-mobile-nav-body-lock');
        }
        return () => document.body.classList.remove('ws-mobile-nav-body-lock');
    }, [mobileNavOpen]);

    // On mount: restore page from URL hash (handles F5 / direct URL share)
    useEffect(() => {
        if (pages.length === 0) return;

        const legacyHash = migrateLegacyPreviewSectionHash(window.location.hash);
        if (legacyHash) {
            const base = window.location.href.split('#')[0];
            window.history.replaceState({ pageId: currentPageId }, '', `${base}${legacyHash}`);
            return;
        }

        const hash = window.location.hash;
        if (hash) {
            const { pageId, isNotFound } = resolveHashTarget(hash);
            setIsPageNotFound(isNotFound);

            if (pageId && pageId !== currentPageId) {
                setCurrentPage(pageId);
                return;
            }
            if (isNotFound) {
                return;
            }
        }

        // No hash → ensure URL reflects the currently selected home page
        const activePg = pages.find(p => p.id === currentPageId);
        if (activePg) {
            const expectedHash = slugToHash(activePg.slug) || '#/';
            const currentHash = window.location.hash;
            if (currentHash !== expectedHash && !hasPreviewSectionInHash(currentHash)) {
                const base = window.location.href.split('#')[0];
                window.history.replaceState({ pageId: activePg.id }, '', expectedHash ? `${base}${expectedHash}` : base);
            }
        }
    }, [pages.length, resolveHashTarget]);

    // Deep-link scroll for section hashes (#how-we-work), including legacy #/?section URLs.
    useLayoutEffect(() => {
        const hash = window.location.hash;
        const containerId = getPreviewSectionAnchorFromHash(hash);
        if (!containerId) return;

        const instant = pendingInstantSectionNavRef.current;
        pendingInstantSectionNavRef.current = false;
        const anchor = decodeURIComponent(containerId || '').trim();
        if (!anchor) return;

        if (instant) {
            freezePreviewScrollAtTop();
        }

        const snapToSection = (): boolean => {
            const el = findPreviewSectionElement(anchor);
            if (!el) return false;
            scrollPreviewSectionIntoView(el, 'auto');
            return true;
        };

        if (snapToSection()) return;

        let attempts = 0;
        const retrySnap = (): void => {
            if (snapToSection()) return;
            if (attempts < 40) {
                attempts += 1;
                requestAnimationFrame(retrySnap);
            }
        };
        requestAnimationFrame(retrySnap);
    }, [currentPageId, pages.length]);

    useEffect(() => {
        const onHashNavigation = (): void => {
            const hash = window.location.hash;
            const containerId = getPreviewSectionAnchorFromHash(hash);
            if (!containerId) return;
            scrollToPreviewSectionWithRetry(decodeURIComponent(containerId), {
                initialDelayMs: 0,
                maxAttempts: 30,
                scrollBehavior: 'auto',
            });
        };
        window.addEventListener('hashchange', onHashNavigation);
        window.addEventListener('popstate', onHashNavigation);
        return () => {
            window.removeEventListener('hashchange', onHashNavigation);
            window.removeEventListener('popstate', onHashNavigation);
        };
    }, []);

    // Sync URL whenever the active page changes (handles programmatic navigation)
    useEffect(() => {
        const currentHashState = resolveHashTarget(window.location.hash);
        if (isPageNotFound || currentHashState.isNotFound) return;
        // If URL already points to another valid page, wait for page state to catch up.
        if (currentHashState.pageId && String(currentHashState.pageId) !== String(currentPageId)) return;
        const activePg = pages.find(p => p.id === currentPageId);
        if (!activePg) return;
        const currentHash = window.location.hash;
        const expectedHash = slugToHash(activePg.slug) || '#/';
        const hasContainerAnchor = hasPreviewSectionInHash(currentHash);

        // Keep deep-link hash (e.g. "#how-we-work") intact when it belongs to the active page.
        if (hasContainerAnchor) {
            const { pageId } = parsePreviewHashRoute(currentHash, pages);
            if (pageId && String(pageId) === String(currentPageId)) return;
        }

        if (currentHash !== expectedHash) {
            const base = window.location.href.split('#')[0];
            window.history.replaceState({ pageId: currentPageId }, '', expectedHash ? `${base}${expectedHash}` : base);
        }
    }, [currentPageId, isPageNotFound, pages, resolveHashTarget]);

    // Handle browser back / forward buttons
    useEffect(() => {
        const onPopState = (event: PopStateEvent) => {
            const hash = window.location.hash;
            const { pageId, isNotFound } = resolveHashTarget(hash);
            setIsPageNotFound(isNotFound);
            if (pageId) {
                setCurrentPage(pageId);

                const hasContainerAnchor = hasPreviewSectionInHash(hash);
                if (!hasContainerAnchor) {
                    const scrollToTop = () => {
                        const scrollContainer = document.getElementById('preview-main-scroll');
                        if (scrollContainer) {
                            scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
                        }
                    };
                    // Ensure browser back on plain page routes restores page start, not previous scroll offset.
                    requestAnimationFrame(scrollToTop);
                    setTimeout(scrollToTop, 0);
                    setTimeout(scrollToTop, 80);
                }
            }
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [resolveHashTarget, setCurrentPage]);

    const handleInternalLink = (e: React.MouseEvent, url: string, options?: InternalLinkOptions) => {
        const instant = options?.instant === true;
        if (instant) {
            pendingInstantSectionNavRef.current = true;
        }
        const normalizedInput = normalizeLinkValue(url);
        if (!normalizedInput || normalizedInput === '#' || normalizedInput === 'javascript:void(0)') return;

        // If user clicks from inside a section (e.g. "Meet Our Team"), persist that
        // section anchor in the current URL before cross-page navigation so browser
        // back returns to the exact section instead of only the page top.
        const persistSourceSectionForBackNavigation = () => {
            const sourceEl = (e.currentTarget as HTMLElement | null)?.closest?.('[data-container-id]') as HTMLElement | null;
            const sourceAnchor = (sourceEl?.id || '').trim();
            if (!sourceAnchor) return;

            const currentHash = window.location.hash;
            const currentPage = pages.find(p => String(p.id) === String(currentPageId));
            if (!currentPage) return;

            const existingAnchor = getPreviewSectionAnchorFromHash(currentHash);
            if (existingAnchor === sourceAnchor) return;

            const base = window.location.href.split('#')[0];
            window.history.replaceState({ pageId: currentPage.id }, '', `${base}#${encodeURIComponent(sourceAnchor)}`);
        };

        // Helper to scroll to a container anchor reliably.
        // Prefer container wrappers to avoid matching unrelated elements with the same id.
        const scrollIntoView = (hash: string) => {
            if (instant) return;
            setTimeout(() => {
                const normalizedHash = decodeURIComponent(hash || '').trim();
                if (!normalizedHash) return;

                const el = findPreviewSectionElement(normalizedHash);
                if (el) {
                    scrollPreviewSectionIntoView(el, 'smooth');
                }
            }, 300);
        };

        const navigateToPageWithAnchor = (targetPage: any, anchor: string) => {
            const normalizedAnchor = decodeURIComponent(anchor || '').trim();
            if (!normalizedAnchor) {
                navigateToPage(targetPage.id);
                return;
            }

            const isCrossPage = targetPage.id !== currentPageId;
            const base = window.location.href.split('#')[0];
            const nextUrl = `${base}${buildPreviewSectionHash(targetPage.slug, normalizedAnchor)}`;

            if (isCrossPage) {
                persistSourceSectionForBackNavigation();
            }

            if (instant && isCrossPage) {
                freezePreviewScrollAtTop();
            }

            if (window.location.href !== nextUrl) {
                window.history.pushState({ pageId: targetPage.id }, '', nextUrl);
            }

            if (isCrossPage) {
                setIsPageNotFound(false);
                setCurrentPage(targetPage.id);
            }

            if (instant) {
                if (!isCrossPage) {
                    const snapSamePage = (): void => {
                        const el = findPreviewSectionElement(normalizedAnchor);
                        if (el) {
                            scrollPreviewSectionIntoView(el, 'auto');
                            return;
                        }
                        scrollToPreviewSectionWithRetry(normalizedAnchor, {
                            initialDelayMs: 0,
                            maxAttempts: 40,
                            scrollBehavior: 'auto',
                        });
                    };
                    requestAnimationFrame(snapSamePage);
                } else {
                    scrollToPreviewSectionWithRetry(normalizedAnchor, {
                        initialDelayMs: 80,
                        maxAttempts: 40,
                        scrollBehavior: 'auto',
                    });
                }
            } else {
                const crossPageDelayMs = 400;
                setTimeout(() => scrollIntoView(normalizedAnchor), isCrossPage ? crossPageDelayMs : 0);
            }
        };

        // Handle hash-based routes (SPA internal)
        if (normalizedInput.startsWith('#')) {
            const content = normalizedInput.slice(1);
            if (content.startsWith('/')) {
                // Page Slug: e.g. "#/about", "#/about#section", or "#/about?section"
                let [slug, anchor] = content.split(/[#?]/);
                const targetPage = findPageByRouteSlug(pages, slug);
                if (targetPage) {
                    e.preventDefault();
                    if (anchor) {
                        navigateToPageWithAnchor(targetPage, anchor);
                    } else {
                        if (targetPage.id !== currentPageId) {
                            persistSourceSectionForBackNavigation();
                        }
                        navigateToPage(targetPage.id);
                    }
                }
            } else if (content) {
                // Section anchor (#how-we-work or cross-page #meet-our-team)
                e.preventDefault();
                const anchor = decodeURIComponent(content.split('&')[0]);
                const { pageId } = parsePreviewHashRoute(`#${content}`, pages);
                const targetPage = pageId
                    ? pages.find((p) => String(p.id) === String(pageId))
                    : undefined;

                if (targetPage) {
                    navigateToPageWithAnchor(targetPage, anchor);
                    return;
                }

                const base = window.location.href.split('#')[0];
                const nextUrl = `${base}#${encodeURIComponent(content)}`;
                if (window.location.href !== nextUrl) {
                    window.history.pushState({ pageId: currentPageId }, '', nextUrl);
                }
                if (instant) {
                    const el = findPreviewSectionElement(content);
                    if (el) {
                        scrollPreviewSectionIntoView(el, 'auto');
                    } else {
                        scrollToPreviewSectionWithRetry(content, {
                            initialDelayMs: 0,
                            maxAttempts: 40,
                            scrollBehavior: 'auto',
                        });
                    }
                } else {
                    scrollIntoView(content);
                }
            }
            return;
        }

        // Handle absolute / relative URL internal links
        const [pathWithPossibleHash, hash] = normalizedInput.split('#');
        const normalizedUrl = pathWithPossibleHash.startsWith('/') ? `${siteUrl}${pathWithPossibleHash === '/' ? '' : pathWithPossibleHash}` : pathWithPossibleHash;

        if (normalizedUrl.startsWith(siteUrl)) {
            // Check if fragment-based routing is used as the link text
            if (hash && hash.startsWith('/')) {
                const [slug, anchor] = hash.split(/[#?]/);
                const targetPage = pages.find(p => p.slug === slug || (slug === '/' && p.slug === '/'));
                if (targetPage) {
                    e.preventDefault();
                    if (anchor) {
                        navigateToPageWithAnchor(targetPage, anchor);
                    } else {
                        if (targetPage.id !== currentPageId) {
                            persistSourceSectionForBackNavigation();
                        }
                        navigateToPage(targetPage.id);
                    }
                    return;
                }
            }

            // Fallback for standard path-based slug matching
            const path = normalizedUrl.replace(siteUrl, '') || '/';
            const targetPage = pages.find(p => p.slug === path || (path === '/' && p.slug === '/'));
            if (targetPage) {
                e.preventDefault();
                if (targetPage.id !== currentPageId) {
                    persistSourceSectionForBackNavigation();
                }
                navigateToPage(targetPage.id);
                if (hash) scrollIntoView(hash);
            }
        }
    };

    // Resolve Background Color
    const getFooterBg = () => {
        const bg = footerConfig.backgroundColor;
        if (bg === 'white') return '#ffffff';
        if (bg === 'light-grey') return '#f3f4f6';
        if (bg === 'site-color') return 'var(--primary-color)';
        return bg || 'var(--footer-bg)';
    };

    const isLightFooterBg = () => {
        const bg = footerConfig.backgroundColor;
        return bg === 'white' || bg === '#ffffff' || bg === 'light-grey' || bg === '#f3f4f6';
    };

    const getFooterTextColor = () => {
        return isLightFooterBg() ? 'var(--text-primary)' : 'var(--footer-text-color)';
    };

    const getFooterHeadingColor = () => {
        return isLightFooterBg() ? 'var(--heading-color)' : 'var(--footer-heading-color, #ffffff)';
    };

    const getFooterLinkColor = () => {
        return isLightFooterBg() ? 'var(--link-color)' : '#ffffff';
    };

    const footerTextColor = getFooterTextColor();
    const footerHeadingColor = getFooterHeadingColor();
    const footerLinkColor = getFooterLinkColor();

    const rootNavItems = useMemo(
        () => siteConfig.navigation
            .filter(n => n.parentId === 'root' && n.isVisible)
            .sort((a, b) => a.order - b.order),
        [siteConfig.navigation]
    );

    const navOverflows = useTopNavOverflow(
        siteHeaderRef,
        siteConfig.navPosition,
        rootNavItems.length,
        [
            currentLanguage,
            siteConfig.navPosition,
            siteConfig.navigation.length,
            siteConfig.headerTopAlignment,
            siteConfig.logo?.width,
        ]
    );

    const isMobileViewport = useMobileViewport();
    const isNarrowPreview = useNarrowPreview();
    const useDrawerNavigation = isMobileViewport || isNarrowPreview || navOverflows;

    useEffect(() => {
        if (!navOverflows) {
            setMobileNavOpen(false);
        }
    }, [navOverflows]);

    const renderNavItems = useCallback(() => (
        <div className="ws-top-nav-scroll-host h-full min-w-0 flex-1">
            <nav
                className={`ws-top-nav-bar items-center ${siteConfig.navPosition === 'below_logo' ? `justify-${getTailwindAlign(siteConfig.navAlignment)}` : ''} w-full h-full`}
                style={{ marginLeft: siteConfig.headerNavMarginLeft || '0px' }}
            >
                {rootNavItems.map((link, idx) => (
                    <TopNavDropdownItem key={link.id} item={link} allItems={siteConfig.navigation} onNavigate={navigateToPage} onNavigateToSection={navigateToSection} activeContainerId={activeContainerId} isFirst={idx === 0} />
                ))}
            </nav>
        </div>
    ), [activeContainerId, navigateToPage, navigateToSection, rootNavItems, siteConfig.headerNavMarginLeft, siteConfig.navAlignment, siteConfig.navPosition, siteConfig.navigation]);

    const mobileMenuButton = (
        <button
            type="button"
            className="ws-top-nav-mobile-toggle items-center justify-center w-10 h-10 rounded-sm border border-gray-200 text-gray-700 hover:text-[var(--primary-color)] hover:border-[var(--primary-color)] transition-colors shrink-0"
            aria-expanded={mobileNavOpen}
            aria-controls="ws-mobile-nav-panel"
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileNavOpen(prev => !prev)}
        >
            {mobileNavOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
    );

    const LogoComponent = () => {
        const logoText = siteConfig.headerLogoText?.[currentLanguage] || siteConfig.headerLogoText?.['en'] || '';
        const alignmentMap = {
            'up': 'items-start',
            'centre': 'items-center',
            'down': 'items-end'
        };
        const alignClass = alignmentMap[siteConfig.headerLogoTextAlignment || 'centre'] || 'items-center';

        return (
            <div className={`flex ${alignClass} cursor-pointer`} onClick={() => navigateToPage(pages.find(p => p.slug === '/')?.id || pages[0]?.id || '')}>
                {siteConfig.logo.url ? (
                    <img
                        src={siteConfig.logo.url}
                        alt={siteConfig.name}
                        style={{ width: siteConfig.logo.width || 'var(--logo-width)' }}
                        className="object-contain"
                    />
                ) : (
                    <div className="header-logo-text text-xl tracking-tight text-white" style={{ fontFamily: 'var(--font-family-base)' }}>
                        {siteConfig.name}
                    </div>
                )}
                {logoText && (
                    <div
                        className="header-logo-text whitespace-nowrap text-white"
                        style={{
                            paddingLeft: siteConfig.headerLogoTextSpacing || '1rem',
                            fontSize: siteConfig.headerLogoTextFontSize ? toCssSize(siteConfig.headerLogoTextFontSize) : '1.25rem'
                        }}
                    >
                        {logoText}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="ws-site-preview-root flex-1 overflow-hidden flex flex-col relative min-h-0" style={{ backgroundColor: previewThemeConfig['--bg-body'] }}>

            {/* Main Website Frame */}
            <div
                id="preview-main-scroll"
                className={`flex-1 min-h-0 overflow-y-auto overflow-x-clip admin-scroll bg-transparent relative${isNarrowPreview ? ' ws-preview-narrow' : ''}`}
                style={{ backgroundColor: previewThemeConfig['--bg-body'], ...previewThemeConfig as any }}
            >

                {/* Site Header */}
                <header
                    ref={siteHeaderRef}
                    className={`ws-site-sticky-header sticky top-0 z-30 transition-all flex flex-col shadow-sm overflow-visible${navOverflows ? ' ws-header-nav-overflow' : ''}`}
                >
                    {/* Add dynamic styles for Nav Header Font Weight */}
                    <style>
                        {`
                        .nav-link.top-nav-link, a.top-nav-link {
                            font-size: ${siteConfig.headerMenuFontSize ? toCssSize(siteConfig.headerMenuFontSize) : '0.875rem'} !important;
                            font-weight: ${resolveHeaderMenuFontWeight(siteConfig)} !important;
                            line-height: ${siteConfig.headerMenuLineHeight || 'normal'} !important;
                            font-family: ${resolveHeaderMenuFontFamily(siteConfig, previewThemeConfig)} !important;
                            text-transform: ${siteConfig.headerMenuTextTransform || 'uppercase'} !important;
                        }
                        .nav-link.top-nav-link span,
                        a.top-nav-link span {
                            font-size: inherit !important;
                            font-weight: inherit !important;
                            line-height: inherit !important;
                            font-family: inherit !important;
                            text-transform: inherit !important;
                            color: inherit !important;
                        }
                        .header-logo-text {
                            font-weight: ${resolveHeaderLogoFontWeight(siteConfig)} !important;
                            font-size: ${siteConfig.headerLogoTextFontSize ? toCssSize(siteConfig.headerLogoTextFontSize) : '1.25rem'} !important;
                        }
                        .submenu-link {
                            color: #1f2937 !important;
                            font-size: ${siteConfig.headerSubmenuFontSize ? toCssSize(siteConfig.headerSubmenuFontSize) : '0.875rem'} !important;
                            font-weight: ${siteConfig.headerSubmenuFontWeight || 'inherit'} !important;
                            line-height: ${siteConfig.headerSubmenuLineHeight || 'normal'} !important;
                            font-family: ${siteConfig.headerSubmenuFontFamily || 'var(--font-family-nav)'} !important;
                            text-transform: ${siteConfig.headerSubmenuTextTransform || 'none'} !important;
                        }
                        .ws-top-nav-dropdown, .submenu-flyout {
                            min-width: ${siteConfig.headerSubmenuWidth ? toCssSize(siteConfig.headerSubmenuWidth) : '200px'} !important;
                            width: ${siteConfig.headerSubmenuWidth ? toCssSize(siteConfig.headerSubmenuWidth) : 'auto'} !important;
                        }
                        .top-nav-link:hover {
                            color: ${siteConfig.headerNavHoverColor || 'var(--primary-color)'} !important;
                        }
                        .top-nav-link.active {
                            color: var(--primary-color) !important;
                        }
                        .submenu-item:hover {
                            background-color: ${siteConfig.headerSubmenuHoverBgColor || '#f3f4f6'} !important;
                        }
                        .submenu-item:hover > .submenu-link {
                            color: ${siteConfig.headerSubmenuHoverTextColor || 'var(--primary-color)'} !important;
                        }
                        .submenu-link:hover {
                            text-decoration: none !important;
                        }
                        .ws-header-top-row {
                            height: ${siteConfig.headerLogoHeight ? toCssSize(siteConfig.headerLogoHeight) : '64px'} !important;
                        }
                        .ws-header-logo-wrap img {
                            max-height: 100% !important;
                        }
                        .ws-header-logo-wrap .header-logo-text {
                            margin-bottom: 8px !important;
                        }
                        `}
                    </style>

                    {/* TOP SECTION: Logo & Brand Information */}
                    <div
                        className="w-full transition-all"
                        style={{
                            backgroundColor: siteConfig.headerTopBackgroundColor || themeConfig['--header-bg'] || '#ffffff',
                            borderBottom: siteConfig.navPosition === 'below_logo' ? 'none' : '1px solid var(--border-color)'
                        }}
                    >
                        <div
                            className={`mx-auto ws-header-inner ws-header-top-row flex items-center justify-${getTailwindAlign(siteConfig.headerTopAlignment || siteConfig.logo.position)} h-full relative`}
                        >
                            <div className={`ws-header-logo-wrap flex items-center h-full min-w-0 ${siteConfig.headerTopAlignment === 'center' ? 'absolute left-1/2 -translate-x-1/2 z-10' : ''}`}>
                                <div style={{ marginLeft: siteConfig.headerLogoMarginLeft || '0px' }}>
                                    <LogoComponent />
                                </div>
                                {siteConfig.navPosition === 'near_logo' && siteConfig.headerTopAlignment !== 'center' && (
                                    <div className="ws-top-nav-desktop-wrap ws-near-logo items-center h-full min-w-0">
                                        {renderNavItems()}
                                    </div>
                                )}
                            </div>

                            <div className="ws-header-actions items-center h-full ml-auto">
                                {siteConfig.navPosition === 'right' && (
                                    <div className="ws-top-nav-desktop-wrap items-center h-full min-w-0 flex-1 justify-end">
                                        {renderNavItems()}
                                    </div>
                                )}
                                {!useDrawerNavigation && siteConfig.navPosition !== 'below_logo' && (
                                    <>
                                        <div className="ws-top-nav-lang-desktop shrink-0">
                                            <LanguageSelector variant="header" />
                                        </div>
                                        <div className="ws-top-nav-lang-tablet shrink-0">
                                            <LanguageSelector variant="header" />
                                        </div>
                                    </>
                                )}
                                {mobileMenuButton}
                            </div>
                        </div>
                    </div>

                    {siteConfig.navPosition === 'below_logo' && (
                        <div
                            className="ws-top-nav-below-logo-row w-full border-t border-gray-100 transition-all"
                            style={{
                                backgroundColor: siteConfig.headerBottomBackgroundColor || themeConfig['--header-bg'] || '#ffffff',
                                borderBottom: '1px solid var(--border-color)'
                            }}
                        >
                            <div
                                className="mx-auto ws-header-inner flex items-center gap-4 w-full"
                                style={{
                                    height: siteConfig.headerNavHeight || '48px'
                                }}
                            >
                                <div className="flex-1 min-w-0 flex items-center">
                                    {renderNavItems()}
                                </div>
                                {!useDrawerNavigation && (
                                    <div className="flex-shrink-0 ws-header-lang-slot">
                                        <LanguageSelector variant="header" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div
                        id="ws-mobile-nav-panel"
                        className={mobileNavOpen ? 'ws-mobile-nav-open' : ''}
                        aria-hidden={!mobileNavOpen}
                    >
                        <button
                            type="button"
                            className="ws-top-nav-mobile-backdrop"
                            aria-label="Close menu"
                            onClick={closeMobileNav}
                        />
                        <div className="ws-mobile-nav-drawer" role="dialog" aria-modal="true" aria-label="Site menu">
                            <div className="ws-mobile-nav-drawer-header">
                                <span className="ws-mobile-nav-drawer-title">Menu</span>
                                <div className="ws-mobile-nav-drawer-header-actions">
                                    {useDrawerNavigation && (
                                        <div className="ws-mobile-nav-drawer-lang">
                                            <LanguageSelector variant="drawer" />
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        className="p-2 text-gray-600 hover:text-[var(--primary-color)]"
                                        aria-label="Close menu"
                                        onClick={closeMobileNav}
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                            <div className="ws-mobile-nav-drawer-body">
                                <nav className="flex flex-col">
                                    {rootNavItems.map(link => (
                                        <MobileTopNavItem
                                            key={link.id}
                                            item={link}
                                            allItems={siteConfig.navigation}
                                            onNavigate={navigateToPage}
                                            onNavigateToSection={navigateToSection}
                                            activeContainerId={activeContainerId}
                                            onCloseMenu={closeMobileNav}
                                        />
                                    ))}
                                </nav>
                            </div>
                        </div>
                    </div>

                    <div className="ws-top-nav-measure-slot" aria-hidden="true">
                        <nav className="ws-top-nav-bar">
                            {rootNavItems.map((link, idx) => (
                                <TopNavDropdownItem
                                    key={`measure-${link.id}`}
                                    item={link}
                                    allItems={siteConfig.navigation}
                                    onNavigate={navigateToPage}
                                    onNavigateToSection={navigateToSection}
                                    activeContainerId={activeContainerId}
                                    isFirst={idx === 0}
                                />
                            ))}
                        </nav>
                    </div>

                    {siteConfig.showBreadcrumb !== false && (
                        <TopNavigationBreadcrumb
                            navigation={siteConfig.navigation}
                            pages={pages}
                            currentPageId={currentPageId}
                            currentLanguage={currentLanguage}
                            onNavigate={navigateToPage}
                            embeddedInHeader
                            breadcrumbHeight={siteConfig.headerBreadcrumbHeight}
                            breadcrumbFontSize={siteConfig.headerBreadcrumbFontSize}
                        />
                    )}
                </header>

                {isPageNotFound ? (
                    <div
                        className="flex-1 min-h-[60vh] flex items-center justify-center px-4 py-16"
                        style={{ backgroundColor: 'var(--body-bg)' }}
                    >
                        <div className="flex flex-col items-center text-center max-w-md">
                            <div
                                className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-sm"
                                style={{ backgroundColor: 'var(--border-color)' }}
                            >
                                <FileX size={34} color="var(--icon-color)" strokeWidth={2} />
                            </div>
                            <h2 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                                Page not found
                            </h2>
                            <p className="text-xl mb-8" style={{ color: 'var(--text-secondary)' }}>
                                The page you are looking for does not exist.
                            </p>
                            <button
                                className="btn-primary px-6 py-3 text-base font-semibold rounded-sm transition-all hover:opacity-90"
                                onClick={() => navigateToPage(pages.find(p => p.slug === '/')?.id || pages[0]?.id || '')}
                            >
                                Go to home page
                            </button>
                        </div>
                    </div>
                ) : activePage ? (
                    <div className="ws-page-body flex flex-col min-h-[calc(100vh-64px)]">
                        {sortedContainers.length > 0 ? (
                            sortedContainers.map((container, idx) => (
                                <ContainerWrapper
                                    key={container.id}
                                    container={container}
                                    viewMode={viewMode}
                                    lang={currentLanguage}
                                    pageTitle={getLocalizedText(activePage.title, currentLanguage)}
                                    isMainHero={container.id === mainHeroContainerId}
                                    onInternalLink={handleInternalLink}
                                    onNavigateToSection={navigateToSection}
                                    themeConfig={previewThemeConfig}
                                    showAddSectionOnHover={viewMode === ViewMode.EDIT}
                                    onAddSection={() => openAddSectionPopup(idx + 1)}
                                    onOpenDetailsPanel={setSelectedPanelItem}
                                />
                            ))
                        ) : (
                            <div
                                className="flex-1 min-h-[60vh] flex items-center justify-center px-4 py-16"
                                style={{ backgroundColor: 'var(--body-bg)' }}
                            >
                                <div className="flex flex-col items-center text-center max-w-md">
                                    <div
                                        className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-sm"
                                        style={{ backgroundColor: 'var(--border-color)' }}
                                    >
                                        <FileX size={34} color="var(--icon-color)" strokeWidth={2} />
                                    </div>
                                    <h2 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                                        No content found
                                    </h2>
                                    <p className="text-xl mb-8" style={{ color: 'var(--text-secondary)' }}>
                                        This page doesn&apos;t have any sections yet. Add your first section to get started.
                                    </p>
                                    {viewMode === ViewMode.EDIT ? (
                                        <button
                                            className="btn-primary px-6 py-3 text-base font-semibold rounded-sm transition-all hover:opacity-90 inline-flex items-center gap-2"
                                            onClick={() => openAddSectionPopup(0)}
                                        >
                                            <Plus className="w-5 h-5" />
                                            {getTranslation('BTN_ADD_SECTIONS_HERE', currentLanguage)}
                                        </button>
                                    ) : (
                                        <button
                                            className="btn-primary px-6 py-3 text-base font-semibold rounded-sm transition-all hover:opacity-90"
                                            onClick={() => openModal(ModalType.SITE_MGMT)}
                                        >
                                            Click to add sections
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        <footer
                            className="ws-footer-shell"
                            style={{
                                backgroundColor: getFooterBg(),
                                color: getFooterTextColor(),
                                textAlign: footerConfig.template === 'Table' ? footerConfig.alignment : 'left',
                                ...({
                                    '--heading-color': footerHeadingColor,
                                    '--heading-h1-color': footerHeadingColor,
                                    '--heading-h2-color': footerHeadingColor,
                                    '--heading-h3-color': footerHeadingColor,
                                    '--heading-h4-color': footerHeadingColor,
                                    '--heading-h5-color': footerHeadingColor,
                                    '--heading-h6-color': footerHeadingColor,
                                    '--font-weight-bold': footerConfig.fontSettings.headingWeight || '700',
                                    '--font-size-h5': footerConfig.fontSettings.headingSize,
                                    '--font-size-h4': footerConfig.fontSettings.headingSize,
                                    '--custom-link-color': footerLinkColor,
                                    '--custom-link-hover-color': 'var(--edit-icon-hover-bg)'
                                } as React.CSSProperties)
                            }}
                        >
                            <style>{`
                                .footer-table-link {
                                    color: var(--custom-link-color) !important;
                                    transition: color 0.15s ease-in-out !important;
                                }
                                .footer-table-link:hover {
                                    color: var(--edit-icon-hover-bg) !important;
                                    opacity: 1 !important;
                                }
                                .ws-footer-columns ul {
                                    list-style-type: ${footerConfig.showBullets !== false ? 'disc' : 'none'} !important;
                                    padding-left: ${footerConfig.showBullets !== false ? '1.25rem' : '0px'} !important;
                                }
                                .ws-footer-columns ul li {
                                    list-style-type: ${footerConfig.showBullets !== false ? 'disc' : 'none'} !important;
                                }
                            `}</style>
                            {footerConfig.template === 'Table' && (
                                <div className="mx-auto ws-page-width ws-footer-inner flex flex-col w-full">
                                    <div
                                        className="ws-footer-columns"
                                        style={{
                                            justifyContent: footerConfig.alignment === 'center' ? 'center' : footerConfig.alignment === 'right' ? 'flex-end' : 'flex-start'
                                        }}
                                    >
                                        {footerConfig.columns.map(col => (
                                            <div key={col.id} className="ws-footer-column flex flex-col w-full">
                                                <h5
                                                    className="pb-4 w-full"
                                                    style={{
                                                        fontSize: footerConfig.fontSettings.headingSize,
                                                        color: footerHeadingColor,
                                                        fontWeight: Number(footerConfig.fontSettings.headingWeight || 700),
                                                        ...({ '--font-weight-bold': footerConfig.fontSettings.headingWeight || 700 } as any)
                                                    }}
                                                >
                                                    {getGlobalTranslation(`footer_col_${col.id}`, translationItems, currentLanguage, col.translations?.[currentLanguage] || col.title)}
                                                </h5>
                                                <ul className="flex flex-col w-full" style={{ fontSize: footerConfig.fontSettings.subHeadingSize, fontWeight: Number(footerConfig.fontSettings.subHeadingWeight || 500) }}>
                                                    {col.links.map(link => (
                                                        <li key={link.id} className="border-b border-current border-opacity-30 w-full">
                                                            <a
                                                                href={link.url}
                                                                target={(link.url || '').toLowerCase().includes('sharepoint.com') ? '_self' : '_blank'}
                                                                rel={(link.url || '').toLowerCase().includes('sharepoint.com') ? undefined : 'noopener noreferrer'}
                                                                className="block py-3 footer-table-link cursor-pointer"
                                                                style={{ fontSize: footerConfig.fontSettings.subHeadingSize, fontWeight: Number(footerConfig.fontSettings.subHeadingWeight || 500) }}
                                                                onClick={(e) => handleInternalLink(e, link.url)}
                                                            >
                                                                {getGlobalTranslation(`footer_link_${link.id}`, translationItems, currentLanguage, link.translations?.[currentLanguage] || link.label)}
                                                            </a>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ height: '4rem', width: '100%' }}></div>
                                    <div className="pt-8 border-t border-current border-opacity-30 ws-footer-bottom w-full">
                                        <div className="opacity-80 text-sm" style={{ color: footerTextColor }}>
                                            {getGlobalTranslation('footer_copyright', translationItems, currentLanguage, footerConfig.copyright?.[currentLanguage] || footerConfig.copyright?.en)}
                                        </div>
                                        {footerConfig.logo && (
                                            <img
                                                src={footerConfig.logo}
                                                alt="Logo"
                                                className="ws-footer-logo object-contain"
                                            />
                                        )}
                                    </div>
                                </div>
                            )}

                            {footerConfig.template === 'Corporate' && (
                                <div className="mx-auto ws-page-width ws-footer-inner py-12">
                                    {/* Top Section: 3 Columns */}
                                    <div className="ws-footer-corporate-grid mb-16">

                                        {/* Column 1: Brand & Address (Flexible) */}
                                        <div className="space-y-4 text-left">
                                            <div className="space-y-1">
                                                {(footerConfig.brandItems && footerConfig.brandItems.length > 0) ? (
                                                    footerConfig.brandItems.map((item, idx) => (
                                                        <div key={item.id}>
                                                            <h5 className={idx === 0 ? "font-bold mb-1" : "opacity-80 leading-relaxed"} style={{
                                                                fontSize: idx === 0 ? footerConfig.fontSettings.headingSize : footerConfig.fontSettings.subHeadingSize,
                                                                color: 'black',
                                                                fontWeight: idx === 0 ? Number(footerConfig.fontSettings.headingWeight || 700) : Number(footerConfig.fontSettings.subHeadingWeight || 500),
                                                                ...({ '--font-weight-bold': idx === 0 ? (footerConfig.fontSettings.headingWeight || 700) : (footerConfig.fontSettings.subHeadingWeight || 500) } as any)
                                                            }}>
                                                                {(item.translations?.[currentLanguage] || item.value) || (idx === 0 ? siteConfig.name : '')}
                                                            </h5>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-left">
                                                        <h4 className="font-bold  mb-2" style={{ fontSize: footerConfig.fontSettings.headingSize, color: footerHeadingColor, fontWeight: Number(footerConfig.fontSettings.headingWeight || 700), ...({ '--font-weight-bold': footerConfig.fontSettings.headingWeight || 700 } as any) }}>{siteConfig.name} </h4>
                                                        {footerConfig.contactInfo.address && (
                                                            <p className="opacity-80 leading-relaxed" style={{ fontSize: footerConfig.fontSettings.subHeadingSize, color: footerTextColor, fontWeight: Number(footerConfig.fontSettings.subHeadingWeight || 500) }}>
                                                                {footerConfig.contactInfo.address}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {viewMode === ViewMode.EDIT && (
                                                <div className="mt-2 text-left">
                                                    <button
                                                        onClick={() => openModal(ModalType.FOOTER)}
                                                        className="w-10 h-10 rounded-full border border-[var(--primary-color)] bg-white flex items-center justify-center text-[var(--primary-color)] hover:bg-[var(--primary-color)]/5 transition-colors shadow-sm"
                                                    >
                                                        <Plus className="w-6 h-6" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Column 2: Social Links (Flexible) - WITH DESIGN LINES */}
                                        <div className="flex flex-col items-center space-y-6">
                                            <div className="flex items-center w-full gap-4">
                                                <div className="h-px bg-[var(--primary-color)] flex-1"></div>
                                                <div className="flex flex-wrap justify-center gap-3">
                                                    {(footerConfig.socialItems && footerConfig.socialItems.length > 0) ? (
                                                        footerConfig.socialItems.map(item => (
                                                            <a
                                                                key={item.id}
                                                                href={item.url || '#'}
                                                                target={(item.url || '').toLowerCase().includes('sharepoint.com') ? '_self' : '_blank'}
                                                                rel={(item.url || '').toLowerCase().includes('sharepoint.com') ? undefined : 'noopener noreferrer'}
                                                                className="hover:opacity-80 transition-all hover:scale-110"
                                                                aria-label={getSocialAriaLabel(item.type)}
                                                                onClick={(e) => handleInternalLink(e, item.url || '#')}
                                                            >
                                                                {getSocialIcon(item.type)}
                                                            </a>
                                                        ))
                                                    ) : (
                                                        <div className="flex gap-4">
                                                            {footerConfig.socialLinks.facebook && (
                                                                <a
                                                                    href={footerConfig.socialLinks.facebook}
                                                                    target={(footerConfig.socialLinks.facebook || '').toLowerCase().includes('sharepoint.com') ? '_self' : '_blank'}
                                                                    rel={(footerConfig.socialLinks.facebook || '').toLowerCase().includes('sharepoint.com') ? undefined : 'noopener noreferrer'}
                                                                    className="hover:opacity-80 transition-opacity"
                                                                    aria-label="Facebook"
                                                                    onClick={(e) => handleInternalLink(e, footerConfig.socialLinks.facebook)}
                                                                >
                                                                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary-color)' }}><Facebook className="w-5 h-5 text-white" /></div>
                                                                </a>
                                                            )}
                                                            {footerConfig.socialLinks.linkedin && (
                                                                <a
                                                                    href={footerConfig.socialLinks.linkedin}
                                                                    target={(footerConfig.socialLinks.linkedin || '').toLowerCase().includes('sharepoint.com') ? '_self' : '_blank'}
                                                                    rel={(footerConfig.socialLinks.linkedin || '').toLowerCase().includes('sharepoint.com') ? undefined : 'noopener noreferrer'}
                                                                    className="hover:opacity-80 transition-opacity"
                                                                    aria-label="LinkedIn"
                                                                    onClick={(e) => handleInternalLink(e, footerConfig.socialLinks.linkedin || '#')}
                                                                >
                                                                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary-color)' }}><Linkedin className="w-5 h-5 text-white" /></div>
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="h-px bg-[var(--primary-color)] flex-1"></div>
                                            </div>
                                            {viewMode === ViewMode.EDIT && (
                                                <button
                                                    onClick={() => openModal(ModalType.FOOTER)}
                                                    className="w-10 h-10 rounded-full border border-[var(--primary-color)] bg-white flex items-center justify-center text-[var(--primary-color)] hover:bg-[var(--primary-color)]/5 transition-colors shadow-sm"
                                                >
                                                    <Plus className="w-6 h-6" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Column 3: Contact Info (Flexible) */}
                                        <div className="flex flex-col items-end space-y-6 text-right">
                                            <div className="space-y-4">
                                                {(footerConfig.contactItems && footerConfig.contactItems.length > 0) ? (
                                                    footerConfig.contactItems.map(item => {
                                                        const getItemHref = (type: string, value: string) => {
                                                            if (type === 'Email') return `mailto:${value}`;
                                                            if (type === 'Phone' || type === 'Mobile' || type === 'Fax') return `tel:${value.replace(/\s/g, '')}`;
                                                            if (type === 'Address') return `https://maps.google.com/?q=${encodeURIComponent(value)}`;
                                                            return undefined;
                                                        };
                                                        const href = getItemHref(item.type, item.value);
                                                        const content = (
                                                            <>
                                                                <span>{item.value}</span>
                                                                {getContactIcon(item.type, footerTextColor)}
                                                            </>
                                                        );
                                                        return href ? (
                                                            <a
                                                                key={item.id}
                                                                href={href}
                                                                target={(href || '').toLowerCase().includes('sharepoint.com') ? '_self' : (item.type === 'Address' ? '_blank' : '_self')}
                                                                rel={((href || '').toLowerCase().includes('sharepoint.com') || item.type !== 'Address') ? undefined : 'noopener noreferrer'}
                                                                className="flex items-center justify-end gap-3 hover:opacity-80 transition-all font-medium"
                                                                style={{ color: 'var(--link-color)', fontSize: footerConfig.fontSettings.subHeadingSize, fontWeight: Number(footerConfig.fontSettings.subHeadingWeight || 500) }}
                                                                onClick={(e) => handleInternalLink(e, href)}
                                                            >
                                                                {content}
                                                            </a>
                                                        ) : (
                                                            <div key={item.id} className="flex items-center justify-end gap-3" style={{ color: footerTextColor, fontSize: footerConfig.fontSettings.subHeadingSize, fontWeight: Number(footerConfig.fontSettings.subHeadingWeight || 500) }}>
                                                                {content}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="space-y-3">
                                                        {footerConfig.contactInfo.email && (
                                                            <a href={`mailto:${footerConfig.contactInfo.email}`} className="flex items-center justify-end gap-3 hover:opacity-80 transition-all font-medium" style={{ color: 'var(--link-color)', fontSize: footerConfig.fontSettings.subHeadingSize, fontWeight: Number(footerConfig.fontSettings.subHeadingWeight || 500) }}>
                                                                <span>{footerConfig.contactInfo.email}</span>
                                                                <Mail className="w-5 h-5" />
                                                            </a>
                                                        )}
                                                        {footerConfig.contactInfo.phone && (
                                                            <a href={`tel:${footerConfig.contactInfo.phone}`} className="flex items-center justify-end gap-3 hover:opacity-80 transition-all font-medium" style={{ color: 'var(--link-color)', fontSize: footerConfig.fontSettings.subHeadingSize, fontWeight: Number(footerConfig.fontSettings.subHeadingWeight || 500) }}>
                                                                <span>{footerConfig.contactInfo.phone}</span>
                                                                <Phone className="w-5 h-5" />
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {viewMode === ViewMode.EDIT && (
                                                <button
                                                    onClick={() => openModal(ModalType.FOOTER)}
                                                    className="w-10 h-10 rounded-full border border-[var(--primary-color)] bg-white flex items-center justify-center text-[var(--primary-color)] hover:bg-[var(--primary-color)]/5 transition-colors shadow-sm"
                                                >
                                                    <Plus className="w-6 h-6" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Decorative Divider */}
                                    <div className="h-px bg-[var(--primary-color)]/20 w-full mb-8"></div>

                                    <div className="ws-footer-bottom items-center gap-4 h-min">
                                        <div className="flex flex-col items-start gap-2">
                                            <div className="flex items-center gap-1 text-sm" style={{ color: footerTextColor }}>
                                                {(footerConfig?.bottomLinks && footerConfig.bottomLinks.length > 0) ? (
                                                    footerConfig.bottomLinks.map((link, idx) => (
                                                        <React.Fragment key={link.id}>
                                                            <a
                                                                href={link.url || '#'}
                                                                target={(link.url || '').toLowerCase().includes('sharepoint.com') ? '_self' : '_blank'}
                                                                rel={(link.url || '').toLowerCase().includes('sharepoint.com') ? undefined : 'noopener noreferrer'}
                                                                className="hover:underline transition-colors whitespace-nowrap pe-1"
                                                                style={{ color: 'var(--link-color)', fontSize: footerConfig.fontSettings.subHeadingSize }}
                                                                onClick={(e) => handleInternalLink(e, link.url || '#')}
                                                            >
                                                                {getGlobalTranslation(
                                                                    `footer_bottom_link_${link.id}`,
                                                                    translationItems,
                                                                    currentLanguage,
                                                                    (link as any).translations?.[currentLanguage] || link.label
                                                                )}
                                                            </a>
                                                            {idx < (footerConfig.bottomLinks?.length || 0) - 1 && <span className="opacity-40">/</span>}
                                                        </React.Fragment>
                                                    ))
                                                ) : (
                                                    <div className="flex items-center gap-2" style={{ color: footerTextColor }}>
                                                        <a href="#" className="hover:underline transition-colors" style={{ color: 'var(--link-color)', fontSize: footerConfig.fontSettings.subHeadingSize }}>{getTranslation('LBL_PRIVACY_POLICY', currentLanguage) || 'Privacy Policy'}</a>
                                                        <span className="opacity-40">/</span>
                                                        <a href="#" className="hover:underline transition-colors" style={{ color: 'var(--link-color)', fontSize: footerConfig.fontSettings.subHeadingSize }}>{getTranslation('LBL_TERMS_SERVICE', currentLanguage) || 'Terms of Service'}</a>
                                                    </div>
                                                )}
                                            </div>
                                            {viewMode === ViewMode.EDIT && (
                                                <button
                                                    onClick={() => openModal(ModalType.FOOTER)}
                                                    className="w-10 h-10 rounded-full border border-[var(--primary-color)] bg-white flex items-center justify-center text-[var(--primary-color)] hover:bg-[var(--primary-color)]/5 transition-colors shadow-sm"
                                                >
                                                    <Plus className="w-6 h-6" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="ws-footer-corporate-copy flex flex-col items-center gap-2 h-min">
                                            <div className="text-sm font-medium opacity-80 h-min" style={{ color: footerTextColor }}>
                                                {getLocalizedText(footerConfig.copyright, currentLanguage)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </footer>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">{getTranslation('MSG_NO_PAGE_SELECTED', currentLanguage)}</div>
                )}
            </div >

            {/* Editor HUD */}
            {/* {viewMode === ViewMode.EDIT && (
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900/90 text-white px-6 py-3 rounded-none shadow-2xl backdrop-blur flex items-center gap-4 border border-white/10 z-50">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-none animate-pulse" style={{ backgroundColor: 'var(--status-success, #16a34a)' }}></div>
                        <span className="text-xs font-bold uppercase tracking-wider">Editor Active</span>
                    </div>
                    <div className="h-4 w-px bg-white/20"></div>
                    <span className="text-sm font-medium">{getLocalizedText(activePage?.title ?? '', currentLanguage)}</span>
                </div>
            )} */}

            {isAddingSection && activePage && (
                <SelectHeaderTemplatePopup
                    pageId={activePage.id}
                    insertAtIndex={addSectionInsertIndex}
                    onClose={closeAddSectionPopup}
                />
            )}

            {selectedPanelItem && (
                <DetailsPanel
                    item={selectedPanelItem}
                    onClose={() => setSelectedPanelItem(null)}
                    currentLanguage={currentLanguage}
                    themeConfig={themeConfig}
                />
            )}
        </div >
    );
};