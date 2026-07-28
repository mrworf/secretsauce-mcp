import { type FormEvent, useRef, useState } from "react";
import QRCode from "qrcode";
import brandLockup from "../../assets/brand/secretsauce-lockup.png";
import {
  browserControlApi,
  type EnrollmentControlApi,
} from "./controlApi";

type Step = "verify" | "password" | "totp";

export function EnrollmentPage({
  api = browserControlApi,
  navigate = (url) => window.location.assign(url),
}: {
  api?: EnrollmentControlApi;
  navigate?: (url: string) => void;
}) {
  const [step, setStep] = useState<Step>("verify");
  const [email, setEmail] = useState("");
  const [enrollmentCode, setEnrollmentCode] = useState("");
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [totp, setTotp] = useState("");
  const [csrf, setCsrf] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);

  function advance(next: Step) {
    setStep(next);
    setMessage("");
    queueMicrotask(() => heading.current?.focus());
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await api.enrollmentLogin({
        email,
        enrollment_code: enrollmentCode,
      });
      setEnrollmentCode("");
      setCsrf(result.csrf_token);
      advance("password");
    } catch {
      setEnrollmentCode("");
      setMessage("Enrollment details are invalid or expired. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function choosePassword(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await api.beginEnrollment({
        csrf_token: csrf,
        new_password: password,
        given_name: givenName,
        family_name: familyName,
      });
      setCsrf(result.csrf_token);
      setManualKey(result.secret);
      setOtpauthUri(result.otpauth_uri);
      setQrSvg(await QRCode.toString(result.otpauth_uri, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 1,
      }));
      advance("totp");
    } catch {
      setMessage("Enrollment could not continue. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function complete(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api.confirmEnrollment({
        csrf_token: csrf,
        new_password: password,
        totp,
      });
      clearSecrets();
      navigate("/control/login?enrollment=complete");
    } catch {
      setTotp("");
      setMessage("Enrollment could not be completed. Start again and try a fresh code.");
    } finally {
      setBusy(false);
    }
  }

  function clearSecrets() {
    setEnrollmentCode("");
    setPassword("");
    setConfirmation("");
    setTotp("");
    setManualKey("");
    setOtpauthUri("");
    setQrSvg("");
  }

  async function copyManualKey() {
    try {
      await navigator.clipboard.writeText(manualKey);
      setCopyMessage("Manual key copied.");
    } catch {
      setCopyMessage("Manual key could not be copied.");
    }
  }

  return (
    <div className="setup-shell enrollment-shell">
      <header className="setup-header">
        <img src={brandLockup} alt="SecretSauce" />
      </header>
      <main className="setup-main">
        <section className="setup-card enrollment-card" aria-labelledby="enrollment-heading">
          <p className="eyebrow">
            Step {step === "verify" ? "1" : step === "password" ? "2" : "3"} of 3
          </p>
          <h1 id="enrollment-heading" ref={heading} tabIndex={-1}>
            {step === "verify"
              ? "Verify your enrollment"
              : step === "password"
                ? "Choose a password"
                : "Set up an authenticator"}
          </h1>
          <p className="enrollment-intro">
            {step === "verify"
              ? "Use the enrollment details supplied by your administrator."
              : step === "password"
                ? "Create your profile and a unique password of at least 12 characters."
                : "Add SecretSauce to your authenticator, then enter a fresh six-digit code."}
          </p>

          {step === "verify" && (
            <form className="profile-form" onSubmit={(event) => void verify(event)}>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                Enrollment code
                <input
                  type="password"
                  autoComplete="one-time-code"
                  required
                  value={enrollmentCode}
                  onChange={(event) => setEnrollmentCode(event.target.value)}
                />
              </label>
              <button type="submit" disabled={busy}>
                {busy ? "Checking…" : "Continue"}
              </button>
            </form>
          )}

          {step === "password" && (
            <form className="profile-form" onSubmit={(event) => void choosePassword(event)}>
              <label>
                Given name
                <input
                  autoComplete="given-name"
                  value={givenName}
                  onChange={(event) => setGivenName(event.target.value)}
                />
              </label>
              <label>
                Family name
                <input
                  autoComplete="family-name"
                  value={familyName}
                  onChange={(event) => setFamilyName(event.target.value)}
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>
              <div className="button-row">
                <button type="button" onClick={() => advance("verify")}>Back</button>
                <button type="submit" disabled={busy}>
                  {busy ? "Preparing…" : "Continue"}
                </button>
              </div>
            </form>
          )}

          {step === "totp" && (
            <form className="profile-form" onSubmit={(event) => void complete(event)}>
              <p className="sensitive-note">
                Authenticator setup is sensitive. Scan from your authenticator or use the
                manual key.
              </p>
              <div
                className="authenticator-qr"
                role="img"
                aria-label="QR code containing the sensitive authenticator setup"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <a className="otpauth-link" href={otpauthUri}>
                Open authenticator setup
              </a>
              <div className="manual-key">
                <span>Manual key</span>
                <output aria-label="Manual authenticator key">
                  {revealed ? manualKey : "•••• •••• •••• •••• •••• •••• •••• ••••"}
                </output>
                <button type="button" onClick={() => setRevealed((value) => !value)}>
                  {revealed ? "Hide" : "Reveal"}
                </button>
                <button type="button" onClick={() => void copyManualKey()}>Copy</button>
                <span className="visually-hidden" role="status" aria-live="polite">
                  {copyMessage}
                </span>
              </div>
              <label>
                6-digit code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={totp}
                  onChange={(event) => setTotp(event.target.value)}
                />
              </label>
              <div className="button-row">
                <button type="button" onClick={() => advance("password")}>Back</button>
                <button type="submit" disabled={busy}>
                  {busy ? "Completing…" : "Complete enrollment"}
                </button>
              </div>
            </form>
          )}

          <p
            className={message === "" ? "visually-hidden" : "form-error"}
            role={message === "" ? "status" : "alert"}
            aria-live="polite"
          >
            {message}
          </p>
        </section>
      </main>
      <footer className="setup-footer">Give agents access, not secrets.</footer>
    </div>
  );
}
