import type { InterviewDirective } from '@/types/interview';

export type CandidateState = {
  version: 1;

  scores: Record<string, number>;

  strengths: string[];
  weaknesses: string[];
  uncertainties: string[];
  evidence: string[];

  turn_count: number;

  focus_area?: string;
  last_assessment_score?: number | null;
};

function toScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
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

function stringsFrom(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  if (Array.isArray(value)) {
    return value
      .filter(
        (item): item is string =>
          typeof item === 'string' && item.trim().length > 0,
      )
      .map((item) => item.trim());
  }

  return [];
}

function extractDimensions(
  assessment: Record<string, unknown>,
): Record<string, number> {
  const result: Record<string, number> = {};

  const dimensions =
    assessment.breakdown ??
    assessment.dimensions;

  if (
    dimensions &&
    typeof dimensions === 'object' &&
    !Array.isArray(dimensions)
  ) {
    for (const [key, value] of Object.entries(
      dimensions as Record<string, unknown>,
    )) {
      const score =
        value &&
          typeof value === 'object' &&
          !Array.isArray(value)
          ? toScore(
            (value as Record<string, unknown>).score,
          )
          : toScore(value);

      if (score !== null) {
        result[key] = score;
      }
    }
  }

  return result;
}

function normalizeState(
  state: unknown,
): CandidateState {
  if (!state || typeof state !== 'object') {
    return {
      version: 1,
      scores: {},
      strengths: [],
      weaknesses: [],
      uncertainties: [],
      evidence: [],
      turn_count: 0,
    };
  }

  const raw = state as Record<string, unknown>;

  return {
    version: 1,

    scores:
      raw.scores &&
        typeof raw.scores === 'object' &&
        !Array.isArray(raw.scores)
        ? (raw.scores as Record<string, number>)
        : {},

    strengths: stringsFrom(raw.strengths),
    weaknesses: stringsFrom(raw.weaknesses),
    uncertainties: stringsFrom(raw.uncertainties),
    evidence: stringsFrom(raw.evidence),

    turn_count:
      typeof raw.turn_count === 'number'
        ? raw.turn_count
        : 0,

    focus_area:
      typeof raw.focus_area === 'string'
        ? raw.focus_area
        : undefined,

    last_assessment_score:
      typeof raw.last_assessment_score === 'number'
        ? raw.last_assessment_score
        : null,
  };
}

/**
 * Combines the previous Candidate State with the
 * latest turn assessment returned by n8n.
 *
 * This is our Adaptive Candidate Fusion layer.
 */
export function buildCandidateState(
  previousState: unknown,
  assessment: unknown,
  n8nCandidateState: unknown,
  turnCount: number,
): CandidateState {
  const previous = normalizeState(previousState);
  const n8nState = normalizeState(n8nCandidateState);

  const mergedScores = {
    ...previous.scores,
    ...n8nState.scores,
  };

  const mergedStrengths = [
    ...previous.strengths,
    ...n8nState.strengths,
  ];

  const mergedWeaknesses = [
    ...previous.weaknesses,
    ...n8nState.weaknesses,
  ];

  const mergedUncertainties = [
    ...previous.uncertainties,
    ...n8nState.uncertainties,
  ];

  const mergedEvidence = [
    ...previous.evidence,
    ...n8nState.evidence,
  ];

  let lastScore: number | null =
    previous.last_assessment_score ?? null;

  if (
    assessment &&
    typeof assessment === 'object' &&
    !Array.isArray(assessment)
  ) {
    const current =
      assessment as Record<string, unknown>;

    const dimensions = extractDimensions(current);

    /*
     * Running average for each dimension.
     */
    for (const [dimension, score] of Object.entries(
      dimensions,
    )) {
      if (
        typeof previous.scores[dimension] ===
        'number'
      ) {
        mergedScores[dimension] = Math.round(
          (previous.scores[dimension] + score) / 2,
        );
      } else {
        mergedScores[dimension] = score;
      }
    }

    lastScore =
      toScore(current.score) ??
      toScore(current.overall_score) ??
      null;

    mergedStrengths.push(
      ...stringsFrom(current.strengths),
    );

    mergedWeaknesses.push(
      ...stringsFrom(current.weaknesses),
    );

    mergedEvidence.push(
      ...stringsFrom(current.evidence),
    );

    mergedUncertainties.push(
      ...stringsFrom(current.uncertainties),
    );

    const contradictionValues = [
      ...stringsFrom(current.contradictions),
      ...stringsFrom(current.contradiction),
    ];

    if (contradictionValues.length > 0) {
      mergedUncertainties.push(
        ...contradictionValues.map(
          (item) => `Clarify: ${item}`,
        ),
      );
    }

    const vagueValues = [
      ...stringsFrom(current.vague),
      ...stringsFrom(current.vagueness),
    ];

    if (vagueValues.length > 0) {
      mergedUncertainties.push(
        ...vagueValues.map(
          (item) => `Needs clarification: ${item}`,
        ),
      );
    }

    const confidence =
      toScore(current.confidence);

    if (
      confidence !== null &&
      confidence < 60
    ) {
      mergedUncertainties.push(
        'Assessment confidence is low; gather more evidence.',
      );
    }
  }

  return {
    version: 1,

    scores: mergedScores,

    strengths: [
      ...new Set(mergedStrengths),
    ].slice(-8),

    weaknesses: [
      ...new Set(mergedWeaknesses),
    ].slice(-8),

    uncertainties: [
      ...new Set(mergedUncertainties),
    ].slice(-8),

    evidence: [
      ...new Set(mergedEvidence),
    ].slice(-12),

    turn_count: turnCount,

    focus_area: previous.focus_area,

    last_assessment_score: lastScore,
  };
}

