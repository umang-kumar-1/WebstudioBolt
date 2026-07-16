import { ContainerType, SectionTemplate, MultilingualText, Container } from '../types';
import { baseMultilingualText } from './containerContentHelpers';

const COLOR_HEADER_DEFAULT_BG = '#ebebeb';

const hasMultilingualText = (value: unknown): boolean => {
    if (!value) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).some(
            (v) => typeof v === 'string' && v.trim().length > 0
        );
    }
    return false;
};

const ensureMultilingualField = (value: unknown, fallback: string): MultilingualText => {
    if (hasMultilingualText(value)) {
        if (typeof value === 'string') return baseMultilingualText(value);
        return { ...(value as MultilingualText) };
    }
    return baseMultilingualText(fallback);
};

/** Keep hero templateId and bgType in sync so PreviewArea renders correctly. */
export const normalizeHeroTemplateSettings = (settings: Record<string, unknown>): Record<string, unknown> => {
    const s = { ...settings };
    let bgType = String(s.bgType || '').toLowerCase();
    let templateId = String(s.templateId || '');

    if (!templateId) {
        if (bgType === 'color') templateId = 'color_header';
        else if (bgType === 'image') templateId = 'hero_img';
        else if (bgType === 'layout') templateId = 'visual_text';
        else templateId = 'page_content';
    }

    if (!bgType || bgType === 'none') {
        if (templateId === 'color_header') bgType = 'color';
        else if (templateId === 'hero_img') bgType = 'image';
        else if (templateId === 'visual_text') bgType = 'layout';
        else bgType = 'none';
    }

    s.templateId = templateId;
    s.bgType = bgType;

    if (bgType === 'color') {
        const raw = String(s.bgColor || '').trim().toLowerCase();
        if (!raw || raw === '#ffffff' || raw === '#fff') {
            s.bgColor = COLOR_HEADER_DEFAULT_BG;
        }
        s.titleColor = s.titleColor || 'site';
        s.subtitleColor = s.subtitleColor || 'site';
    }

    if (bgType === 'image') {
        s.titleColor = s.titleColor || 'white';
        s.subtitleColor = s.subtitleColor || 'white';
        s.minHeight = s.minHeight || 'full';
        s.heroHeightMode = s.heroHeightMode || 'full';
    }

    if (bgType === 'layout') {
        s.layoutVariant = s.layoutVariant || 'img_left';
        s.align = s.align || 'left';
        s.bgColor = s.bgColor || '#ffffff';
        s.letterCase = s.letterCase || 'uppercase';
    }

    if (templateId === 'page_content') {
        s.letterCase = s.letterCase || 'sentence';
        s.align = s.align || 'center';
    }

    if (s.showHeader === undefined) s.showHeader = true;
    if (s.showSubheading === undefined) s.showSubheading = true;
    if (s.minHeight === undefined && bgType !== 'image') s.minHeight = 'medium';
    if (s.align === undefined) s.align = 'center';
    if (s.templateVariant === undefined) {
        s.templateVariant = templateId === 'hero_img' ? 1 : (templateId === 'page_content' || templateId === 'color_header' ? 1 : 2);
    }

    return s;
};

export const normalizeCardGridTemplateSettings = (settings: Record<string, unknown>): Record<string, unknown> => {
    const s = { ...settings };
    if (!s.source) s.source = 'News';
    if (!s.columns) s.columns = 3;
    if (!s.layout) s.layout = 'grid';
    if (!s.ordering) s.ordering = '123';
    if (!Array.isArray(s.taggedItems)) s.taggedItems = [];
    if (s.showAllWithoutTagging === undefined) s.showAllWithoutTagging = false;
    if (s.showHeader === undefined) s.showHeader = true;
    if (s.showSubheading === undefined) s.showSubheading = true;
    if (s.showDescription === undefined) s.showDescription = true;
    if (!s.imgPos) s.imgPos = 'top';
    if (!s.border) s.border = 'sharp';
    return s;
};

/** Keep image/text vs gallery slider settings consistent for templates and page containers. */
export const normalizeSliderTemplateSettings = (settings: Record<string, unknown>): Record<string, unknown> => {
    const s = { ...settings };
    const rawId = String(s.templateId || '').toLowerCase();
    const isImageText = rawId === 'img_text' || (rawId !== 'img_gallery' && s.templateVariant !== 1 && s.templateVariant !== '1');
    s.templateId = isImageText ? 'img_text' : 'img_gallery';
    s.templateVariant = isImageText ? 0 : 1;
    s.source = s.source || 'ImageSlider';
    if (!Array.isArray(s.taggedItems)) s.taggedItems = [];
    if (!Array.isArray(s.slides)) s.slides = [];
    if (s.showHeader === undefined) s.showHeader = true;
    if (s.showSubheading === undefined) s.showSubheading = true;
    if (s.showDescription === undefined) s.showDescription = true;
    if (s.showSlideTitle === undefined) s.showSlideTitle = true;
    if (s.showSlideDescription === undefined) s.showSlideDescription = true;
    if (!s.align) s.align = 'left';
    if (!s.contentAlign) s.contentAlign = s.align;
    if (!s.letterCase) s.letterCase = 'uppercase';
    if (s.autoplay === undefined) s.autoplay = true;
    if (!s.speed) s.speed = 5;
    if (s.arrows === undefined) s.arrows = true;
    if (s.dots === undefined) s.dots = true;
    if (!s.ordering) s.ordering = '123';
    if (!s.readMoreBehavior) s.readMoreBehavior = 'popup';
    if (!s.readMoreDisplayType) s.readMoreDisplayType = 'link';
    if (!s.readMoreButtonSize) s.readMoreButtonSize = 'md';
    if (!s.readMoreAlignment) s.readMoreAlignment = 'left';
    if (!s.defaultSlideLayout) s.defaultSlideLayout = 'text_overlay';
    if (!s.slideImageHeightMode) s.slideImageHeightMode = 'default';
    if (s.slideImageCustomHeight === undefined) s.slideImageCustomHeight = '';
    if (!s.slideImageAdjustments) {
        s.slideImageAdjustments = { zoom: 1, rotate: 0, brightness: 100, contrast: 100 };
    }
    return s;
};

/** Keep map type and region/state fields consistent for templates and page containers. */
export const normalizeMapTemplateSettings = (settings: Record<string, unknown>): Record<string, unknown> => {
    const s = { ...settings };
    const mapType = String(s.mapType || 'World');
    s.mapType = mapType;
    if (s.title === undefined) s.title = '';
    if (s.selectedRegion === undefined) s.selectedRegion = '';
    if (s.selectedState === undefined) s.selectedState = '';
    if (s.locationSearch === undefined) s.locationSearch = '';

    if (mapType !== 'Continent' && mapType !== 'Country') {
        s.selectedRegion = '';
        s.selectedState = '';
    }
    if (mapType !== 'Country' || s.selectedRegion !== 'India') {
        s.selectedState = '';
    }
    if (mapType === 'Briefwahl' || mapType === 'Europawahl') {
        s.locationSearch = '';
    }

    return s;
};

