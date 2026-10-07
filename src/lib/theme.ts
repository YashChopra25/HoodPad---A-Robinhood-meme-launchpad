export type Theme = "light" | "dark";

export const THEME_KEY = "hoodpad:theme";

/**
 * Runs in <head> before first paint: applies the saved theme, or the system
 * preference when nothing is saved, so the page never flashes the wrong one.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();`;
