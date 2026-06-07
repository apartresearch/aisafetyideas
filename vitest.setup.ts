// jsdom has no matchMedia; svelte/motion touches it at module load. Stub a no-op (reduced = false).
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  // @ts-expect-error – minimal stub for tests
  window.matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent() { return false; }
  });
}