export const hydrateTemplateContentForContainer = (
    containerType: ContainerType,
    content: Record<string, unknown>,
    settings: Record<string, unknown>,
    options: {
        templateTitle?: string;
        defaultImageUrl?: string;
        labelHeading?: string;
        labelSubheading?: string;
        labelDescription?: string;
        labelButton?: string;
        editableFields?: string[];
    } = {}
): Record<string, unknown> => {
    const c = { ...content };
    const headingFallback = options.labelHeading?.trim() || '';
    const subFallback = options.labelSubheading?.trim() || '';
    const descFallback = options.labelDescription?.trim() || '';
    const btnFallback = options.labelButton?.trim() || '';

    if (containerType === ContainerType.HERO) {
        if (headingFallback) {
            c.title = ensureMultilingualField(c.title, headingFallback);
        }
        if (subFallback) {
            c.subtitle = ensureMultilingualField(c.subtitle, subFallback);
        }
        if (descFallback && !hasMultilingualText(c.description)) {
            c.description = ensureMultilingualField(c.description, descFallback);
        }
        const tid = String(settings.templateId || '');
        const buttonPermitted =
            !options.editableFields?.length
            || isFieldEditableForRole('site_admin', 'settings.btnEnabled', options.editableFields);
        if (tid === 'page_content' || tid === 'visual_text' || tid === 'color_header') {
            if (buttonPermitted) {
                if (btnFallback && (!settings.btnName || !hasMultilingualText(settings.btnName))) {
                    settings.btnName = ensureMultilingualField(settings.btnName, btnFallback);
                }
                if (settings.btnEnabled === undefined) settings.btnEnabled = true;
            } else {
                settings.btnEnabled = false;
            }
        }
        if (tid === 'hero_img') {
            if (buttonPermitted) {
                if (settings.btnEnabled === undefined) settings.btnEnabled = true;
                if (btnFallback) {
                    settings.btnName = ensureMultilingualField(settings.btnName, btnFallback);
                }
            } else {
                settings.btnEnabled = false;
            }
        }
    }

    if (containerType === ContainerType.CARD_GRID || containerType === ContainerType.SLIDER) {
        if (headingFallback) {
            c.title = ensureMultilingualField(c.title, headingFallback);
        }
        if (subFallback) c.subtitle = ensureMultilingualField(c.subtitle, subFallback);
        if (descFallback) c.description = ensureMultilingualField(c.description, descFallback);
    }

    if (containerType === ContainerType.CONTAINER_SECTION) {
        if (headingFallback) {
            c.title = ensureMultilingualField(c.title, headingFallback);
        }
    }

    if (containerType === ContainerType.MAP) {
        if (headingFallback) {
            c.title = ensureMultilingualField(c.title, headingFallback);
        }
    }

    return c;
};

export interface BuildContainerFromTemplateOptions {
    pageId: string;
    templateTitle?: string;
    defaultImageUrl?: string;
    labelHeading?: string;
    labelSubheading?: string;
    labelDescription?: string;
    labelButton?: string;
}

/** Apply org template to a new page container with normalized settings + default content. */
export const buildContainerFromOrgTemplate = (
    template: SectionTemplate,
    options: BuildContainerFromTemplateOptions
) => {
    const effectiveEditableFields = resolveEffectiveEditableFields(
        template.containerType,
        template.editableFields ?? null
    );
    const applied = applySectionTemplateToContainer(
        template.settings || {},
        template.content || {},
        template.id,
        effectiveEditableFields
    );

    let settings = { ...applied.settings };
    let content = { ...applied.content };

    if (template.containerType === ContainerType.HERO) {
        settings = normalizeHeroTemplateSettings(settings);
        if (!settings.bgImage && options.defaultImageUrl) {
            if (settings.bgType === 'image' || settings.bgType === 'layout') {
                settings.bgImage = options.defaultImageUrl;
            }
        }
    }

    if (template.containerType === ContainerType.CARD_GRID || template.containerType === ContainerType.DATA_GRID) {
        settings = normalizeCardGridTemplateSettings(settings);
    }

    if (template.containerType === ContainerType.SLIDER) {
        settings = normalizeSliderTemplateSettings(settings);
    }

    if (template.containerType === ContainerType.MAP) {
        settings = normalizeMapTemplateSettings(settings);
    }

    content = hydrateTemplateContentForContainer(template.containerType, content, settings, {
        templateTitle: template.title,
        defaultImageUrl: options.defaultImageUrl,
        labelHeading: options.labelHeading,
        labelSubheading: options.labelSubheading,
        labelDescription: options.labelDescription,
        labelButton: options.labelButton,
        editableFields: effectiveEditableFields,
    });

    settings = applyEditableFieldLocksToSettings(
        template.containerType,
        settings,
        effectiveEditableFields
    );

    return {
        id: `c_${Date.now()}`,
        pageId: options.pageId,
        type: template.containerType,
        order: 99,
        isVisible: true,
        status: 'Draft' as const,
        settings,
        content,
        title: template.title,
    };
};

/** Build a read-only preview container from an org template (no placeholder hydration or field locks). */
export const buildPreviewContainerFromSectionTemplate = (
    template: SectionTemplate,
    options: { defaultImageUrl?: string } = {}
): Container => {
    let settings = { ...(template.settings || {}) };
    const content = { ...(template.content || {}) };

    if (template.containerType === ContainerType.HERO) {
        settings = normalizeHeroTemplateSettings(settings);
        if (!settings.bgImage && options.defaultImageUrl) {
            if (settings.bgType === 'image' || settings.bgType === 'layout') {
                settings.bgImage = options.defaultImageUrl;
            }
        }
    }

    if (template.containerType === ContainerType.CARD_GRID || template.containerType === ContainerType.DATA_GRID) {
        settings = normalizeCardGridTemplateSettings(settings);
    }

    if (template.containerType === ContainerType.SLIDER) {
        settings = normalizeSliderTemplateSettings(settings);
    }

    if (template.containerType === ContainerType.MAP) {
        settings = normalizeMapTemplateSettings(settings);
    }

    return {
        id: 'template_preview',
        pageId: '',
        type: template.containerType,
        order: 0,
        isVisible: true,
        status: 'Draft',
        settings,
        content,
        title: template.title,
    };
};

/** Force locked template fields off in saved/applied settings (e.g. action button disabled in template). */
export const applyEditableFieldLocksToSettings = (
    containerType: ContainerType,
    settings: Record<string, unknown>,
    editableFields: string[]
): Record<string, unknown> => {
    const s = { ...settings };
    const effective = resolveEffectiveEditableFields(containerType, editableFields);

    if (containerType === ContainerType.HERO) {
        if (!isFieldEditableForRole('site_admin', 'settings.btnEnabled', effective)) {
            s.btnEnabled = false;
        }
    }

    return s;
};

/** Normalize template settings before saving to the Templates list. */
export const normalizeTemplateSettingsForSave = (
    containerType: ContainerType,
    settings: Record<string, unknown>,
    editableFields?: string[]
): Record<string, unknown> => {
    let normalized: Record<string, unknown>;
    if (containerType === ContainerType.HERO) normalized = normalizeHeroTemplateSettings(settings);
    else if (containerType === ContainerType.CARD_GRID || containerType === ContainerType.DATA_GRID) {
        normalized = normalizeCardGridTemplateSettings(settings);
    } else if (containerType === ContainerType.SLIDER) {
        normalized = normalizeSliderTemplateSettings(settings);
    } else if (containerType === ContainerType.MAP) {
        normalized = normalizeMapTemplateSettings(settings);
    } else {
        normalized = { ...settings };
    }
    if (editableFields?.length) {
        normalized = applyEditableFieldLocksToSettings(containerType, normalized, editableFields);
    }
    return normalized;
};

export const countPublishedTemplatesForCategory = (
    categoryId: string,
    templates: SectionTemplate[]
): number => {
    const containerType = CATEGORY_TO_CONTAINER_TYPE[categoryId];
    if (!containerType) return 0;
    return templates.filter((t) => t.containerType === containerType && t.status === 'Published').length;
};

/** SharePoint default site group suffixes (e.g. "WebStudio Owners"). */
export const WEBSTUDIO_OWNERS_GROUP_SUFFIX = ' Owners';
export const WEBSTUDIO_MEMBERS_GROUP_SUFFIX = ' Members';
export const WEBSTUDIO_VISITORS_GROUP_SUFFIX = ' Visitors';

/** @deprecated Legacy custom groups — use default Owners/Members/Visitors instead. */
export const WEBSTUDIO_SUPER_ADMIN_GROUP = 'WebStudio Super Admins';
/** @deprecated Legacy custom groups — use default Owners/Members/Visitors instead. */
export const WEBSTUDIO_SITE_ADMIN_GROUP = 'WebStudio Site Admins';

