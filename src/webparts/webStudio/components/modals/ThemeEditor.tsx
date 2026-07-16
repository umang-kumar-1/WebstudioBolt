
import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { DEFAULT_THEME } from '../../store';
import { LanguageCode, SiteConfig, ThemeTemplate } from '../../types';
import { generateThemeFromPrompt } from '../../services/geminiService';
import {
  Save, RefreshCw, Palette, Type, Wand2,
  Layout, MousePointer2, AlertCircle, Maximize, HelpCircle, CheckCircle, AlertTriangle, XCircle, LayoutTemplate, Info, X, ChevronDown, ArrowLeft
} from 'lucide-react';
import { getTranslation } from '../../store';
import { applyPageWidthToTheme } from '../../utils/pageWidth';
import { FONT_OPTIONS, extractPrimaryFontName } from '../../utils/fontCatalog';
import { FontWeightSelect } from '../common/FontWeightSelect';
import {
    resolveHeaderMenuFontFamily,
    resolveHeaderMenuFontWeight,
} from '../../utils/headerNavTypography';
import { ThemeTemplateGallery } from './ThemeTemplateManager';
import { applyStylingSiteConfig, buildThemeTemplateDraft, getDefaultStylingSiteConfig } from '../../utils/themeTemplateHelpers';
// import { EditTrigger } from './SharedModals';

const toCssSize = (val: string | undefined): string => {
  if (!val) return 'inherit';
  const trimmed = val.trim();
  if (!trimmed) return 'inherit';
  if (/(px|rem|em|%)$/i.test(trimmed)) return trimmed;
  if (/^-?\d*\.?\d+$/.test(trimmed)) return `${trimmed}px`;
  return trimmed;
};

// Extended Grouping with new categories
const GROUPS = {
  AI_THEME: {
    label: 'AI Theme Generation',
    icon: Wand2,
    vars: []
  },
  BRANDING: {
    label: 'Colors & Brand',
    icon: Palette,
    vars: [
      '--primary-color', '--secondary-color', '--brand-light', '--gradient-primary',
      '--text-primary', '--text-secondary', '--text-on-primary',
      '--link-color', '--link-hover-color',
      '--bg-body'
    ]
  },
  SITE_LAYOUT: {
    label: 'Header & Footer',
    icon: Layout,
    vars: [
      '--header-bg'
    ],
    siteConfigs: [
      'headerWidth', 'headerLogoHeight', 'headerNavHeight', 'headerTopBackgroundColor', 'headerBottomBackgroundColor',
      'navAlignment',
      'headerLogoText', 'headerLogoTextSpacing', 'headerLogoTextFontSize', 'headerLogoTextAlignment', 'headerTopAlignment', 'headerNavFontWeight',
      'headerNavHoverColor', 'headerSubmenuHoverBgColor', 'headerSubmenuHoverTextColor',
      'headerMenuTextTransform',
      'headerSubmenuWidth',
      'headerSubmenuTextTransform',
      'headerBreadcrumbHeight'
    ]
  },
  TYPOGRAPHY: {
    label: 'Typography',
    icon: Type,
    vars: [
      '--font-family-base', '--font-family-secondary', '--font-family-nav',
      '--font-size-base', '--font-size-p',
      '--heading-color',
      '--heading-h1-color', '--heading-h2-color', '--heading-h3-color',
      '--heading-h4-color', '--heading-h5-color', '--heading-h6-color',
      '--font-size-h1', '--font-size-h2', '--font-size-h3',
      '--font-size-h4', '--font-size-h5', '--font-size-h6',
      '--font-weight-bold'
    ],
    siteConfigs: [
      'headerMenuFontFamily',
      'headerMenuFontSize',
      'headerMenuFontWeight',
      'headerSubmenuFontFamily',
      'headerSubmenuFontSize',
      'headerSubmenuFontWeight',
      'headerBreadcrumbFontSize'
    ]
  },
  BUTTONS: {
    label: 'Buttons & UI',
    icon: MousePointer2,
    vars: [
      '--btn-primary-bg', '--btn-primary-text', '--btn-primary-hover-bg',
      '--btn-padding-x', '--btn-padding-y', '--btn-font-size',
      '--add-section-btn-bg', '--add-section-btn-text', '--add-section-btn-hover-bg',
      '--add-section-btn-font-size', '--add-section-btn-padding-x', '--add-section-btn-padding-y',
      '--add-section-line-color', '--add-section-line-thickness',
      '--border-radius-sm', '--border-radius-md', '--border-radius-lg',
      '--border-color'
    ]
  },
  STATUS: {
    label: 'Status & Alerts',
    icon: AlertCircle,
    vars: ['--status-success', '--status-warning', '--status-error']
  },
  ICONS: {
    label: 'Icons & Actions',
    icon: MousePointer2,
    vars: ['--icon-color', '--edit-icon-bg', '--edit-icon-color', '--edit-icon-hover-bg']
  },
  SIDEBAR: {
    label: 'Sidebar Navigation',
    icon: LayoutTemplate,
    vars: [
      '--sidebar-bg', '--sidebar-text', '--sidebar-text-muted', '--sidebar-border-color',
      '--sidebar-icon-color', '--sidebar-active-bg', '--sidebar-active-text-color',
      '--sidebar-active-indicator-color', '--sidebar-hover-bg', '--sidebar-button-color'
      // '--sidebar-link-color', '--sidebar-link-hover-color'
    ]
  },
  HELP: {
    label: 'Help & Guide',
    icon: HelpCircle,
    vars: []
  }
};

