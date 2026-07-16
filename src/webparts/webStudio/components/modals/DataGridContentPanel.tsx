import React, { useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import {
    Search, X, Pencil, Plus, Monitor, List as ListIcon,
    ChevronDown, ArrowUpAZ, ArrowDownAZ, Image as ImageIcon,
    FileText, FileSpreadsheet, Presentation, Link as LinkIcon,
} from 'lucide-react';
import { IoCalendarOutline as IoCalendarOutlineIcon } from 'react-icons/io5';
const IoCalendarOutline = IoCalendarOutlineIcon as any;
import { LanguageCode } from '../../types';
import { getItemTranslation, getTranslation, useStore } from '../../store';
import { normalizeDataGridSource } from '../../utils/cardReadMore';
import {
    DataGridSortConfig,
    DataGridSortDirection,
    DataGridSortKey,
    getDataGridSortOptions,
    getDefaultDataGridSortConfig,
    getSectionSortConfigFromSettings,
    normalizeContentViewMode,
    normalizeSectionSortField,
    sortDataGridItems,
} from '../../utils/dataGridContentSort';
import {
    getDataGridCardBorderClass,
    getDataGridCardImageBorderClass,
    getDataGridCardLayout,
    getDataGridCardTitleStyle,
    getDataGridEditorGridStyle,
    getDataGridOrderedLabel,
} from '../../utils/dataGridCardPreview';
import { resolveCardGridGapStyle } from '../../utils/cardGridGap';
import { SortByHelpIcon } from './SharedModals';

const getDocIcon = (type: string) => {
    switch (type) {
        case 'Word': return <FileText className="w-8 h-8 opacity-80" style={{ color: 'var(--icon-color)' }} />;
        case 'Excel': return <FileSpreadsheet className="w-8 h-8 opacity-80" style={{ color: 'var(--status-success)' }} />;
        case 'PDF': return <FileText className="w-8 h-8 opacity-80" style={{ color: 'var(--status-error)' }} />;
        case 'PPT':
        case 'Presentations': return <Presentation className="w-8 h-8 opacity-80" style={{ color: 'var(--status-warning)' }} />;
        case 'Link': return <LinkIcon className="w-8 h-8 opacity-80" style={{ color: 'var(--icon-color)' }} />;
        default: return <FileText className="w-8 h-8 opacity-80" style={{ color: 'var(--icon-color)' }} />;
    }
};

export type DataGridPanelVariant = 'available' | 'tagged';

export interface DataGridContentPanelProps {
    panelKey: string;
    title: React.ReactNode;
    count: number;
    countBadgeVariant?: 'primary' | 'muted';
    items: any[];
    source: string;
    currentLanguage: LanguageCode;
    variant: DataGridPanelVariant;
    /** Saved section styling — columns, imgPos, borders, card typography, sort, view mode, etc. */
    containerSettings?: Record<string, unknown>;
    /** Persist view mode / sort into section settings (tagged panel only). */
    onUpdateSectionDisplay?: (patch: {
        sortField?: DataGridSortKey;
        sortDirection?: DataGridSortDirection;
        contentViewMode?: 'grid' | 'list';
    }) => void;
    /** When true, sort/view read and write section settings. When false, local panel state only. */
    persistDisplayToSection?: boolean;
    /** Hide sort / view-mode toolbar (template-locked Site Admin sections). */
    hideSectionDisplayControls?: boolean;
    hidePublishingStatus?: boolean;
    taggedIds?: string[];
    onTag?: (id: string) => void;
    onUntag?: (id: string) => void;
    onEdit: (item: any) => void;
    emptyMessage: string;
}

const getTitleFieldKey = (source: string): string => {
    const normalized = normalizeDataGridSource(source) || source;
    return normalized === 'Contact' ? 'fullName' : 'title';
};

const formatItemDate = (source: string, item: any, currentLanguage: LanguageCode): string | null => {
    const normalized = normalizeDataGridSource(source) || source;
    const raw =
        normalized === 'News' ? item.publishDate
            : normalized === 'Event' ? item.startDate
                : normalized === 'Document' ? item.date
                    : null;
    if (!raw) return null;
    return moment(raw).locale(currentLanguage).format('DD MMM YYYY');
};

const StatusBadge = ({ status, currentLanguage }: { status: string; currentLanguage: LanguageCode }) => {
    const isPublished = status === 'Published';
    return (
        <span
            className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full inline-block"
            style={{
                backgroundColor: isPublished
                    ? 'color-mix(in srgb, var(--status-success), white 85%)'
                    : 'color-mix(in srgb, var(--status-warning), white 82%)',
                color: isPublished ? 'var(--status-success)' : 'var(--status-warning)',
            }}
        >
            {isPublished
                ? getTranslation('STATUS_PUBLISHED', currentLanguage)
                : getTranslation('STATUS_DRAFT', currentLanguage)}
        </span>
    );
};

export const DataGridContentPanel = ({
    panelKey,
    title,
    count,
    countBadgeVariant = 'muted',
    items,
    source,
    currentLanguage,
    variant,
    containerSettings = {},
    onUpdateSectionDisplay,
    persistDisplayToSection = false,
    hideSectionDisplayControls = false,
    hidePublishingStatus = false,
    taggedIds,
    onTag,
    onUntag,
    onEdit,
    emptyMessage,
}: DataGridContentPanelProps) => {
    const { themeConfig } = useStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [localViewMode, setLocalViewMode] = useState<'grid' | 'list'>('list');
    const [localSortConfig, setLocalSortConfig] = useState<DataGridSortConfig>(() =>
        getDefaultDataGridSortConfig(source)
    );

    const sectionSortConfig = useMemo(
        () => getSectionSortConfigFromSettings(source, {
            sortField: containerSettings.sortField as string | undefined,
            sortDirection: containerSettings.sortDirection as string | undefined,
        }),
        [source, containerSettings.sortField, containerSettings.sortDirection]
    );
    const sectionViewMode = normalizeContentViewMode(containerSettings.contentViewMode as string | undefined);

    const contentViewMode = persistDisplayToSection ? sectionViewMode : localViewMode;
    const sortConfig = persistDisplayToSection ? sectionSortConfig : localSortConfig;

    const gridColumns = Number(containerSettings.columns) || 3;
    const useOldCardLayout = !!containerSettings.useOldCardLayout;
    const ordering = String(containerSettings.ordering || '123');
    const cardLayout = useMemo(
        () => getDataGridCardLayout(containerSettings, gridColumns),
        [containerSettings, gridColumns]
    );
    const borderClass = getDataGridCardBorderClass(containerSettings);
    const cardTitleStyle = useMemo(
        () => getDataGridCardTitleStyle(containerSettings, themeConfig),
        [containerSettings, themeConfig]
    );
    const gridStyle = useMemo(() => {
        const base = getDataGridEditorGridStyle(gridColumns, containerSettings.spacing as string | undefined);
        const gapStyle = resolveCardGridGapStyle({
            useFlatBrowseList: false,
            isSlider: false,
            useOldCardLayout,
            spacing: containerSettings.spacing as string | undefined,
        });
        return { ...base, ...gapStyle };
    }, [gridColumns, containerSettings.spacing, useOldCardLayout]);

    useEffect(() => {
        setSearchTerm('');
        if (!persistDisplayToSection) {
            setLocalSortConfig(getDefaultDataGridSortConfig(source));
            setLocalViewMode('list');
        }
    }, [source, persistDisplayToSection]);

    const handleSortFieldChange = (key: DataGridSortKey) => {
        if (persistDisplayToSection) {
            onUpdateSectionDisplay?.({ sortField: key });
        } else {
            setLocalSortConfig((prev) => ({ ...prev, key }));
        }
    };

    const handleSortDirectionToggle = () => {
        const nextDirection = sortConfig.direction === 'asc' ? 'desc' : 'asc';
        if (persistDisplayToSection) {
            onUpdateSectionDisplay?.({ sortDirection: nextDirection });
        } else {
            setLocalSortConfig((prev) => ({ ...prev, direction: nextDirection }));
        }
    };

    const handleViewModeChange = (mode: 'grid' | 'list') => {
        if (persistDisplayToSection) {
            onUpdateSectionDisplay?.({ contentViewMode: mode });
        } else {
            setLocalViewMode(mode);
        }
    };

    const titleFieldKey = getTitleFieldKey(source);
    const sortOptions = useMemo(
        () => getDataGridSortOptions(source, currentLanguage, getTranslation),
        [source, currentLanguage]
    );

    const effectiveSortKey = useMemo(
        () => normalizeSectionSortField(source, sortConfig.key),
        [source, sortConfig.key]
    );

    const processedItems = useMemo(() => {
        const activeSortConfig: DataGridSortConfig = { ...sortConfig, key: effectiveSortKey };
        const sorted = sortDataGridItems(
            items as Record<string, unknown>[],
            activeSortConfig,
            source,
            undefined,
            currentLanguage
        );
        if (!searchTerm.trim()) return sorted;
        const query = searchTerm.trim().toLowerCase();
        return sorted.filter((item) => {
            const label = getItemTranslation(item, currentLanguage, titleFieldKey).toLowerCase();
            return label.includes(query);
        });
    }, [items, sortConfig, effectiveSortKey, source, searchTerm, currentLanguage, titleFieldKey]);

    const countBadgeStyle =
        countBadgeVariant === 'primary'
            ? { backgroundColor: 'var(--primary-color)', color: '#fff' }
            : { backgroundColor: 'color-mix(in srgb, var(--border-color, #e5e7eb), white 40%)', color: 'var(--text-secondary, #6b7280)' };

    const hasCardBorder = containerSettings.border !== 'none';
    const imgPos = String(containerSettings.imgPos || 'top');
    const imgBorder = String(containerSettings.imgBorder || containerSettings.border || 'sharp');

    const renderCardImage = (item: any) => {
        const hasVisual = item.imageUrl || source === 'Document';
        if (imgPos === 'none' || !hasVisual) return null;

        if (imgBorder === 'circle') {
            return (
                <div className="w-full flex justify-center pt-4 pb-2">
                    <div
                        className="w-24 h-24 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--border-color, #e5e7eb), white 50%)', border: '2px solid var(--border-color, #e5e7eb)' }}
                    >
                        {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" /> : getDocIcon(item.type)}
                    </div>
                </div>
            );
        }

        if (imgBorder === 'halfcircle') {
            return (
                <div className="absolute" style={{ top: '-3.5rem', left: '50%', transform: 'translateX(-50%)' }}>
                    <div className="w-24 h-24 rounded-full overflow-hidden flex-shrink-0 shadow-md" style={{ border: '4px solid #fff' }}>
                        {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" /> : getDocIcon(item.type)}
                    </div>
                </div>
            );
        }

        const imgBorderClass = getDataGridCardImageBorderClass(containerSettings, imgPos);
        return (
            <div
                className={`${cardLayout.img} relative flex-shrink-0 flex items-center justify-center bg-gray-100 ${imgBorderClass}`}
                style={cardLayout.imgStyle}
            >
                {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover object-center" />
                ) : source === 'Document' ? (
                    getDocIcon(item.type)
                ) : (
                    <ImageIcon className="w-8 h-8" style={{ color: 'var(--border-color, #d1d5db)' }} />
                )}
            </div>
        );
    };

    const renderGridCard = (item: any, index: number) => {
        const dateLabel = formatItemDate(source, item, currentLanguage);
        const isHalfCircle = imgBorder === 'halfcircle';
        const showOrdering = useOldCardLayout && ordering !== 'none';

        return (
            <div
                key={item.id}
                className={`${useOldCardLayout ? 'bg-transparent' : 'bg-white'} group flex relative box-border h-full transition-shadow
                    ${!useOldCardLayout && hasCardBorder ? 'border border-gray-200 shadow-sm hover:shadow-md' : ''}
                    ${useOldCardLayout ? 'flex-col' : `${cardLayout.card} ${borderClass}`}
                    ${isHalfCircle && !useOldCardLayout ? 'overflow-visible mt-14' : !useOldCardLayout ? 'overflow-hidden' : ''}`}
                style={isHalfCircle && !useOldCardLayout ? { borderLeft: '4px solid var(--primary-color)' } : undefined}
            >
                {!useOldCardLayout && renderCardImage(item)}
                {variant === 'tagged' && onUntag && (
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button type="button" onClick={() => onUntag(item.id)} className="p-1 rounded-sm shadow-sm" style={{ backgroundColor: 'rgba(255,255,255,0.92)', color: 'var(--status-error)' }}>
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}
                {useOldCardLayout ? (
                    <div className="flex-1 flex flex-row items-stretch gap-3 min-w-0">
                        {showOrdering && (
                            <div
                                className="select-none flex-shrink-0 leading-none"
                                style={{
                                    fontSize: '2rem',
                                    fontWeight: 700,
                                    fontFamily: 'var(--font-family-secondary, sans-serif)',
                                    color: 'var(--border-color, #e5e7eb)',
                                    lineHeight: 1,
                                    minWidth: '2.5rem',
                                }}
                            >
                                {getDataGridOrderedLabel(index, ordering)}
                            </div>
                        )}
                        <div className="flex flex-col flex-1 min-w-0 pr-2">
                            {dateLabel && (source === 'News' || source === 'Event') && (
                                <div className="inline-flex items-center gap-1.5 mb-1 text-xs font-bold italic" style={{ color: 'var(--text-secondary, #808080)' }}>
                                    <IoCalendarOutline className="w-3.5 h-3.5 shrink-0" />
                                    <span>{dateLabel}</span>
                                </div>
                            )}
                            <h3 className="font-bold line-clamp-3 leading-snug mb-2 ws-card-grid-item-title" style={cardTitleStyle}>
                                {getItemTranslation(item, currentLanguage, titleFieldKey)}
                            </h3>
                            <div className="mt-auto flex justify-between items-center gap-2 pt-1">
                                <StatusBadge status={item.status} currentLanguage={currentLanguage} />
                                <button type="button" onClick={() => onEdit(item)} className="p-1 rounded-sm hover:bg-[var(--brand-light)]" style={{ color: 'var(--icon-color)' }}>
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                <div className={`flex-1 flex flex-col min-w-0 p-3 ${imgPos === 'left' || imgPos === 'right' ? '' : ''}`}>
                    {dateLabel && (source === 'News' || source === 'Event') && (
                        <div className="inline-flex items-center gap-1.5 mb-2 text-xs font-bold italic" style={{ color: 'var(--text-secondary, #808080)' }}>
                            <IoCalendarOutline className="w-3.5 h-3.5 shrink-0" />
                            <span>{dateLabel}</span>
                        </div>
                    )}
                    <h3 className="font-bold line-clamp-3 leading-snug mb-2 ws-card-grid-item-title" style={cardTitleStyle}>
                        {getItemTranslation(item, currentLanguage, titleFieldKey)}
                    </h3>
                    <div className="mt-auto flex justify-between items-center gap-2 pt-1">
                        {!hidePublishingStatus && (
                            <StatusBadge status={item.status} currentLanguage={currentLanguage} />
                        )}
                        <button type="button" onClick={() => onEdit(item)} className="p-1 rounded-sm hover:bg-[var(--brand-light)]" style={{ color: 'var(--icon-color)' }}>
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    {variant === 'available' && onTag && (
                        <button
                            type="button"
                            onClick={() => onTag(item.id)}
                            className="mt-2 w-full px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm flex items-center justify-center gap-1"
                            style={{ border: '1px solid var(--border-color, #d1d5db)', color: 'var(--text-secondary, #6b7280)' }}
                        >
                            {getTranslation('LABEL_TAG', currentLanguage)} <Plus className="w-3 h-3" />
                        </button>
                    )}
                </div>
                )}
            </div>
        );
    };

    const renderListRow = (item: any, isTaggedRow: boolean) => {
        const dateLabel = formatItemDate(source, item, currentLanguage);
        return (
            <div key={item.id} className="bg-white p-3 rounded-sm flex gap-3 group hover:shadow-md transition-all items-center border border-gray-200">
                <div className="w-14 h-14 bg-gray-100 rounded-sm flex-shrink-0 overflow-hidden border border-gray-100 flex items-center justify-center">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-gray-300" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="font-bold text-sm truncate" style={{ ...cardTitleStyle, fontSize: '0.875rem' }}>
                            {getItemTranslation(item, currentLanguage, titleFieldKey)}
                        </div>
                        <button type="button" onClick={() => onEdit(item)} className="p-1 hover:bg-[var(--brand-light)] rounded-sm shrink-0" style={{ color: 'var(--icon-color)' }}>
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    {dateLabel && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                            <IoCalendarOutline className="w-3.5 h-3.5 shrink-0" />
                            <span>{dateLabel}</span>
                        </div>
                    )}
                    {!hidePublishingStatus && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {isTaggedRow && (
                                <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                                    {getTranslation('LABEL_PUBLISHING_STATUS', currentLanguage)}:
                                </span>
                            )}
                            <StatusBadge status={item.status} currentLanguage={currentLanguage} />
                        </div>
                    )}
                </div>
                <div className="flex gap-1 shrink-0">
                    {variant === 'available' && onTag && (
                        <button type="button" onClick={() => onTag(item.id)} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-500 text-[10px] font-bold uppercase rounded-sm flex items-center gap-1">
                            {getTranslation('LABEL_TAG', currentLanguage)} <Plus className="w-3 h-3" />
                        </button>
                    )}
                    {variant === 'tagged' && onUntag && (
                        <button type="button" onClick={() => onUntag(item.id)} className="px-3 py-1.5 text-white text-[10px] font-bold uppercase rounded-sm flex items-center gap-1" style={{ backgroundColor: 'var(--btn-primary-bg)' }}>
                            {getTranslation('BTN_UNTAG', currentLanguage)} <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col bg-white border border-gray-200 shadow-sm rounded-sm h-full min-h-0">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-3 shrink-0">
                <div className="flex items-center justify-between gap-3 min-w-0">
                    <h4
                        className="font-bold flex items-center gap-2 min-w-0 flex-1 overflow-hidden"
                        style={{ color: 'var(--primary-color)', fontFamily: 'var(--font-family-secondary, serif)' }}
                    >
                        <h4 className="font-bold truncate" style={{ color: 'var(--primary-color)', fontFamily: 'var(--font-family-secondary, serif)' }}>{title}</h4>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold not-italic shrink-0" style={countBadgeStyle}>{count}</span>
                    </h4>
                    {!hideSectionDisplayControls && (
                    <div className="flex items-center gap-3 shrink-0 flex-nowrap">
                        <div className="flex items-center gap-2 text-xs text-gray-600 flex-nowrap">
                            <span className="whitespace-nowrap">{getTranslation('LABEL_SORT_BY', currentLanguage)}</span>
                            <SortByHelpIcon variant="cards" />
                            <div className="relative inline-flex shrink-0">
                                <select
                                    className="border border-gray-300 py-2 pl-3 pr-8 text-sm rounded-sm bg-white focus:ring-1 focus:ring-[var(--primary-color)] outline-none cursor-pointer w-[9.75rem]"
                                    style={{
                                        appearance: 'none',
                                        WebkitAppearance: 'none',
                                        MozAppearance: 'none',
                                        backgroundImage: 'none',
                                    }}
                                    value={effectiveSortKey}
                                    onChange={(e) => handleSortFieldChange(e.target.value as DataGridSortKey)}
                                    aria-label={getTranslation('LABEL_SORT_BY', currentLanguage)}
                                >
                                    {sortOptions.map((option) => (
                                        <option key={option.key} value={option.key}>{option.label}</option>
                                    ))}
                                </select>
                                <ChevronDown
                                    className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                                    aria-hidden
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleSortDirectionToggle}
                                className="p-1.5 border border-gray-300 rounded-sm hover:bg-[var(--brand-light)] shrink-0"
                                style={{ color: 'var(--primary-color)' }}
                                title={sortConfig.direction === 'asc' ? getTranslation('BTN_SORT_ASCENDING', currentLanguage) : getTranslation('BTN_SORT_DESCENDING', currentLanguage)}
                            >
                                {sortConfig.direction === 'asc' ? <ArrowUpAZ className="w-4 h-4" /> : <ArrowDownAZ className="w-4 h-4" />}
                            </button>
                        </div>
                        <div className="flex border border-[var(--primary-color)] rounded-sm overflow-hidden shrink-0">
                            <button
                                type="button"
                                onClick={() => handleViewModeChange('grid')}
                                className={`ws-view-toggle-btn p-1.5 transition-colors ${contentViewMode === 'grid' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-[var(--brand-light)]'}`}
                                title={getTranslation('LABEL_VISUAL_VIEW', currentLanguage)}
                            >
                                <Monitor className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleViewModeChange('list')}
                                className={`ws-view-toggle-btn p-1.5 transition-colors ${contentViewMode === 'list' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-[var(--brand-light)]'}`}
                                title={getTranslation('LABEL_LIST_VIEW', currentLanguage)}
                            >
                                <ListIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    )}
                </div>
                <div className="relative">
                    <input
                        type="text"
                        placeholder={getTranslation('LABEL_SEARCH_ITEMS', currentLanguage)}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full border border-gray-300 py-2 pl-8 text-sm rounded-sm focus:border-[var(--primary-color)] outline-none"
                    />
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                    {searchTerm && (
                        <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 pr-4 bg-gray-50/30 min-h-0">
                {processedItems.length === 0 ? (
                    <div className="text-center p-12 text-gray-400 text-xs">{emptyMessage}</div>
                ) : contentViewMode === 'grid' ? (
                    <div className="ws-card-grid-editor" style={gridStyle}>
                        {processedItems.map((item, index) => renderGridCard(item, index))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {processedItems.map((item) => renderListRow(item, variant === 'tagged'))}
                    </div>
                )}
            </div>
        </div>
    );
};
