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
}

export function SortableBlock({
  block,
  index,
  isFocused,
  isSelected,
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
}: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showInserter, setShowInserter] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const blockWrapperRef = useRef<HTMLDivElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Закрытие контекстного меню при клике вне
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node) &&
        blockWrapperRef.current &&
        !blockWrapperRef.current.contains(event.target as Node)
      ) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showContextMenu]);

  // Закрытие по Esc
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showContextMenu) {
        setShowContextMenu(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showContextMenu]);

  const handleContextMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowContextMenu(!showContextMenu);
  };

  const blockTypes: Array<{ type: string; label: string }> = [
    { type: 'paragraph', label: 'Текст' },
    { type: 'title', label: 'Заголовок' },
    { type: 'subtitle', label: 'Подзаголовок' },
    { type: 'quote', label: 'Цитата' },
    { type: 'list', label: 'Список' },
    { type: 'divider', label: 'Разделитель' },
    { type: 'image', label: 'Изображение' },
    { type: 'carousel', label: 'Карусель' },
  ];

  const renderBlock = () => {
    switch (block.type) {
      case 'paragraph':
        return (
          <BlockParagraph
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
            onDelete={() => onDelete(block.id)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`edit-article-v2__block-wrapper ${isFocused ? 'is-focused' : ''} ${
        isDragging ? 'is-dragging' : ''
      } ${isSelected ? 'edit-article-v2__block-wrapper--selected' : ''}`}
      onMouseEnter={() => setShowInserter(true)}
      onMouseLeave={() => {
        setShowInserter(false);
        if (!showContextMenu) {
          setShowContextMenu(false);
        }
      }}
    >
      {/* Drag handle */}
      <div
        className="edit-article-v2__drag-handle"
        {...attributes}
        {...listeners}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <span className="edit-article-v2__drag-handle-icon">⠿</span>
      </div>

      {/* Block content */}
      <div ref={blockWrapperRef} className="edit-article-v2__block-content">
        {renderBlock()}
      </div>

      {/* Context menu button */}
      <button
        type="button"
        className="edit-article-v2__context-menu-button"
        onClick={handleContextMenuClick}
        aria-label="Меню блока"
      >
        ⋯
      </button>

      {/* Context menu */}
      {showContextMenu && (
        <div ref={contextMenuRef} className="edit-article-v2__context-menu">
          <div className="edit-article-v2__context-menu-section">
            <div className="edit-article-v2__context-menu-title">Добавить блок ниже</div>
            {blockTypes.map(({ type, label }) => (
              <button
                key={type}
                type="button"
                className="edit-article-v2__context-menu-item"
                onClick={() => {
                  onInsertAfter(block.id, type);
                  setShowContextMenu(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="edit-article-v2__context-menu-divider" />
          <button
            type="button"
            className="edit-article-v2__context-menu-item"
            onClick={() => {
              onDuplicate(block.id);
              setShowContextMenu(false);
            }}
          >
            Дублировать
          </button>
          <button
            type="button"
            className="edit-article-v2__context-menu-item"
            onClick={() => {
              onMoveUp(block.id);
              setShowContextMenu(false);
            }}
            disabled={index === 0}
          >
            Переместить вверх
          </button>
          <button
            type="button"
            className="edit-article-v2__context-menu-item"
            onClick={() => {
              onMoveDown(block.id);
              setShowContextMenu(false);
            }}
          >
            Переместить вниз
          </button>
          <div className="edit-article-v2__context-menu-divider" />
          <button
            type="button"
            className="edit-article-v2__context-menu-item edit-article-v2__context-menu-item--danger"
            onClick={() => {
              onDelete(block.id);
              setShowContextMenu(false);
            }}
          >
            Удалить
          </button>
        </div>
      )}

    </div>
  );
}

