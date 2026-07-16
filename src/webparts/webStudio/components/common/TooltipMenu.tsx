import * as React from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, HelpCircle, Info, X } from 'lucide-react';
import { useStore, getTranslation, INITIAL_UI_LABELS } from '../../store';
import type { LanguageCode } from '../../types';

// ----------------------------------------------------------------
// TooltipMenu — HHHH Feedback burger-menu popup
// Renders the dropdown via createPortal so it is never clipped by
// a parent modal's overflow:hidden.
// ----------------------------------------------------------------

interface TooltipMenuProps {
    ComponentId?: string | number;
}

const MENU_ITEMS: { key: string; labelKey: string; lucideIcon: React.FC<any>; taskType: string }[] = [
    { key: 'feedback', labelKey: 'TT_HHHH_Feedback_SP', lucideIcon: MessageCircle, taskType: '' },
    { key: 'bug', labelKey: 'TT_HHHH_Bug', lucideIcon: MessageCircle, taskType: 'Bug' },
    { key: 'design', labelKey: 'TT_HHHH_Design', lucideIcon: MessageCircle, taskType: 'Design' },
    { key: 'ux', labelKey: 'TT_HHHH_UX_New', lucideIcon: MessageCircle, taskType: 'UX' },
    { key: 'quick', labelKey: 'TT_HHHH_Quick', lucideIcon: MessageCircle, taskType: 'Quick' },
    { key: 'component', labelKey: 'TT_HHHH_Component_Page', lucideIcon: MessageCircle, taskType: 'ComponentPage' },
    { key: 'callnotes', labelKey: 'TT_Call_Notes', lucideIcon: MessageCircle, taskType: 'CallNotes' },
    { key: 'adminhelp', labelKey: 'TT_Admin_Help', lucideIcon: HelpCircle, taskType: 'AdminHelp' },
];

const BROWSERS = [
    { label: 'Edge', value: 'microsoft-edge:' },
    { label: 'Firefox', value: 'firefox:' },
];

const BASE_TASK_URL = 'https://hhhhteams.sharepoint.com/sites/HHHH/SP/SitePages/CreateTask.aspx';
const QUICK_TASK_URL = 'https://hhhhteams.sharepoint.com/sites/HHHH/SP/SitePages/CreateQuickTask.aspx';
const PORTFOLIO_URL = 'https://hhhhteams.sharepoint.com/sites/HHHH/SP/SitePages/Portfolio-Profile.aspx';

// Read persisted browser from localStorage
const getStoredBrowser = (): string => {
    try {
        const tenantName = window?.location?.hostname?.split('.')[0];
        const raw = localStorage.getItem(`${tenantName}BrowserSetting`) ||
            localStorage.getItem('SPTopNavBrowser');
        if (raw) {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed[0] || '' : parsed || '';
        }
    } catch { /* ignore */ }
    return '';
};

const saveBrowser = (value: string) => {
    try {
        const tenantName = window?.location?.hostname?.split('.')[0];
        localStorage.setItem(`${tenantName}BrowserSetting`, JSON.stringify([value]));
    } catch { /* ignore */ }
};

