// src/pages/UserDashboard/components/EditArticleModalV2.utils.ts
import type { ArticledetailsProps } from '@models';

/**
 * Типы блоков редактора (block-based, как VK)
 */
export type BlockType =
  | 'paragraph'
  | 'title'
  | 'subtitle'
  | 'quote'
  | 'list'
  | 'divider'
  | 'image'
  | 'carousel';

export type Block =
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'title'; text: string }
  | { id: string; type: 'subtitle'; text: string }
  | { id: string; type: 'quote'; text: string }
  | { id: string; type: 'list'; items: string[] }
  | { id: string; type: 'divider' }
  | { id: string; type: 'image'; imageKey: string; caption?: string }
  | { id: string; type: 'carousel'; imageKeys: string[]; caption?: string };

export interface ArticleMeta {
  title: string;
  description: string;
}

/**
 * Генерирует уникальный ID для блока
 */
export function generateId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Преобразует старую структуру details в новую структуру блоков
 */
export function normalizeDetailsToBlocks(details: ArticledetailsProps[]): Block[] {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'EditArticleModalV2.utils.ts:42',
      message: 'normalizeDetailsToBlocks entry',
      data: {
        detailsLength: details?.length || 0,
        isArray: Array.isArray(details),
        detailsType: typeof details,
        firstDetail: details?.[0] || null,
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'E',
    }),
  }).catch(() => {});
  // #endregion

  const blocks: Block[] = [];

  if (!details || !Array.isArray(details) || details.length === 0) {
    // Если details пустой, создаем пустой paragraph
    return [
      {
        id: generateId(),
        type: 'paragraph',
        text: '',
      },
    ];
  }

  for (const detail of details) {
    if (!detail) continue;

    // Заголовок (title)
    if (detail.title) {
      // Убираем плюсы в начале текста (артефакты старого редактора)
      const titleText = detail.title.replace(/^\+\++/, '');
      blocks.push({
        id: generateId(),
        type: 'title',
        text: titleText,
      });
    }

    // Подзаголовок (subtitle)
    if (detail.subtitle) {
      // Убираем плюсы в начале текста (артефакты старого редактора)
      const subtitleText = detail.subtitle.replace(/^\+\++/, '');
      blocks.push({
        id: generateId(),
        type: 'subtitle',
        text: subtitleText,
      });
    }

    // Изображение
    if (detail.type === 'image' && detail.img) {
      const imageKey = typeof detail.img === 'string' ? detail.img : detail.img[0] || '';
      if (imageKey) {
        blocks.push({
          id: generateId(),
          type: 'image',
          imageKey,
          caption: detail.alt || undefined,
        });
      }
    }

    // Карусель
    if (detail.type === 'carousel') {
      const imageKeys = detail.images || (Array.isArray(detail.img) ? detail.img : []);
      if (imageKeys.length > 0) {
        blocks.push({
          id: generateId(),
          type: 'carousel',
          imageKeys,
          caption: detail.alt || undefined,
        });
      }
    }

    // Контент
    if (detail.content) {
      if (typeof detail.content === 'string') {
        // Разделитель
        if (detail.content === '---') {
          blocks.push({
            id: generateId(),
            type: 'divider',
          });
        } else {
          // Параграф
          let text = detail.content;
          // Убираем плюсы в начале текста (артефакты старого редактора)
          text = text.replace(/^\+\++/, '');
          if (detail.strong) {
            text = `**${detail.strong}** ${text}`;
          }
          blocks.push({
            id: generateId(),
            type: 'paragraph',
            text,
          });
        }
      } else if (Array.isArray(detail.content)) {
        // Список
        const listItems = detail.content.filter((item) => typeof item === 'string' && item.trim()) as string[];
        if (listItems.length > 0) {
          blocks.push({
            id: generateId(),
            type: 'list',
            items: listItems,
          });
        }
      }
    } else if (!detail.title && !detail.subtitle && detail.type !== 'image' && detail.type !== 'carousel') {
      // Если нет ни title, ни subtitle, ни content, ни изображений - создаем пустой paragraph
      // (только если это не специальный тип блока)
      blocks.push({
        id: generateId(),
        type: 'paragraph',
        text: '',
      });
    }
  }

  // Если блоков нет, создаем пустой paragraph
  if (blocks.length === 0) {
    blocks.push({
      id: generateId(),
      type: 'paragraph',
      text: '',
    });
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'EditArticleModalV2.utils.ts:147',
      message: 'normalizeDetailsToBlocks exit',
      data: {
        blocksCount: blocks.length,
        blocksTypes: blocks.map((b) => b.type),
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'E',
    }),
  }).catch(() => {});
  // #endregion

  return blocks;
}

