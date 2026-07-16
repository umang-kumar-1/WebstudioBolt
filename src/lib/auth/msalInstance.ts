import { PublicClientApplication } from '@azure/msal-browser';

import { buildMsalConfig, isMsalConfigured } from './msalConfig';

let msalInstance: PublicClientApplication | null = null;

export const getMsalInstance = (): PublicClientApplication => {
  if (!msalInstance) {
    if (!isMsalConfigured()) {
      throw new Error('MSAL is not configured. Set VITE_AZURE_TENANT_ID and VITE_AZURE_CLIENT_ID in .env');
    }
    msalInstance = new PublicClientApplication(buildMsalConfig());
  }
  return msalInstance;
};
