import { NextRequest, NextResponse } from 'next/server';

import { finishInterview } from '@/lib/n8n-client';
import { getSession } from '@/lib/interview-session-store';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { saveInterview } from '@/lib/interview-history';

import type {
  DimensionBreakdown,
  ImprovementPlanItem,
  InterviewEvaluation,
} from '@/types/interview';

type ScoreResult = {
  overall_score: number | null;

  breakdown: Record<string, number>;

  dimension_breakdown: DimensionBreakdown[];

  strengths: string[];

  weaknesses: string[];

  red_flags: string[];

  improvement_plan: ImprovementPlanItem[];

  summary: string;

  evidence: string[];
};

/**
 * Convert possible score formats to 0-100.
 */
function toScore(value: unknown): number | null {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  if (value >= 0 && value <= 1) {
    return Math.round(value * 100);
  }

  if (value >= 0 && value <= 100) {
    return Math.round(value);
  }

  return null;
}

/**
 * Convert unknown values into string arrays.
 */
function extractStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.trim() ? [value.trim()] : [];
  }

  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string =>
        typeof item === 'string' &&
        item.trim().length > 0,
    ).map((item) => item.trim());
  }

  return [];
}

/**
 * Build a score from the assessments collected during
 * the interview if the final n8n report is unavailable.
 */
function buildFallbackScore(
  assessments: unknown[],
): ScoreResult {
  const turnScores: number[] = [];

  const dimensionValues: Record<
    string,
    number[]
  > = {};

  const strengths: string[] = [];

  const weaknesses: string[] = [];

  const redFlags: string[] = [];

  const evidence: string[] = [];

  for (const item of assessments) {
    if (
      !item ||
      typeof item !== 'object'
    ) {
      continue;
    }

    const assessment =
      item as Record<string, unknown>;

    const directScore =
      toScore(assessment.score) ??
      toScore(assessment.overall_score);

    if (directScore !== null) {
      turnScores.push(directScore);
    }

    const dimensions =
      assessment.breakdown ??
      assessment.dimensions;

    if (
      dimensions &&
      typeof dimensions === 'object' &&
      !Array.isArray(dimensions)
    ) {
      for (const [
        key,
        value,
      ] of Object.entries(dimensions)) {
        const score =
          typeof value === 'object' &&
            value !== null
            ? toScore(
              (
                value as Record<
                  string,
                  unknown
                >
              ).score,
            )
            : toScore(value);

        if (score !== null) {
          dimensionValues[key] ??= [];

          dimensionValues[key].push(
            score,
          );
        }
      }
    }

    strengths.push(
      ...extractStrings(
        assessment.strengths,
      ),
    );

    weaknesses.push(
      ...extractStrings(
        assessment.weaknesses,
      ),
    );

    redFlags.push(
      ...extractStrings(
        assessment.red_flags,
      ),
    );

    evidence.push(
      ...extractStrings(
        assessment.evidence,
      ),
    );
  }

  const breakdown: Record<
    string,
    number
  > = {};

  const dimensionBreakdown: DimensionBreakdown[] =
    [];

  for (const [
    key,
    values,
  ] of Object.entries(
    dimensionValues,
  )) {
    if (values.length === 0) {
      continue;
    }

    const average = Math.round(
      values.reduce(
        (sum, value) =>
          sum + value,
        0,
      ) / values.length,
    );

    breakdown[key] = average;

    dimensionBreakdown.push({
      dimension: key,
      score: average,
      feedback:
        'Score calculated from the collected interview turn assessments.',
    });
  }

  const dimensionScores =
    Object.values(breakdown);

  const overallScore =
    dimensionScores.length > 0
      ? Math.round(
        dimensionScores.reduce(
          (a, b) => a + b,
          0,
        ) /
        dimensionScores.length,
      )
      : turnScores.length > 0
        ? Math.round(
          turnScores.reduce(
            (a, b) => a + b,
            0,
          ) /
          turnScores.length,
        )
        : null;

  return {
    overall_score: overallScore,

    breakdown,

    dimension_breakdown:
      dimensionBreakdown,

    strengths: [
      ...new Set(strengths),
    ].slice(0, 6),

    weaknesses: [
      ...new Set(weaknesses),
    ].slice(0, 6),

    red_flags: [
      ...new Set(redFlags),
    ].slice(0, 6),

    improvement_plan: [],

    summary:
      'The final AI report was unavailable. This score was calculated from the assessments collected during the interview.',

    evidence: [
      ...new Set(evidence),
    ].slice(0, 10),
  };
}

/**
 * Normalize the response received from n8n.
 *
 * This ensures the frontend always receives the
 * same predictable structure.
 */
