// src/pages/UserDashboard/components/EditArticleModal.utils.ts
import type { ArticledetailsProps } from '@models';
import { getUserImageUrl } from '@shared/api/albums';

// Упрощенная структура блока
export interface SimplifiedBlock {
  type: 'text' | 'image' | 'carousel';
  id?: number;
  title?: string;
  subtitle?: string;
  strong?: string;
  content?: string | string[];
  img?: string | string[];
  alt?: string;
}

/**
 * Преобразует текущую структуру details в упрощенную структуру с типами
 */
export function normalizeDetailsToSimplified(details: ArticledetailsProps[]): SimplifiedBlock[] {
  return details.map((detail, index) => {
    // Определяем тип блока сначала
    let blockType: 'text' | 'image' | 'carousel' = 'text';
    if (detail.type) {
      blockType = detail.type;
    } else if ((detail as any).images && Array.isArray((detail as any).images)) {
      // Новая структура: карусель с полем images
      blockType = 'carousel';
    } else if (detail.img) {
      blockType = 'image';
    }

    const block: SimplifiedBlock = {
      type: blockType, // Устанавливаем type сразу
      id: detail.id || index + 1, // используем id из JSON или индекс
      title: detail.title,
      subtitle: detail.subtitle,
      strong: detail.strong,
      alt: detail.alt,
    };

    // Устанавливаем img в зависимости от типа
    if (block.type === 'carousel') {
      // Для карусели используем images из новой структуры или img из старой
      if ((detail as any).images && Array.isArray((detail as any).images)) {
        block.img = (detail as any).images;
      } else if (detail.img && Array.isArray(detail.img)) {
        // Обратная совместимость со старой структурой
        block.img = detail.img;
      }
    } else if (block.type === 'image' && detail.img) {
      block.img =
        typeof detail.img === 'string'
          ? detail.img
          : Array.isArray(detail.img)
            ? detail.img[0]
            : detail.img;
    }

    // Копируем content
    if (detail.content) {
      block.content = detail.content;
    }

    return block;
  });
}

/**
 * Преобразует упрощенную структуру обратно в формат ArticledetailsProps
 */
export function simplifiedToDetails(blocks: SimplifiedBlock[]): ArticledetailsProps[] {
  const details = blocks.map((block, index) => {
    const detail: ArticledetailsProps = {
      type: block.type, // Сохраняем тип для ясности
    };

    // Сохраняем id только если он был задан
    if (block.id) {
      detail.id = block.id;
    }

    if (block.title) detail.title = block.title;
    if (block.subtitle) detail.subtitle = block.subtitle;
    if (block.strong) detail.strong = block.strong;
    if (block.alt) detail.alt = block.alt;
    if (block.content) detail.content = block.content;

    // Для карусели используем images, для изображения - img
    if (block.type === 'image' && block.img) {
      detail.img =
        typeof block.img === 'string'
          ? block.img
          : Array.isArray(block.img)
            ? block.img[0]
            : block.img;
    } else if (block.type === 'carousel' && Array.isArray(block.img)) {
      detail.images = block.img;
    }

    return detail;
  });

  return details;
}

/**
 * Преобразует блоки в HTML для единого contentEditable блока
 */
export function blocksToHtml(blocks: SimplifiedBlock[]): string {
  const htmlParts: string[] = [];

  blocks.forEach((block) => {
    // Заголовок раздела (h3)
    if (block.title) {
      htmlParts.push(
        `<h3 data-block-type="title" data-block-id="${block.id || ''}">${escapeHtml(block.title)}</h3>`
      );
    }

    // Изображение
    if (block.type === 'image' && block.img) {
      const imageUrl = typeof block.img === 'string' ? block.img : block.img[0];
      htmlParts.push(
        `<div data-block-type="image" data-block-id="${block.id || ''}" data-image="${escapeHtml(imageUrl)}" contenteditable="false" class="edit-article-modal__inline-image">
          <img src="${getUserImageUrl(imageUrl, 'articles')}" alt="${escapeHtml(block.alt || '')}" />
        </div>`
      );
    }

    // Карусель
    if (block.type === 'carousel' && Array.isArray(block.img) && block.img.length > 0) {
      const imagesJson = JSON.stringify(block.img);
      htmlParts.push(
        `<div data-block-type="carousel" data-block-id="${block.id || ''}" data-images='${escapeHtml(imagesJson)}' contenteditable="false" class="edit-article-modal__inline-carousel">
          <img src="${getUserImageUrl(block.img[0], 'articles')}" alt="${escapeHtml(block.alt || '')}" />
          <span class="edit-article-modal__carousel-indicator">${block.img.length} фото</span>
        </div>`
      );
    }

    // Подзаголовок (h4)
    if (block.subtitle) {
      htmlParts.push(
        `<h4 data-block-type="subtitle" data-block-id="${block.id || ''}">${escapeHtml(block.subtitle)}</h4>`
      );
    }

    // Разделитель
    if (block.type === 'text' && typeof block.content === 'string' && block.content === '---') {
      htmlParts.push(
        `<hr data-block-type="divider" data-block-id="${block.id || ''}" class="edit-article-modal__inline-divider" />`
      );
    }

    // Текстовый контент
    if (
      block.content &&
      !(block.type === 'text' && typeof block.content === 'string' && block.content === '---')
    ) {
      if (typeof block.content === 'string') {
        // Параграф с возможным strong
        if (block.strong) {
          htmlParts.push(
            `<p data-block-type="text" data-block-id="${block.id || ''}"><strong>${escapeHtml(block.strong)}</strong> ${escapeHtml(block.content)}</p>`
          );
        } else {
          htmlParts.push(
            `<p data-block-type="text" data-block-id="${block.id || ''}">${escapeHtml(block.content)}</p>`
          );
        }
      } else if (Array.isArray(block.content)) {
        // Список
        const listItems = block.content.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
        htmlParts.push(
          `<ul data-block-type="list" data-block-id="${block.id || ''}">${listItems}</ul>`
        );
      }
    }
  });

  return htmlParts.join('');
}

