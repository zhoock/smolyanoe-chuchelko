import { describe, expect, test } from '@jest/globals';
import type { ArticledetailsProps } from '@models';

import {
  resolveArticleLockedBodySize,
  resolveLockedArticleBodyBlocks,
  splitArticleDetailsForArchiveGate,
} from '../splitArticleDetailsForArchiveGate';

describe('splitArticleDetailsForArchiveGate', () => {
  test('includes section, first image and first paragraph in preview', () => {
    const details: ArticledetailsProps[] = [
      { id: 1, title: 'Section' },
      { id: 2, img: 'hero.jpg' },
      { id: 3, content: 'First visible paragraph' },
      { id: 4, content: 'Hidden paragraph' },
    ];

    expect(splitArticleDetailsForArchiveGate(details)).toEqual({
      previewDetails: [
        { id: 1, title: 'Section' },
        { id: 2, img: 'hero.jpg' },
        { id: 3, content: 'First visible paragraph' },
      ],
      lockedDetails: [{ id: 4, content: 'Hidden paragraph' }],
    });
  });

  test('includes paragraph that appears before the first image', () => {
    const details: ArticledetailsProps[] = [
      { id: 1, title: 'About' },
      { id: 2, content: 'Lead paragraph' },
      { id: 3, img: 'hero.jpg' },
      { id: 4, content: 'Hidden paragraph' },
    ];

    expect(splitArticleDetailsForArchiveGate(details)).toEqual({
      previewDetails: [
        { id: 1, title: 'About' },
        { id: 2, content: 'Lead paragraph' },
        { id: 3, img: 'hero.jpg' },
      ],
      lockedDetails: [{ id: 4, content: 'Hidden paragraph' }],
    });
  });

  test('puts all blocks in locked section when there is no paragraph or image', () => {
    const details: ArticledetailsProps[] = [
      { id: 1, title: 'Only heading' },
      { id: 2, title: 'Another heading' },
    ];

    expect(splitArticleDetailsForArchiveGate(details)).toEqual({
      previewDetails: [],
      lockedDetails: details,
    });
  });

  test('treats carousel as first image and keeps following text locked', () => {
    const details: ArticledetailsProps[] = [
      { id: 1, title: 'Intro' },
      { id: 2, content: 'Teaser paragraph' },
      { id: 3, images: ['a.jpg', 'b.jpg'] },
      { id: 4, content: 'After carousel' },
    ];

    expect(splitArticleDetailsForArchiveGate(details)).toEqual({
      previewDetails: [
        { id: 1, title: 'Intro' },
        { id: 2, content: 'Teaser paragraph' },
        { id: 3, images: ['a.jpg', 'b.jpg'] },
      ],
      lockedDetails: [{ id: 4, content: 'After carousel' }],
    });
  });

  test('resolveLockedArticleBodyBlocks returns all details when preview is empty', () => {
    const details = [
      { id: 1, title: 'Intro' },
      { id: 2, title: 'No text' },
    ];
    const split = splitArticleDetailsForArchiveGate(details);

    expect(resolveLockedArticleBodyBlocks(details, split)).toEqual(details);
  });

  test('resolveArticleLockedBodySize scales with content volume', () => {
    expect(resolveArticleLockedBodySize([], 0)).toBe('compact');
    expect(resolveArticleLockedBodySize([{ content: 'Short' }], 0)).toBe('compact');
    expect(
      resolveArticleLockedBodySize(
        [
          { content: ['a', 'b', 'c'] },
          { img: 'x.jpg' },
          { title: 'More' },
          { content: 'paragraph' },
        ],
        0
      )
    ).toBe('medium');
  });
});
