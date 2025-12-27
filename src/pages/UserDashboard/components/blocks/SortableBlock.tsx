// src/pages/UserDashboard/components/blocks/SortableBlock.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block } from '../EditArticleModalV2.utils';
import { BlockParagraph } from './BlockParagraph';
import { BlockTitle } from './BlockTitle';
import { BlockSubtitle } from './BlockSubtitle';
import { BlockQuote } from './BlockQuote';
import { BlockList } from './BlockList';
import { BlockDivider } from './BlockDivider';
import { BlockImage } from './BlockImage';
import { BlockCarousel } from './BlockCarousel';

interface SortableBlockProps {
  block: Block;
  index: number;
  isFocused: boolean;
  isSelected?: boolean;
  showVkPlus?: boolean;
  onUpdate: (blockId: string, updates: Partial<Block>) => void;
  onDelete: (blockId: string) => void;
  onFocus: (blockId: string) => void;
  onBlur: () => void;
  onSelect?: (blockId: string) => void;
  onEnter: (blockId: string, atEnd: boolean) => void;
  onBackspace: (isEmpty: boolean, atStart?: boolean) => void;
  onInsertAfter: (blockId: string, type: string) => void;
  onDuplicate: (blockId: string) => void;
  onMoveUp: (blockId: string) => void;
  onMoveDown: (blockId: string) => void;
  onSlash?: (blockId: string, position: { top: number; left: number }, cursorPos: number) => void;
  onFormat?: (blockId: string, type: 'bold' | 'italic' | 'link') => void;
  onPaste?: (blockId: string, text: string, files: File[]) => void;
  onConvertToCarousel?: (blockId: string) => void;
  onVkPlusSelect?: (type: string) => void;
  onVkPlusClose?: () => void;
  onEditCarousel?: (blockId: string) => void;
}

