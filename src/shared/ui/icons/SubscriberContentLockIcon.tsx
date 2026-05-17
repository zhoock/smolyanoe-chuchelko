/**
 * Иконка замка для заблокированного контента (статьи / единый стиль с треками).
 */
export function SubscriberContentLockIcon({
  className,
  size = 18,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M7 11V8a5 5 0 0110 0v3M6 11h12a1 1 0 011 1v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