export type WebStudioPermissionGroupType = 'Owners' | 'SiteAdmin' | 'Members' | 'Visitors' | 'Custom';

export const isWebStudioOwnersGroup = (groupName: string): boolean =>
    groupName.trim().endsWith(WEBSTUDIO_OWNERS_GROUP_SUFFIX);

export const isWebStudioMembersGroup = (groupName: string): boolean =>
    groupName.trim().endsWith(WEBSTUDIO_MEMBERS_GROUP_SUFFIX);

export const isWebStudioVisitorsGroup = (groupName: string): boolean =>
    groupName.trim().endsWith(WEBSTUDIO_VISITORS_GROUP_SUFFIX);

/** True for the three default SharePoint permission groups on this site. */
export const isWebStudioDefaultPermissionGroup = (groupName: string): boolean =>
    isWebStudioOwnersGroup(groupName)
    || isWebStudioMembersGroup(groupName)
    || isWebStudioVisitorsGroup(groupName);

/** SharePoint group title for WebStudio Site Admins (Design permission level). */
export const WEBSTUDIO_SITE_ADMINS_GROUP_TITLE = 'Site Admins';

export const isWebStudioSiteAdminsGroup = (groupName: string): boolean => {
    const normalized = groupName.trim().toLowerCase();
    return normalized === WEBSTUDIO_SITE_ADMINS_GROUP_TITLE.toLowerCase()
        || normalized === WEBSTUDIO_SITE_ADMIN_GROUP.toLowerCase();
};

export type WebStudioUserRole = 'super_admin' | 'site_admin' | 'editor' | 'standard';

export type TemplateFieldCategory = 'content' | 'display' | 'design' | 'advanced';

export interface TemplateEditableFieldDef {
    key: string;
    labelKey: string;
    category: TemplateFieldCategory;
    /** Dot-path into container.settings (e.g. "source", "taggedItems"). */
    settingsPath?: string;
    /** When false, hidden from the template editor sidebar (not exposed in container editor UI). */
    showInTemplateSidebar?: boolean;
}

/** Template permission catalog per container type (content keys are never granted to Site Admins). */
export const EDITABLE_FIELD_CATALOG: Record<ContainerType, TemplateEditableFieldDef[]> = {
    [ContainerType.HERO]: [
        { key: 'content.title', labelKey: 'TMPL_FIELD_HEADING', category: 'content' },
        { key: 'content.subtitle', labelKey: 'TMPL_FIELD_SUBHEADING', category: 'content' },
        { key: 'content.description', labelKey: 'TMPL_FIELD_DESCRIPTION', category: 'content' },
        { key: 'settings.bgImage', labelKey: 'TMPL_FIELD_BG_IMAGE', category: 'content', settingsPath: 'bgImage' },
        { key: 'settings.btnEnabled', labelKey: 'TMPL_FIELD_BTN_ENABLED', category: 'content', settingsPath: 'btnEnabled' },
        { key: 'settings.btnName', labelKey: 'TMPL_FIELD_BTN_LABEL', category: 'content', settingsPath: 'btnName' },
        { key: 'settings.btnUrl', labelKey: 'TMPL_FIELD_BTN_URL', category: 'content', settingsPath: 'btnUrl' },
        { key: 'group.displayOptions', labelKey: 'TMPL_FIELD_DISPLAY_OPTIONS', category: 'display', settingsPath: 'displayOptions', showInTemplateSidebar: false },
        { key: 'group.typography', labelKey: 'TMPL_FIELD_TYPOGRAPHY', category: 'display', settingsPath: 'typography' },
        { key: 'group.heroDesign', labelKey: 'TMPL_FIELD_HERO_DESIGN', category: 'design', settingsPath: 'heroDesign' },
    ],
    [ContainerType.IMAGE_TEXT]: [
        { key: 'content.title', labelKey: 'TMPL_FIELD_HEADING', category: 'content' },
        { key: 'content.description', labelKey: 'TMPL_FIELD_DESCRIPTION', category: 'content' },
        { key: 'settings.bgImage', labelKey: 'TMPL_FIELD_BG_IMAGE', category: 'content', settingsPath: 'bgImage' },
    ],
    [ContainerType.SLIDER]: [
        { key: 'content.title', labelKey: 'TMPL_FIELD_HEADING', category: 'content' },
        { key: 'content.subtitle', labelKey: 'TMPL_FIELD_SUBHEADING', category: 'content' },
        { key: 'content.description', labelKey: 'TMPL_FIELD_DESCRIPTION', category: 'content' },
        { key: 'settings.source', labelKey: 'TMPL_FIELD_SOURCE', category: 'content', settingsPath: 'source' },
        { key: 'settings.taggedItems', labelKey: 'TMPL_FIELD_TAGGED_ITEMS', category: 'content', settingsPath: 'taggedItems' },
        { key: 'group.displayOptions', labelKey: 'TMPL_FIELD_DISPLAY_OPTIONS', category: 'display', settingsPath: 'displayOptions', showInTemplateSidebar: false },
        { key: 'group.typography', labelKey: 'TMPL_FIELD_TYPOGRAPHY', category: 'display', settingsPath: 'typography' },
        { key: 'group.cardStyle', labelKey: 'TMPL_FIELD_CARD_STYLE', category: 'display', settingsPath: 'cardStyle' },
        { key: 'group.slideDesign', labelKey: 'TMPL_FIELD_SLIDE_DESIGN', category: 'display', settingsPath: 'slideDesign' },
        { key: 'group.layoutBehavior', labelKey: 'TMPL_FIELD_LAYOUT_BEHAVIOR', category: 'display', settingsPath: 'layoutBehavior' },
        { key: 'group.cardSettings', labelKey: 'TMPL_FIELD_CARD_SETTINGS', category: 'display', settingsPath: 'cardSettings' },
        { key: 'settings.showAllWithoutTagging', labelKey: 'TMPL_FIELD_SHOW_ALL', category: 'display', settingsPath: 'showAllWithoutTagging', showInTemplateSidebar: false },
        { key: 'settings.ordering', labelKey: 'TMPL_FIELD_ORDERING', category: 'display', settingsPath: 'ordering', showInTemplateSidebar: false },
    ],
    [ContainerType.CARD_GRID]: [
        { key: 'content.title', labelKey: 'TMPL_FIELD_HEADING', category: 'content' },
        { key: 'content.subtitle', labelKey: 'TMPL_FIELD_SUBHEADING', category: 'content' },
        { key: 'content.description', labelKey: 'TMPL_FIELD_DESCRIPTION', category: 'content' },
        { key: 'settings.source', labelKey: 'TMPL_FIELD_SOURCE', category: 'content', settingsPath: 'source' },
        { key: 'settings.taggedItems', labelKey: 'TMPL_FIELD_TAGGED_ITEMS', category: 'content', settingsPath: 'taggedItems' },
        { key: 'group.displayOptions', labelKey: 'TMPL_FIELD_DISPLAY_OPTIONS', category: 'display', settingsPath: 'displayOptions', showInTemplateSidebar: false },
        { key: 'group.typography', labelKey: 'TMPL_FIELD_TYPOGRAPHY', category: 'display', settingsPath: 'typography' },
        { key: 'group.cardStyle', labelKey: 'TMPL_FIELD_CARD_STYLE', category: 'display', settingsPath: 'cardStyle' },
        { key: 'group.layoutBehavior', labelKey: 'TMPL_FIELD_LAYOUT_BEHAVIOR', category: 'display', settingsPath: 'layoutBehavior' },
        { key: 'group.cardSettings', labelKey: 'TMPL_FIELD_CARD_SETTINGS', category: 'display', settingsPath: 'cardSettings' },
        { key: 'settings.showAllWithoutTagging', labelKey: 'TMPL_FIELD_SHOW_ALL', category: 'display', settingsPath: 'showAllWithoutTagging', showInTemplateSidebar: false },
        { key: 'settings.columns', labelKey: 'TMPL_FIELD_ITEM_COUNT', category: 'display', settingsPath: 'columns', showInTemplateSidebar: false },
        { key: 'settings.ordering', labelKey: 'TMPL_FIELD_ORDERING', category: 'display', settingsPath: 'ordering', showInTemplateSidebar: false },
        { key: 'settings.contentViewMode', labelKey: 'TMPL_FIELD_VIEW_MODE', category: 'display', settingsPath: 'contentViewMode', showInTemplateSidebar: false },
    ],
    [ContainerType.DATA_GRID]: [
        { key: 'content.title', labelKey: 'TMPL_FIELD_HEADING', category: 'content' },
        { key: 'content.subtitle', labelKey: 'TMPL_FIELD_SUBHEADING', category: 'content' },
        { key: 'content.description', labelKey: 'TMPL_FIELD_DESCRIPTION', category: 'content' },
        { key: 'settings.source', labelKey: 'TMPL_FIELD_SOURCE', category: 'content', settingsPath: 'source' },
        { key: 'settings.taggedItems', labelKey: 'TMPL_FIELD_TAGGED_ITEMS', category: 'content', settingsPath: 'taggedItems' },
    ],
    [ContainerType.CONTACT_FORM]: [
        { key: 'settings.heading', labelKey: 'TMPL_FIELD_HEADING', category: 'content', settingsPath: 'heading' },
        { key: 'settings.subheading', labelKey: 'TMPL_FIELD_SUBHEADING', category: 'content', settingsPath: 'subheading' },
        { key: 'settings.description', labelKey: 'TMPL_FIELD_DESCRIPTION', category: 'content', settingsPath: 'description' },
        { key: 'settings.fields', labelKey: 'TMPL_FIELD_FORM_FIELDS', category: 'content', settingsPath: 'fields' },
        { key: 'settings.buttonText', labelKey: 'TMPL_FIELD_BTN_LABEL', category: 'content', settingsPath: 'buttonText' },
        { key: 'group.displayOptions', labelKey: 'TMPL_FIELD_DISPLAY_OPTIONS', category: 'display', settingsPath: 'displayOptions', showInTemplateSidebar: false },
        { key: 'group.typography', labelKey: 'TMPL_FIELD_TYPOGRAPHY', category: 'display', settingsPath: 'typography' },
        { key: 'group.formDesign', labelKey: 'TMPL_FIELD_FORM_DESIGN', category: 'design', settingsPath: 'formDesign' },
    ],
    [ContainerType.TABLE]: [
        { key: 'settings.title', labelKey: 'TMPL_FIELD_HEADING', category: 'content', settingsPath: 'title' },
    ],
    [ContainerType.MAP]: [
        { key: 'settings.title', labelKey: 'TMPL_FIELD_HEADING', category: 'content', settingsPath: 'title' },
        { key: 'content.title', labelKey: 'TMPL_FIELD_MAP_TITLE_TRANSLATION', category: 'content' },
        { key: 'settings.mapType', labelKey: 'TMPL_FIELD_MAP_TYPE', category: 'content', settingsPath: 'mapType' },
        { key: 'settings.selectedRegion', labelKey: 'TMPL_FIELD_MAP_REGION', category: 'content', settingsPath: 'selectedRegion' },
        { key: 'settings.selectedState', labelKey: 'TMPL_FIELD_MAP_STATE', category: 'content', settingsPath: 'selectedState' },
        { key: 'settings.locationSearch', labelKey: 'TMPL_FIELD_LOCATION_SEARCH', category: 'content', settingsPath: 'locationSearch' },
        { key: 'group.mapSettings', labelKey: 'TMPL_FIELD_MAP_SETTINGS', category: 'display', settingsPath: 'mapSettings' },
    ],
    [ContainerType.CONTAINER_SECTION]: [
        { key: 'settings.bindPageTitleDescription', labelKey: 'TMPL_FIELD_BIND_PAGE', category: 'content', settingsPath: 'bindPageTitleDescription' },
        { key: 'content.title', labelKey: 'TMPL_FIELD_HEADING', category: 'content' },
        { key: 'settings.body', labelKey: 'TMPL_FIELD_BODY', category: 'content', settingsPath: 'body' },
    ],
};

