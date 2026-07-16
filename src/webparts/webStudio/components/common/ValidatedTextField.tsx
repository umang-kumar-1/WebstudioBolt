import React, { useRef, useState } from 'react';
import { isRequired } from '../../utils/formValidation';

let fieldIdCounter = 0;

function createFieldId() {
    fieldIdCounter += 1;
    return `ws-field-${fieldIdCounter}`;
}

export function useValidatedField(requiredMessage: string, required = true) {
    const fieldIdRef = useRef(createFieldId());
    const fieldId = fieldIdRef.current;
    const errorId = `${fieldId}-error`;
    const [value, setValue] = useState('');
    const [touched, setTouched] = useState(false);
    const [submitAttempted, setSubmitAttempted] = useState(false);

    const error = (required && !isRequired(value)) ? requiredMessage : undefined;
    const showError = !!error && (touched || submitAttempted);

    const handleChange = (next: string) => {
        setValue(next);
    };

    const handleBlur = () => setTouched(true);

    const validate = (): boolean => {
        setSubmitAttempted(true);
        setTouched(true);
        if (required && !isRequired(value)) return false;
        return true;
    };

    const inputProps = {
        id: fieldId,
        value,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleChange(e.target.value),
        onBlur: handleBlur,
        'aria-invalid': showError || undefined,
        'aria-describedby': showError ? errorId : undefined,
        'aria-required': required || undefined,
        className: `w-full border p-3 text-sm outline-none rounded-sm transition-shadow focus:ring-1 focus:ring-[var(--primary-color)] ${showError ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-[var(--primary-color)]'}`,
    } as const;

    const ErrorMessage = showError ? (
        <p id={errorId} role="alert" className="text-[10px] text-red-500 mt-1 font-bold">
            {error}
        </p>
    ) : null;

    return {
        value,
        setValue,
        fieldId,
        errorId,
        error,
        showError,
        validate,
        inputProps,
        ErrorMessage,
    };
}
