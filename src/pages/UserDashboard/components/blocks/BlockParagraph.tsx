// src/pages/UserDashboard/components/blocks/BlockParagraph.tsx
import React, { useRef, useEffect, useState } from 'react';

interface BlockParagraphProps {
  value: string;
  onChange: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onEnter?: (atEnd: boolean) => void;
  onBackspace?: (isEmpty: boolean, atStart?: boolean) => void;
  onSlash?: (position: { top: number; left: number }, cursorPos: number) => void;
  onFormat?: (type: 'bold' | 'italic' | 'link') => void;
  onPaste?: (text: string, files: File[]) => void;
  placeholder?: string;
}

export function BlockParagraph({
  value,
  onChange,
  onFocus,
  onBlur,
  onEnter,
  onBackspace,
  onSlash,
  onFormat,
  onPaste,
  placeholder = 'Начните вводить текст...',
}: BlockParagraphProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showFormatMenu, setShowFormatMenu] = useState(false);

  // Автоматический рост textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Проверка на "/" в начале строки для slash-меню
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lineStart = textBeforeCursor.lastIndexOf('\n') + 1;
    const lineText = textBeforeCursor.substring(lineStart);

    if (lineText === '/' && onSlash) {
      const textarea = e.target;
      const rect = textarea.getBoundingClientRect();
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
      const lines = textBeforeCursor.split('\n').length - 1;
      const top = rect.top + lines * lineHeight + lineHeight;
      const left = rect.left + 10; // Небольшой отступ

      onSlash({ top, left }, cursorPos);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + B для Bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      onFormat?.('bold');
      return;
    }

    // Ctrl/Cmd + I для Italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      onFormat?.('italic');
      return;
    }

    // Ctrl/Cmd + K для Link
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      onFormat?.('link');
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const isAtEnd = textarea.selectionStart === textarea.value.length;
      onEnter?.(isAtEnd);
    } else if (e.key === 'Backspace') {
      const textarea = e.currentTarget;
      const isAtStart = textarea.selectionStart === 0;
      const isEmpty = value === '';

      if (isEmpty) {
        e.preventDefault();
        onBackspace?.(true, isAtStart);
      } else if (isAtStart) {
        // Не предотвращаем стандартное поведение, но вызываем callback для слияния
        // Это позволит обработать слияние после того, как Backspace уже обработан
        setTimeout(() => {
          onBackspace?.(false, true);
        }, 0);
      }
    }
  };

  const handleSelect = () => {
    const textarea = textareaRef.current;
    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      setShowFormatMenu(true);
    } else {
      setShowFormatMenu(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardData = e.clipboardData;
    const items = Array.from(clipboardData.items);

    // Проверяем наличие изображений
    const imageFiles: File[] = [];
    let hasPlainText = false;

    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      } else if (item.type === 'text/plain') {
        hasPlainText = true;
      }
    }

    // Если есть изображения, обрабатываем их через onPaste
    if (imageFiles.length > 0 && onPaste) {
      e.preventDefault();
      const text = clipboardData.getData('text/plain');
      onPaste(text, imageFiles);
      return;
    }

    // Если это только текст, проверяем, нужно ли преобразовать в список
    if (hasPlainText && !imageFiles.length) {
      const pastedText = clipboardData.getData('text/plain');
      const lines = pastedText.split('\n').filter((line) => line.trim());

      // Если больше 2 строк, предлагаем преобразовать в список (или делаем автоматически)
      if (lines.length > 2 && onPaste) {
        e.preventDefault();
        onPaste(pastedText, []);
        return;
      }
    }

    // Стандартная обработка для обычного текста
    // (не предотвращаем событие, чтобы браузер вставил текст сам)
  };

  return (
    <div className="edit-article-v2__block-wrapper-text">
      <p>
        <textarea
          ref={textareaRef}
          className="edit-article-v2__block edit-article-v2__block--paragraph"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          onPaste={handlePaste}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={1}
        />
      </p>
      {showFormatMenu && (
        <FormatMenu
          textarea={textareaRef.current}
          onFormat={onFormat}
          onClose={() => setShowFormatMenu(false)}
        />
      )}
    </div>
  );
}

interface FormatMenuProps {
  textarea: HTMLTextAreaElement | null;
  onFormat?: (type: 'bold' | 'italic' | 'link') => void;
  onClose: () => void;
}

function FormatMenu({ textarea, onFormat, onClose }: FormatMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!textarea) return;

    const updatePosition = () => {
      if (!textarea || !menuRef.current) return;

      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;

      // Создаем временный элемент для измерения позиции
      const textBefore = textarea.value.substring(0, selectionStart);
      const textAfter = textarea.value.substring(selectionEnd);

      // Простое позиционирование над выделением
      const rect = textarea.getBoundingClientRect();
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
      const lines = textBefore.split('\n').length - 1;
      const top = rect.top + lines * lineHeight - 40;
      const left = rect.left + 10;

      menuRef.current.style.top = `${top}px`;
      menuRef.current.style.left = `${left}px`;
    };

    updatePosition();
    const handleScroll = () => updatePosition();
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [textarea]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={menuRef} className="edit-article-v2__format-menu">
      <button
        type="button"
        className="edit-article-v2__format-menu-item"
        onClick={() => {
          onFormat?.('bold');
          onClose();
        }}
        title="Жирный (Ctrl+B)"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className="edit-article-v2__format-menu-item"
        onClick={() => {
          onFormat?.('italic');
          onClose();
        }}
        title="Курсив (Ctrl+I)"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        className="edit-article-v2__format-menu-item"
        onClick={() => {
          onFormat?.('link');
          onClose();
        }}
        title="Ссылка (Ctrl+K)"
      >
        🔗
      </button>
    </div>
  );
}

