import { useState } from 'react';
import type { ReactNode } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, KeyRound, LockKeyhole, Wrench } from 'lucide-react';
import { getGetAccountQueryKey, getGetAuthSessionQueryKey, useLoginAccount, useRegisterAccount, useRequestPasswordReset, useResetPassword } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { InlineError } from '@/components/store';

function clearPrivateCache(client: ReturnType<typeof useQueryClient>) {
  client.removeQueries({ predicate: query => {
    const key = JSON.stringify(query.queryKey);
    return ['/api/account', '/api/cart', '/api/customer', '/api/admin'].some(part => key.includes(part));
  } });
}

function AuthFrame({ eyebrow, title, detail, children }: { eyebrow: string; title: string; detail: string; children: ReactNode }) {
  return <main className="auth-page">
    <div className="auth-side">
      <Link href="/" className="brand"><span className="brand-mark"><Wrench size={18}/></span><span className="brand-name">RANG</span></Link>
      <div className="auth-side-copy"><span className="eyebrow">Parts for the work ahead</span><p>Good parts. Clear details. No guesswork about what you are buying.</p></div>
      <div className="auth-side-foot eyebrow">ATV · AUTO · MOTORCYCLE</div>
    </div>
    <section className="auth-content">
      <div className="auth-card">
        <Link href="/" className="auth-back"><ArrowLeft size={15}/> Back to the shop</Link>
        <div className="eyebrow">{eyebrow}</div><h1 className="display">{title}</h1><p className="auth-detail">{detail}</p>
        {children}
      </div>
    </section>
  </main>;
}

export function SignInPage({ admin = false }: { admin?: boolean }) {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const login = useLoginAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const next = new URLSearchParams(window.location.search).get('returnTo');
  const destination = admin ? '/admin' : next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';
  const submit = (event: FormEvent) => {
    event.preventDefault(); setMessage('');
    login.mutate({ data: { email: email.trim(), password } }, { onSuccess: session => {
      clearPrivateCache(client);
      client.setQueryData(getGetAuthSessionQueryKey(), session);
      void client.invalidateQueries({ queryKey: getGetAuthSessionQueryKey() });
      void client.invalidateQueries({ queryKey: getGetAccountQueryKey() });
      setLocation(destination);
    }, onError: error => setMessage(error instanceof Error ? error.message : 'Sign in could not be completed.') });
  };
  return <AuthFrame eyebrow={admin ? 'RANG / operations access' : 'RANG AUTO PARTS / your account'} title={admin ? 'Staff sign in.' : 'Welcome back to the workshop.'} detail={admin ? 'Use your RANG account. Staff access is checked by the operations service.' : 'Sign in to view orders and manage your details.'}>
    <form className="auth-form" onSubmit={submit}>
      <label className="label">Email<input className="field" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} data-testid="input-auth-email"/></label>
      <label className="label">Password<input className="field" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} data-testid="input-auth-password"/></label>
      {message && <InlineError message={message}/>}
      <button className="btn btn-accent" disabled={login.isPending} data-testid="button-auth-sign-in">{login.isPending ? 'Signing in…' : 'Sign in'}<ArrowRight size={16}/></button>
    </form>
    {!admin && <div className="auth-links"><Link href="/forgot-password">Forgot password?</Link><span>New to RANG? <Link href="/sign-up">Create an account</Link></span></div>}
    {admin && <p className="auth-footnote">If your account is not authorized for operations, the server will keep access closed.</p>}
  </AuthFrame>;
}

