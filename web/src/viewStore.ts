import { create } from "zustand";

import type { ViewOptions } from "./engine/mapEngine";

type ViewState = ViewOptions & {
  toggle: (key: keyof ViewOptions) => void;
};

export const useView = create<ViewState>((set) => ({
  towns: true,
  streets: true,
  buildings: true,
  businesses: true,
  toggle: (key) => set((state) => ({ [key]: !state[key] }) as Partial<ViewState>),
}));
