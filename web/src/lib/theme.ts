/**
 * TerraPOS Theme Utilities
 * Aligned with ThemeToggle component (dark/light mode via data-theme attribute)
 */

export type TerraTheme = "light" | "dark";

const THEME_KEY = "terrapos_theme";

export function getTheme(): TerraTheme {
  if (typeof window === "undefined") return "light";
  const t = localStorage.getItem(THEME_KEY);
  return t === "dark" ? "dark" : "light";
}

export function setTheme(t: TerraTheme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, t);
  if (t === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function initTheme() {
  if (typeof window === "undefined") return;
  const theme = getTheme();
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
}
