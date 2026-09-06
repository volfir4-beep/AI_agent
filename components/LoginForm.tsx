'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
    const searchParams = useSearchParams();
    const next = searchParams.get('next') ?? '/dashboard';
    const callbackError = searchParams.get('error');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(
        callbackError ? 'Authentication could not be completed. Please try again.' : '',
    );

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        setLoading(true);

        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        });

        if (signInError) {
            setError(signInError.message);
            setLoading(false);
            return;
        }

        window.location.assign(next.startsWith('/') ? next : '/dashboard');
    }

    return (
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-8 shadow-2xl">
            <div className="mb-8">
                <p className="text-sm font-medium text-primary">AI Interviewer</p>
                <h1 className="mt-2 text-3xl font-bold">Welcome back</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Sign in to start interviews and keep your scorecards.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block">
                    <span className="mb-2 block text-sm font-medium">Email</span>
                    <input
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                        placeholder="you@example.com"
                    />
                </label>

                <label className="block">
                    <span className="mb-2 block text-sm font-medium">Password</span>
                    <input
                        type="password"
                        autoComplete="current-password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                        placeholder="••••••••"
                    />
                </label>

                {error && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
                >
                    {loading ? 'Signing in...' : 'Sign in'}
                </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link href="/auth/signup" className="font-medium text-primary hover:underline">
                    Create one
                </Link>
            </p>
        </div>
    );
}