const VAR_DESCRIPTIONS: Record<string, string> = {
  '--primary-color': 'The main brand color used for primary UI elements such as models headings, models tabs, highlights, and active states across the application.',
  '--secondary-color': 'A secondary brand color used for complementary UI elements and accents.',
  '--brand-light': 'A lighter variation of the primary brand color, typically used for subtle backgrounds, highlights, or soft UI elements.',
  '--brand-dark': 'A darker variation of the primary brand color used for stronger emphasis, borders, or contrast areas.',
  '--gradient-primary': 'Primary gradient used for decorative backgrounds, banners, or highlighted sections.',

  '--text-primary': 'Default text color used for most body content and readable text across the application.',
  '--text-secondary': 'Muted or less prominent text color used for descriptions, labels, or secondary information.',
  '--text-on-primary': 'Text color used when content appears on top of a primary-colored background (e.g., button text).',

  '--link-color': 'Default color applied to hyperlinks within the content.',
  '--link-hover-color': 'Color applied to hyperlinks when the user hovers over them.',

  '--bg-body': 'Main background color of the entire application or page body.',

  '--header-bg': 'Background color of the top navigation header.',
  '--footer-bg': 'Background color of the website footer section.',
  '--logo-width': 'Width of the website logo displayed in the header.',

  '--footer-heading-color': 'Text color used for heading titles in the footer section.',
  '--footer-text-color': 'Text color used for general footer content and links.',

  '--font-import-url': 'URL used to import external web fonts (for example, from Google Fonts).',
  '--font-import-url-2': 'Optional second URL to import an additional external web font stylesheet.',
  '--font-family-base': 'Primary font family used for the main body text across the application.',
  '--font-family-secondary': 'Secondary font family used for headings or special text elements.',
  '--font-family-nav': 'Font family used for header logo text and navigation menu links.',
  '--font-size-base': 'Base font size used as the default size for most text content.',
  '--font-size-p': 'Font size specifically applied to paragraph text.',

  '--heading-color': 'Default text color applied to all heading elements (h1–h6) unless overridden.',
  '--heading-h1-color': 'Specific color used for H1 headings.',
  '--heading-h2-color': 'Specific color used for H2 headings.',
  '--heading-h3-color': 'Specific color used for H3 headings.',
  '--heading-h4-color': 'Specific color used for H4 headings.',
  '--heading-h5-color': 'Specific color used for H5 headings.',
  '--heading-h6-color': 'Specific color used for H6 headings.',

  '--font-size-h1': 'Font size used for H1 headings.',
  '--font-size-h2': 'Font size used for H2 headings.',
  '--font-size-h3': 'Font size used for H3 headings.',
  '--font-size-h4': 'Font size used for H4 headings.',
  '--font-size-h5': 'Font size used for H5 headings.',
  '--font-size-h6': 'Font size used for H6 headings.',

  '--font-weight-bold': 'Font weight used for bold text elements such as strong text or emphasized headings.',

  '--btn-primary-bg': 'Background color used for primary buttons.',
  '--btn-primary-text': 'Text color displayed on primary buttons.',
  '--btn-primary-hover-bg': 'Background color of primary buttons when hovered by the user.',

  '--btn-secondary-bg': 'Background color used for secondary buttons.',
  '--btn-secondary-text': 'Text color displayed on secondary buttons.',

  '--btn-padding-x': 'Horizontal padding inside buttons controlling left and right spacing.',
  '--btn-padding-y': 'Vertical padding inside buttons controlling top and bottom spacing.',
  '--btn-font-size': 'Font size applied to button text.',

  '--add-section-btn-bg': 'Background color of the "Add Sections Here" button shown between page sections in edit mode.',
  '--add-section-btn-text': 'Text color of the "Add Sections Here" button.',
  '--add-section-btn-hover-bg': 'Background color of the add-section button on hover.',
  '--add-section-btn-font-size': 'Font size of the add-section button label.',
  '--add-section-btn-padding-x': 'Horizontal padding inside the add-section button.',
  '--add-section-btn-padding-y': 'Vertical padding inside the add-section button.',
  '--add-section-line-color': 'Color of the horizontal line behind the add-section button.',
  '--add-section-line-thickness': 'Thickness of the horizontal add-section divider line (e.g. 2px).',

  '--border-radius-sm': 'Small border radius used for subtle rounding on UI elements.',
  '--border-radius-md': 'Medium border radius used for standard rounded UI elements.',
  '--border-radius-lg': 'Large border radius used for highly rounded components such as cards or modals.',

  '--border-color': 'Default color used for borders across UI components.',

  '--status-success': 'Color used to represent successful actions or messages.',
  '--status-warning': 'Color used to represent warning notifications or alerts.',
  '--status-error': 'Color used to represent errors or critical alerts.',

  '--icon-color': 'Default color used for icons throughout the interface.',
  '--edit-icon-bg': 'Background color of icons used in editable areas or editing controls.',
  '--edit-icon-color': 'Icon color used in editable sections.',
  '--edit-icon-hover-bg': 'Background color applied when hovering over editable icons.',

  '--sidebar-bg': 'Background color of the sidebar navigation area.',
  '--sidebar-text': 'Primary text color used for sidebar navigation items.',
  '--sidebar-text-muted': 'Muted text color used for less important sidebar content.',
  '--sidebar-border-color': 'Border color used within the sidebar layout.',
  '--sidebar-icon-color': 'Default color applied to sidebar icons.',

  '--sidebar-active-bg': 'Background color of the currently active sidebar navigation item.',
  '--sidebar-active-text-color': 'Text color of the active sidebar navigation item.',
  '--sidebar-active-indicator-color': 'Indicator color showing which sidebar item is currently active.',

  '--sidebar-hover-bg': 'Background color applied when hovering over sidebar items.',
  '--sidebar-button-color': 'Button color used within the sidebar.',
  '--sidebar-link-color': 'Default link color used inside the sidebar.',
  '--sidebar-link-hover-color': 'Link color displayed when hovering over sidebar links.'
};

// Descriptions for Site Layout / Header properties
const SITE_CONFIG_DESCRIPTIONS: Record<string, string> = {
  headerWidth: 'Controls whether site content spans the full browser width or a custom max width.',
  headerWidthCustom: 'Custom max width for page sections and header (e.g. 1280px, 90rem, 95%). Used when Page Width is set to Custom.',
  headerLogoHeight: 'Sets the height of the logo row when navigation is placed below the logo (Next Line layout). Accepts CSS values like 64px or 5rem.',
  headerNavHeight: 'Sets the height of the navigation/menu row. In single-line layouts this controls the overall header bar height.',
  headerTopBackgroundColor: 'Background color for the top portion of the header (logo row) when a two-row layout is active.',
  headerBottomBackgroundColor: 'Background color for the bottom navigation row when a two-row layout is active.',
  navAlignment: 'Aligns the navigation menu items horizontally: left, center, or right within the header container.',
  headerLogoText: 'Optional text displayed next to the logo image — supports multiple languages. Leave empty to hide.',
  headerLogoTextSpacing: 'Space between the logo image and the adjacent logo text. Accepts CSS values like 1rem or 16px.',
  headerLogoTextAlignment: 'Vertical alignment of the logo text relative to the logo image icon.',
  headerLogoTextFontSize: 'Font size for the logo text displayed in the header.',
  headerTopAlignment: 'Aligns the entire top header row (logo + optional text) horizontally: left, center, or right.',
  headerNavFontWeight: 'Sets the font weight (boldness) for the top navigation menu items. Accepts CSS values like 400, 600, 700, or bold.',
  headerNavHoverColor: 'Sets the text color for the top navigation menu items when the user hovers over them.',
  headerSubmenuHoverBgColor: 'Sets the background color for submenu (dropdown/flyout) items when hovered.',
  headerSubmenuHoverTextColor: 'Sets the text color for submenu items when hovered.',
  headerMenuFontSize: 'Font size for top navigation menu items.',
  headerMenuFontWeight: 'Font weight for top navigation menu items.',
  headerMenuLineHeight: 'Line height for top navigation menu items.',
  headerMenuFontFamily: 'Font family for top navigation menu items.',
  headerMenuTextTransform: 'Text transformation case style for top navigation menu items.',
  headerSubmenuWidth: 'Width of the submenu dropdown cards.',
  headerSubmenuFontSize: 'Font size for submenu dropdown links.',
  headerSubmenuFontWeight: 'Font weight for submenu dropdown links.',
  headerSubmenuLineHeight: 'Line height for submenu dropdown links.',
  headerSubmenuFontFamily: 'Font family for submenu dropdown links.',
  headerSubmenuTextTransform: 'Text transformation case style for submenu dropdown links.',
  headerBreadcrumbHeight: 'Sets the height of the breadcrumb trail bar.',
  headerBreadcrumbFontSize: 'Font size for breadcrumb trail navigation items.'
};

