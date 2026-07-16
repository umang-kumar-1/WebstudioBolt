import * as React from 'react';
import { createPortal } from 'react-dom';

import { Share2, Trash2, History, X, ExternalLink } from 'lucide-react';
import { getItemVersions } from '../../services/SPService';
import { useStore, getTranslation } from '../../store';
import { getNestedPortalZFromStore } from '../../utils/modalZIndex';
import { useSPContext } from '../../contexts/SPServiceContext';
import TooltipMenu from './TooltipMenu';
// import { format } from 'date-fns';

/** Columns used to diff SharePoint list versions (shared with version history modal). */
export const PROVISIONED_LIST_COLUMNS: Record<string, string[]> = {
    'Documents': ['Title', 'DocumentYear', 'DocStatus', 'ItemRank', 'DocType', 'DocumentDescriptions', 'SortOrder', 'Translations', 'ImageUrl', 'ImageName'],
    'News': ['Title', 'MultilingualTitle', 'Status', 'PublishDate', 'Description', 'Thumbnail', 'ReadMoreURL', 'ReadMoreText', 'ReadMoreEnabled', 'SEOConfig', 'Translations', 'ImageUrl', 'ImageName'],
    'Events': ['Title', 'MultilingualTitle', 'StartDate', 'EndDate', 'Location', 'Description', 'Category', 'Translations', 'Status', 'ImageUrl', 'ImageName', 'ReadMoreURL', 'ReadMoreText', 'ReadMoreEnabled', 'SEOConfig'],
    'TopNavigation': ['Title', 'ParentId', 'NavType', 'Status', 'SmartPageId', 'ExternalURL', 'ContainerId', 'SortOrder', 'IsVisible', 'OpenInNewTab', 'Translations'],
    'SmartPages': ['Title', 'MultilingualTitle', 'Slug', 'PageStatus', 'IsHomePage', 'Description', 'SEOConfig', 'VersionNote'],
    'Contacts': ['Title', 'Status', 'SortOrder', 'JobTitle', 'Company', 'Email', 'Phone', 'Description', 'Translations', 'SocialLinks', 'ImageUrl', 'ImageName'],
    'ImageSlider': ['Title', 'Subtitle', 'Description', 'Status', 'SortOrder', 'CtaText', 'CtaUrl', 'Translations', 'ImageUrl', 'ImageName', 'ImageSettings'],
    'Containers': ['Title', 'ContainerType', 'SortOrder', 'Settings', 'ContainerContent', 'IsVisible', 'Status', 'BtnEnabled', 'BtnName', 'BtnLinkType', 'BtnUrl', 'BtnContainerId', 'BtnTargetContainerTitle']
};

