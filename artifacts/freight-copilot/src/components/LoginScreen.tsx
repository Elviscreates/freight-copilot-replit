import { useState, FormEvent } from "react";
import { login } from "../lib/auth";
import { useLocation } from "wouter";
import { Mail, LockKeyhole, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";

const markSrc = `${import.meta.env.BASE_URL}branding/freight-copilot-mark.png`;
const logoSrc = `${import.meta.env.BASE_URL}branding/freight-copilot-logo.png`;

const loginStyles = `
.fcl {
  --u: clamp(1.05px, min(0.1721vw, 0.32vh), 3.4px);
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #111826;
  font-family: 'Geist', 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.fcl-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #111826;
}
.fcl-content {
  width: calc(196 * var(--u));
  margin: 0 auto;
  padding-top: calc(19 * var(--u));
  display: flex;
  flex-direction: column;
}
.fcl-brand {
  display: flex;
  align-items: center;
  gap: calc(3 * var(--u));
}
.fcl-brand > img {
  height: calc(26 * var(--u));
  width: auto;
  display: block;
}
.fcl-wordmark {
  display: grid;
  line-height: calc(13 * var(--u));
  letter-spacing: .085em;
  font-size: calc(14.5 * var(--u));
  font-weight: 700;
}
.fcl-wordmark span { color: #22CEC8; }
.fcl-wordmark strong { color: #ffffff; font-weight: 700; }
.fcl-heading {
  margin: calc(28 * var(--u)) 0 0;
  color: #ffffff;
  font-size: calc(18.5 * var(--u));
  font-weight: 700;
  letter-spacing: .04em;
  line-height: 1;
}
.fcl-sub {
  margin: calc(7 * var(--u)) 0 0;
  max-width: calc(190 * var(--u));
  color: #8A93A5;
  font-size: calc(8.7 * var(--u));
  line-height: calc(12 * var(--u));
  font-weight: 400;
}
.fcl-form {
  display: flex;
  flex-direction: column;
  margin-top: calc(13 * var(--u));
}
.fcl-field {
  display: flex;
  flex-direction: column;
}
.fcl-field + .fcl-field { margin-top: calc(10 * var(--u)); }
.fcl-label {
  color: #D6DCE6;
  font-size: calc(8.7 * var(--u));
  line-height: calc(11 * var(--u));
  font-weight: 600;
  letter-spacing: .01em;
}
.fcl-inputbox {
  margin-top: calc(1.5 * var(--u));
  height: calc(21 * var(--u));
  width: 100%;
  display: flex;
  align-items: center;
  gap: calc(4 * var(--u));
  padding: 0 calc(4.5 * var(--u));
  border: 1px solid #2C3A4E;
  border-radius: calc(5 * var(--u));
  background: #1F2B3B;
  transition: border-color .15s, box-shadow .15s;
}
.fcl-inputbox .fcl-prefix-ico {
  width: calc(8.1 * var(--u));
  height: calc(8.1 * var(--u));
  flex: 0 0 auto;
  color: #8A94A4;
}
.fcl-inputbox input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: #ffffff;
  font-size: calc(9.5 * var(--u));
  font-family: inherit;
}
.fcl-inputbox input::placeholder { color: #8A94A8; opacity: 1; }
.fcl-inputbox:focus-within {
  border-color: #2FB3AB;
  box-shadow: 0 0 0 calc(1.5 * var(--u)) rgba(47, 179, 171, .22);
}
.fcl-pw { position: relative; }
.fcl-pw input { padding-right: calc(8 * var(--u)); }
.fcl-eye {
  position: absolute;
  right: calc(3.5 * var(--u));
  bottom: calc(1.5 * var(--u));
  width: calc(11 * var(--u));
  height: calc(18.5 * var(--u));
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #8A94A4;
  transition: color .15s;
}
.fcl-eye:hover { color: #ffffff; }
.fcl-eye svg { width: calc(9 * var(--u)); height: calc(9 * var(--u)); display: block; }
.fcl-eye:focus-visible { outline: 2px solid #2FD8CB; outline-offset: 2px; border-radius: 4px; }
.fcl-error {
  margin: calc(8 * var(--u)) 0 0;
  color: #ff6b6b;
  font-size: calc(8.4 * var(--u));
  line-height: 1.35;
}
.fcl-remember {
  display: flex;
  align-items: center;
  gap: calc(4 * var(--u));
  margin-top: calc(7.5 * var(--u));
  color: #D6DCE6;
  font-size: calc(8.7 * var(--u));
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  width: max-content;
}
.fcl-remember input {
  appearance: none;
  -webkit-appearance: none;
  width: calc(10 * var(--u));
  height: calc(10 * var(--u));
  margin: 0;
  border: 1px solid #36445C;
  border-radius: calc(2.5 * var(--u));
  background: #1B2536;
  cursor: pointer;
  flex: 0 0 auto;
  transition: background .15s, border-color .15s;
}
.fcl-remember input:checked {
  border-color: #22CEC8;
  background: #22CEC8 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230A1A22' stroke-width='4.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 13l4 4L19 7'/%3E%3C/svg%3E") center / 68% no-repeat;
}
.fcl-remember input:focus-visible { outline: 2px solid #2FD8CB; outline-offset: 2px; }
.fcl-submit {
  margin-top: calc(9 * var(--u));
  height: calc(22 * var(--u));
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: calc(4 * var(--u));
  border: 0;
  border-radius: calc(5 * var(--u));
  background: #1EDED3;
  color: #0A1A22;
  font-size: calc(8.3 * var(--u));
  font-family: inherit;
  font-weight: 600;
  letter-spacing: .01em;
  transition: background .15s, transform .15s;
}
.fcl-submit .fcl-arrow { width: calc(11 * var(--u)); height: calc(11 * var(--u)); }
.fcl-spin { width: calc(11 * var(--u)); height: calc(11 * var(--u)); animation: fclspin 1s linear infinite; }
@keyframes fclspin { to { transform: rotate(360deg); } }
.fcl-submit:hover:not(:disabled) { background: #3CE7DD; transform: translateY(-1px); }
.fcl-submit:active:not(:disabled) { transform: translateY(0); }
.fcl-submit:focus-visible { outline: 2px solid #2FD8CB; outline-offset: 2px; }
.fcl-submit:disabled { opacity: .72; cursor: not-allowed; }
.fcl-notice {
  margin: calc(-1.75 * var(--u)) 0 0;
  color: #ffcd36;
  font-size: calc(5.2 * var(--u));
  line-height: 1.5;
  text-align: center;
}
.fcl-divider {
  display: flex;
  align-items: center;
  gap: calc(5.8 * var(--u));
  margin: calc(8.7 * var(--u)) 0 calc(5.8 * var(--u));
  color: #999999;
  font-size: calc(4.6 * var(--u));
}
.fcl-divider::before,
.fcl-divider::after {
  content: '';
  height: 1px;
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
}
.fcl-providers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: calc(4 * var(--u));
}
.fcl-providers button {
  height: calc(18.6 * var(--u));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: calc(3.5 * var(--u));
  padding: 0 calc(2.9 * var(--u));
  border: 1px solid #2C3A4E;
  border-radius: calc(4.6 * var(--u));
  color: #C0CAD6;
  background: #192430;
  font-size: calc(5.2 * var(--u));
  font-family: inherit;
  font-weight: 500;
  transition: border-color .15s, background .15s, transform .15s;
}
.fcl-providers button:hover {
  border-color: #3B4C63;
  background: #1F2B3B;
  transform: translateY(-1px);
}
.fcl-providers button:focus-visible { outline: 2px solid #2FD8CB; outline-offset: 2px; }
.fcl-prov-google {
  color: #0099ff;
  font-size: calc(7.5 * var(--u));
  font-weight: 700;
  line-height: 1;
}
.fcl-prov-ms {
  width: calc(7 * var(--u));
  height: calc(7 * var(--u));
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: calc(0.6 * var(--u));
  flex: 0 0 auto;
}
.fcl-prov-ms i { display: block; }
.fcl-prov-ms i:nth-child(1) { background: #f35325; }
.fcl-prov-ms i:nth-child(2) { background: #81bc06; }
.fcl-prov-ms i:nth-child(3) { background: #05a6f0; }
.fcl-prov-ms i:nth-child(4) { background: #ffba08; }
.fcl-prov-ico { width: calc(8.1 * var(--u)); height: calc(8.1 * var(--u)); }
.fcl-admin {
  margin: calc(11.6 * var(--u)) 0 0;
  color: #999999;
  font-size: calc(5.2 * var(--u));
  text-align: center;
}
.fcl-admin button {
  padding: 0;
  border: 0;
  color: #22CEC8;
  background: transparent;
  font-size: inherit;
  font-family: inherit;
  text-decoration: underline;
  text-underline-offset: calc(1.2 * var(--u));
  cursor: pointer;
}
.fcl-admin button:hover { color: #3CE7DD; }
.fcl-admin button:focus-visible { outline: 2px solid #2FD8CB; outline-offset: 2px; border-radius: 4px; }
.fcl-visual {
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  padding-top: calc(102.5 * var(--u));
  background:
    radial-gradient(ellipse calc(170 * var(--u)) calc(165 * var(--u)) at 101% 0%, rgba(34, 218, 201, .66), rgba(34, 218, 201, 0) 86%),
    radial-gradient(ellipse calc(60 * var(--u)) calc(105 * var(--u)) at -1% 50%, rgba(34, 218, 201, .62), rgba(34, 218, 201, 0) 80%),
    #202C3C;
}
.fcl-lockup {
  position: relative;
  width: calc(181 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: scaleY(1.045);
  transform-origin: top center;
}
.fcl-lockup-art { position: relative; width: 100%; }
.fcl-lockup-art img { width: 100%; display: block; }
.fcl-lockup-copilot {
  position: absolute;
  inset: 0;
  filter: grayscale(1) brightness(1.55);
  clip-path: inset(82.5% 0 0 0);
}
.fcl-tagline {
  margin: calc(1.2 * var(--u)) 0 0;
  color: #999999;
  font-family: var(--app-font-mono, 'Geist Mono', monospace);
  font-size: calc(5.2 * var(--u));
  letter-spacing: .12em;
  text-align: center;
  white-space: nowrap;
}
@media (max-width: 820px) {
  .fcl {
    --u: clamp(1.15px, calc(100vw / 250), 2.6px);
    grid-template-columns: 1fr;
  }
  .fcl-content {
    width: min(calc(196 * var(--u)), calc(100% - 48px));
    padding-bottom: calc(28 * var(--u));
  }
  .fcl-visual { display: none; }
}
`;

export default function LoginScreen() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await login(username, password);
      setLocation('/dashboard', { replace: true });
    } catch {
      setError("Invalid username or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fcl">
      <style>{loginStyles}</style>

      <section className="fcl-panel" aria-label="Sign in to Freight Copilot">
        <div className="fcl-content">
          <div className="fcl-brand">
            <img src={markSrc} alt="" />
            <span className="fcl-wordmark">
              <span>FREIGHT</span>
              <strong>COPILOT</strong>
            </span>
          </div>

          <h1 className="fcl-heading">Welcome back</h1>
          <p className="fcl-sub">Sign in to access your dispatch stream and live load pipelines.</p>

          <form className="fcl-form" onSubmit={handleSubmit}>
            <label className="fcl-field">
              <span className="fcl-label">Email Address</span>
              <span className="fcl-inputbox">
                <Mail className="fcl-prefix-ico" />
                <input
                  type="text"
                  placeholder="admin or you@company.com"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </span>
            </label>

            <label className="fcl-field">
              <span className="fcl-label">Password</span>
              <span className="fcl-inputbox fcl-pw">
                <LockKeyhole className="fcl-prefix-ico" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="fcl-eye"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
                      <circle cx="12" cy="12" r="2.6" />
                      <path d="M4 20 20 4" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
                      <circle cx="12" cy="12" r="2.6" />
                    </svg>
                  )}
                </button>
              </span>
            </label>

            <label className="fcl-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              Remember Me
            </label>

            {error && (
              <p className="fcl-error" role="alert">{error}</p>
            )}

            <button className="fcl-submit" type="submit" disabled={loading}>
              {loading
                ? <><Loader2 className="fcl-spin" aria-hidden="true" />Signing in...</>
                : <><span>Sign In</span><ArrowRight className="fcl-arrow" aria-hidden="true" /></>}
            </button>

            {notice && <p className="fcl-notice" role="status">{notice}</p>}
          </form>

          <div className="fcl-divider" aria-hidden="true"><span>Or continue with</span></div>
          <div className="fcl-providers" role="group" aria-label="Additional sign-in providers">
            <button type="button" onClick={() => setNotice('Google sign-in is ready to connect.')}>
              <span className="fcl-prov-google">G</span>Google
            </button>
            <button type="button" onClick={() => setNotice('Microsoft sign-in is ready to connect.')}>
              <span className="fcl-prov-ms" aria-hidden="true"><i /><i /><i /><i /></span>Microsoft
            </button>
            <button type="button" onClick={() => setNotice('SSO sign-in is ready to connect.')}>
              <ShieldCheck className="fcl-prov-ico" aria-hidden="true" />SSO
            </button>
          </div>
          <p className="fcl-admin">
            Don't have an account?
            {' '}
            <button type="button" onClick={() => setNotice('Contact your workspace administrator for access.')}>
              Contact your admin
            </button>
          </p>
        </div>
      </section>

      <section className="fcl-visual" aria-hidden="true">
        <div className="fcl-lockup">
          <div className="fcl-lockup-art">
            <img src={logoSrc} alt="Freight Copilot" />
            <img className="fcl-lockup-copilot" src={logoSrc} alt="" aria-hidden="true" />
          </div>
          <p className="fcl-tagline">SMARTER LOGISTICS. FASTER DELIVERIES.</p>
        </div>
      </section>
    </div>
  );
}
