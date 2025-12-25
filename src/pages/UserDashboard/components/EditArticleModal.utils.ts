// src/pages/UserDashboard/components/EditArticleModal.utils.ts
import type { ArticledetailsProps } from '@models';

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
