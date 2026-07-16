
import React, { useState, useRef, useMemo } from 'react';
import JoditEditor from 'jodit-react';
import './JoditEditor.css';

export default function HtmlEditorComponent(Props: any) {
    const callBack = Props?.HtmlEditorStateChange || Props?.onChange;
    const editor = useRef<any>(null);
    const lastPasteSignatureRef = useRef<string>('');
    const lastPasteHandledAtRef = useRef<number>(0);

    const [content, setContent] = useState(Props?.editorValue !== undefined ? Props?.editorValue : Props?.value);

    React.useEffect(() => {
        const newValue = Props?.editorValue !== undefined ? Props?.editorValue : Props?.value;
        if (newValue !== undefined && newValue !== content) {
            setContent(newValue);
        }
    }, [Props?.editorValue, Props?.value]);

    const cleanPastedHtml = (html: string) => {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const protectedTags = ['TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'DETAILS', 'SUMMARY'];
            const allElements = doc.querySelectorAll('*');

            allElements.forEach((el) => {
                const isInsideProtected = (element: Element) => {
                    let current: Element | null = element;
                    while (current) {
                        if (protectedTags.indexOf(current.tagName.toUpperCase()) !== -1) {
                            return true;
                        }
                        current = current.parentElement;
                    }
                    return false;
                };

                if (!isInsideProtected(el)) {
                    el.removeAttribute('class');
                    el.removeAttribute('style');
                }
            });

            return doc.body.innerHTML;
        } catch (e) {
            console.error('Error cleaning pasted HTML:', e);
            return html;
        }
    };

    const insertHtmlAtCursor = (html: string): boolean => {
        const editorRef = editor.current as any;
        const joditInstance = editorRef?.editor || editorRef;

        if (joditInstance?.s?.insertHTML) {
            joditInstance.s.insertHTML(html);
            return true;
        }

        if (editorRef?.selection?.insertHTML) {
            editorRef.selection.insertHTML(html);
            return true;
        }

        if (joditInstance?.selection?.insertHTML) {
            joditInstance.selection.insertHTML(html);
            return true;
        }

        if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
            return document.execCommand('insertHTML', false, html);
        }

        return false;
    };

    const config = useMemo(() => ({
        readonly: false,
        placeholder: Props?.placeholder || '',
        uploader: {
            insertImageAsBase64URI: true
        },
        controls: {
            paragraph: {
                list: {
                    p_custom: 'Paragraph',
                    h1_custom: 'Heading 1',
                    h1_siteColor: 'Heading 1 (Site Color)',
                    h2_custom: 'Heading 2',
                    h2_siteColor: 'Heading 2 (Site Color)',
                    h3_custom: 'Heading 3',
                    h4_custom: 'Heading 4',
                    blockquote_custom: 'Quote',
                    pre_custom: 'Code'
                },
                childTemplate: (editor: any, key: string, value: string) => {
                    const optionKey = (key || '').replace('_custom', '').toLowerCase();
                    let fontSize = '14px';
                    let fontWeight = '400';
                    let color = '#4a4a4a';
                    let extraClass = '';

                    if (optionKey === 'h1') {
                        color = '#4a4a4a';
                    } else if (optionKey === 'h1_sitecolor') {
                        color = '#2f5fa3';
                        extraClass = ' siteColor';
                    } else if (optionKey === 'h2') {
                        color = '#4a4a4a';
                    } else if (optionKey === 'h2_sitecolor') {
                        color = '#2f5fa3';
                        extraClass = ' siteColor';
                    }

                    return `<span class="${extraClass.trim()}" style="display:block; margin:0; padding:0; font-size:${fontSize}; font-weight:${fontWeight}; color:${color}; line-height:1.15;">${editor.i18n(value)}</span>`;
                },
                exec: (editor: any, _current: any, options: any) => {
                    const valueCandidates = [
                        options?.args?.[0],
                        options?.control?.args?.[0],
                        options?.value,
                        options?.control?.value,
                        options?.control?.name
                    ];
                    const selectedValueRaw = valueCandidates.find((v) => typeof v === 'string' && v.trim().length > 0) || 'p_custom';
                    const selectedValue = String(selectedValueRaw).trim().toLowerCase();
                    const normalizedSelectionMap: Record<string, string> = {
                        p_custom: 'p',
                        h1_custom: 'h1',
                        h1_sitecolor: 'h1_siteColor',
                        h1_sitecolor_: 'h1_siteColor',
                        h2_custom: 'h2',
                        h2_sitecolor: 'h2_siteColor',
                        h2_sitecolor_: 'h2_siteColor',
                        h3_custom: 'h3',
                        h4_custom: 'h4',
                        blockquote_custom: 'blockquote',
                        pre_custom: 'pre'
                    };
                    const normalizedSelection = normalizedSelectionMap[selectedValue] || selectedValue;

                    let headingTag = 'p';
                    let cssClass = '';

                    if (normalizedSelection === 'h1_siteColor') {
                        headingTag = 'h1';
                        cssClass = 'siteColor';
                    } else if (normalizedSelection === 'h2_siteColor') {
                        headingTag = 'h2';
                        cssClass = 'siteColor';
                    } else {
                        const allowedTags = ['p', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'pre'];
                        headingTag = allowedTags.indexOf(normalizedSelection) > -1 ? normalizedSelection : 'p';
                    }

                    const html = editor.s.html;
                    const hasBlockTags = /<(p|h[1-6]|div|ul|ol|li|blockquote|table)[\s>]/i.test(html || '');

                    // If user selects partial inline text (not spanning multiple blocks), split it out
                    if (html && html.trim().length > 0 && !hasBlockTags) {
                        let inlineStyle = '';
                        if (headingTag === 'h1') inlineStyle = 'font-size: 40px; font-weight: 700; line-height: 48px; /*font-family: var(--font-primary, inherit);*/';
                        else if (headingTag === 'h2') inlineStyle = 'font-size: 24px; font-weight: 700; line-height: 32px; /*font-family: var(--font-secondary, inherit);*/';
                        else if (headingTag === 'h3') inlineStyle = 'font-size: 20px; font-weight: 700; line-height: 28px; /*font-family: var(--font-secondary, inherit);*/';
                        else if (headingTag === 'h4') inlineStyle = 'font-size: 18px; font-weight: 700; line-height: 24px; /*font-family: var(--font-secondary, inherit);*/';

                        if (cssClass === 'siteColor') {
                            inlineStyle += ' color: var(--primary-color, var(--color-primary)) !important;';
                        }

                        if (inlineStyle) {
                            editor.s.insertHTML(`<span style="${inlineStyle}">${html}</span>`);
                        } else {
                            editor.s.commitStyle({
                                element: headingTag,
                                attributes: cssClass ? { class: cssClass } : undefined
                            });
                        }
                    } else {
                        // Standard block formatting
                        editor.s.commitStyle({
                            element: headingTag,
                            attributes: cssClass ? { class: cssClass } : undefined
                        });
                    }

                    editor.synchronizeValues?.();
                    return false;
                }
            }
        },
        askBeforePasteFromWord: false,
        askBeforePasteHTML: false,
        buttons: [
            'bold', 'italic', 'eraser', '|',
            'ul', 'ol', 'align', '|',
            'font', 'fontsize', 'brush', 'paragraph', '|',
            'table', 'image', 'link', '|',
            'undo', 'redo', 'preview', '|', 'source',
        ],

        extraButtons: [
            {
                name: 'insertAccordion',
                iconURL: 'https://cdn0.iconfinder.com/data/icons/leading-international-corporate-website-app-collec/16/Expand_menu-512.png',
                tooltip: 'Insert Accordion',
                exec: (editor: any) => {
                    const accordionHTML = `
                        <details open style="border:1px solid #d1d5db; margin:12px 0; background:#ffffff;">
                            <summary style="padding:12px 14px; cursor:pointer; font-weight:600; color:#1f2937; text-decoration:none; list-style-position:inside;">
                                <span style="text-decoration:none; color:inherit;">Custom Accordion</span>
                            </summary>
                            <div class="expand-AccordionContent border p-2 clearfix" style="min-height:72px; border-top:1px solid #d1d5db;"></div>
                        </details>
                    `;
                    editor.s.insertHTML(accordionHTML);
                }
            }
        ],

        popup: {
            summary: [
                {
                    name: 'update_title',
                    iconURL: 'https://cdn4.iconfinder.com/data/icons/software-line/32/software-line-02-512.png',
                    tooltip: 'Update Title',
                    exec: (editor: any, target: any) => {
                        const details = target.closest('details');
                        const span = details?.querySelector('summary span');

                        if (span) {
                            const currentTitle = span.innerText || '';
                            const newTitle = prompt('Update Accordion Title:', currentTitle);

                            if (newTitle && newTitle.trim()) {
                                span.innerText = newTitle;
                                editor.e.fire('change');
                            }
                        }
                    }
                },
                {
                    name: 'delete_accordion',
                    iconURL: 'https://cdn4.iconfinder.com/data/icons/linecon/512/delete-512.png',
                    tooltip: 'Delete Accordion',
                    exec: (editor: any, target: any) => {
                        const details = target.closest('details');

                        if (details && confirm('Are you sure you want to delete this accordion?')) {
                            details.remove();
                            editor.e.fire('change');
                        }
                    }
                }
            ]
        },
        events: {
            beforePaste: (event: any) => {
                const clipboard =
                    event?.clipboardData ||
                    event?.originalEvent?.clipboardData ||
                    (window as any).clipboardData;
                if (!clipboard) return;

                const html = clipboard.getData('text/html');
                if (!html) {
                    return;
                }

                const now = Date.now();
                const signature = html.length > 0 ? `h:${html.slice(0, 250)}` : '';

                if (
                    signature &&
                    lastPasteSignatureRef.current === signature &&
                    now - lastPasteHandledAtRef.current < 80
                ) {
                    return false;
                }

                const cleaned = cleanPastedHtml(html);
                if (!cleaned || !cleaned.trim()) {
                    return;
                }

                const inserted = insertHtmlAtCursor(cleaned);
                if (!inserted) {
                    return;
                }

                lastPasteSignatureRef.current = signature;
                lastPasteHandledAtRef.current = now;
                event.preventDefault?.();
                event.stopPropagation?.();
                event.stopImmediatePropagation?.();
                event.returnValue = false;

                return false;
            },
            afterOpenPopup: (popup: any) => {
                if (!popup || !popup.container) return;

                setTimeout(() => {
                    const urlInput = popup.container.querySelector('input[name="url"]') || popup.container.querySelector('[data-ref="url_input"]');
                    if (!urlInput || popup.container.querySelector('#jodit-mailto-checkbox')) return;

                    // Create the mailto checkbox block
                    const mailtoBlock = document.createElement('div');
                    mailtoBlock.className = 'jodit-ui-block jodit-ui-block_align_left jodit-ui-block_size_middle';
                    mailtoBlock.style.cssText = 'width: 100% !important; display: block !important; flex: 0 0 100% !important; margin: 4px 0 !important;';
                    mailtoBlock.innerHTML = `
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; user-select: none; padding: 4px 0;">
                            <input type="checkbox" id="jodit-mailto-checkbox" style="width: 16px; height: 16px; margin: 0; cursor: pointer;" />
                            <span style="font-family: inherit; color: #1f2937;">Mail to (Open Outlook/Email client)</span>
                        </label>
                    `;

                    const checkbox = mailtoBlock.querySelector('#jodit-mailto-checkbox') as HTMLInputElement;
                    let userUnchecked = false;

                    const targetCheckbox = popup.container.querySelector('input[name="target"]') || popup.container.querySelector('[data-ref="target_checkbox"]');
                    const targetBlock = targetCheckbox ? (targetCheckbox.closest('.jodit-ui-block') || targetCheckbox.closest('.jodit-ui-checkbox') || targetCheckbox.parentElement) : null;

                    const toggleTargetVisibility = () => {
                        if (targetBlock) {
                            if (checkbox.checked) {
                                targetBlock.style.display = 'none';
                                if (targetCheckbox && targetCheckbox.checked) {
                                    targetCheckbox.checked = false;
                                    targetCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            } else {
                                targetBlock.style.display = '';
                            }
                        }
                    };

                    // Sync initial checkbox state based on URL input value
                    const checkState = () => {
                        const val = urlInput.value.trim();
                        checkbox.checked = val.startsWith('mailto:');
                        toggleTargetVisibility();
                    };
                    checkState();

                    // Listen for manual user input changes in the URL field
                    const handleUrlInput = () => {
                        const val = urlInput.value.trim();
                        if (val.startsWith('mailto:')) {
                            checkbox.checked = true;
                            userUnchecked = false;
                        } else {
                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            if (emailRegex.test(val)) {
                                if (!userUnchecked) {
                                    checkbox.checked = true;
                                    urlInput.value = 'mailto:' + val;
                                    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
                                }
                            } else {
                                checkbox.checked = false;
                            }
                        }
                        toggleTargetVisibility();
                    };

                    urlInput.addEventListener('input', handleUrlInput);
                    urlInput.addEventListener('change', handleUrlInput);

                    // Listen for checkbox state changes
                    checkbox.addEventListener('change', () => {
                        let val = urlInput.value.trim();
                        if (checkbox.checked) {
                            userUnchecked = false;
                            if (!val.startsWith('mailto:')) {
                                // Strip any existing protocol prefix if the user is changing to mailto
                                val = val.replace(/^(https?:\/\/)/i, '');
                                urlInput.value = 'mailto:' + val;
                            }
                        } else {
                            userUnchecked = true;
                            if (val.startsWith('mailto:')) {
                                urlInput.value = val.substring(7); // remove 'mailto:'
                            }
                        }
                        toggleTargetVisibility();
                        urlInput.dispatchEvent(new Event('input', { bubbles: true }));
                        urlInput.dispatchEvent(new Event('change', { bubbles: true }));
                    });

                    // Preferred: Find the button block container (Insert/Update/Unlink buttons) and insert before it
                    const submitBtn = popup.container.querySelector('button[type="submit"]') || 
                                      popup.container.querySelector('.jodit-ui-button_type_submit') || 
                                      popup.container.querySelector('.jodit-ui-button') ||
                                      popup.container.querySelector('button');
                    
                    if (submitBtn) {
                        const buttonBlock = submitBtn.closest('.jodit-ui-block') || submitBtn.parentElement;
                        if (buttonBlock && buttonBlock.parentNode) {
                            buttonBlock.parentNode.insertBefore(mailtoBlock, buttonBlock);
                            return;
                        }
                    }

                    // Fallback 1: Find where to insert our checkbox (after the last checkbox block)
                    const checkboxes = popup.container.querySelectorAll('.jodit-ui-checkbox, input[type="checkbox"]');
                    if (checkboxes.length > 0) {
                        const lastCheckbox = checkboxes[checkboxes.length - 1];
                        const lastBlock = lastCheckbox.closest('.jodit-ui-block') || lastCheckbox.parentElement;
                        if (lastBlock && lastBlock.parentNode) {
                            lastBlock.parentNode.insertBefore(mailtoBlock, lastBlock.nextSibling);
                            return;
                        }
                    }
                    
                    // Fallback 2: Append directly to the form/container
                    const form = urlInput.closest('form') || urlInput.closest('.jodit-form') || urlInput.closest('.jodit-ui-form') || popup.container;
                    if (form) {
                        form.appendChild(mailtoBlock);
                    }
                }, 100);
            }
        },

        toolbarSticky: false,
        toolbarAdaptive: false,
        zIndex: 150000,
        width: '100%',
        minHeight: 300,
    }), [Props?.placeholder]) as any;

    const cleanEditorOutput = (html: string) => {
        return html
            .replace(/(?:<p>(?:[\n\r\t]|<br>)*<\/p>[\n\r\t]*)+(?=(?:<p>[\n\r\t]*)?<details)/gi, '')
            .replace(/(?<=<\/details>(?:[\n\r\t]*<\/p>)?)[\n\r\t]*(?:<p>(?:[\n\r\t]|<br>)*<\/p>[\n\r\t]*)+/gi, '');
    };
    const emitValueChange = (value: string) => {
        if (typeof callBack === 'function') {
            callBack(value);
        }
    };

    const handleModelChange = (newContent: string) => {
        const normalizedContent = typeof newContent === 'string' ? newContent : '';
        const cleanedContent = cleanEditorOutput(normalizedContent);
        setContent((prev: string) => {
            if (prev === cleanedContent) return prev;
            emitValueChange(cleanedContent);
            return cleanedContent;
        });
    };


    return (
        <div className="jodit-container" style={{ width: '100%' }}>
            <JoditEditor
                ref={editor}
                value={content}
                config={config}
                // onBlur={(newContent: any) => handleModelChange(newContent)}
                onChange={(newContent: any) => handleModelChange(newContent)}
            />
        </div>
    );
}