export const formatSpVersionDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const time = date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    // Format to "22 Feb 2026"
    const datePart = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${datePart} ${time}`;
};

export const formatVersionFieldValue = (key: string, rawVal: any): string => {
    if (rawVal === null || rawVal === undefined || rawVal === '') return '';

    if (['PublishDate', 'StartDate', 'EndDate'].includes(key)) {
        return formatSpVersionDate(rawVal);
    }

    if (typeof rawVal === 'string') {
        const trimmed = rawVal.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
                const parsed = JSON.parse(trimmed);
                return formatVersionFieldValue(key, parsed);
            } catch {
                return rawVal;
            }
        }
        return rawVal;
    }

    if (typeof rawVal === 'object') {
        const maybeUrl = rawVal.Url || rawVal.url || rawVal.href;
        const maybeDesc = rawVal.Description || rawVal.description;
        if (maybeUrl && maybeDesc) return `${String(maybeDesc)} (${String(maybeUrl)})`;
        if (maybeUrl) return String(maybeUrl);
        if (maybeDesc) return String(maybeDesc);

        if (Array.isArray(rawVal)) {
            return rawVal.map((item) => formatVersionFieldValue(key, item)).filter(Boolean).join(', ');
        }

        try {
            return JSON.stringify(rawVal);
        } catch {
            return String(rawVal);
        }
    }

    return String(rawVal);
};

export const buildSharePointItemUrl = (
    siteUrl: string,
    listTitle: string,
    itemId: string,
    versionNo?: string | number
): string => {
    const baseUrl = listTitle === 'Documents'
        ? `${siteUrl}/Shared%20Documents/Forms/EditForm.aspx?ID=${itemId}`
        : `${siteUrl}/Lists/${listTitle}/DispForm.aspx?ID=${itemId}`;
    return versionNo !== undefined && versionNo !== null && String(versionNo) !== ''
        ? `${baseUrl}&VersionNo=${encodeURIComponent(String(versionNo))}`
        : baseUrl;
};

export const buildSharePointVersionsUrl = (
    siteUrl: string,
    listTitle: string,
    itemId: string,
    listGuid: string,
    versionNo?: string | number
): string => {
    const sitePath = new URL(siteUrl).pathname;
    const wrappedGuid = listGuid.startsWith('{') ? listGuid : `{${listGuid}}`;
    const fileName = `${sitePath}/Lists/${listTitle}/${itemId}_.000`;
    const source = buildSharePointItemUrl(siteUrl, listTitle, itemId, versionNo);
    return `${siteUrl}/_layouts/15/Versions.aspx?list=${encodeURIComponent(wrappedGuid)}&FileName=${encodeURIComponent(fileName)}&Id=${encodeURIComponent(itemId)}&Source=${encodeURIComponent(source)}`;
};

export const restoreVersionAndOpenSharePoint = async (
    siteUrl: string,
    listTitle: string,
    itemId: string,
    versionLabel: string,
    pendingWindow?: Window | null,
    versionNo?: string | number
): Promise<void> => {
    const targetVersionNo = versionNo ?? versionLabel;
    const destinationUrl = buildSharePointItemUrl(siteUrl, listTitle, itemId, targetVersionNo);

    if (pendingWindow && !pendingWindow.closed) {
        pendingWindow.location.href = destinationUrl;
        return;
    }

    window.open(destinationUrl, '_blank');
};

interface SharePointMetadataFooterProps {
    listTitle: string;
    itemId: string;
    itemTitle?: string;
    itemDescription?: string;
    createdDate?: string;
    createdBy?: string;
    modifiedDate?: string;
    modifiedBy?: string;
    onDelete?: () => void;
    onVersionRestore?: () => void;
}

export const SharePointMetadataFooter: React.FC<SharePointMetadataFooterProps> = ({
    listTitle,
    itemId,
    itemTitle,
    itemDescription,
    createdDate,
    createdBy,
    modifiedDate,
    modifiedBy,
    onDelete,
    onVersionRestore
}) => {
    const { currentLanguage } = useStore();
    const { context } = useSPContext();

    const [showVersions, setShowVersions] = React.useState(false);
    const [versions, setVersions] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(false);
    const canShareByEmail = listTitle === 'News' || listTitle === 'Events';

    const handleOpenOOTB = () => {
        const siteUrl = context.pageContext.web.absoluteUrl;
        const url = buildSharePointItemUrl(siteUrl, listTitle, itemId);
        window.open(url, '_blank');
    };

    const handleShare = () => {
        //  const itemUrl = `${window.location.origin}${window.location.pathname}?ID=${itemId}&List=${listTitle}`;
        const subject = itemTitle?.trim() || `${listTitle} item`;
        const description = (itemDescription || '').replace(/<[^>]*>/g, '').trim();
        const bodyLines = [
            description ? `Description: ${description}` : ''
            // `Link: ${itemUrl}`
        ].filter(Boolean);
        const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n\n'))}`;
        window.location.href = mailtoLink;
    };



    const handleViewVersions = async () => {
        setLoading(true);
        setShowVersions(true);
        try {
            const history = await getItemVersions(listTitle, parseInt(itemId));
            setVersions(history);
        } catch (error) {
            console.error('Error fetching versions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (versionLabel: string) => {
        const pendingWindow = window.open('about:blank', '_blank');
        try {
            const siteUrl = context.pageContext.web.absoluteUrl;
            const selectedVersion = versions.find((version) => version.VersionLabel === versionLabel);
            const versionNo = selectedVersion?.VersionId ?? selectedVersion?.ID ?? selectedVersion?.Id ?? versionLabel;
            await restoreVersionAndOpenSharePoint(siteUrl, listTitle, itemId, versionLabel, pendingWindow, versionNo);
            setShowVersions(false);
            if (onVersionRestore) onVersionRestore();
        } catch (error) {
            if (pendingWindow && !pendingWindow.closed) {
                pendingWindow.location.href = buildSharePointItemUrl(context.pageContext.web.absoluteUrl, listTitle, itemId);
            }
            console.error('Error restoring version:', error);
        }
    };


    const formatDisplayDate = (date: any): string => {
        if (!date) return '—';
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return String(date).substring(0, 10);
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
            return String(date).substring(0, 10);
        }
    };

    return (
        <>
            <div className="flex flex-col justify-between w-full text-[11px] text-gray-400">
                <div className="flex flex-col gap-1 leading-tight">

                    <div>
                        <span className="font-medium">{getTranslation('LABEL_CREATED', currentLanguage)}</span> <span className="text-[var(--primary-color)] font-medium">{formatDisplayDate(createdDate)}</span>
                        <span className="ml-1 font-medium">{getTranslation('LBL_BY', currentLanguage)}</span> <span className="text-gray-500">{createdBy || getTranslation('LABEL_SYSTEM', currentLanguage)}</span>
                    </div>
                    <div>
                        <span className="font-medium">{getTranslation('LABEL_LAST_MODIFIED', currentLanguage)}</span> <span className="text-[var(--primary-color)] font-medium">{formatDisplayDate(modifiedDate)}</span>
                        <span className="ml-1 font-medium">{getTranslation('LBL_BY', currentLanguage)}</span> <span className="text-gray-500">{modifiedBy || getTranslation('LABEL_SYSTEM', currentLanguage)}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleOpenOOTB}
                        className="ws-metadata-footer-action hover:text-[var(--primary-color)] transition-colors"
                    >
                        <ExternalLink className="w-3 h-3 opacity-70" />
                        <span>{getTranslation('LABEL_OPEN_OOTB_FORM', currentLanguage) || 'Open out-of-the-box form'}</span>
                    </button>

                    {canShareByEmail && (
                        <>
                            <span className="text-gray-300">|</span>
                            <button
                                type="button"
                                onClick={handleShare}
                                className="ws-metadata-footer-action hover:text-[var(--primary-color)] transition-colors"
                            >
                                <Share2 className="w-3 h-3 opacity-70" />
                                <span>{`${getTranslation('BTN_SHARE_THIS', currentLanguage)} ${listTitle.slice(0, -1)}`}</span>
                            </button>
                        </>
                    )}

                    {onDelete && (
                        <>
                            <span className="text-gray-300">|</span>
                            <button
                                type="button"
                                onClick={onDelete}
                                className="ws-metadata-footer-action hover:text-red-500 transition-colors text-red-400"
                            >
                                <Trash2 className="w-3 h-3 opacity-70" />
                                <span>{getTranslation('BTN_DELETE_THIS_ITEM', currentLanguage)}</span>
                            </button>
                        </>
                    )}

                    <span className="text-gray-300">|</span>

                    <button
                        type="button"
                        onClick={handleViewVersions}
                        className="ws-metadata-footer-action hover:text-[var(--primary-color)] transition-colors"
                    >
                        <History className="w-3 h-3 opacity-70" />
                        <span>{getTranslation('BTN_VERSION_HISTORY', currentLanguage)}</span>
                    </button>
                </div>
            </div>

            {/* Version History Modal */}
            {/* Version History Modal */}
            {showVersions && createPortal(
                <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200" style={{ zIndex: getNestedPortalZFromStore(0) }}>
                    <div className="bg-white rounded-md shadow-2xl w-[1000px] flex flex-col h-[90vh] overflow-hidden border border-gray-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                            <h3 className="text-xl font-bold text-[var(--primary-color)] flex items-center gap-2">
                                {getTranslation('TITLE_VERSION_HISTORY', currentLanguage) || 'Version History'}
                            </h3>
                            <div className="flex items-center gap-2">
                                <TooltipMenu ComponentId={itemId} />
                                <button onClick={() => setShowVersions(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex justify-center p-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-color)]"></div>
                                </div>
                            ) : versions.length > 0 ? (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white sticky top-0 z-10">
                                        <tr className="border-b border-gray-100">
                                            <th className="py-3 px-6 font-bold text-[var(--primary-color)] w-16">No</th>
                                            <th className="py-3 px-6 font-bold text-[var(--primary-color)]">Info</th>
                                            <th className="py-3 px-6 font-bold text-[var(--primary-color)] w-48">Modified by</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {versions.map((version, index) => {
                                            // Determine which fields to show based on changes from previous version
                                            const previousVersion = versions[index + 1];
                                            const relevantFields = PROVISIONED_LIST_COLUMNS[listTitle] || [];

                                            const changedFields = relevantFields.filter(key => {
                                                const currentVal = version[key];

                                                // 1. If we have a previous version, compare values
                                                if (previousVersion) {
                                                    const prevVal = previousVersion[key];
                                                    // Simple loose comparison (covers "2" vs 2). 
                                                    // Watch out for null vs empty string if you want those to be equal.
                                                    // For now, simple diff.
                                                    if (currentVal != prevVal) return true;
                                                    return false;
                                                }

                                                // 2. If NO previous version (this is the oldest version 1.0), 
                                                // show all fields that have a value (i.e. created with these values)
                                                return currentVal !== null && currentVal !== undefined && currentVal !== '';
                                            });

                                            return (
                                                <tr key={version.VersionLabel} className="group hover:bg-gray-50/30 transition-colors align-top">
                                                    <td className="py-4 px-6 text-gray-700 font-medium">{version.VersionLabel}</td>
                                                    <td className="py-4 px-6">
                                                        <div className="space-y-2">
                                                            {changedFields.length > 0 ? (
                                                                changedFields.map(key => {
                                                                    const rawVal = version[key];
                                                                    const displayValue = formatVersionFieldValue(key, rawVal);

                                                                    return (
                                                                        <div key={key} className="grid grid-cols-[140px_1fr] gap-4">
                                                                            <div className="text-gray-900 font-medium break-words">{key}</div>
                                                                            <div className="text-gray-600 break-words">{displayValue}</div>
                                                                        </div>
                                                                    );
                                                                })
                                                            ) : (
                                                                <div className="text-gray-400 italic">{getTranslation('MSG_NO_DETAILS', currentLanguage) || 'No tracked changes'}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-[var(--primary-color)] font-medium mb-1 whitespace-nowrap">
                                                                {formatSpVersionDate(version.Created)}
                                                            </span>
                                                            <span className="text-gray-700 font-medium">{version.Editor?.LookupValue || version.Editor?.Title || 'System'}</span>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleRestore(version.VersionLabel); }}
                                                                className="mt-2 text-xs text-[var(--primary-color)] hover:text-blue-800 underline self-start opacity-0 group-hover:opacity-100 transition-opacity"
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
                            ) : (
                                <div className="text-center py-12 text-gray-500">{getTranslation('MSG_NO_VERSIONS', currentLanguage) || 'No version history found.'}</div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end bg-white">
                            <button
                                onClick={() => setShowVersions(false)}
                                className="px-6 py-2 border border-[var(--primary-color)] text-[var(--primary-color)] text-sm font-bold hover:bg-[var(--primary-color)]/10 transition-colors rounded-sm"
                            >
                                {getTranslation('BTN_CLOSE', currentLanguage)}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
