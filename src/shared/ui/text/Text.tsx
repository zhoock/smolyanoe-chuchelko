// src/shared/ui/text/Text.tsx

import clsx from 'clsx';
import type { TextProps } from './type';
import s from './Text.module.scss';

// Компонент для текста с возможностью выбора тега и добавления класса
// Пример использования: <Text as="span" className="my-class">Hello</Text>
export const Text = ({ children, className, as: Tag = 'p' }: TextProps) => {
  return <Tag className={clsx(s.text, className)}>{children}</Tag>;
};