/** Maps Add Container sidebar tab ids to ContainerType. */
export const CATEGORY_TO_CONTAINER_TYPE: Record<string, ContainerType> = {
    HEADER: ContainerType.HERO,
    SLIDER: ContainerType.SLIDER,
    DATA_GRID: ContainerType.CARD_GRID,
    CONTACT_FORM: ContainerType.CONTACT_FORM,
    TABLE_VIEW: ContainerType.TABLE,
    MAP: ContainerType.MAP,
    CONTAINER_SECTION: ContainerType.CONTAINER_SECTION,
};

export const CONTAINER_TYPE_TO_CATEGORY: Partial<Record<ContainerType, string>> = Object.fromEntries(
    Object.entries(CATEGORY_TO_CONTAINER_TYPE).map(([cat, type]) => [type, cat])
);

export const isSuperAdmin = (role: WebStudioUserRole): boolean => role === 'super_admin';

export const isSiteAdmin = (role: WebStudioUserRole): boolean => role === 'site_admin';

export const isEditor = (role: WebStudioUserRole): boolean => role === 'editor';

/** Editors may edit content but cannot publish/unpublish pages or items. */
export const canPublishContent = (role: WebStudioUserRole): boolean =>
    role === 'super_admin' || role === 'site_admin';

/** SEO settings are restricted to Super Admins and Site Admins. */
export const canManageSeoSettings = (role: WebStudioUserRole): boolean =>
    role === 'super_admin' || role === 'site_admin';

/** True when the user may use the CMS shell (sidebar, edit mode, modals). */
export const canAccessWebStudioEditor = (role: WebStudioUserRole): boolean =>
    role === 'super_admin' || role === 'site_admin' || role === 'editor';

export const canManageTemplates = (role: WebStudioUserRole): boolean => role === 'super_admin';

/** Permission Management and global styling are restricted to Super Admins. */
export const canManagePermissions = (role: WebStudioUserRole): boolean => role === 'super_admin';

export const WEBSTUDIO_PERMISSION_GROUP_NAMES = [
    WEBSTUDIO_OWNERS_GROUP_SUFFIX,
    WEBSTUDIO_MEMBERS_GROUP_SUFFIX,
    WEBSTUDIO_VISITORS_GROUP_SUFFIX,
] as const;

/** Map SharePoint groups: Owners → super, Site Admins → site admin, Members → editor, else preview. */
export const resolveWebStudioUserRoleFromGroupTitles = (groupTitles: string[]): WebStudioUserRole => {
    const titles = groupTitles.map((title) => title.trim());
    if (titles.some(isWebStudioOwnersGroup)) return 'super_admin';
    if (titles.some(isWebStudioSiteAdminsGroup)) return 'site_admin';
    if (titles.some(isWebStudioMembersGroup)) return 'editor';
    return 'standard';
};

/** Preferred role resolver when associated group IDs are known for the current site. */
export const resolveWebStudioUserRoleFromGroupIds = (
    userGroupIds: Array<number | string>,
    ownerGroupId?: number | string | null,
    memberGroupId?: number | string | null,
    siteAdminGroupId?: number | string | null
): WebStudioUserRole => {
    const normalized = new Set(userGroupIds.map((id) => String(id)));
    if (ownerGroupId != null && normalized.has(String(ownerGroupId))) return 'super_admin';
    if (siteAdminGroupId != null && normalized.has(String(siteAdminGroupId))) return 'site_admin';
    if (memberGroupId != null && normalized.has(String(memberGroupId))) return 'editor';
    return 'standard';
};

