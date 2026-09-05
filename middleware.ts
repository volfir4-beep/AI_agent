import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value);
                    });

                    response = NextResponse.next({ request });

                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        },
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    const protectedPage =
        pathname === '/' ||
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/leaderboard');

    const protectedApi =
        pathname.startsWith('/api/generate-agora-token') ||
        pathname.startsWith('/api/invite-agent') ||
        pathname.startsWith('/api/stop-conversation') ||
        pathname.startsWith('/api/interview');

    // The OpenAI-compatible chat endpoint is intentionally public because
    // Agora's server-side LLM calls do not carry the browser's Supabase cookie.
    // It still requires a high-entropy SESSION_ID supplied by the interview agent.
    const needsAuth = protectedPage || protectedApi;

    if (needsAuth && !user) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const url = request.nextUrl.clone();
        url.pathname = '/auth/login';
        url.searchParams.set('next', pathname);
        return NextResponse.redirect(url);
    }

    if (
        (pathname === '/auth/login' || pathname === '/auth/signup') &&
        user
    ) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        url.searchParams.delete('next');
        return NextResponse.redirect(url);
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