function normalizeReport(
  data: Partial<InterviewEvaluation>,
  fallback: ScoreResult,
): InterviewEvaluation {
  const dimensionBreakdown =
    Array.isArray(
      data.dimension_breakdown,
    )
      ? data.dimension_breakdown
        .map((item) => ({
          dimension:
            String(
              item.dimension ?? '',
            ),

          score:
            toScore(item.score) ?? 0,

          feedback:
            String(
              item.feedback ?? '',
            ),
        }))
        .filter(
          (item) =>
            item.dimension.length > 0,
        )
      : fallback.dimension_breakdown;

  const breakdown =
    data.breakdown ??
    Object.fromEntries(
      dimensionBreakdown.map(
        (item) => [
          item.dimension,
          item.score,
        ],
      ),
    );

  return {
    found: data.found ?? true,

    session_id:
      data.session_id ?? '',

    user_id:
      data.user_id ?? '',

    user_name:
      data.user_name ?? 'Candidate',

    target_role:
      data.target_role ??
      'Software Engineer',

    disclosure:
      data.disclosure ??
      'This assessment was produced by an AI interview panel.',

    overall_score:
      toScore(data.overall_score) ??
      fallback.overall_score ??
      0,

    dimension_breakdown:
      dimensionBreakdown,

    strengths:
      Array.isArray(data.strengths)
        ? data.strengths
          .filter(
            (item): item is string =>
              typeof item ===
              'string',
          )
        : fallback.strengths,

    weaknesses:
      Array.isArray(data.weaknesses)
        ? data.weaknesses
          .filter(
            (item): item is string =>
              typeof item ===
              'string',
          )
        : fallback.weaknesses,

    red_flags:
      Array.isArray(data.red_flags)
        ? data.red_flags
          .filter(
            (item): item is string =>
              typeof item ===
              'string',
          )
        : fallback.red_flags,

    improvement_plan:
      Array.isArray(
        data.improvement_plan,
      )
        ? data.improvement_plan
        : fallback.improvement_plan,

    summary:
      data.summary ??
      fallback.summary,

    breakdown,

    evidence:
      Array.isArray(data.evidence)
        ? data.evidence
        : fallback.evidence,
  };
}

async function persistReport(
  report: InterviewEvaluation,
): Promise<InterviewEvaluation> {
  try {
    await saveInterview(report);
    return report;
  } catch (error) {
    console.error('Failed to persist interview scorecard:', error);

    return {
      ...report,
      warning:
        report.warning ??
        'The interview scorecard could not be saved. Please check your Supabase configuration.',
    };
  }
}

export async function POST(
  request: NextRequest,
) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  let body: {
    session_id?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          'Invalid JSON body',
      },
      { status: 400 },
    );
  }

  const {
    session_id,
  } = body;

  if (!session_id) {
    return NextResponse.json(
      {
        error:
          'session_id is required',
      },
      { status: 400 },
    );
  }

  const session =
    getSession(session_id);

  if (!session) {
    return NextResponse.json(
      {
        error:
          `Unknown session_id: ${session_id}`,
      },
      { status: 404 },
    );
  }

  if (session.userId !== user.id) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 },
    );
  }

  const fallback =
    buildFallbackScore(
      session.assessments,
    );

  try {
    const n8nReport =
      await finishInterview({
        session_id,

        user_id:
          session.userId,

        user_name:
          session.userName,

        role:
          session.role,

        candidate_state:
          session.candidateState,

        assessments:
          session.assessments,
      });

    const report = normalizeReport(
      {
        ...n8nReport,
        session_id: session_id,
        user_id: user.id,
        user_name: session.userName,
        target_role: session.role,
      },
      fallback,
    );

    const savedReport = await persistReport(report);

    return NextResponse.json(savedReport);
  } catch (error) {
    console.error(
      'Error finishing interview:',
      error,
    );

    if (
      fallback.overall_score !== null ||
      Object.keys(fallback.breakdown).length > 0
    ) {
      const fallbackReport: InterviewEvaluation = {
        found: true,
        session_id,
        user_id: user.id,
        user_name: session.userName,
        target_role: session.role,
        overall_score: fallback.overall_score ?? 0,
        dimension_breakdown: fallback.dimension_breakdown,
        breakdown: fallback.breakdown,
        strengths: fallback.strengths,
        weaknesses: fallback.weaknesses,
        red_flags: fallback.red_flags,
        improvement_plan: fallback.improvement_plan,
        summary: fallback.summary,
        evidence: fallback.evidence,
        disclosure:
          'This interview and assessment were generated with AI.',
        warning:
          'The final AI report service was unavailable, so the score was calculated from the collected turn assessments.',
      };

      const savedFallback =
        await persistReport(fallbackReport);

      return NextResponse.json(savedFallback);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to finish interview',
      },
      { status: 500 },
    );
  }
}