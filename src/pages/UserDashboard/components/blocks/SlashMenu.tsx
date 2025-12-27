// src/pages/UserDashboard/components/blocks/SlashMenu.tsx
import React, { useEffect, useRef } from 'react';

interface SlashMenuProps {
  position: { top: number; left: number };
  onSelect: (type: string) => void;
  onClose: () => void;
  selectedIndex: number;
}

const BLOCK_TYPES = [
  { type: 'paragraph', label: 'Текст', icon: '📝' },
  { type: 'title', label: 'Заголовок', icon: '📌' },
  { type: 'subtitle', label: 'Подзаголовок', icon: '📍' },
  { type: 'quote', label: 'Цитата', icon: '💬' },
  { type: 'list', label: 'Список', icon: '📋' },
  { type: 'divider', label: 'Разделитель', icon: '➖' },
  { type: 'image', label: 'Изображение', icon: '🖼️' },
  { type: 'carousel', label: 'Карусель', icon: '🎠' },
];

export function SlashMenu({ position, onSelect, onClose, selectedIndex }: SlashMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        // Навигация вверх обрабатывается родителем
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        // Навигация вниз обрабатывается родителем
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onSelect(BLOCK_TYPES[selectedIndex].type);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onSelect, onClose, selectedIndex]);

  useEffect(() => {
    // Скролл к выбранному элементу
    const selectedElement = menuRef.current?.querySelector(
      `.edit-article-v2__slash-menu-item:nth-child(${selectedIndex + 1})`
    );
    selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  return (
    <div
      ref={menuRef}
      className="edit-article-v2__slash-menu"
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="edit-article-v2__slash-menu-title">Выберите тип блока</div>
      {BLOCK_TYPES.map(({ type, label, icon }, index) => (
        <button
          key={type}
          type="button"
          className={`edit-article-v2__slash-menu-item ${
            index === selectedIndex ? 'is-selected' : ''
          }`}
          onClick={() => onSelect(type)}
          onMouseEnter={() => {
            // Можно добавить hover-выбор
          }}
        >
          <span className="edit-article-v2__slash-menu-icon">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

