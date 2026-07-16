import * as React from 'react';
import type { LucideProps } from 'lucide-react';

const createSocialIcon = (displayName: string, children: React.ReactNode) => {
  const Icon = React.forwardRef<SVGSVGElement, LucideProps>(
    ({ size = 24, color, absoluteStrokeWidth, ...props }, ref) => (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color ?? 'currentColor'}
        strokeWidth={absoluteStrokeWidth ? 2 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {children}
      </svg>
    )
  );
  Icon.displayName = displayName;
  return Icon;
};

const createFilledSocialIcon = (displayName: string, children: React.ReactNode) => {
  const Icon = React.forwardRef<SVGSVGElement, LucideProps>(
    ({ size = 24, color, absoluteStrokeWidth: _absoluteStrokeWidth, strokeWidth: _strokeWidth, ...props }, ref) => (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={color ?? 'currentColor'}
        {...props}
      >
        {children}
      </svg>
    )
  );
  Icon.displayName = displayName;
  return Icon;
};

/** Brand-style icons (not in lucide-react); API matches Lucide icon components. */
export const Linkedin = createFilledSocialIcon('Linkedin', (
  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.899 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.069 2.069 0 1 1 0-4.138 2.069 2.069 0 0 1 0 4.138zM3.555 20.452h3.563V9H3.555v11.452z" />
));

export const Facebook = createFilledSocialIcon('Facebook', (
  <path d="M14.5 8h2V5h-2c-2.2 0-3.5 1.3-3.5 3.7V11H9v3h2v5h3v-5h2.2l.3-3H14V8.9c0-.6.2-.9.5-.9z" />
));

export const Twitter = createFilledSocialIcon('Twitter', (
  <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
));

export const Instagram = createSocialIcon('Instagram', (
  <>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </>
));
