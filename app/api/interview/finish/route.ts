import { NextRequest, NextResponse } from 'next/server';
import { finishInterview } from '@/lib/n8n-client';
import { getSession } from '@/lib/interview-session-store';

type ScoreResult = {
  overall_score: number | null;
  breakdown: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  evidence: string[];
};

function toScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value >= 0 && value <= 1) return Math.round(value * 100);
  if (value >= 0 && value <= 100) return Math.round(value);
  return null;
}

function buildFallbackScore(assessments: unknown[]): ScoreResult {
  const turnScores: number[] = [];
  const dimensionValues: Record<string, number[]> = {};
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const evidence: string[] = [];

  for (const item of assessments) {
    if (!item || typeof item !== 'object') continue;
    const assessment = item as Record<string, unknown>;

    const directScore =
      toScore(assessment.score) ??
      toScore(assessment.overall_score);

    if (directScore !== null) turnScores.push(directScore);

    const dimensions = assessment.breakdown ?? assessment.dimensions;

    if (dimensions && typeof dimensions === 'object' && !Array.isArray(dimensions)) {
      for (const [key, value] of Object.entries(dimensions)) {
        const score =
          typeof value === 'object' && value !== null
            ? toScore((value as Record<string, unknown>).score)
            : toScore(value);

        if (score !== null) {
          dimensionValues[key] ??= [];
          dimensionValues[key].push(score);
        }
      }
    }

    const addStrings = (value: unknown, target: string[]) => {
      if (typeof value === 'string' && value.trim()) target.push(value.trim());
      else if (Array.isArray(value)) {
        for (const entry of value) {
          if (typeof entry === 'string' && entry.trim()) target.push(entry.trim());
        }
      }
    };

    addStrings(assessment.strengths, strengths);
    addStrings(assessment.weaknesses, weaknesses);
    addStrings(assessment.evidence, evidence);
  }

  const breakdown: Record<string, number> = {};

  for (const [key, values] of Object.entries(dimensionValues)) {
    if (values.length > 0) {
      breakdown[key] = Math.round(
        values.reduce((sum, value) => sum + value, 0) / values.length,
      );
    }
  }

  const dimensionScores = Object.values(breakdown);
  const overallScore =
    dimensionScores.length > 0
      ? Math.round(dimensionScores.reduce((a, b) => a + b, 0) / dimensionScores.length)
      : turnScores.length > 0
        ? Math.round(turnScores.reduce((a, b) => a + b, 0) / turnScores.length)
        : null;

  return {
    overall_score: overallScore,
    breakdown,
    strengths: [...new Set(strengths)].slice(0, 6),
    weaknesses: [...new Set(weaknesses)].slice(0, 6),
    evidence: [...new Set(evidence)].slice(0, 10),
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { session_id } = body as { session_id?: string };

  if (!session_id) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  const session = getSession(session_id);

  if (!session) {
    return NextResponse.json(
      { error: `Unknown session_id: ${session_id}` },
      { status: 404 },
    );
  }

  try {
    const fallback = buildFallbackScore(session.assessments);

    const n8nReport = await finishInterview({
      session_id,
      user_id: session.userId,
      user_name: session.userName,
      role: session.role,
      candidate_state: session.candidateState,
      assessments: session.assessments,
    });

    const report = {
      ...n8nReport,
      overall_score:
        typeof n8nReport.overall_score === 'number'
          ? n8nReport.overall_score
          : fallback.overall_score,
      breakdown: n8nReport.breakdown ?? fallback.breakdown,
      strengths: n8nReport.strengths ?? fallback.strengths,
      weaknesses: n8nReport.weaknesses ?? fallback.weaknesses,
      evidence: n8nReport.evidence ?? fallback.evidence,
      disclosure:
        n8nReport.disclosure ??
        'This interview and assessment were generated with AI.',
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error finishing interview:', error);

    const fallback = buildFallbackScore(session.assessments);

    if (
      fallback.overall_score !== null ||
      Object.keys(fallback.breakdown).length > 0
    ) {
      return NextResponse.json({
        overall_score: fallback.overall_score,
        breakdown: fallback.breakdown,
        strengths: fallback.strengths,
        weaknesses: fallback.weaknesses,
        evidence: fallback.evidence,
        disclosure: 'This interview and assessment were generated with AI.',
        warning:
          'The final AI report service was unavailable, so the score was calculated from the collected turn assessments.',
      });
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
