export type SessionRecord = {
  userId: string;
  userName: string;
  role: string;
  candidateState: unknown;
  lastQuestion: string;
  turnCount: number;
  difficulty: number;
  finished: boolean;
  maxTurns: number;
  assessments: unknown[];
};

const BASE = (process.env.N8N_BASE_URL ?? '').replace(/\/$/, '');
const SESSION_PATH =
  process.env.N8N_SESSION_PATH ?? 'interview/session';
const FINISH_PATH =
  process.env.N8N_FINISH_PATH ?? 'interview/finish';

if (!BASE) {
  console.warn(
    '[interview-session-store] N8N_BASE_URL is not set',
  );
}

const sessionUrl = () => `${BASE}/${SESSION_PATH}`;
const finishUrl = () => `${BASE}/${FINISH_PATH}`;

const DEFAULT_MAX_TURNS = 8;

type Table1Row = {
  found?: boolean;
  session_id?: string;
  user_id?: string;
  user_name?: string;
  role?: string;
  candidate_state?: unknown;
  candidate_state_json?: string;
  transcript?: unknown[];
  turn_count?: number;
  current_difficulty?: string;
  status?: string;
  updated_at?: string | null;
};

function wordToNum(word: string | undefined): number {
  switch ((word ?? '').toLowerCase()) {
    case 'easy':
      return 3;
    case 'hard':
      return 8;
    default:
      return 5;
  }
}

function numToWord(n: number): string {
  if (n <= 3) return 'easy';
  if (n >= 8) return 'hard';
  return 'medium';
}

function rowToRecord(row: Table1Row): SessionRecord {
  const cs =
    (row.candidate_state ?? {}) as Record<string, unknown>;

  return {
    userId: row.user_id ?? 'unknown',
    userName: row.user_name ?? 'Candidate',
    role: row.role ?? 'Software Engineer',
    candidateState: row.candidate_state ?? {},
    lastQuestion:
      typeof cs.last_question === 'string'
        ? cs.last_question
        : '',
    turnCount: Number(row.turn_count) || 0,
    difficulty: wordToNum(row.current_difficulty),
    finished:
      (row.status ?? 'in_progress') === 'completed',
    maxTurns:
      typeof cs.max_turns === 'number'
        ? cs.max_turns
        : DEFAULT_MAX_TURNS,
    assessments:
      Array.isArray(cs.assessments)
        ? cs.assessments
        : [],
  };
}

function recordToUpsertBody(
  sessionId: string,
  rec: SessionRecord,
) {
  const baseState =
    rec.candidateState &&
    typeof rec.candidateState === 'object'
      ? {
          ...(rec.candidateState as Record<string, unknown>),
        }
      : {};

  const candidateState = {
    ...baseState,
    session_id: sessionId,
    last_question: rec.lastQuestion,
    max_turns: rec.maxTurns,
    assessments: rec.assessments,
  };

  return {
    session_id: sessionId,
    user_id: rec.userId,
    user_name: rec.userName,
    role: rec.role,
    candidate_state: candidateState,
    turn_count: rec.turnCount,
    current_difficulty: numToWord(rec.difficulty),
    status: rec.finished
      ? 'completed'
      : 'in_progress',
  };
}

async function upsertRow(
  sessionId: string,
  rec: SessionRecord,
): Promise<void> {
  const res = await fetch(sessionUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      recordToUpsertBody(sessionId, rec),
    ),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(
      `Session upsert failed (${res.status}): ${await res.text()}`,
    );
  }
}

export async function createSession(
  sessionId: string,
  data: Partial<SessionRecord>,
): Promise<SessionRecord> {
  const rec: SessionRecord = {
    userId: data.userId ?? 'unknown',
    userName: data.userName ?? 'Candidate',
    role: data.role ?? 'Software Engineer',
    candidateState: data.candidateState ?? {},
    lastQuestion: data.lastQuestion ?? '',
    turnCount: data.turnCount ?? 0,
    difficulty: data.difficulty ?? 5,
    finished: data.finished ?? false,
    maxTurns:
      data.maxTurns ?? DEFAULT_MAX_TURNS,
    assessments: data.assessments ?? [],
  };

  await upsertRow(sessionId, rec);

  return rec;
}

export async function getSession(
  sessionId: string | null | undefined,
): Promise<SessionRecord | null> {
  if (!sessionId) return null;

  const res = await fetch(
    `${sessionUrl()}?session_id=${encodeURIComponent(
      sessionId,
    )}`,
    {
      method: 'GET',
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    throw new Error(
      `Session read failed (${res.status}): ${await res.text()}`,
    );
  }

  const row = (await res.json()) as Table1Row;

  if (
    !row ||
    row.found === false ||
    !row.session_id
  ) {
    return null;
  }

  return rowToRecord(row);
}

export async function updateSession(
  sessionId: string,
  patch: Partial<SessionRecord>,
): Promise<SessionRecord | null> {
  const current = await getSession(sessionId);

  if (!current) return null;

  const merged: SessionRecord = {
    ...current,
    ...patch,
  };

  await upsertRow(sessionId, merged);

  return merged;
}

export async function finishInterview(
  sessionId: string,
): Promise<unknown> {
  await updateSession(sessionId, {
    finished: true,
  });

  const res = await fetch(finishUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: sessionId,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(
      `Finish failed (${res.status}): ${await res.text()}`,
    );
  }

  return await res.json();
}