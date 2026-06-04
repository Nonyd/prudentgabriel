import { create } from "zustand";

export type AuthModalView = "login" | "register";

interface AuthModalStore {
  isOpen: boolean;
  view: AuthModalView;
  callbackUrl: string;
  openLogin: (callbackUrl?: string) => void;
  openRegister: (callbackUrl?: string) => void;
  setView: (view: AuthModalView) => void;
  close: () => void;
}

export const useAuthModalStore = create<AuthModalStore>((set) => ({
  isOpen: false,
  view: "login",
  callbackUrl: "/account",
  openLogin: (callbackUrl = "/account") =>
    set({ isOpen: true, view: "login", callbackUrl }),
  openRegister: (callbackUrl = "/account") =>
    set({ isOpen: true, view: "register", callbackUrl }),
  setView: (view) => set({ view }),
  close: () => set({ isOpen: false }),
}));