function findWeakestDimension(
  scores: Record<string, number>,
): [string, number] | null {
  const entries = Object.entries(scores);

  if (entries.length === 0) {
    return null;
  }

  return entries.reduce(
    (weakest, current) =>
      current[1] < weakest[1]
        ? current
        : weakest,
  );
}

function interviewerForFocus(
  focus: string,
): string {
  const value = focus.toLowerCase();

  if (
    value.includes('business') ||
    value.includes('product') ||
    value.includes('customer') ||
    value.includes('relevance')
  ) {
    return 'product';
  }

  if (
    value.includes('communication') ||
    value.includes('vocabulary') ||
    value.includes('fluency')
  ) {
    return 'hiring_manager';
  }

  if (
    value.includes('leadership') ||
    value.includes('behavior') ||
    value.includes('team')
  ) {
    return 'behavioral';
  }

  return 'technical';
}

function questionTypeForFocus(
  focus: string,
): string {
  const value = focus.toLowerCase();

  if (
    value.includes('business') ||
    value.includes('product') ||
    value.includes('customer') ||
    value.includes('relevance')
  ) {
    return 'scenario';
  }

  if (
    value.includes('communication') ||
    value.includes('leadership') ||
    value.includes('behavior')
  ) {
    return 'behavioral';
  }

  if (
    value.includes('reasoning') ||
    value.includes('problem') ||
    value.includes('technical')
  ) {
    return 'deep_dive';
  }

  return 'follow_up';
}

/**
 * Interview Director
 *
 * Decides what the interview should investigate next.
 */
export function buildInterviewDirective(
  state: CandidateState,
  assessment: unknown,
  candidateRole: string,
  currentDifficulty: number,
  turnCount: number,
  maxTurns: number,
): InterviewDirective {
  let focusArea = 'reasoning';

  const weakest = findWeakestDimension(
    state.scores,
  );

  if (weakest) {
    focusArea = weakest[0];
  } else if (state.weaknesses.length > 0) {
    focusArea = state.weaknesses[0];
  }

  /*
   * If the latest answer contains uncertainty or
   * contradiction, clarification takes priority.
   */
  const needsClarification =
    state.uncertainties.length > 0;

  let interviewer = interviewerForFocus(
    focusArea,
  );

  let questionType = questionTypeForFocus(
    focusArea,
  );

  let reason =
    `Investigate the candidate's weakest area: ${focusArea}.`;

  let questionHint =
    `Ask a focused ${questionType} question about ${focusArea}.`;

  if (needsClarification) {
    interviewer = 'hiring_manager';
    questionType = 'clarification';

    reason =
      'A previous response contains uncertainty or a possible contradiction. Gather clarification before moving on.';

    questionHint =
      'Ask the candidate to clarify the earlier answer and explain the reasoning consistently.';
  }

  /*
   * ----------------------------------------------------------
   * Difficulty adaptation
   * ----------------------------------------------------------
   *
   * IMPORTANT:
   * Always normalize currentDifficulty first.
   * Older hot-reloaded sessions may not have a difficulty
   * property, which would otherwise result in NaN.
   */
  const safeCurrentDifficulty =
    typeof currentDifficulty === 'number' &&
      Number.isFinite(currentDifficulty)
      ? currentDifficulty
      : 3;

  let targetDifficulty =
    safeCurrentDifficulty;

  if (weakest) {
    const weakestScore = weakest[1];

    if (weakestScore >= 80) {
      targetDifficulty =
        safeCurrentDifficulty + 1;
    } else if (weakestScore < 60) {
      targetDifficulty =
        safeCurrentDifficulty - 1;
    }
  }

  targetDifficulty = Math.max(
    1,
    Math.min(10, targetDifficulty),
  );

  /*
   * Final turns should focus on collecting evidence.
   */
  if (turnCount >= maxTurns - 2) {
    questionType = 'targeted_follow_up';

    reason =
      `Collect final evidence for ${focusArea} before completing the assessment.`;

    questionHint =
      `Ask one concise follow-up that produces concrete evidence about ${focusArea}.`;
  }

  return {
    next_interviewer: interviewer,

    question_type: questionType,

    target_difficulty: targetDifficulty,

    focus_area: focusArea,

    reason,

    question_hint:
      `${questionHint} Candidate role: ${candidateRole}.`,
  };
}