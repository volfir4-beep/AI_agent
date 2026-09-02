type SessionRecord = {
  userId: string;
  userName: string;
  role: string;
  candidateState: unknown;
  lastQuestion: string;
  turnCount: number;
  difficulty: number;
};

// In-memory store — resets on server restart, doesn't work across multiple
// server instances. Fine for a hackathon demo; swap for Redis/DB later.
const sessions = new Map<string, SessionRecord>();

export function createSession(
  sessionId: string,
  init: { userId: string; userName: string; role: string; firstQuestion: string },
): SessionRecord {
  const record: SessionRecord = {
    userId: init.userId,
    userName: init.userName,
    role: init.role,
    candidateState: {},
    lastQuestion: init.firstQuestion,
    turnCount: 0,
    difficulty: 3,
  };
  sessions.set(sessionId, record);
  return record;
}

export function getSession(sessionId: string): SessionRecord | undefined {
  return sessions.get(sessionId);
}

export function updateSession(sessionId: string, patch: Partial<SessionRecord>): void {
  const existing = sessions.get(sessionId);
  if (!existing) return;
  sessions.set(sessionId, { ...existing, ...patch });
}