export function SortableBlock({
  block,
  index,
  isFocused,
  isSelected,
  showVkPlus,
  onUpdate,
  onDelete,
  onFocus,
  onBlur,
  onSelect,
  onEnter,
  onBackspace,
  onInsertAfter,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onSlash,
  onFormat,
  onPaste,
  onConvertToCarousel,
  onVkPlusSelect,
  onVkPlusClose,
  onEditCarousel,
}: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const renderBlock = () => {
    switch (block.type) {
      case 'paragraph':
        return (
          <BlockParagraph
            blockId={block.id}
            value={block.text}
            onChange={(text) => onUpdate(block.id, { text } as Partial<Block>)}
            onFocus={() => onFocus(block.id)}
            onBlur={onBlur}
            onEnter={(atEnd) => onEnter(block.id, atEnd)}
            onBackspace={(isEmpty, atStart) => onBackspace(isEmpty, atStart)}
            onSlash={(position, cursorPos) => onSlash?.(block.id, position, cursorPos)}
            onFormat={(type) => onFormat?.(block.id, type)}
            onPaste={(text, files) => onPaste?.(block.id, text, files)}
          />
        );
      case 'title':
        return (
          <BlockTitle
            blockId={block.id}
            value={block.text}
            onChange={(text) => onUpdate(block.id, { text } as Partial<Block>)}
            onFocus={() => onFocus(block.id)}
            onBlur={onBlur}
            onEnter={(atEnd) => onEnter(block.id, atEnd)}
            onBackspace={(isEmpty, atStart) => onBackspace(isEmpty, atStart)}
          />
        );
      case 'subtitle':
        return (
          <BlockSubtitle
            blockId={block.id}
            value={block.text}
            onChange={(text) => onUpdate(block.id, { text } as Partial<Block>)}
            onFocus={() => onFocus(block.id)}
            onBlur={onBlur}
            onEnter={(atEnd) => onEnter(block.id, atEnd)}
            onBackspace={(isEmpty, atStart) => onBackspace(isEmpty, atStart)}
          />
        );
      case 'quote':
        return (
          <BlockQuote
            blockId={block.id}
            value={block.text}
            onChange={(text) => onUpdate(block.id, { text } as Partial<Block>)}
            onFocus={() => onFocus(block.id)}
            onBlur={onBlur}
            onEnter={(atEnd) => onEnter(block.id, atEnd)}
            onBackspace={(isEmpty, atStart) => onBackspace(isEmpty, atStart)}
          />
        );
      case 'list':
        return (
          <BlockList
            value={block.items}
            onChange={(items) => onUpdate(block.id, { items } as Partial<Block>)}
            onFocus={() => onFocus(block.id)}
            onBlur={onBlur}
            onBackspace={(isEmpty, atStart) => onBackspace(isEmpty, atStart)}
          />
        );
      case 'divider':
        return <BlockDivider onFocus={() => onFocus(block.id)} onBlur={onBlur} />;
      case 'image':
        return (
          <BlockImage
            imageKey={block.imageKey}
            caption={block.caption}
            onChange={(imageKey, caption) =>
              onUpdate(block.id, { imageKey, caption } as Partial<Block>)
            }
            onFocus={() => onFocus(block.id)}
            onBlur={onBlur}
            isSelected={isSelected}
            onSelect={() => onSelect?.(block.id)}
            onConvertToCarousel={() => onConvertToCarousel?.(block.id)}
          />
        );
      case 'carousel':
        return (
          <BlockCarousel
            imageKeys={block.imageKeys}
            caption={block.caption}
            onChange={(imageKeys, caption) =>
              onUpdate(block.id, { imageKeys, caption } as Partial<Block>)
            }
            onFocus={() => onFocus(block.id)}
            onBlur={onBlur}
            isSelected={isSelected}
            onSelect={() => onSelect?.(block.id)}
            onEdit={() => onEditCarousel?.(block.id)}
          />
        );
      default:
        return null;
    }
  };

  // Проверяем, пустой ли блок
  const isBlockEmpty = (() => {
    if (
      block.type === 'paragraph' ||
      block.type === 'title' ||
      block.type === 'subtitle' ||
      block.type === 'quote'
    ) {
      return block.text.trim() === '';
    }
    if (block.type === 'list') {
      return block.items.every((item) => item.trim() === '');
    }
    if (block.type === 'divider') {
      return false; // Divider всегда "не пустой"
    }
    if (block.type === 'image') {
      return !block.imageKey || block.imageKey === '';
    }
    if (block.type === 'carousel') {
      return !block.imageKeys || block.imageKeys.length === 0;
    }
    return false;
  })();

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-block-id={block.id}
      className={`edit-article-v2__block-wrapper ${isFocused ? 'is-focused' : ''} ${
        isDragging ? 'is-dragging' : ''
      } ${isSelected ? 'edit-article-v2__block-wrapper--selected' : ''} ${isBlockEmpty ? 'is-empty' : ''}`}
    >
      {/* Drag handle - показываем только если блок не пустой */}
      {!isBlockEmpty && (
        <div
          className="edit-article-v2__drag-handle"
          {...attributes}
          {...listeners}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <span className="edit-article-v2__drag-handle-icon">⠿</span>
        </div>
      )}

      {/* Block content */}
      <div className="edit-article-v2__block-content">{renderBlock()}</div>

      {/* VK-стиль плюс: показывается для пустых блоков */}
      {showVkPlus && isBlockEmpty && onVkPlusSelect && onVkPlusClose && (
        <VkPlusInserter onSelect={onVkPlusSelect} onClose={onVkPlusClose} />
      )}
    </div>
  );
}

// Компонент VK-стиля плюса
function VkPlusInserter({
  onSelect,
  onClose,
}: {
  onSelect: (type: string) => void;
  onClose: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  const blockTypes = [
    { type: 'paragraph', label: 'Текст', icon: '📝' },
    { type: 'title', label: 'Заголовок', icon: '📌' },
    { type: 'subtitle', label: 'Подзаголовок', icon: '📍' },
    { type: 'quote', label: 'Цитата', icon: '💬' },
    { type: 'list', label: 'Список', icon: '📋' },
    { type: 'divider', label: 'Разделитель', icon: '➖' },
    { type: 'image', label: 'Изображение', icon: '🖼️' },
    { type: 'carousel', label: 'Карусель', icon: '🎠' },
  ];

  return (
    <div ref={menuRef} className="edit-article-v2__vk-plus">
      <button
        type="button"
        className="edit-article-v2__vk-plus-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        +
      </button>
      {isOpen && (
        <div className="edit-article-v2__vk-plus-menu">
          {blockTypes.map(({ type, label, icon }) => (
            <button
              key={type}
              type="button"
              className="edit-article-v2__vk-plus-menu-item"
              onClick={() => {
                onSelect(type);
                setIsOpen(false);
              }}
            >
              <span className="edit-article-v2__vk-plus-menu-icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
