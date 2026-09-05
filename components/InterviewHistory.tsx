import Link from 'next/link';
import type { InterviewHistoryItem } from '@/lib/interview-history';

function formatDate(value: string) {
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export default function InterviewHistory({
    interviews,
}: {
    interviews: InterviewHistoryItem[];
}) {
    if (interviews.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-10 text-center">
                <h2 className="text-lg font-semibold">No completed interviews yet</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    Finish your first interview and its scorecard will appear here.
                </p>
                <Link
                    href="/"
                    className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                    Start an interview
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {interviews.map((interview) => (
                <Link
                    key={interview.id}
                    href={`/dashboard/interview/${interview.id}`}
                    className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.06]"
                >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-semibold">{interview.target_role}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {formatDate(interview.completed_at)}
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">Score</p>
                                <p className="text-2xl font-bold">{interview.overall_score}/100</p>
                            </div>
                            <span className="text-sm text-primary">View scorecard →</span>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}
