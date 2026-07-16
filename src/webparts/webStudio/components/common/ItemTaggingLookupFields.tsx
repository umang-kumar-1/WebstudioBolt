import * as React from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X, Search } from 'lucide-react';
import { useStore, getTranslation } from '../../store';
import { TaggableListName } from '../../utils/containerLookupSync';
import { ConfirmTaggingRemovalDialog } from '../modals/SharedModals';
import {
    ContainerLookupOption,
    getPageRemovalImpact,
    isPersistedSharePointItemId,
    listContainersForContentList,
    listPagesForIds,
} from '../../utils/itemTaggingLookupEditor';

const getTaggableItemFromState = (
    state: ReturnType<typeof useStore.getState>,
    listName: TaggableListName,
    itemId: string
) => {
    const normalizedId = String(itemId);
    switch (listName) {
        case 'News':
            return state.news.find((entry) => String(entry.id) === normalizedId);
        case 'Events':
            return state.events.find((entry) => String(entry.id) === normalizedId);
        case 'Documents':
            return state.documents.find((entry) => String(entry.id) === normalizedId);
        case 'SmartPages':
            return state.pages.find((entry) => String(entry.id) === normalizedId);
        case 'ContainerItems':
            return state.containerItems.find((entry) => String(entry.id) === normalizedId);
        case 'Contacts':
            return state.contacts.find((entry) => String(entry.id) === normalizedId);
        case 'ImageSlider':
            return state.sliderItems.find((entry) => String(entry.id) === normalizedId);
        default:
            return undefined;
    }
};

interface ItemTaggingLookupFieldsProps {
    itemId: string;
    listName: TaggableListName;
}

type RemovalDialogState =
    | {
        kind: 'page';
        pageId: string;
        pageTitle: string;
        affectedContainers: Array<{ id: string; title: string }>;
    }
    | {
        kind: 'container';
        containerId: string;
        containerTitle: string;
        pageTitle: string;
    };

const formatTranslation = (template: string, ...values: string[]) => {
    let result = template;
    values.forEach((value, index) => {
        result = result.replace(`{${index}}`, value);
    });
    return result;
};