// ---- Oberflaechenlabel bearbeiten Popup ----
interface TranslationPopupProps {
    tooltipKey: string;
    currentLanguage: LanguageCode;
    onClose: () => void;
}
const TranslationPopup: React.FC<TranslationPopupProps> = ({ tooltipKey, currentLanguage, onClose }) => {
    const uiLabels = useStore(s => s.uiLabels);
    const updateUiLabel = useStore(s => s.updateUiLabel);
    const [translation, setTranslation] = React.useState('');
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        const item = uiLabels[tooltipKey] || INITIAL_UI_LABELS[tooltipKey];
        setTranslation(item?.[currentLanguage] ?? '');
    }, [tooltipKey, currentLanguage, uiLabels]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateUiLabel(tooltipKey, translation, currentLanguage);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20"
            onClick={onClose}
        >
            <div
                className="bg-white w-[540px] shadow-2xl rounded border border-gray-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-[var(--primary-color,#1a3a6e)]">
                        {getTranslation('TITLE_EDIT_TRANSLATION', currentLanguage) || 'Edit Translation'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-6 space-y-5">
                    {/* System Key — read-only */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                            System Key
                        </label>
                        <input
                            type="text"
                            readOnly
                            value={tooltipKey}
                            className="w-full px-3 py-2 border border-gray-200 rounded-sm text-sm text-gray-600 bg-gray-50 cursor-default focus:outline-none"
                        />
                    </div>

                    {/* Translation field */}
                    <div>
                        <label className="block text-[10px] font-bold text-[var(--primary-color,#1a3a6e)] uppercase tracking-widest mb-1.5">
                            {(getTranslation('LABEL_TRANSLATION', currentLanguage) || 'Translation').toUpperCase()} ({currentLanguage.toUpperCase()})
                        </label>
                        <textarea
                            rows={4}
                            value={translation}
                            onChange={e => setTranslation(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-sm text-sm text-gray-700 focus:outline-none focus:border-[var(--primary-color,#1a3a6e)] focus:ring-1 focus:ring-[var(--primary-color,#1a3a6e)] resize-none transition-all"
                            placeholder={getTranslation('PLACEHOLDER_TRANSLATION_INPUT', currentLanguage) || 'Enter translation'}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="btn-secondary transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {getTranslation('BTN_CANCEL', currentLanguage) || 'Cancel'}
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="btn-primary shadow-sm transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {getTranslation('BTN_SAVE', currentLanguage) || 'Save'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// ---- Main Component ----
const TooltipMenu: React.FC<TooltipMenuProps> = ({ ComponentId }) => {
    const currentLanguage = useStore(s => s.currentLanguage);
    useStore(s => s.uiLabels);
    const [open, setOpen] = React.useState(false);
    const [browserOpen, setBrowserOpen] = React.useState(false);
    const [currentBrowser, setCurrentBrowser] = React.useState<string>(getStoredBrowser);
    const [translationPopup, setTranslationPopup] = React.useState<{ key: string } | null>(null);
    // Position of the dropdown (computed from trigger's bounding rect)
    const [dropdownPos, setDropdownPos] = React.useState<{ top: number; right: number } | null>(null);

    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Compute position when opening
    const openDropdown = React.useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + window.scrollY,        // just below the button
                right: window.innerWidth - rect.right,    // right-aligned with the button
            });
        }
        setOpen(true);
    }, []);

    // Close when clicking outside both the trigger and the portal dropdown
    React.useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            const inTrigger = triggerRef.current?.contains(target);
            const inDropdown = dropdownRef.current?.contains(target);
            if (!inTrigger && !inDropdown) {
                setOpen(false);
                setBrowserOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const getSiteUrl = () => {
        try { return window.location.href.split('#')[0]; }
        catch { return ''; }
    };

    const handleItemClick = (taskType: string) => {
        const siteUrl = getSiteUrl();
        const cid = ComponentId;
        if (!cid) return;

        if (taskType === 'Quick') {
            window.open(`${QUICK_TASK_URL}?ComponentID=${cid}&Siteurl=${siteUrl}`, '_blank');
        } else if (taskType === 'ComponentPage') {
            window.open(`${PORTFOLIO_URL}?taskId=${cid}`, '_blank');
        } else if (taskType === 'CallNotes' || taskType === 'AdminHelp') {
            // placeholder — extend as needed
        } else if (taskType === '') {
            window.open(`${BASE_TASK_URL}?ComponentID=${cid}&Siteurl=${siteUrl}`, '_blank');
        } else {
            window.open(`${BASE_TASK_URL}?ComponentID=${cid}&TaskType=${taskType}&Siteurl=${siteUrl}`, '_blank');
        }
        setOpen(false);
        setBrowserOpen(false);
    };

    const handleInfoClick = (e: React.MouseEvent, labelKey: string) => {
        e.stopPropagation();
        e.preventDefault();
        setTranslationPopup({ key: labelKey });
        setOpen(false);
        setBrowserOpen(false);
    };

    const handleBrowserChange = (browserValue: string, checked: boolean) => {
        if (checked) {
            setCurrentBrowser(browserValue);
            saveBrowser(browserValue);
        } else {
            setCurrentBrowser('');
            saveBrowser('');
        }
    };

    // Portal dropdown JSX
    const dropdownPortal = open && dropdownPos && createPortal(
        <div
            ref={dropdownRef}
            style={{
                position: 'fixed',
                top: dropdownPos.top,
                right: dropdownPos.right,
                zIndex: 99999,
                minWidth: 230,
            }}
            className="bg-white border border-gray-200 shadow-2xl rounded-sm py-1 animate-in fade-in zoom-in-95 duration-150"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => { setOpen(false); setBrowserOpen(false); }}
        >
            {/* Main feedback items */}
            {MENU_ITEMS.map(item => {
                const IconComp = item.lucideIcon;
                return (
                    <div
                        key={item.key}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-[var(--brand-light)] hover:text-[var(--primary-color)] transition-colors group/menurow cursor-pointer"
                        onClick={() => handleItemClick(item.taskType)}
                    >
                        <IconComp className="w-4 h-4 flex-shrink-0 text-gray-400 group-hover/menurow:text-[var(--primary-color)] transition-colors" />
                        <span className="font-medium flex-1">{getTranslation(item.labelKey, currentLanguage)}</span>
                        <button
                            type="button"
                            onClick={(e) => handleInfoClick(e, item.labelKey)}
                            className="ml-auto flex-shrink-0 text-gray-300 hover:text-[var(--primary-color)] transition-colors p-0.5 rounded"
                            title={getTranslation('TOOLTIP_EDIT_TRANSLATIONS', currentLanguage)}
                        >
                            <Info className="w-3.5 h-3.5" />
                        </button>
                    </div>
                );
            })}

            {/* Divider */}
            <div className="border-t border-gray-100 my-1" />

            {/* Browser-Einstellung row */}
            <div
                onMouseEnter={() => setBrowserOpen(true)}
                onMouseLeave={() => setBrowserOpen(false)}
            >
                <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--primary-color)] hover:bg-[var(--brand-light)] transition-colors cursor-pointer">
                    <MessageCircle className="w-4 h-4 flex-shrink-0 text-[var(--primary-color)]" />
                    <span className="flex-1">{getTranslation('TT_Browser_Setting', currentLanguage)}</span>
                    <button
                        type="button"
                        onClick={(e) => handleInfoClick(e, 'TT_Browser_Setting')}
                        className="ml-auto flex-shrink-0 text-gray-300 hover:text-[var(--primary-color)] transition-colors p-0.5 rounded"
                        title={getTranslation('TOOLTIP_EDIT_TRANSLATIONS', currentLanguage)}
                    >
                        <Info className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Inline browser checkboxes */}
                {browserOpen && (
                    <div className="bg-white border-t border-gray-100 px-4 py-2 space-y-2 shadow-inner animate-in fade-in slide-in-from-top-1 duration-100">
                        {BROWSERS.map(browser => (
                            <label
                                key={browser.value}
                                className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer hover:text-gray-900 py-0.5 select-none"
                            >
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-gray-300 focus:ring-0 cursor-pointer"
                                    checked={currentBrowser === browser.value}
                                    onChange={(e) => handleBrowserChange(browser.value, e.target.checked)}
                                />
                                <span className="font-medium">{browser.label}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );

    return (
        <>
            {/* Trigger button */}
            <button
                ref={triggerRef}
                type="button"
                className="flex items-center justify-center w-8 h-8 rounded-sm hover:bg-gray-100 transition-colors group"
                aria-label="HHHH Feedback-Menue"
                onMouseEnter={openDropdown}
                onMouseLeave={() => {
                    // Small delay so cursor can reach the portal dropdown without it blinking
                    setTimeout(() => {
                        if (!dropdownRef.current?.matches(':hover')) {
                            setOpen(false);
                            setBrowserOpen(false);
                        }
                    }, 80);
                }}
                onClick={() => open ? (setOpen(false), setBrowserOpen(false)) : openDropdown()}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20" height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="block text-gray-400 group-hover:text-[var(--primary-color)] transition-colors"
                >
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
            </button>

            {/* Portal dropdown — escapes any overflow:hidden parent */}
            {dropdownPortal}

            {/* Translation popup — also portalled */}
            {translationPopup && (
                <TranslationPopup
                    tooltipKey={translationPopup.key}
                    currentLanguage={currentLanguage}
                    onClose={() => setTranslationPopup(null)}
                />
            )}
        </>
    );
};

export default TooltipMenu;
