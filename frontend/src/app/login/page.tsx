"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { insforge } from '@/lib/insforge';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  // Forgot-password flow: request a reset code, then set a new password.
  const [forgotMode, setForgotMode] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (showOtp) {
        // Handle OTP Verification
        const { error } = await insforge.auth.verifyEmail({
          email,
          otp,
        });
        if (error) throw error;

        // Success - user is verified and logged in
        router.push('/dashboard');
      } else if (isSignUp) {
        // Handle Signup
        const { data, error } = await insforge.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        if (data?.requireEmailVerification) {
          setMessage("OTP sent to your email. Please verify.");
          setShowOtp(true);
        } else {
          setMessage("Sign up successful! Please log in.");
          setIsSignUp(false);
        }
      } else {
        // Handle Login
        const { error } = await insforge.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          // Check if error is due to unverified email
          if (error.message.toLowerCase().includes('email not confirmed') || error.message.toLowerCase().includes('verification required')) {
            // Trigger resend and show OTP UI
            await insforge.auth.resendVerificationEmail({ email, redirectTo: window.location.href });
            setMessage("Email verification required. We've sent a new OTP to your email.");
            setShowOtp(true);
            return;
          }
          throw error;
        }

        // Navigate to dashboard
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await insforge.auth.sendResetPasswordEmail({ email });
      if (error) throw error;
      setMessage(`We sent a password reset code to ${email}.`);
      setForgotMode(false);
      setResetMode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await insforge.auth.resetPassword({ otp, newPassword });
      if (error) throw error;
      // Success — return to the sign-in form with the new password ready to use.
      setResetMode(false);
      setOtp('');
      setNewPassword('');
      setPassword('');
      setMessage('Password reset successfully. Please sign in with your new password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const exitForgotFlow = () => {
    setForgotMode(false);
    setResetMode(false);
    setOtp('');
    setNewPassword('');
    setError(null);
    setMessage(null);
  };

  const heading = forgotMode
    ? 'Reset your password'
    : resetMode
    ? 'Set a new password'
    : showOtp
    ? 'Verify your email'
    : isSignUp
    ? 'Create your account'
    : 'Welcome back';
  const sub = forgotMode
    ? "Enter your email and we'll send you a reset code."
    : resetMode
    ? `Enter the code we sent to ${email || 'your inbox'} and choose a new password.`
    : showOtp
    ? `Enter the 6-digit code we sent to ${email || 'your inbox'}.`
    : isSignUp
    ? 'Start troubleshooting your clusters with AI.'
    : 'Sign in to access your Kubric dashboard.';

  return (
    <div className="au">
      {/* ── left brand panel ── */}
      <aside className="au-brand">
        <div className="au-brand-bg" aria-hidden />
        <div className="au-brand-glow" aria-hidden />
        <Link className="au-brand-logo" href="/">
          <img src="/kubric-logo.png" alt="Kubric" />
          <span className="au-wordmark"><span className="k">K</span>UBRIC</span>
        </Link>
        <div className="au-brand-mid">
          <h1 className="au-brand-title">The autonomous SRE<br />for Kubernetes.</h1>
          <p className="au-brand-lede">
            Kubric diagnoses cluster failures, pinpoints root causes, and ships fixes — in seconds, not stand-ups.
          </p>
          <ul className="au-brand-list">
            <li><span className="au-tick">✓</span> Root-cause analysis in seconds</li>
            <li><span className="au-tick">✓</span> Read-only by default, fix on approval</li>
            <li><span className="au-tick">✓</span> Works across every cluster and cloud</li>
          </ul>
        </div>
        <div className="au-brand-foot">© 2026 Kubric Labs, Inc.</div>
      </aside>

      {/* ── right form panel ── */}
      <main className="au-main">
        {!showOtp && !forgotMode && !resetMode && (
          <button
            type="button"
            className="au-topright"
            onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}
          >
            {isSignUp ? 'Have an account? Sign in →' : 'Need an account? Create one →'}
          </button>
        )}
        <div className="au-card">
          <Link className="au-mobile-logo" href="/">
            <img src="/kubric-logo.png" alt="" />
            <span className="au-wordmark"><span className="k">K</span>UBRIC</span>
          </Link>

          <div className="au-head">
            <h2 className="au-title">{heading}</h2>
            <p className="au-sub">{sub}</p>
          </div>

          <form className="au-form" onSubmit={forgotMode ? handleForgotRequest : resetMode ? handleResetPassword : handleAuth}>
            <div className="au-field">
              <label className="au-label">Email address</label>
              <input
                type="email"
                required
                readOnly={showOtp || resetMode}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={`au-input ${showOtp || resetMode ? 'is-locked' : ''}`}
              />
            </div>

            {!showOtp && !forgotMode && !resetMode && (
              <div className="au-field">
                <label className="au-label">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="au-input"
                />
              </div>
            )}

            {!showOtp && !isSignUp && !forgotMode && !resetMode && (
              <div className="au-row">
                <label className="au-remember">
                  <input type="checkbox" defaultChecked /> Remember me
                </label>
                <a
                  className="au-forgot"
                  href="#"
                  onClick={(e) => { e.preventDefault(); setForgotMode(true); setError(null); setMessage(null); }}
                >
                  Forgot?
                </a>
              </div>
            )}

            {(showOtp || resetMode) && (
              <div className="au-field">
                <label className="au-label">6-digit code</label>
                <input
                  type="text"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  maxLength={6}
                  className="au-input au-otp"
                />
              </div>
            )}

            {resetMode && (
              <div className="au-field">
                <label className="au-label">New password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="au-input"
                />
              </div>
            )}

            {error && <div className="au-alert au-alert-err">{error}</div>}
            {message && <div className="au-alert au-alert-ok">{message}</div>}

            <button type="submit" disabled={loading} className="au-btn">
              {loading ? (
                <span className="au-spin" />
              ) : (
                <>
                  {forgotMode
                    ? 'Send reset code'
                    : resetMode
                    ? 'Reset password'
                    : showOtp
                    ? 'Verify email'
                    : isSignUp
                    ? 'Create account'
                    : 'Sign in'}
                  <span className="au-arrow">→</span>
                </>
              )}
            </button>

            {showOtp && (
              <button type="button" onClick={() => setShowOtp(false)} className="au-ghost">
                Cancel verification
              </button>
            )}

            {(forgotMode || resetMode) && (
              <button type="button" onClick={exitForgotFlow} className="au-ghost">
                Back to sign in
              </button>
            )}
          </form>

          {!showOtp && !forgotMode && !resetMode && (
            <>
              <div className="au-divider"><span>or</span></div>
              <p className="au-switch">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}>
                  {isSignUp ? 'Sign in' : 'Sign up'}
                </button>
              </p>
            </>
          )}
        </div>
      </main>

      <style>{`
        .au {
          min-height: 100vh; width: 100%; display: grid; grid-template-columns: 1.05fr 1fr;
          background: #0a0b0d; color: #e9edf1;
          font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
        }

        /* left brand */
        .au-brand { position: relative; overflow: hidden; padding: 44px 56px; display: flex; flex-direction: column; justify-content: space-between; border-right: 0.5px solid rgba(124,255,178,0.12); }
        .au-brand-bg { position: absolute; inset: 0; background-image: linear-gradient(rgba(124,255,178,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,255,178,0.05) 1px, transparent 1px); background-size: 30px 30px; mask-image: radial-gradient(circle at 30% 40%, #000 0%, transparent 72%); pointer-events: none; }
        .au-brand-glow { position: absolute; top: -120px; left: -120px; width: 460px; height: 460px; background: radial-gradient(circle, rgba(124,255,178,0.16), transparent 60%); pointer-events: none; animation: au-breathe 7s ease-in-out infinite; }
        @keyframes au-breathe { 0%,100%{ opacity:.6; transform: scale(1) } 50%{ opacity:1; transform: scale(1.1) } }
        .au-brand-logo { position: relative; display: inline-flex; align-items: center; gap: 11px; text-decoration: none; }
        .au-brand-logo img { height: 56px; width: auto; transform: translateY(3px); }
        .au-wordmark { font-family: "Fredoka", system-ui, sans-serif; font-weight: 600; font-size: 22px; letter-spacing: 0.1em; color: #f4f7f9; transform: translateY(-1px); }
        .au-wordmark .k { color: #7cffb2; }
        .au-brand-mid { position: relative; }
        .au-brand-title { font-family: var(--font-lexend), system-ui, sans-serif; font-size: clamp(30px, 3vw, 42px); font-weight: 400; line-height: 1.1; letter-spacing: -0.02em; color: #f4f7f9; margin: 0 0 16px; }
        .au-brand-lede { font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.55); max-width: 400px; margin: 0 0 28px; }
        .au-brand-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 13px; }
        .au-brand-list li { display: flex; align-items: center; gap: 11px; font-size: 14px; color: rgba(255,255,255,0.72); }
        .au-tick { width: 20px; height: 20px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; color: #7cffb2; background: rgba(124,255,178,0.1); border: 0.5px solid rgba(124,255,178,0.3); }
        .au-brand-foot { position: relative; font-family: var(--font-jetbrains-mono), monospace; font-size: 11px; color: rgba(255,255,255,0.3); }

        /* right form */
        .au-main { position: relative; display: flex; align-items: center; justify-content: center; padding: 40px 24px; }
        .au-topright { position: absolute; top: 32px; right: 40px; background: none; border: none; cursor: pointer; font-family: inherit; font-size: 13px; color: rgba(255,255,255,0.5); transition: color .2s ease; }
        .au-topright:hover { color: #7cffb2; }
        .au-row { display: flex; align-items: center; justify-content: space-between; margin-top: -2px; }
        .au-remember { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: rgba(255,255,255,0.55); cursor: pointer; }
        .au-remember input { width: 14px; height: 14px; accent-color: #7cffb2; cursor: pointer; }
        .au-forgot { font-size: 12.5px; color: rgba(255,255,255,0.55); text-decoration: none; }
        .au-forgot:hover { color: #7cffb2; }
        .au-card { width: 100%; max-width: 400px; }
        .au-mobile-logo { display: none; align-items: center; gap: 4px; margin-bottom: 24px; text-decoration: none; }
        .au-mobile-logo img { height: 40px; }
        .au-head { margin-bottom: 28px; }
        .au-title { font-family: var(--font-lexend), system-ui, sans-serif; font-size: 26px; font-weight: 400; letter-spacing: -0.01em; color: #f4f7f9; margin: 0 0 7px; }
        .au-sub { font-size: 14px; color: rgba(255,255,255,0.5); margin: 0; line-height: 1.5; }

        .au-form { display: flex; flex-direction: column; gap: 16px; }
        .au-field { display: flex; flex-direction: column; gap: 7px; }
        .au-label { font-size: 12px; font-weight: 400; color: rgba(255,255,255,0.6); }
        .au-input {
          width: 100%; padding: 12px 14px; font-size: 14px; font-family: inherit;
          color: #eef2f5; background: rgba(255,255,255,0.03);
          border: 0.5px solid rgba(255,255,255,0.14); outline: none;
          transition: border-color .2s ease, background .2s ease, box-shadow .2s ease;
        }
        .au-input::placeholder { color: rgba(255,255,255,0.28); }
        .au-input:focus { border-color: rgba(124,255,178,0.6); background: rgba(124,255,178,0.04); box-shadow: 0 0 0 3px rgba(124,255,178,0.08); }
        .au-input.is-locked { opacity: 0.55; cursor: not-allowed; }
        .au-otp { font-family: var(--font-jetbrains-mono), monospace; letter-spacing: 6px; font-size: 18px; text-align: center; }

        .au-alert { font-size: 12.5px; padding: 10px 12px; border: 0.5px solid transparent; }
        .au-alert-err { color: #ff9b9b; background: rgba(255,107,107,0.08); border-color: rgba(255,107,107,0.3); }
        .au-alert-ok { color: #7cffb2; background: rgba(124,255,178,0.07); border-color: rgba(124,255,178,0.3); }

        .au-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 13px; margin-top: 4px; cursor: pointer;
          font-size: 14px; font-weight: 400; font-family: inherit; color: #05140c;
          background: #7cffb2; border: none; transition: background .18s ease, transform .18s ease;
        }
        .au-btn:hover:not(:disabled) { background: #9dffc6; }
        .au-btn:active:not(:disabled) { transform: translateY(1px); }
        .au-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .au-arrow { transition: transform .2s ease; }
        .au-btn:hover:not(:disabled) .au-arrow { transform: translateX(3px); }
        .au-spin { width: 16px; height: 16px; border: 2px solid rgba(5,20,12,0.35); border-top-color: #05140c; border-radius: 50%; animation: au-rot .7s linear infinite; }
        @keyframes au-rot { to { transform: rotate(360deg); } }

        .au-ghost { background: none; border: none; color: rgba(255,255,255,0.45); font-size: 12.5px; font-family: inherit; cursor: pointer; padding: 4px; transition: color .2s ease; }
        .au-ghost:hover { color: #eef2f5; }

        .au-divider { display: flex; align-items: center; gap: 12px; margin: 22px 0; color: rgba(255,255,255,0.3); font-size: 11px; }
        .au-divider::before, .au-divider::after { content: ''; flex: 1; height: 0.5px; background: rgba(255,255,255,0.1); }
        .au-switch { text-align: center; font-size: 13px; color: rgba(255,255,255,0.5); margin: 0; }
        .au-switch button { background: none; border: none; color: #7cffb2; font-family: inherit; font-size: 13px; font-weight: 400; cursor: pointer; padding: 0; }
        .au-switch button:hover { text-decoration: underline; }

        @media (max-width: 880px) {
          .au { grid-template-columns: 1fr; }
          .au-brand { display: none; }
          .au-mobile-logo { display: inline-flex; }
        }
      `}</style>
    </div>
  );
}
