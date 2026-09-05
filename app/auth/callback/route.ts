import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') ?? '/dashboard';

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            return NextResponse.redirect(
                new URL(next.startsWith('/') ? next : '/dashboard', requestUrl.origin),
            );
        }

        console.error('Supabase auth callback failed:', error.message);
    }

    return NextResponse.redirect(
        new URL('/auth/login?error=auth_callback_failed', requestUrl.origin),
    );
}
