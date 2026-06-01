export const APP_THEME_STORAGE_KEY = "inner-space-ui-theme";

export const APP_THEME_OPTIONS = [
  {
    id: "inner-space",
    label: "深空中性",
    shortLabel: "深空",
  },
  {
    id: "soft-signal",
    label: "柔光安心",
    shortLabel: "柔光",
  },
  {
    id: "sync-field",
    label: "同步共振",
    shortLabel: "同步",
  },
] as const;

export type AppThemeId = (typeof APP_THEME_OPTIONS)[number]["id"];

const APP_THEME_IDS = new Set<string>(
  APP_THEME_OPTIONS.map((option) => option.id),
);

export const DEFAULT_APP_THEME_ID: AppThemeId = "inner-space";
const APP_THEME_STORAGE_PROBE_KEY = `${APP_THEME_STORAGE_KEY}:probe`;

let fallbackAppThemeId: AppThemeId = DEFAULT_APP_THEME_ID;

export function isAppThemeId(value: unknown): value is AppThemeId {
  return typeof value === "string" && APP_THEME_IDS.has(value);
}

export function normalizeAppThemeId(value: unknown): AppThemeId {
  return isAppThemeId(value) ? value : DEFAULT_APP_THEME_ID;
}

function getAvailableLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    const storage = window.localStorage;
    storage.setItem(APP_THEME_STORAGE_PROBE_KEY, "1");
    storage.removeItem(APP_THEME_STORAGE_PROBE_KEY);
    return storage;
  } catch {
    return null;
  }
}

export function readStoredAppTheme(): AppThemeId {
  const storage = getAvailableLocalStorage();
  if (!storage) return fallbackAppThemeId;

  try {
    const storedThemeId = normalizeAppThemeId(
      storage.getItem(APP_THEME_STORAGE_KEY),
    );
    fallbackAppThemeId = storedThemeId;
    return storedThemeId;
  } catch {
    return fallbackAppThemeId;
  }
}

export function writeStoredAppTheme(themeId: AppThemeId) {
  fallbackAppThemeId = themeId;
  const storage = getAvailableLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(APP_THEME_STORAGE_KEY, themeId);
  } catch {
    // Theme persistence is an enhancement; a restricted browser should not block UI use.
  }
}

export function applyAppTheme(themeId: AppThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = themeId;
}
