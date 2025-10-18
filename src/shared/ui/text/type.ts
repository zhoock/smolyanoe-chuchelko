// src/shared/ui/text/type.ts

// Типы пропсов для компонента Text
export type TextProps = {
  children: React.ReactNode;
  className?: string;
  as?: 'p' | 'span' | 'div'; // по умолчанию <p>
};
