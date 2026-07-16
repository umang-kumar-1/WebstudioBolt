/**
 * SharePoint List Field Inspector Utility
 * 
 * This file contains helper functions to inspect SharePoint list schemas
 * and log field information to the console for debugging purposes.
 */

import { getListFields, getAllLists } from './SPService';

/**
 * Logs all fields from a specific SharePoint list to the console
 * @param listTitle - The title of the SharePoint list
 */
export const inspectListFields = async (listTitle: string): Promise<void> => {
    try {
        console.log(`\n📋 Inspecting fields for list: ${listTitle}`);
        console.log('='.repeat(60));

        const fields = await getListFields(listTitle);

        if (fields.length === 0) {
            console.log('⚠️ No visible fields found in this list.');
            return;
        }

        console.log(`\nFound ${fields.length} fields:\n`);

        fields.forEach((field: any, index: number) => {
            console.log(`${index + 1}. ${field.Title}`);
            console.log(`   - Internal Name: ${field.InternalName}`);
            console.log(`   - Type: ${field.TypeAsString}`);
            console.log(`   - Required: ${field.Required ? 'Yes' : 'No'}`);
            console.log(`   - Read Only: ${field.ReadOnlyField ? 'Yes' : 'No'}`);
            if (field.Description) {
                console.log(`   - Description: ${field.Description}`);
            }
            console.log('');
        });

        console.log('='.repeat(60));
    } catch (error) {
        console.error(`❌ Error inspecting fields for list "${listTitle}":`, error);
    }
};

/**
 * Logs all available SharePoint lists in the current web
 */
export const inspectAllLists = async (): Promise<void> => {
    try {
        console.log('\n📚 Inspecting all SharePoint lists');
        console.log('='.repeat(60));

        const lists = await getAllLists();

        if (lists.length === 0) {
            console.log('⚠️ No lists found.');
            return;
        }

        console.log(`\nFound ${lists.length} lists:\n`);

        lists.forEach((list: any, index: number) => {
            console.log(`${index + 1}. ${list.Title}`);
            console.log(`   - Item Count: ${list.ItemCount}`);
            console.log(`   - Base Template: ${list.BaseTemplate}`);
            if (list.Description) {
                console.log(`   - Description: ${list.Description}`);
            }
            console.log('');
        });

        console.log('='.repeat(60));
    } catch (error) {
        console.error('❌ Error inspecting lists:', error);
    }
};

/**
 * Inspects all Web Studio related lists and their fields
 */
export const inspectWebStudioLists = async (): Promise<void> => {
    const webStudioLists = [
        'SmartPages',
        'Containers',
        'TopNavigation',
        'News',
        'Documents',
        'Images',
        'GlobalSettings',
        'TranslationDictionary',
        'ContactQueries'
    ];

    console.log('\n🔍 Web Studio Lists Field Inspector');
    console.log('='.repeat(60));
    console.log(`Inspecting ${webStudioLists.length} Web Studio lists...\n`);

    for (const listTitle of webStudioLists) {
        await inspectListFields(listTitle);
        console.log('\n'); // Add spacing between lists
    }

    console.log('✅ Inspection complete!');
};

/**
 * Export field information as a structured object
 * Useful for generating TypeScript interfaces or documentation
 */
export const exportListFieldsAsObject = async (listTitle: string): Promise<Record<string, any>> => {
    try {
        const fields = await getListFields(listTitle);

        const fieldMap: Record<string, any> = {};

        fields.forEach((field: any) => {
            fieldMap[field.InternalName] = {
                displayName: field.Title,
                type: field.TypeAsString,
                required: field.Required,
                readOnly: field.ReadOnlyField,
                description: field.Description || ''
            };
        });

        return fieldMap;
    } catch (error) {
        console.error(`Error exporting fields for list "${listTitle}":`, error);
        return {};
    }
};
