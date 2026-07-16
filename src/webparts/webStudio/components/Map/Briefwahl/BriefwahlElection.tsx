import React, { useState, useEffect } from "react";
import './CSS/Briefwahl.css';
import { addListItem } from '../../../services/SPService';
import AlertPopup from './AlertPopup';
import { isRequired, isValidEmail, isValidCaptcha, type FieldErrors } from '../../../utils/formValidation';

const REQUIRED_MSG = 'Dieses Feld ist erforderlich.';
const EMAIL_MSG = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
const PRIVACY_MSG = 'Sie müssen die Datenschutzerklärung akzeptieren.';
const CAPTCHA_MSG = 'Captcha ist falsch.';
const FORM_ERROR_MSG = 'Bitte korrigieren Sie die unten stehenden Fehler, bevor Sie absenden.';
const SUBMIT_ERROR_MSG = 'Beim Senden ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.';

const BriefwahlElection = (props: any) => {
  const SmartId = props?.item?.id;
  const SmartTitle = props?.item?.Title;
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaText, setCaptchaText] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  function generateCaptcha(length = 6) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let captcha = '';
    for (let i = 0; i < length; i++) {
      captcha += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return captcha;
  }

  const [formData, setFormData] = useState({
    FirstName: "",
    LastName: "",
    Email: "",
    Ort: "",
    Country: "",
    JobTitle: "",
    Membership: "",
    Comment: "",
    Created: new Date().toISOString().slice(0, 19).replace("T", " "),
    SmartId: SmartId != undefined ? SmartId : "",
    SmartTitle: SmartTitle != undefined ? SmartTitle : "",
    acceptPrivacyPolicy: false,
    subscribeNewsletter: false,
  });

  useEffect(() => {
    setCaptchaText(generateCaptcha());
  }, []);

  const refreshCaptcha = () => {
    setCaptchaText(generateCaptcha());
    setCaptchaInput('');
    setErrors(prev => ({ ...prev, captcha: undefined }));
  };

  const getFieldError = (name: string, value?: string | boolean): string | undefined => {
    if (name === 'FirstName' || name === 'LastName') {
      return isRequired(value) ? undefined : REQUIRED_MSG;
    }
    if (name === 'Email') {
      if (!isRequired(value)) return REQUIRED_MSG;
      if (!isValidEmail(String(value))) return EMAIL_MSG;
      return undefined;
    }
    if (name === 'acceptPrivacyPolicy') {
      return value ? undefined : PRIVACY_MSG;
    }
    if (name === 'captcha') {
      return isValidCaptcha(captchaInput, captchaText) ? undefined : CAPTCHA_MSG;
    }
    return undefined;
  };

  const shouldShowError = (name: string) => (touched[name] || submitAttempted) && !!errors[name];

  const validateAll = (): FieldErrors => {
    const next: FieldErrors = {};
    const firstNameErr = getFieldError('FirstName', formData.FirstName);
    const lastNameErr = getFieldError('LastName', formData.LastName);
    const emailErr = getFieldError('Email', formData.Email);
    const privacyErr = getFieldError('acceptPrivacyPolicy', formData.acceptPrivacyPolicy);
    const captchaErr = getFieldError('captcha');
    if (firstNameErr) next.FirstName = firstNameErr;
    if (lastNameErr) next.LastName = lastNameErr;
    if (emailErr) next.Email = emailErr;
    if (privacyErr) next.acceptPrivacyPolicy = privacyErr;
    if (captchaErr) next.captcha = captchaErr;
    return next;
  };

  const handleBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const value = name === 'captcha' ? captchaInput : (formData as any)[name];
    setErrors(prev => ({ ...prev, [name]: getFieldError(name, value) }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    const nextValue = type === "checkbox" ? checked : value;
    setFormData(prev => ({ ...prev, [name]: nextValue }));
    setSubmitError(null);
    if (touched[name] || submitAttempted) {
      setErrors(prev => ({ ...prev, [name]: getFieldError(name, nextValue) }));
    } else if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleCaptchaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCaptchaInput(value);
    setSubmitError(null);
    if (touched.captcha || submitAttempted) {
      setErrors(prev => ({ ...prev, captcha: isValidCaptcha(value, captchaText) ? undefined : CAPTCHA_MSG }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setSubmitError(null);

    const newErrors = validateAll();
    if (Object.values(newErrors).some(Boolean)) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await addListItem('BriefwahlElection', formData);
      setAlertMessage("Vielen Dank für Deine Nachricht!");
      setShowAlert(true);
      setFormData({
        FirstName: "",
        LastName: "",
        Email: "",
        Ort: "",
        Country: "",
        JobTitle: "",
        Membership: "",
        Comment: "",
        Created: new Date().toISOString().slice(0, 19).replace("T", " "),
        SmartId: SmartId != undefined ? SmartId : "",
        SmartTitle: SmartTitle != undefined ? SmartTitle : "",
        acceptPrivacyPolicy: false,
        subscribeNewsletter: false,
      });
      setCaptchaInput('');
      setCaptchaText(generateCaptcha());
      setErrors({});
      setTouched({});
      setSubmitAttempted(false);
    } catch (error) {
      console.error("Error submitting form:", error);
      setSubmitError(SUBMIT_ERROR_MSG);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass = (name: string) => `form-input m-0${shouldShowError(name) ? ' border-danger' : ''}`;

  return (
    <div className="contact-form-bg">
      <div className="contact-form-container">
        {showAlert && <AlertPopup message={alertMessage} onClose={() => setShowAlert(false)} />}
        <form className="contact-form" name="AboutForm" noValidate onSubmit={handleSubmit} aria-label="Wahlkampf Kontaktformular">
          <div className="row">
            {submitAttempted && Object.values(errors).some(Boolean) && (
              <div className="col-12 mb-3" role="alert" aria-live="assertive">
                <div className="text-danger fw-bold">{FORM_ERROR_MSG}</div>
              </div>
            )}

            <div className="col-md-6 col-sm-12 mb-3">
              <label htmlFor="FirstName">Vorname<span className="text-danger" aria-hidden="true">*</span></label>
              <input
                type="text"
                id="FirstName"
                name="FirstName"
                value={formData.FirstName}
                onChange={handleChange}
                onBlur={() => handleBlur('FirstName')}
                className={fieldClass('FirstName')}
                aria-invalid={shouldShowError('FirstName') || undefined}
                aria-describedby={shouldShowError('FirstName') ? 'FirstName-error' : undefined}
                aria-required="true"
              />
              {shouldShowError('FirstName') && <small id="FirstName-error" role="alert" className="text-danger">{errors.FirstName}</small>}
            </div>

            <div className="col-md-6 col-sm-12 mb-3">
              <label htmlFor="LastName">Nachname<span className="text-danger" aria-hidden="true">*</span></label>
              <input
                type="text"
                id="LastName"
                name="LastName"
                value={formData.LastName}
                onChange={handleChange}
                onBlur={() => handleBlur('LastName')}
                className={fieldClass('LastName')}
                aria-invalid={shouldShowError('LastName') || undefined}
                aria-describedby={shouldShowError('LastName') ? 'LastName-error' : undefined}
                aria-required="true"
              />
              {shouldShowError('LastName') && <small id="LastName-error" role="alert" className="text-danger">{errors.LastName}</small>}
            </div>

            <div className="col-12 mb-3">
              <label htmlFor="Email">Email<span className="text-danger" aria-hidden="true">*</span></label>
              <input
                type="email"
                id="Email"
                name="Email"
                value={formData.Email}
                onChange={handleChange}
                onBlur={() => handleBlur('Email')}
                className={fieldClass('Email')}
                aria-invalid={shouldShowError('Email') || undefined}
                aria-describedby={shouldShowError('Email') ? 'Email-error' : undefined}
                aria-required="true"
              />
              {shouldShowError('Email') && <small id="Email-error" role="alert" className="text-danger">{errors.Email}</small>}
            </div>

            <div className="col-6 mb-3">
              <label htmlFor="Ort">Ort</label>
              <input type="text" id="Ort" name="Ort" value={formData.Ort} onChange={handleChange} className="form-input m-0" />
            </div>

            <div className="col-6 mb-3">
              <label htmlFor="Country">Land</label>
              <input type="text" id="Country" name="Country" value={formData.Country} onChange={handleChange} className="form-input m-0" />
            </div>

            <div className="col-12 mb-3">
              <label htmlFor="JobTitle">Job-Titel</label>
              <input type="text" id="JobTitle" name="JobTitle" value={formData.JobTitle} onChange={handleChange} className="form-input m-0" />
            </div>

            <div className="col-12 mb-3">
              <label htmlFor="Membership">Kreisverband - falls Mitglied bei Bündnis90/ Die Grünen</label>
              <input type="text" id="Membership" name="Membership" value={formData.Membership} onChange={handleChange} className="form-input m-0" />
            </div>

            <div className="col-12 mb-3">
              <label htmlFor="Comment">Kommentar</label>
              <textarea id="Comment" name="Comment" value={formData.Comment} onChange={handleChange} className="form-input m-0" rows={20} />
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label gap-1" htmlFor="acceptPrivacyPolicy">
                <input
                  type="checkbox"
                  id="acceptPrivacyPolicy"
                  name="acceptPrivacyPolicy"
                  checked={formData.acceptPrivacyPolicy}
                  onChange={handleChange}
                  onBlur={() => handleBlur('acceptPrivacyPolicy')}
                  aria-invalid={shouldShowError('acceptPrivacyPolicy') || undefined}
                  aria-describedby={shouldShowError('acceptPrivacyPolicy') ? 'acceptPrivacyPolicy-error' : undefined}
                  aria-required="true"
                />
                Ich akzeptiere die <span>
                  <a href="/Datenschutz" target="_blank" rel="noopener noreferrer" className="privacy-policy-link">Datenschutzerklärung</a>
                </span>
                <span className="text-danger" aria-hidden="true">*</span>
              </label>
              {shouldShowError('acceptPrivacyPolicy') && (
                <span id="acceptPrivacyPolicy-error" role="alert" className="error-text">{errors.acceptPrivacyPolicy}</span>
              )}
            </div>

            <div className="checkbox-group">
              <label className="align-items-baseline checkbox-label gap-1" htmlFor="subscribeNewsletter">
                <input type="checkbox" id="subscribeNewsletter" name="subscribeNewsletter" checked={formData.subscribeNewsletter} onChange={handleChange} />
                <span>Ich will bei Grüne-Weltweit mitmachen. Kontaktiert mich gerne zu Neuigkeiten in meiner Region. (Hinweis zum&nbsp;
                  <a href="/Datenschutz" target="_blank" rel="noopener noreferrer" className="privacy-policy-link">Datenschutz</a>)
                </span>
              </label>
            </div>

            <div className="captcha-container">
              <span className="valign-middle">Geben Sie das Wort ein:
                <span className="captcha-label" aria-hidden="true">{captchaText}</span>
                <button type="button" className="captcha-refresh-icon border-0 bg-transparent p-0" onClick={refreshCaptcha} title="CAPTCHA aktualisieren" aria-label="CAPTCHA aktualisieren">
                  <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38" fill="none" aria-hidden="true">
                    <path fillRule="evenodd" clipRule="evenodd" d="M16.8028 0.55394C12.3641 1.35957 9.3989 2.67104 6.605 5.064C4.08809 7.2198 2.45521 9.5152 1.08484 12.824C0.629632 13.9229 0.692932 14.0664 1.78533 14.4106C2.32563 14.581 2.78366 14.6944 2.803 14.6626C2.82234 14.6308 3.02489 14.13 3.25311 13.5498C5.2682 8.4272 9.4215 4.74453 14.8688 3.2502C16.9568 2.67737 20.7902 2.66489 22.8688 3.22418C26.0462 4.07904 28.2727 5.3077 30.5479 7.4615C32.0222 8.8572 33.8578 11.2667 33.8578 11.8063C33.8578 12.0103 33.3686 12.0553 31.1513 12.0553C28.1711 12.0553 28.2314 12.0317 28.2314 13.1982C28.2314 14.4031 27.9728 14.341 32.9975 14.341H37.5501V9.7696V5.1982H36.4128H35.2754L35.226 7.234L35.1764 9.2699L34.0076 7.7821C30.4693 3.27816 25.3505 0.71904 19.5281 0.54321C18.271 0.50524 17.0446 0.50998 16.8028 0.55394ZM34.5994 24.8465C33.7458 26.9298 32.8496 28.3229 31.3192 29.9456C28.2222 33.2291 24.6347 34.94 19.9647 35.3604C17.7187 35.5626 14.3882 34.9047 11.9462 33.7764C10.2231 32.9803 8.3379 31.653 7.0145 30.3041C5.8905 29.1586 4.14348 26.7574 4.14348 26.3582C4.14348 26.1838 4.77135 26.1189 6.8248 26.0819L9.5061 26.0333L9.5582 24.8465L9.61 23.6597H5.0307H0.451172V28.319V32.9784H1.59403H2.73689V30.8432V28.708L3.3855 29.5684C6.7225 33.9957 11.0238 36.6424 16.0837 37.3822C18.1308 37.6817 21.9388 37.5104 23.7275 37.0387C27.8905 35.9407 31.7384 33.3571 34.3666 29.8957C35.3438 28.6086 36.9382 25.5466 37.1267 24.5954C37.2352 24.0472 37.2197 24.0312 36.3068 23.7603C35.795 23.6082 35.3271 23.4839 35.267 23.4839C35.2069 23.4839 34.9064 24.0971 34.5994 24.8465Z" fill="#008939" />
                  </svg>
                </button>
              </span>
              <label htmlFor="captcha" className="sr-only">CAPTCHA eingeben</label>
              <input
                type="text"
                id="captcha"
                value={captchaInput}
                onChange={handleCaptchaChange}
                onBlur={() => handleBlur('captcha')}
                placeholder="Geben Sie CAPTCHA ein"
                className={`form-control${shouldShowError('captcha') ? ' border-danger' : ''}`}
                aria-invalid={shouldShowError('captcha') || undefined}
                aria-describedby={shouldShowError('captcha') ? 'captcha-error' : undefined}
                aria-required="true"
                autoComplete="off"
              />
              {shouldShowError('captcha') && <small id="captcha-error" role="alert" className="text-danger">{errors.captcha}</small>}
            </div>

            {submitError && (
              <div className="col-12 mb-3" role="alert" aria-live="assertive">
                <div className="text-danger fw-bold">{submitError}</div>
              </div>
            )}

            <div className="col-12">
              <button
                type="submit"
                className="submit-button"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? 'Wird gesendet...' : 'Absenden'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BriefwahlElection;
