// src/shared/ui/breadcrumb/Breadcrumb.tsx
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  to?: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  if (items.length === 0) {
    return null;
  }

  const isSingleItem = items.length === 1;

  return (
    <nav
      className={`breadcrumb ${className} ${isSingleItem ? 'breadcrumb--single' : ''}`}
      aria-label="Breadcrumb"
    >
      <ul>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const showArrow = !isLast || isSingleItem; // Показываем стрелку, если не последний элемент ИЛИ если это единственный элемент
          const content = item.to ? (
            <Link to={item.to}>{item.label}</Link>
          ) : item.href ? (
            <a href={item.href}>{item.label}</a>
          ) : (
            <span>{item.label}</span>
          );

          return (
            <li key={index} className={!showArrow ? 'breadcrumb__item--no-arrow' : ''}>
              {content}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
