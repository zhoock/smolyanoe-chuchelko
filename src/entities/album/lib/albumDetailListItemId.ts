import type { detailsProps } from '@models';

/** Stable id for one row inside a semantic album detail block (`content[]`). */
export function generateAlbumDetailListItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function extractContentItemId(item: unknown): string | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const id = (item as { id?: unknown }).id;
  if (typeof id !== 'string') return undefined;
  const trimmed = id.trim();
  return trimmed || undefined;
}

function attachContentItemId(item: unknown, id: string): unknown {
  if (typeof item === 'string') {
    return { id, text: item };
  }
  if (item && typeof item === 'object') {
    return { ...(item as Record<string, unknown>), id };
  }
  return { id, text: String(item) };
}

/**
 * Merge semantic block list items across locales by stable `id`.
 * Source defines entity set and order; target locale keeps localized payload for matching ids.
 */
export function mergeAlignedSemanticBlockContent(
  existingContent: detailsProps['content'],
  sourceContent: detailsProps['content']
): detailsProps['content'] {
  const src = Array.isArray(sourceContent) ? sourceContent : [];
  const ex = Array.isArray(existingContent) ? existingContent : [];

  // Legacy rows without id: bind to source ids at the same index once.
  const migratedExisting = ex.map((item, i) => {
    const existingId = extractContentItemId(item);
    if (existingId) return item;
    const sourceId = i < src.length ? extractContentItemId(src[i]) : undefined;
    if (sourceId) return attachContentItemId(item, sourceId);
    return attachContentItemId(item, generateAlbumDetailListItemId());
  });

  const existingById = new Map<string, unknown>();
  for (const item of migratedExisting) {
    const id = extractContentItemId(item);
    if (id) existingById.set(id, item);
  }

  const out: unknown[] = [];
  for (const srcItem of src) {
    const srcId = extractContentItemId(srcItem);
    if (srcId && existingById.has(srcId)) {
      out.push(attachContentItemId(existingById.get(srcId), srcId));
    } else if (srcId) {
      out.push(attachContentItemId(srcItem, srcId));
    } else {
      out.push(attachContentItemId(srcItem, generateAlbumDetailListItemId()));
    }
  }

  return out as detailsProps['content'];
}
