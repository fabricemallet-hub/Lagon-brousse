import type { SVGProps } from 'react';

export function AppLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* This is the nautilus/wave part representing the "Lagon" */}
      <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-2.5-5.5-3.5a7 7 0 0 0-7 7c0 2 1 3.9 3 5.5s3.5 2.5 5.5 3.5z" />
      <path d="M2 13.2A12 12 0 0 0 12 22a12 12 0 0 0 10-8.8" />
      {/* This is a new part, a stylized mountain for the "Brousse" */}
      <path d="M5 10l4-4 4 4" />
    </svg>
  );
}

export function CrabIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 12C2 8.68629 4.68629 6 8 6H16C19.3137 6 22 8.68629 22 12V13.5C22 14.8807 20.8807 16 19.5 16H4.5C3.11929 16 2 14.8807 2 13.5V12Z" />
      <path d="M4 16L3 20" />
      <path d="M20 16L21 20" />
      <path d="M8 6L7 2" />
      <path d="M16 6L17 2" />
      <path d="M7 2C7 2 5 2 4 4" />
      <path d="M17 2C17 2 19 2 20 4" />
    </svg>
  );
}

export function LobsterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2C12 2 13 4 15 4C17 4 18 2 18 2" />
      <path d="M12 2C12 2 11 4 9 4C7 4 6 2 6 2" />
      <path d="M14 8C14 8 16.5 7.5 18 9" />
      <path d="M10 8C10 8 7.5 7.5 6 9" />
      <path d="M17 14.29C17.7663 13.6826 18.6631 13.2505 19.6177 13.0455C20.5723 12.8404 21.562 12.8697 22.5 13.13" />
      <path d="M7 14.29C6.23371 13.6826 5.33689 13.2505 4.38233 13.0455C3.42777 12.8404 2.43805 12.8697 1.5 13.13" />
      <path d="M8 12L16 12" />
      <path d="M8 16L16 16" />
      <path d="M9 20L15 20" />
      <path d="M9 12C9 12 7.5 14 7.5 16C7.5 18 9 20 9 20" />
      <path d="M15 12C15 12 16.5 14 16.5 16C16.5 18 15 20 15 20" />
    </svg>
  );
}
