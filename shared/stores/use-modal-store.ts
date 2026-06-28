import { create } from "zustand"

export type ModalType = "manualAddNetwork" | "networkSettings" | "terminal" | "connectFromHotspot"

// ponytail: simple bag — ssid is used by manualAddNetwork + connectFromHotspot,
// the others pass empty objects. No need for a fancier discriminated union.
export interface ModalData {
  ssid?: string
}

interface ModalStore {
  type: ModalType | null
  data: ModalData
  isOpen: boolean
  open: (type: ModalType, data?: ModalData) => void
  close: () => void
}

export const useModalStore = create<ModalStore>((set) => ({
  type: null,
  data: {},
  isOpen: false,
  open: (type, data = {}) => set({ type, data, isOpen: true }),
  close: () => set({ type: null, data: {}, isOpen: false }),
}))