export const ItemTaggingLookupFields: React.FC<ItemTaggingLookupFieldsProps> = ({
    itemId,
    listName,
}) => {
    const pages = useStore((state) => state.pages);
    const currentLanguage = useStore((state) => state.currentLanguage);
    const taggableItem = useStore((state) => getTaggableItemFromState(state, listName, itemId));
    const applyItemContainerLookupChanges = useStore((state) => state.applyItemContainerLookupChanges);
    const applyItemPageLookupRemoval = useStore((state) => state.applyItemPageLookupRemoval);

    const containerIds = taggableItem?.containerIds || [];
    const pageIds = taggableItem?.pageIds || [];
    const [containerPickerOpen, setContainerPickerOpen] = React.useState(false);
    const [containerSearch, setContainerSearch] = React.useState('');
    const [draftAddContainerIds, setDraftAddContainerIds] = React.useState<string[]>([]);
    const [isSaving, setIsSaving] = React.useState(false);
    const [removalDialog, setRemovalDialog] = React.useState<RemovalDialogState | null>(null);

    const canEdit = isPersistedSharePointItemId(itemId);

    const availableContainers = React.useMemo(
        () => listContainersForContentList(pages, listName, currentLanguage),
        [pages, listName, currentLanguage]
    );

    const taggedContainerIdSet = React.useMemo(
        () => new Set(containerIds.map(String)),
        [containerIds]
    );

    const untaggedContainers = React.useMemo(
        () => availableContainers.filter((entry) => !taggedContainerIdSet.has(String(entry.id))),
        [availableContainers, taggedContainerIdSet]
    );

    const selectedContainers = React.useMemo(() => {
        const byId = new Map(availableContainers.map((entry) => [entry.id, entry]));
        return containerIds
            .map((id) => byId.get(String(id)) || { id: String(id), title: `Container ${id}`, pageId: '', pageTitle: '' })
            .filter(Boolean);
    }, [availableContainers, containerIds]);

    const selectedPages = React.useMemo(
        () => listPagesForIds(pages, pageIds, currentLanguage),
        [pages, pageIds, currentLanguage]
    );

    const filteredPickerContainers = React.useMemo(() => {
        const query = containerSearch.trim().toLowerCase();
        if (!query) return untaggedContainers;
        return untaggedContainers.filter((entry) =>
            entry.title.toLowerCase().includes(query)
            || entry.pageTitle.toLowerCase().includes(query)
        );
    }, [untaggedContainers, containerSearch]);

    const openContainerPicker = () => {
        if (!canEdit || isSaving) return;
        setDraftAddContainerIds([]);
        setContainerSearch('');
        setContainerPickerOpen(true);
    };

    const toggleDraftAddContainer = (containerId: string) => {
        setDraftAddContainerIds((prev) => (
            prev.includes(containerId)
                ? prev.filter((id) => id !== containerId)
                : [...prev, containerId]
        ));
    };

    const persistContainerSelection = async (nextIds: string[]) => {
        if (!canEdit) return;
        setIsSaving(true);
        try {
            await applyItemContainerLookupChanges(itemId, listName, nextIds);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveContainerPicker = async () => {
        setContainerPickerOpen(false);
        const mergedIds = Array.from(new Set([
            ...containerIds.map(String),
            ...draftAddContainerIds.map(String),
        ]));
        await persistContainerSelection(mergedIds);
    };

    const openContainerRemovalDialog = (containerId: string, containerTitle: string) => {
        const containerMeta = availableContainers.find((entry) => String(entry.id) === String(containerId));
        setRemovalDialog({
            kind: 'container',
            containerId: String(containerId),
            containerTitle: containerTitle || containerMeta?.title || `Container ${containerId}`,
            pageTitle: containerMeta?.pageTitle || '',
        });
    };

    const openPageRemovalDialog = (pageId: string, pageTitle: string) => {
        const impact = getPageRemovalImpact(itemId, pageId, pages, listName, currentLanguage);
        setRemovalDialog({
            kind: 'page',
            pageId: String(pageId),
            pageTitle: pageTitle || impact.pageTitle,
            affectedContainers: impact.blockingContainers.map((entry) => ({
                id: entry.id,
                title: entry.title,
            })),
        });
    };

    const handleConfirmRemoval = async () => {
        if (!removalDialog || !canEdit) return;
        setIsSaving(true);
        try {
            if (removalDialog.kind === 'page') {
                await applyItemPageLookupRemoval(itemId, listName, removalDialog.pageId);
            } else {
                const nextIds = containerIds.map(String).filter((id) => id !== removalDialog.containerId);
                await applyItemContainerLookupChanges(itemId, listName, nextIds);
            }
            setRemovalDialog(null);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveTagClick = (
        event: React.MouseEvent<HTMLButtonElement>,
        onRemove: (id: string, title: string) => void,
        id: string,
        title: string
    ) => {
        event.preventDefault();
        event.stopPropagation();
        if (isSaving) return;
        onRemove(id, title);
    };

    if (!canEdit) {
        return null;
    }

    const containerLabel = getTranslation('LABEL_TAGGING_CONTAINER', currentLanguage) || 'Container';
    const pageLabel = getTranslation('LABEL_TAGGING_PAGE', currentLanguage) || 'Page';
    const searchContainerPlaceholder = getTranslation('PLACEHOLDER_SEARCH_CONTAINER', currentLanguage) || 'Search Container';
    const searchPagePlaceholder = getTranslation('PLACEHOLDER_SEARCH_PAGE', currentLanguage) || 'Search Page';

    const renderTaggingField = (
        label: string,
        placeholder: string,
        tags: Array<{ id: string; title: string }>,
        options: {
            pencilEnabled: boolean;
            onPencilClick?: () => void;
            onRemoveTag?: (id: string, title: string) => void;
            removeAriaLabel: string;
            pencilAriaLabel: string;
        }
    ) => (
        <div className="ws-tagging-lookup-field">
            <label className="ws-tagging-lookup-label">{label}</label>
            <div className={`ws-tagging-lookup-control${tags.length > 0 ? ' ws-tagging-lookup-control--has-tags' : ''}`}>
                <div className="ws-tagging-lookup-search-row">
                    <input
                        readOnly
                        value=""
                        placeholder={placeholder}
                        className="ws-tagging-lookup-search-input"
                        tabIndex={-1}
                    />
                    <button
                        type="button"
                        onClick={options.pencilEnabled ? options.onPencilClick : undefined}
                        disabled={!options.pencilEnabled || isSaving}
                        className={`ws-tagging-lookup-pencil${options.pencilEnabled ? '' : ' ws-tagging-lookup-pencil--disabled'}`}
                        aria-label={options.pencilAriaLabel}
                        title={options.pencilAriaLabel}
                    >
                        <Pencil className="w-4 h-4" />
                    </button>
                </div>
                {tags.map((entry) => (
                    <div key={entry.id} className="ws-tagging-lookup-tag">
                        <span className="ws-tagging-lookup-tag-text" title={entry.title}>{entry.title}</span>
                        {options.onRemoveTag ? (
                            <button
                                type="button"
                                onClick={(event) => handleRemoveTagClick(event, options.onRemoveTag!, entry.id, entry.title)}
                                disabled={isSaving}
                                className="ws-tagging-lookup-tag-remove"
                                aria-label={options.removeAriaLabel}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );

    const renderRemovalDialogBody = () => {
        if (!removalDialog) return null;

        if (removalDialog.kind === 'page') {
            const pageRemovalWithContainers = formatTranslation(
                getTranslation('MSG_PAGE_REMOVE_WITH_CONTAINERS', currentLanguage)
                    || 'This item is currently tagged in the following containers on "{0}":',
                removalDialog.pageTitle
            );
            const pageRemovalAutoUntag = getTranslation('MSG_PAGE_REMOVE_AUTO_UNTAG', currentLanguage)
                || 'Continuing will automatically remove this item from all containers associated with this page.';
            const pageRemovalSimple = formatTranslation(
                getTranslation('MSG_PAGE_REMOVE_SIMPLE', currentLanguage) || 'Remove the page association for "{0}"?',
                removalDialog.pageTitle
            );

            if (removalDialog.affectedContainers.length > 0) {
                return (
                    <>
                        <p>{pageRemovalWithContainers}</p>
                        <ul className="ws-tagging-confirm-dialog__list">
                            {removalDialog.affectedContainers.map((entry) => (
                                <li key={entry.id}>{entry.title}</li>
                            ))}
                        </ul>
                        <p>{pageRemovalAutoUntag}</p>
                    </>
                );
            }

            return <p>{pageRemovalSimple}</p>;
        }

        const containerRemovalMessage = formatTranslation(
            getTranslation('MSG_CONTAINER_REMOVE_CONFIRM', currentLanguage)
                || 'Remove this item from container "{0}" on page "{1}"?',
            removalDialog.containerTitle,
            removalDialog.pageTitle || removalDialog.containerTitle
        );

        return <p>{containerRemovalMessage}</p>;
    };

    const removalDialogTitle = removalDialog?.kind === 'page'
        ? (getTranslation('TITLE_CONFIRM_REMOVE_PAGE_TAG', currentLanguage) || 'Remove page association?')
        : (getTranslation('TITLE_CONFIRM_REMOVE_CONTAINER_TAG', currentLanguage) || 'Remove container association?');

    return (
        <div className="ws-tagging-lookup-fields pt-4 border-t border-gray-200">
            {renderTaggingField(containerLabel, searchContainerPlaceholder, selectedContainers, {
                pencilEnabled: true,
                onPencilClick: openContainerPicker,
                onRemoveTag: openContainerRemovalDialog,
                removeAriaLabel: getTranslation('BTN_REMOVE_CONTAINER_ASSOCIATION', currentLanguage) || 'Remove container association',
                pencilAriaLabel: getTranslation('BTN_EDIT_CONTAINER_ASSOCIATIONS', currentLanguage) || 'Add container associations',
            })}

            {renderTaggingField(pageLabel, searchPagePlaceholder, selectedPages, {
                pencilEnabled: false,
                onRemoveTag: openPageRemovalDialog,
                removeAriaLabel: getTranslation('BTN_REMOVE_PAGE_ASSOCIATION', currentLanguage) || 'Remove page association',
                pencilAriaLabel: getTranslation('MSG_PAGE_ASSOCIATIONS_VIEW_ONLY', currentLanguage) || 'Page associations are view only',
            })}

            {containerPickerOpen && createPortal(
                <div className="ws-tagging-picker-overlay">
                    <div
                        className="bg-white w-[560px] max-w-[95vw] shadow-2xl rounded-sm border border-gray-300 flex flex-col max-h-[80vh]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h4 className="font-bold text-[var(--primary-color)]">
                                {getTranslation('TITLE_ADD_CONTAINER_ASSOCIATIONS', currentLanguage) || 'Add Container Associations'}
                            </h4>
                            <button type="button" onClick={() => setContainerPickerOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-gray-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    autoFocus
                                    value={containerSearch}
                                    onChange={(e) => setContainerSearch(e.target.value)}
                                    placeholder={searchContainerPlaceholder}
                                    className="w-full border border-gray-300 py-2 pl-9 pr-3 text-sm rounded-sm outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                {getTranslation('MSG_CONTAINER_PICKER_UNTAGGED_ONLY', currentLanguage)
                                    || 'Only containers this item is not tagged in are shown.'}
                            </p>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2">
                            {filteredPickerContainers.length === 0 ? (
                                <div className="text-sm text-gray-400 text-center py-8">
                                    {getTranslation('MSG_NO_UNTAGGED_CONTAINERS', currentLanguage) || 'No untagged containers available for this data source.'}
                                </div>
                            ) : (
                                filteredPickerContainers.map((entry: ContainerLookupOption) => {
                                    const checked = draftAddContainerIds.includes(entry.id);
                                    return (
                                        <label
                                            key={entry.id}
                                            className={`flex items-start gap-3 px-3 py-2.5 rounded-sm cursor-pointer hover:bg-gray-50 ${checked ? 'bg-blue-50' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleDraftAddContainer(entry.id)}
                                                className="mt-1"
                                            />
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-gray-900 truncate">{entry.title}</div>
                                                <div className="text-xs text-gray-500 truncate">{entry.pageTitle}</div>
                                            </div>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setContainerPickerOpen(false)}
                                className="px-5 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-bold rounded-sm"
                            >
                                {getTranslation('BTN_CANCEL', currentLanguage)}
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveContainerPicker}
                                disabled={isSaving || draftAddContainerIds.length === 0}
                                className="px-6 py-2 bg-[var(--btn-primary-bg)] text-white text-sm font-bold rounded-sm disabled:opacity-60"
                            >
                                {getTranslation('BTN_SAVE', currentLanguage)}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {removalDialog && (
                <ConfirmTaggingRemovalDialog
                    title={removalDialogTitle}
                    onConfirm={handleConfirmRemoval}
                    onCancel={() => setRemovalDialog(null)}
                    isProcessing={isSaving}
                >
                    {renderRemovalDialogBody()}
                </ConfirmTaggingRemovalDialog>
            )}
        </div>
    );
};
