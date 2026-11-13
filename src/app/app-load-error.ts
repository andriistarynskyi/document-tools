/**
 * Shown when a lazily loaded part of the app (the PDF reader worker, the Excel writer) cannot
 * be fetched. The usual cause is a tab left open across a deploy: the new deploy removed the
 * old files. Being offline before those parts were ever cached has the same effect.
 */
export const APP_RELOAD_MESSAGE =
  'Part of this page could not be loaded. A new version may be available. Please reload the page.';

/** True for webpack's error when a lazy chunk (`import()`) fails to load. */
export function isChunkLoadError(e: unknown): boolean {
  return e instanceof Error && e.name === 'ChunkLoadError';
}
