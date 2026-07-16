import React from 'react';

export const FormFieldError: React.FC<{ id: string; message: string }> = ({ id, message }) => (
    <span id={id} role="alert" className="ws-form-error">
        {message}
    </span>
);
