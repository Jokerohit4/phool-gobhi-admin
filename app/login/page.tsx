'use client';

import { useState, type FormEvent } from 'react';
import { signInWithGoogle } from '@/lib/firebaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function completeSession(res: Response) {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Sign-in failed');
    // Hard navigation, not router.push/refresh: the session cookie was just
    // set by the API route, and a full page load guarantees the next request
    // picks it up rather than racing the client router's cache/transition.
    window.location.href = '/gyms';
  }

  async function login(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      await completeSession(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function loginWithGoogle() {
    setError(null);
    setLoading(true);
    try {
      const idToken = await signInWithGoogle();
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      await completeSession(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Phool Gobhi — Staff Login</h1>
        <p className="text-sm text-gray-500">Access is restricted to staff (gobhi) accounts.</p>
      </div>

      <form onSubmit={login} className="flex flex-col gap-3">
        <label className="text-sm font-medium" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-3 py-2"
          placeholder="you@buildingphoolghobhi.com"
        />
        <label className="text-sm font-medium" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <button
          disabled={loading}
          className="rounded bg-emerald-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-gray-400">
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        or
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      </div>

      <button
        type="button"
        onClick={loginWithGoogle}
        disabled={loading}
        className="rounded border px-3 py-2 text-sm disabled:opacity-50"
      >
        Sign in with Google
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </main>
  );
}
