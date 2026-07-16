import { createFileRoute } from '@tanstack/react-router';
import WebStudio from '../webparts/webStudio/main/WebStudio';

export const Route = createFileRoute('/studio/$')({
  head: () => ({ meta: [{ title: 'Web Studio' }] }),
  ssr: false,
  component: () => <WebStudio />,
});
