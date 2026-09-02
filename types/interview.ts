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
};

// Placeholder until you've seen a real response from /interview/finish —
// widen or narrow this once you've called the webhook once and inspected it.
export type FinishResponse = {
  overall_score?: number;
  breakdown?: unknown;
  red_flags?: unknown;
  improvement_plan?: unknown;
  disclosure?: string;
  [key: string]: unknown;
};