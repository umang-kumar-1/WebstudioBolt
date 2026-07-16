import { contactApiConfig, buildCaptchaImageUrl } from '../config/api';
import type { ContactQuery } from '../types';

export const HONEYPOT_FIELD_NAME = '_ws_company';

export interface CaptchaChallenge {
  captchaId: string;
  imageUrl: string;
  expiresIn: number;
}

export interface ContactSubmissionPayload extends ContactQuery {
  captchaId: string;
  captchaAnswer: string;
  _ws_company?: string;
  formStartedAt: number;
}

export type ContactSubmitResult = {
  success: boolean;
  error?: string;
  errorCode?: string;
};

export const CAPTCHA_ERROR_CODES = new Set([
  'CAPTCHA_INVALID',
  'CAPTCHA_EXPIRED',
  'CAPTCHA_REQUIRED',
]);

const resolveCaptchaEndpoint = (captchaApiUrl?: string): string =>
  captchaApiUrl || contactApiConfig.captchaUrl;

export async function requestCaptchaChallenge(
  previousCaptchaId?: string | null,
  captchaApiUrl?: string
): Promise<CaptchaChallenge> {
  const endpoint = resolveCaptchaEndpoint(captchaApiUrl);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      previousCaptchaId: previousCaptchaId || undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `CAPTCHA request failed (${res.status})`);
  }

  const data = await res.json();
  if (!data?.success || !data?.captchaId) {
    throw new Error(data?.error || 'Failed to load CAPTCHA');
  }

  const absoluteImageUrl = data.imageUrl?.startsWith('http')
    ? data.imageUrl
    : buildCaptchaImageUrl(data.captchaId, endpoint);

  return {
    captchaId: data.captchaId,
    imageUrl: absoluteImageUrl,
    expiresIn: Number(data.expiresIn) || 300,
  };
}

export async function submitContactForm(
  payload: ContactSubmissionPayload,
  contactFormUrl = contactApiConfig.contactFormUrl
): Promise<ContactSubmitResult> {
  const res = await fetch(contactFormUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let result: any = null;
  try {
    result = await res.json();
  } catch {
    result = null;
  }

  if (!res.ok) {
    return {
      success: false,
      error: result?.error || `Server responded with ${res.status}`,
      errorCode: result?.errorCode,
    };
  }

  if (result?.success) {
    return { success: true };
  }

  return {
    success: false,
    error: result?.error || 'Unknown error from server',
    errorCode: result?.errorCode,
  };
}
