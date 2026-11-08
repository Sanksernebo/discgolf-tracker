/**
 * Runs before React hydrates so the initial page uses the correct theme.
 * An explicit "light" or "dark" choice is respected; otherwise follows
 * the operating system preference.
 */
const script = `(function(){try{var t=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)');var d=t==='dark'||((t!=='light')&&m.matches);var r=d?'dark':'light';document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=r;}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
