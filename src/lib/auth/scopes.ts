/** Minimal scope for interactive sign-in — avoids consent errors at login. */
export const loginScopes = ['User.Read'] as const;

/** Graph scopes acquired silently after sign-in (SharePoint list/file CRUD). */
export const graphDelegatedScopes = ['User.Read', 'Sites.ReadWrite.All', 'Files.ReadWrite.All'] as const;

export const sharePointResourceScopes = (): string[] => {
  const hostname = import.meta.env.VITE_SP_HOSTNAME as string | undefined;
  if (!hostname) return [];
  return [`https://${hostname}/.default`];
};

/** Scopes for loginRedirect — keep minimal; extra scopes come from acquireTokenSilent. */
export const getLoginRequestScopes = (): string[] => [...loginScopes];
