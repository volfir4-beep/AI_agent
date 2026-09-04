type SessionRecord = {
  userId: string;
  userName: string;
  role: string;
  candidateState: unknown;
  lastQuestion: string;
  turnCount: number;
  difficulty: number;

  // Interview lifecycle
  maxTurns: number;
  finished: boolean;

  // Assessment collected after every candidate answer.
  // Kept as unknown because the exact n8n assessment schema can evolve.
  assessments: unknown[];
};

// In-memory store — resets on server restart.
// Fine for a hackathon demo; swap for Redis/DB later.
const sessions = new Map<string, SessionRecord>();

export function createSession(
  sessionId: string,
  init: {
    userId: string;
    userName: string;
    role: string;
    firstQuestion: string;
  },
): SessionRecord {
  const record: SessionRecord = {
    userId: init.userId,
    userName: init.userName,
    role: init.role,
    candidateState: {},
    lastQuestion: init.firstQuestion,
    turnCount: 0,
    difficulty: 3,

    // Maximum number of candidate answers
    maxTurns: 8,

    // Whether the interview has finished
    finished: false,

    // One assessment entry per completed candidate answer.
    assessments: [],
  };

  sessions.set(sessionId, record);
  return record;
}

export function getSession(sessionId: string): SessionRecord | undefined {
  return sessions.get(sessionId);
}

export function updateSession(
  sessionId: string,
  patch: Partial<SessionRecord>,
): void {
  const existing = sessions.get(sessionId);
  if (!existing) return;

  sessions.set(sessionId, {
    ...existing,
    ...patch,
  });
}
