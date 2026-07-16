import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore, getTranslation } from '../../store';
import { getNestedPortalZFromStore } from '../../utils/modalZIndex';
import { GenericModal, TabButton, EditTrigger } from './SharedModals';
import JoditRichTextEditor from '../JoditEditor';
import { PermissionGroup, PermissionUser, LanguageCode } from '../../types';
import { handleRemoveMember, createSPGroup, resolvePermissionUserByEmail, searchPermissionUsers } from '../../services/SPService';
import {
    X, Users, UserPlus, UserCheck, Search, ChevronDown,
    ArrowRight, Plus, User, Check, Settings, Trash2,
    Shield, Eye
} from 'lucide-react';
import { sortWebStudioPermissionGroups } from '../../utils/templatePermissions';
import TooltipMenu from '../common/TooltipMenu';

/** Nested portal layers for permission sub-modals (must increase with depth). */
const PERM_NESTED_LAYER = {
    CREATE_GROUP: 0,
    GROUP_DETAIL: 20,
    CHECK_PERMISSION: 30,
    ADD_MEMBER: 50,
} as const;

// --- CHILD MODAL: CREATE NEW GROUP ---
const CreateGroupModal = ({ onClose }: { onClose: () => void }) => {
    const { createPermissionGroup, currentLanguage } = useStore();
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!name) return;
        setIsSaving(true);
        try {
            const newGroupData = await createSPGroup(name, desc);
            const newGroup: PermissionGroup = {
                id: String(newGroupData.Id),
                name: name,
                description: desc,
                type: 'Custom',
                memberIds: []
            };
            createPermissionGroup(newGroup);
            onClose();
        } catch (error) {
            console.error("Error creating group:", error);
            // Fallback
            const newGroup: PermissionGroup = {
                id: `g_${Date.now()}`,
                name: name,
                description: desc,
                type: 'Custom',
                memberIds: []
            };
            createPermissionGroup(newGroup);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: getNestedPortalZFromStore(PERM_NESTED_LAYER.CREATE_GROUP) }}>
            <div className="bg-white w-[600px] shadow-2xl rounded-sm border border-gray-300 flex flex-col h-[85vh] min-h-[85vh] max-h-[85vh]">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <h3 className="text-xl font-bold text-[var(--primary-color)]">
                        {getTranslation('TITLE_CREATE_GROUP', currentLanguage)}
                        <EditTrigger labelKey="TITLE_CREATE_GROUP" className="ml-2" />
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <TooltipMenu ComponentId={'16313'} />
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="p-8 space-y-6 overflow-y-auto flex-1">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                            {getTranslation('LABEL_GROUP_NAME', currentLanguage)} <span className="text-red-500">*</span>
                            <EditTrigger labelKey="LABEL_GROUP_NAME" className="ml-2" />
                        </label>
                        <input
                            className="w-full border border-gray-300 p-2.5 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none rounded-sm transition-shadow focus:shadow-inner"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={getTranslation('LABEL_GROUP_NAME', currentLanguage)}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                            {getTranslation('LABEL_DESCRIPTION', currentLanguage)}
                            <EditTrigger labelKey="LABEL_DESCRIPTION" className="ml-2" />
                        </label>
                        <JoditRichTextEditor
                            value={desc}
                            onChange={(val: string) => setDesc(val)}
                            placeholder={getTranslation('LABEL_DESCRIPTION', currentLanguage)}
                            height={180}
                        />
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                    <button type="button" onClick={onClose} disabled={isSaving} className="btn-secondary inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {getTranslation('BTN_CANCEL', currentLanguage)}
                    </button>
                    <button type="button" onClick={handleSave} disabled={isSaving || !name} className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-90">
                        {isSaving ? getTranslation('MSG_TRANSLATING', currentLanguage) : getTranslation('BTN_SAVE_GROUP', currentLanguage)}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- CHILD MODAL: ADD MEMBER ---
