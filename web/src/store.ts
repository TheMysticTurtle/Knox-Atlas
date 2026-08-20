import { create } from "zustand";

// App-wide UI state shared between the React shell and the canvas map engine (the "bridge").
// Starts minimal to establish the pattern; grows with filter/view/selection state in Phase S/P0.
type AppState = {
  ready: boolean;
  setReady: (ready: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  ready: false,
  setReady: (ready) => set({ ready }),
}));