export const isWebStudioPermissionGroup = (groupName: string): boolean =>
    isWebStudioDefaultPermissionGroup(groupName);

export const resolveWebStudioPermissionGroupType = (
    groupName: string
): WebStudioPermissionGroupType => {
    if (isWebStudioOwnersGroup(groupName)) return 'Owners';
    if (isWebStudioSiteAdminsGroup(groupName)) return 'SiteAdmin';
    if (isWebStudioMembersGroup(groupName)) return 'Members';
    if (isWebStudioVisitorsGroup(groupName)) return 'Visitors';
    return 'Custom';
};

export const sortWebStudioPermissionGroups = <T extends { type: string; name: string }>(groups: T[]): T[] => {
    const order: Record<string, number> = { Owners: 0, SiteAdmin: 1, Members: 2, Visitors: 3, Custom: 4 };
    return [...groups].sort((a, b) => {
        const rankA = order[a.type] ?? 99;
        const rankB = order[b.type] ?? 99;
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name);
    });
};

export const canEditDesignSettings = (
    role: WebStudioUserRole,
    editableFields?: string[] | null
): boolean => role === 'super_admin' || !editableFields;

/** True when a non–Super Admin container was created from an org section template. */
export const isContainerDesignLocked = (
    role: WebStudioUserRole,
    settings?: Record<string, unknown> | null
): boolean => {
    if (role === 'editor') return true;
    if (!settings?.sectionTemplateId) return false;
    return role !== 'super_admin';
};

/** Site Admin template locks or Members-group Editor content-only mode. */
export const isContentLockedEditor = (
    role: WebStudioUserRole,
    settings?: Record<string, unknown> | null
): boolean => role === 'editor' || isContainerDesignLocked(role, settings);

/** Site Admin permissions apply only when editing a page section linked to an org template. */
export const isTemplateRestrictedEditor = (
    role: WebStudioUserRole,
    settings?: Record<string, unknown> | null
): boolean => isContainerDesignLocked(role, settings);

export const isFieldEditableForRole = (
    role: WebStudioUserRole,
    fieldKey: string,
    editableFields?: string[] | null
): boolean => {
    if (role === 'super_admin') return true;
    if (!editableFields || editableFields.length === 0) return false;
    return editableFields.includes(fieldKey);
};

/** Content/business fields Site Admins may always edit on template-linked page sections. */
export const isSiteAdminIntrinsicContentField = (
    containerType: ContainerType,
    fieldKey: string
): boolean => {
    const catalog = EDITABLE_FIELD_CATALOG[containerType] || [];
    return catalog.some((field) => field.category === 'content' && field.key === fieldKey);
};

/** Site Admin field check for template-restricted container editors. */
export const isSiteAdminTemplateFieldEditable = (
    containerType: ContainerType,
    fieldKey: string,
    editableFields?: string[] | null
): boolean =>
    isSiteAdminIntrinsicContentField(containerType, fieldKey)
    || isFieldEditableForRole('site_admin', fieldKey, editableFields);

/** Fields Members-group Editors may change (content, button, image, tagging only). */
export const isEditorAllowedField = (
    containerType: ContainerType,
    fieldKey: string
): boolean => {
    if (isSiteAdminIntrinsicContentField(containerType, fieldKey)) return true;
    if (
        fieldKey === 'settings.btnEnabled'
        || fieldKey === 'settings.btnName'
        || fieldKey === 'settings.btnUrl'
        || fieldKey === 'settings.buttonText'
    ) return true;
    if (fieldKey === 'settings.bgImage') return true;
    if (fieldKey === 'settings.taggedItems') return true;
    return false;
};

/** Unified field permit check for Site Admin (template) and Editor (content-only) roles. */
export const isContentEditorFieldEditable = (
    role: WebStudioUserRole,
    containerType: ContainerType,
    fieldKey: string,
    editableFields?: string[] | null
): boolean => {
    if (role === 'super_admin') return true;
    if (role === 'editor') return isEditorAllowedField(containerType, fieldKey);
    if (role === 'site_admin') return isSiteAdminTemplateFieldEditable(containerType, fieldKey, editableFields);
    return false;
};

/** Maps individual settings paths to permission group keys for Site Admin template grants. */
export const SETTINGS_PATH_GROUP_MAP: Partial<Record<ContainerType, Record<string, string>>> = {
    [ContainerType.HERO]: {
        align: 'typography',
        letterCase: 'typography',
        titleColor: 'typography',
        titleCustomColor: 'typography',
        subtitleColor: 'typography',
        subtitleCustomColor: 'typography',
        descColor: 'typography',
        descCustomColor: 'typography',
        bgType: 'heroDesign',
        bgColor: 'heroDesign',
        layoutVariant: 'heroDesign',
        heroOverlayColor: 'heroDesign',
        heroOverlayOpacity: 'heroDesign',
        heroHeightMode: 'heroDesign',
        heroCustomHeight: 'heroDesign',
        minHeight: 'heroDesign',
        showHeader: 'displayOptions',
        showSubheading: 'displayOptions',
        showDescription: 'displayOptions',
    },
    [ContainerType.CARD_GRID]: {
        align: 'layoutBehavior',
        contentAlign: 'layoutBehavior',
        columns: 'layoutBehavior',
        ordering: 'layoutBehavior',
        layout: 'layoutBehavior',
        border: 'layoutBehavior',
        imgPos: 'layoutBehavior',
        imgBorder: 'layoutBehavior',
        sortField: 'layoutBehavior',
        sortDirection: 'layoutBehavior',
        showAllWithoutTagging: 'layoutBehavior',
        contentViewMode: 'layoutBehavior',
        smartPageOpenInNewTab: 'layoutBehavior',
        autoplay: 'layoutBehavior',
        speed: 'layoutBehavior',
        titleColor: 'typography',
        titleCustomColor: 'typography',
        subtitleColor: 'typography',
        subtitleCustomColor: 'typography',
        descColor: 'typography',
        descCustomColor: 'typography',
        letterCase: 'typography',
        titleStyle: 'typography',
        subtitleStyle: 'typography',
        descStyle: 'typography',
        cardTitleColor: 'cardStyle',
        cardTitleCustomColor: 'cardStyle',
        cardDescColor: 'cardStyle',
        cardDescCustomColor: 'cardStyle',
        cardLetterCase: 'cardStyle',
        cardTitleStyle: 'cardStyle',
        cardDescStyle: 'cardStyle',
        cardSubtitleColor: 'cardStyle',
        cardSubtitleCustomColor: 'cardStyle',
        cardSubtitleLetterCase: 'cardStyle',
        cardSubtitleStyle: 'cardStyle',
        useOldCardLayout: 'cardSettings',
        enableCardReadMore: 'cardSettings',
        readMoreBehavior: 'cardSettings',
        readMoreDisplayType: 'cardSettings',
        readMoreButtonSize: 'cardSettings',
        readMoreAlignment: 'cardSettings',
        showHeader: 'displayOptions',
        showSubheading: 'displayOptions',
        showDescription: 'displayOptions',
    },
    [ContainerType.SLIDER]: {
        align: 'layoutBehavior',
        contentAlign: 'layoutBehavior',
        ordering: 'layoutBehavior',
        sortField: 'layoutBehavior',
        sortDirection: 'layoutBehavior',
        showAllWithoutTagging: 'layoutBehavior',
        contentViewMode: 'layoutBehavior',
        autoplay: 'layoutBehavior',
        speed: 'layoutBehavior',
        arrows: 'layoutBehavior',
        dots: 'layoutBehavior',
        border: 'layoutBehavior',
        imgPos: 'layoutBehavior',
        imgBorder: 'layoutBehavior',
        overlayPosition: 'slideDesign',
        defaultSlideLayout: 'slideDesign',
        slideImageHeightMode: 'slideDesign',
        slideImageCustomHeight: 'slideDesign',
        slideImageAdjustments: 'slideDesign',
        imageSettings: 'slideDesign',
        titleColor: 'typography',
        subtitleColor: 'typography',
        descColor: 'typography',
        titleFontSize: 'typography',
        subtitleFontSize: 'typography',
        descFontSize: 'typography',
        letterCase: 'typography',
        showHeader: 'displayOptions',
        showSubheading: 'displayOptions',
        showDescription: 'displayOptions',
        showSlideTitle: 'displayOptions',
        showSlideDescription: 'displayOptions',
        cardTitleColor: 'cardStyle',
        cardTitleCustomColor: 'cardStyle',
        cardDescColor: 'cardStyle',
        cardDescCustomColor: 'cardStyle',
        cardLetterCase: 'cardStyle',
        cardTitleStyle: 'cardStyle',
        cardDescStyle: 'cardStyle',
        cardSubtitleColor: 'cardStyle',
        cardSubtitleCustomColor: 'cardStyle',
        cardSubtitleLetterCase: 'cardStyle',
        cardSubtitleStyle: 'cardStyle',
        cardTitleFontFamily: 'cardStyle',
        cardTitleRows: 'cardStyle',
        cardBgType: 'cardStyle',
        cardBgColor: 'cardStyle',
        enableCardReadMore: 'cardSettings',
        readMoreBehavior: 'cardSettings',
        readMoreDisplayType: 'cardSettings',
        readMoreButtonSize: 'cardSettings',
        readMoreAlignment: 'cardSettings',
    },
    [ContainerType.MAP]: {
        mapType: 'mapSettings',
        selectedRegion: 'mapSettings',
        selectedState: 'mapSettings',
        locationSearch: 'mapSettings',
        title: 'mapSettings',
    },
    [ContainerType.CONTACT_FORM]: {
        showHeader: 'displayOptions',
        showSubheading: 'displayOptions',
        showDescription: 'displayOptions',
        titleColor: 'typography',
        titleCustomColor: 'typography',
        subtitleColor: 'typography',
        subtitleCustomColor: 'typography',
        descColor: 'typography',
        descColorType: 'typography',
        descCustomColor: 'typography',
        labelColor: 'typography',
        labelCustomColor: 'typography',
        titleStyle: 'typography',
        subtitleStyle: 'typography',
        descStyle: 'typography',
        labelStyle: 'typography',
        letterCase: 'typography',
        alignment: 'typography',
        align: 'typography',
        bgType: 'formDesign',
        bgColor: 'formDesign',
        backgroundColor: 'formDesign',
        bgImage: 'formDesign',
        backgroundImage: 'formDesign',
        formCardRadiusSettings: 'formDesign',
    },
};