const AddMemberModal = ({ groupName, groupId, onClose }: { groupName: string, groupId: string, onClose: () => void }) => {
    const { permissionGroups, permissionUsers, addMemberToGroup, registerPermissionUser, currentLanguage } = useStore();
    const [searchUser, setSearchUser] = useState('');
    const [selectedUser, setSelectedUser] = useState<PermissionUser | null>(null);
    const [searchResults, setSearchResults] = useState<PermissionUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    // Filter users not already in the group
    const currentGroup = permissionGroups.find(g => g.id === groupId);
    const excludeMember = (user: PermissionUser) => !currentGroup?.memberIds.includes(user.id);

    useEffect(() => {
        const query = searchUser.trim();
        if (!query || selectedUser) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        let cancelled = false;
        setIsSearching(true);
        const timer = window.setTimeout(() => {
            void (async () => {
                try {
                    const localMatches = permissionUsers.filter((u) =>
                        excludeMember(u) && (
                            u.name.toLowerCase().includes(query.toLowerCase())
                            || u.email.toLowerCase().includes(query.toLowerCase())
                        )
                    );
                    const directoryMatches = await searchPermissionUsers(query);
                    const merged = new Map<string, PermissionUser>();
                    [...localMatches, ...directoryMatches]
                        .filter(excludeMember)
                        .forEach((user) => merged.set(user.id, user));
                    if (!cancelled) {
                        setSearchResults(Array.from(merged.values()).slice(0, 20));
                    }
                } catch (error) {
                    console.error('User search failed:', error);
                    if (!cancelled) setSearchResults([]);
                } finally {
                    if (!cancelled) setIsSearching(false);
                }
            })();
        }, 300);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [searchUser, selectedUser, permissionUsers, currentGroup?.memberIds]);

    const looksLikeEmail = (value: string) => value.includes('@');

    const handleSave = async () => {
        if (!groupId) return;
        setSaveError('');
        setIsSaving(true);
        try {
            let userToAdd = selectedUser;
            if (!userToAdd && searchUser.trim()) {
                if (looksLikeEmail(searchUser.trim())) {
                    const resolved = await resolvePermissionUserByEmail(searchUser.trim());
                    if (resolved) {
                        registerPermissionUser(resolved);
                        userToAdd = resolved;
                    }
                } else {
                    const matches = searchResults.length > 0
                        ? searchResults
                        : await searchPermissionUsers(searchUser.trim());
                    if (matches.length === 1) {
                        registerPermissionUser(matches[0]);
                        userToAdd = matches[0];
                    }
                }
            }
            if (userToAdd) {
                await addMemberToGroup(groupId, userToAdd.id);
                onClose();
                return;
            }
            setSaveError(getTranslation('MSG_USER_NOT_FOUND', currentLanguage));
        } catch (error) {
            console.error('Error adding member:', error);
            setSaveError(getTranslation('MSG_USER_NOT_FOUND', currentLanguage));
        } finally {
            setIsSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: getNestedPortalZFromStore(PERM_NESTED_LAYER.ADD_MEMBER) }}>
            <div className="bg-white w-[600px] shadow-2xl rounded-sm border border-gray-300 flex flex-col h-[85vh]">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <h3 className="text-xl font-bold text-[var(--primary-color)]">
                        {getTranslation('TITLE_ADD_USER_TO', currentLanguage)} {groupName}
                        <EditTrigger labelKey="TITLE_ADD_USER_TO" className="ml-2" />
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <TooltipMenu ComponentId={'1126'} />
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="p-8 space-y-6 overflow-y-auto flex-1 min-h-[200px]">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                            {getTranslation('LABEL_SEARCH_USER', currentLanguage)}
                            <EditTrigger labelKey="LABEL_SEARCH_USER" className="ml-2" />
                        </label>
                        <div className="relative">
                            <input
                                className="w-full border border-gray-300 p-2.5 text-sm focus:ring-1 focus:ring-[var(--primary-color)] outline-none rounded-sm"
                                placeholder={getTranslation('LABEL_SEARCH_USER', currentLanguage)}
                                value={selectedUser ? selectedUser.name : searchUser}
                                onChange={(e) => { setSearchUser(e.target.value); setSelectedUser(null); }}
                                autoFocus
                            />
                            <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />

                            {selectedUser && (
                                <button onClick={() => { setSelectedUser(null); setSearchUser(''); }} className="absolute right-10 top-2.5 text-gray-400 hover:text-red-500">
                                    <X className="w-4 h-4" />
                                </button>
                            )}

                            {searchUser && !selectedUser && (
                                <div className="absolute top-full left-0 w-full bg-white border border-gray-200 shadow-xl max-h-48 overflow-y-auto z-50 mt-1 rounded-sm">
                                    {isSearching && (
                                        <div className="p-4 text-gray-400 text-xs italic text-center">
                                            {getTranslation('MSG_TRANSLATING', currentLanguage)}
                                        </div>
                                    )}
                                    {!isSearching && searchResults.map(u => (
                                        <div key={u.id} className="p-3 hover:bg-blue-50 cursor-pointer text-sm flex flex-col border-b border-gray-100 last:border-0" onClick={() => { setSelectedUser(u); setSearchUser(''); }}>
                                            <span className="font-bold text-gray-800">{u.name}</span>
                                            <span className="text-xs text-gray-500">{u.email}</span>
                                        </div>
                                    ))}
                                    {!isSearching && searchResults.length === 0 && (
                                        <div className="p-4 text-gray-400 text-xs italic text-center">
                                            {getTranslation('MSG_USER_NOT_FOUND', currentLanguage)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {saveError && (
                            <div className="text-sm text-red-600 font-medium">{saveError}</div>
                        )}
                        {selectedUser && (
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-sm flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs">
                                    {selectedUser.name.charAt(0)}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-gray-800">{selectedUser.name}</div>
                                    <div className="text-xs text-gray-600">{selectedUser.email}</div>
                                </div>
                                <Check className="w-4 h-4 text-[var(--primary-color)] ml-auto" />
                            </div>
                        )}
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                    <button type="button" onClick={onClose} disabled={isSaving} className="btn-secondary inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">{getTranslation('BTN_CANCEL', currentLanguage)}</button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={(!selectedUser && !searchUser.trim()) || isSaving}
                        className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
                    >
                        {isSaving ? getTranslation('MSG_TRANSLATING', currentLanguage) : getTranslation('BTN_SAVE', currentLanguage)} <EditTrigger labelKey="BTN_SAVE" />
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- CHILD MODAL: GROUP DETAIL ---
const GroupDetailModal = ({ initialGroupId, onClose }: { initialGroupId: string, onClose: () => void }) => {
    const { permissionGroups, permissionUsers, removeMemberFromGroup, updatePermissionGroup, fetchGroupUsers, currentLanguage } = useStore();

    const [currentGroupId, setCurrentGroupId] = useState(initialGroupId);

    useEffect(() => {
        if (fetchGroupUsers) {
            fetchGroupUsers(currentGroupId);
        }
    }, [currentGroupId, fetchGroupUsers]);


    const [activeTab, setActiveTab] = useState<'BASIC' | 'MEMBERS'>('MEMBERS');
    const [showAddMember, setShowAddMember] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const liveGroup = permissionGroups.find(g => g.id === currentGroupId);

    if (!liveGroup) return null;

    const members = liveGroup.memberIds.map(id => permissionUsers.find(u => u.id === id)).filter(Boolean) as PermissionUser[];
    const filteredMembers = members.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const [editName, setEditName] = useState(liveGroup.name);
    const [editDesc, setEditDesc] = useState(liveGroup.description);

    useEffect(() => {
        setEditName(liveGroup.name);
        setEditDesc(liveGroup.description);
        setSearchTerm('');
    }, [liveGroup]);

    const handleSaveBasic = () => {
        updatePermissionGroup({ ...liveGroup, description: editDesc });
    };

    return (
        <>
            {createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: getNestedPortalZFromStore(PERM_NESTED_LAYER.GROUP_DETAIL) }}>
            <div className="bg-white w-[90vw] min-w-[1000px] h-[85vh] shadow-2xl rounded-sm border border-gray-300 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-white border border-gray-200 rounded-sm">
                            <Users className="w-5 h-5 text-[var(--primary-color)]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">
                                {getTranslation('TITLE_MANAGE_GROUP', currentLanguage)}: <span className="text-[var(--primary-color)]">{liveGroup.name}</span>
                                <EditTrigger labelKey="TITLE_MANAGE_GROUP" className="ml-2" />
                            </h3>

                            {/* Group Selection Dropdown */}
                            <div className="relative mt-1">
                                <select
                                    className="appearance-none bg-transparent text-xs font-bold text-gray-500 uppercase cursor-pointer pr-4 hover:text-gray-700 outline-none"
                                    value={currentGroupId}
                                    onChange={(e) => setCurrentGroupId(e.target.value)}
                                >
                                    {permissionGroups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="w-5 h-5 text-gray-400 absolute top-0.5 right-0 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <TooltipMenu ComponentId={'1229'} />
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-6 bg-white flex-shrink-0">
                    <TabButton active={activeTab === 'BASIC'} label={getTranslation('TAB_BASIC_INFO', currentLanguage)} onClick={() => setActiveTab('BASIC')} icon={Settings} />
                    <TabButton active={activeTab === 'MEMBERS'} label={`${getTranslation('LABEL_MEMBER_COUNT', currentLanguage)} (${members.length})`} onClick={() => setActiveTab('MEMBERS')} icon={Users} />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">

                    {/* Basic Info Tab */}
                    {activeTab === 'BASIC' && (
                        <div className="mx-auto space-y-6 bg-white p-8 border border-gray-200 shadow-sm rounded-sm">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">
                                    {getTranslation('LABEL_GROUP_NAME', currentLanguage)}
                                    <EditTrigger labelKey="LABEL_GROUP_NAME" className="ml-2" />
                                </label>
                                <input
                                    className="w-full border border-gray-300 p-2.5 text-sm rounded-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                                    value={editName}
                                    readOnly
                                    disabled
                                    aria-readonly="true"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">
                                    {getTranslation('LABEL_DESCRIPTION', currentLanguage)}
                                    <EditTrigger labelKey="LABEL_DESCRIPTION" className="ml-2" />
                                </label>
                                <JoditRichTextEditor
                                    value={editDesc}
                                    onChange={(val: string) => setEditDesc(val)}
                                    height={180}
                                    placeholder={getTranslation('LABEL_DESCRIPTION', currentLanguage)}
                                />
                            </div>
                            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={() => { setEditDesc(liveGroup.description); }} className="px-4 py-2 border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50 rounded-sm">{getTranslation('BTN_RESET', currentLanguage)}</button>
                                <button type="button" onClick={handleSaveBasic} className="ws-compact-toolbar-btn ws-compact-toolbar-btn--sm px-4 py-2 bg-[var(--btn-primary-bg)] text-white text-xs font-bold shadow-sm hover:opacity-90 rounded-sm">
                                    {getTranslation('BTN_SAVE_CHANGES', currentLanguage)}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Members Tab */}
                    {activeTab === 'MEMBERS' && (
                        <div className="flex flex-col h-full bg-white border border-gray-200 shadow-sm rounded-sm overflow-hidden">
                            {/* Toolbar */}
                            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                                <div className="flex items-center gap-2 relative">
                                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                    <input
                                        type="text"
                                        placeholder={getTranslation('PLACEHOLDER_SEARCH_MEMBERS', currentLanguage)}
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pl-9 pr-9 py-2 border border-gray-300 text-sm rounded-sm w-64 focus:outline-none focus:border-[var(--primary-color)]"
                                    />
                                    {searchTerm && (
                                        <button
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                                            title={getTranslation('BTN_CLEAR_SEARCH', currentLanguage)}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <button type="button" onClick={() => setShowAddMember(true)} className="ws-compact-toolbar-btn px-4 py-2 bg-[var(--btn-primary-bg)] text-white text-sm font-bold shadow-sm hover:opacity-90 flex items-center gap-2 rounded-sm transition-transform active:scale-95">
                                    <UserPlus className="w-4 h-4" /> {getTranslation('BTN_ADD_MEMBER', currentLanguage)} <EditTrigger labelKey="BTN_ADD_MEMBER" />
                                </button>
                            </div>

                            {/* Table */}
                            <div className="flex-1 overflow-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-white border-b border-gray-200 text-gray-500 uppercase text-xs font-bold">
                                        <tr>
                                            <th className="p-4 border-r">
                                                {getTranslation('TH_USER_NAME', currentLanguage)}
                                                <EditTrigger labelKey="TH_USER_NAME" className="ml-2" />
                                            </th>
                                            <th className="p-4 border-r">
                                                {getTranslation('TH_EMAIL_ADDRESS', currentLanguage)}
                                                <EditTrigger labelKey="TH_EMAIL_ADDRESS" className="ml-2" />
                                            </th>
                                            <th className="p-4 text-center w-24">
                                                {getTranslation('TH_ACTIONS', currentLanguage)}
                                                <EditTrigger labelKey="TH_ACTIONS" className="ml-2" />
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredMembers.map(m => (
                                            <tr key={m.id} className="hover:bg-blue-50/50 transition-colors">
                                                <td className="p-4 border-r font-medium text-gray-800 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">
                                                        {m.name.charAt(0)}
                                                    </div>
                                                    {m.name}
                                                </td>
                                                <td className="p-4 border-r text-gray-600 font-mono text-xs">{m.email}</td>
                                                <td className="p-4 text-center">
                                                    <button onClick={() => handleRemoveMember(liveGroup.id, m.id, m.email, removeMemberFromGroup)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors" title={getTranslation('BTN_REMOVE_MEMBER', currentLanguage)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredMembers.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="p-12 text-center text-gray-400 italic">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Users className="w-10 h-10 opacity-20" />
                                                        <span>{getTranslation('MSG_NO_MEMBERS', currentLanguage)}</span>
                                                        <EditTrigger labelKey="MSG_NO_MEMBERS" className="ml-2" />
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                    <button type="button" onClick={onClose} className="btn-secondary inline-flex items-center justify-center gap-2">{getTranslation('BTN_CLOSE', currentLanguage)}</button>
                </div>
            </div>
        </div>,
        document.body
            )}
            {showAddMember && (
                <AddMemberModal
                    groupName={liveGroup.name}
                    groupId={liveGroup.id}
                    onClose={() => setShowAddMember(false)}
                />
            )}
        </>
    );
};

// --- CHILD MODAL: CHECK PERMISSIONS ---
const CheckPermissionModal = ({ onClose }: { onClose: () => void }) => {
    const { permissionUsers, permissionGroups, currentLanguage } = useStore();
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<PermissionUser | null>(null);
    const [result, setResult] = useState<any>(null);

    const filteredUsers = permissionUsers.filter(u => {
        const query = search.trim().toLowerCase();
        if (!query) return false;
        return u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
    });

    const runCheckForUser = (user: PermissionUser) => {
        const groups = permissionGroups.filter(g => g.memberIds.includes(user.id));
        setSelectedUser(user);
        setResult({ user, groups });
    };

    const handleSelectUser = (user: PermissionUser) => {
        setSearch('');
        runCheckForUser(user);
    };

    const handleCheck = () => {
        if (selectedUser) {
            runCheckForUser(selectedUser);
            return;
        }

        const query = search.trim().toLowerCase();
        if (!query) return;

        const matches = permissionUsers.filter(u =>
            u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)
        );

        if (matches.length === 1) {
            runCheckForUser(matches[0]);
        } else if (matches.length > 1) {
            setResult({ multipleMatches: true });
        } else {
            setResult({ notFound: true });
        }
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: getNestedPortalZFromStore(PERM_NESTED_LAYER.CHECK_PERMISSION) }}>
            <div className="bg-white w-[600px] shadow-2xl rounded-sm border border-gray-300 flex flex-col h-[85vh] min-h-[85vh] max-h-[85vh]">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <h3 className="text-xl font-bold text-[var(--primary-color)]">
                        {getTranslation('TITLE_CHECK_USER_PERM', currentLanguage)}
                        <EditTrigger labelKey="TITLE_CHECK_USER_PERM" className="ml-2" />
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <TooltipMenu ComponentId={'1234'} />
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="p-8 space-y-6 overflow-y-auto flex-1">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            {getTranslation('LABEL_SEARCH_USER', currentLanguage)}
                            <EditTrigger labelKey="LABEL_SEARCH_USER" className="ml-2" />
                        </label>
                        <div className="flex gap-2 items-stretch">
                            <div className="relative flex-1 min-w-0 bg-white border border-gray-300 rounded-sm focus-within:ring-1 focus-within:ring-[var(--primary-color)]">
                                <input
                                    type="text"
                                    className="w-full py-2 pl-3 pr-10 text-sm outline-none border-0 bg-transparent rounded-sm"
                                    value={selectedUser ? selectedUser.name : search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setSelectedUser(null);
                                        setResult(null);
                                    }}
                                    placeholder={getTranslation('PLACEHOLDER_SEARCH_USER', currentLanguage)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                                    autoFocus
                                />
                                {(selectedUser || search.trim()) ? (
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedUser(null); setSearch(''); setResult(null); }}
                                        className="absolute right-2 top-2.5 p-0.5 transition-all hover:scale-110 active:scale-95"
                                        aria-label="Clear search"
                                        title="Clear search"
                                    >
                                        <X className="w-4 h-4 opacity-60 hover:opacity-100 hover:text-red-500 transition-opacity" style={{ color: 'var(--icon-color)' }} />
                                    </button>
                                ) : (
                                    <Search
                                        className="absolute right-2 top-2.5 w-4 h-4 pointer-events-none opacity-50"
                                        style={{ color: 'var(--icon-color)' }}
                                    />
                                )}

                                {search.trim() && !selectedUser && (
                                    <div className="absolute top-full left-0 w-full bg-white border border-gray-200 shadow-xl max-h-48 overflow-y-auto z-50 mt-1 rounded-sm">
                                        {filteredUsers.map(u => (
                                            <div
                                                key={u.id}
                                                className="p-3 hover:bg-blue-50 cursor-pointer text-sm flex flex-col border-b border-gray-100 last:border-0"
                                                onClick={() => handleSelectUser(u)}
                                            >
                                                <span className="font-bold text-gray-800">{u.name}</span>
                                                <span className="text-xs text-gray-500">{u.email}</span>
                                            </div>
                                        ))}
                                        {filteredUsers.length === 0 && (
                                            <div className="p-4 text-gray-400 text-xs italic text-center">
                                                {getTranslation('MSG_USER_NOT_FOUND', currentLanguage)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button type="button" onClick={handleCheck} className="ws-compact-toolbar-btn ws-compact-toolbar-btn--sm px-4 py-2 bg-[var(--btn-primary-bg)] text-white text-xs font-bold rounded-sm hover:opacity-90">{getTranslation('BTN_CHECK', currentLanguage)}</button>
                        </div>
                    </div>

                    {result?.user && (
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-sm animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-blue-100">
                                <div className="w-12 h-12 bg-[var(--btn-primary-bg)] rounded-full flex items-center justify-center text-white font-bold text-lg">
                                    {result.user.name.charAt(0)}
                                </div>
                                <div>
                                    <div className="font-bold text-lg text-gray-900">{result.user.name}</div>
                                    <div className="text-xs text-gray-500 font-mono">{result.user.email}</div>
                                </div>
                            </div>
                            <div className="text-sm">
                                <h4 className="font-bold mb-2 text-gray-700 flex items-center gap-2"><Shield className="w-4 h-4" /> {getTranslation('TITLE_GROUP_MEMBERSHIPS', currentLanguage)}</h4>
                                <ul className="space-y-2">
                                    {result.groups.map((g: any) => (
                                        <li key={g.id} className="flex items-center gap-2 p-2 bg-white border border-blue-100 rounded-sm">
                                            <Check className="w-4 h-4 text-green-600" />
                                            <span className="font-medium text-gray-700">{g.name}</span>
                                        </li>
                                    ))}
                                    {result.groups.length === 0 && <li className="italic text-gray-500 p-2">{getTranslation('MSG_NO_MEMBERSHIPS', currentLanguage)}</li>}
                                </ul>
                            </div>
                        </div>
                    )}

                    {result && result.multipleMatches && (
                        <div className="p-4 bg-amber-50 border border-amber-100 text-amber-800 text-sm font-bold text-center rounded-sm">
                            {getTranslation('MSG_MULTIPLE_USERS_FOUND', currentLanguage)}
                        </div>
                    )}

                    {result && result.notFound && (
                        <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm font-bold text-center rounded-sm">
                            {getTranslation('MSG_USER_NOT_FOUND_RETRY', currentLanguage)}
                        </div>
                    )}
                </div>
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                    <button type="button" onClick={onClose} className="btn-secondary inline-flex items-center justify-center gap-2">{getTranslation('BTN_CLOSE', currentLanguage)}</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// Helper Card Component (Extracted)
const PermissionCard: React.FC<{ group: PermissionGroup, icon: any, onSelect: (id: string) => void, currentLanguage: LanguageCode }> = ({ group, icon: Icon, onSelect, currentLanguage }) => (
    <div
        className="bg-white border border-gray-200 p-6 shadow-sm hover:shadow-lg hover:border-[var(--primary-color)] transition-all cursor-pointer group rounded-sm flex flex-col h-full min-h-[220px]"
        onClick={() => onSelect(group.id)}
    >
        <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-[var(--brand-light)] rounded-sm text-[var(--primary-color)]">
                <Icon className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-gray-800 line-clamp-1">{group.name}</h4>
        </div>
        <div className="text-sm text-gray-500 mb-6 leading-relaxed line-clamp-3 flex-1" dangerouslySetInnerHTML={{ __html: group.description }} />
        <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center group-hover:bg-gray-50 -mx-6 -mb-6 px-6 py-3 transition-colors">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{group.memberIds.length} {getTranslation('LABEL_MEMBERS', currentLanguage)}</span>
            <ArrowRight className="w-4 h-4 text-[var(--primary-color)] transform group-hover:translate-x-1 transition-transform" />
        </div>
    </div>
);

// --- MAIN PARENT POPUP ---
export const PermissionManager = ({ onClose }: { onClose: () => void }) => {
    const { permissionGroups, fetchGroupUsers, currentLanguage } = useStore();
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [showCheckPerm, setShowCheckPerm] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const hasFetched = React.useRef(false);

    useEffect(() => {
        if (!hasFetched.current && permissionGroups.length > 0 && fetchGroupUsers) {
            hasFetched.current = true;
            permissionGroups.forEach(g => fetchGroupUsers(g.id));
        }
    }, [permissionGroups, fetchGroupUsers]);

    // Default SharePoint groups: Owners (super admin), Site Admins, Members (editor), Visitors (preview)
    const defaultGroups = sortWebStudioPermissionGroups(
        permissionGroups.filter((g) => g.type === 'Owners' || g.type === 'SiteAdmin' || g.type === 'Members' || g.type === 'Visitors')
    );
    const groupIcons: Record<string, React.ComponentType<{ className?: string }>> = {
        Owners: Shield,
        SiteAdmin: UserCheck,
        Members: UserPlus,
        Visitors: Eye,
    };

    const hasActiveSubModal = Boolean(selectedGroupId || showCreateGroup || showCheckPerm);

    const customFooter = (
        <div className="flex justify-end w-full">
            <button type="button" onClick={onClose} className="btn-secondary inline-flex items-center justify-center gap-2">
                {getTranslation('BTN_CLOSE', currentLanguage)}
            </button>
        </div>
    );

    return (
        <GenericModal
            className="permission-management-popup"
            title={getTranslation('PERM_MGMT', currentLanguage)}
            onClose={onClose}
            width="w-[85vw] min-w-[85vw] max-w-[85vw]"
            noFooter={true}
            customFooter={customFooter}
            hasActiveSubModal={hasActiveSubModal}
            headerIcons={
                <div className="flex gap-3">
                    <button onClick={() => setShowCheckPerm(true)} className="flex items-center gap-2 text-[var(--primary-color)] text-sm font-bold hover:bg-blue-50 px-3 py-1.5 rounded-sm transition-colors border border-transparent hover:border-blue-100">
                        <UserCheck className="w-4 h-4" /> {getTranslation('TITLE_CHECK_USER_PERM', currentLanguage)}
                    </button>
                    <button type="button" onClick={() => setShowCreateGroup(true)} className="ws-compact-toolbar-btn ws-compact-toolbar-btn--sm bg-[var(--btn-primary-bg)] text-white px-4 py-1.5 text-sm font-bold flex items-center gap-2 hover:opacity-90 shadow-sm rounded-sm">
                        <Plus className="w-4 h-4" /> {getTranslation('TITLE_CREATE_GROUP', currentLanguage)}
                    </button>
                    <TooltipMenu ComponentId={'975'} />
                    <EditTrigger labelKey="PERM_MGMT" className="ml-1" color="var(--primary-color)" />
                </div>
            }
        >
            <div className="p-8 bg-gray-50 h-full overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {defaultGroups.map((group) => {
                        const Icon = groupIcons[group.type] || Users;
                        return (
                            <PermissionCard
                                key={group.id}
                                group={group}
                                icon={Icon}
                                onSelect={setSelectedGroupId}
                                currentLanguage={currentLanguage}
                            />
                        );
                    })}
                    {defaultGroups.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                            <Shield className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-center max-w-md">{getTranslation('MSG_NO_GROUPS_FOUND', currentLanguage)}</p>
                            <p className="text-xs text-center mt-2 text-gray-400">
                                Uses this site&apos;s SharePoint Owners, Members, and Visitors groups (for example HHHH Dev Team Owners or WebStudio Owners).
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Child Modals */}
            {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
            {showCheckPerm && <CheckPermissionModal onClose={() => setShowCheckPerm(false)} />}
            {selectedGroupId && <GroupDetailModal initialGroupId={selectedGroupId} onClose={() => setSelectedGroupId(null)} />}
        </GenericModal>
    );
};