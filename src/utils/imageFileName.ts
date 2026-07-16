export function getFileExtension(file?: File | null): string {
    if (!file) return 'png';
    if (file.name && file.name.includes('.')) {
        return file.name.split('.').pop()?.toLowerCase() || 'png';
    }
    if (file.type && file.type.includes('/')) {
        return file.type.split('/').pop()?.toLowerCase() || 'png';
    }
    return 'png';
}

const GENERIC_IMAGE_NAMES = new Set([
    'blob',
    'image.png',
    'image.jpg',
    'image.jpeg',
    'image.webp',
    'image.gif',
    'pasted-image.png',
]);

function sanitizeImageFileName(name: string): string {
    const trimmed = name.trim().replace(/[<>:"/\\|?*#%]/g, '_');
    return trimmed || 'image.png';
}

function splitFileName(name: string): { stem: string; ext: string } {
    const lastDot = name.lastIndexOf('.');
    if (lastDot <= 0) {
        return { stem: name, ext: '' };
    }
    return {
        stem: name.slice(0, lastDot),
        ext: name.slice(lastDot),
    };
}

/**
 * Resolve an upload file name from the source file, keeping the original name when possible.
 * Appends -2, -3, … before the extension when the name already exists in the gallery.
 */
export function getUniqueImageFileName(
    file: File | null | undefined,
    existingNames: string[],
    fallbackBaseName = 'image'
): string {
    const extension = getFileExtension(file);
    const rawName = file?.name?.trim();
    let baseName = rawName && !GENERIC_IMAGE_NAMES.has(rawName.toLowerCase())
        ? rawName
        : `${fallbackBaseName}.${extension}`;

    baseName = sanitizeImageFileName(baseName);

    const normalizedExisting = existingNames
        .map((name) => String(name || '').trim().toLowerCase())
        .filter(Boolean);

    if (!normalizedExisting.includes(baseName.toLowerCase())) {
        return baseName;
    }

    const { stem, ext } = splitFileName(baseName);
    let index = 2;
    let candidate = `${stem}-${index}${ext}`;
    while (normalizedExisting.includes(candidate.toLowerCase())) {
        index += 1;
        candidate = `${stem}-${index}${ext}`;
    }
    return candidate;
}

export function renameFileForUpload(file: File, targetName: string): File {
    if (file.name === targetName) return file;
    return new File([file], targetName, {
        type: file.type || 'image/png',
        lastModified: file.lastModified,
    });
}