/** Whether a Site Admin on a Slider section should see the Settings tab. */
export const hasSiteAdminSliderSettingsAccess = (
    editableFields?: string[] | null
): boolean => {
    if (!editableFields?.length) return false;
    const role: WebStudioUserRole = 'site_admin';
    const containerType = ContainerType.SLIDER;
    if (hasSiteAdminDataGridSettingsAccess(containerType, editableFields)) return true;
    const contentInSettings = ['content.title', 'content.subtitle', 'content.description'];
    return contentInSettings.some((key) => isFieldEditableForRole(role, key, editableFields));
};

/** Whether a Site Admin on a Cards/Slider section should see the Settings tab (design controls only). */
export const hasSiteAdminDataGridSettingsAccess = (
    containerType: ContainerType,
    editableFields?: string[] | null
): boolean => {
    if (!editableFields?.length) return false;
    const role: WebStudioUserRole = 'site_admin';
    const designGroups = ['displayOptions', 'typography', 'cardStyle', 'layoutBehavior', 'cardSettings', 'slideDesign'];
    if (designGroups.some((group) => isSettingsGroupEditable(role, group, containerType, editableFields))) {
        return true;
    }
    const contentInSettings = ['content.title', 'content.subtitle', 'content.description'];
    if (contentInSettings.some((key) => isFieldEditableForRole(role, key, editableFields))) {
        return true;
    }
    const layoutPaths = ['ordering', 'columns', 'contentViewMode', 'showAllWithoutTagging', 'layout'];
    return layoutPaths.some((path) => isSettingsPathEditable(role, path, containerType, editableFields));
};

export const isSettingsGroupEditable = (
    role: WebStudioUserRole,
    groupKey: string,
    containerType: ContainerType,
    editableFields?: string[] | null
): boolean => {
    if (role === 'super_admin') return true;
    const catalog = EDITABLE_FIELD_CATALOG[containerType] || [];
    const groupFieldKey = groupKey.startsWith('group.') ? groupKey : `group.${groupKey}`;
    const match = catalog.find((f) => f.key === groupFieldKey || f.settingsPath === groupKey);
    if (!match) return false;
    return isContentEditorFieldEditable(role, containerType, match.key, editableFields);
};

export const isSettingsPathEditable = (
    role: WebStudioUserRole,
    settingsPath: string,
    containerType: ContainerType,
    editableFields?: string[] | null
): boolean => {
    if (role === 'super_admin') return true;
    const catalog = EDITABLE_FIELD_CATALOG[containerType] || [];
    const sortPaths = ['sortField', 'sortDirection'];
    if (sortPaths.includes(settingsPath)) {
        if (isSettingsGroupEditable(role, 'layoutBehavior', containerType, editableFields)) return true;
        const orderingMatch = catalog.find((f) => f.settingsPath === 'ordering');
        if (orderingMatch && isContentEditorFieldEditable(role, containerType, orderingMatch.key, editableFields)) {
            return true;
        }
    }
    const groupMap = SETTINGS_PATH_GROUP_MAP[containerType];
    const groupName = groupMap?.[settingsPath];
    if (groupName && isSettingsGroupEditable(role, groupName, containerType, editableFields)) {
        return true;
    }
    const match = catalog.find(f => f.settingsPath === settingsPath);
    if (!match) return false;
    return isContentEditorFieldEditable(role, containerType, match.key, editableFields);
};

const getContentEditableFieldKeys = (containerType: ContainerType): Set<string> => {
    const catalog = EDITABLE_FIELD_CATALOG[containerType] || [];
    return new Set(catalog.filter((f) => f.category === 'content').map((f) => f.key));
};

/** Remove content-category keys — Site Admins never receive content template permissions. */
export const stripContentEditableFields = (
    containerType: ContainerType,
    fields: string[]
): string[] => {
    const contentKeys = getContentEditableFieldKeys(containerType);
    return fields.filter((key) => !contentKeys.has(key));
};

/** Default template permissions for new templates — opt-in only (nothing granted until toggled on). */
export const getDefaultEditableFields = (_containerType: ContainerType): string[] => [];

/** Fields shown in the template editor sidebar — only options that exist in the container editor UI. */
export const getTemplateSidebarFieldCatalog = (containerType: ContainerType): TemplateEditableFieldDef[] =>
    (EDITABLE_FIELD_CATALOG[containerType] || []).filter(
        (field) => field.showInTemplateSidebar !== false && field.category !== 'content'
    );

/** Strip legacy / sidebar-only keys and content permissions when persisting template grants. */
export const sanitizeTemplateEditableFields = (
    containerType: ContainerType,
    fields: string[]
): string[] => {
    const allowed = new Set([
        ...(EDITABLE_FIELD_CATALOG[containerType] || []).map((f) => f.key),
    ]);
    return stripContentEditableFields(
        containerType,
        fields.filter((key) => allowed.has(key) && !SITE_ADMIN_NON_GRANTABLE_FIELD_KEYS.has(key))
    );
};

/** Site Admins never receive show/hide display toggles — visibility is defined by the template. */
const SITE_ADMIN_NON_GRANTABLE_FIELD_KEYS = new Set(['group.displayOptions']);

/** Content fields are not configurable for Site Admins on templated sections. */
export const getSiteAdminBasicEditableFields = (_containerType: ContainerType): string[] => [];

