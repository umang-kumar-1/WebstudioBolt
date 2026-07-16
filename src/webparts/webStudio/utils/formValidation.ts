export type FieldErrors = Record<string, string | undefined>;

export interface ContactFieldDef {
    id: string;
    label: string;
    type: string;
    required?: boolean;
}

export function interpolateMessage(template: string, ...values: string[]): string {
    return values.reduce(
        (message, value, index) => message.replace(new RegExp(`\\{${index}\\}`, 'g'), value),
        template
    );
}

export function isRequired(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim().length > 0;
}

export function isValidEmail(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function isCaptchaInputProvided(input: string): boolean {
    return input.trim().length > 0;
}

/** @deprecated Client-side CAPTCHA validation is disabled; validation happens on the server. */
export function isValidCaptcha(input: string, _expected?: string): boolean {
    return isCaptchaInputProvided(input);
}

export function validateContactField(
    field: ContactFieldDef,
    value: unknown,
    messages: { requiredNamed: string; invalidEmail: string },
    fieldLabel: string
): string | undefined {
    if (field.required && !isRequired(value)) {
        return interpolateMessage(messages.requiredNamed, fieldLabel);
    }
    if (field.type === 'email' && isRequired(value) && !isValidEmail(String(value))) {
        return messages.invalidEmail;
    }
    return undefined;
}

export function countFieldErrors(errors: FieldErrors): number {
    return Object.values(errors).filter(Boolean).length;
}

export function getFieldA11yProps(fieldId: string, error?: string) {
    const errorId = error ? `${fieldId}-error` : undefined;
    return {
        id: fieldId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': errorId,
        errorId,
    };
}

export function contactFieldInputClass(hasError: boolean): string {
    const base = 'ws-form-control w-full border bg-white text-sm outline-none transition-colors';
    return hasError
        ? `${base} ws-form-control--invalid border-red-300 bg-red-50/40 focus:border-red-400 focus:ring-1 focus:ring-red-100`
        : `${base} border-gray-300 focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)]/15`;
}
