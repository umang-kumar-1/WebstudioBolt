import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAccount } from '@azure/msal-react';

import { getSiteId, getSiteUrl } from '../../../lib/graph/siteResolver';
import { isMsalConfigured } from '../../../lib/auth/msalConfig';

/** Minimal read-only shim for SPFx `WebPartContext` fields used by copied UI components. */
export interface SPFxContextShim {
  pageContext: {
    web: { absoluteUrl: string };
    user: { displayName: string };
  };
}

interface SPServiceContextType {
  isInitialized: boolean;
  error: string | null;
  userDisplayName: string;
  siteUrl: string;
  context: SPFxContextShim;
}

const SPServiceContext = createContext<SPServiceContextType | null>(null);

interface SPServiceProviderProps {
  children: React.ReactNode;
}

/** Resolves Graph site id after user sign-in (SPFx initializeSP parity). */
export const SPServiceProvider: React.FC<SPServiceProviderProps> = ({ children }) => {
  const account = useAccount();
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');

  useEffect(() => {
    if (isMsalConfigured() && account) {
      setUserDisplayName(account.name || account.username || '');
    } else if (!isMsalConfigured()) {
      setUserDisplayName('');
    }
  }, [account]);

  useEffect(() => {
    if (isMsalConfigured() && !account) {
      setIsInitialized(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await getSiteId();
        const resolvedSiteUrl = await getSiteUrl();
        if (!cancelled) setSiteUrl(resolvedSiteUrl);
        if (!cancelled) {
          setIsInitialized(true);
          console.log('✅ Microsoft Graph / SharePoint service initialized');
        }
      } catch (err) {
        console.error('❌ Failed to initialize SharePoint (Graph) service:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account]);

  const context: SPFxContextShim = {
    pageContext: {
      web: { absoluteUrl: siteUrl },
      user: { displayName: userDisplayName },
    },
  };

  return (
    <SPServiceContext.Provider value={{ isInitialized, error, userDisplayName, siteUrl, context }}>
      {children}
    </SPServiceContext.Provider>
  );
};

export const useSPContext = (): SPServiceContextType => {
  const context = useContext(SPServiceContext);
  if (!context) {
    throw new Error('useSPContext must be used within SPServiceProvider');
  }
  return context;
};

export default SPServiceContext;
