import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, ExternalLink, InfoIcon, CheckCircle2, ArrowUp, ArrowDown, Image as ImageIcon, GripVertical } from 'lucide-react';
import { TooltipHost, DirectionalHint } from '@fluentui/react';
import { useStore, getTranslation } from '../../store';
import { getNestedPortalZFromStore } from '../../utils/modalZIndex';
import { useSPContext } from '../../contexts/SPServiceContext';
import { getItemVersions } from '../../services/SPService';
import { PROVISIONED_LIST_COLUMNS, restoreVersionAndOpenSharePoint, buildSharePointItemUrl, formatVersionFieldValue } from '../common/SharePointMetadataFooter';
import { MODAL_Z } from '../../utils/modalZIndex';

export { MODAL_Z };


// --- DYNAMIC TOOLTIP COMPONENT (Using Fluent UI) ---
export const Tooltip = ({ text, children }: { text: string, children: React.ReactNode }) => {
    return (
        <TooltipHost
            content={text}
            directionalHint={DirectionalHint.topCenter}
            styles={{ root: { display: 'inline-flex', alignItems: 'center' } }}
            tooltipProps={{
                styles: {
                    content: {
                        whiteSpace: 'pre-line',
                        lineHeight: '1.45'
                    }
                }
            }}
            calloutProps={{
                styles: {
                    root: { zIndex: 1000000 } // High z-index to stay above modals
                }
            }}
        >
            {children}
        </TooltipHost>
    );
};

export type SortByHelpVariant = 'list' | 'cards';

export const SortByHelpIcon = ({ variant = 'list', className = '' }: { variant?: SortByHelpVariant; className?: string }) => {
    const { currentLanguage } = useStore();
    const helpKey = variant === 'cards' ? 'HELP_SORT_BY_CARDS_DESC' : 'HELP_SORT_BY_DESC';
    const helpText = getTranslation(helpKey, currentLanguage);
    return (
        <Tooltip text={helpText}>
            <span
                className={`inline-flex shrink-0 cursor-help align-middle ${className}`}
                aria-label={helpText}
                role="img"
            >
                <InfoIcon className="w-3.5 h-3.5 text-gray-400" />
            </span>
        </Tooltip>
    );
};

// --- BIND PAGE TITLE & DESCRIPTION CHECKBOX (Text Template) ---
export const BindPageTitleDescriptionField = ({
    checked,
    onChange,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
}) => {
    const { currentLanguage, themeConfig } = useStore();
    return (
        <label className="flex items-center gap-2 cursor-pointer select-none pb-4 mb-2 border-b border-gray-100">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="focus:ring-1"
                style={{ color: themeConfig['--primary-color'] }}
            />
            <span className="text-sm text-gray-700">{getTranslation('LABEL_BIND_PAGE_TITLE_DESCRIPTION', currentLanguage)}</span>
            <Tooltip text={getTranslation('TOOLTIP_BIND_PAGE_TITLE_DESCRIPTION', currentLanguage)}>
                <span className="inline-flex items-center">
                    <InfoIcon className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
                </span>
            </Tooltip>
        </label>
    );
};

// --- EDIT TRIGGER COMPONENT ---
export const EditTrigger = ({ labelKey, className = "", title, color = "var(--icon-color)", size = "w-3.5 h-3.5" }: { labelKey: string, className?: string, title?: string, color?: string, size?: string }) => {
    const { openLabelEditor, currentLanguage } = useStore();
    const tooltipTitle = title ?? getTranslation('TITLE_EDIT_TRANSLATION', currentLanguage);
    return (
        <button
            type="button"
            className={`transition-all cursor-pointer inline-flex items-center justify-center hover:scale-110 active:scale-95 focus:outline-none bg-transparent border-none p-0 ${className}`}
            title={tooltipTitle}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openLabelEditor(labelKey);
            }}
        >
            <InfoIcon className={`${size} opacity-70 hover:opacity-100 transition-opacity`} style={{ color }} />
        </button>
    );
};

// --- OPEN OOTB FORM BUTTON ---
export const OpenOOTBButton = ({ listTitle, isLibrary = false }: { listTitle: string, isLibrary?: boolean }) => {
    const { context } = useSPContext();
    const { currentLanguage } = useStore();

    const handleOpen = () => {
        const siteUrl = context.pageContext.web.absoluteUrl;
        let url = isLibrary
            ? `${siteUrl}/${listTitle}/Forms/AllItems.aspx`
            : `${siteUrl}/Lists/${listTitle}/AllItems.aspx`;

        // Special handling for Documents library
        if (listTitle === 'Documents') {
            url = `${siteUrl}/Shared%20Documents/Forms/AllItems.aspx`;
        }

        window.open(url, '_blank');
    };

    return (
        <button
            type="button"
            onClick={handleOpen}
            className="btn-secondary flex items-center gap-2 transition-colors mr-auto"
        >
            <ExternalLink className="w-3.5 h-3.5" />
            {getTranslation('LABEL_OPEN_OOTB_FORM', currentLanguage) || 'Open Out-of-the-Box Form'}
        </button>
    );
};

