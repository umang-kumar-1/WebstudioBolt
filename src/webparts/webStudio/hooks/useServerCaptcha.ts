import { useCallback, useEffect, useRef, useState } from 'react';
import { requestCaptchaChallenge } from '../utils/contactFormApi';

export interface UseServerCaptchaOptions {
  captchaApiUrl?: string;
  loadErrorMessage?: string;
}

export function useServerCaptcha(options: UseServerCaptchaOptions = {}) {
  const { captchaApiUrl, loadErrorMessage = 'Failed to load CAPTCHA.' } = options;
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const captchaIdRef = useRef<string | null>(null);

  const loadCaptcha = useCallback(async (invalidatePrevious = true) => {
    setLoading(true);
    setError(null);

    try {
      const previousId = invalidatePrevious ? captchaIdRef.current : null;
      const challenge = await requestCaptchaChallenge(previousId, captchaApiUrl);
      captchaIdRef.current = challenge.captchaId;
      setCaptchaId(challenge.captchaId);
      setImageUrl(challenge.imageUrl);
    } catch (err) {
      captchaIdRef.current = null;
      setCaptchaId(null);
      setImageUrl(null);
      setError(loadErrorMessage);
      console.error('CAPTCHA load error:', err);
    } finally {
      setLoading(false);
    }
  }, [captchaApiUrl, loadErrorMessage]);

  useEffect(() => {
    void loadCaptcha(false);
  }, [loadCaptcha]);

  const refreshCaptcha = useCallback(async () => {
    await loadCaptcha(true);
  }, [loadCaptcha]);

  return {
    captchaId,
    imageUrl,
    loading,
    error,
    refreshCaptcha,
  };
}
