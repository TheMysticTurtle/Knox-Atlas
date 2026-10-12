import { create } from "zustand";

import type { ViewOptions } from "./engine/mapEngine";
import { SETTINGS_KEYS, parseViewOptions, readSetting, writeSetting } from "./settingsStorage";

type ViewState = ViewOptions & {
  toggle: (key: keyof ViewOptions) => void;
};

const DEFAULTS: ViewOptions = {
  towns: true,
  streets: true,
  buildings: true,
  businesses: true,
  satellite: false,
};

/** The View toggles — restored from last time, and remembered whenever one changes. */
export const useView = create<ViewState>((set) => ({
  ...parseViewOptions(readSetting(SETTINGS_KEYS.view), DEFAULTS),
  toggle: (key) => set((state) => ({ [key]: !state[key] }) as Partial<ViewState>),
}));

useView.subscribe((state) => {
  const { towns, streets, buildings, businesses, satellite } = state;
  writeSetting(SETTINGS_KEYS.view, { towns, streets, buildings, businesses, satellite });
});
