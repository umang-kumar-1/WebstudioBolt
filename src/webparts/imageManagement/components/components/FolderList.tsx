import * as React from 'react';
import { Folder } from './../types';
import { useStore, getTranslation } from './../../../webStudio/store';

interface FolderListProps {
    folders: (Folder & { imageCount: number })[];
    totalImageCount: number;
    selectedFolderId: number;
    onSelectFolder: (folderId: number) => void;
}

const FolderList: React.FC<FolderListProps> = ({ folders, totalImageCount, selectedFolderId, onSelectFolder }) => {
    const { currentLanguage } = useStore();
    return (
        <div className="h-full flex flex-col bg-white border border-gray-200 shadow-sm">
            <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200">
                <h5 className="m-0 text-sm font-semibold text-gray-700">{getTranslation('LABEL_FOLDERS', currentLanguage)}</h5>
            </div>
            <div className="scrollbar border-0 overflow-y-auto">
                <button
                    type="button"
                    className={`w-full px-4 py-2.5 text-sm flex justify-between items-center border-l-4 transition-colors ${selectedFolderId === 0 ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text-color)] border-l-[var(--sidebar-active-indicator-color)]' : 'bg-white text-[var(--sidebar-text)] border-l-transparent hover:bg-[var(--sidebar-hover-bg)]'}`}
                    onClick={() => onSelectFolder(0)}
                >
                    <div className="font-semibold flex items-center">
                        {getTranslation('LABEL_ALL_IMAGES', currentLanguage)}
                    </div>
                    <span className="inline-flex items-center justify-center rounded-full min-w-6 h-5 px-1.5 text-[10px] font-bold bg-[var(--primary-color)] text-white">{totalImageCount}</span>
                </button>
                {folders.map(folder => (
                    <button
                        key={folder.id}
                        type="button"
                        className={`w-full px-4 py-2.5 text-sm flex justify-between items-center border-l-4 transition-colors ${selectedFolderId === folder.id ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text-color)] border-l-[var(--sidebar-active-indicator-color)]' : 'bg-white text-[var(--sidebar-text)] border-l-transparent hover:bg-[var(--sidebar-hover-bg)]'}`}
                        onClick={() => onSelectFolder(folder.id)}
                    >
                        <div className="flex items-center truncate">
                            <span className="truncate" title={folder.name}>{folder.name}</span>
                        </div>
                        <span className="inline-flex items-center justify-center rounded-full min-w-6 h-5 px-1.5 text-[10px] font-bold bg-[var(--primary-color)] text-white">{folder.imageCount}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default FolderList;
