type SessionRecord = {
  userId: string;
  userName: string;
  role: string;

  candidateState: unknown;

  lastQuestion: string;

  turnCount: number;

  difficulty: number;

  finished: boolean;

  maxTurns: number;

  /*
   * One assessment entry per completed candidate answer.
   */
  assessments: unknown[];
};

/*
 * In-memory store.
 *
 * This resets on a real server restart and does not work
 * across multiple server instances.
 *
 * Fine for the hackathon/demo.
 *
 * Later this can be replaced with Redis, PostgreSQL,
 * MongoDB, etc.
 *
 * Pinned to globalThis so Next.js dev-mode hot reload
 * doesn't silently create a fresh Map during an interview.
 */
const globalForSessions =
  globalThis as unknown as {
    __interviewSessions?: Map<
      string,
      SessionRecord
    >;
  };

const sessions =
  globalForSessions.__interviewSessions ??
  new Map<string, SessionRecord>();

globalForSessions.__interviewSessions =
  sessions;

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

    lastQuestion:
      init.firstQuestion,

    turnCount: 0,

    /*
     * Initial interview difficulty.
     */
    difficulty: 3,

    /*
     * Maximum number of candidate answers.
     */
    maxTurns: 8,

    /*
     * Whether the interview has finished.
     */
    finished: false,

    /*
     * One assessment entry per completed
     * candidate answer.
     */
    assessments: [],
  };

  sessions.set(
    sessionId,
    record,
  );

  return record;
}

export function getSession(
  sessionId: string,
): SessionRecord | undefined {
  return sessions.get(
    sessionId,
  );
}

export function updateSession(
  sessionId: string,
  patch: Partial<SessionRecord>,
): void {
  const existing =
    sessions.get(sessionId);

  if (!existing) {
    return;
  }

  sessions.set(
    sessionId,
    {
      ...existing,
      ...patch,
    },
  );
}