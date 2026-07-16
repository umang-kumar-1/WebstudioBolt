import { ModalType } from '../types';
import { useStore } from '../store';

/** Base z-index for ModalManager overlays (see Modals.tsx). */
export const MODAL_BASE_Z = 1300;
export const MODAL_LAYER_STEP = 10;
/** Portals opened from inside a modal must sit above that modal layer. */
export const NESTED_PORTAL_OFFSET = 50;
export const LABEL_EDITOR_Z = 100000;

/** Local layer for full-screen template preview above the template picker modal. */
export const TEMPLATE_PREVIEW_NESTED_LAYER = 20;

/** Static fallback layers when nested portal context is unavailable. */
export const MODAL_Z = {
    NESTED: 1410,
    EDITOR: 1430,
    PREVIEW: 1440,
    ITEM_EDITOR: 1450,
    CONFIRM: 1460,
    OVERLAY: 1470,
    LABEL: 100000,
} as const;

export type ModalZLayer = keyof typeof MODAL_Z;

export function getOpenModalCount(modalStack: ModalType[], activeModal: ModalType): number {
    return modalStack.length + (activeModal !== ModalType.NONE ? 1 : 0);
}

export function getModalLayerZ(layerIndex: number): number {
    return MODAL_BASE_Z + layerIndex * MODAL_LAYER_STEP;
}

/** Z-index for popups portaled to document.body from within an open modal. */
export function getNestedPortalZ(
    modalStack: ModalType[],
    activeModal: ModalType,
    localLayer = 0
): number {
    const openCount = getOpenModalCount(modalStack, activeModal);
    const topIndex = Math.max(openCount - 1, 0);
    return getModalLayerZ(topIndex) + NESTED_PORTAL_OFFSET + localLayer;
}

export function useNestedPortalZ(localLayer = 0): number {
    const modalStack = useStore((state) => state.modalStack);
    const activeModal = useStore((state) => state.activeModal);
    return getNestedPortalZ(modalStack, activeModal, localLayer);
}

/** Non-hook helper for portaled overlays (safe to use in JSX style props). */
export function getNestedPortalZFromStore(localLayer = 0): number {
    const { modalStack, activeModal } = useStore.getState();
    return getNestedPortalZ(modalStack, activeModal, localLayer);
}
