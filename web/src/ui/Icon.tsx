// The site's own icons (no official art), plus the GitHub mark (Octicons mark-github-24, MIT) for the source code link.
// 24 px grid, 2 px stroke, color from currentColor.

const paths = {
  dice: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" /><circle cx="16" cy="8" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="8" cy="16" r="1.6" fill="currentColor" /><circle cx="16" cy="16" r="1.6" fill="currentColor" />
    </>
  ),
  file: (
    <>
      <path d="M6 2.5h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 2.5v5h5M8.5 12.5h7M8.5 16.5h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  box: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 9h18M8 13h3M8 16h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  map: (
    <>
      <path d="M3 6l6-2.5 6 2.5 6-2.5v14.5L15 20.5 9 18l-6 2.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 4v14M15 6v14" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  theme: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
    </>
  ),
  flame: (
    <path d="M12 2.5c1 3.2 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.8 1.4-4.6 2.8-6 .2 2 1 3.2 2.3 3.6-.6-3.4.1-6.2.4-8.6z"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  ),
  leaf: (
    <>
      <path d="M4.5 19.5C4 11 9 4.5 20 4c.4 10.5-5.6 16-14 15.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M4.5 19.5 14 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 10h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 11.5h1.5a2.5 2.5 0 0 1 0 5H16" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 3.5c-.8 1 .8 2-.1 3M12 3.5c-.8 1 .8 2-.1 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  sparkle: (
    <>
      <path d="M10 3c.6 4 2.4 5.8 6.5 6.5-4.1.7-5.9 2.5-6.5 6.5-.6-4-2.4-5.8-6.5-6.5C7.6 8.8 9.4 7 10 3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M18 14c.3 1.8 1 2.6 2.7 2.9-1.7.3-2.4 1.1-2.7 2.9-.3-1.8-1-2.6-2.7-2.9 1.7-.3 2.4-1.1 2.7-2.9z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </>
  ),
  ruby: (
    <>
      <path d="M7 3.5h10l4 5.5-9 11.5L3 9z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 9h18M9.5 9 12 20.5 14.5 9M7 3.5 9.5 9 12 3.5l2.5 5.5L17 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </>
  ),
  sapphire: (
    <>
      <ellipse cx="12" cy="12" rx="7.5" ry="9.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 6.5 15 9.5v5L12 17.5 9 14.5v-5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 2.5v4M12 17.5v4M15 9.5l3.6-2.8M15 14.5l3.6 2.8M9 9.5 5.4 6.7M9 14.5l-3.6 2.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  emerald: (
    <>
      <path d="M8 2.5h8l3.5 3.5v12L16 21.5H8L4.5 18V6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 7h4l1.5 1.5v7L14 17h-4l-1.5-1.5v-7z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.2 4.2 8.5 8.5M17.8 4.2l-2.3 4.3M17.8 19.8l-2.3-4.3M6.2 19.8l2.3-4.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  github: (
    <path d="M12 1C5.923 1 1 5.923 1 12c0 4.867 3.149 8.979 7.521 10.436.55.096.756-.233.756-.522 0-.262-.013-1.128-.013-2.049-2.764.509-3.479-.674-3.699-1.292-.124-.317-.66-1.293-1.127-1.554-.385-.207-.936-.715-.014-.729.866-.014 1.485.797 1.691 1.128.99 1.663 2.571 1.196 3.204.907.096-.715.385-1.196.701-1.471-2.448-.275-5.005-1.224-5.005-5.432 0-1.196.426-2.186 1.128-2.956-.111-.275-.496-1.402.11-2.915 0 0 .921-.288 3.024 1.128a10.193 10.193 0 0 1 2.75-.371c.936 0 1.871.123 2.75.371 2.104-1.43 3.025-1.128 3.025-1.128.605 1.513.221 2.64.111 2.915.701.77 1.127 1.747 1.127 2.956 0 4.222-2.571 5.157-5.019 5.432.399.344.743 1.004.743 2.035 0 1.471-.014 2.654-.014 3.025 0 .289.206.632.756.522C19.851 20.979 23 16.854 23 12c0-6.077-4.922-11-11-11Z" fill="currentColor" />
  ),
} satisfies Record<string, React.ReactNode>;

export type IconName = keyof typeof paths;
export const ICON_NAMES = Object.keys(paths) as IconName[];

export function Icon({ name, className }: { name: IconName | string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name as IconName]}
    </svg>
  );
}

// Site logo: the drawing lives only in public/icon.svg (shared with the favicon and scripts/gen-images.mjs).
export function Mark({ className }: { className?: string }) {
  return <img className={className} src="/icon.svg" alt="" width={32} height={32} />;
}