/**
 * Преобразует блоки обратно в структуру details для сохранения
 */
export function blocksToDetails(blocks: Block[]): ArticledetailsProps[] {
  const details: ArticledetailsProps[] = [];
  let currentDetail: Partial<ArticledetailsProps> | null = null;

  for (const block of blocks) {
    if (block.type === 'title') {
      // Сохраняем предыдущий detail, если есть
      if (currentDetail && hasContent(currentDetail)) {
        details.push(currentDetail as ArticledetailsProps);
      }
      currentDetail = { type: 'text', title: block.text };
    } else if (block.type === 'subtitle') {
      if (!currentDetail) {
        currentDetail = { type: 'text' };
      }
      currentDetail.subtitle = block.text;
    } else if (block.type === 'image') {
      // Сохраняем предыдущий detail
      if (currentDetail && hasContent(currentDetail)) {
        details.push(currentDetail as ArticledetailsProps);
      }
      details.push({
        type: 'image',
        img: block.imageKey,
        alt: block.caption,
      });
      currentDetail = null;
    } else if (block.type === 'carousel') {
      // Сохраняем предыдущий detail
      if (currentDetail && hasContent(currentDetail)) {
        details.push(currentDetail as ArticledetailsProps);
      }
      details.push({
        type: 'carousel',
        images: block.imageKeys,
        alt: block.caption,
      });
      currentDetail = null;
    } else if (block.type === 'divider') {
      // Сохраняем предыдущий detail
      if (currentDetail && hasContent(currentDetail)) {
        details.push(currentDetail as ArticledetailsProps);
      }
      details.push({
        type: 'text',
        content: '---',
      });
      currentDetail = null;
    } else if (block.type === 'paragraph') {
      if (!currentDetail) {
        currentDetail = { type: 'text' };
      }
      // Парсим markdown для strong
      let text = block.text;
      // Убираем плюсы в начале текста (артефакты старого редактора)
      text = text.replace(/^\+\++/, '');
      let strong: string | undefined;
      const strongMatch = text.match(/^\*\*(.+?)\*\*\s*(.*)$/);
      if (strongMatch) {
        strong = strongMatch[1];
        text = strongMatch[2];
      }
      if (strong) {
        currentDetail.strong = strong;
      }
      currentDetail.content = text || undefined;
    } else if (block.type === 'list') {
      if (!currentDetail) {
        currentDetail = { type: 'text' };
      }
      // Убираем плюсы в начале каждого элемента списка (артефакты старого редактора)
      const cleanedItems = block.items.map((item) => item.replace(/^\+\++/, ''));
      currentDetail.content = cleanedItems;
    } else if (block.type === 'quote') {
      if (!currentDetail) {
        currentDetail = { type: 'text' };
      }
      // Цитату сохраняем как обычный текст (можно расширить позже)
      // Убираем плюсы в начале текста (артефакты старого редактора)
      const quoteText = block.text ? block.text.replace(/^\+\++/, '') : undefined;
      currentDetail.content = quoteText || undefined;
    }
  }

  // Сохраняем последний detail
  if (currentDetail && hasContent(currentDetail)) {
    details.push(currentDetail as ArticledetailsProps);
  }

  return details;
}

/**
 * Проверяет, имеет ли detail контент
 */
function hasContent(detail: Partial<ArticledetailsProps>): boolean {
  return !!(
    detail.title ||
    detail.subtitle ||
    detail.content ||
    detail.strong ||
    detail.type === 'image' ||
    detail.type === 'carousel'
  );
}

/**
 * Debounce функция
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

