
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore, getTranslation } from '../../store';
import { GenericModal } from './SharedModals';

export const LabelEditorModal = () => {
  const { editingLabelKey, uiLabels, updateLabel, closeModal, currentLanguage } = useStore();
  const [text, setText] = useState('');

  useEffect(() => {
    if (editingLabelKey && uiLabels[editingLabelKey]) {
      setText(uiLabels[editingLabelKey][currentLanguage] || '');
    }
  }, [editingLabelKey, currentLanguage, uiLabels]);

  if (!editingLabelKey) return null;

  const customFooter = (
    <div className="flex justify-end gap-3 w-full">
      <button type="button" onClick={closeModal} className="btn-secondary transition-colors inline-flex items-center justify-center gap-2">
        {getTranslation('BTN_CANCEL', currentLanguage) || 'Cancel'}
      </button>
      <button type="button" onClick={() => updateLabel(editingLabelKey, text, currentLanguage)} className="btn-primary shadow-sm transition-colors inline-flex items-center justify-center gap-2">
        {getTranslation('BTN_SAVE', currentLanguage) || 'Save'}
      </button>
    </div>
  );

  return createPortal(
    <div className="ws-label-editor-overlay fixed inset-0 flex items-center justify-center p-4">
      <button
        type="button"
        className="ws-label-editor-backdrop absolute inset-0 border-none p-0 cursor-default"
        aria-label={getTranslation('BTN_CLOSE', currentLanguage) || 'Close'}
        onClick={closeModal}
      />
      <div className="relative z-10 w-full flex justify-center">
        <GenericModal
          className="label-editor-popup"
          title={getTranslation('TITLE_EDIT_TRANSLATION', currentLanguage) || 'Edit Translation'}
          onClose={closeModal}
          width="w-[500px] min-w-[500px] max-w-[500px]"
          heightClass="h-auto"
          noFooter={false}
          customFooter={customFooter}
        >
          <div className="flex flex-col gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{getTranslation('LABEL_SYSTEM_KEY', currentLanguage)}</label>
              <code className="block bg-gray-100 p-2 text-xs text-gray-600 font-mono border border-gray-200 rounded-sm">{editingLabelKey}</code>
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--primary-color)] uppercase mb-1">
                {(getTranslation('LABEL_TRANSLATION', currentLanguage) || 'Translation')} ({currentLanguage.toUpperCase()})
              </label>
              <textarea
                className="w-full border border-gray-300 p-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none shadow-inner bg-yellow-50/50 rounded-sm resize-none h-24"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={getTranslation('PLACEHOLDER_TRANSLATION_INPUT', currentLanguage) || 'Enter translation'}
                autoFocus
              />
            </div>
          </div>
        </GenericModal>
      </div>
    </div>,
    document.body
  );
};
