export type InterviewDirective = {
  next_interviewer: string;
  question_type: string;
  target_difficulty: number;
  focus_area: string;
  reason: string;
  question_hint: string;
};

export type TurnRequest = {
  session_id: string;
  user_id: string;
  user_name: string;
  role: string;
  question_context: string;
  transcript: string;

  audio_features: {
    speech_rate_wpm: number;
    filler_count: number;
    avg_pause_ms: number;
    voice_stability: number;
  };

  candidate_state: unknown;
  turn_count: number;
  difficulty: number;

  interview_directive?: InterviewDirective;
};

export type TurnResponse = {
  next_turn: {
    next_interviewer: string;
    question_text: string;
    target_difficulty: number;
  };

  assessment: unknown;
  candidate_state: unknown;
};

export type FinishRequest = {
  session_id: string;
  user_id: string;
  user_name: string;
  role: string;
  candidate_state: unknown;
  assessments: unknown[];
};

export interface DimensionBreakdown {
  dimension: string;
  score: number;
  feedback: string;
}

export interface ImprovementPlanItem {
  area: string;
  recommendation: string;
  resource: string;
}

export interface InterviewEvaluation {
  found?: boolean;

  session_id: string;
  user_id: string;
  user_name: string;
  target_role: string;

  disclosure?: string;

  overall_score: number;

  dimension_breakdown: DimensionBreakdown[];

  strengths: string[];
  weaknesses: string[];
  red_flags: string[];

  improvement_plan: ImprovementPlanItem[];

  summary: string;

  breakdown?: Record<string, number>;

  evidence?: unknown[];

  warning?: string;
}

export type FinishResponse = InterviewEvaluation;