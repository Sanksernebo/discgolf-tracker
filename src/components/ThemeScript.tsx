/**
 * Inline, blocking script that runs before React hydrates so the initial
 * paint uses the correct theme (no FOUC / hydration mismatch on <html>).
 * Reads localStorage.theme ("light" | "dark" | "system"; default "system").
 */
const script = `(function(){try{var t=localStorage.getItem('theme')||'system';var m=window.matchMedia('(prefers-color-scheme: dark)');var d=t==='dark'||(t==='system'&&m.matches);document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=t;}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
