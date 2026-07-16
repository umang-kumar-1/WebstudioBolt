import { createFileRoute } from '@tanstack/react-router';
import '../webparts/webStudio/assets/tailwind.css';
import '../webparts/webStudio/post-tailwind-overrides.css';
import SiteDataBackupTool from '../webparts/dataBackupTool/components/DataBackupTool';

const BackupPage = () => {
  const siteLabelUrl = `${(import.meta.env.VITE_SP_HOSTNAME as string) || ''}${(import.meta.env.VITE_SP_SITE_PATH as string) || ''}`;
  return (
    <div className="min-h-screen w-screen overflow-auto bg-gray-50 p-6">
      <SiteDataBackupTool SPBackupConfigListUrl={siteLabelUrl} Context={{}} />
    </div>
  );
};

export const Route = createFileRoute('/backup')({
  head: () => ({ meta: [{ title: 'Data Backup Tool' }] }),
  ssr: false,
  component: BackupPage,
});
