import Link from 'next/link';
import { notFound } from 'next/navigation';
import UserMenu from '@/components/UserMenu';
import InterviewResults from '@/components/InterviewResults';
import { getInterviewById } from '@/lib/interview-history';

export default async function PreviousInterviewPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const interview = await getInterviewById(id);

    if (!interview) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-[#0b0b0b] text-white">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 pt-6">
                <Link
                    href="/dashboard"
                    className="text-sm text-gray-400 hover:text-white"
                >
                    ← Back to dashboard
                </Link>
                <UserMenu />
            </div>

            <InterviewResults evaluation={interview.evaluation} />
        </div>
    );
}
