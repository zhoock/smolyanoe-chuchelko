// src/pages/UserDashboard/components/blocks/BlockTitle.tsx
import React, { useRef, useEffect } from 'react';

interface BlockTitleProps {
  value: string;
  onChange: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onEnter?: (atEnd: boolean) => void;
  onBackspace?: (isEmpty: boolean, atStart?: boolean) => void;
  placeholder?: string;
  blockId?: string;
}

export function BlockTitle({
  value,
  onChange,
  onFocus,
  onBlur,
  onEnter,
  onBackspace,
  placeholder = 'Заголовок',
  blockId,
}: BlockTitleProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        setTimeout(() => {
          onBackspace?.(false, true);
        }, 0);
      }
    }
  };

  return (
    <h3>
      <textarea
        ref={textareaRef}
        className="edit-article-v2__block edit-article-v2__block--title"
        data-block-id={blockId}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={1}
      />
    </h3>
  );
}
