'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Workspace from './workspace';
import { roleLabels } from '../lib/workspace';
export type Staff = { id: string; name: string; email: string; role: string; active?: boolean };
export default function Home() {
  const [user, setUser] = useState<Staff | null>(null), [checking, setChecking] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { fetch('/auth/me', { cache: 'no-store' }).then(async r => { if (r.ok) setUser((await r.json()).user); else if (r.status !== 401) throw Error('Workspace is unavailable'); }).catch(e => setError(e.message)).finally(() => setChecking(false)); }, []);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const values = new FormData(e.currentTarget); setBusy(true); setError('');
    try { const r = await fetch('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: values.get('email'), password: values.get('password') }) });
      if (!r.ok) throw Error(r.status === 401 ? 'Email or password is incorrect.' : r.status === 429 ? 'Too many attempts. Try again later.' : 'Unable to sign in.'); setUser((await r.json()).user);
    } catch(e) { setError(e instanceof Error ? e.message : 'Unable to connect'); } finally { setBusy(false); }
  }
  async function logout() { const r = await fetch('/auth/logout', { method: 'POST' }); if (r.ok) setUser(null); else throw Error('Unable to sign out'); }
  if (user && !checking) return <Workspace user={user} onLogout={logout} />;
  return <main className="login-page"><header className="login-brand"><span className="crest">CP<sup>+</sup></span><div>Curtain Planet Plus<small>One connected workspace</small></div></header><section className="login-layout"><div className="login-story"><span className="eyebrow">FROM FIRST MEASUREMENT TO FINAL HANDOVER</span><h1>Beautiful details.<br/><em>Seamless work.</em></h1><p>Your shop, your people, and every order.<br/>Together in one place.</p><div className="fabric-scene" aria-hidden="true"><i/><i/><i/><i/><i/><i/><span>CURTAIN PLANET PLUS</span></div><div className="department-tags">Sales <b>·</b> Production <b>·</b> Collections</div></div><section className="login-card"><span className="eyebrow">STAFF ACCESS</span><h2>Welcome back.</h2><p>Sign in to your department workspace.</p>{checking ? <p role="status">Opening your workspace…</p> : <form onSubmit={login}><label>Email address<input type="email" name="email" autoComplete="username" required maxLength={254} placeholder="you@curtainplanet.com" /></label><label>Password<input type="password" name="password" autoComplete="current-password" required maxLength={128} /></label>{error && <div className="notice error" role="alert">{error}</div>}<button disabled={busy}>{busy ? 'Signing in…' : 'Sign in to workspace'} <span>→</span></button><small>Need access? Speak to your administrator.</small></form>}</section></section></main>;
}
