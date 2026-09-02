import type { TurnRequest, TurnResponse, FinishRequest, FinishResponse } from '@/types/interview';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function submitTurn(payload: TurnRequest): Promise<TurnResponse> {
  const res = await fetch(`${requireEnv('NEXT_N8N_BASE_URL')}/interview/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`n8n /interview/turn failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function finishInterview(payload: FinishRequest): Promise<FinishResponse> {
  const res = await fetch(`${requireEnv('NEXT_N8N_BASE_URL')}/interview/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`n8n /interview/finish failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function fetchLeaderboard(role?: string): Promise<unknown> {
  const url = new URL(`${requireEnv('NEXT_N8N_BASE_URL')}/interview/leaderboard`);
  if (role) url.searchParams.set('role', role);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`n8n /interview/leaderboard failed: ${res.status}`);
  }
  return res.json();
}