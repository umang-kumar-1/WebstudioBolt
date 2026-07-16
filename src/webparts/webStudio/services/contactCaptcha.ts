export interface CaptchaChallenge {
    captchaId: string;
    image: string;
    expiresIn: number;
}

const DEFAULT_API_ROOT = 'https://testing.hochhuth-consulting.de/PHPAPISHAREPOINT';

export function getContactApiRoot(): string {
    const configuredRoot = (window as any).__WEBSTUDIO_API_ROOT;
    return String(configuredRoot || DEFAULT_API_ROOT).replace(/\/+$/, '');
}

export async function requestContactCaptcha(previousCaptchaId?: string): Promise<CaptchaChallenge> {
    const response = await fetch(`${getContactApiRoot()}/Captcha.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previousCaptchaId: previousCaptchaId || null }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.captchaId || !result?.image) {
        throw new Error(result?.error || 'Unable to load CAPTCHA.');
    }

    return result as CaptchaChallenge;
}
