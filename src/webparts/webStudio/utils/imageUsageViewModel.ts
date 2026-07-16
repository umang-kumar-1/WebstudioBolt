import { ImageUsageReference } from './imageUsageFinder';

export type UsageViewCategory = 'pages' | 'content' | 'site';

export interface PageItemUsageGroup {
    kind: 'page-item';
    itemLabel: string;
    itemTypeKey: string;
    locations: Array<{ pageLabel: string; sectionLabel: string }>;
}

export interface SectionDirectUsage {
    kind: 'section-direct';
    pageLabel: string;
    sectionLabel: string;
    usageRoleKey: string;
    itemLabel: string;
}

export interface ContentLibraryUsage {
    kind: 'content';
    itemLabel: string;
    itemTypeKey: string;
}

export interface SiteBrandingUsage {
    kind: 'site';
    itemLabel: string;
    pageLabel: string;
    sectionLabel: string;
    usageRoleKey: string;
}

export interface PageThumbnailUsage {
    kind: 'page-thumbnail';
    pageLabel: string;
}

export type FriendlyUsageEntry =
    | PageItemUsageGroup
    | SectionDirectUsage
    | ContentLibraryUsage
    | SiteBrandingUsage
    | PageThumbnailUsage;

export interface FriendlyUsageView {
    totalCount: number;
    pages: FriendlyUsageEntry[];
    content: FriendlyUsageEntry[];
    site: FriendlyUsageEntry[];
    pageLocationCount: number;
    contentCount: number;
    siteCount: number;
}

const isPageItemRole = (role: string) => role === 'USAGE_ROLE_TAGGED_ITEM';

const isSectionDirectRole = (role: string) =>
    role === 'USAGE_ROLE_SECTION_BACKGROUND' || role === 'USAGE_ROLE_SLIDE_IMAGE';

const isSiteRole = (role: string) =>
    role === 'USAGE_ROLE_LOGO' || role === 'USAGE_ROLE_FOOTER_LOGO';

const isContentRole = (role: string) => role === 'USAGE_ROLE_ITEM_IMAGE';

const pageItemGroupKey = (usage: ImageUsageReference) =>
    `${usage.itemLabel}::${usage.itemTypeKey}`;

export const buildFriendlyUsageView = (usages: ImageUsageReference[]): FriendlyUsageView => {
    const pages: FriendlyUsageEntry[] = [];
    const content: FriendlyUsageEntry[] = [];
    const site: FriendlyUsageEntry[] = [];

    const pageItemMap = new Map<string, PageItemUsageGroup>();

    for (const usage of usages) {
        if (isSiteRole(usage.usageRoleKey)) {
            site.push({
                kind: 'site',
                itemLabel: usage.itemLabel,
                pageLabel: usage.pageLabel,
                sectionLabel: usage.sectionLabel,
                usageRoleKey: usage.usageRoleKey,
            });
            continue;
        }

        if (usage.usageRoleKey === 'USAGE_ROLE_PAGE_IMAGE') {
            pages.push({
                kind: 'page-thumbnail',
                pageLabel: usage.pageLabel,
            });
            continue;
        }

        if (isSectionDirectRole(usage.usageRoleKey)) {
            pages.push({
                kind: 'section-direct',
                pageLabel: usage.pageLabel,
                sectionLabel: usage.sectionLabel,
                usageRoleKey: usage.usageRoleKey,
                itemLabel: usage.itemLabel,
            });
            continue;
        }

        if (isPageItemRole(usage.usageRoleKey)) {
            const key = pageItemGroupKey(usage);
            const existing = pageItemMap.get(key);
            if (existing) {
                const locKey = `${usage.pageLabel}::${usage.sectionLabel}`;
                const hasLoc = existing.locations.some(
                    (loc) => `${loc.pageLabel}::${loc.sectionLabel}` === locKey
                );
                if (!hasLoc) {
                    existing.locations.push({
                        pageLabel: usage.pageLabel,
                        sectionLabel: usage.sectionLabel,
                    });
                }
            } else {
                pageItemMap.set(key, {
                    kind: 'page-item',
                    itemLabel: usage.itemLabel,
                    itemTypeKey: usage.itemTypeKey,
                    locations: [{ pageLabel: usage.pageLabel, sectionLabel: usage.sectionLabel }],
                });
            }
            continue;
        }

        if (isContentRole(usage.usageRoleKey)) {
            content.push({
                kind: 'content',
                itemLabel: usage.itemLabel,
                itemTypeKey: usage.itemTypeKey,
            });
        }
    }

    pageItemMap.forEach((group) => pages.push(group));

    const pageLocationCount = pages.reduce((count, entry) => {
        if (entry.kind === 'page-item') return count + entry.locations.length;
        return count + 1;
    }, 0);

    return {
        totalCount: usages.length,
        pages,
        content,
        site,
        pageLocationCount,
        contentCount: content.length,
        siteCount: site.length,
    };
};
