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
  blockId?: string;
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
  blockId,
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

  const handleMouseUp = () => {
    // Обновляем меню после завершения выделения мышью
    handleSelect();
  };

  const handleKeyUp = () => {
    // Обновляем меню после изменения выделения клавиатурой
    handleSelect();
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
          data-block-id={blockId}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          onMouseUp={handleMouseUp}
          onKeyUp={handleKeyUp}
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
  const measureRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    if (!textarea) return;

    const updatePosition = () => {
      if (!textarea || !menuRef.current) return;

      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;

      // Сохраняем позицию выделения
      selectionRef.current = { start: selectionStart, end: selectionEnd };

      // Если нет выделения, не показываем меню
      if (selectionStart === selectionEnd) {
        onClose();
        return;
      }

      // Создаем временный элемент-измеритель с теми же стилями, что и textarea
      if (!measureRef.current) {
        measureRef.current = document.createElement('div');
        measureRef.current.style.position = 'absolute';
        measureRef.current.style.visibility = 'hidden';
        measureRef.current.style.whiteSpace = 'pre-wrap';
        measureRef.current.style.wordWrap = 'break-word';
        measureRef.current.style.overflow = 'hidden';
        measureRef.current.style.pointerEvents = 'none';
        measureRef.current.style.zIndex = '-1';
        document.body.appendChild(measureRef.current);
      }

      const measure = measureRef.current;
      const textareaRect = textarea.getBoundingClientRect();
      const textareaStyles = getComputedStyle(textarea);

      // Позиционируем измеритель в том же месте, что и textarea
      measure.style.position = 'fixed';
      measure.style.top = `${textareaRect.top}px`;
      measure.style.left = `${textareaRect.left}px`;

      // Копируем все стили из textarea в измеритель
      measure.style.font = textareaStyles.font;
      measure.style.fontSize = textareaStyles.fontSize;
      measure.style.fontFamily = textareaStyles.fontFamily;
      measure.style.fontWeight = textareaStyles.fontWeight;
      measure.style.fontStyle = textareaStyles.fontStyle;
      measure.style.letterSpacing = textareaStyles.letterSpacing;
      measure.style.textTransform = textareaStyles.textTransform;
      measure.style.lineHeight = textareaStyles.lineHeight;
      measure.style.padding = textareaStyles.padding;
      measure.style.border = textareaStyles.border;
      measure.style.boxSizing = textareaStyles.boxSizing;
      measure.style.width = `${textarea.offsetWidth}px`;
      measure.style.maxWidth = `${textarea.offsetWidth}px`;

      // Получаем текст до начала выделения и сам выделенный текст
      const textBefore = textarea.value.substring(0, selectionStart);
      const selectedText = textarea.value.substring(selectionStart, selectionEnd);

      // Очищаем измеритель
      measure.innerHTML = '';

      // Создаем текстовый узел для текста до выделения
      const beforeText = document.createTextNode(textBefore);
      measure.appendChild(beforeText);

      // Создаем span для выделенного текста
      const selectedSpan = document.createElement('span');
      selectedSpan.textContent = selectedText;
      measure.appendChild(selectedSpan);

      // Принудительно пересчитываем layout
      void measure.offsetHeight; // Force reflow

      // Получаем позицию выделения
      const startRect = selectedSpan.getBoundingClientRect();

      // Вычисляем позицию тултипа: по центру выделения по горизонтали, над выделением по вертикали
      const menuWidth = menuRef.current.offsetWidth || 120;
      const menuHeight = menuRef.current.offsetHeight || 40;
      const offsetY = 8; // Отступ сверху от выделения

      // Центрируем по горизонтали относительно выделения
      const selectionCenterX = startRect.left + startRect.width / 2;
      const left = selectionCenterX - menuWidth / 2;
      // Позиционируем над выделением
      const top = startRect.top - menuHeight - offsetY;

      // Проверяем, не выходит ли меню за границы viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 8;

      let finalLeft = left;
      let finalTop = top;

      // Если меню выходит за левую границу
      if (finalLeft < padding) {
        finalLeft = padding;
      }
      // Если меню выходит за правую границу
      if (finalLeft + menuWidth > viewportWidth - padding) {
        finalLeft = viewportWidth - menuWidth - padding;
      }

      // Если меню выходит за верхнюю границу, показываем его под выделением
      if (finalTop < padding) {
        finalTop = startRect.bottom + offsetY;
      }
      // Если меню выходит за нижнюю границу, показываем его над выделением (даже если частично скрыто)
      if (finalTop + menuHeight > viewportHeight - padding) {
        finalTop = Math.max(padding, startRect.top - menuHeight - offsetY);
      }

      menuRef.current.style.top = `${finalTop}px`;
      menuRef.current.style.left = `${finalLeft}px`;
    };

    // Используем requestAnimationFrame для корректного обновления позиции после изменения выделения
    const updatePositionWithRAF = () => {
      requestAnimationFrame(() => {
        updatePosition();
      });
    };

    updatePositionWithRAF();

    // Обновляем позицию при скролле и изменении размера окна
    const handleScroll = () => updatePositionWithRAF();
    const handleResize = () => updatePositionWithRAF();
    const handleSelectionChange = () => updatePositionWithRAF();

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('selectionchange', handleSelectionChange);
      // Удаляем измеритель при размонтировании
      if (measureRef.current && measureRef.current.parentNode) {
        measureRef.current.parentNode.removeChild(measureRef.current);
        measureRef.current = null;
      }
    };
  }, [textarea, onClose]);

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
    <div
      ref={menuRef}
      className="edit-article-v2__format-menu"
      onMouseDown={(e) => {
        // Предотвращаем всплытие события клика на контейнер меню
        e.stopPropagation();
      }}
      onClick={(e) => {
        // Предотвращаем всплытие события клика на контейнер меню
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        className="edit-article-v2__format-menu-item"
        onMouseDown={(e) => {
          // Предотвращаем потерю фокуса textarea при клике на кнопку
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          // Предотвращаем всплытие события
          e.preventDefault();
          e.stopPropagation();
          // Восстанавливаем выделение перед форматированием
          if (textarea && selectionRef.current) {
            textarea.focus();
            textarea.setSelectionRange(selectionRef.current.start, selectionRef.current.end);
          }
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
        onMouseDown={(e) => {
          // Предотвращаем потерю фокуса textarea при клике на кнопку
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          // Предотвращаем всплытие события
          e.preventDefault();
          e.stopPropagation();
          // Восстанавливаем выделение перед форматированием
          if (textarea && selectionRef.current) {
            textarea.focus();
            textarea.setSelectionRange(selectionRef.current.start, selectionRef.current.end);
          }
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
        onMouseDown={(e) => {
          // Предотвращаем потерю фокуса textarea при клике на кнопку
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          // Предотвращаем всплытие события
          e.preventDefault();
          e.stopPropagation();
          // Восстанавливаем выделение перед форматированием
          if (textarea && selectionRef.current) {
            textarea.focus();
            textarea.setSelectionRange(selectionRef.current.start, selectionRef.current.end);
          }
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