// --- SHARED VERSION HISTORY MODAL (loads real SharePoint versions when listTitle + itemId are set) ---
export const SharedVersionHistoryModal = ({
    onClose,
    listTitle,
    itemId,
    onVersionRestore
}: {
    onClose: () => void;
    listTitle?: string;
    itemId?: string;
    onVersionRestore?: () => void;
}) => {
    const { currentLanguage } = useStore();
    const { context } = useSPContext();
    const [versions, setVersions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const numericId = itemId ? parseInt(itemId, 10) : NaN;
    const canFetch = Boolean(listTitle && itemId && Number.isFinite(numericId) && numericId > 0);

    useEffect(() => {
        if (!canFetch || !listTitle) {
            setVersions([]);
            setLoading(false);
            setError(null);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        getItemVersions(listTitle, numericId)
            .then((history) => {
                if (!cancelled) {
                    setVersions(Array.isArray(history) ? history : []);
                }
            })
            .catch((err) => {
                console.error('Version history load failed:', err);
                if (!cancelled) {
                    setError(getTranslation('MSG_VERSION_LOAD_ERROR', currentLanguage) || 'Could not load version history from SharePoint.');
                    setVersions([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [canFetch, listTitle, numericId]);

    const handleRestore = async (version: any) => {
        if (!canFetch || !listTitle) return;
        const pendingWindow = window.open('about:blank', '_blank');
        try {
            const siteUrl = context.pageContext.web.absoluteUrl;
            const versionLabel = String(version?.VersionLabel || '');
            if (!versionLabel) {
                throw new Error('Missing version label for restore URL');
            }
            const versionNo = version?.VersionId ?? version?.ID ?? version?.Id ?? versionLabel;
            await restoreVersionAndOpenSharePoint(siteUrl, listTitle, String(numericId), versionLabel, pendingWindow, versionNo);
            onVersionRestore?.();
            onClose();
        } catch (e) {
            if (pendingWindow && !pendingWindow.closed) {
                pendingWindow.location.href = buildSharePointItemUrl(context.pageContext.web.absoluteUrl, listTitle, String(numericId));
            }
            console.error('Restore version failed:', e);
        }
    };

    const formatCompactModifiedDate = (value: any): string => {
        const date = value ? new Date(value) : null;
        if (!date || Number.isNaN(date.getTime())) {
            return String(value || '');
        }

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const suffix = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;

        return `${day}/${month}/${year} ${hours}:${minutes}${suffix}`;
    };

    const getEditorName = (editor: any): string => editor?.LookupValue || editor?.Title || 'System';

    const getEditorEmail = (editor: any): string =>
        editor?.Email || editor?.EMail || editor?.email || editor?.UserPrincipalName || '';

    const getEditorAvatarUrl = (editor: any): string => {
        const email = getEditorEmail(editor);
        if (!email) return '';
        return `${window.location.origin}/_layouts/15/userphoto.aspx?size=S&accountname=${encodeURIComponent(email)}`;
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: getNestedPortalZFromStore(0) }}>
            <div className="bg-white w-[900px] min-w-[900px] max-w-[900px] shadow-2xl rounded-sm border border-gray-300 flex flex-col h-[85vh] min-h-[85vh] max-h-[85vh]">
                <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0">
                    <h3 className="text-xl font-bold text-[var(--primary-color)]">{getTranslation('BTN_HISTORY', currentLanguage)}</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" style={{ color: 'var(--icon-color)' }} /></button>
                </div>
                <div className="flex-1 overflow-auto p-0 bg-white">
                    {!canFetch ? (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            {getTranslation('MSG_VERSION_NO_CONTEXT', currentLanguage) || 'Waehlen Sie eine Seite und oeffnen Sie den Versionsverlauf erneut oder nutzen Sie ihn aus der Seitenverwaltung bei ausgewaehlter Seite.'}
                        </div>
                    ) : loading ? (
                        <div className="flex justify-center p-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-color)]" />
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center text-red-600 text-sm">{error}</div>
                    ) : versions.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">{getTranslation('MSG_NO_VERSIONS', currentLanguage) || 'No version history found.'}</div>
                    ) : (
                        <table className="w-full text-sm text-left border-collapse table-fixed">
                            <thead className="bg-white text-[var(--primary-color)] font-bold border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 w-20 border-r border-gray-100">{getTranslation('TH_NO', currentLanguage) || 'No'}</th>
                                    <th className="px-6 py-3 border-r border-gray-100">{getTranslation('LABEL_INFO', currentLanguage) || 'Info'}</th>
                                    <th className="px-6 py-3 w-80 whitespace-nowrap">{getTranslation('LABEL_MODIFIED_BY', currentLanguage) || 'Modified by'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {versions.map((version, index) => {
                                    const previousVersion = versions[index + 1];
                                    const relevantFields = (listTitle && PROVISIONED_LIST_COLUMNS[listTitle]) || [];
                                    const changedFields = relevantFields.filter((key) => {
                                        const currentVal = version[key];
                                        if (previousVersion) {
                                            return currentVal != previousVersion[key];
                                        }
                                        return currentVal !== null && currentVal !== undefined && currentVal !== '';
                                    });

                                    return (
                                        <tr key={version.VersionLabel || index} className="group hover:bg-gray-50 transition-colors align-top">
                                            <td className="px-6 py-4 text-gray-900 font-medium border-r border-gray-100">{version.VersionLabel}</td>
                                            <td className="px-6 py-4 border-r border-gray-100">
                                                <div className="space-y-2">
                                                    {changedFields.length > 0 ? (
                                                        changedFields.map((key) => {
                                                            const rawVal = version[key];
                                                            const displayValue = formatVersionFieldValue(key, rawVal);
                                                            return (
                                                                <div key={key} className="grid grid-cols-[140px_1fr] gap-4 min-w-0">
                                                                    <span className="text-gray-900 font-medium break-words">{key}</span>
                                                                    <pre className="text-gray-700 whitespace-pre-wrap break-all min-w-0 m-0 font-sans text-sm leading-5">{displayValue}</pre>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <span className="text-gray-400 italic">{getTranslation('MSG_NO_DETAILS', currentLanguage) || 'No tracked changes'}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 align-top whitespace-nowrap">
                                                <div className="flex flex-col gap-2 text-[var(--primary-color)]">
                                                    <div className="flex items-center justify-between gap-3 min-w-0">
                                                        <span className="font-medium text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis">
                                                            {formatCompactModifiedDate(version.Created)}
                                                        </span>
                                                        {getEditorAvatarUrl(version.Editor) ? (
                                                            <img
                                                                src={getEditorAvatarUrl(version.Editor)}
                                                                alt={getEditorName(version.Editor)}
                                                                title={getEditorName(version.Editor)}
                                                                className="w-7 h-7 rounded-full object-cover border border-gray-200 flex-shrink-0"
                                                            />
                                                        ) : (
                                                            <div
                                                                title={getEditorName(version.Editor)}
                                                                className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-[11px] font-bold flex items-center justify-center flex-shrink-0"
                                                            >
                                                                {getEditorName(version.Editor).charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRestore(version)}
                                                        className="mt-1 text-xs text-[var(--primary-color)] hover:text-blue-800 underline self-start opacity-0 group-hover:opacity-100 transition-opacity text-left whitespace-nowrap"
                                                    >
                                                        Restore this version
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end flex-shrink-0">
                    <button type="button" onClick={onClose} className="btn-secondary shadow-sm transition-colors">{getTranslation('BTN_CLOSE', currentLanguage)}</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const GenericModal = ({
    title,
    subtitle,
    children,
    onClose,
    width = 'w-[800px] min-w-[800px] max-w-[800px]',
    heightClass = 'h-[90vh] min-h-[90vh] max-h-[90vh]',
    noFooter = false,
    headerIcons = null,
    className = '',
    customFooter = null,
    customFooterClassName,
    hasActiveSubModal = false,
    bodyOverflow = 'auto',
    noBodyPadding = false
}: any) => {
    const { currentLanguage } = useStore();
    const bodyScrollClass = bodyOverflow === 'hidden' ? 'overflow-hidden' : 'overflow-y-auto';
    const footerWrapBg = customFooterClassName || 'bg-gray-50';
    return (
        <div className={`bg-white rounded-sm shadow-2xl flex flex-col ${heightClass} ${width} relative animate-in fade-in zoom-in-95 duration-200 border border-gray-300 ${className}`}>
            {/* Smart Dimming Overlay for Multi-Level Modals */}
            {hasActiveSubModal && (
                <div className="absolute inset-0 bg-black/40 z-[60] backdrop-blur-[2px] rounded-sm transition-all duration-300 flex items-center justify-center">
                    <div className="bg-white/90 px-4 py-2 rounded-full shadow-lg text-sm font-bold text-gray-800 animate-pulse">
                        {getTranslation('MSG_EDITING_CONNECTED', currentLanguage) || 'Editing Connected Item...'}
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0">
                <div className="flex flex-col">
                    <h2 className="text-[var(--primary-color)] text-left tracking-tight">{title}</h2>
                    {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-2">
                    {headerIcons && <div className="flex items-center">{headerIcons}</div>}
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-700 rounded-sm hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" style={{ color: 'var(--icon-color)' }} />
                    </button>
                </div>
            </div>
            <div
                className={`flex-1 ${bodyScrollClass} bg-gray-50/50 relative flex flex-col min-h-0`}
                style={noBodyPadding ? undefined : { padding: '14px 21px' }}
            >
                {children}
            </div>
            {!noFooter && !customFooter && (
                <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3 rounded-b-sm flex-shrink-0 z-10">
                    <button type="button" onClick={onClose} className="btn-secondary transition-colors inline-flex items-center justify-center gap-2">
                        {getTranslation('BTN_CANCEL', currentLanguage)} <EditTrigger labelKey="BTN_CANCEL" />
                    </button>
                    <button type="button" onClick={onClose} className="btn-primary shadow-sm transition-colors inline-flex items-center justify-center gap-2">
                        {getTranslation('BTN_SAVE_CHANGES', currentLanguage)} <EditTrigger labelKey="BTN_SAVE_CHANGES" />
                    </button>
                </div>
            )}
            {customFooter && (
                <div className={`px-6 py-4 border-t border-gray-200 rounded-b-sm flex-shrink-0 w-full z-10 ${footerWrapBg}`}>
                    {customFooter}
                </div>
            )}
        </div>
    );
};

export type TaggedOrderItem = {
    id: string;
    title: string;
    imageUrl?: string;
    status?: string;
};

export type TaggedOrderApplyResult = {
    orderedIds: string[];
};

/** Context for opening the reorder modal from an item editor (Cards / slider / etc.). */
export type TaggedOrderChangeContext = {
    taggedIds: string[];
    items: TaggedOrderItem[];
    onApply: (result: TaggedOrderApplyResult) => void | Promise<void>;
};

const TAGGED_ORDER_DRAG_KEY = 'taggedOrderId';

/** Modal to reorder tagged items via drag-and-drop and up/down arrows. */
export const TaggedItemsOrderModal = ({
    title,
    items,
    orderedIds,
    highlightItemId,
    onApply,
    onClose,
}: {
    title?: string;
    items: TaggedOrderItem[];
    orderedIds: string[];
    /** Highlights and scrolls to the item being edited (opened from item editor). */
    highlightItemId?: string;
    onApply: (result: TaggedOrderApplyResult) => void;
    onClose: () => void;
}) => {
    const { currentLanguage } = useStore();
    const [order, setOrder] = useState<string[]>(() => [...orderedIds]);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const rowRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        setOrder([...orderedIds]);
    }, [orderedIds.join('|')]);

    useEffect(() => {
        if (!highlightItemId) return;
        const timer = window.setTimeout(() => {
            const el = rowRefs.current[String(highlightItemId)];
            el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 80);
        return () => window.clearTimeout(timer);
    }, [highlightItemId, order.join('|')]);

    const itemById = React.useMemo(() => {
        const map = new Map<string, TaggedOrderItem>();
        items.forEach((item) => map.set(String(item.id), item));
        return map;
    }, [items]);

    const reorderByDrop = (sourceId: string, targetId: string) => {
        if (!sourceId || sourceId === targetId) return;
        const next = [...order];
        const dragIdx = next.findIndex((id) => String(id) === String(sourceId));
        const hoverIdx = next.findIndex((id) => String(id) === String(targetId));
        if (dragIdx < 0 || hoverIdx < 0) return;
        const [moved] = next.splice(dragIdx, 1);
        next.splice(hoverIdx, 0, moved);
        setOrder(next);
    };

    const move = (index: number, direction: 'up' | 'down') => {
        const next = [...order];
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        setOrder(next);
    };

    const handleApply = () => {
        onApply({ orderedIds: order });
        onClose();
    };

    const modalTitle = title || getTranslation('TITLE_CHANGE_ORDER', currentLanguage);

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: getNestedPortalZFromStore(10) }}>
            <div className="bg-white w-[540px] min-w-[540px] max-w-[90vw] shadow-2xl rounded-sm border border-gray-300 flex flex-col overflow-hidden max-h-[85vh]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
                    <h3 className="text-base font-bold text-gray-900">{modalTitle}</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <p className="px-5 pt-3 pb-1 text-xs text-gray-500">{getTranslation('MSG_CHANGE_ORDER_HINT', currentLanguage)}</p>
                <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 min-h-0">
                    {order.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">{getTranslation('LABEL_NO_ITEMS_TAGGED', currentLanguage)}</p>
                    ) : (
                        order.map((id, index) => {
                            const item = itemById.get(String(id));
                            const label = item?.title || id;
                            const isHighlighted = Boolean(highlightItemId && String(id) === String(highlightItemId));
                            const isDropTarget = dragOverId === String(id) && !isHighlighted;
                            return (
                                <div
                                    key={id}
                                    ref={(el) => { rowRefs.current[String(id)] = el; }}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData(TAGGED_ORDER_DRAG_KEY, String(id));
                                        e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        setDragOverId(String(id));
                                    }}
                                    onDragLeave={() => setDragOverId((prev) => (prev === String(id) ? null : prev))}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const sourceId = e.dataTransfer.getData(TAGGED_ORDER_DRAG_KEY);
                                        reorderByDrop(sourceId, String(id));
                                        setDragOverId(null);
                                    }}
                                    onDragEnd={() => setDragOverId(null)}
                                    className={`flex items-center gap-3 border rounded-sm p-3 transition-colors cursor-default ${
                                        isHighlighted
                                            ? 'border-2 border-[var(--primary-color)] bg-[var(--brand-light,#eff6ff)] shadow-md ring-2 ring-[var(--primary-color)]/20'
                                            : isDropTarget
                                                ? 'border-[var(--primary-color)] bg-[var(--brand-light,#eff6ff)] shadow-sm border-gray-200'
                                                : 'border-gray-200 bg-white'
                                    }`}
                                >
                                    <div
                                        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0"
                                        title={getTranslation('MSG_DRAG_TO_REORDER', currentLanguage)}
                                    >
                                        <GripVertical className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-gray-400 w-5 text-center shrink-0">{index + 1}</span>
                                    <div className="w-10 h-8 bg-gray-100 border border-gray-100 rounded-sm overflow-hidden flex-shrink-0 flex items-center justify-center">
                                        {item?.imageUrl ? (
                                            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <ImageIcon className="w-4 h-4 text-gray-300" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm text-gray-800 truncate">{label}</div>
                                        {isHighlighted && (
                                            <span className="text-[9px] font-bold uppercase text-[var(--primary-color)]">
                                                {getTranslation('LABEL_CURRENT_ITEM_IN_ORDER', currentLanguage)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-0.5 shrink-0">
                                        <button
                                            type="button"
                                            disabled={index === 0}
                                            onClick={() => move(index, 'up')}
                                            className="p-1 text-gray-500 hover:text-[var(--primary-color)] hover:bg-gray-50 rounded-sm disabled:opacity-30 disabled:pointer-events-none"
                                            title={getTranslation('BTN_MOVE_UP', currentLanguage)}
                                        >
                                            <ArrowUp className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            disabled={index === order.length - 1}
                                            onClick={() => move(index, 'down')}
                                            className="p-1 text-gray-500 hover:text-[var(--primary-color)] hover:bg-gray-50 rounded-sm disabled:opacity-30 disabled:pointer-events-none"
                                            title={getTranslation('BTN_MOVE_DOWN', currentLanguage)}
                                        >
                                            <ArrowDown className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="px-5 py-4 border-t border-gray-200 bg-white flex justify-end gap-3 flex-shrink-0">
                    <button type="button" onClick={onClose} className="px-5 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-bold hover:bg-gray-50 rounded-sm">
                        {getTranslation('BTN_CANCEL', currentLanguage)}
                    </button>
                    <button
                        type="button"
                        onClick={handleApply}
                        disabled={order.length === 0}
                        className="px-6 py-2 bg-[var(--btn-primary-bg)] text-white text-sm font-bold shadow-sm hover:opacity-90 rounded-sm disabled:opacity-50"
                    >
                        {getTranslation('BTN_APPLY_ORDER', currentLanguage)}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

/** Change order button + modal for item editors opened from a tagged container. */
export const ItemEditorChangeOrderButton = ({
    context,
    activeItemId,
}: {
    context?: TaggedOrderChangeContext | null;
    activeItemId?: string | number;
}) => {
    const { currentLanguage } = useStore();
    const [open, setOpen] = useState(false);

    if (!context || context.taggedIds.length < 2 || activeItemId === undefined || activeItemId === null) {
        return null;
    }

    const activeId = String(activeItemId);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="px-3 py-1.5 border border-gray-300 bg-white text-gray-700 text-[10px] font-bold uppercase rounded-sm hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] transition-colors whitespace-nowrap"
            >
                {getTranslation('BTN_CHANGE_ORDER', currentLanguage)}
            </button>
            {open && (
                <TaggedItemsOrderModal
                    items={context.items}
                    orderedIds={context.taggedIds}
                    highlightItemId={activeId}
                    onApply={async (result) => {
                        await context.onApply(result);
                        setOpen(false);
                    }}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
};

export const ConfirmDeleteDialog = ({ title, message, onConfirm, onCancel }: any) => {
    const { currentLanguage } = useStore();
    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: getNestedPortalZFromStore(20) }}>
            <div className="bg-white w-[450px] min-w-[450px] max-w-[450px] shadow-2xl rounded-sm border border-gray-300 flex flex-col overflow-hidden">
                <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-red-50/50">
                        <Trash2 className="w-8 h-8" style={{ color: 'var(--icon-color)' }} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{title || getTranslation('TITLE_CONFIRM_DELETE', currentLanguage)}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed px-4">{message || getTranslation('MSG_DELETE_CONFIRM', currentLanguage)}</p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3">
                    <button type="button" onClick={onCancel} className="btn-secondary transition-colors inline-flex items-center justify-center gap-2">{getTranslation('BTN_CANCEL', currentLanguage)}</button>
                    <button type="button" onClick={onConfirm} className="btn-primary shadow-sm transition-colors inline-flex items-center justify-center gap-2 capitalize tracking-wide">{getTranslation('BTN_DELETE', currentLanguage)}</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const ConfirmTaggingRemovalDialog = ({
    title,
    onConfirm,
    onCancel,
    confirmLabel,
    isProcessing = false,
    children,
}: {
    title: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    isProcessing?: boolean;
    children: React.ReactNode;
}) => {
    const { currentLanguage } = useStore();

    return createPortal(
        <div className="ws-tagging-confirm-overlay" role="presentation" style={{ zIndex: getNestedPortalZFromStore(60) }} onClick={isProcessing ? undefined : onCancel}>
            <div
                className="ws-tagging-confirm-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ws-tagging-confirm-title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="ws-tagging-confirm-dialog__header">
                    <h3 id="ws-tagging-confirm-title" className="ws-tagging-confirm-dialog__title">{title}</h3>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="ws-tagging-confirm-dialog__close"
                        aria-label={getTranslation('BTN_CANCEL', currentLanguage)}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="ws-tagging-confirm-dialog__body">{children}</div>
                <div className="ws-tagging-confirm-dialog__footer">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="px-5 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-bold rounded-sm disabled:opacity-50"
                    >
                        {getTranslation('BTN_CANCEL', currentLanguage)}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className="px-6 py-2 bg-[var(--btn-primary-bg)] text-white text-sm font-bold rounded-sm disabled:opacity-60"
                    >
                        {confirmLabel || getTranslation('BTN_CONFIRM', currentLanguage) || 'Continue'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const SuccessDialog = ({ title, message, onClose }: any) => {
    const { currentLanguage } = useStore();
    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: getNestedPortalZFromStore(30) }}>
            <div className="bg-white w-[450px] min-w-[450px] max-w-[450px] shadow-2xl rounded-sm border border-gray-300 flex flex-col overflow-hidden">
                <div className="p-8 text-center">
                    <div className="w-18 h-18 rounded-full flex items-center justify-center mx-auto mb-6 ">
                        <CheckCircle2 className="w-10 h-10 text-green-500" style={{ stroke: "var(--icon-color)" }} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{title || getTranslation('TITLE_SUCCESS', currentLanguage)}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed px-4">{message || getTranslation('MSG_SUCCESS', currentLanguage)}</p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-center gap-3">
                    <button type="button" onClick={onClose} className="btn-primary shadow-sm transition-colors inline-flex items-center justify-center gap-2 capitalize tracking-wide">{getTranslation('BTN_OK', currentLanguage) || 'OK'}</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const TabButton = ({ active, label, onClick, icon: Icon }: any) => (
    <button
        type="button"
        onClick={onClick}
        className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${active ? 'border-[var(--primary-color)] text-[var(--primary-color)] bg-[var(--brand-light)]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
    >
        {Icon && <Icon className="w-4 h-4" />}
        {label}
    </button>
);

export const HelpGuideModal = ({ onClose }: { onClose: () => void }) => {
    const { currentLanguage } = useStore();
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]" style={{ zIndex: getNestedPortalZFromStore(40) }}>
            <div className="bg-white w-[700px] min-w-[700px] max-w-[700px] shadow-2xl rounded-sm border border-gray-300 flex flex-col h-[90vh] min-h-[90vh] max-h-[90vh] animate-in zoom-in-95 duration-200 relative">
                <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 flex-shrink-0">
                    <h3 className="text-lg font-bold text-[var(--primary-color)]">{getTranslation('TITLE_HELP_GUIDE', currentLanguage) || 'Help Guide'}</h3>
                    <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-8 overflow-y-auto space-y-6 text-sm text-gray-700 flex-1">

                    {/* Introduction */}
                    <section>
                        <h4 className="font-bold text-base mb-2 text-gray-900">{getTranslation('TITLE_INTRODUCTION', currentLanguage) || 'Introduction'}</h4>
                        <p>{getTranslation('HELP_NAV_INTRO', currentLanguage)}</p>
                    </section>

                    <hr className="border-gray-200" />

                    {/* Viewing Modes */}
                    <section>
                        <h4 className="font-bold text-base mb-2 text-gray-900">{getTranslation('HELP_NAV_VIEWING_MODES_TITLE', currentLanguage)}</h4>
                        <p className="mb-3">{getTranslation('HELP_NAV_VIEWING_MODES_DESC', currentLanguage)}</p>
                        <ul className="list-disc list-inside space-y-2 pl-1">
                            <li><strong>{getTranslation('BTN_VISUAL_VIEW', currentLanguage)}:</strong> {getTranslation('HELP_NAV_VISUAL_VIEW_DESC', currentLanguage)}</li>
                            <li><strong>{getTranslation('BTN_LIST_VIEW', currentLanguage)}:</strong> {getTranslation('HELP_NAV_LIST_VIEW_DESC', currentLanguage)}</li>
                        </ul>
                    </section>

                    <hr className="border-gray-200" />

                    {/* Adding & Editing Items */}
                    <section>
                        <h4 className="font-bold text-base mb-2 text-gray-900">{getTranslation('HELP_NAV_ADDING_EDITING_TITLE', currentLanguage)}</h4>
                        <p className="mb-3">{getTranslation('HELP_NAV_ADDING_EDITING_DESC1', currentLanguage)}</p>
                        <p className="mb-3">{getTranslation('HELP_NAV_ADDING_EDITING_DESC2', currentLanguage)}</p>
                        <p className="mb-2">{getTranslation('HELP_NAV_EDIT_PANEL_INTRO', currentLanguage)}</p>
                        <ul className="list-disc list-inside space-y-2 pl-1">
                            <li><strong>{getTranslation('LABEL_PARENT', currentLanguage)}:</strong> {getTranslation('HELP_NAV_PARENT_DESC', currentLanguage)}</li>
                            <li><strong>{getTranslation('LABEL_VISIBILITY', currentLanguage)}:</strong> {getTranslation('HELP_NAV_VISIBILITY_DESC', currentLanguage)}</li>
                            <li><strong>{getTranslation('LABEL_TITLE', currentLanguage)}:</strong> {getTranslation('HELP_NAV_TITLE_FIELD_DESC', currentLanguage)}</li>
                            <li><strong>{getTranslation('TAB_URL', currentLanguage)}:</strong> {getTranslation('HELP_NAV_URL_DESC', currentLanguage)}</li>
                        </ul>
                    </section>

                    <hr className="border-gray-200" />

                    {/* Reordering Items */}
                    <section>
                        <h4 className="font-bold text-base mb-2 text-gray-900">{getTranslation('HELP_NAV_REORDER_TITLE', currentLanguage)}</h4>
                        <p>{getTranslation('HELP_NAV_REORDER_DESC', currentLanguage)}</p>
                    </section>

                    <hr className="border-gray-200" />

                    {/* Deleting Items */}
                    <section>
                        <h4 className="font-bold text-base mb-2 text-gray-900">{getTranslation('HELP_NAV_DELETE_TITLE', currentLanguage)}</h4>
                        <p className="mb-3">{getTranslation('HELP_NAV_DELETE_DESC', currentLanguage)}</p>
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-sm px-4 py-3 text-amber-800 text-xs">
                            <span className="mt-0.5 text-2xl text-amber-500">⚠</span>
                            <p><strong>{getTranslation('LABEL_WARNING', currentLanguage) || 'Warning'}:</strong> {getTranslation('HELP_NAV_DELETE_WARNING', currentLanguage)}</p>
                        </div>
                    </section>

                </div>
                <div className="p-4 border-t border-gray-200 flex justify-end flex-shrink-0 bg-white">
                    <button onClick={onClose} className="btn-secondary">{getTranslation('BTN_CLOSE', currentLanguage)}</button>
                </div>
            </div>
        </div>
    );
};

export const HelpGuideDocModal = ({ onClose }: { onClose: () => void }) => {
    const { currentLanguage } = useStore();
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]" style={{ zIndex: getNestedPortalZFromStore(50) }}>
            <div className="bg-white w-[700px] min-w-[700px] max-w-[700px] shadow-2xl rounded-sm border border-gray-300 flex flex-col h-[90vh] min-h-[90vh] max-h-[90vh] animate-in zoom-in-95 duration-200 relative">
                <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 flex-shrink-0">
                    <h3 className="text-lg font-bold text-[var(--primary-color)]">{getTranslation('TITLE_HELP_GUIDE', currentLanguage) || 'Help Guide'}</h3>
                    <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-8 overflow-y-auto space-y-6 text-sm text-gray-700 flex-1">

                    {/* Welcome */}
                    <section>
                        <h4 className="font-bold text-base mb-2 text-gray-900">{getTranslation('HELP_DOC_WELCOME_TITLE', currentLanguage)}</h4>
                        <p>{getTranslation('HELP_DOC_WELCOME_DESC', currentLanguage)}</p>
                    </section>

                    <hr className="border-gray-200" />

                    {/* Searching */}
                    <section>
                        <h4 className="font-bold text-base mb-2 text-gray-900">{getTranslation('HELP_DOC_SEARCH_TITLE', currentLanguage)}</h4>
                        <p>{getTranslation('HELP_DOC_SEARCH_DESC', currentLanguage)}</p>
                    </section>

                    <hr className="border-gray-200" />

                    {/* Filtering */}
                    <section>
                        <h4 className="font-bold text-base mb-2 text-gray-900">{getTranslation('HELP_DOC_FILTER_TITLE', currentLanguage)}</h4>
                        <p>{getTranslation('HELP_DOC_FILTER_DESC', currentLanguage)}</p>
                    </section>

                    <hr className="border-gray-200" />

                    {/* Sorting */}
                    <section>
                        <h4 className="font-bold text-base mb-2 text-gray-900">{getTranslation('HELP_DOC_SORT_TITLE', currentLanguage)}</h4>
                        <p>{getTranslation('HELP_DOC_SORT_DESC', currentLanguage)}</p>
                    </section>

                    <hr className="border-gray-200" />

                    {/* Switching Views */}
                    <section>
                        <h4 className="font-bold text-base mb-2 text-gray-900">{getTranslation('HELP_DOC_VIEWS_TITLE', currentLanguage)}</h4>
                        <p>{getTranslation('HELP_DOC_VIEWS_DESC', currentLanguage)}</p>
                    </section>

                    <hr className="border-gray-200" />

                    {/* Adding a New Document */}
                    <section>
                        <h4 className="font-bold text-base mb-2 text-gray-900">{getTranslation('HELP_DOC_ADD_TITLE', currentLanguage)}</h4>
                        <p className="mb-3">{getTranslation('HELP_DOC_ADD_DESC', currentLanguage)}</p>
                        <ul className="list-disc list-inside space-y-1 pl-4">
                            <li><strong>{getTranslation('HELP_DOC_UPLOAD_LABEL', currentLanguage)}:</strong> {getTranslation('HELP_DOC_ADD_UPLOAD', currentLanguage)}</li>
                            <li><strong>{getTranslation('HELP_DOC_DRAGDROP_LABEL', currentLanguage)}:</strong> {getTranslation('HELP_DOC_ADD_DRAG', currentLanguage)}</li>
                            <li><strong>{getTranslation('HELP_DOC_LINK_LABEL', currentLanguage)}:</strong> {getTranslation('HELP_DOC_ADD_LINK', currentLanguage)}</li>
                        </ul>
                        <p className="mt-3">{getTranslation('HELP_DOC_ADD_FOOTER', currentLanguage)}</p>
                    </section>

                </div>
                <div className="p-4 border-t border-gray-200 flex justify-end flex-shrink-0 bg-white">
                    <button onClick={onClose} className="btn-secondary">{getTranslation('BTN_CLOSE', currentLanguage)}</button>
                </div>
            </div>
        </div>
    );
};
