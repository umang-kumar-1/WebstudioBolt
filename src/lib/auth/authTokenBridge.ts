type TokenAcquirer = () => Promise<string | null>;

let userAuthRequired = false;
let graphTokenAcquirer: TokenAcquirer | null = null;
let sharePointTokenAcquirer: TokenAcquirer | null = null;

export const setUserAuthRequired = (required: boolean): void => {
  userAuthRequired = required;
};

export const isUserAuthRequired = (): boolean => userAuthRequired;

export const registerGraphTokenAcquirer = (acquirer: TokenAcquirer | null): void => {
  graphTokenAcquirer = acquirer;
};

export const registerSharePointTokenAcquirer = (acquirer: TokenAcquirer | null): void => {
  sharePointTokenAcquirer = acquirer;
};

export const tryAcquireUserGraphToken = async (): Promise<string | null> => {
  if (!graphTokenAcquirer) return null;
  return graphTokenAcquirer();
};

export const tryAcquireUserSharePointToken = async (): Promise<string | null> => {
  if (!sharePointTokenAcquirer) return null;
  return sharePointTokenAcquirer();
};
