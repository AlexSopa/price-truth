// Keep an open page current: look at a data file every few minutes and hand over a new version when it changes.
// The builds run every 15 minutes (the workflow, or `npm run live` on your computer), so the page is at most
// about 18 minutes behind. onChange gets the file's text; it returns false to try the same version again later
// (for example while a replay runs).
const EVERY = 3 * 60 * 1000;

export function watchFile(url, onChange) {
  let last = null, busy = false;
  async function look() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) return;
      const text = await r.text();
      if (last === null) last = text; // first look: the version the page already shows
      else if (text !== last && (await onChange(text)) !== false) last = text;
    } catch {
      // Offline or mid-deploy: look again next time.
    } finally {
      busy = false;
    }
  }
  look();
  setInterval(look, EVERY);
  document.addEventListener("visibilitychange", look); // a tab that comes back looks at once
}
