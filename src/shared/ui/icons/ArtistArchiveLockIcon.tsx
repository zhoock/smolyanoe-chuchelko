/**
 * Archive folder with lock — inline gate for locked artist content (articles, etc.).
 */
export function ArtistArchiveLockIcon({
  className,
  size = 48,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M9 16h11.5l3.5 3.5H39a2 2 0 012 2v19a2 2 0 01-2 2H11a2 2 0 01-2-2V18a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <rect
        x="18.5"
        y="25"
        width="11"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M21.5 25v-2.75a2.75 2.75 0 015.5 0V25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
