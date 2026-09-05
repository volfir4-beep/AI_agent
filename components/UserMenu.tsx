'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type UserInfo = {
    email?: string;
    name?: string;
};

export default function UserMenu() {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const supabase = createClient();

        const loadUser = async () => {
            const { data: authData } = await supabase.auth.getUser();

            if (authData.user) {
                setUser({
                    email: authData.user.email ?? undefined,
                    name:
                        typeof authData.user.user_metadata?.full_name === 'string'
                            ? authData.user.user_metadata.full_name
                            : undefined,
                });
            }
        };

        void loadUser();
    }, []);

    async function signOut() {
        const supabase = createClient();

        await supabase.auth.signOut();

        window.location.assign('/auth/login');
    }

    if (!user) {
        return null;
    }

    const label = user.name || user.email || 'Account';

    return (
        <div className="relative z-50">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="rounded-full border border-white/10 bg-card px-4 py-2 text-sm font-medium shadow-sm hover:bg-white/10"
            >
                {label}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-card p-2 shadow-xl">
                    <div className="border-b border-white/10 px-3 py-2">
                        <p className="truncate text-sm font-medium">{label}</p>

                        {user.email && (
                            <p className="truncate text-xs text-muted-foreground">
                                {user.email}
                            </p>
                        )}
                    </div>

                    <Link
                        href="/dashboard"
                        onClick={() => setOpen(false)}
                        className="mt-1 block rounded-lg px-3 py-2 text-sm hover:bg-white/10"
                    >
                        Dashboard & history
                    </Link>

                    <button
                        type="button"
                        onClick={signOut}
                        className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-white/10"
                    >
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}