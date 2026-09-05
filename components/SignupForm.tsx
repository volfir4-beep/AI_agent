'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SignupForm() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        const supabase = createClient();
        const { data, error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
                data: {
                    full_name: name.trim(),
                },
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (signUpError) {
            setError(signUpError.message);
            setLoading(false);
            return;
        }

        if (data.session) {
            window.location.assign('/dashboard');
            return;
        }

        setMessage(
            'Account created. Check your email to confirm your account, then sign in.',
        );
        setLoading(false);
    }

    return (
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-8 shadow-2xl">
            <div className="mb-8">
                <p className="text-sm font-medium text-primary">AI Interviewer</p>
                <h1 className="mt-2 text-3xl font-bold">Create your account</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Your completed interviews will be stored in your account.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block">
                    <span className="mb-2 block text-sm font-medium">Name</span>
                    <input
                        type="text"
                        autoComplete="name"
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Your name"
                    />
                </label>

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
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                        placeholder="At least 6 characters"
                    />
                </label>

                {error && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">
                        {message}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
                >
                    {loading ? 'Creating account...' : 'Sign up'}
                </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/auth/login" className="font-medium text-primary hover:underline">
                    Sign in
                </Link>
            </p>
        </div>
    );
}
