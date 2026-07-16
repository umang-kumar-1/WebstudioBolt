import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  beforeLoad: ({ location }) => {
    // Preserve MSAL auth callback query/hash when sending users to /studio.
    throw redirect({
      to: '/studio/$',
      params: { _splat: '' },
      search: location.search,
      hash: location.hash,
    });
  },
}); 
