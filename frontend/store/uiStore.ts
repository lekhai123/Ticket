import { create } from "zustand";

interface UiState {
  isSidebarOpen: boolean;
  isCommandPaletteOpen: boolean;
  toggleSidebar: () => void;
  toggleCommandPalette: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: true,
  isCommandPaletteOpen: false,

  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleCommandPalette: () =>
    set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
}));
