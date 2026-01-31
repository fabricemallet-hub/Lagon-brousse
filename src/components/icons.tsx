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
      <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-2.5-5.5-3.5a7 7 0 0 0-7 7c0 2 1 3.9 3 5.5s3.5 2.5 5.5 3.5z" />
      <path d="M2 13.2A12 12 0 0 0 12 22a12 12 0 0 0 10-8.8" />
      <path d="M2 10.5V6.2c0-1.2.9-2.2 2.2-2.2h1.3" />
    </svg>
  );
}
