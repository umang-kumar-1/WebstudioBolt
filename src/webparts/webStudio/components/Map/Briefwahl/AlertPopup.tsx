import React from 'react';
const AlertPopup = ({ message, onClose }: { message: string; onClose: () => void }) => {
    return (
        <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="alert-popup-message"
            style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
        }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '4px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
                <p id="alert-popup-message" role="status">{message}</p>
                <button type="button" onClick={onClose} style={{ marginTop: '10px', padding: '5px 15px', cursor: 'pointer' }}>OK</button>
            </div>
        </div>
    );
};

export default AlertPopup;
