import React, { useState } from 'react';
import { useStore, getLocalizedText, getTranslation } from '../../store';
import { SiteConfig, MultilingualText } from '../../types';
import { GenericModal, OpenOOTBButton, EditTrigger } from './SharedModals';
import { translateText } from '../../services/geminiService';
import {
    Info, LayoutTemplate, Briefcase, ChevronDown, ChevronRight, Monitor,
    List as ListIcon, X, Plus, MapPin, Globe,
    Mail, Phone, Layers, Trash2, Edit2,
    Link as LinkIcon, Type,
    Layout, MousePointer2, Save, Image as ImageIcon, Upload, Search, Wand2
} from 'lucide-react';
import { Linkedin, Facebook, Twitter, Instagram } from '../common/SocialIcons';
import TooltipMenu from '../common/TooltipMenu';
import { useOptimizedImageUpload } from '../../../../hooks/useOptimizedImageUpload';
import ImageOptimizationFeedback from '../../../../components/ImageOptimizationFeedback';
import { FontWeightSelect } from '../common/FontWeightSelect';
import { getOptionalEnabledLanguages } from '../../utils/siteLanguages';

export const FooterManager = ({ onClose }: { onClose: () => void }) => {
    const { siteConfig, updateFooterConfig, updateTranslationItem, currentLanguage, saveGlobalSettings, images, uploadImage } = useStore();
    const showTranslationTab = getOptionalEnabledLanguages(siteConfig).length > 0;
    // Local State for isolation - no global side effects until save
    const [localConfig, setLocalConfig] = useState<SiteConfig['footer']>(JSON.parse(JSON.stringify(siteConfig.footer)));
    const [view, setView] = useState<'VISUAL' | 'LIST' | 'BUILDER' | 'TRANSLATION'>('VISUAL');
    const [isSettingsOpen, setIsSettingsOpen] = useState(true);
    const imageUpload = useOptimizedImageUpload(uploadImage);
    const [isTranslating, setIsTranslating] = useState(false);
    const [searchImg, setSearchImg] = useState('');
    const [imgTab, setImgTab] = useState<'UPLOAD' | 'CHOOSE'>('UPLOAD');
    const [translationLanguage] = useState<string>('de');

    const getExactLanguageText = (value: any): string => {
        if (!value) return '';
        if (typeof value === 'string') return currentLanguage === 'en' ? value : '';
        if (typeof value === 'object') {
            const exact = value[currentLanguage];
            return typeof exact === 'string' ? exact : '';
        }
        return '';
    };

    // Builder Specific State
    const [activeSection, setActiveSection] = useState<'MAIN' | 'CONTACT' | 'BOTTOM' | null>('MAIN');
    const [selectedItem, setSelectedItem] = useState<{ type: 'COLUMN' | 'LINK' | 'SOCIAL' | 'COPYRIGHT' | 'CONTACT' | 'LOGO', id: string, parentId?: string } | null>(null);

    const handleSave = async () => {
        updateFooterConfig(localConfig);
        const sourceList = 'GlobalSettings';
        const syncTasks: Promise<void>[] = [];
        const dynamicLanguages = Array.from(
            new Set([
                ...(siteConfig.languages || []).filter((lang: string) => lang !== 'en'),
                ...Object.keys(localConfig.translations || {}),
                ...(localConfig.columns || []).flatMap((col: any) => Object.keys(col.translations || {})),
                ...(localConfig.columns || []).flatMap((col: any) =>
                    (col.links || []).flatMap((link: any) => Object.keys(link.translations || {}))
                ),
                ...(localConfig.bottomLinks || []).flatMap((link: any) => Object.keys(link.translations || {})),
                ...(localConfig.brandItems || []).flatMap((item: any) => Object.keys(item.translations || {})),
                ...Object.keys(localConfig.copyright || {}).filter((lang: string) => lang !== 'en')
            ].filter(Boolean))
        );

        dynamicLanguages.forEach((lang) => {
            syncTasks.push(
                updateTranslationItem(
                    'footer_sub',
                    sourceList,
                    localConfig.subFooterText || '',
                    lang,
                    localConfig.translations?.[lang]?.subFooterText || ''
                )
            );
        });

        (localConfig.columns || []).forEach(col => {
            dynamicLanguages.forEach((lang) => {
                syncTasks.push(
                    updateTranslationItem(
                        `footer_col_${col.id}`,
                        sourceList,
                        col.title || '',
                        lang,
                        col.translations?.[lang] || ''
                    )
                );
            });
            (col.links || []).forEach(link => {
                dynamicLanguages.forEach((lang) => {
                    syncTasks.push(
                        updateTranslationItem(
                            `footer_link_${link.id}`,
                            sourceList,
                            link.label || '',
                            lang,
                            link.translations?.[lang] || ''
                        )
                    );
                });
            });
        });

        (localConfig.bottomLinks || []).forEach((link: any) => {
            dynamicLanguages.forEach((lang) => {
                syncTasks.push(
                    updateTranslationItem(
                        `footer_bottom_link_${link.id}`,
                        sourceList,
                        link.label || '',
                        lang,
                        link.translations?.[lang] || ''
                    )
                );
            });
        });

        (localConfig.brandItems || []).forEach((item: any) => {
            dynamicLanguages.forEach((lang) => {
                syncTasks.push(
                    updateTranslationItem(
                        `footer_brand_${item.id}`,
                        sourceList,
                        item.value || '',
                        lang,
                        item.translations?.[lang] || ''
                    )
                );
            });
        });

        dynamicLanguages.forEach((lang) => {
            syncTasks.push(
                updateTranslationItem(
                    'footer_copyright',
                    sourceList,
                    localConfig.copyright?.en || '',
                    lang,
                    ((localConfig.copyright as unknown as Record<string, string> | undefined)?.[lang]) || ''
                )
            );
        });

        await Promise.all(syncTasks);
        await saveGlobalSettings('site');
        onClose();
    };

    const handleCancel = () => {
        onClose();
    };

    const handleUpdate = (key: string, valueOrUpdater: any) => {
        setLocalConfig(prev => {
            const nextValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev[key as keyof SiteConfig['footer']]) : valueOrUpdater;
            return { ...prev, [key]: nextValue };
        });
    };

    const handleCopyrightUpdate = (value: string) => {
        handleUpdate('copyright', { ...localConfig.copyright, [currentLanguage]: value });
    };

    const handleFontUpdate = (key: string, value: string) => {
        handleUpdate('fontSettings', { ...localConfig.fontSettings, [key]: value });
    };

    const getFooterColumnTitle = (col: any): string => {
        if (currentLanguage === 'en') return col.title || '';
        return col.translations?.[currentLanguage] || col.title || '';
    };

    const getFooterLinkLabel = (link: any): string => {
        if (currentLanguage === 'en') return link.label || '';
        return link.translations?.[currentLanguage] || link.label || '';
    };

    const updateSubFooterUebersetzung = (value: string) => {
        handleUpdate('translations', {
            ...(localConfig.translations || {}),
            [translationLanguage]: {
                ...(localConfig.translations?.[translationLanguage] || {}),
                subFooterText: value
            }
        });
    };

    const updateColumnUebersetzung = (columnId: string, value: string) => {
        const nextColumns = localConfig.columns.map(col =>
            col.id === columnId
                ? { ...col, translations: { ...(col.translations || {}), [translationLanguage]: value } }
                : col
        );
        handleUpdate('columns', nextColumns);
    };

    const updateLinkUebersetzung = (columnId: string, linkId: string, value: string) => {
        const nextColumns = localConfig.columns.map(col => {
            if (col.id !== columnId) return col;
            return {
                ...col,
                links: col.links.map(link =>
                    link.id === linkId
                        ? { ...link, translations: { ...(link.translations || {}), [translationLanguage]: value } }
                        : link
                )
            };
        });
        handleUpdate('columns', nextColumns);
    };

    const getBrandItemValue = (item: any): string => {
        if (currentLanguage === 'en') return item.value || '';
        return item.translations?.[currentLanguage] || item.value || '';
    };

    const updateBrandItemUebersetzung = (itemId: string, value: string) => {
        const nextItems = (localConfig.brandItems || []).map(item =>
            item.id === itemId
                ? { ...item, translations: { ...(item.translations || {}), [translationLanguage]: value } }
                : item
        );
        handleUpdate('brandItems', nextItems);
    };

    const updateBottomLinkUebersetzung = (linkId: string, value: string) => {
        const nextLinks = (localConfig.bottomLinks || []).map(link =>
            link.id === linkId
                ? { ...link, translations: { ...(link.translations || {}), [translationLanguage]: value } }
                : link
        );
        handleUpdate('bottomLinks', nextLinks);
    };

    const suggestFooterUebersetzung = async () => {
        if (isTranslating) return;
        setIsTranslating(true);
        try {
            const translatedSubFooter = localConfig.subFooterText
                ? await translateText(localConfig.subFooterText, translationLanguage)
                : '';

            const translatedCopyright = localConfig.copyright?.en
                ? await translateText(localConfig.copyright.en, translationLanguage)
                : '';

            const translatedColumns = await Promise.all(
                (localConfig.columns || []).map(async (col) => {
                    const translatedTitle = col.title ? await translateText(col.title, translationLanguage) : '';
                    const translatedLinks = await Promise.all(
                        (col.links || []).map(async (link) => {
                            const translatedLabel = link.label ? await translateText(link.label, translationLanguage) : '';
                            return {
                                ...link,
                                translations: {
                                    ...(link.translations || {}),
                                    [translationLanguage]: translatedLabel || link.translations?.[translationLanguage] || ''
                                }
                            };
                        })
                    );
                    return {
                        ...col,
                        links: translatedLinks,
                        translations: {
                            ...(col.translations || {}),
                            [translationLanguage]: translatedTitle || col.translations?.[translationLanguage] || ''
                        }
                    };
                })
            );

            const translatedBrandItems = await Promise.all(
                (localConfig.brandItems || []).map(async (item) => {
                    const translatedValue = item.value ? await translateText(item.value, translationLanguage) : '';
                    return {
                        ...item,
                        translations: {
                            ...(item.translations || {}),
                            [translationLanguage]: translatedValue || item.translations?.[translationLanguage] || ''
                        }
                    };
                })
            );

            const translatedBottomLinks = await Promise.all(
                (localConfig.bottomLinks || []).map(async (link) => {
                    const translatedLabel = link.label ? await translateText(link.label, translationLanguage) : '';
                    return {
                        ...link,
                        translations: {
                            ...(link.translations || {}),
                            [translationLanguage]: translatedLabel || link.translations?.[translationLanguage] || ''
                        }
                    };
                })
            );

            setLocalConfig(prev => ({
                ...prev,
                translations: {
                    ...(prev.translations || {}),
                    [translationLanguage]: {
                        ...(prev.translations?.[translationLanguage] || {}),
                        subFooterText: translatedSubFooter || prev.translations?.[translationLanguage]?.subFooterText || ''
                    }
                },
                copyright: {
                    ...(prev.copyright || {}),
                    [(translationLanguage as keyof MultilingualText)]: translatedCopyright || (prev.copyright as any)?.[translationLanguage] || ''
                },
                columns: translatedColumns,
                brandItems: translatedBrandItems,
                bottomLinks: translatedBottomLinks
            }));
        } catch (error) {
            console.error('Footer translation suggestion failed', error);
        } finally {
            setIsTranslating(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const uploaded = await imageUpload.uploadFile(file, 'Containers');
            if (uploaded) {
                handleUpdate('logo', (uploaded as { url: string }).url);
            }
        } catch (error) {
            console.error("Logo upload failed", error);
        }
    };

    const filteredGallery = images.filter((img) => img.name.toLowerCase().includes(searchImg.toLowerCase()));

    const renderTableFooterLogoSettings = (fileInputId: string) => (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-20 h-14 bg-gray-50 border border-dashed border-gray-300 rounded flex items-center justify-center relative overflow-hidden group">
                    {localConfig.logo ? (
                        <img src={localConfig.logo} alt="" className="max-h-full max-w-full object-contain p-1" />
                    ) : (
                        <ImageIcon className="w-5 h-5 text-gray-300" />
                    )}
                    {imageUpload.isBusy && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">{getTranslation('LABEL_FOOTER_LOGO', currentLanguage)}</span>
                    <h5 className="text-xs font-bold text-gray-700">{getTranslation('LABEL_LOGO_PREVIEW', currentLanguage)}</h5>
                </div>
            </div>

            <div className="flex-1 w-full md:w-auto space-y-2">
                <div className="flex bg-gray-100 p-1 rounded gap-1">
                    {['UPLOAD', 'CHOOSE'].map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setImgTab(t as 'UPLOAD' | 'CHOOSE')}
                            className={`flex-1 py-1 px-3 text-[10px] font-bold uppercase flex items-center justify-center gap-2 rounded transition-all ${imgTab === t ? 'bg-white text-[var(--primary-color)] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {t === 'UPLOAD' ? <Upload className="w-3 h-3" /> : <Search className="w-3 h-3" />}
                            {t === 'UPLOAD' ? getTranslation('TAB_UPLOAD_UPPER', currentLanguage) : getTranslation('LABEL_GALLERY', currentLanguage)}
                        </button>
                    ))}
                </div>

                {imgTab === 'UPLOAD' && (
                    <div className="space-y-1">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => (document.getElementById(fileInputId) as HTMLInputElement)?.click()}
                                disabled={imageUpload.isBusy}
                                className="flex-1 py-1.5 px-3 border border-dashed border-gray-300 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] text-[10px] font-bold uppercase rounded transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Upload className="w-3 h-3" /> {imageUpload.isBusy ? (imageUpload.isOptimizing ? 'Optimizing…' : getTranslation('MSG_UPLOADING', currentLanguage)) : getTranslation('LABEL_CLICK_TO_UPLOAD', currentLanguage)}
                            </button>
                            <input
                                id={fileInputId}
                                type="file"
                                className="hidden"
                                onChange={(e) => { handleLogoUpload(e).catch(console.error); }}
                                accept="image/*"
                                disabled={imageUpload.isBusy}
                            />
                            {localConfig.logo && (
                                <button type="button" onClick={() => handleUpdate('logo', '')} className="p-1 px-3 border border-red-100 text-red-500 hover:bg-red-50 rounded text-[10px] font-bold uppercase transition-colors">{getTranslation('BTN_REMOVE', currentLanguage)}</button>
                            )}
                        </div>
                        <ImageOptimizationFeedback stats={imageUpload.stats} isProcessing={imageUpload.isOptimizing} />
                    </div>
                )}

                {imgTab === 'CHOOSE' && (
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder={getTranslation('LBL_SEARCH', currentLanguage)}
                                    value={searchImg}
                                    onChange={(e) => setSearchImg(e.target.value)}
                                    className="w-full pl-7 pr-3 py-1.5 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-[var(--primary-color)]"
                                />
                                <Search className="absolute left-2.5 top-2 w-3 h-3 text-gray-400" />
                            </div>
                            {localConfig.logo && (
                                <button type="button" onClick={() => handleUpdate('logo', '')} className="p-1 px-3 border border-red-100 text-red-500 hover:bg-red-50 rounded text-[10px] font-bold uppercase transition-colors">{getTranslation('BTN_REMOVE', currentLanguage)}</button>
                            )}
                        </div>
                        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide max-w-full">
                            {filteredGallery.slice(0, 12).map(img => (
                                <button
                                    key={img.id}
                                    type="button"
                                    className={`w-10 h-10 flex-shrink-0 border-2 rounded overflow-hidden cursor-pointer transition-all p-0 ${localConfig.logo === img.url ? 'border-[var(--primary-color)]' : 'border-transparent hover:border-gray-300'}`}
                                    onClick={() => handleUpdate('logo', img.url)}
                                    title={img.name}
                                >
                                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    // --- BUILDER LOGIC ---

    const addColumn = () => {
        const newCol = { id: `col_${Date.now()}`, title: 'New Column', links: [] };
        handleUpdate('columns', [...localConfig.columns, newCol]);
        setSelectedItem({ type: 'COLUMN', id: newCol.id });
    };

    const deleteColumn = (id: string) => {
        if (confirm(getTranslation('MSG_DELETE_COL_CONFIRM', currentLanguage))) {
            handleUpdate('columns', localConfig.columns.filter(c => c.id !== id));
            setSelectedItem(null);
        }
    };

    const addItemToColumn = (colId: string) => {
        const newLink = { id: `lnk_${Date.now()}`, label: 'New Link', url: '#' };
        const newCols = localConfig.columns.map(c => {
            if (c.id === colId) return { ...c, links: [...c.links, newLink] };
            return c;
        });
        handleUpdate('columns', newCols);
        setSelectedItem({ type: 'LINK', id: newLink.id, parentId: colId });
    };

    const deleteItemFromColumn = (colId: string, linkId: string) => {
        const newCols = localConfig.columns.map(c => {
            if (c.id === colId) return { ...c, links: c.links.filter(l => l.id !== linkId) };
            return c;
        });
        handleUpdate('columns', newCols);
        setSelectedItem(null);
    };

    // --- RENDER HELPERS ---

    const getFooterBg = (bgValue: string) => {
        switch (bgValue) {
            case 'white': return '#ffffff';
            case 'light-grey': return '#f3f4f6';
            case 'site-color': return 'var(--primary-color)';
            default: return bgValue;
        }
    };

    const isLightBg = (bgValue: string) => {
        const bg = getFooterBg(bgValue);
        return bg === '#ffffff' || bg === '#f3f4f6';
    };

    const getFooterTextColor = (bgValue: string) => {
        return isLightBg(bgValue) ? 'var(--text-primary)' : 'var(--footer-text-color)';
    };

    const getFooterHeadingColor = (bgValue: string) => {
        return isLightBg(bgValue) ? 'var(--heading-color)' : 'var(--footer-heading-color, #ffffff)';
    };

    const getFooterLinkColor = (bgValue: string) => {
        return isLightBg(bgValue) ? 'var(--link-color)' : '#ffffff';
    };

    const isPresetColor = ['white', 'light-grey', 'site-color'].includes(localConfig.backgroundColor);

    // --- ICON HELPERS ---
    const getSocialIcon = (type: string) => {
        const iconStyle = { color: '#ffffff', width: '20px', height: '20px' };
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

    const getContactIcon = (type: string) => {
        const style = { color: 'var(--primary-color)' };
        switch (type) {
            case 'Email': return <Mail className="w-5 h-5" style={style} />;
            case 'Phone': return <Phone className="w-5 h-5" style={style} />;
            case 'Address': return <MapPin className="w-5 h-5" style={style} />;
            default: return <Info className="w-5 h-5" style={style} />;
        }
    };

    // --- RIGHT PANEL RENDERER ---
    const renderPropertiesPanel = () => {
        if (!selectedItem) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center bg-gray-50/50">
                    <MousePointer2 className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm font-medium">{getTranslation('MSG_SELECT_ELEMENT', currentLanguage)}</p>
                    <p className="text-xs mt-2 opacity-70">{getTranslation('MSG_CLICK_ELEMENT', currentLanguage)}</p>
                </div>
            );
        }

        if (selectedItem.type === 'COLUMN') {
            const col = localConfig.columns.find(c => c.id === selectedItem.id);
            if (!col) return null;
            return (
                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-blue-100 rounded-sm text-[var(--primary-color)]"><Layout className="w-4 h-4" /></div>
                        <div className='flex flex-col gap-1'>
                            <h4 className="text-sm font-bold text-gray-800">{getTranslation('TITLE_EDIT_COLUMN', currentLanguage)}</h4>
                            <p className="text-xs text-gray-500">{getTranslation('SECTION_MAIN_NAV', currentLanguage)}</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LBL_COLUMN_HEADING', currentLanguage)}</label>
                        <input
                            value={col.title}
                            onChange={(e) => {
                                const newCols = localConfig.columns.map(c => c.id === col.id ? { ...c, title: e.target.value } : c);
                                handleUpdate('columns', newCols);
                            }}
                            className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                            placeholder={getTranslation('LBL_COLUMN_HEADING', currentLanguage)}
                        />
                    </div>
                    <div className="pt-4">
                        <button onClick={() => deleteColumn(col.id)} className="text-red-500 text-xs font-bold flex items-center gap-2 hover:bg-red-50 p-2 rounded-sm w-full justify-center border border-red-200">
                            <Trash2 className="w-3 h-3" /> {getTranslation('BTN_DELETE_COLUMN', currentLanguage)}
                        </button>
                    </div>
                </div>
            );
        }

        if (selectedItem.type === 'LINK' && selectedItem.parentId) {
            const col = localConfig.columns.find(c => c.id === selectedItem.parentId);
            const link = col?.links.find(l => l.id === selectedItem.id);
            if (!col || !link) return null;
            return (
                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-green-100 rounded-sm text-green-700"><LinkIcon className="w-4 h-4" /></div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-800">{getTranslation('TITLE_EDIT_LINK', currentLanguage)}</h4>
                            <p className="text-xs text-gray-500">{getTranslation('LBL_INSIDE', currentLanguage) || 'Inside'}: {getFooterColumnTitle(col)}</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LBL_LABEL_TEXT', currentLanguage)}</label>
                        <input
                            value={link.label}
                            onChange={(e) => {
                                const newCols = localConfig.columns.map(c => c.id === col.id ? {
                                    ...c, links: c.links.map(l => l.id === link.id ? { ...l, label: e.target.value } : l)
                                } : c);
                                handleUpdate('columns', newCols);
                            }}
                            className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LBL_DESTINATION_URL', currentLanguage)}</label>
                        <div className="relative">
                            <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                value={link.url}
                                onChange={(e) => {
                                    const newCols = localConfig.columns.map(c => c.id === col.id ? {
                                        ...c, links: c.links.map(l => l.id === link.id ? { ...l, url: e.target.value } : l)
                                    } : c);
                                    handleUpdate('columns', newCols);
                                }}
                                className="w-full border border-gray-300 p-2.5 pl-9 text-sm rounded-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                                placeholder="URL"
                            />
                        </div>
                    </div>
                    <div className="pt-4">
                        <button onClick={() => deleteItemFromColumn(col.id, link.id)} className="text-red-500 text-xs font-bold flex items-center gap-2 hover:bg-red-50 p-2 rounded-sm w-full justify-center border border-red-200">
                            <Trash2 className="w-3 h-3" /> {getTranslation('BTN_REMOVE_LINK', currentLanguage)}
                        </button>
                    </div>
                </div>
            );
        }

        if (selectedItem.type === 'LOGO') {
            return (
                <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                        <div className="p-2 bg-green-100 rounded-sm text-[var(--primary-color)]"><ImageIcon className="w-4 h-4" /></div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-800">{getTranslation('LABEL_FOOTER_LOGO', currentLanguage)}</h4>
                            <p className="text-xs text-gray-500">{getTranslation('SECTION_BOTTOM_BAR', currentLanguage)}</p>
                        </div>
                    </div>
                    {renderTableFooterLogoSettings('footer-logo-file-builder-panel')}
                </div>
            );
        }

        if (selectedItem.type === 'COPYRIGHT') {
            return (
                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-purple-100 rounded-sm text-purple-700"><Type className="w-4 h-4" /></div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-800">{getTranslation('TITLE_COPYRIGHT', currentLanguage)}</h4>
                            <p className="text-xs text-gray-500">{getTranslation('SECTION_BOTTOM_BAR', currentLanguage)}</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('TITLE_COPYRIGHT', currentLanguage)} ({currentLanguage.toUpperCase()})</label>
                        <textarea
                            value={localConfig.copyright[currentLanguage] || ''}
                            onChange={(e) => handleCopyrightUpdate(e.target.value)}
                            className="w-full border border-gray-300 p-3 text-sm h-32 resize-none rounded-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                        />
                    </div>
                </div>
            );
        }

        if (selectedItem.type === 'SOCIAL') {
            return (
                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-pink-100 rounded-sm text-pink-700"><Globe className="w-4 h-4" /></div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-800">{getTranslation('TITLE_SOCIAL_NETWORKS', currentLanguage)}</h4>
                            <p className="text-xs text-gray-500">{getTranslation('SECTION_BOTTOM_BAR', currentLanguage)}</p>
                        </div>
                    </div>
                    {['linkedin', 'facebook', 'twitter', 'instagram'].map(platform => (
                        <div key={platform}>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{platform}</label>
                            <input
                                value={(localConfig.socialLinks as any)[platform]}
                                onChange={(e) => handleUpdate('socialLinks', { ...localConfig.socialLinks, [platform]: e.target.value })}
                                className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                                placeholder={`https://${platform}.com/...`}
                            />
                        </div>
                    ))}
                </div>
            );
        }

        if (selectedItem.type === 'CONTACT') {
            return (
                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-blue-100 rounded-sm text-[var(--primary-color)]"><MapPin className="w-4 h-4" /></div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-800">{getTranslation('SECTION_CONTACT_INFO', currentLanguage)}</h4>
                            <span className="text-md text-gray-500">{getTranslation('MSG_CORP_ONLY', currentLanguage) || 'Corporate Template Only'}</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_LOCATION', currentLanguage)}</label>
                        <input
                            value={localConfig.contactInfo.address}
                            onChange={(e) => handleUpdate('contactInfo', { ...localConfig.contactInfo, address: e.target.value })}
                            className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_SENDER_EMAIL', currentLanguage)}</label>
                        <input
                            value={localConfig.contactInfo.email}
                            onChange={(e) => handleUpdate('contactInfo', { ...localConfig.contactInfo, email: e.target.value })}
                            className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{getTranslation('LABEL_PHONE', currentLanguage) || 'Phone'}</label>
                        <input
                            value={localConfig.contactInfo.phone}
                            onChange={(e) => handleUpdate('contactInfo', { ...localConfig.contactInfo, phone: e.target.value })}
                            className="w-full border border-gray-300 p-2.5 text-sm rounded-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                        />
                    </div>
                </div>
            );
        }

        return null;
    };

    const footerButtons = (
        <div className="flex justify-between w-full items-center">
            <OpenOOTBButton listTitle="GlobalSettings" />
            <div className="flex gap-3">
                <button onClick={handleCancel} className="px-6 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-bold hover:bg-gray-50 rounded-sm flex items-center gap-1">{getTranslation('BTN_CANCEL', currentLanguage)}</button>
                <button onClick={handleSave} className="px-6 py-2 bg-[var(--btn-primary-bg)] text-white text-sm font-bold hover:opacity-90 rounded-sm shadow-sm flex items-center gap-2">
                    <Save className="w-4 h-4" /> {getTranslation('BTN_SAVE_CHANGES', currentLanguage)}
                </button>
            </div>
        </div>
    );

    return (
        <GenericModal
            className="footer-management-popup"
            title={getTranslation('FOOTER_MGMT', currentLanguage)}
            onClose={handleCancel}
            width="w-[80vw] min-w-[80vw] max-w-[80vw]"
            noFooter={true}
            customFooter={footerButtons}
            headerIcons={<TooltipMenu ComponentId={'13838'} />}
        >
            <div className={`flex flex-col h-full bg-white`}>

                {/* View Toggles */}
                <div className={`flex items-center justify-between ${view === 'BUILDER' ? 'px-6 py-2 border-b border-gray-200 bg-gray-50' : 'mb-2'}`}>
                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                        {/* {view === 'BUILDER' ? <Layers className="w-4 h-4 text-[var(--primary-color)]" /> : null}
                        {view === 'BUILDER' ? getTranslation('LBL_LAYOUT_BUILDER', currentLanguage) : getTranslation('LBL_FOOTER_CONFIG', currentLanguage)} */}
                    </h4>
                    <div className="flex border border-[var(--primary-color)] rounded-sm overflow-hidden shadow-sm h-8">
                        <button onClick={() => setView('VISUAL')} className={`px-3 text-xs font-bold flex items-center gap-2 transition-colors ${view === 'VISUAL' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-[var(--brand-light)]'}`}><Monitor className="w-3 h-3" /> {getTranslation('LBL_VISUAL', currentLanguage)}</button>
                        <button onClick={() => setView('LIST')} className={`px-3 text-xs font-bold flex items-center gap-2 transition-colors ${view === 'LIST' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-[var(--brand-light)]'}`}><ListIcon className="w-3 h-3" /> {getTranslation('LBL_LIST', currentLanguage)}</button>
                        <button onClick={() => setView('BUILDER')} className={`px-3 text-xs font-bold flex items-center gap-2 transition-colors ${view === 'BUILDER' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-[var(--brand-light)]'}`}><Layers className="w-3 h-3" /> {getTranslation('LBL_BUILDER', currentLanguage)}</button>
                        {showTranslationTab && (
                            <button onClick={() => setView('TRANSLATION')} className={`px-3 text-xs font-bold flex items-center gap-2 transition-colors ${view === 'TRANSLATION' ? 'bg-[var(--btn-primary-bg)] text-white' : 'bg-white text-[var(--primary-color)] hover:bg-[var(--brand-light)]'}`}><Globe className="w-3 h-3" /> {getTranslation('TAB_TRANSLATION', currentLanguage)}</button>
                        )}
                    </div>
                </div>

                {view === 'BUILDER' ? (
                    /* --- BUILDER VIEW --- */
                    <div className="flex-1 flex overflow-hidden bg-gray-100">

                        {/* LEFT: CANVAS */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8">

                            {/* SECTION 1: MAIN NAVIGATION */}
                            <div className="bg-white border border-gray-200 shadow-sm rounded-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setActiveSection(activeSection === 'MAIN' ? null : 'MAIN')}>
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-blue-100 rounded-sm text-[var(--primary-color)]"><Layout className="w-4 h-4" /></div>
                                        <div className='flex flex-col gap-1'>
                                            <h4 className="text-sm font-bold text-gray-800">{getTranslation('SECTION_MAIN_NAV', currentLanguage)}</h4>
                                            <span className="text-md text-gray-500">{getTranslation('DESC_MAIN_NAV', currentLanguage) || 'Contains columns of links.'}</span>
                                        </div>
                                    </div>
                                    {activeSection === 'MAIN' ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                                </div>

                                {activeSection === 'MAIN' && (
                                    <div className="p-6 bg-gray-50/50">
                                        {/* Columns Grid */}
                                        <div className="grid grid-cols-3 gap-4">
                                            {localConfig.columns.map((col) => (
                                                <div
                                                    key={col.id}
                                                    onClick={() => setSelectedItem({ type: 'COLUMN', id: col.id })}
                                                    className={`bg-white border rounded-sm p-4 cursor-pointer hover:shadow-md transition-all group ${selectedItem?.id === col.id ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)]' : 'border-gray-200'}`}
                                                >
                                                    <div className="flex justify-between items-start mb-3">
                                                        <h5 className="font-bold text-sm text-gray-800 truncate pr-2">{getFooterColumnTitle(col)}</h5>
                                                        <button onClick={(e) => { e.stopPropagation(); setSelectedItem({ type: 'COLUMN', id: col.id }); }} className="text-gray-400 hover:text-[var(--primary-color)]"><Edit2 className="w-3 h-3" /></button>
                                                    </div>

                                                    {/* Items in Column */}
                                                    <div className="space-y-1 mb-4 min-h-[60px]">
                                                        {col.links.map(link => (
                                                            <div
                                                                key={link.id}
                                                                onClick={(e) => { e.stopPropagation(); setSelectedItem({ type: 'LINK', id: link.id, parentId: col.id }); }}
                                                                className={`text-xs px-2 py-1.5 rounded-sm flex items-center gap-2 hover:bg-gray-50 ${selectedItem?.id === link.id ? 'bg-[var(--brand-light)] text-[var(--primary-color)] font-bold' : 'text-gray-600'}`}
                                                            >
                                                                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                                                                <span className="truncate flex-1">{getFooterLinkLabel(link)}</span>
                                                            </div>
                                                        ))}
                                                        {col.links.length === 0 && <div className="text-[10px] text-gray-400 italic px-2">{getTranslation('MSG_NO_LINKS', currentLanguage)}</div>}
                                                    </div>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); addItemToColumn(col.id); }}
                                                        className="w-full py-1.5 border border-dashed border-gray-300 text-xs font-bold text-gray-500 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] rounded-sm flex items-center justify-center gap-1 transition-colors"
                                                    >
                                                        <Plus className="w-3 h-3" /> {getTranslation('BTN_ADD_ITEM', currentLanguage)}
                                                    </button>
                                                </div>
                                            ))}

                                            {/* Add Column Card */}
                                            <div
                                                onClick={addColumn}
                                                className="border-2 border-dashed border-gray-300 rounded-sm p-4 flex flex-col items-center justify-center text-gray-400 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] cursor-pointer transition-all min-h-[200px]"
                                            >
                                                <Plus className="w-8 h-8 mb-2" />
                                                <span className="text-sm font-bold">{getTranslation('BTN_ADD_COLUMN', currentLanguage)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SECTION 2: CONTACT (Conditional) */}
                            <div className="bg-white border border-gray-200 shadow-sm rounded-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setActiveSection(activeSection === 'CONTACT' ? null : 'CONTACT')}>
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-blue-100 rounded-sm text-[var(--primary-color)]"><MapPin className="w-4 h-4" /></div>
                                        <div className='flex flex-col gap-1'>
                                            <h4 className="text-sm font-bold text-gray-800">{getTranslation('SECTION_CONTACT_INFO', currentLanguage)}</h4>
                                            <span className="text-md text-gray-500">{getTranslation('MSG_CORP_ONLY', currentLanguage)}</span>
                                        </div>
                                    </div>
                                    {activeSection === 'CONTACT' ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                                </div>

                                {activeSection === 'CONTACT' && (
                                    <div className="p-6 grid grid-cols-3 gap-4">
                                        <div
                                            onClick={() => setSelectedItem({ type: 'CONTACT', id: 'contact' })}
                                            className={`p-4 border rounded-sm cursor-pointer hover:shadow-sm transition-all ${selectedItem?.type === 'CONTACT' ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)] bg-[var(--brand-light)]' : 'border-gray-200 bg-white'}`}
                                        >
                                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_LOCATION', currentLanguage)}</div>
                                            <div className="text-sm font-medium text-gray-800 truncate">{localConfig.contactInfo.address || getTranslation('MSG_NOT_SET', currentLanguage) || 'Not set'}</div>
                                        </div>
                                        <div
                                            onClick={() => setSelectedItem({ type: 'CONTACT', id: 'contact' })}
                                            className={`p-4 border rounded-sm cursor-pointer hover:shadow-sm transition-all ${selectedItem?.type === 'CONTACT' ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)] bg-[var(--brand-light)]' : 'border-gray-200 bg-white'}`}
                                        >
                                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_SENDER_EMAIL', currentLanguage)}</div>
                                            <div className="text-sm font-medium text-gray-800 truncate">{localConfig.contactInfo.email || getTranslation('MSG_NOT_SET', currentLanguage) || 'Not set'}</div>
                                        </div>
                                        <div
                                            onClick={() => setSelectedItem({ type: 'CONTACT', id: 'contact' })}
                                            className={`p-4 border rounded-sm cursor-pointer hover:shadow-sm transition-all ${selectedItem?.type === 'CONTACT' ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)] bg-[var(--brand-light)]' : 'border-gray-200 bg-white'}`}
                                        >
                                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LABEL_PHONE', currentLanguage)}</div>
                                            <div className="text-sm font-medium text-gray-800 truncate">{localConfig.contactInfo.phone || getTranslation('MSG_NOT_SET', currentLanguage) || 'Not set'}</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SECTION 3: BOTTOM BAR */}
                            <div className="bg-white border border-gray-200 shadow-sm rounded-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setActiveSection(activeSection === 'BOTTOM' ? null : 'BOTTOM')}>
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-purple-100 rounded-sm text-purple-700"><Type className="w-4 h-4" /></div>
                                        <div className='flex flex-col gap-1'>
                                            <h4 className="text-sm font-bold text-gray-800">{getTranslation('SECTION_BOTTOM_BAR', currentLanguage)}</h4>
                                            <span className="text-md text-gray-500">{getTranslation('TITLE_COPYRIGHT', currentLanguage)} & {getTranslation('TITLE_SOCIAL_NETWORKS', currentLanguage)}</span>
                                        </div>
                                    </div>
                                    {activeSection === 'BOTTOM' ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                                </div>

                                {activeSection === 'BOTTOM' && (
                                    localConfig.template === 'Table' ? (
                                        <div className="p-6 space-y-4">
                                            <div
                                                onClick={() => setSelectedItem({ type: 'LOGO', id: 'logo' })}
                                                className={`p-4 border rounded-sm cursor-pointer hover:shadow-sm transition-all group ${selectedItem?.type === 'LOGO' ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)]' : 'border-gray-200 hover:border-gray-300'}`}
                                            >
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className="text-xs font-bold text-gray-500 uppercase">{getTranslation('LABEL_FOOTER_LOGO', currentLanguage)}</span>
                                                    <Edit2 className="w-3 h-3 text-gray-300 group-hover:text-gray-500" />
                                                </div>
                                                <div className="flex justify-end">
                                                    {localConfig.logo ? (
                                                        <img src={localConfig.logo} alt="" className="object-contain object-right w-auto max-w-[180px] h-auto max-h-16" />
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">{getTranslation('LABEL_CLICK_TO_UPLOAD', currentLanguage)}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div
                                                onClick={() => setSelectedItem({ type: 'COPYRIGHT', id: 'copy' })}
                                                className={`p-4 border rounded-sm cursor-pointer hover:shadow-sm transition-all group ${selectedItem?.type === 'COPYRIGHT' ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)]' : 'border-gray-200 hover:border-gray-300'}`}
                                            >
                                                <div className="flex justify-between mb-2">
                                                    <span className="text-xs font-bold text-gray-500 uppercase">{getTranslation('TITLE_COPYRIGHT', currentLanguage)}</span>
                                                    <Edit2 className="w-3 h-3 text-gray-300 group-hover:text-gray-500" />
                                                </div>
                                                <div className="text-sm text-gray-800 line-clamp-2">{getLocalizedText(localConfig.copyright, currentLanguage)}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-6 grid grid-cols-2 gap-6">
                                            <div
                                                onClick={() => setSelectedItem({ type: 'COPYRIGHT', id: 'copy' })}
                                                className={`p-4 border rounded-sm cursor-pointer hover:shadow-sm transition-all group ${selectedItem?.type === 'COPYRIGHT' ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)]' : 'border-gray-200 hover:border-gray-300'}`}
                                            >
                                                <div className="flex justify-between mb-2">
                                                    <span className="text-xs font-bold text-gray-500 uppercase">{getTranslation('TITLE_COPYRIGHT', currentLanguage)}</span>
                                                    <Edit2 className="w-3 h-3 text-gray-300 group-hover:text-gray-500" />
                                                </div>
                                                <div className="text-sm text-gray-800 line-clamp-2">{getLocalizedText(localConfig.copyright, currentLanguage)}</div>
                                            </div>
                                            <div
                                                onClick={() => setSelectedItem({ type: 'SOCIAL', id: 'social' })}
                                                className={`p-4 border rounded-sm cursor-pointer hover:shadow-sm transition-all group ${selectedItem?.type === 'SOCIAL' ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)]' : 'border-gray-200 hover:border-gray-300'}`}
                                            >
                                                <div className="flex justify-between mb-2">
                                                    <span className="text-xs font-bold text-gray-500 uppercase">{getTranslation('TITLE_SOCIAL_NETWORKS', currentLanguage)}</span>
                                                    <Edit2 className="w-3 h-3 text-gray-300 group-hover:text-gray-500" />
                                                </div>
                                                <div className="flex gap-3">
                                                    <Linkedin className={`w-5 h-5 ${localConfig.socialLinks.linkedin ? 'text-blue-700' : 'text-gray-300'}`} />
                                                    <Facebook className={`w-5 h-5 ${localConfig.socialLinks.facebook ? 'text-blue-600' : 'text-gray-300'}`} />
                                                    <Twitter className={`w-5 h-5 ${localConfig.socialLinks.twitter ? 'text-sky-500' : 'text-gray-300'}`} />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>

                            {/* LIVE PREVIEW AREA */}
                            <div className="pt-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <Monitor className="w-4 h-4 text-gray-500" />
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{getTranslation('TITLE_LIVE_FOOTER_PREVIEW', currentLanguage)}</h4>
                                </div>
                                <div className="border border-gray-300 shadow-sm bg-white overflow-hidden">
                                    <div
                                        style={{
                                            backgroundColor: getFooterBg(localConfig.backgroundColor),
                                            color: getFooterTextColor(localConfig.backgroundColor),
                                            padding: '2rem',
                                            textAlign: localConfig.template === 'Table' ? localConfig.alignment : 'left',
                                            ...({
                                                '--heading-color': getFooterHeadingColor(localConfig.backgroundColor),
                                                '--heading-h1-color': getFooterHeadingColor(localConfig.backgroundColor),
                                                '--heading-h2-color': getFooterHeadingColor(localConfig.backgroundColor),
                                                '--heading-h3-color': getFooterHeadingColor(localConfig.backgroundColor),
                                                '--heading-h4-color': getFooterHeadingColor(localConfig.backgroundColor),
                                                '--heading-h5-color': getFooterHeadingColor(localConfig.backgroundColor),
                                                '--heading-h6-color': getFooterHeadingColor(localConfig.backgroundColor),
                                                '--font-size-h5': localConfig.fontSettings.headingSize,
                                                '--font-size-h4': localConfig.fontSettings.headingSize,
                                                '--custom-link-color': getFooterLinkColor(localConfig.backgroundColor),
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
                                        `}</style>
                                        <div className="opacity-50 text-[10px] uppercase font-bold mb-4 tracking-widest border-b border-current pb-1 w-20">{getTranslation('LABEL_FOOTER_AREA', currentLanguage) || 'Footer Area'}</div>
                                        {localConfig.template === 'Table' ? (
                                            <div className="flex flex-col w-full">
                                                <div className="flex flex-col md:flex-row gap-8 w-full text-xs">
                                                    {localConfig.columns.map(col => (
                                                        <div key={col.id} className="flex-1 flex flex-col w-full">
                                                            <div
                                                                className="font-bold pb-2 w-full"
                                                                style={{
                                                                    color: getFooterHeadingColor(localConfig.backgroundColor),
                                                                    fontSize: localConfig.fontSettings.headingSize
                                                                }}
                                                            >
                                                                {getFooterColumnTitle(col)}
                                                            </div>
                                                            <div className="flex flex-col w-full">
                                                                {col.links.map(l => (
                                                                    <div key={l.id} className="py-2 border-b border-current border-opacity-30 w-full footer-table-link cursor-pointer">
                                                                        {getFooterLinkLabel(l)}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-8 pt-4 border-t border-current border-opacity-30 flex justify-between items-end w-full gap-4">
                                                    <div className="opacity-80 text-[10px] pb-0.5" style={{ color: getFooterTextColor(localConfig.backgroundColor) }}>
                                                        {getLocalizedText(localConfig.copyright, currentLanguage)}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedItem({ type: 'LOGO', id: 'logo' })}
                                                        className="flex items-center justify-end min-h-[4rem] min-w-[8rem] border border-dashed border-current border-opacity-20 rounded px-2 py-1 hover:border-opacity-50 transition-colors"
                                                    >
                                                        {localConfig.logo ? (
                                                            <img src={localConfig.logo} alt="" className="object-contain object-right w-auto max-w-[180px] h-auto max-h-16" />
                                                        ) : (
                                                            <span className="text-[9px] opacity-60 uppercase">{getTranslation('LABEL_FOOTER_LOGO', currentLanguage)}</span>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-4 gap-8 opacity-80 text-xs">
                                                {localConfig.columns.map(col => (
                                                    <div key={col.id}>
                                                        <div className="font-bold mb-2 uppercase">{getFooterColumnTitle(col)}</div>
                                                        <div className="space-y-1">
                                                            {col.links.map(l => <div key={l.id}>{getFooterLinkLabel(l)}</div>)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* RIGHT: PROPERTIES PANEL */}
                        <div className="w-[320px] bg-white border-l border-gray-200 overflow-y-auto shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
                            {renderPropertiesPanel()}
                        </div>
                    </div>
                ) : (
                    /* --- EXISTING VIEWS (Visual / List / Uebersetzung) --- */
                    <div className="flex-1 overflow-y-auto">
                        {view === 'TRANSLATION' ? (
                            <div className="p-6 space-y-6">
                                <div className="bg-white border border-gray-200 p-5 rounded-sm">
                                    <h4 className="text-sm font-bold text-gray-800 mb-2">{getTranslation('TITLE_FOOTER_TRANSLATIONS', currentLanguage)}</h4>
                                    <span className="text-md text-gray-500">{getTranslation('DESC_FOOTER_TRANSLATIONS', currentLanguage)}</span>
                                </div>

                                <>
                                    <div className="bg-white border border-gray-200 p-4 rounded-sm flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <div className="text-xs text-gray-600">
                                                {getTranslation('LABEL_TRANSLATION', currentLanguage)}
                                            </div>
                                            <span className="border border-gray-300 text-xs px-2 py-1 rounded-sm bg-gray-50 font-medium">
                                                DE
                                            </span>
                                        </div>
                                        <button
                                            onClick={suggestFooterUebersetzung}
                                            disabled={isTranslating}
                                            className={`ml-auto text-[var(--primary-color)] text-xs font-bold flex items-center gap-2 hover:underline ${isTranslating ? 'opacity-50 cursor-wait' : ''}`}
                                        >
                                            <Wand2 className={`w-3 h-3 ${isTranslating ? 'animate-pulse' : ''}`} />
                                            {isTranslating ? getTranslation('MSG_TRANSLATING', currentLanguage) : getTranslation('BTN_SUGGEST_AI', currentLanguage)}
                                        </button>
                                    </div>

                                    <div className="bg-white border border-gray-200 p-5 rounded-sm space-y-4">
                                        <h5 className="text-xs font-bold uppercase text-gray-600">{getTranslation('LBL_SUB_FOOTER_TEXT', currentLanguage)}</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-500 mb-1">{getTranslation('LABEL_ORIGINAL_EN', currentLanguage)}</label>
                                                <input className="w-full border border-gray-300 p-2 text-sm bg-gray-50" value={localConfig.subFooterText || ''} readOnly />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-500 mb-1">{translationLanguage.toUpperCase()}</label>
                                                <input
                                                    className="w-full border border-gray-300 p-2 text-sm outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                                                    value={localConfig.translations?.[translationLanguage]?.subFooterText || ''}
                                                    onChange={(e) => updateSubFooterUebersetzung(e.target.value)}
                                                    placeholder={getTranslation('LBL_SUB_FOOTER_TEXT', currentLanguage)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-gray-200 p-5 rounded-sm space-y-4">
                                        <h5 className="text-xs font-bold uppercase text-gray-600">{getTranslation('SECTION_MAIN_NAV', currentLanguage)}</h5>
                                        {localConfig.columns.map((col) => (
                                            <div key={col.id} className="border border-gray-200 rounded-sm p-4 space-y-3">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-gray-500 mb-1">{getTranslation('LABEL_ORIGINAL_EN', currentLanguage)}</label>
                                                        <input className="w-full border border-gray-300 p-2 text-sm bg-gray-50" value={col.title || ''} readOnly />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-gray-500 mb-1">{translationLanguage.toUpperCase()}</label>
                                                        <input
                                                            className="w-full border border-gray-300 p-2 text-sm outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                                                            value={col.translations?.[translationLanguage] || ''}
                                                            onChange={(e) => updateColumnUebersetzung(col.id, e.target.value)}
                                                            placeholder={getTranslation('LBL_COLUMN_HEADING', currentLanguage)}
                                                        />
                                                    </div>
                                                </div>

                                                {col.links.map((link) => (
                                                    <div key={link.id} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 mb-1">{getTranslation('LABEL_ORIGINAL_EN', currentLanguage)}</label>
                                                            <input className="w-full border border-gray-300 p-2 text-sm bg-gray-50" value={link.label || ''} readOnly />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-gray-500 mb-1">{translationLanguage.toUpperCase()}</label>
                                                            <input
                                                                className="w-full border border-gray-300 p-2 text-sm outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                                                                value={link.translations?.[translationLanguage] || ''}
                                                                onChange={(e) => updateLinkUebersetzung(col.id, link.id, e.target.value)}
                                                                placeholder={getTranslation('LBL_LABEL_TEXT', currentLanguage)}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>

                                    {localConfig.template === 'Corporate' && (localConfig.brandItems || []).length > 0 && (
                                        <div className="bg-white border border-gray-200 p-5 rounded-sm space-y-4">
                                            <h5 className="text-xs font-bold uppercase text-gray-600">
                                                {getTranslation('LBL_COLUMN_1', currentLanguage) || 'Column 1'}
                                            </h5>
                                            {(localConfig.brandItems || []).map((item) => (
                                                <div key={item.id} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-gray-500 mb-1">
                                                            {getTranslation('LABEL_ORIGINAL_EN', currentLanguage)}
                                                        </label>
                                                        <input
                                                            className="w-full border border-gray-300 p-2 text-sm bg-gray-50"
                                                            value={item.value || ''}
                                                            readOnly
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-gray-500 mb-1">{translationLanguage.toUpperCase()}</label>
                                                        <input
                                                            className="w-full border border-gray-300 p-2 text-sm outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                                                            value={item.translations?.[translationLanguage] || ''}
                                                            onChange={(e) => updateBrandItemUebersetzung(item.id, e.target.value)}
                                                            placeholder={item.label || getTranslation('LBL_LABEL_TEXT', currentLanguage)}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="bg-white border border-gray-200 p-5 rounded-sm space-y-4">
                                        <h5 className="text-xs font-bold uppercase text-gray-600">{getTranslation('TITLE_COPYRIGHT', currentLanguage)}</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-500 mb-1">{getTranslation('LABEL_ORIGINAL_EN', currentLanguage)}</label>
                                                <input className="w-full border border-gray-300 p-2 text-sm bg-gray-50" value={localConfig.copyright?.en || ''} readOnly />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-500 mb-1">{translationLanguage.toUpperCase()}</label>
                                                <input
                                                    className="w-full border border-gray-300 p-2 text-sm outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                                                    value={(localConfig.copyright as any)?.[translationLanguage] || ''}
                                                    onChange={(e) => handleUpdate('copyright', { ...localConfig.copyright, [translationLanguage]: e.target.value })}
                                                    placeholder={getTranslation('TITLE_COPYRIGHT', currentLanguage)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {(localConfig.bottomLinks || []).length > 0 && (
                                        <div className="bg-white border border-gray-200 p-5 rounded-sm space-y-4">
                                            <h5 className="text-xs font-bold uppercase text-gray-600">
                                                {getTranslation('LBL_BOTTOM_BAR_LINKS', currentLanguage) || 'Bottom Bar Links'}
                                            </h5>
                                            {(localConfig.bottomLinks || []).map((link) => (
                                                <div key={link.id} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-gray-500 mb-1">
                                                            {getTranslation('LABEL_ORIGINAL_EN', currentLanguage)}
                                                        </label>
                                                        <input
                                                            className="w-full border border-gray-300 p-2 text-sm bg-gray-50"
                                                            value={link.label || ''}
                                                            readOnly
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-gray-500 mb-1">{translationLanguage.toUpperCase()}</label>
                                                        <input
                                                            className="w-full border border-gray-300 p-2 text-sm outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                                                            value={link.translations?.[translationLanguage] || ''}
                                                            onChange={(e) => updateBottomLinkUebersetzung(link.id, e.target.value)}
                                                            placeholder={getTranslation('LBL_LABEL_TEXT', currentLanguage)}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            </div>
                        ) : (
                            <div className="flex flex-col space-y-6">
                                {/* Template Selection */}
                                <div>
                                    { /* <h4 className="text-sm font-bold text-gray-700 mb-2">{getTranslation('LBL_SELECT_TEMPLATE', currentLanguage)} <Info className="inline w-3 h-3 text-[var(--primary-color)]" /></h4> */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {['Table', 'Corporate'].map(t => (
                                            <div
                                                key={t}
                                                onClick={() => handleUpdate('template', t)}
                                                className={`border p-4 cursor-pointer transition-all ${localConfig.template === t ? 'border-[var(--primary-color)] bg-[var(--brand-light)] ring-1 ring-[var(--primary-color)]' : 'border-gray-200 hover:border-[var(--primary-color)]'}`}
                                            >
                                                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                                                    {t === 'Table' ? <LayoutTemplate className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                                                    {t === 'Table' ? getTranslation('TAB_CONTAINER_TABLE_VIEW', currentLanguage) : getTranslation('LABEL_CORPORATE_VIEW', currentLanguage)} <EditTrigger labelKey="LBL_SELECT_TEMPLATE" size="w-3 h-3" />
                                                </div>
                                                <span className="text-md text-gray-500">{t === 'Table' ? getTranslation('DESC_TABLE_VIEW_TEMPLATE', currentLanguage) : getTranslation('DESC_CORPORATE_VIEW_TEMPLATE', currentLanguage)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer Settings Accordion */}
                                <div className="border border-gray-200 bg-gray-50">
                                    <button
                                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                        className="w-full px-4 py-3 flex justify-between items-center text-sm font-bold text-[var(--primary-color)] bg-[var(--brand-light)]/50 border-b border-gray-200"
                                    >
                                        <span className="flex items-center gap-2">{getTranslation('LBL_FOOTER_SETTINGS', currentLanguage)} <EditTrigger labelKey="LBL_FOOTER_SETTINGS" size="w-3 h-3" /></span>
                                        {isSettingsOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                    </button>

                                    {isSettingsOpen && (
                                        <div className="p-6 space-y-6">
                                            {/* Row 1: BG Color & Alignment */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                                                        {getTranslation('LBL_BG_COLOR', currentLanguage)}
                                                        <EditTrigger labelKey="LBL_BG_COLOR" />
                                                    </label>
                                                    <div className="flex gap-2 items-center">
                                                        <div className="flex gap-0 border border-gray-300 rounded-sm overflow-hidden flex-1">
                                                            {[
                                                                { id: 'white', label: getTranslation('LBL_COLOR_WHITE', currentLanguage) },
                                                                { id: 'light-grey', label: getTranslation('LBL_COLOR_GREY', currentLanguage) },
                                                                { id: 'site-color', label: getTranslation('LBL_COLOR_SITE', currentLanguage) },
                                                                { id: 'other', label: getTranslation('LBL_COLOR_OTHER', currentLanguage) }
                                                            ].map(opt => (
                                                                <button
                                                                    key={opt.id}
                                                                    onClick={() => {
                                                                        if (opt.id === 'other') {
                                                                            const currentHex = ['white', 'light-grey', 'site-color'].includes(localConfig.backgroundColor) ? '#cccccc' : localConfig.backgroundColor;
                                                                            handleUpdate('backgroundColor', currentHex);
                                                                        } else {
                                                                            handleUpdate('backgroundColor', opt.id);
                                                                        }
                                                                    }}
                                                                    className={`flex-1 py-2 text-xs font-medium transition-colors ${(opt.id === 'other' && !isPresetColor) || localConfig.backgroundColor === opt.id
                                                                        ? 'bg-[var(--btn-primary-bg)] text-white'
                                                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        {!isPresetColor && (
                                                            <div className="relative w-8 h-8 flex-shrink-0 border border-gray-300 rounded-sm overflow-hidden group">
                                                                <div className="w-full h-full" style={{ backgroundColor: localConfig.backgroundColor }}></div>
                                                                <input
                                                                    type="color"
                                                                    value={localConfig.backgroundColor}
                                                                    onChange={(e) => handleUpdate('backgroundColor', e.target.value)}
                                                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                                />
                                                                <div className="absolute inset-0 bg-black/10 pointer-events-none group-hover:bg-black/0 transition-colors"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Alignment - TABLE VIEW ONLY */}
                                                {localConfig.template === 'Table' && (
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                                                            {getTranslation('LBL_ALIGNMENT', currentLanguage)}
                                                            <EditTrigger labelKey="LBL_ALIGNMENT" />
                                                        </label>
                                                        <div className="flex gap-4">
                                                            {['left', 'center', 'right'].map(align => (
                                                                <label key={align} className="flex items-center gap-2 cursor-pointer text-sm capitalize text-gray-700">
                                                                    <input
                                                                        type="radio"
                                                                        checked={localConfig.alignment === align}
                                                                        onChange={() => handleUpdate('alignment', align)}
                                                                        className="text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                                                                    />
                                                                    {align}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Row 1.5: List Bullets Configuration - TABLE VIEW ONLY */}
                                            {localConfig.template === 'Table' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                                                            {getTranslation('LBL_SHOW_LIST_BULLETS', currentLanguage) || 'Show List Bullets'}
                                                            <EditTrigger labelKey="LBL_SHOW_LIST_BULLETS" />
                                                        </label>
                                                        <div className="flex gap-4">
                                                            {[
                                                                { value: true, label: getTranslation('LBL_YES', currentLanguage) || 'Yes' },
                                                                { value: false, label: getTranslation('LBL_NO', currentLanguage) || 'No' }
                                                            ].map(opt => (
                                                                <label key={String(opt.value)} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                                                                    <input
                                                                        type="radio"
                                                                        checked={(localConfig.showBullets !== false) === opt.value}
                                                                        onChange={() => handleUpdate('showBullets', opt.value)}
                                                                        className="text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                                                                    />
                                                                    {opt.label}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Row 2: Text */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                                                        {getTranslation('TITLE_COPYRIGHT', currentLanguage)} ({currentLanguage.toUpperCase()})
                                                        <EditTrigger labelKey="TITLE_COPYRIGHT" />
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={localConfig.copyright[currentLanguage] || ''}
                                                        onChange={(e) => handleCopyrightUpdate(e.target.value)}
                                                        className="w-full px-4 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[var(--primary-color)]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                                                        {getTranslation('LBL_SUB_FOOTER_TEXT', currentLanguage)}
                                                        <EditTrigger labelKey="LBL_SUB_FOOTER_TEXT" />
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={localConfig.subFooterText}
                                                        onChange={(e) => handleUpdate('subFooterText', e.target.value)}
                                                        className="w-full px-4 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[var(--primary-color)]"
                                                    />
                                                </div>
                                            </div>

                                            {/* Row 3: Font Settings */}
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{getTranslation('LBL_FONT_SIZE_SETTINGS', currentLanguage)}</label>
                                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1 block">{getTranslation('LBL_HEADING_SIZE', currentLanguage)}</label>
                                                        <input
                                                            type="text"
                                                            value={localConfig.fontSettings?.headingSize || '16px'}
                                                            onChange={(e) => handleFontUpdate('headingSize', e.target.value)}
                                                            className="w-full px-4 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[var(--primary-color)]"
                                                            placeholder="16px"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1 block">{getTranslation('LBL_SUBHEADING_SIZE', currentLanguage)}</label>
                                                        <input
                                                            type="text"
                                                            value={localConfig.fontSettings?.subHeadingSize || '14px'}
                                                            onChange={(e) => handleFontUpdate('subHeadingSize', e.target.value)}
                                                            className="w-full px-4 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[var(--primary-color)]"
                                                            placeholder="14px"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1 block">{getTranslation('LBL_HEADING_WEIGHT', currentLanguage)}</label>
                                                        <FontWeightSelect
                                                            value={localConfig.fontSettings?.headingWeight ?? '700'}
                                                            defaultValue="700"
                                                            currentLanguage={currentLanguage}
                                                            className="w-full px-4 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[var(--primary-color)] bg-white rounded-sm"
                                                            onChange={(value) => handleFontUpdate('headingWeight', value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1 block">{getTranslation('LBL_SUBHEADING_WEIGHT', currentLanguage)}</label>
                                                        <FontWeightSelect
                                                            value={localConfig.fontSettings?.subHeadingWeight ?? '500'}
                                                            defaultValue="500"
                                                            currentLanguage={currentLanguage}
                                                            className="w-full px-4 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[var(--primary-color)] bg-white rounded-sm"
                                                            onChange={(value) => handleFontUpdate('subHeadingWeight', value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Preview Section - Title */}
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                                        <Monitor className="w-4 h-4" /> {getTranslation('LABEL_VISUAL_VIEW', currentLanguage)}
                                    </h4>
                                </div>

                                <div className="border border-gray-200 bg-gray-50 min-h-[300px] p-8 flex justify-center w-full">
                                    {/* VISUAL PREVIEW MODE */}
                                    {view === 'VISUAL' && (
                                        <div className="w-full border border-gray-300 shadow-lg scale-95 origin-top transition-all duration-300">
                                            <div
                                                style={{
                                                    backgroundColor: getFooterBg(localConfig.backgroundColor),
                                                    color: getFooterTextColor(localConfig.backgroundColor),
                                                    padding: '3rem 2rem',
                                                    textAlign: localConfig.template === 'Table' ? localConfig.alignment : 'left',
                                                    ...({
                                                        '--heading-color': getFooterHeadingColor(localConfig.backgroundColor),
                                                        '--heading-h1-color': getFooterHeadingColor(localConfig.backgroundColor),
                                                        '--heading-h2-color': getFooterHeadingColor(localConfig.backgroundColor),
                                                        '--heading-h3-color': getFooterHeadingColor(localConfig.backgroundColor),
                                                        '--heading-h4-color': getFooterHeadingColor(localConfig.backgroundColor),
                                                        '--heading-h5-color': getFooterHeadingColor(localConfig.backgroundColor),
                                                        '--heading-h6-color': getFooterHeadingColor(localConfig.backgroundColor),
                                                        '--font-weight-bold': localConfig.fontSettings.headingWeight || '700',
                                                        '--font-size-h5': localConfig.fontSettings.headingSize,
                                                        '--font-size-h4': localConfig.fontSettings.headingSize,
                                                        '--custom-link-color': getFooterLinkColor(localConfig.backgroundColor),
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
                                            `}</style>
                                                {localConfig.template === 'Table' && (
                                                    <div className="max-w-7xl mx-auto flex flex-col w-full">
                                                        <div className="flex flex-col md:flex-row gap-12 w-full">
                                                            {localConfig.columns.map(col => (
                                                                <div key={col.id} className="flex-1 flex flex-col w-full">
                                                                    <h5
                                                                        className="pb-4 w-full"
                                                                        style={{
                                                                            fontSize: localConfig.fontSettings.headingSize,
                                                                            color: getFooterHeadingColor(localConfig.backgroundColor),
                                                                            fontWeight: Number(localConfig.fontSettings.headingWeight || 700),
                                                                            ...({ '--font-weight-bold': localConfig.fontSettings.headingWeight || 700 } as any)
                                                                        }}
                                                                    >
                                                                        {getFooterColumnTitle(col)}
                                                                    </h5>
                                                                    <ul className="flex flex-col w-full" style={{ fontSize: localConfig.fontSettings.subHeadingSize, fontWeight: Number(localConfig.fontSettings.subHeadingWeight || 500) }}>
                                                                        {col.links.map(link => (
                                                                            <li key={link.id} className="border-b border-current border-opacity-30 w-full">
                                                                                <span className="block py-3 footer-table-link cursor-pointer">
                                                                                    {getFooterLinkLabel(link)}
                                                                                </span>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-16 pt-8 border-t border-current border-opacity-30 flex flex-col md:flex-row justify-between items-end w-full gap-6">
                                                            <div className="opacity-80 text-sm md:pb-1" style={{ color: getFooterTextColor(localConfig.backgroundColor) }}>
                                                                {getLocalizedText(localConfig.copyright, currentLanguage)}
                                                            </div>
                                                            {localConfig.logo && (
                                                                <img src={localConfig.logo} alt="Logo" className="object-contain object-right shrink-0 mt-4 md:mt-0 w-auto max-w-[min(360px,100%)] h-auto max-h-24 sm:max-h-28 md:max-h-32" />
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* CORPORATE VIEW RENDER */}
                                                {localConfig.template === 'Corporate' && (
                                                    <div className="w-full py-12 px-8">
                                                        {/* Top Section: 3 Columns */}
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-center mb-16">

                                                            {/* Column 1: Brand & Address (Flexible) */}
                                                            <div className="space-y-4 text-left">
                                                                <div className="space-y-1">
                                                                    {(localConfig.brandItems && localConfig.brandItems.length > 0) ? (
                                                                        localConfig.brandItems.map((item, idx) => (
                                                                            <div key={item.id}>
                                                                                <h4 className={idx === 0 ? "mb-1" : "opacity-80 leading-relaxed"} style={{
                                                                                    fontSize: idx === 0 ? localConfig.fontSettings.headingSize : localConfig.fontSettings.subHeadingSize,
                                                                                    color: 'var(--primary-color)',
                                                                                    fontWeight: idx === 0 ? Number(localConfig.fontSettings?.headingWeight || 700) : Number(localConfig.fontSettings?.subHeadingWeight || 500)
                                                                                }}>
                                                                                    {getBrandItemValue(item) || (idx === 0 ? siteConfig.name : '')}
                                                                                </h4>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="text-left text-[var(--primary-color)]">
                                                                            <h4 className="mb-2" style={{ fontSize: localConfig.fontSettings.headingSize, fontWeight: Number(localConfig.fontSettings?.headingWeight || 700) }}>{siteConfig.name}</h4>
                                                                            <p className="opacity-80 leading-relaxed" style={{ fontSize: localConfig.fontSettings.subHeadingSize, fontWeight: Number(localConfig.fontSettings?.subHeadingWeight || 500) }}>
                                                                                {localConfig.contactInfo.address}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="mt-2 text-left">
                                                                    <button
                                                                        onClick={() => setView('LIST')}
                                                                        className="w-8 h-8 rounded-full border border-[var(--primary-color)] bg-white flex items-center justify-center text-[var(--primary-color)] hover:bg-blue-50 transition-colors shadow-sm"
                                                                    >
                                                                        <Plus className="w-5 h-5" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Column 2: Social Links (Flexible) - WITH DESIGN LINES */}
                                                            <div className="flex flex-col items-center space-y-6">
                                                                <div className="flex items-center w-full gap-4">
                                                                    <div className="h-px bg-[var(--primary-color)]/20 flex-1"></div>
                                                                    <div className="flex flex-wrap justify-center gap-3">
                                                                        {(localConfig.socialItems && localConfig.socialItems.length > 0) ? (
                                                                            localConfig.socialItems.map(item => (
                                                                                <div key={item.id} className="cursor-pointer transition-opacity">
                                                                                    {getSocialIcon(item.type)}
                                                                                </div>
                                                                            ))
                                                                        ) : (
                                                                            <div className="flex gap-3">
                                                                                <div className="cursor-pointer">
                                                                                    <div className="w-9 h-9 rounded-full bg-[var(--primary-color)] flex items-center justify-center"><Facebook className="w-5 h-5 text-white" /></div>
                                                                                </div>
                                                                                <div className="cursor-pointer">
                                                                                    <div className="w-9 h-9 rounded-full bg-[var(--primary-color)] flex items-center justify-center"><Linkedin className="w-5 h-5 text-white" /></div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="h-px bg-[var(--primary-color)]/20 flex-1"></div>
                                                                </div>
                                                                <button
                                                                    onClick={() => setView('LIST')}
                                                                    className="w-8 h-8 rounded-full border border-[var(--primary-color)] bg-white flex items-center justify-center text-[var(--primary-color)] hover:bg-blue-50 transition-colors shadow-sm"
                                                                >
                                                                    <Plus className="w-5 h-5" />
                                                                </button>
                                                            </div>

                                                            {/* Column 3: Contact Info (Flexible) */}
                                                            <div className="flex flex-col items-end space-y-4 text-right">
                                                                <div className="space-y-3">
                                                                    {(localConfig.contactItems && localConfig.contactItems.length > 0) ? (
                                                                        localConfig.contactItems.map(item => (
                                                                            <div key={item.id} className="flex items-center justify-end gap-3" style={{ color: 'var(--primary-color)', fontSize: localConfig.fontSettings.subHeadingSize }}>
                                                                                <span>{item.value}</span>
                                                                                {getContactIcon(item.type)}
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="space-y-3">
                                                                            {localConfig.contactInfo.email && (
                                                                                <div className="flex items-center justify-end gap-3 text-[var(--primary-color)]" style={{ fontSize: localConfig.fontSettings.subHeadingSize }}>
                                                                                    <span>{localConfig.contactInfo.email}</span>
                                                                                    <Mail className="w-5 h-5" />
                                                                                </div>
                                                                            )}
                                                                            {localConfig.contactInfo.phone && (
                                                                                <div className="flex items-center justify-end gap-3 text-[var(--primary-color)]" style={{ fontSize: localConfig.fontSettings.subHeadingSize }}>
                                                                                    <span>{localConfig.contactInfo.phone}</span>
                                                                                    <Phone className="w-5 h-5" />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    onClick={() => setView('LIST')}
                                                                    className="w-8 h-8 rounded-full border border-[var(--primary-color)] bg-white flex items-center justify-center text-[var(--primary-color)] hover:bg-blue-50 transition-colors shadow-sm"
                                                                >
                                                                    <Plus className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Decorative Divider */}
                                                        <div className="h-px bg-gray-100 w-full mb-8"></div>

                                                        {/* Shared Bottom Bar */}
                                                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 opacity-70 text-sm">
                                                            <div className="flex flex-col items-start gap-2">
                                                                <div className="flex items-center gap-1">
                                                                    {(localConfig?.bottomLinks && localConfig.bottomLinks.length > 0) ? (
                                                                        localConfig.bottomLinks.map((link, idx) => (
                                                                            <React.Fragment key={link.id}>
                                                                                <span className="hover:underline cursor-pointer transition-colors px-1" style={{ fontSize: localConfig.fontSettings.subHeadingSize, color: 'var(--link-color)' }}>{getFooterLinkLabel(link as any)}</span>
                                                                                {idx < (localConfig.bottomLinks?.length || 0) - 1 && <span className="opacity-40 ml-1">/</span>}
                                                                            </React.Fragment>
                                                                        ))
                                                                    ) : (
                                                                        <div className="flex gap-2 opacity-60" style={{ fontSize: localConfig.fontSettings.subHeadingSize, color: 'var(--link-color)' }}>
                                                                            <span className="hover:underline cursor-pointer">{getTranslation('LBL_PRIVACY_POLICY', currentLanguage)}</span>
                                                                            <span>/</span>
                                                                            <span className="hover:underline cursor-pointer">{getTranslation('LBL_IMPRINT', currentLanguage)}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    onClick={() => setView('LIST')}
                                                                    className="w-8 h-8 rounded-full border border-[var(--primary-color)] bg-white flex items-center justify-center text-[var(--primary-color)] hover:bg-blue-50 transition-colors shadow-sm"
                                                                >
                                                                    <Plus className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-2 text-right">
                                                                <div className="text-[var(--primary-color)] font-medium opacity-80">{getLocalizedText(localConfig.copyright, currentLanguage)}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                            </div>
                                        </div>
                                    )}

                                    {/* LIST EDIT MODE */}
                                    {view === 'LIST' && (
                                        <div className="w-full">
                                            {localConfig.template === 'Table' && (
                                                <div className="space-y-8">
                                                    {renderTableFooterLogoSettings('footer-logo-file-list')}

                                                    <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
                                                        {localConfig.columns.map((col, idx) => (
                                                            <div key={col.id} className="bg-white border border-dashed border-gray-300 p-4 hover:border-[var(--primary-color)] transition-colors group">
                                                                <input
                                                                    value={col.title}
                                                                    onChange={(e) => {
                                                                        const newCols = [...localConfig.columns];
                                                                        newCols[idx].title = e.target.value;
                                                                        handleUpdate('columns', newCols);
                                                                    }}
                                                                    className="font-bold mb-3 w-full border-b border-transparent hover:border-gray-200 focus:border-[var(--primary-color)] focus:outline-none"
                                                                    placeholder={getTranslation('LBL_COLUMN_HEADING', currentLanguage)}
                                                                />
                                                                <div className="space-y-2">
                                                                    {col.links.map((link, lIdx) => (
                                                                        <div key={link.id} className="flex gap-2 text-sm">
                                                                            <input
                                                                                value={getExactLanguageText(link.label)}
                                                                                onChange={(e) => {
                                                                                    const newCols = [...localConfig.columns];
                                                                                    newCols[idx].links[lIdx].label = e.target.value;
                                                                                    handleUpdate('columns', newCols);
                                                                                }}
                                                                                className="flex-1 border p-1 text-xs"
                                                                                placeholder={getTranslation('LBL_LABEL_TEXT', currentLanguage)}
                                                                            />
                                                                            <button
                                                                                onClick={() => {
                                                                                    const newCols = [...localConfig.columns];
                                                                                    newCols[idx].links.splice(lIdx, 1);
                                                                                    handleUpdate('columns', newCols);
                                                                                }}
                                                                                className="text-red-400 hover:text-red-600"
                                                                            ><X className="w-3 h-3" /></button>
                                                                        </div>
                                                                    ))}
                                                                    <button
                                                                        onClick={() => {
                                                                            const newCols = [...localConfig.columns];
                                                                            newCols[idx].links.push({ id: `l_${Date.now()}`, label: 'New Link', url: '#' });
                                                                            handleUpdate('columns', newCols);
                                                                        }}
                                                                        className="text-xs text-[var(--primary-color)] hover:underline flex items-center gap-1 mt-2"
                                                                    ><Plus className="w-3 h-3" /> {getTranslation('LABEL_ADD_LINK', currentLanguage) || 'Add Link'}</button>
                                                                </div>
                                                                <div className="mt-4 pt-2 border-t border-gray-100 flex justify-end">
                                                                    <button
                                                                        onClick={() => {
                                                                            const newCols = localConfig.columns.filter(c => c.id !== col.id);
                                                                            handleUpdate('columns', newCols);
                                                                        }}
                                                                        className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    >{getTranslation('BTN_REMOVE_GROUP', currentLanguage) || 'Remove Group'}</button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <button
                                                            onClick={() => handleUpdate('columns', [...localConfig.columns, { id: `c_${Date.now()}`, title: 'New Column', links: [] }])}
                                                            className="border-2 border-dashed border-gray-300 flex flex-col items-center justify-center p-6 text-gray-400 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] transition-all"
                                                        >
                                                            <Plus className="w-8 h-8 mb-2" />
                                                            <span className="text-sm font-bold">{getTranslation('BTN_ADD_LINK_GROUP', currentLanguage) || 'Add Link Group'}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Corporate View Editor */}
                                            {localConfig.template === 'Corporate' && (
                                                <div className="w-full space-y-8">

                                                    {/* COLUMN 1: BRAND ITEMS */}
                                                    <div>
                                                        <h5 className="text-black font-bold mb-4 flex items-center gap-1">
                                                            {getTranslation('LBL_COLUMN_1', currentLanguage) || 'Column 1'}
                                                            <EditTrigger labelKey="LBL_COLUMN_1" />
                                                        </h5>
                                                        <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                                                            {(localConfig.brandItems || []).map((item, idx) => (
                                                                <div key={item.id} className="bg-white border border-gray-200 rounded p-4 flex gap-4 group relative">
                                                                    <div className="flex-1 space-y-3">
                                                                        <input
                                                                            type="text"
                                                                            value={item.label}
                                                                            onChange={(e) => {
                                                                                const items = [...(localConfig.brandItems || [])];
                                                                                items[idx].label = e.target.value;
                                                                                handleUpdate('brandItems', items);
                                                                            }}
                                                                            className="w-full border-b border-gray-100 hover:border-gray-300 focus:border-[var(--primary-color)] py-1 text-sm outline-none transition-colors"
                                                                            placeholder="Label"
                                                                        />
                                                                        <input
                                                                            type="text"
                                                                            value={item.value}
                                                                            onChange={(e) => {
                                                                                const items = [...(localConfig.brandItems || [])];
                                                                                items[idx].value = e.target.value;
                                                                                handleUpdate('brandItems', items);
                                                                            }}
                                                                            className="w-full border-b border-gray-100 hover:border-gray-300 focus:border-[var(--primary-color)] py-1 text-sm outline-none transition-colors"
                                                                            placeholder="Value"
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            const items = (localConfig.brandItems || []).filter(i => i.id !== item.id);
                                                                            handleUpdate('brandItems', items);
                                                                        }}
                                                                        className="text-gray-300 hover:text-red-500 transition-colors"
                                                                    >
                                                                        <Trash2 className="w-5 h-5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            <button
                                                                onClick={() => {
                                                                    const newItem = { id: `brand_${Date.now()}`, label: 'New Row', value: '' };
                                                                    handleUpdate('brandItems', [...(localConfig.brandItems || []), newItem]);
                                                                }}
                                                                className="w-full py-3 border-2 border-dashed border-[var(--primary-color)]/30 rounded-lg text-[var(--primary-color)] font-bold text-sm bg-white hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                                                            >
                                                                <Plus className="w-4 h-4" /> {getTranslation('BTN_ADD_NEW_ROW', currentLanguage) || 'Add New Row'}
                                                                <EditTrigger labelKey="BTN_ADD_NEW_ROW" size="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* COLUMN 2: SOCIAL LINKS */}
                                                    <div>
                                                        <h5 className="text-[var(--primary-color)] font-bold mb-4 flex items-center gap-1">
                                                            {getTranslation('LBL_COLUMN_2_SOCIAL', currentLanguage) || 'Column 2 (Social Links)'}
                                                            <EditTrigger labelKey="LBL_COLUMN_2_SOCIAL" />
                                                        </h5>
                                                        <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                                                            {(localConfig.socialItems || []).map((item, idx) => (
                                                                <div key={item.id} className="bg-white border border-gray-200 rounded p-4 flex gap-4">
                                                                    <div className="w-10 h-10 bg-[var(--primary-color)] rounded-full flex items-center justify-center text-white mt-1 shadow-sm">
                                                                        <Globe className="w-5 h-5" strokeWidth={2.5} />
                                                                    </div>
                                                                    <div className="flex-1 space-y-3">
                                                                        <input
                                                                            type="text"
                                                                            value={item.url}
                                                                            onChange={(e) => {
                                                                                const items = [...(localConfig.socialItems || [])];
                                                                                items[idx].url = e.target.value;
                                                                                handleUpdate('socialItems', items);
                                                                            }}
                                                                            className="w-full border-b border-gray-100 hover:border-gray-300 focus:border-[var(--primary-color)] py-1 text-sm outline-none transition-colors"
                                                                            placeholder={getTranslation('PLACEHOLDER_URL_GENERIC', currentLanguage)}
                                                                        />
                                                                        <select
                                                                            value={item.type}
                                                                            onChange={(e) => {
                                                                                const items = [...(localConfig.socialItems || [])];
                                                                                items[idx].type = e.target.value;
                                                                                handleUpdate('socialItems', items);
                                                                            }}
                                                                            className="w-full border-b border-gray-100 hover:border-gray-300 focus:border-[var(--primary-color)] py-1 text-sm outline-none transition-colors bg-transparent appearance-none"
                                                                        >
                                                                            <option value="Facebook">Facebook</option>
                                                                            <option value="LinkedIn">LinkedIn</option>
                                                                            <option value="Twitter">Twitter</option>
                                                                            <option value="Instagram">Instagram</option>
                                                                            <option value="Youtube">Youtube</option>
                                                                            <option value="Web">Web</option>
                                                                        </select>
                                                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                                                            <button className="px-3 py-1 border border-gray-200 hover:bg-gray-50">Choose File</button>
                                                                            <span>{getTranslation('MSG_NO_FILE_CHOSEN', currentLanguage)}</span>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            const items = (localConfig.socialItems || []).filter(i => i.id !== item.id);
                                                                            handleUpdate('socialItems', items);
                                                                        }}
                                                                        className="text-gray-300 hover:text-red-500 transition-colors"
                                                                    >
                                                                        <Trash2 className="w-5 h-5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            <button
                                                                onClick={() => {
                                                                    const newItem = { id: `soc_${Date.now()}`, url: '', type: 'Web' };
                                                                    handleUpdate('socialItems', [...(localConfig.socialItems || []), newItem]);
                                                                }}
                                                                className="w-full py-3 border-2 border-dashed border-[var(--primary-color)]/30 rounded-lg text-[var(--primary-color)] font-bold text-sm bg-white hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                                                            >
                                                                <Plus className="w-4 h-4" /> {getTranslation('BTN_ADD_SOCIAL_LINK', currentLanguage) || 'Add Social Link'}
                                                                <EditTrigger labelKey="BTN_ADD_SOCIAL_LINK" size="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* COLUMN 3: CONTACT ITEMS */}
                                                    <div>
                                                        <h5 className="text-[var(--primary-color)] font-bold mb-4 flex items-center gap-1">
                                                            {getTranslation('LBL_COLUMN_3', currentLanguage) || 'Column 3'}
                                                            <EditTrigger labelKey="LBL_COLUMN_3" />
                                                        </h5>
                                                        <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                                                            {(localConfig.contactItems || []).map((item, idx) => (
                                                                <div key={item.id} className="bg-white border border-gray-200 rounded p-4 flex gap-4">
                                                                    <div className="w-10 h-10 bg-[var(--primary-color)]/10 rounded-full flex items-center justify-center text-[var(--primary-color)] mt-1">
                                                                        <Mail className="w-5 h-5" strokeWidth={2.5} />
                                                                    </div>
                                                                    <div className="flex-1 space-y-3">
                                                                        <input
                                                                            type="text"
                                                                            value={item.value}
                                                                            onChange={(e) => {
                                                                                const items = [...(localConfig.contactItems || [])];
                                                                                items[idx].value = e.target.value;
                                                                                handleUpdate('contactItems', items);
                                                                            }}
                                                                            className="w-full border-b border-gray-100 hover:border-gray-300 focus:border-[var(--primary-color)] py-1 text-sm outline-none transition-colors"
                                                                            placeholder="Value"
                                                                        />
                                                                        <select
                                                                            value={item.type}
                                                                            onChange={(e) => {
                                                                                const items = [...(localConfig.contactItems || [])];
                                                                                items[idx].type = e.target.value;
                                                                                handleUpdate('contactItems', items);
                                                                            }}
                                                                            className="w-full border-b border-gray-100 hover:border-gray-300 focus:border-[var(--primary-color)] py-1 text-sm outline-none transition-colors bg-transparent appearance-none"
                                                                        >
                                                                            <option value="Email">Email</option>
                                                                            <option value="Phone">Phone</option>
                                                                            <option value="Mobile">Mobile</option>
                                                                            <option value="Fax">Fax</option>
                                                                            <option value="Address">Address</option>
                                                                            <option value="Text">Text</option>
                                                                        </select>
                                                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                                                            <button className="px-3 py-1 border border-gray-200 hover:bg-gray-50">Choose File</button>
                                                                            <span>{getTranslation('MSG_NO_FILE_CHOSEN', currentLanguage)}</span>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            const items = (localConfig.contactItems || []).filter(i => i.id !== item.id);
                                                                            handleUpdate('contactItems', items);
                                                                        }}
                                                                        className="text-gray-300 hover:text-red-500 transition-colors"
                                                                    >
                                                                        <Trash2 className="w-5 h-5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            <button
                                                                onClick={() => {
                                                                    const newItem = { id: `cont_${Date.now()}`, value: '', type: 'Text' };
                                                                    handleUpdate('contactItems', [...(localConfig.contactItems || []), newItem]);
                                                                }}
                                                                className="w-full py-3 border-2 border-dashed border-[var(--primary-color)]/30 rounded-lg text-[var(--primary-color)] font-bold text-sm bg-white hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                                                            >
                                                                <Plus className="w-4 h-4" /> {getTranslation('BTN_ADD_NEW_ROW', currentLanguage) || 'Add New Row'}
                                                                <EditTrigger labelKey="BTN_ADD_NEW_ROW" size="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* BOTTOM BAR LINKS */}
                                                    <div>
                                                        <h5 className="text-[var(--link-color)] font-bold mb-4 flex items-center gap-1">
                                                            {getTranslation('LBL_BOTTOM_BAR_LINKS', currentLanguage) || 'Bottom Bar Links'}
                                                            <EditTrigger labelKey="LBL_BOTTOM_BAR_LINKS" />
                                                        </h5>
                                                        <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                                                            {(localConfig.bottomLinks || []).map((item, idx) => (
                                                                <div key={item.id} className="bg-white border border-gray-200 rounded p-4 flex gap-4">
                                                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                                                        <input
                                                                            type="text"
                                                                            value={item.label}
                                                                            onChange={(e) => {
                                                                                const items = [...(localConfig.bottomLinks || [])];
                                                                                items[idx].label = e.target.value;
                                                                                handleUpdate('bottomLinks', items);
                                                                            }}
                                                                            className="w-full border p-2 rounded text-sm outline-none focus:border-[var(--primary-color)]"
                                                                            placeholder="Label"
                                                                        />
                                                                        <input
                                                                            type="text"
                                                                            value={item.url}
                                                                            onChange={(e) => {
                                                                                const items = [...(localConfig.bottomLinks || [])];
                                                                                items[idx].url = e.target.value;
                                                                                handleUpdate('bottomLinks', items);
                                                                            }}
                                                                            className="w-full border p-2 rounded text-sm outline-none focus:border-[var(--primary-color)]"
                                                                            placeholder="URL"
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            const items = (localConfig.bottomLinks || []).filter(i => i.id !== item.id);
                                                                            handleUpdate('bottomLinks', items);
                                                                        }}
                                                                        className="text-gray-300 hover:text-red-500 transition-colors"
                                                                    >
                                                                        <Trash2 className="w-5 h-5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            <button
                                                                onClick={() => {
                                                                    const newItem = { id: `bot_${Date.now()}`, label: 'New Link', url: '#' };
                                                                    handleUpdate('bottomLinks', [...(localConfig.bottomLinks || []), newItem]);
                                                                }}
                                                                className="w-full py-3 border-2 border-dashed border-[var(--primary-color)]/30 rounded-lg text-[var(--primary-color)] font-bold text-sm bg-white hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                                                            >
                                                                <Plus className="w-4 h-4" /> {getTranslation('BTN_ADD_NEW_LINK', currentLanguage) || 'Add New Link'}
                                                                <EditTrigger labelKey="BTN_ADD_NEW_LINK" size="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                    )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </GenericModal>
    );
};
