import type { ArticledetailsProps } from '@models';

function blockHasHeroMedia(block: ArticledetailsProps): boolean {
  if (block.images && Array.isArray(block.images) && block.images.length > 0) {
    return true;
  }
  if (typeof block.img === 'string' && block.img.length > 0) {
    return true;
  }
  if (Array.isArray(block.img) && block.img.length > 0) {
    return true;
  }
  return false;
}

function blockHasReadableText(block: ArticledetailsProps): boolean {
  if (typeof block.content === 'string') {
    const trimmed = block.content.trim();
    return trimmed.length > 0 && trimmed !== '---';
  }
  if (Array.isArray(block.content)) {
    return block.content.some((item) => {
      const text = typeof item === 'string' ? item : item.text;
      return typeof text === 'string' && text.trim().length > 0;
    });
  }
  return false;
}

function findFirstParagraphIndex(details: ArticledetailsProps[]): number {
  return details.findIndex(blockHasReadableText);
}

function findFirstImageIndex(details: ArticledetailsProps[]): number {
  return details.findIndex(blockHasHeroMedia);
}

export type ArticleDetailsArchiveSplit = {
  /** Blocks through the first paragraph and first image (inclusive), shown above the gate. */
  previewDetails: ArticledetailsProps[];
  /** Remaining blocks, rendered below the gate with a visual lock. */
  lockedDetails: ArticledetailsProps[];
};

/**
 * Splits article body for archive paywall: first readable paragraph + first image, then gate.
 */
export function splitArticleDetailsForArchiveGate(
  details: ArticledetailsProps[]
): ArticleDetailsArchiveSplit {
  if (!Array.isArray(details) || details.length === 0) {
    return { previewDetails: [], lockedDetails: [] };
  }

  const paragraphIndex = findFirstParagraphIndex(details);
  const imageIndex = findFirstImageIndex(details);

  if (paragraphIndex < 0 && imageIndex < 0) {
    return { previewDetails: [], lockedDetails: details };
  }

  const previewEndIndex = Math.max(paragraphIndex, imageIndex);

  return {
    previewDetails: details.slice(0, previewEndIndex + 1),
    lockedDetails: details.slice(previewEndIndex + 1),
  };
}

/** Blocks rendered in the blurred section below the archive gate. */
export function resolveLockedArticleBodyBlocks(
  details: ArticledetailsProps[],
  split: ArticleDetailsArchiveSplit
): ArticledetailsProps[] {
  if (split.lockedDetails.length > 0) {
    return split.lockedDetails;
  }
  if (split.previewDetails.length === 0 && details.length > 0) {
    return details;
  }
  return [];
}

export type ArticleLockedBodySize = 'compact' | 'medium' | 'tall';

export function resolveArticleLockedBodySize(
  blocks: ArticledetailsProps[],
  descriptionLength = 0
): ArticleLockedBodySize {
  const blockScore = blocks.reduce((score, block) => {
    if (blockHasHeroMedia(block)) return score + 3;
    if (Array.isArray(block.content)) return score + block.content.length;
    if (typeof block.content === 'string' && block.content.length > 0) return score + 2;
    if (block.title || block.subtitle) return score + 1;
    return score;
  }, 0);

  if (blockScore >= 10 || descriptionLength > 400) return 'tall';
  if (blockScore >= 4 || descriptionLength > 120) return 'medium';
  return 'compact';
}