/** Resolve stored template permissions with content keys always removed for Site Admins. */
export const resolveEffectiveEditableFields = (
    containerType: ContainerType,
    storedFields?: string[] | null
): string[] => {
    // Explicit array (including empty deny-all) is the saved grant list.
    if (Array.isArray(storedFields)) {
        return stripContentEditableFields(containerType, Array.from(new Set(storedFields)))
            .filter((key) => !SITE_ADMIN_NON_GRANTABLE_FIELD_KEYS.has(key));
    }
    // null/undefined: legacy templates without EditableFields use sidebar defaults.
    return getDefaultEditableFields(containerType);
};

export const normalizeEditableFieldsList = (value: unknown): string[] | null | undefined => {
    if (value === null) return null;
    if (!value) return undefined;
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
        } catch {
            return undefined;
        }
    }
    return undefined;
};

/** Resolve editable fields from container settings, falling back to the org template definition. */
export const resolveContainerEditableFields = (
    containerType: ContainerType,
    settings?: Record<string, unknown> | null,
    templateEditableFields?: string[] | null
): string[] => {
    const hasLinkedTemplate = Boolean(settings?.sectionTemplateId);
    const fromContainer = normalizeEditableFieldsList(settings?.sectionTemplateEditableFields);

    if (hasLinkedTemplate) {
        // Live org template permissions always win, including explicit empty deny-all.
        if (templateEditableFields !== undefined) {
            return resolveEffectiveEditableFields(containerType, templateEditableFields);
        }
        if (Array.isArray(fromContainer)) {
            return resolveEffectiveEditableFields(containerType, fromContainer);
        }
        return resolveEffectiveEditableFields(containerType, null);
    }

    if (Array.isArray(fromContainer) && fromContainer.length > 0) {
        return resolveEffectiveEditableFields(containerType, fromContainer);
    }
    if (Array.isArray(templateEditableFields) && templateEditableFields.length > 0) {
        return resolveEffectiveEditableFields(containerType, templateEditableFields);
    }
    return resolveEffectiveEditableFields(containerType, null);
};

export const isButtonTemplateFieldKey = (fieldKey: string): boolean =>
    fieldKey === 'settings.btnEnabled'
    || fieldKey === 'settings.btnName'
    || fieldKey === 'settings.btnUrl'
    || fieldKey === 'settings.buttonText';

/** Whether the hero/header action button should render in preview or live UI. */
export const isHeroActionButtonVisible = (
    settings: Record<string, unknown>,
    btnLabel: string,
    templateEditableFields?: string[] | null
): boolean => {
    const label = String(btnLabel || '').trim();
    if (!label) return false;
    if (settings.btnEnabled === false) return false;

    if (settings.sectionTemplateId) {
        const editableFields = resolveContainerEditableFields(
            ContainerType.HERO,
            settings,
            templateEditableFields
        );
        if (!isFieldEditableForRole('site_admin', 'settings.btnEnabled', editableFields)) {
            return false;
        }
        return settings.btnEnabled === true;
    }

    return settings.btnEnabled !== false;
};

export interface EditorAccessConfig {
    role: WebStudioUserRole;
    editableFields?: string[];
    /** True when editing an org section template draft (allows data-source selection). */
    isTemplateEditor?: boolean;
}

/** Full editor unless content is locked (Editor role or Site Admin on org template). */
export const canShowFullContainerEditor = (
    role: WebStudioUserRole,
    settings?: Record<string, unknown> | null
): boolean => !isContentLockedEditor(role, settings);

export const buildEditorAccess = (
    role: WebStudioUserRole,
    editableFields?: string[]
): EditorAccessConfig => ({ role, editableFields });

export const applySectionTemplateToContainer = (
    templateSettings: Record<string, unknown>,
    templateContent: Record<string, unknown>,
    templateId: string,
    editableFields: string[]
): { settings: Record<string, unknown>; content: Record<string, unknown> } => ({
    settings: {
        ...templateSettings,
        sectionTemplateId: templateId,
        sectionTemplateEditableFields: editableFields,
    },
    content: { ...templateContent },
});

/** Resolve settings paths a Site Admin may override on a templated section. */
export const getEditableSettingsPathsForFields = (
    containerType: ContainerType,
    editableFields: string[]
): Set<string> => {
    const paths = new Set<string>();
    const catalog = EDITABLE_FIELD_CATALOG[containerType] || [];
    const groupMap = SETTINGS_PATH_GROUP_MAP[containerType] || {};

    editableFields.forEach((fieldKey) => {
        const entry = catalog.find((f) => f.key === fieldKey);
        if (entry?.settingsPath) {
            paths.add(entry.settingsPath);
        }
        if (fieldKey.startsWith('group.')) {
            const groupName = fieldKey.replace('group.', '');
            Object.entries(groupMap).forEach(([path, group]) => {
                if (group === groupName) {
                    paths.add(path);
                }
            });
        }
    });

    if (
        editableFields.includes('settings.ordering')
        || editableFields.includes('group.layoutBehavior')
    ) {
        paths.add('sortField');
        paths.add('sortDirection');
    }

    return paths;
};

/** Resolve content keys a Site Admin may override on a templated section. */
export const getEditableContentKeysForFields = (editableFields: string[]): Set<string> => {
    const keys = new Set<string>();
    editableFields.forEach((fieldKey) => {
        if (fieldKey.startsWith('content.')) {
            keys.add(fieldKey.replace('content.', ''));
        }
    });
    return keys;
};

const normalizeSettingsForContainerType = (
    containerType: ContainerType,
    settings: Record<string, unknown>
): Record<string, unknown> => {
    if (containerType === ContainerType.HERO) {
        return normalizeHeroTemplateSettings(settings);
    }
    if (containerType === ContainerType.CARD_GRID || containerType === ContainerType.DATA_GRID) {
        return normalizeCardGridTemplateSettings(settings);
    }
    if (containerType === ContainerType.SLIDER) {
        return normalizeSliderTemplateSettings(settings);
    }
    if (containerType === ContainerType.MAP) {
        return normalizeMapTemplateSettings(settings);
    }
    return { ...settings };
};

/**
 * Merge the latest org template into a page container.
 * Org template supplies defaults; persisted container Settings/Content from SharePoint win on conflict
 * so header/hero design changes survive save + refresh.
 */
export const mergeContainerWithLiveSectionTemplate = (
    container: Container,
    template?: SectionTemplate | null
): Container => {
    const templateId = container.settings?.sectionTemplateId;
    if (!templateId || !template || template.id !== templateId) {
        return container;
    }

    const editableFields = resolveContainerEditableFields(
        container.type,
        container.settings,
        template.editableFields
    );

    const containerSettings = container.settings || {};
    const containerContent = container.content || {};
    const templateBase = normalizeSettingsForContainerType(container.type, { ...(template.settings || {}) });

    const mergedSettings: Record<string, unknown> = {
        ...templateBase,
        ...containerSettings,
        sectionTemplateId: template.id,
        sectionTemplateEditableFields: editableFields,
    };

    const mergedContent: Record<string, unknown> = {
        ...(template.content || {}),
        ...containerContent,
    };

    return {
        ...container,
        settings: mergedSettings,
        content: mergedContent,
    };
};

/** Resolve a container against the current sectionTemplates list (preview/editor). */
export const resolveContainerWithLiveTemplate = (
    container: Container,
    sectionTemplates: SectionTemplate[]
): Container => {
    const templateId = container.settings?.sectionTemplateId;
    if (!templateId) return container;
    const template = sectionTemplates.find((t) => t.id === templateId);
    return mergeContainerWithLiveSectionTemplate(container, template);
};

/** Section tabs that support org template management. */
export const TEMPLATE_MANAGED_CATEGORIES = [
    'HEADER',
    'SLIDER',
    'DATA_GRID',
    'CONTACT_FORM',
    'MAP',
    'CONTAINER_SECTION',
] as const;

