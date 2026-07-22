/** Remember list scroll + which catalog was opened (PDF back → same spot). */

export function rememberCatalogScroll(pathname: string, catalogId: string) {
  try {
    const path = pathname || "/catalogs";
    sessionStorage.setItem(`scroll:${path}`, String(Math.round(window.scrollY)));
    sessionStorage.setItem(`scroll:catalog:${path}`, catalogId);
    sessionStorage.setItem("scroll:return", path);
  } catch {
    // private mode / quota
  }
}

export function getScrollReturnPath(): string {
  try {
    return sessionStorage.getItem("scroll:return") || "/catalogs";
  } catch {
    return "/catalogs";
  }
}

function findCatalogCard(catalogId: string): Element | null {
  if (!catalogId || !/^[a-zA-Z0-9-]+$/.test(catalogId)) return null;
  return document.querySelector(`[data-catalog-id="${catalogId}"]`);
}

function scrollToStoredY(storageKey: string): boolean {
  try {
    const raw = sessionStorage.getItem(`scroll:${storageKey}`);
    if (raw == null) return false;
    const y = Number(raw);
    if (!Number.isFinite(y) || y <= 0) return false;
    window.scrollTo(0, y);
    return true;
  } catch {
    return false;
  }
}

/** Restore scroll after returning from a catalog PDF. Returns true if applied. */
export function restoreCatalogListScroll(storageKey: string): boolean {
  try {
    const catalogKey = `scroll:catalog:${storageKey}`;
    const catalogId = sessionStorage.getItem(catalogKey);
    if (catalogId) {
      const el = findCatalogCard(catalogId);
      if (!el) return false;
      el.scrollIntoView({ block: "center" });
      sessionStorage.removeItem(catalogKey);
      return true;
    }
  } catch {
    // ignore
  }
  return scrollToStoredY(storageKey);
}
