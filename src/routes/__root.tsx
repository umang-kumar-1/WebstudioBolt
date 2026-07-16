import type { ReactNode } from 'react';
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router';

import { AuthGate } from '../components/AuthGate';
import { UserSessionBar } from '../components/UserSessionBar';
import { MicrosoftAuthProvider } from '../lib/auth/MicrosoftAuthProvider';

import '../index.css';
import '../webparts/webStudio/webStudioStyles';

const RouteSwitcher = () => {
  const linkClass =
    'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap bg-white/90 text-gray-700 hover:bg-gray-100 [&.active]:bg-blue-600 [&.active]:text-white';

  return (
    <div className="group fixed bottom-2 left-2 z-[10000]">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800/70 text-white shadow-lg backdrop-blur transition-opacity group-hover:opacity-0 group-focus-within:opacity-0"
        aria-hidden="true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 flex gap-1 rounded-lg bg-gray-200/90 p-1 opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <Link to="/studio/$" params={{ _splat: '' }} className={linkClass} activeProps={{ className: 'active' }}>
          Studio
        </Link>
        <Link to="/images" className={linkClass} activeProps={{ className: 'active' }}>
          Images
        </Link>
        <Link to="/backup" className={linkClass} activeProps={{ className: 'active' }}>
          Backup
        </Link>
      </div>
    </div>
  );
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { httpEquiv: 'Cache-Control', content: 'no-cache, no-store, must-revalidate' },
      { httpEquiv: 'Pragma', content: 'no-cache' },
      { httpEquiv: 'Expires', content: '0' },
      { title: 'Web Studio' },
    ],
    links: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div id="root">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <MicrosoftAuthProvider>
      <AuthGate>
        <UserSessionBar />
        <RouteSwitcher />
        <Outlet />
      </AuthGate>
    </MicrosoftAuthProvider>
  );
}
