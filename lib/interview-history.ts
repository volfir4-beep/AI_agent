import { createClient } from '@/lib/supabase/server';
import type { InterviewEvaluation } from '@/types/interview';

export type InterviewHistoryItem = {
    id: string;
    session_id: string;
    target_role: string;
    overall_score: number;
    completed_at: string;
    evaluation: InterviewEvaluation;
};

type InterviewRow = {
    id: string;
    session_id: string;
    target_role: string;
    overall_score: number;
    completed_at: string;
    evaluation: unknown;
};

function normalizeEvaluation(
    value: unknown,
    fallback: Partial<InterviewEvaluation>,
): InterviewEvaluation {
    const raw =
        value && typeof value === 'object'
            ? (value as Partial<InterviewEvaluation>)
            : {};

    return {
        found: raw.found ?? true,
        session_id: String(raw.session_id ?? fallback.session_id ?? ''),
        user_id: String(raw.user_id ?? fallback.user_id ?? ''),
        user_name: String(raw.user_name ?? fallback.user_name ?? 'Candidate'),
        target_role: String(
            raw.target_role ?? fallback.target_role ?? 'Software Engineer',
        ),
        disclosure: raw.disclosure,
        overall_score: Number(raw.overall_score ?? fallback.overall_score ?? 0),
        dimension_breakdown: Array.isArray(raw.dimension_breakdown)
            ? raw.dimension_breakdown
            : [],
        strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
        weaknesses: Array.isArray(raw.weaknesses) ? raw.weaknesses : [],
        red_flags: Array.isArray(raw.red_flags) ? raw.red_flags : [],
        improvement_plan: Array.isArray(raw.improvement_plan)
            ? raw.improvement_plan
            : [],
        summary: String(raw.summary ?? ''),
        breakdown: raw.breakdown,
        evidence: raw.evidence,
        warning: raw.warning,
    };
}

export async function saveInterview(
    evaluation: InterviewEvaluation,
): Promise<InterviewHistoryItem> {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new Error('You must be signed in to save an interview.');
    }

    const sessionId = evaluation.session_id;
    if (!sessionId) {
        throw new Error('Cannot save an interview without a session_id.');
    }

    const { data, error } = await supabase
        .from('interviews')
        .upsert(
            {
                user_id: user.id,
                session_id: sessionId,
                target_role: evaluation.target_role || 'Software Engineer',
                overall_score: Math.round(Number(evaluation.overall_score) || 0),
                evaluation,
            },
            {
                onConflict: 'user_id,session_id',
            },
        )
        .select('id, session_id, target_role, overall_score, completed_at, evaluation')
        .single();

    if (error) {
        throw new Error(`Failed to save interview: ${error.message}`);
    }

    return mapRow(data as InterviewRow);
}

export async function getInterviewHistory(
    limit = 20,
): Promise<InterviewHistoryItem[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('interviews')
        .select(
            'id, session_id, target_role, overall_score, completed_at, evaluation',
        )
        .order('completed_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Failed to load interview history:', error.message);
        return [];
    }

    return (data as InterviewRow[]).map(mapRow);
}

export async function getInterviewById(
    id: string,
): Promise<InterviewHistoryItem | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('interviews')
        .select(
            'id, session_id, target_role, overall_score, completed_at, evaluation',
        )
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error('Failed to load interview:', error.message);
        return null;
    }

    if (!data) {
        return null;
    }

    return mapRow(data as InterviewRow);
}

function mapRow(row: InterviewRow): InterviewHistoryItem {
    return {
        id: row.id,
        session_id: row.session_id,
        target_role: row.target_role,
        overall_score: Number(row.overall_score) || 0,
        completed_at: row.completed_at,
        evaluation: normalizeEvaluation(row.evaluation, {
            session_id: row.session_id,
            target_role: row.target_role,
            overall_score: Number(row.overall_score) || 0,
        }),
    };
}
