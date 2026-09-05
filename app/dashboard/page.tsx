import Link from 'next/link';
import { redirect } from 'next/navigation';
import UserMenu from '@/components/UserMenu';
import InterviewHistory from '@/components/InterviewHistory';
import { createClient } from '@/lib/supabase/server';
import { getInterviewHistory } from '@/lib/interview-history';

export default async function DashboardPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/login?next=/dashboard');
    }

    const interviews = await getInterviewHistory(30);
    const displayName =
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split('@')[0] ??
        'Candidate';

    const average =
        interviews.length > 0
            ? Math.round(
                interviews.reduce((sum, item) => sum + item.overall_score, 0) /
                interviews.length,
            )
            : 0;

    return (
        <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
            <div className="mx-auto max-w-6xl">
                <header className="mb-10 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-primary">AI Interviewer</p>
                        <h1 className="mt-1 text-3xl font-bold">
                            Welcome, {displayName}
                        </h1>
                    </div>
                    <UserMenu />
                </header>

                <section className="mb-8 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                        <p className="text-sm text-muted-foreground">Completed interviews</p>
                        <p className="mt-2 text-3xl font-bold">{interviews.length}</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                        <p className="text-sm text-muted-foreground">Average score</p>
                        <p className="mt-2 text-3xl font-bold">{average}/100</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                        <p className="text-sm text-muted-foreground">Latest score</p>
                        <p className="mt-2 text-3xl font-bold">
                            {interviews[0]?.overall_score ?? 0}/100
                        </p>
                    </div>
                </section>

                <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold">Interview history</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Your completed scorecards are saved to your account.
                        </p>
                    </div>

                    <Link
                        href="/"
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                    >
                        New interview
                    </Link>
                </div>

                <InterviewHistory interviews={interviews} />
            </div>
        </main>
    );
}
