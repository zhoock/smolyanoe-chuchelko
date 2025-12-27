// src/pages/UserDashboard/components/blocks/BlockQuote.tsx
import React, { useRef, useEffect } from 'react';

interface BlockQuoteProps {
  value: string;
  onChange: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onEnter?: (atEnd: boolean) => void;
  onBackspace?: (isEmpty: boolean, atStart?: boolean) => void;
  placeholder?: string;
}

export function BlockQuote({
  value,
  onChange,
  onFocus,
  onBlur,
  onEnter,
  onBackspace,
  placeholder = 'Цитата',
}: BlockQuoteProps) {
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
    <p className="edit-article-v2__block edit-article-v2__block--quote">
      <textarea
        ref={textareaRef}
        className="edit-article-v2__block edit-article-v2__block--quote"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={1}
      />
    </p>
  );
}