export function SignUpPage() {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const register = useRegisterAccount();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault(); setMessage('');
    register.mutate({ data: { ...form, email: form.email.trim() } }, { onSuccess: session => {
      clearPrivateCache(client);
      client.setQueryData(getGetAuthSessionQueryKey(), session);
      void client.invalidateQueries({ queryKey: getGetAuthSessionQueryKey() });
      void client.invalidateQueries({ queryKey: getGetAccountQueryKey() });
      setLocation('/account');
    }, onError: error => setMessage(error instanceof Error ? error.message : 'Your account could not be created.') });
  };
  return <AuthFrame eyebrow="RANG AUTO PARTS / get started" title="Make the next repair simpler." detail="Create an account to keep your orders and contact details together.">
    <form className="auth-form" onSubmit={submit}>
      <label className="label">Full name<input className="field" autoComplete="name" minLength={2} maxLength={160} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-register-name"/></label>
      <label className="label">Email<input className="field" type="email" autoComplete="email" maxLength={254} required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="input-register-email"/></label>
      <label className="label">Password<input className="field" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} data-testid="input-register-password"/><small className="auth-hint">Use at least 12 characters.</small></label>
      {message && <InlineError message={message}/>}
      <button className="btn btn-accent" disabled={register.isPending} data-testid="button-register">{register.isPending ? 'Creating account…' : 'Create account'}<ArrowRight size={16}/></button>
    </form>
    <div className="auth-links"><span>Already have an account? <Link href="/sign-in">Sign in</Link></span></div>
  </AuthFrame>;
}

export function ForgotPasswordPage() {
  const request = useRequestPasswordReset();
  const [email, setEmail] = useState('');
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault(); setMessage('');
    request.mutate({ data: { email: email.trim() } }, { onSuccess: () => setComplete(true), onError: () => {
      setMessage('Email recovery is temporarily unavailable. Please contact the RANG parts desk for help.');
    } });
  };
  return <AuthFrame eyebrow="Account recovery" title="Get back into your account." detail="Enter the email address on your RANG account. We will not confirm whether an account matches.">
    {complete ? <div className="notice" role="status" data-testid="status-recovery-requested">If an account matches that email and recovery email is available, instructions will be sent. Check your inbox shortly.</div> : <form className="auth-form" onSubmit={submit}>
      <label className="label">Email<input className="field" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} data-testid="input-recovery-email"/></label>
      {message && <InlineError message={message}/>}
      <button className="btn btn-accent" disabled={request.isPending} data-testid="button-request-reset">{request.isPending ? 'Requesting…' : 'Send recovery email'}<ArrowRight size={16}/></button>
    </form>}
    <div className="auth-links"><Link href="/sign-in">Return to sign in</Link></div>
  </AuthFrame>;
}

export function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const reset = useResetPassword();
  const initialToken = new URLSearchParams(window.location.search).get('token') || '';
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault(); setMessage('');
    reset.mutate({ data: { token: token.trim(), password } }, { onSuccess: () => {
      clearPrivateCache(client);
      void client.invalidateQueries({ queryKey: getGetAuthSessionQueryKey() });
      setComplete(true);
    }, onError: error => setMessage(error instanceof Error ? error.message : 'This reset link could not be used. Request a new one.') });
  };
  return <AuthFrame eyebrow="Account recovery" title="Choose a new password." detail="Use the one-time code from your recovery email.">
    {complete ? <div className="notice" role="status"><LockKeyhole size={18}/> Password updated. <button type="button" className="text-button" onClick={() => setLocation('/sign-in')}>Sign in</button></div> : <form className="auth-form" onSubmit={submit}>
      <label className="label">Recovery code<input className="field" required minLength={32} maxLength={128} value={token} onChange={e => setToken(e.target.value)} autoComplete="one-time-code" data-testid="input-reset-token"/></label>
      <label className="label">New password<input className="field" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} data-testid="input-reset-password"/><small className="auth-hint">Use at least 12 characters.</small></label>
      {message && <InlineError message={message}/>}
      <button className="btn btn-accent" disabled={reset.isPending} data-testid="button-reset-password">{reset.isPending ? 'Updating…' : 'Set new password'}<KeyRound size={16}/></button>
    </form>}
    <div className="auth-links"><Link href="/forgot-password">Request another recovery email</Link></div>
  </AuthFrame>;
}
