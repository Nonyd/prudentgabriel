import { create } from "zustand";

type CookieConsentUiState = {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
};

export const useCookieConsentStore = create<CookieConsentUiState>((set) => ({
  isModalOpen: false,
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
}));
