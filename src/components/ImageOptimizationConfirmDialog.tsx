import * as React from 'react';
import { createPortal } from 'react-dom';
import { Image as ImageIcon } from 'lucide-react';
import {
    cancelImageOptimizationConfirm,
    getImageOptimizationConfirmRequest,
    respondImageOptimizationConfirm,
    subscribeImageOptimizationConfirm,
} from '../utils/imageOptimizationConfirm';
import { getTranslation, useStore } from '../webparts/webStudio/store';

const ImageOptimizationConfirmDialog: React.FC = () => {
    const [request, setRequest] = React.useState(getImageOptimizationConfirmRequest());
    const currentLanguage = useStore((state) => state.currentLanguage);

    React.useEffect(() => subscribeImageOptimizationConfirm(() => {
        setRequest(getImageOptimizationConfirmRequest());
    }), []);

    if (!request) {
        return null;
    }

    return createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            style={{ zIndex: 1000001 }}
        >
            <div className="bg-white w-[450px] min-w-[450px] max-w-[450px] shadow-2xl rounded-sm border border-gray-300 flex flex-col overflow-hidden relative">
                <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-blue-50/50">
                        <ImageIcon className="w-8 h-8" style={{ color: 'var(--icon-color)' }} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {getTranslation('TITLE_CONFIRM_IMAGE_OPTIMIZATION', currentLanguage)}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed px-4">
                        {getTranslation('MSG_CONFIRM_IMAGE_OPTIMIZATION', currentLanguage)}
                    </p>
                    <p className="text-xs text-gray-400 mt-3 truncate px-4" title={request.fileName}>
                        {request.fileName} ({request.fileSizeLabel})
                    </p>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={cancelImageOptimizationConfirm}
                        className="px-6 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-bold hover:bg-gray-100 rounded-sm"
                    >
                        {getTranslation('BTN_CANCEL', currentLanguage)}
                    </button>
                    <button
                        type="button"
                        onClick={() => respondImageOptimizationConfirm(false)}
                        className="px-6 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-bold hover:bg-gray-100 rounded-sm"
                    >
                        {getTranslation('BTN_UPLOAD_ORIGINAL', currentLanguage)}
                    </button>
                    <button
                        type="button"
                        onClick={() => respondImageOptimizationConfirm(true)}
                        className="px-8 py-2 bg-[var(--btn-primary-bg)] text-white text-sm font-bold shadow-sm hover:opacity-90 transition-all rounded-sm capitalize tracking-wide"
                    >
                        {getTranslation('BTN_OPTIMIZE_IMAGE', currentLanguage)}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ImageOptimizationConfirmDialog;
