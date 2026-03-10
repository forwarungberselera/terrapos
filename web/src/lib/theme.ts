export type TerraTheme = "forest" | "sand";

export function getTheme(): TerraTheme {
  if (typeof window === "undefined") return "forest";
  const t = (localStorage.getItem("terra_theme") as TerraTheme) || "forest";
  return t === "sand" ? "sand" : "forest";
}

export function setTheme(t: TerraTheme) {
  localStorage.setItem("terra_theme", t);
  document.documentElement.setAttribute("data-theme", t);
}

export function initTheme() {
  if (typeof window === "undefined") return;
  document.documentElement.setAttribute("data-theme", getTheme());
}
