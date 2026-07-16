import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getAllListItems as graphGetAllListItems, type SPItem } from '../../../lib/graph/listItems';
import { getAllLists as graphGetAllLists } from '../../../lib/graph/listItems';
import { uploadFileToLibrary } from '../../../lib/graph/driveFiles';
import { fetchSharePointContentByUrl } from '../../../lib/graph/authenticatedContent';
import * as XLSX from 'xlsx';

import axios from 'axios';
import { zipSync } from "fflate";
import moment from 'moment';
import stylesBase from './DataBackupTool.module.scss';
import './custom.css';

/** Extended keys maintained alongside `SiteDataBackupTool.module.scss` / `.module.scss.ts` */
const styles = stylesBase as typeof stylesBase & {
    sectionHeadingRow: string;
    selectionToolbar: string;
    btnLink: string;
    toolbarSep: string;
    selectedHint: string;
    listCheckbox: string;
    listCardBody: string;
    progressSection: string;
    progressMeta: string;
    progressCounts: string;
    progressLabel: string;
    progressTrack: string;
    progressFill: string;
};
let DatabaseName = '';
let listTitles: any = [];
let ListTitleLength = 0;
const DATABASE_OPTIONS = [
    { label: 'HHHH Public DB (Staging)', value: 'STAGING_HHHH_PUBLIC_DB' },
    { label: 'Washington Public DB', value: 'HHHH_GRUENE_WASHINGTON' }
];
export default function SiteDataBackupTool(selectedProps: any) {
    let publicSiteAPI = 'https://event.hochhuth-consulting.de/'
    const [ListData, setListData] = useState<Item[]>([]);
    const [TimeSheetData, setTimeSheetData] = useState<Item[]>([]);
    // No SPFx WebPartContext in the standalone app anymore — the configured site (VITE_SP_HOSTNAME
    // + VITE_SP_SITE_PATH) is used instead. Kept as plain strings (not the async Graph site id)
    // since these are only used for cosmetic labels below; all data access now goes through Graph.
    let propsContext: any = selectedProps.Context;
    const configuredSiteUrl = `https://${(import.meta.env.VITE_SP_HOSTNAME as string) || ''}${(import.meta.env.VITE_SP_SITE_PATH as string) || ''}`;
    let SiteType = configuredSiteUrl.split('/').pop();
    let baseUrl = configuredSiteUrl;
    const [successMessage, setSuccessMessage] = useState(false);
    const [selectedFile, setselectedFile]: any = useState([]);
    const [showLoader, setshowLoader] = useState(false);
    const [listFilter, setListFilter] = useState('');
    const [selectedDatabase, setSelectedDatabase] = useState(DATABASE_OPTIONS[0].value);
    const [selectedListTitles, setSelectedListTitles] = useState<Set<string>>(new Set());
    const seenListTitlesRef = useRef<Set<string>>(new Set());
    const [syncProgress, setSyncProgress] = useState<{
        current: number;
        total: number;
        label?: string;
    } | null>(null);
    let Domain = selectedProps?.SPBackupConfigListUrl?.toLowerCase();
    let labelSiteName = '';
    if (Domain?.indexOf("sp") > -1) {
        labelSiteName = 'SP Site';
    }
    if (Domain?.indexOf("gmbh") > -1) {
        labelSiteName = 'GMBH Site';
    }
    let DomainUrl = Domain?.split('/sites/')[0];
    var listData: any[] = [];
    let timesheetData: any[] = [];
    interface Item {
        SiteUrl: string;
        List_x0020_Id: string;
        Site_x0020_Name: string;

        Title: string;
        Items: any[];
        [key: string]: any;
    }
    async function readFileAsArrayBuffer(file: any) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function (event: any) {
                resolve(event.target.result);
            };
            reader.onerror = function (event: any) {
                reject(event.error);
            };
            reader.readAsArrayBuffer(file);
        });
    }
    const handleFileChange = (event: any) => {
        const file = event.target.files[0];
        setselectedFile(file)
    };
    const uploadDocument = async () => {
        if (selectedFile !== undefined) {
            const libraryName = "Documents";
            let folderName = "DataBackup";

            if (selectedFile?.name?.toLowerCase().includes("timesheet")) {
                folderName = "TimesheetBackup";
            }

            const fileName = selectedFile?.name;
            try {
                const response = await uploadFileToLibrary(libraryName, folderName, fileName, selectedFile, true);
                console.log(response);
                setSuccessMessage(true);
            } catch (error) {
                console.error(error);
            }
        }
    };
    const isItemExists = (array: Item[], key: string, value: string) => {
        for (let i = 0; i < array.length; i++) {
            if (array[i][key] === value) {
                return i;
            }
        }
        return -1; // Return -1 if the item is not found (similar to findIndex)
    };


    var lookupColums: any[]
    const DataBackup = async (Values: any) => {
        if (Values !== 'MySql') return;
        const selectedTables = ListData.filter((item) => selectedListTitles.has(item.Title));
        if (selectedTables.length === 0) {
            alert('Please select at least one list to sync.');
            return;
        }
        try {
            setSyncProgress({ current: 0, total: 1, label: 'Starting…' });
            await postDataToServer(
                selectedTables,
                'postData',
                publicSiteAPI,
                selectedDatabase,
                (current, total, label) => setSyncProgress({ current, total, label })
            );
        } catch (err) {
            console.error(err);
            alert('Sync failed. See console for details.');
        } finally {
            setSyncProgress(null);
        }
    };

    const toggleListSelection = (title: string) => {
        setSelectedListTitles((prev: Set<string>) => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
        });
    };

    const selectAllLists = () => {
        setSelectedListTitles(new Set(ListData.map((i) => i.Title)));
    };

    const clearListSelection = () => {
        setSelectedListTitles(new Set());
    };

    const TimesheetBackup = async (p0: string) => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-based
        const currentYear = now.getFullYear();
        const monthName = now.toLocaleString("default", { month: "long" });
        const sheetName = `Timesheet-Backup-${monthName}-${currentYear}.xlsx`;

        const workbook = XLSX.utils.book_new();

        // filter only timesheet lists
        let sheetCounter = 1;
        // const timesheetLists = TimeSheetData.filter(
        //     (site) =>
        //         site.Title && site.Title.toLowerCase().indexOf("timesheet") !== -1
        // );

        const formatDate = (dateStr: any) => {
            return dateStr ? moment(dateStr).format("DD/MM/YYYY") : "";
        };

        TimeSheetData.forEach((site) => {
            const ExcelData: any[] = [];

            site.Items.forEach((item) => {
                if (!item.AdditionalTimeEntry) return;

                try {
                    const parsed = JSON.parse(item.AdditionalTimeEntry);
                    const entries = Array.isArray(parsed) ? parsed : [parsed];

                    entries.forEach((entry: any) => {
                        if (entry?.TaskDate) {
                            const mTask = moment(entry.TaskDate, "DD/MM/YYYY");
                            if (
                                mTask.isValid() &&
                                mTask.month() + 1 === currentMonth &&
                                mTask.year() === currentYear
                            ) {

                                let siteType = "";
                                let siteTypeValue = "";

                                Object.keys(item).forEach((key) => {
                                    const match = key.match(/^Task(.*)Id$/);
                                    if (match && item[key]) {
                                        siteType = match[1];
                                        siteTypeValue = item[key];
                                    }
                                });

                                ExcelData.push({
                                    Title: item.Title || "",
                                    SiteType: siteType,
                                    WorkingDate: entry?.WorkingDate || "",
                                    AuthorName: entry?.AuthorName || "",
                                    AuthorId: entry?.AuthorId || "",
                                    Status: entry?.Status || "",
                                    ID: entry?.ID || "",
                                    MainParentId: entry?.MainParentId || "",
                                    ParentID: entry?.ParentID || "",
                                    TaskTime: entry?.TaskTime || "",
                                    TaskTimeInMin: entry?.TaskTimeInMin || "",
                                    TaskDate: entry?.TaskDate || "",
                                    Description: entry?.Description || "",
                                });
                            }
                        }
                    });
                } catch (err) {
                    console.error("Invalid JSON in AdditionalTimeEntry", err);
                }
            });

            if (ExcelData.length > 0) {
                const worksheet = XLSX.utils.json_to_sheet(ExcelData);
                const sheetLabel = `Timesheet_${monthName}_${currentYear}_${sheetCounter++}`;

                XLSX.utils.book_append_sheet(workbook, worksheet, sheetLabel);

            }
        });

        const excelBuffer = XLSX.write(workbook, {
            bookType: "xlsx",
            type: "buffer",
        });
        const excelData = new Blob([excelBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const downloadLink = document.createElement("a");
        downloadLink.href = URL.createObjectURL(excelData);
        downloadLink.download = sheetName;
        downloadLink.click();
    };
    const TimesheetBackuptillnow = async () => {
        const MAX_ROWS = 50000;
        const timestamp = moment().format("YYYYMMDD-HHmmss");
        const zipFileName = `Timesheet-Backup-All.zip`;


        let sheetCounter = 1;
        // const timesheetLists = ListData.filter(
        //     (site) =>
        //         site.Title && site.Title.toLowerCase().indexOf("timesheet") !== -1
        // );
        const zipFiles: Record<string, Uint8Array> = {};

        for (const site of TimeSheetData) {
            const ExcelData: any[] = [];

            site.Items.forEach((item: any) => {
                if (!item.Created) return;

                if (item.AdditionalTimeEntry) {
                    try {
                        const parsed = JSON.parse(item.AdditionalTimeEntry);
                        const entries = Array.isArray(parsed) ? parsed : [parsed];

                        let siteType = "";
                        Object.keys(item).forEach((key) => {
                            const match = key.match(/^Task(.*)Id$/);
                            if (match && item[key]) {
                                siteType = match[1];
                            }
                        });

                        entries.forEach((entry: any) => {
                            const taskDate = entry?.TaskDate ? new Date(entry.TaskDate) : null;
                            let year: string | number = "";
                            let month: string = " ";

                            let formattedTaskDate = ""; // new variable for Excel

                            if (taskDate && !isNaN(taskDate.getTime())) {
                                year = taskDate.getFullYear();
                                month = taskDate.toLocaleString("default", { month: "short" });

                                // Format TaskDate as dd/mm/yyyy without padStart
                                const day = taskDate.getDate() < 10 ? "0" + taskDate.getDate() : taskDate.getDate();
                                const mon = taskDate.getMonth() + 1 < 10 ? "0" + (taskDate.getMonth() + 1) : taskDate.getMonth() + 1;
                                const yr = taskDate.getFullYear();
                                formattedTaskDate = `${day}/${mon}/${yr}`;
                            }

                            ExcelData.push({
                                Year: year,
                                Month: month,
                                Title: item.Title || "",
                                SiteType: siteType,
                                WorkingDate: entry?.WorkingDate || "",
                                AuthorName: entry?.AuthorName || "",
                                AuthorId: entry?.AuthorId || "",
                                Status: entry?.Status || "",
                                ID: entry?.ID || "",
                                MainParentId: entry?.MainParentId || "",
                                ParentID: entry?.ParentID || "",
                                TaskTime: entry?.TaskTime || "",
                                TaskTimeInMin: entry?.TaskTimeInMin || "",
                                TaskDate: formattedTaskDate, // use formatted date here
                                Description: entry?.Description || "",
                            });
                        });


                    } catch (err) {
                        console.error("Invalid JSON in AdditionalTimeEntry:", err);
                    }
                }
            });

            // Group by year
            const dataByYear = ExcelData.reduce((acc, row) => {
                const year = row.Year;
                if (!acc[year]) acc[year] = [];
                acc[year].push(row);
                return acc;
            }, {} as Record<string, any[]>);

            // Create yearly workbooks
            for (const year in dataByYear) {
                const workbook = XLSX.utils.book_new();

                // Group by month
                const dataByMonth = dataByYear[year].reduce((acc: any, row: any) => {
                    const month = row.Month;
                    if (!acc[month]) acc[month] = [];
                    acc[month].push(row);
                    return acc;
                }, {} as Record<string, any[]>);


                for (const month in dataByMonth) {
                    const monthData = dataByMonth[month].map(({ Year, Month: _Month, ...rest }: any) => rest);
                    for (let i = 0; i < monthData.length; i += MAX_ROWS) {
                        const chunk = monthData.slice(i, i + MAX_ROWS);
                        const worksheet = XLSX.utils.json_to_sheet(chunk);

                        // Add _part_X if chunked
                        const sheetName = monthData.length > MAX_ROWS ? `${month}_part_${Math.floor(i / MAX_ROWS) + 1}` : month;

                        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
                    }
                }

                // Write yearly workbook
                const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
                const fileName = `Timesheet_${year}_${sheetCounter++}.xlsx`;
                zipFiles[fileName] = new Uint8Array(excelBuffer);
            }
        }

        // Create zip
        const zipData = zipSync(zipFiles);
        const zipBlobData = new Uint8Array(zipData.byteLength);
        zipBlobData.set(zipData);
        const blob = new Blob([zipBlobData], { type: "application/zip" });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = zipFileName;
        link.click();
    };




    // centralized function for publishing items to the public site

    const postDataToServer = async (
        tablesData: any[],
        type: any,
        publicSiteAPI?: any,
        Values?: any,
        onProgress?: (current: number, total: number, label?: string) => void
    ) => {
        DatabaseName = Values || DATABASE_OPTIONS[0].value;
        const serverUrl = `${publicSiteAPI}HHHHPUBLICAPI/LargeBackupcreateTableColumn.php`;
        const sharePointBaseUrl = `${window.location.origin}/`;

        const tablesToSync = tablesData.filter(
            (t) => t.Items && t.Items.length > 0 && t.Title
        );
        const totalSteps = Math.max(1, tablesToSync.length + 1);
        let completed = 0;
        onProgress?.(0, totalSteps, 'Starting…');

        let attachmentList: any = {
            Title: 'AttachmentList',
            Items: []
        };

        // Helper function for chunking
        const chunkArray = (arr: any[], size: number) => {
            let result:any[] = [];
            for (let i = 0; i < arr.length; i += size) {
                result.push(arr.slice(i, i + size));
            }
            return result;
        };

        for (const table of tablesData) {
            const { Title, Items } = table;

            if (Items && Items.length > 0 && Title) {
                const postDataArray = Items.map((item: any) => {
                    if ((Title === 'TaskTimeSheetListNew' || Title === 'TasksTimesheet2' || Title == 'TaskTimesheet') && (item.AdditionalTimeEntry == null || item.AdditionalTimeEntry == undefined || item.AdditionalTimeEntry == '')) {
                        return null; // skip item
                    }
                    const newItem: any = {};
                    for (const key in item) {
                        if (Object.prototype.hasOwnProperty.call(item, key)) {
                            if (key === 'ID') continue;
                            if (Title === 'TopNavigation' && key === 'ParentId') continue;

                            const value = item[key];
                            if (key === 'Id') {
                                newItem[key] = value != null ? parseInt(value) : null;
                            } else if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
                                newItem[key] = JSON.stringify(value);
                            } else if (value == null || value === 0 || value == '[]') {
                                newItem[key] = '';
                            } else {
                                newItem[key] = String(value);
                            }
                        }
                    }

                    // Extract ImageUrls for AttachmentList
                    if (item?.BasicImageInfo) {
                        try {
                            const parsedInfo = Array.isArray(item.BasicImageInfo)
                                ? item.BasicImageInfo
                                : JSON.parse(item.BasicImageInfo);

                            if (Array.isArray(parsedInfo) && parsedInfo.length > 0) {
                                const imageUrls = parsedInfo
                                    .filter((imgObj: any) => imgObj?.ImageUrl)
                                    .map((imgObj: any) => {
                                        const url = String(imgObj?.ImageUrl);
                                        attachmentList.Items.push({
                                            ImageUrl: url,
                                            PublicImageUrl: url.replace(sharePointBaseUrl, publicSiteAPI),
                                            ImageName: imgObj?.ImageName || '',
                                            UserName: imgObj?.UserName || '',
                                            UploadeDate: imgObj?.UploadeDate || '',
                                            UserImage: imgObj?.UserImage || ''
                                        });
                                        return url;
                                    });

                                if (imageUrls.length > 0) newItem.AttachmentUrl = imageUrls;
                            }
                        } catch (error) {
                            console.warn("Invalid BasicImageInfo format or parse error:", error);
                        }
                    }

                    // Add publicSiteUrl for Documents and Images
                    if ((Title === 'Documents' || Title === 'SiteCollectionImages' || Title === 'Images' || Title === 'Images1') && item?.EncodedAbsUrl) {
                        newItem.publicSiteUrl = item.EncodedAbsUrl.replace(sharePointBaseUrl, publicSiteAPI);
                    }

                    return newItem;
                }).filter((item: any) => item !== null); // remove skipped item;

                // Split into chunks if more than 15000
                const chunks = postDataArray.length > 15000 ? chunkArray(postDataArray, 15000) : [postDataArray];

                for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
                    const chunk = chunks[chunkIndex];

                    const postData = {
                        data: chunk,
                        tableName: Title,
                        ApiType: type,
                        dbName: DatabaseName,
                        isFirstChunk: chunkIndex === 0
                    };

                    try {
                        const response = await axios.post(serverUrl, postData);
                        if (response.status === 200) {
                            let siteURL: any = configuredSiteUrl;
                            if (Title === 'SiteCollectionImages' || Title === 'PublishingImages' || Title === 'Images' || Title === 'Images1') {
                                for (const item of chunk) {
                                    if (item.File_x0020_Type || item.FSObjType === 0) {
                                        await replaceImgUrl(item?.EncodedAbsUrl, publicSiteAPI, DatabaseName);
                                    }
                                }
                            } else if (Title === 'Documents') {
                                for (const item of chunk) {
                                    await uploadDocToPublicSite(item, siteURL, publicSiteAPI, DatabaseName);
                                }
                            }
                        } else {
                            console.error(`Error syncing table ${Title}:`, response.statusText);
                        }
                    } catch (error) {
                        console.error(`Exception during sync for table ${Title}:`, error);
                    }
                }
                completed++;
                onProgress?.(completed, totalSteps, Title);
            }
        }

        // Send AttachmentList in chunks
        if (attachmentList?.Items?.length > 0) {
            const chunks = attachmentList.Items.length > 15000 ? chunkArray(attachmentList.Items, 15000) : [attachmentList.Items];

            for (let chunk of chunks) {
                try {
                    const response = await axios.post(serverUrl, {
                        data: chunk,
                        tableName: 'AttachmentList',
                        ApiType: type,
                        dbName: DatabaseName
                    });

                    if (response.status === 200) {
                        await Promise.all(
                            chunk.map(async (item: any) => {
                                if (item?.ImageUrl) {
                                    await replaceImgUrl(item?.ImageUrl, publicSiteAPI, DatabaseName);
                                }
                            })
                        );
                    } else {
                        console.error(`Error syncing AttachmentList:`, response.statusText);
                    }
                } catch (error) {
                    console.error(`Exception during sync for AttachmentList:`, error);
                }
            }
        }

        completed++;
        onProgress?.(
            completed,
            totalSteps,
            attachmentList?.Items?.length ? 'AttachmentList' : 'Finalizing…'
        );

        alert("Data Backup Completed Successfully");
        return "All tables processed.";
    };





    //#region function used to convert blob To File
    const blobToFile = (blob: any, filename: any, type = "") => {
        return new File([blob], filename, { type });
    }
    //#endregion blobToFile



    //#endregion replaceImgUrl


    const uploadDocToPublicSite = async (file: any, siteUrl: string, publicSiteAPI?: any, DatabaseName?: any) => {
        try {
            {
                // Fetch the file's binary content using the signed-in user's Microsoft Graph token
                // (replaces the old PnP `getFileByServerRelativePath(...).getBlob()` call).
                const blob: Blob = await fetchSharePointContentByUrl(file.EncodedAbsUrl || `${file.FileDirRef}/${file.FileLeafRef}`);
                const myFile = blobToFile(blob, file?.FileLeafRef.replace(/%20/g, "-"));

                // Full decoded file URL (or fallback)
                const fullUrl = decodeURIComponent(file.EncodedAbsUrl || `${file.FileDirRef}/${file.FileLeafRef}`);

                // Extract path after ".com/"
                const relativePath = fullUrl.split(".com/")[1]; // e.g. "sites/GMBH/SP/SiteCollectionImages/Tiles/Permission/Owners.png"

                // Remove the filename from path
                const pathParts = relativePath.split("/");
                pathParts.pop(); // remove "Owners.png" or any file

                // Sanitize folder path (replace only spaces, not slashes)
                const sanitizedFolder = pathParts
                    .map(part => part.replace(/ /g, "-"))
                    .join("/"); // e.g., "sites/GMBH/SP/SiteCollectionImages/Tiles/Permission"

                // Sanitize filename without extension
                const fileNameWithoutExt = file?.FileLeafRef?.split('.')[0].replace(/ /g, "-");

                // Prepare FormData
                const formdata = new FormData();
                formdata.append("pageid", '2');
                formdata.append("folder", sanitizedFolder); // Nested folder path
                formdata.append("filename", fileNameWithoutExt); // File name without extension
                formdata.append("dbName", DatabaseName); // Pass dynamic DB
                formdata.append("file", myFile, file?.FileLeafRef); // Original file name with extension

                // Send to PHP API
                const requestOptions = {
                    method: "POST",
                    body: formdata,
                    redirect: "follow" as RequestRedirect
                };

                await fetch(`${publicSiteAPI}HHHHPUBLICAPI/uploadsDocuments.php`, requestOptions)
                    .then((response) => response.text())
                    .then((result) => console.log(`Upload Result:`, result))
                    .catch((error) => console.error(`Upload Error:`, error));
            }
        } catch (e) {
            console.error("Error in uploading document:", e);
        }
    };

    const replaceImgUrl = (Item: any, PublicSiteAPI: any, DatabaseName: any) => {
        let syncImagesArray: any = [];

        const regexFirst = /\/\/sites/gi;
        Item = Item?.replace(regexFirst, '/sites');

        // Create a new image object
        let newImageObj: any = {
            sharepointUrl: Item
        };

        // Replace %20 with -
        newImageObj.PublicSiteUrl = Item?.replace(/%20/g, "-");

        // Extract everything after /sites/ for folder
        const sitesIndex = Item.indexOf("/sites/");
        if (sitesIndex !== -1) {
            const pathAfterSites = Item.substring(sitesIndex + 7); // skip "/sites/"
            const parts = pathAfterSites.split('/');
            const fileFullName = parts.pop(); // last part is file name

            const cleanedFileName = fileFullName
                ?.replace(/ /g, '-')
                ?.replace(/(\d+)(\.\d+)/, (match: any, intPart: any) => intPart); // remove decimal

            const cleanedFolders = parts.map((p: any) => p?.replace(/ /g, '-')).join('/');

            const extension = cleanedFileName.split('.')[1];
            const fileNameOnly = cleanedFileName.split('.')[0];

            Item = `${PublicSiteAPI}sites/${cleanedFolders}/${cleanedFileName}`;

            newImageObj.FolderName = cleanedFolders;
            newImageObj.FileName = fileNameOnly;
            newImageObj.extension = extension;
            newImageObj.FullName = cleanedFileName;
            newImageObj.listName = 'sites'; // <- now base folder is always 'sites'
        }

        syncImagesArray?.push(newImageObj);

        if (syncImagesArray?.length > 0) {
            syncImagesArray?.map((image: any) => {
                downloadSharePointImage(image, DatabaseName);
            });
        }

        return Item;
    };


    const downloadSharePointImage = async (image: any, DatabaseName: any) => {
        try {
            // Downloads the SharePoint-hosted image using the signed-in user's Microsoft Graph
            // token instead of an anonymous/cookie-based fetch (SP token requirement).
            const blob = await fetchSharePointContentByUrl(image?.sharepointUrl);
            var formdata = new FormData();
            const myFile = blobToFile(blob, image?.FullName.replace(/%20/g, "-"));

            formdata.append("pageid", "1");
            formdata.append("folder", image?.FolderName);
            formdata.append("filename", image?.FileName.replace(/%20/g, "-"));
            formdata.append("image", myFile);
            formdata.append("dbName", DatabaseName); // Pass desired DB here
            formdata.append("baseFolder", image?.listName);

            var requestOptions: any = {
                method: 'POST',
                body: formdata,
                redirect: 'follow'
            };
            await fetch(`${publicSiteAPI}HHHHPUBLICAPI/uploadsImage.php`, requestOptions)
                .then(response => response.text())
                .then((result) => console.log(`Image uploaded successfully: ${result}`))
                .catch((error) => {
                    console.log(error, `Error in downloadSharePointImage: ${error.message}`);

                });
        } catch (error: any) {
            console.log(error, `Error in downloadSharePointImage: ${error.message}`);
        }
    }
    //#endregion downloadSharePointImage

    // Document/picture libraries need the driveItem facet expanded to recover file
    // properties (FileLeafRef, FileDirRef, EncodedAbsUrl, etc.) via Graph.
    const DOCUMENT_LIBRARY_TITLES = new Set(['SiteCollectionImages', 'PublishingImages', 'Images', 'Images1', 'Documents']);

    const getAllListNamesREST = async () => {
        setshowLoader(true);
        try {
            const lists = await graphGetAllLists();
            listTitles = lists
                .filter((list: any) => !list.Hidden && list.Title !== 'SH' && list.Title !== 'SP Online' && list.Title !== 'SmartAdmin' && (list?.Title?.toLowerCase().indexOf('test') === -1))
                .map((list: any) => list.Title);
            console.log("List Names:", listTitles);
            ListTitleLength = listTitles.length
            LoadQueryBasedOnLookup()
            return listTitles;
        } catch (error) {
            console.error("Error fetching list names:", error);
            setshowLoader(false);
            return [];
        }
    };
    const LoadQueryBasedOnLookup = async () => {
        let count = 0;
        await Promise.all(listTitles.map(async (listTitle: string) => {
            try {
                const withDriveItem = DOCUMENT_LIBRARY_TITLES.has(listTitle);
                let items = await graphGetAllListItems(listTitle, withDriveItem);
                if (listTitle === 'Documents') {
                    items = items.filter((i: any) => i.FSObjType === 0);
                }
                items.sort((a: any, b: any) => (a.Id ?? 0) - (b.Id ?? 0));
                listData.push({ Title: listTitle, Items: items });
                if (items.length > 0)
                    count++;
                else {
                    ListTitleLength--;
                }
            } catch (error) {
                setshowLoader(false);
                console.error(`Error loading list: ${listTitle}`, error);
            }
        }));
        if (count === ListTitleLength) {
            setshowLoader(false);
            console.log("All lists fetched");
            setListData([...listData]); // Assuming this is a React state setter
            setTimeSheetData([...timesheetData]);
        }
    };
    const QueryBasedOnLookup: any = [];
    // const GetBackupConfig = async () => {
    //     try {
    //         let web = new Web(selectedProps?.SPBackupConfigListUrl);
    //         const LoadBackups = await web.lists.getById(selectedProps?.SPBackupConfigListID).items.getAll();
    //         if (LoadBackups !== undefined) {
    //             LoadBackups.forEach((element: any) => {
    //                 if (element.Backup === true && element.Columns !== '') {
    //                     QueryBasedOnLookup.push({
    //                         ...element,
    //                     });
    //                 }
    //             });
    //             LoadQueryBasedOnLookup();
    //         }
    //     } catch (error) {
    //         console.error(error);
    //     }
    // };
    // const LoadQueryBasedOnLookup = async () => {
    //     var count = 0;
    //     await Promise.all(QueryBasedOnLookup.map(async (item: Item) => {

    //         try {
    //             let web = new Web(DomainUrl + item.SiteUrl);
    //             const items = await web.lists.getById(item.List_x0020_Id).items.select(item.Query).getAll();
    //             console.log(items);
    //             const index = isItemExists(listData, 'Site', item.Site_x0020_Name);
    //             if (index === -1) {
    //                 listData.push({ pageName: 'BackupConfig', SiteUrl: item.SiteUrl, List_x0020_Id: item.List_x0020_Id, Site_x0020_Name: item.Site_x0020_Name, Title: item.List_x0020_Name, Query: item.Query, Items: items });
    //                 count++
    //             }

    //         } catch (error) {
    //             console.log(item.List_x0020_Name);
    //             console.error(error);
    //         }
    //     }));
    //     if (count === QueryBasedOnLookup.length)
    //         setListData(listData);
    // }
    useEffect(() => {
        //GetBackupConfig()
        getAllListNamesREST()
    }, [0])

    useEffect(() => {
        setSelectedListTitles((prev: Set<string>) => {
            const next = new Set(prev);
            ListData.forEach((item) => {
                const t = item.Title;
                if (!seenListTitlesRef.current.has(t)) {
                    seenListTitlesRef.current.add(t);
                    next.add(t);
                }
            });
            const valid = new Set(ListData.map((i) => i.Title));
            Array.from(next as any).forEach((t: any) => {
                if (!valid.has(t)) next.delete(t);
            });
            Array.from(seenListTitlesRef.current as any).forEach((t: any) => {
                if (!valid.has(t as any)) seenListTitlesRef.current.delete(t as any);
            });
            return next;
        });
    }, [ListData]);
    const callBackData = useCallback((elem: any, getSelectedRowModel: any, ShowingData: any) => {
    }, []);

    const filteredListData = useMemo(() => {
        const q = listFilter.trim().toLowerCase();
        if (!q) return ListData;
        return ListData.filter((item: Item) =>
            String(item.Title || '').toLowerCase().includes(q)
        );
    }, [ListData, listFilter]);

    const totalLists = ListData.length;
    const totalItems = useMemo(
        () => ListData.reduce((acc, item) => acc + (item.Items?.length ?? 0), 0),
        [ListData]
    );
    const selectedListCount = useMemo(
        () => ListData.filter((item) => selectedListTitles.has(item.Title)).length,
        [ListData, selectedListTitles]
    );
    return (
        <div className={styles.root}>
            <header className={styles.header}>
                <div className={styles.titleBlock}>
                    <h2 className={styles.title}>Site Data Backup</h2>
                    <p className={styles.subtitle}>
                        Lists included in backup and sync for this site
                    </p>
                </div>
                {labelSiteName ? (
                    <span className={styles.siteBadge}>{labelSiteName}</span>
                ) : null}
            </header>

            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{totalLists}</span>
                    <div className={styles.statLabel}>Lists</div>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{totalItems}</span>
                    <div className={styles.statLabel}>Total items</div>
                </div>
            </div>

            <section className={styles.section} aria-labelledby="backup-lists-heading">
                <div className={styles.sectionHeadingRow}>
                    <h3 id="backup-lists-heading" className={styles.sectionTitle}>
                        Included lists
                    </h3>
                    <div className={styles.selectionToolbar}>
                        <button
                            type="button"
                            className={styles.btnLink}
                            onClick={selectAllLists}
                            disabled={ListData.length === 0 || syncProgress !== null}
                        >
                            Select all
                        </button>
                        <span className={styles.toolbarSep} aria-hidden="true">
                            |
                        </span>
                        <button
                            type="button"
                            className={styles.btnLink}
                            onClick={clearListSelection}
                            disabled={ListData.length === 0 || syncProgress !== null}
                        >
                            Clear
                        </button>
                        <span className={styles.selectedHint}>
                            {selectedListCount} selected
                        </span>
                    </div>
                </div>
                <div className={styles.searchWrap}>
                    <input
                        type="search"
                        className={styles.searchInput}
                        placeholder="Filter lists…"
                        value={listFilter}
                        onChange={(e) => setListFilter(e.target.value)}
                        aria-label="Filter lists"
                    />
                </div>
                {filteredListData.length === 0 ? (
                    <div className={styles.emptyState}>
                        {listFilter
                            ? 'No lists match your filter.'
                            : showLoader
                                ? 'Loading lists…'
                                : 'No list data loaded yet.'}
                    </div>
                ) : (
                    <div className={styles.listGrid} role="list">
                        {filteredListData.map((item: Item, index: number) => {
                            const count = item.Items?.length ?? 0;
                            return (
                                <div
                                    key={`list-${item.Title}-${index}`}
                                    className={styles.listCard}
                                    role="listitem"
                                >
                                    <input
                                        type="checkbox"
                                        className={styles.listCheckbox}
                                        checked={selectedListTitles.has(item.Title)}
                                        onChange={() => toggleListSelection(item.Title)}
                                        disabled={syncProgress !== null}
                                        aria-label={`Include list ${item.Title} in sync`}
                                    />
                                    <div className={styles.listCardBody}>
                                        <span className={styles.listName}>{item.Title}</span>
                                        <span
                                            className={`${styles.countBadge} ${count === 0 ? styles.countBadgeZero : ''}`}
                                            title={`${count} items`}
                                        >
                                            {count}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {TimeSheetData.length > 0 ? (
                <section className={styles.timesheetSection} aria-labelledby="timesheet-heading">
                    <h4 id="timesheet-heading" className={styles.timesheetTitle}>
                        Timesheet-related lists
                    </h4>
                    <div className={styles.listGrid} role="list">
                        {TimeSheetData.map((ts: Item, index: number) => (
                            <div
                                key={`ts-${ts.Title}-${index}`}
                                className={styles.listCard}
                                role="listitem"
                            >
                                <span className={styles.listName}>{ts.Title}</span>
                                <span className={styles.countBadge}>{ts.Items?.length ?? 0}</span>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null}

            <footer className={styles.toolbar}>
                <div className={styles.actions}>
                    <div className={styles.selectGroup}>
                        <label className={styles.selectLabel} htmlFor="database-select">
                            Database
                        </label>
                        <select
                            id="database-select"
                            className={styles.selectInput}
                            value={selectedDatabase}
                            onChange={(e) => setSelectedDatabase(e.target.value)}
                        >
                            {DATABASE_OPTIONS.map((db) => (
                                <option key={db.value} value={db.value}>
                                    {db.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() => DataBackup('MySql')}
                        disabled={
                            syncProgress !== null ||
                            selectedListCount === 0
                        }
                    >
                        Sync to MySQL database
                    </button>
                </div>
            </footer>
            {syncProgress ? (
                <div className={styles.progressSection} aria-live="polite">
                    <div className={styles.progressMeta}>
                        <span className={styles.progressCounts}>
                            Step {syncProgress.current} of {syncProgress.total}
                        </span>
                        {syncProgress.label ? (
                            <span className={styles.progressLabel}>{syncProgress.label}</span>
                        ) : null}
                    </div>
                    <div
                        className={styles.progressTrack}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={syncProgress.total}
                        aria-valuenow={syncProgress.current}
                        aria-label="Sync progress"
                    >
                        <div
                            className={styles.progressFill}
                            style={{
                                width: `${Math.min(
                                    100,
                                    (syncProgress.current / Math.max(1, syncProgress.total)) * 100
                                )}%`
                            }}
                        />
                    </div>
                </div>
            ) : null}
            {showLoader ? "Loading....." : null}
        </div>
    )
}