const InternalPreview = ({ uiLabels, currentLanguage, themeConfig, siteConfig }: { uiLabels: any, currentLanguage: any, themeConfig: any, siteConfig: any }) => {
  const logoText = siteConfig.headerLogoText?.[currentLanguage] || siteConfig.headerLogoText?.['en'] || '';
  const alignmentMap = {
    'up': 'items-start',
    'centre': 'items-center',
    'down': 'items-end'
  };
  const alignClass = alignmentMap[(siteConfig.headerLogoTextAlignment || 'centre') as keyof typeof alignmentMap] || 'items-center';
  const previewVars = Object.entries(themeConfig || {}).reduce((acc, [key, value]) => {
    (acc as any)[key] = String(value ?? '');
    return acc;
  }, {} as React.CSSProperties);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ ...previewVars, backgroundColor: themeConfig['--bg-body'] }}>

      {/* Preview Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <Maximize className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{getTranslation('LABEL_LIVE_PREVIEW', currentLanguage)}</span>
        <span className="ml-auto text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{getTranslation('MSG_UPDATES_INSTANTLY', currentLanguage)}</span>
      </div>

      {/* Scrollable Sections */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-0">

        {/* Header Preview */}
        <div className="shrink-0">
          <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100">Header</div>
          <div className="shadow-sm border-b border-[var(--border-color)]" style={{ backgroundColor: 'var(--header-bg)' }}>
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className={`font-bold flex ${alignClass} gap-2`} style={{ color: 'var(--primary-color)', fontSize: '0.85rem' }}>
                <div className="h-6 bg-[var(--primary-color)] opacity-20 rounded" style={{ width: 'var(--logo-width)', minWidth: '3rem' }}></div>
                <span style={{
                  paddingLeft: siteConfig.headerLogoTextSpacing || '0.5rem',
                  fontSize: siteConfig.headerLogoTextFontSize ? toCssSize(siteConfig.headerLogoTextFontSize) : 'inherit'
                }}>{logoText || 'Logo'}</span>
              </div>
              <div className="flex gap-4 tracking-wider" style={{
                color: 'var(--text-primary)',
                fontSize: siteConfig.headerMenuFontSize ? toCssSize(siteConfig.headerMenuFontSize) : '0.75rem',
                fontWeight: resolveHeaderMenuFontWeight(siteConfig),
                lineHeight: siteConfig.headerMenuLineHeight || 'normal',
                fontFamily: resolveHeaderMenuFontFamily(siteConfig, themeConfig),
                textTransform: (siteConfig.headerMenuTextTransform || 'uppercase') as any,
              }}>
                <span>{getTranslation('NAV_HOME', currentLanguage)}</span>
                <span>{getTranslation('NAV_ABOUT', currentLanguage)}</span>
                <span style={{ color: 'var(--link-color)' }}>{getTranslation('NAV_CONTACT', currentLanguage)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Typography */}
        <div className="shrink-0">
          <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100">Typography</div>
          <div className="p-4 bg-white border-b border-[var(--border-color)]">
            <h1 style={{ fontFamily: 'var(--font-family-secondary)', color: 'var(--heading-h1-color)', fontSize: 'clamp(1.1rem, 2vw, 1.5rem)', fontWeight: 'var(--font-weight-bold)', lineHeight: 1.2 }}>Heading 1 — Page Title</h1>
            <h2 style={{ fontFamily: 'var(--font-family-secondary)', color: 'var(--heading-h2-color)', fontSize: 'clamp(0.95rem, 1.5vw, 1.2rem)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.4rem' }}>Heading 2 — Section Title</h2>
            <h3 style={{ fontFamily: 'var(--font-family-secondary)', color: 'var(--heading-h3-color)', fontSize: 'clamp(0.85rem, 1.2vw, 1rem)', fontWeight: 'var(--font-weight-bold)', marginTop: '0.3rem' }}>Heading 3 — Sub-section</h3>
            <p style={{ fontFamily: 'var(--font-family-base)', color: 'var(--text-primary)', fontSize: 'var(--font-size-p)', marginTop: '0.6rem', lineHeight: '1.65' }}>
              This paragraph uses <strong>bold text</strong> and reacts to your global font settings in real time.
            </p>
            <p style={{ fontFamily: 'var(--font-family-base)', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.4rem', lineHeight: 1.5 }}>
              Secondary text — captions, labels, and helper info.
            </p>
            <div className="mt-3 flex gap-3">
              <a href="#" style={{ color: 'var(--link-color)', textDecoration: 'underline', fontSize: '0.85rem' }}>Normal Link</a>
              <a href="#" style={{ color: 'var(--link-hover-color)', textDecoration: 'underline', fontSize: '0.85rem' }}>Hovered Link</a>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="shrink-0">
          <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100">Buttons &amp; UI</div>
          <div className="p-4 bg-white border-b border-[var(--border-color)] flex gap-3 flex-wrap items-center">
            <button type="button" className="btn-primary font-semibold">Primary Button</button>
            <button type="button" className="btn-secondary">Secondary</button>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{getTranslation('LABEL_BORDER_RADIUS_SCALE', currentLanguage)}</span>
            <div className="flex gap-2">
              <div style={{ width: '1.5rem', height: '1.5rem', background: 'var(--primary-color)', borderRadius: 'var(--border-radius-sm)' }} />
              <div style={{ width: '1.5rem', height: '1.5rem', background: 'var(--primary-color)', borderRadius: 'var(--border-radius-md)' }} />
              <div style={{ width: '1.5rem', height: '1.5rem', background: 'var(--primary-color)', borderRadius: 'var(--border-radius-lg)' }} />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="shrink-0">
          <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100">Status Indicators</div>
          <div className="p-4 bg-white border-b border-[var(--border-color)] flex flex-col gap-2">
            <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: 'color-mix(in srgb, var(--status-success), white 90%)', borderLeft: '4px solid var(--status-success)' }}>
              <CheckCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--status-success)' }} />
              <span style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>{getTranslation('STATUS_OPERATION_SUCCESSFUL', currentLanguage)}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: 'color-mix(in srgb, var(--status-warning), white 90%)', borderLeft: '4px solid var(--status-warning)' }}>
              <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'var(--status-warning)' }} />
              <span style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>{getTranslation('STATUS_SYSTEM_WARNING', currentLanguage)}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: 'color-mix(in srgb, var(--status-error), white 90%)', borderLeft: '4px solid var(--status-error)' }}>
              <XCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--status-error)' }} />
              <span style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>{getTranslation('STATUS_CRITICAL_ERROR', currentLanguage)}</span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="shrink-0">
          <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100">Sidebar Navigation</div>
          <div className="border-b border-[var(--sidebar-border-color)]" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
            <div className="p-2 space-y-1">
              <div className="flex items-center gap-2 px-3 py-2 text-sm border-l-2"
                style={{ backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text-color)', borderLeftColor: 'var(--sidebar-active-indicator-color)' }}>
                <LayoutTemplate className="w-4 h-4" />
                <span className="font-semibold text-xs">{getTranslation('LABEL_ACTIVE_PAGE', currentLanguage)}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 text-sm border-l-2 border-transparent"
                style={{ color: 'var(--sidebar-text)' }}>
                <LayoutTemplate className="w-4 h-4" style={{ color: 'var(--sidebar-icon-color)' }} />
                <span className="text-xs">{getTranslation('LABEL_INACTIVE_PAGE', currentLanguage)}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 text-sm border-l-2 border-transparent"
                style={{ color: 'var(--sidebar-text-muted)' }}>
                <LayoutTemplate className="w-4 h-4" style={{ color: 'var(--sidebar-icon-color)', opacity: 0.5 }} />
                <span className="text-xs">{getTranslation('LABEL_HIDDEN_MUTED', currentLanguage)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0">
          <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100">Footer</div>
          <div className="p-4" style={{ backgroundColor: 'var(--footer-bg)' }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-bold mb-1.5 uppercase tracking-widest text-[10px]" style={{ color: 'var(--footer-heading-color)' }}>Company</h4>
                <p style={{ color: 'var(--footer-text-color)', fontSize: '11px', lineHeight: 1.6 }}>Legal · Privacy · Terms</p>
                <p style={{ color: 'var(--footer-text-color)', fontSize: '11px', lineHeight: 1.6, opacity: 0.7 }}>company@example.com</p>
              </div>
              <div>
                <h4 className="font-bold mb-1.5 uppercase tracking-widest text-[10px]" style={{ color: 'var(--footer-heading-color)' }}>Links</h4>
                <p style={{ color: 'var(--footer-text-color)', fontSize: '11px', lineHeight: 1.7, opacity: 0.7 }}>Privacy Policy</p>
                <p style={{ color: 'var(--footer-text-color)', fontSize: '11px', lineHeight: 1.7, opacity: 0.7 }}>Terms of Use</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export const ThemeEditor: React.FC = () => {
  const {
    siteConfig, themeConfig, closeModal, uiLabels, currentLanguage,
    addThemeTemplate, updateThemeTemplate,
  } = useStore();
  const [viewMode, setViewMode] = useState<'gallery' | 'editor'>('gallery');
  const [editingTemplate, setEditingTemplate] = useState<ThemeTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab] = useState<'DESIGN' | 'EXPORT'>('DESIGN');
  const [activeGroup, setActiveGroup] = useState<keyof typeof GROUPS>('BRANDING');
  const [draftThemeConfig, setDraftThemeConfig] = useState(() => ({ ...themeConfig }));
  const [draftSiteConfig, setDraftSiteConfig] = useState(() => ({
    ...siteConfig,
    headerLogoText: { ...(siteConfig.headerLogoText || {}) }
  }));
  const [openFontDropdown, setOpenFontDropdown] = useState<string | null>(null);
  const [fontSearchByKey, setFontSearchByKey] = useState<Record<string, string>>({});
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const fontDropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const onDocumentPointerDown = (event: MouseEvent) => {
      if (!openFontDropdown) return;
      const host = fontDropdownRefs.current[openFontDropdown];
      if (host && event.target instanceof Node && !host.contains(event.target)) {
        setOpenFontDropdown(null);
      }
    };
    document.addEventListener('mousedown', onDocumentPointerDown);
    return () => document.removeEventListener('mousedown', onDocumentPointerDown);
  }, [openFontDropdown]);

  const updateDraftHeaderConfig = (config: Record<string, any>) => {
    setDraftSiteConfig((prev: any) => {
      const next = { ...prev, ...config };
      if ('headerWidth' in config || 'headerWidthCustom' in config) {
        setDraftThemeConfig((themePrev: any) => applyPageWidthToTheme(next, themePrev));
      }
      return next;
    });
  };

  const renderFontFamilyDropdownInput = (
    labelText: string,
    val: string,
    onChange: (cssValue: string) => void,
    uniqueKey: string,
    description: string
  ) => {
    const selectedName = extractPrimaryFontName(val);
    const searchValue = fontSearchByKey[uniqueKey] || '';
    const query = searchValue.trim().toLowerCase();
    const filteredOptions = FONT_OPTIONS.filter((option) => {
      if (!query) return true;
      return (
        option.name.toLowerCase().includes(query) ||
        option.cssValue.toLowerCase().includes(query)
      );
    });

    const systemOptions = filteredOptions.filter((option) => option.source === 'system');
    const googleOptions = filteredOptions.filter((option) => option.source === 'google');
    const customOptions = filteredOptions.filter((option) => option.source === 'custom');

    const selectFont = (cssValue: string) => {
      onChange(cssValue);
      setOpenFontDropdown(null);
    };

    const renderFontOption = (option: { name: string; cssValue: string }) => (
      <button
        key={`${uniqueKey}-${option.name}`}
        type="button"
        onClick={() => selectFont(option.cssValue)}
        className={`w-full px-2 py-1.5 text-left text-sm hover:bg-blue-50 ${selectedName === option.name ? 'bg-blue-500 text-white hover:bg-blue-500' : 'text-gray-800'}`}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="truncate">{option.name}</span>
          <span
            className={`text-xs font-semibold tracking-wide ${selectedName === option.name ? 'text-white/90' : 'text-gray-500'}`}
            style={{ fontFamily: option.cssValue }}
            aria-hidden="true"
          >
            Aa
          </span>
        </span>
      </button>
    );

    return (
      <div
        key={uniqueKey}
        ref={(node) => { fontDropdownRefs.current[uniqueKey] = node; }}
        className="flex flex-col gap-1 mb-4 relative overflow-visible"
      >
        <div className="flex items-center gap-1.5 w-fit group relative cursor-pointer">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            {labelText}
          </label>
          <Info className="w-3.5 h-3.5 text-[var(--primary-color)] opacity-70 group-hover:opacity-100 transition-opacity" />
          <div
            className="
            absolute left-0 top-full mt-2
            opacity-0 group-hover:opacity-100
            pointer-events-none
            w-80 p-3 text-sm text-white
            bg-gray-800 rounded shadow-lg
            transition-opacity duration-200
            z-50
          "
          >
            {description}
            <div className="absolute bottom-full left-4 -mb-1 border-4 border-transparent border-b-gray-800"></div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpenFontDropdown((prev) => prev === uniqueKey ? null : uniqueKey)}
          className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 text-left text-sm bg-white focus:ring-2 focus:ring-blue-500 font-sans"
        >
          <span className="truncate">{selectedName || 'Select font'}</span>
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${openFontDropdown === uniqueKey ? 'rotate-180' : ''}`} />
        </button>

        {openFontDropdown === uniqueKey && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-300 shadow-lg z-[80] max-h-72 overflow-hidden">
            <div className="p-2 border-b border-gray-200">
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setFontSearchByKey((prev) => ({ ...prev, [uniqueKey]: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 text-sm outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                placeholder="Search fonts..."
              />
            </div>

            <div className="max-h-56 overflow-y-auto">
              {systemOptions.length > 0 && (
                <div className="px-2 py-2">
                  <div className="text-xs font-bold uppercase text-gray-500 mb-1">System Fonts</div>
                  {systemOptions.map(renderFontOption)}
                </div>
              )}

              {googleOptions.length > 0 && (
                <div className="px-2 py-2 border-t border-gray-100">
                  <div className="text-xs font-bold uppercase text-gray-500 mb-1">Google Fonts</div>
                  {googleOptions.map(renderFontOption)}
                </div>
              )}

              {customOptions.length > 0 && (
                <div className="px-2 py-2 border-t border-gray-100">
                  <div className="text-xs font-bold uppercase text-gray-500 mb-1">Custom Fonts</div>
                  {customOptions.map(renderFontOption)}
                </div>
              )}

              {filteredOptions.length === 0 && (
                <div className="px-3 py-3 text-sm text-gray-500">No fonts found.</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleCancel = () => {
    if (viewMode === 'editor') {
      setViewMode('gallery');
      setEditingTemplate(null);
      return;
    }
    closeModal();
  };

  const openCreateEditor = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setDraftThemeConfig({ ...DEFAULT_THEME });
    setDraftSiteConfig({
      ...siteConfig,
      ...getDefaultStylingSiteConfig(),
      headerLogoText: { en: '', ...(siteConfig.headerLogoText || {}) },
    });
    setActiveGroup('BRANDING');
    setViewMode('editor');
  };

  const openEditEditor = (template: ThemeTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.title);
    setDraftThemeConfig({ ...template.themeConfig });
    setDraftSiteConfig({
      ...applyStylingSiteConfig(siteConfig, template.stylingConfig || {}),
      headerLogoText: {
        en: '',
        ...(siteConfig.headerLogoText || {}),
        ...((template.stylingConfig?.headerLogoText as Record<string, string>) || {}),
      },
    });
    setActiveGroup('BRANDING');
    setViewMode('editor');
  };

  const persistTemplate = async (status: 'Draft' | 'Published') => {
    const title = templateName.trim();
    if (!title) {
      alert(getTranslation('PLACEHOLDER_THEME_NAME', currentLanguage));
      return;
    }

    setIsSaving(true);
    try {
      const mergedTheme = applyPageWidthToTheme(draftSiteConfig, draftThemeConfig);
      const draft = buildThemeTemplateDraft(draftSiteConfig as SiteConfig, mergedTheme, title, status);

      if (editingTemplate?.id) {
        await updateThemeTemplate({
          ...editingTemplate,
          ...draft,
        });
      } else {
        const saved = await addThemeTemplate(draft);
        if (saved) setEditingTemplate(saved);
      }
      setViewMode('gallery');
      setEditingTemplate(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = () => void persistTemplate('Draft');
  const handlePublish = () => void persistTemplate('Published');

  const normalizeSizeUnit = (value: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed) return trimmed;
    // Keep explicit units as-is.
    if (/(px|rem|em|%)$/i.test(trimmed)) return trimmed;
    // For bare numeric values, default to px.
    if (/^-?\d*\.?\d+$/.test(trimmed)) return `${trimmed}px`;
    return trimmed;
  };
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const newTheme = await generateThemeFromPrompt(aiPrompt);
      if (newTheme) {
        setDraftThemeConfig(applyPageWidthToTheme(draftSiteConfig, newTheme));
      } else {
        alert('AI theme generation failed. Please try again with a different description.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const getSpfxCode = () => {
    const vars = Object.entries(draftThemeConfig)
      .map(([k, v]) => `    root.style.setProperty('${k}', '${v}');`)
      .join('\n');

    return `
  /**
   * SPFx Application Customizer
   * ---------------------------
   * Copy this class to your SharePoint Framework project.
   * This injects the CMS variables at the root level of the site.
   */
  import { ApplicationCustomizerContext } from '@microsoft/sp-application-base';

  export default class WebStudioThemeInjector {
    constructor(private context: ApplicationCustomizerContext) {}

    public onInit(): Promise<void> {
      this.applyTheme();
      return Promise.resolve();
    }

    private applyTheme(): void {
      const root = document.documentElement;
      // -- Generated Variables --
  ${vars}

      // Font stylesheets are auto-managed by selected font family values.

      console.log("Web Studio Theme Applied Successfully");
    }
  }
      `.trim();
  };

  const renderInput = (key: string) => {
    const normalizedKey = key.toLowerCase();
    const val = draftThemeConfig[normalizedKey];

    const isColor =
      normalizedKey.includes("color") ||
      normalizedKey.includes("brand-") ||
      normalizedKey.includes("bg") ||
      normalizedKey.includes("hover") ||
      normalizedKey.includes("gradient") ||
      normalizedKey.startsWith("--text-") ||
      normalizedKey.startsWith("--heading") ||
      normalizedKey.startsWith("--link") ||
      normalizedKey.startsWith("--icon") ||
      normalizedKey.startsWith("--status") ||
      normalizedKey.startsWith("--sidebar-text");

    const isSize =
      normalizedKey.includes("size") ||
      normalizedKey.includes("padding") ||
      normalizedKey.includes("radius");

    const isUrl = normalizedKey.includes("url");
    const isFontFamilyField = normalizedKey === '--font-family-base' || normalizedKey === '--font-family-secondary' || normalizedKey === '--font-family-nav';

    if (isFontFamilyField) {
      const labelText = getTranslation(`THEME_VAR_${key}`, currentLanguage) ||
        key.replace("--", "").replace(/-/g, " ");
      const desc = VAR_DESCRIPTIONS[key] || `Controls typography font family for ${labelText}.`;
      return renderFontFamilyDropdownInput(
        labelText,
        val || '',
        (cssValue) => setDraftThemeConfig((prev: any) => ({ ...prev, [normalizedKey]: cssValue })),
        normalizedKey,
        desc
      );
    }

    if (normalizedKey === '--font-weight-bold') {
      const labelText = getTranslation(`THEME_VAR_${key}`, currentLanguage) ||
        key.replace("--", "").replace(/-/g, " ");
      return (
        <div key={key} className="flex flex-col gap-1 mb-4">
          <div className="flex items-center gap-1.5 w-fit group relative cursor-pointer">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{labelText}</label>
            <Info className="w-3.5 h-3.5 text-[var(--primary-color)] opacity-70 group-hover:opacity-100 transition-opacity" />
            <div className="absolute left-0 top-full mt-2 opacity-0 group-hover:opacity-100 pointer-events-none w-80 p-3 text-sm text-white bg-gray-800 rounded shadow-lg transition-opacity duration-200 z-50">
              {VAR_DESCRIPTIONS[key] || `Controls styling for ${key.replace("--", "")}.`}
              <div className="absolute bottom-full left-4 -mb-1 border-4 border-transparent border-b-gray-800" />
            </div>
          </div>
          <FontWeightSelect
            value={val}
            defaultValue="600"
            currentLanguage={currentLanguage}
            className="w-full text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] bg-white p-2 focus:outline-none focus:border-[var(--primary-color)]"
            onChange={(value) => setDraftThemeConfig((prev: any) => ({ ...prev, [normalizedKey]: value }))}
          />
        </div>
      );
    }

    return (
      <div key={key} className="flex flex-col gap-1 mb-4 relative overflow-visible">

        {/* Label + Info */}
        <div className="flex items-center gap-1.5 w-fit group relative cursor-pointer">

          <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            {getTranslation(`THEME_VAR_${key}`, currentLanguage) ||
              key.replace("--", "").replace(/-/g, " ")}
          </label>

          <Info className="w-3.5 h-3.5 text-[var(--primary-color)] opacity-70 group-hover:opacity-100 transition-opacity" />

          {/* Tooltip */}
          <div
            className="
          absolute left-0 top-full mt-2
          opacity-0 group-hover:opacity-100
          pointer-events-none
          w-80 p-3 text-sm text-white
          bg-gray-800 rounded shadow-lg
          transition-opacity duration-200
          z-50
        "
          >
            {VAR_DESCRIPTIONS[key] ||
              `Controls styling for ${key.replace("--", "")}.`}

            {/* Tooltip Arrow */}
            <div className="absolute bottom-full left-4 -mb-1 border-4 border-transparent border-b-gray-800"></div>
          </div>

        </div>

        {/* Input Section */}
        <div className="flex gap-2 items-center">

          {isColor && !normalizedKey.includes("gradient") && (
            <div className="relative cursor-pointer">

              <div
                className="w-10 h-10 border border-gray-300 shadow-sm"
                style={{ background: val }}
              />

              <input
                type="color"
                value={val?.startsWith("#") ? val : "#000000"}
                onChange={(e) =>
                  setDraftThemeConfig((prev: any) => ({ ...prev, [normalizedKey]: e.target.value }))
                }
                className="absolute inset-0 opacity-0 cursor-pointer"
              />

            </div>
          )}

          <input
            type="text"
            value={val || ""}
            onChange={(e) =>
              setDraftThemeConfig((prev: any) => ({ ...prev, [normalizedKey]: e.target.value }))
            }
            onBlur={(e) => {
              if (!isSize) return;
              const normalized = normalizeSizeUnit(e.target.value);
              if (normalized !== e.target.value) {
                setDraftThemeConfig((prev: any) => ({ ...prev, [normalizedKey]: normalized }));
              }
            }}
            className="flex-1 px-3 py-2 border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={
              isUrl
                ? "https://fonts.googleapis.com/..."
                : "Value"
            }
          />

          {isSize && (
            <span className="text-xs text-gray-400 font-mono w-8 text-right">
              px/rem
            </span>
          )}

        </div>

      </div>
    );
  };

  // Helper: label + info tooltip for site config fields
  const SiteConfigLabel = ({ cfgKey, labelText }: { cfgKey: string; labelText: string }) => (
    <div className="flex items-center gap-1.5 w-fit group relative cursor-default mb-1">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{labelText}</label>
      {SITE_CONFIG_DESCRIPTIONS[cfgKey] && (
        <>
          <Info className="w-3.5 h-3.5 text-[var(--primary-color)] opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          <div className="absolute left-0 top-full mt-2 opacity-0 group-hover:opacity-100 pointer-events-none w-72 p-3 text-sm text-white bg-gray-800 rounded shadow-lg transition-opacity duration-200 z-50">
            {SITE_CONFIG_DESCRIPTIONS[cfgKey]}
            <div className="absolute bottom-full left-4 -mb-1 border-4 border-transparent border-b-gray-800" />
          </div>
        </>
      )}
    </div>
  );

  const renderSiteConfigInput = (key: string) => {
    switch (key) {
      case 'headerWidth':
        return (
          <div key={key} className="flex flex-col gap-1 mb-4">
            <SiteConfigLabel cfgKey="headerWidth" labelText={getTranslation('NAV_PAGE_WIDTH', currentLanguage)} />
            <select
              value={(String(draftSiteConfig.headerWidth) === 'standard' ? 'custom' : draftSiteConfig.headerWidth) || 'full'}
              onChange={(e) => updateDraftHeaderConfig({ headerWidth: e.target.value as any })}
              className="w-full text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] bg-white p-2 focus:outline-none focus:border-[var(--primary-color)]"
            >
              <option value="full">{getTranslation('NAV_FULL_WIDTH', currentLanguage)}</option>
              <option value="custom">{getTranslation('NAV_PAGE_WIDTH_CUSTOM', currentLanguage)}</option>
            </select>
            {draftSiteConfig.headerWidth === 'custom' && (
              <input
                type="text"
                value={draftSiteConfig.headerWidthCustom || ''}
                onChange={(e) => updateDraftHeaderConfig({ headerWidthCustom: e.target.value })}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                placeholder={getTranslation('PLACEHOLDER_PAGE_WIDTH_CUSTOM', currentLanguage)}
              />
            )}
          </div>
        );
      case 'headerLogoHeight':
        if (draftSiteConfig.navPosition !== 'below_logo') return null;
        return (
          <div key={key} className="flex flex-col gap-1 mb-4">
            <SiteConfigLabel cfgKey="headerLogoHeight" labelText={getTranslation('NAV_LOGO_HEIGHT', currentLanguage)} />
            <input
              type="text"
              value={draftSiteConfig.headerLogoHeight || '64px'}
              onChange={(e) => updateDraftHeaderConfig({ headerLogoHeight: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
              placeholder="e.g. 64px, 5rem"
            />
          </div>
        );
      case 'headerNavHeight': {
        const navLabelKey = draftSiteConfig.navPosition === 'below_logo' ? 'NAV_MENU_HEIGHT' : 'NAV_HEADER_HEIGHT';
        return (
          <div key={key} className="flex flex-col gap-1 mb-4">
            <SiteConfigLabel cfgKey="headerNavHeight" labelText={getTranslation(navLabelKey, currentLanguage)} />
            <input
              type="text"
              value={draftSiteConfig.headerNavHeight || '64px'}
              onChange={(e) => updateDraftHeaderConfig({ headerNavHeight: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
              placeholder="e.g. 64px, 5rem"
            />
          </div>
        );
      }
      case 'headerTopBackgroundColor':
      case 'headerBottomBackgroundColor': {
        const labelKey = key === 'headerTopBackgroundColor' ? 'NAV_HEADER_TOP_BG' : 'NAV_HEADER_BOTTOM_BG';
        return (
          <div key={key} className="flex flex-col gap-1 mb-4">
            <SiteConfigLabel cfgKey={key} labelText={getTranslation(labelKey, currentLanguage)} />
            <div className="flex gap-2 items-center bg-white p-1 border border-gray-300 rounded-sm">
              <input type="color" value={(draftSiteConfig as any)[key] || '#ffffff'} onChange={(e) => updateDraftHeaderConfig({ [key]: e.target.value })} className="h-8 w-8 p-0 border border-gray-200 rounded-sm cursor-pointer" />
              <input
                type="text"
                value={(draftSiteConfig as any)[key] || '#ffffff'}
                onChange={(e) => updateDraftHeaderConfig({ [key]: e.target.value })}
                className="flex-1 px-2 py-1 text-xs text-gray-500 font-mono border-none focus:ring-0 outline-none"
                placeholder="#ffffff"
              />
            </div>
          </div>
        );
      }
      case 'navAlignment':
        return (
          <div key={key} className="flex flex-col gap-1 mb-4">
            <SiteConfigLabel cfgKey="navAlignment" labelText={getTranslation('NAV_ROW_ALIGNMENT', currentLanguage)} />
            <div className="flex gap-4 p-2 bg-gray-50 border border-gray-200 rounded-sm">
              {['left', 'center', 'right'].map(align => (
                <label key={align} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="navAlignTheme" checked={draftSiteConfig.navAlignment === align} onChange={() => updateDraftHeaderConfig({ navAlignment: align as any })} className="text-[var(--primary-color)] focus:ring-[var(--primary-color)]" />
                  <span className="text-sm text-gray-600 capitalize">{align}</span>
                </label>
              ))}
            </div>
          </div>
        );
      case 'headerNavFontWeight':
      case 'headerMenuFontWeight':
      case 'headerSubmenuFontWeight': {
        const labels: Record<string, string> = {
          headerNavFontWeight: 'NAV_NAV_FONT_WEIGHT',
          headerMenuFontWeight: 'NAV_MENU_FONT_WEIGHT',
          headerSubmenuFontWeight: 'NAV_SUBMENU_FONT_WEIGHT'
        };
        const defaults: Record<string, string> = {
          headerNavFontWeight: '700',
          headerMenuFontWeight: '500',
          headerSubmenuFontWeight: '700',
        };
        const syncNavMenuWeight = (value: string) => {
          if (key === 'headerNavFontWeight') {
            updateDraftHeaderConfig({ headerNavFontWeight: value, headerMenuFontWeight: value });
            return;
          }
          updateDraftHeaderConfig({ [key]: value });
        };
        const selectedWeight = key === 'headerNavFontWeight'
          ? resolveHeaderMenuFontWeight(draftSiteConfig as Partial<SiteConfig>)
          : (draftSiteConfig as any)[key];
        return (
          <div key={key} className="flex flex-col gap-1 mb-4">
            <SiteConfigLabel cfgKey={key} labelText={getTranslation(labels[key], currentLanguage)} />
            <FontWeightSelect
              value={selectedWeight}
              defaultValue={defaults[key]}
              currentLanguage={currentLanguage}
              className="w-full text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] bg-white p-2 focus:outline-none focus:border-[var(--primary-color)]"
              onChange={syncNavMenuWeight}
            />
          </div>
        );
      }
      case 'headerNavHoverColor':
      case 'headerSubmenuHoverBgColor':
      case 'headerSubmenuHoverTextColor': {
        const labels: Record<string, string> = {
          headerNavHoverColor: 'NAV_NAV_HOVER_COLOR',
          headerSubmenuHoverBgColor: 'NAV_SUBMENU_HOVER_BG',
          headerSubmenuHoverTextColor: 'NAV_SUBMENU_HOVER_TEXT'
        };
        return (
          <div key={key} className="flex flex-col gap-1 mb-4">
            <SiteConfigLabel cfgKey={key} labelText={getTranslation(labels[key], currentLanguage)} />
            <div className="flex gap-2 items-center bg-white p-1 border border-gray-300 rounded-sm">
              <input type="color" value={(draftSiteConfig as any)[key] || '#ffffff'} onChange={(e) => updateDraftHeaderConfig({ [key]: e.target.value })} className="h-8 w-8 p-0 border border-gray-200 rounded-sm cursor-pointer" />
              <input
                type="text"
                value={(draftSiteConfig as any)[key] || '#ffffff'}
                onChange={(e) => updateDraftHeaderConfig({ [key]: e.target.value })}
                className="flex-1 px-2 py-1 text-xs text-gray-500 font-mono border-none focus:ring-0 outline-none"
                placeholder="#ffffff"
              />
            </div>
          </div>
        );
      }
      case 'headerLogoText':
        return (
          <div key={key} className="flex flex-col gap-1 mb-4 col-span-full">
            <SiteConfigLabel cfgKey="headerLogoText" labelText={getTranslation('NAV_HEADER_LOGO_TEXT', currentLanguage)} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
              {draftSiteConfig.languages.map((lang: LanguageCode) => (
                <div key={lang} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 w-6 uppercase">{lang}</span>
                  <input
                    type="text"
                    value={draftSiteConfig.headerLogoText?.[lang] || ''}
                    onChange={(e) => updateDraftHeaderConfig({
                      headerLogoText: { ...draftSiteConfig.headerLogoText, [lang]: e.target.value } as any
                    })}
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none transition-shadow"
                    placeholder={`Text in ${lang}...`}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      case 'headerLogoTextSpacing':
        return (
          <div key={key} className="flex flex-col gap-1 mb-4">
            <SiteConfigLabel cfgKey="headerLogoTextSpacing" labelText={getTranslation('NAV_HEADER_TEXT_SPACING', currentLanguage)} />
            <input
              type="text"
              value={draftSiteConfig.headerLogoTextSpacing || '1rem'}
              onChange={(e) => updateDraftHeaderConfig({ headerLogoTextSpacing: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
              placeholder="e.g. 1rem or 20px"
            />
          </div>
        );
      case 'headerLogoTextAlignment':
        return (
          <div key={key} className="flex flex-col gap-1 mb-4">
            <SiteConfigLabel cfgKey="headerLogoTextAlignment" labelText={getTranslation('NAV_HEADER_LOGO_TEXT_ALIGNMENT', currentLanguage)} />
            <div className="flex gap-4 p-2 bg-gray-50 border border-gray-200 rounded-sm">
              {[
                { value: 'up', labelKey: 'NAV_LOGO_TEXT_UP' },
                { value: 'centre', labelKey: 'NAV_LOGO_TEXT_CENTRE' },
                { value: 'down', labelKey: 'NAV_LOGO_TEXT_DOWN' }
              ].map(item => (
                <label key={item.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="logoTextAlign"
                    checked={draftSiteConfig.headerLogoTextAlignment === item.value}
                    onChange={() => updateDraftHeaderConfig({ headerLogoTextAlignment: item.value as any })}
                    className="text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                  />
                  <span className="text-sm text-gray-600">{getTranslation(item.labelKey, currentLanguage)}</span>
                </label>
              ))}
            </div>
          </div>
        );
      case 'headerLogoTextFontSize':
        return (
          <div key={key} className="flex flex-col gap-1 mb-4">
            <SiteConfigLabel cfgKey={key} labelText={getTranslation('NAV_HEADER_LOGO_TEXT_FONT_SIZE', currentLanguage)} />
            <input
              type="text"
              value={draftSiteConfig.headerLogoTextFontSize || ''}
              onChange={(e) => updateDraftHeaderConfig({ headerLogoTextFontSize: e.target.value })}
              onBlur={(e) => {
                const normalized = normalizeSizeUnit(e.target.value);
                if (normalized !== e.target.value) {
                  updateDraftHeaderConfig({ headerLogoTextFontSize: normalized });
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
              placeholder="e.g. 24px, 1.5rem"
            />
          </div>
        );
      case 'headerTopAlignment':
        return (
          <div key={key} className="flex flex-col gap-1 mb-4">
            <SiteConfigLabel cfgKey="headerTopAlignment" labelText={getTranslation('NAV_TOP_ALIGNMENT', currentLanguage)} />
            <div className="flex gap-4 p-2 bg-gray-50 border border-gray-200 rounded-sm">
              {['left', 'center', 'right'].map(align => (
                <label key={align} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="topAlignTheme"
                    checked={draftSiteConfig.headerTopAlignment === align}
                    onChange={() => updateDraftHeaderConfig({ headerTopAlignment: align as any })}
                    className="text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                  />
                  <span className="text-sm text-gray-600 capitalize">{align}</span>
                </label>
              ))}
            </div>
          </div>
        );
      case 'headerMenuHeading':
        return (
          <div key={key} className="col-span-full mt-6 border-t border-gray-200 pt-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Menu Typography</h3>
          </div>
        );
      case 'headerSubmenuHeading':
        return (
          <div key={key} className="col-span-full mt-6 border-t border-gray-200 pt-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Submenu Settings</h3>
          </div>
        );
      case 'headerSubmenuTypographyHeading':
        return (
          <div key={key} className="col-span-full mt-6 border-t border-gray-200 pt-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Submenu Typography</h3>
          </div>
        );
      case 'headerMenuFontFamily':
        return renderFontFamilyDropdownInput(
          getTranslation('NAV_MENU_FONT_FAMILY', currentLanguage),
          draftSiteConfig.headerMenuFontFamily || '',
          (cssValue) => updateDraftHeaderConfig({ headerMenuFontFamily: cssValue }),
          'headerMenuFontFamily',
          'Sets the font family for top navigation menu items.'
        );
      case 'headerSubmenuFontFamily':
        return renderFontFamilyDropdownInput(
          getTranslation('NAV_SUBMENU_FONT_FAMILY', currentLanguage),
          draftSiteConfig.headerSubmenuFontFamily || '',
          (cssValue) => updateDraftHeaderConfig({ headerSubmenuFontFamily: cssValue }),
          'headerSubmenuFontFamily',
          'Sets the font family for submenu dropdown items.'
        );
      case 'headerMenuFontSize':
      case 'headerMenuLineHeight':
      case 'headerSubmenuFontSize':
      case 'headerSubmenuLineHeight':
      case 'headerSubmenuWidth':
      case 'headerBreadcrumbHeight':
      case 'headerBreadcrumbFontSize': {
        const labels: Record<string, string> = {
          headerMenuFontSize: 'NAV_MENU_FONT_SIZE',
          headerMenuLineHeight: 'NAV_MENU_LINE_HEIGHT',
          headerSubmenuFontSize: 'NAV_SUBMENU_FONT_SIZE',
          headerSubmenuLineHeight: 'NAV_SUBMENU_LINE_HEIGHT',
          headerSubmenuWidth: 'NAV_SUBMENU_WIDTH',
          headerBreadcrumbHeight: 'NAV_BREADCRUMB_HEIGHT',
          headerBreadcrumbFontSize: 'NAV_BREADCRUMB_FONT_SIZE'
        };
        const placeholder = key.toLowerCase().includes('size') || key.toLowerCase().includes('height') || key === 'headerSubmenuWidth' ? 'e.g. 18px, 1.2rem' : 'e.g. 1.4, 1.5';
        const isSizeField = key.toLowerCase().includes('size') || key.toLowerCase().includes('height') || key === 'headerSubmenuWidth';
        return (
          <div key={key} className="flex flex-col gap-1 mb-4">
            <SiteConfigLabel cfgKey={key} labelText={getTranslation(labels[key], currentLanguage)} />
            <input
              type="text"
              value={(draftSiteConfig as any)[key] || ''}
              onChange={(e) => updateDraftHeaderConfig({ [key]: e.target.value })}
              onBlur={(e) => {
                if (!isSizeField) return;
                const normalized = normalizeSizeUnit(e.target.value);
                if (normalized !== e.target.value) {
                  updateDraftHeaderConfig({ [key]: normalized });
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
              placeholder={placeholder}
            />
          </div>
        );
      }
      case 'headerMenuTextTransform':
      case 'headerSubmenuTextTransform': {
        const labels: Record<string, string> = {
          headerMenuTextTransform: 'NAV_MENU_TEXT_TRANSFORM',
          headerSubmenuTextTransform: 'NAV_SUBMENU_TEXT_TRANSFORM'
        };
        const options = [
          { value: 'none', label: 'None' },
          { value: 'uppercase', label: 'Uppercase' },
          { value: 'lowercase', label: 'Lowercase' },
          { value: 'capitalize', label: 'Capitalize (Sentence Case)' }
        ];
        return (
          <div key={key} className="flex flex-col gap-1 mb-4">
            <SiteConfigLabel cfgKey={key} labelText={getTranslation(labels[key], currentLanguage)} />
            <select
              value={(draftSiteConfig as any)[key] || 'none'}
              onChange={(e) => updateDraftHeaderConfig({ [key]: e.target.value })}
              className="w-full text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-[var(--primary-color)] bg-white p-2 focus:outline-none focus:border-[var(--primary-color)]"
            >
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[85vh] min-h-[85vh] max-h-[85vh] w-[80vw] min-w-[80vw] max-w-[80vw] bg-white rounded-none shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          {viewMode === 'editor' && (
            <button
              type="button"
              onClick={() => { setViewMode('gallery'); setEditingTemplate(null); }}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors"
              title={getTranslation('BTN_BACK', currentLanguage)}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="bg-[var(--brand-light)] p-2 rounded-none">
            <Palette className="w-6 h-6 text-[var(--primary-color)]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {viewMode === 'gallery'
                ? getTranslation('STYLING', currentLanguage)
                : (editingTemplate
                  ? getTranslation('TITLE_EDIT_THEME_TEMPLATE', currentLanguage)
                  : getTranslation('TITLE_CREATE_THEME_TEMPLATE', currentLanguage))}
            </h2>
          </div>
        </div>
        <button
          onClick={handleCancel}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors rounded-none"
          title={getTranslation('BTN_CANCEL', currentLanguage)}
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {viewMode === 'gallery' ? (
          <ThemeTemplateGallery onCreate={openCreateEditor} onEdit={openEditEditor} />
        ) : activeTab === 'DESIGN' ? (
          <div className="flex w-full">
            {/* Sidebar Categories */}
            <div className="w-64 min-w-[16rem] bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0">

              <div className="p-4 space-y-1 overflow-y-auto flex-1">
                {Object.entries(GROUPS).map(([key, group]) => {
                  const Icon = group.icon;

                  return (
                    <button
                      key={key}
                      onClick={() => setActiveGroup(key as any)}
                      className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-medium transition-all text-left
            ${activeGroup === key
                          ? 'bg-[var(--brand-light)] text-[var(--primary-color)] ring-1 ring-[var(--primary-color)]/20 shadow-sm'
                          : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        {getTranslation(`THEME_GROUP_${key}`, currentLanguage) || key}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    if (confirm('Are you sure? This will revert all styles to the default system theme.')) {
                      setDraftThemeConfig({ ...DEFAULT_THEME });
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold uppercase transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  {getTranslation('BTN_RESET_DEFAULTS', currentLanguage)}
                </button>
              </div>

            </div>

            {/* Config Area */}
            <div className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-visible bg-white p-8 pt-12 border-r border-gray-200">
              <div className="mb-8 max-w-md">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-2">
                  {getTranslation('LABEL_THEME_NAME', currentLanguage)}
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder={getTranslation('PLACEHOLDER_THEME_NAME', currentLanguage)}
                  className="w-full px-3 py-2 border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Special Help Tab Content */}
              {activeGroup === 'HELP' ? (
                <div className="space-y-8 w-full">
                  <div className="p-8 bg-blue-50 rounded-none border border-blue-100">
                    <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 shrink-0" />
                      {getTranslation('TITLE_HOW_IT_WORKS', currentLanguage)}
                    </h3>
                    <p className="text-blue-800 text-sm leading-relaxed">
                      {getTranslation('DESC_HOW_IT_WORKS', currentLanguage)}
                    </p>
                  </div>

                  <div className="w-full">
                    <h4 className="font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4 text-sm uppercase tracking-wide">
                      {getTranslation('TITLE_HELP_GETTING_STARTED', currentLanguage)}
                    </h4>
                    <ol className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm text-gray-700">
                      {[1, 2, 3, 4, 5].map((step) => (
                        <li key={step} className="flex gap-3 p-4 bg-gray-50 border border-gray-100">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary-color)] text-white text-xs font-bold">
                            {step}
                          </span>
                          <span className="leading-relaxed pt-0.5">{getTranslation(`HELP_STEP_${step}`, currentLanguage)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="w-full">
                    <h4 className="font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4 text-sm uppercase tracking-wide">
                      {getTranslation('TITLE_HELP_TABS_GUIDE', currentLanguage)}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                      {[
                        { key: 'HELP_TAB_AI_THEME', icon: Wand2 },
                        { key: 'HELP_TAB_BRANDING', icon: Palette },
                        { key: 'HELP_TAB_LAYOUT', icon: Layout },
                        { key: 'HELP_TAB_TYPOGRAPHY', icon: Type },
                        { key: 'HELP_TAB_BUTTONS', icon: MousePointer2 },
                        { key: 'HELP_TAB_STATUS', icon: AlertCircle },
                        { key: 'HELP_TAB_ICONS', icon: MousePointer2 },
                        { key: 'HELP_TAB_SIDEBAR', icon: LayoutTemplate },
                      ].map(({ key, icon: Icon }) => (
                        <div key={key} className="flex gap-3 p-4 bg-white border border-gray-200">
                          <Icon className="w-4 h-4 text-[var(--primary-color)] shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{getTranslation(key, currentLanguage)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                    <div className="p-6 bg-gray-50 border border-gray-200">
                      <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        {getTranslation('TITLE_HELP_TIPS', currentLanguage)}
                      </h4>
                      <ul className="space-y-3 text-sm text-gray-700">
                        <li className="flex gap-2 leading-relaxed"><span className="text-[var(--primary-color)] font-bold shrink-0">•</span>{getTranslation('HELP_TIP_PREVIEW', currentLanguage)}</li>
                        <li className="flex gap-2 leading-relaxed"><span className="text-[var(--primary-color)] font-bold shrink-0">•</span>{getTranslation('HELP_TIP_SAVE', currentLanguage)}</li>
                        <li className="flex gap-2 leading-relaxed"><span className="text-[var(--primary-color)] font-bold shrink-0">•</span>{getTranslation('HELP_TIP_RESET', currentLanguage)}</li>
                        <li className="flex gap-2 leading-relaxed"><span className="text-[var(--primary-color)] font-bold shrink-0">•</span>{getTranslation('HELP_TIP_AI', currentLanguage)}</li>
                      </ul>
                    </div>

                    <div className="p-6 bg-amber-50 border border-amber-100">
                      <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <Info className="w-4 h-4" />
                        {getTranslation('TITLE_HELP_IMPORTANT', currentLanguage)}
                      </h4>
                      <p className="text-sm text-amber-900 leading-relaxed">
                        {getTranslation('HELP_IMPORTANT_NOTE', currentLanguage)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : activeGroup === 'AI_THEME' ? (
                <div className="space-y-8 w-full">
                  <div className="w-full bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-none p-8 border border-purple-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Wand2 className="w-5 h-5 text-purple-600" />
                      <h3 className="text-base font-bold text-purple-900 uppercase tracking-wide">
                        {getTranslation('TITLE_AI_THEME', currentLanguage)}
                      </h3>
                    </div>
                    <p className="text-sm text-purple-800/80 mb-4 leading-relaxed">
                      {getTranslation('DESC_AI_THEME_GLOBAL', currentLanguage)}
                    </p>
                    <div className="flex gap-2 w-full">
                      <input
                        type="text"
                        placeholder={getTranslation('PLACEHOLDER_AI_PROMPT', currentLanguage)}
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        className="flex-1 min-w-0 px-4 py-3 border border-purple-200 rounded-none focus:ring-2 focus:ring-purple-400 outline-none text-sm bg-white"
                        onKeyDown={(e) => e.key === 'Enter' && !isGenerating && handleAiGenerate()}
                        disabled={isGenerating}
                      />
                      <button
                        type="button"
                        onClick={handleAiGenerate}
                        disabled={isGenerating || !aiPrompt.trim()}
                        className="px-8 py-3 bg-purple-600 text-white rounded-none hover:bg-purple-700 font-medium disabled:opacity-50 text-sm shadow-sm transition-transform active:scale-95 shrink-0"
                      >
                        {isGenerating ? getTranslation('BTN_DREAMING', currentLanguage) : getTranslation('BTN_GENERATE', currentLanguage)}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                    <div className="p-6 bg-gray-50 border border-gray-200 rounded-none h-full">
                      <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Info className="w-4 h-4 text-[var(--primary-color)]" />
                        {getTranslation('TITLE_AI_THEME_HELP', currentLanguage)}
                      </h4>
                      <ol className="space-y-3 text-sm text-gray-600 list-decimal list-inside">
                        <li>{getTranslation('AI_THEME_HELP_STEP_1', currentLanguage)}</li>
                        <li>{getTranslation('AI_THEME_HELP_STEP_2', currentLanguage)}</li>
                        <li>{getTranslation('AI_THEME_HELP_STEP_3', currentLanguage)}</li>
                        <li>{getTranslation('AI_THEME_HELP_STEP_4', currentLanguage)}</li>
                        <li>{getTranslation('AI_THEME_HELP_STEP_5', currentLanguage)}</li>
                      </ol>
                    </div>

                    <div className="space-y-5 h-full flex flex-col">
                      <div className="p-4 bg-amber-50 border border-amber-100 rounded-none text-sm text-amber-900 leading-relaxed">
                        {getTranslation('AI_THEME_HELP_NOTE', currentLanguage)}
                      </div>
                      <ul className="space-y-2 text-sm text-gray-500 flex-1">
                        <li className="flex gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <span>{getTranslation('AI_THEME_HELP_INCLUDES', currentLanguage)}</span>
                        </li>
                        <li className="flex gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <span>{getTranslation('AI_THEME_HELP_EXCLUDES', currentLanguage)}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                /* Standard Config Inputs */
                <>
                  {/* Variable Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-visible">
                    {GROUPS[activeGroup].vars.map(renderInput)}
                    {(GROUPS[activeGroup] as any).siteConfigs?.map(renderSiteConfigInput)}
                  </div>
                </>
              )}
            </div>

            {/* Live Preview Panel */}
            <div className="min-w-[360px] w-[360px] bg-gray-50 border-l border-gray-200 flex-shrink-0 flex flex-col overflow-hidden">
              <InternalPreview uiLabels={uiLabels} currentLanguage={currentLanguage} themeConfig={draftThemeConfig} siteConfig={draftSiteConfig} />
            </div>
          </div>
        ) : (
          /* Export View */
          <div className="flex-1 bg-gray-900 p-0 overflow-hidden flex flex-col">
            <div className="flex border-b border-gray-700">
              <div className="px-6 py-3 text-gray-300 text-xs font-mono border-r border-gray-700 bg-gray-800">SPFx Application Customizer</div>
              <div className="px-6 py-3 text-gray-500 text-xs font-mono hover:text-gray-300 cursor-pointer">theme.json</div>
              <div className="px-6 py-3 text-gray-500 text-xs font-mono hover:text-gray-300 cursor-pointer">style.css</div>
            </div>
            <pre className="flex-1 p-6 text-green-400 font-mono text-xs overflow-auto leading-relaxed">
              {getSpfxCode()}
            </pre>
          </div>
        )}
      </div>

      {/* Footer */}
      {viewMode === 'editor' && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <span className="text-xs text-gray-400"></span>
          <div className="flex gap-3">
            <button type="button" onClick={handleCancel} className="btn-secondary transition-colors inline-flex items-center justify-center">
              {getTranslation('BTN_CANCEL', currentLanguage)}
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="btn-secondary shadow-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {isSaving ? getTranslation('MSG_SAVING', currentLanguage) : getTranslation('BTN_SAVE_DRAFT', currentLanguage)}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isSaving}
              className="btn-primary shadow-md inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {isSaving ? getTranslation('MSG_SAVING', currentLanguage) : getTranslation('BTN_PUBLISH', currentLanguage)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
