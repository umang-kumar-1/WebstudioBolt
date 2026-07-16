export const KNOWN_DOC_TYPES = ['Word', 'Excel', 'PDF', 'PPT', 'Presentations', 'Link'] as const;

export type KnownDocType = (typeof KNOWN_DOC_TYPES)[number];

export const getFileExtension = (name?: string): string => {
    if (!name) return '';
    const base = name.split(/[?#]/)[0];
    const ext = base.split('.').pop()?.toLowerCase();
    if (!ext || ext === base.toLowerCase()) return '';
    return ext;
};

export const getDocFileName = (name?: string, fileRef?: string): string => {
    if (name?.trim()) return name.trim();
    if (!fileRef?.trim()) return '';
    const segment = fileRef.split(/[?#]/)[0].split('/').pop();
    return segment || '';
};

export const getFileTypeFromName = (name?: string, fileRef?: string): string => {
    const ext = getFileExtension(getDocFileName(name, fileRef));
    if (!ext) return 'Others';
    if (ext === 'pdf') return 'PDF';
    if (['doc', 'docx', 'docm', 'dot', 'dotx', 'rtf'].includes(ext)) return 'Word';
    if (['xls', 'xlsx', 'xlsm', 'csv'].includes(ext)) return 'Excel';
    if (['ppt', 'pptx', 'pptm', 'pps', 'ppsx'].includes(ext)) return 'Presentations';
    if (ext === 'url') return 'Link';
    return 'Others';
};

export const resolveDocumentType = (
    docType?: string,
    name?: string,
    fileRef?: string
): string => {
    const normalized = docType?.trim();
    if (normalized && KNOWN_DOC_TYPES.includes(normalized as KnownDocType)) {
        return normalized;
    }
    if (normalized === 'PPT') return 'PPT';
    return getFileTypeFromName(name, fileRef);
};