export type TemplateManagedCategory = typeof TEMPLATE_MANAGED_CATEGORIES[number];

export const isTemplateManagedCategory = (categoryId: string): categoryId is TemplateManagedCategory =>
    (TEMPLATE_MANAGED_CATEGORIES as readonly string[]).includes(categoryId);

/** Default settings snapshot when creating a new org template from a section tab. */
export const getDefaultTemplateSettingsForCategory = (categoryId: string): Record<string, unknown> => {
    switch (categoryId) {
        case 'HEADER':
            return { templateId: 'page_content', templateVariant: 1, minHeight: 'medium', bgType: 'none', align: 'center' };
        case 'SLIDER':
            return normalizeSliderTemplateSettings({
                templateId: 'img_gallery',
                templateVariant: 1,
                source: 'ImageSlider',
                taggedItems: [],
                slides: [],
            });
        case 'DATA_GRID':
            return { source: 'News', columns: 3, ordering: '123', layout: 'grid', showAllWithoutTagging: false, imgPos: 'top', border: 'sharp', imgBorder: 'sharp' };
        case 'CONTACT_FORM':
            return { heading: '', subheading: '', alignment: 'center', bgType: 'none', bgColor: '#ffffff' };
        case 'MAP':
            return normalizeMapTemplateSettings({
                mapType: 'World',
                title: '',
                selectedRegion: '',
                selectedState: '',
                locationSearch: '',
            });
        case 'CONTAINER_SECTION':
            return { bindPageTitleDescription: false, showTitleUnderline: true, letterCase: 'uppercase', titleColor: 'site', descColor: 'editorText' };
        default:
            return {};
    }
};

/** Settings for a built-in preset card (before saving as an org template). */
export const getBuiltinPresetSettings = (categoryId: string, presetId: string): Record<string, unknown> => {
    switch (categoryId) {
        case 'HEADER':
            if (presetId === 'color_header') return { templateId: 'color_header', templateVariant: 1, minHeight: 'medium', bgType: 'color', align: 'center' };
            if (presetId === 'hero_img') return { templateId: 'hero_img', templateVariant: 1, minHeight: 'full', bgType: 'image', align: 'center' };
            if (presetId === 'visual_text') return { templateId: 'visual_text', templateVariant: 1, minHeight: 'medium', bgType: 'none', align: 'left' };
            return { templateId: 'page_content', templateVariant: 1, minHeight: 'medium', bgType: 'none', align: 'center' };
        case 'SLIDER':
            if (presetId === 'img_text') {
                return normalizeSliderTemplateSettings({
                    templateId: 'img_text',
                    templateVariant: 0,
                    source: 'ImageSlider',
                    taggedItems: [],
                    slides: [],
                });
            }
            return normalizeSliderTemplateSettings({
                templateId: 'img_gallery',
                templateVariant: 1,
                source: 'ImageSlider',
                taggedItems: [],
                slides: [],
            });
        case 'DATA_GRID':
            if (presetId === 'cards_slider') return { source: 'News', columns: 3, ordering: '123', layout: 'slider', showAllWithoutTagging: false, imgPos: 'top', border: 'rounded', autoplay: false, speed: 5 };
            if (presetId === 'cards_2col') return { source: 'News', columns: 2, ordering: '123', layout: 'grid', showAllWithoutTagging: false, imgPos: 'left', border: 'rounded' };
            return { source: 'News', columns: 3, ordering: '123', layout: 'grid', showAllWithoutTagging: false, imgPos: 'top', border: 'sharp', imgBorder: 'sharp' };
        case 'CONTACT_FORM':
            if (presetId === 'contact_left') return { heading: '', subheading: '', alignment: 'left', bgType: 'none', bgColor: '#ffffff' };
            return { heading: '', subheading: '', alignment: 'center', bgType: 'none', bgColor: '#ffffff' };
        case 'MAP':
            if (presetId === 'map_continent') {
                return normalizeMapTemplateSettings({ mapType: 'Continent', selectedRegion: 'Europe', title: '' });
            }
            if (presetId === 'map_country') {
                return normalizeMapTemplateSettings({ mapType: 'Country', selectedRegion: 'Germany', title: '' });
            }
            if (presetId === 'map_briefwahl') {
                return normalizeMapTemplateSettings({ mapType: 'Briefwahl', title: '' });
            }
            if (presetId === 'map_europawahl') {
                return normalizeMapTemplateSettings({ mapType: 'Europawahl', title: '' });
            }
            return normalizeMapTemplateSettings({ mapType: 'World', title: '' });
        case 'CONTAINER_SECTION':
            return { bindPageTitleDescription: false, showTitleUnderline: true, letterCase: 'uppercase', titleColor: 'site', descColor: 'editorText' };
        default:
            return getDefaultTemplateSettingsForCategory(categoryId);
    }
};

/** Build a draft SectionTemplate from a built-in preset for the full editor. */
export const buildBuiltinPresetDraftTemplate = (
    categoryId: string,
    presetId: string,
    title: string,
    description: string
): SectionTemplate => {
    const containerType = CATEGORY_TO_CONTAINER_TYPE[categoryId] || ContainerType.HERO;
    return {
        id: `builtin_${presetId}`,
        title,
        description,
        containerType,
        status: 'Draft',
        settings: getBuiltinPresetSettings(categoryId, presetId),
        content: {},
        editableFields: getDefaultEditableFields(containerType),
        sortOrder: 0,
    };
};

/** Card/slider data sources available when creating section templates. */
export const TEMPLATE_DATA_SOURCE_OPTIONS = [
    'News',
    'Event',
    'Document',
    'SmartPages',
    'Container Items',
    'Contact',
] as const;

export const toStoredDataGridSource = (source: string): string => {
    if (source === 'SmartPages') return 'Smart Pages';
    return source;
};

export const buildCardGridTemplateSettingsForSource = (
    source: string,
    layoutPresetId = 'cards_grid_3'
): Record<string, unknown> => {
    const preset = getBuiltinPresetSettings('DATA_GRID', layoutPresetId);
    return normalizeCardGridTemplateSettings({
        ...preset,
        source: toStoredDataGridSource(source),
        taggedItems: [],
    });
};

/** Image/Text slider (classic one-slide-at-a-time) vs image gallery carousel. */
export const isImageTextSliderContainer = (settings?: Record<string, unknown> | null): boolean => {
    if (!settings) return false;
    const templateId = String(settings.templateId || '').toLowerCase();
    if (templateId === 'img_text') return true;
    if (templateId === 'img_gallery') return false;
    const variant = settings.templateVariant;
    return variant !== 1 && variant !== '1';
};

export const getTemplatePreviewId = (template: { containerType: ContainerType; settings?: Record<string, unknown> }): string => {
    const settings = template.settings || {};
    const templateId = settings.templateId as string | undefined;
    if (template.containerType === ContainerType.HERO) {
        if (templateId === 'color_header') return 'COLOR_BG';
        if (templateId === 'hero_img') return 'HERO';
        if (templateId === 'visual_text') return 'VISUAL';
        return 'CONTENT';
    }
    if (template.containerType === ContainerType.SLIDER) {
        return templateId === 'img_text' ? 'SLIDER' : 'GALLERY';
    }
    if (template.containerType === ContainerType.MAP) {
        const mapType = String(settings.mapType || 'World');
        if (mapType === 'Briefwahl') return 'MAP_BRIEFWAHL';
        if (mapType === 'Europawahl') return 'MAP_EUROPAWAHL';
        if (mapType === 'Continent') return 'MAP_CONTINENT';
        if (mapType === 'Country') return 'MAP_COUNTRY';
        return 'MAP_WORLD';
    }
    if (template.containerType === ContainerType.CONTAINER_SECTION) return 'CONTAINER_SECTION';
    return 'CONTENT';
};
