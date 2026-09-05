import type {
  TurnRequest,
  TurnResponse,
  FinishRequest,
  FinishResponse,
} from '@/types/interview';

/**
 * Reads a required environment variable.
 */
function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

/**
 * Returns the configured n8n webhook base URL.
 *
 * Example:
 *
 * NEXT_N8N_BASE_URL=https://your-n8n-domain/webhook
 *
 * Then:
 *
 * /interview/turn
 * /interview/finish
 * /interview/leaderboard
 */
function getN8nBaseUrl(): string {
  return requireEnv('NEXT_N8N_BASE_URL').replace(/\/+$/, '');
}

/**
 * Submit one interview turn to n8n.
 */
export async function submitTurn(
  payload: TurnRequest,
): Promise<TurnResponse> {
  const url = `${getN8nBaseUrl()}/interview/turn`;

  const res = await fetch(url, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
    },

    body: JSON.stringify(payload),

    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();

    throw new Error(
      `n8n /interview/turn failed: ${res.status} ${errorText}`,
    );
  }

  return res.json();
}

/**
 * Finish the interview and request the final evaluation.
 *
 * n8n should return:
 *
 * - overall_score
 * - dimension_breakdown
 * - strengths
 * - weaknesses
 * - red_flags
 * - improvement_plan
 * - summary
 * - evidence
 */
export async function finishInterview(
  payload: FinishRequest,
): Promise<FinishResponse> {
  const url = `${getN8nBaseUrl()}/interview/finish`;

  const res = await fetch(url, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
    },

    body: JSON.stringify(payload),

    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();

    throw new Error(
      `n8n /interview/finish failed: ${res.status} ${errorText}`,
    );
  }

  const data = await res.json();

  return data as FinishResponse;
}

/**
 * Fetch leaderboard data from n8n.
 */
export async function fetchLeaderboard(
  role?: string,
): Promise<unknown> {
  const url = new URL(
    `${getN8nBaseUrl()}/interview/leaderboard`,
  );

  if (role) {
    url.searchParams.set('role', role);
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();

    throw new Error(
      `n8n /interview/leaderboard failed: ${res.status} ${errorText}`,
    );
  }

  return res.json();
}