/**
 * Парсит HTML обратно в блоки
 */
export function htmlToBlocks(html: string): SimplifiedBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;
  const blocks: SimplifiedBlock[] = [];
  let currentBlock: Partial<SimplifiedBlock> | null = null;

  const processNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const blockType = element.getAttribute('data-block-type');
      const blockId = element.getAttribute('data-block-id');

      if (blockType === 'title' && element.tagName === 'H3') {
        // Сохраняем предыдущий блок, если есть
        if (currentBlock && hasContent(currentBlock)) {
          blocks.push(currentBlock as SimplifiedBlock);
        }
        currentBlock = {
          type: 'text',
          id: blockId ? parseInt(blockId, 10) : undefined,
          title: element.textContent || undefined,
        };
      } else if (blockType === 'subtitle' && element.tagName === 'H4') {
        if (!currentBlock) {
          currentBlock = { type: 'text' };
        }
        currentBlock.subtitle = element.textContent || undefined;
      } else if (blockType === 'image') {
        // Сохраняем предыдущий блок
        if (currentBlock && hasContent(currentBlock)) {
          blocks.push(currentBlock as SimplifiedBlock);
        }
        const imageUrl = element.getAttribute('data-image') || '';
        blocks.push({
          type: 'image',
          id: blockId ? parseInt(blockId, 10) : undefined,
          img: imageUrl,
          alt: (element.querySelector('img')?.getAttribute('alt') || '') as string,
        });
        currentBlock = null;
      } else if (blockType === 'carousel') {
        // Сохраняем предыдущий блок
        if (currentBlock && hasContent(currentBlock)) {
          blocks.push(currentBlock as SimplifiedBlock);
        }
        const imagesJson = element.getAttribute('data-images') || '[]';
        try {
          const images = JSON.parse(imagesJson) as string[];
          blocks.push({
            type: 'carousel',
            id: blockId ? parseInt(blockId, 10) : undefined,
            img: images,
            alt: (element.querySelector('img')?.getAttribute('alt') || '') as string,
          });
        } catch {
          // Если не удалось распарсить, создаем пустую карусель
          blocks.push({
            type: 'carousel',
            id: blockId ? parseInt(blockId, 10) : undefined,
            img: [],
          });
        }
        currentBlock = null;
      } else if (blockType === 'divider') {
        // Сохраняем предыдущий блок
        if (currentBlock && hasContent(currentBlock)) {
          blocks.push(currentBlock as SimplifiedBlock);
        }
        blocks.push({
          type: 'text',
          id: blockId ? parseInt(blockId, 10) : undefined,
          content: '---',
        });
        currentBlock = null;
      } else if (blockType === 'text' && element.tagName === 'P') {
        if (!currentBlock) {
          currentBlock = { type: 'text', id: blockId ? parseInt(blockId, 10) : undefined };
        }
        const strongElement = element.querySelector('strong');
        const strongText = strongElement?.textContent?.trim() || '';
        const fullText = element.textContent || '';
        const contentText = strongText ? fullText.replace(strongText, '').trim() : fullText.trim();
        currentBlock.strong = strongText || undefined;
        currentBlock.content = contentText || undefined;
      } else if (blockType === 'list' && element.tagName === 'UL') {
        if (!currentBlock) {
          currentBlock = { type: 'text', id: blockId ? parseInt(blockId, 10) : undefined };
        }
        const items = Array.from(element.querySelectorAll('li')).map((li) => li.textContent || '');
        currentBlock.content = items;
      } else if (blockType === 'quote' && element.tagName === 'BLOCKQUOTE') {
        if (!currentBlock) {
          currentBlock = { type: 'text', id: blockId ? parseInt(blockId, 10) : undefined };
        }
        currentBlock.content = element.textContent || '';
      } else if (element.tagName === 'A') {
        // Ссылки обрабатываем как обычный текст
        if (!currentBlock) {
          currentBlock = { type: 'text' };
        }
        currentBlock.content = element.textContent || '';
      } else {
        // Обрабатываем дочерние элементы
        Array.from(element.childNodes).forEach(processNode);
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      // Текстовые узлы обрабатываются родительскими элементами
    }
  };

  // Обрабатываем все узлы
  Array.from(body.childNodes).forEach(processNode);

  // Сохраняем последний блок, если есть
  if (currentBlock && hasContent(currentBlock)) {
    blocks.push(currentBlock as SimplifiedBlock);
  }

  return blocks;
}

/**
 * Проверяет, имеет ли блок контент
 */
function hasContent(block: Partial<SimplifiedBlock>): boolean {
  return !!(
    block.title ||
    block.subtitle ||
    block.content ||
    block.strong ||
    block.type === 'image' ||
    block.type === 'carousel'
  );
}

/**
 * Экранирует HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
