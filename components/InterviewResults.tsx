'use client';

import ScoreGauge from './ScoreGauge';
import PerformancePieChart from './PerformancePieChart';

type Dimension = {
    dimension: string;
    score: number;
    feedback: string;
};

type Improvement = {
    area: string;
    recommendation: string;
    resource: string;
};

export type InterviewEvaluation = {
    found?: boolean;
    session_id: string;
    user_id?: string;
    user_name?: string;
    target_role: string;
    disclosure?: string;

    overall_score: number;

    dimension_breakdown: Dimension[];

    strengths: string[];

    weaknesses: string[];

    red_flags: string[];

    improvement_plan: Improvement[];

    summary: string;

    breakdown?: Record<string, number>;

    evidence?: unknown[];
};

type Props = {
    evaluation: InterviewEvaluation;
};

export default function InterviewResults({
    evaluation,
}: Props) {
    const getScore = (dimension: string) => {
        const item = evaluation.dimension_breakdown.find(
            (d) => d.dimension === dimension
        );

        return item?.score ?? 0;
    };

    return (
        <main className="min-h-screen bg-[#0b0b0b] px-6 py-10 text-white">
            <div className="mx-auto max-w-7xl">

                {/* HEADER */}

                <div className="mb-8">
                    <p className="text-sm text-gray-400">
                        Interview Completed
                    </p>

                    <h1 className="mt-2 text-4xl font-bold">
                        Interview Results
                    </h1>

                    <p className="mt-2 text-gray-400">
                        {evaluation.target_role}
                    </p>
                </div>


                {/* OVERALL SCORE */}

                <section className="mb-6 rounded-2xl border border-white/10 bg-[#151515] p-8">

                    <div className="text-center">

                        <p className="text-sm text-gray-400">
                            Overall Score
                        </p>

                        <div className="mt-2 text-6xl font-bold">
                            {evaluation.overall_score}
                        </div>

                        <p className="mt-2 text-sm text-gray-500">
                            AI Interview Assessment
                        </p>

                    </div>

                </section>


                {/* THREE MAIN SCORES */}

                <section className="mb-6 rounded-2xl border border-white/10 bg-[#151515] p-8">

                    <h2 className="mb-10 text-xl font-semibold">
                        Performance
                    </h2>

                    <div className="grid grid-cols-1 gap-12 md:grid-cols-3">

                        <ScoreGauge
                            label="Technical Knowledge"
                            score={getScore('knowledge')}
                            maxScore={10}
                        />

                        <ScoreGauge
                            label="Communication"
                            score={getScore('communication')}
                            maxScore={10}
                        />

                        <ScoreGauge
                            label="Problem Solving"
                            score={getScore('reasoning')}
                            maxScore={10}
                        />

                    </div>

                </section>


                {/* STRENGTHS + PIE CHART */}

                <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">

                    {/* STRENGTHS */}

                    <section className="rounded-2xl border border-white/10 bg-[#151515] p-6">

                        <h2 className="mb-5 text-xl font-semibold">
                            Strengths
                        </h2>

                        {evaluation.strengths.length === 0 ? (

                            <div className="rounded-xl bg-white/5 p-5">
                                <p className="text-sm text-gray-400">
                                    No significant strengths were identified
                                    in this interview.
                                </p>
                            </div>

                        ) : (

                            <div className="space-y-3">

                                {evaluation.strengths.map(
                                    (strength, index) => (
                                        <div
                                            key={index}
                                            className="rounded-xl bg-white/5 p-4"
                                        >
                                            <span className="mr-2">
                                                ✓
                                            </span>

                                            {strength}
                                        </div>
                                    )
                                )}

                            </div>

                        )}

                    </section>


                    {/* PIE CHART */}

                    <section className="rounded-2xl border border-white/10 bg-[#151515] p-6">

                        <h2 className="mb-2 text-xl font-semibold">
                            Performance Distribution
                        </h2>

                        <p className="mb-2 text-sm text-gray-500">
                            Distribution across evaluated dimensions
                        </p>

                        <PerformancePieChart
                            dimensions={evaluation.dimension_breakdown}
                        />

                    </section>

                </div>


                {/* WEAKNESSES */}

                <section className="mb-6 rounded-2xl border border-white/10 bg-[#151515] p-6">

                    <h2 className="mb-5 text-xl font-semibold">
                        Areas to Improve
                    </h2>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                        {evaluation.weaknesses.map(
                            (weakness, index) => (

                                <div
                                    key={index}
                                    className="rounded-xl bg-white/5 p-4"
                                >
                                    <span className="mr-2">
                                        ⚠
                                    </span>

                                    <span className="capitalize">
                                        {weakness}
                                    </span>

                                </div>

                            )
                        )}

                    </div>

                </section>


                {/* RED FLAGS */}

                {evaluation.red_flags.length > 0 && (

                    <section className="mb-6 rounded-2xl border border-white/10 bg-[#151515] p-6">

                        <h2 className="mb-5 text-xl font-semibold">
                            Interview Concerns
                        </h2>

                        <div className="space-y-3">

                            {evaluation.red_flags.map(
                                (flag, index) => (

                                    <div
                                        key={index}
                                        className="rounded-xl bg-white/5 p-4 text-sm text-gray-300"
                                    >
                                        • {flag}
                                    </div>

                                )
                            )}

                        </div>

                    </section>

                )}


                {/* SUMMARY */}

                <section className="mb-6 rounded-2xl border border-white/10 bg-[#151515] p-6">

                    <h2 className="mb-4 text-xl font-semibold">
                        AI Interview Summary
                    </h2>

                    <p className="leading-7 text-gray-300">
                        {evaluation.summary}
                    </p>

                </section>


                {/* IMPROVEMENT PLAN */}

                <section className="rounded-2xl border border-white/10 bg-[#151515] p-6">

                    <h2 className="mb-6 text-xl font-semibold">
                        Improvement Plan
                    </h2>

                    <div className="grid gap-4">

                        {evaluation.improvement_plan.map(
                            (item, index) => (

                                <div
                                    key={index}
                                    className="rounded-xl bg-white/5 p-5"
                                >

                                    <h3 className="font-semibold capitalize">
                                        {item.area}
                                    </h3>

                                    <p className="mt-2 text-sm leading-6 text-gray-300">
                                        {item.recommendation}
                                    </p>

                                    <p className="mt-3 text-xs text-gray-500">
                                        Resource: {item.resource}
                                    </p>

                                </div>

                            )
                        )}

                    </div>

                </section>


                {/* DISCLOSURE */}

                {evaluation.disclosure && (
                    <p className="mt-8 text-center text-xs text-gray-500">
                        {evaluation.disclosure}
                    </p>
                )}

            </div>
        </main>
    );
}