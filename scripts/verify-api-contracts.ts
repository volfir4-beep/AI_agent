import { AgoraClient, Agent } from 'agora-agents';
import { NextRequest } from 'next/server';

// ----------------------------------------------------------
// Test environment
// ----------------------------------------------------------

// Use a fake authenticated user from lib/supabase/auth.ts.
// This prevents the test from accessing Supabase cookies.
process.env.API_CONTRACT_TEST = 'true';

// Fake Agora credentials for the contract test.
process.env.NEXT_PUBLIC_AGORA_APP_ID =
  '0123456789abcdef0123456789abcdef';

process.env.NEXT_AGORA_APP_CERTIFICATE =
  'fedcba9876543210fedcba9876543210';

// Fake LLM configuration.
// These are NOT real API credentials.
// The Agent session is mocked below, so no real LLM request is made.
process.env.NEXT_LLM_API_KEY = 'contract-test-key';
process.env.NEXT_LLM_URL = 'https://contract-test.invalid';

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function getJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

// ----------------------------------------------------------
// Invite agent - validation
// ----------------------------------------------------------

async function verifyInviteAgentValidation() {
  const { POST: inviteAgent } =
    await import('../app/api/invite-agent/route');

  const request = new NextRequest(
    'http://localhost:3000/api/invite-agent',
    {
      body: JSON.stringify({
        channel_name: 'missing-requester',
      }),
      method: 'POST',
    },
  );

  const response = await inviteAgent(request);
  const body = await getJson(response);

  assert(
    response.status === 400,
    'POST /api/invite-agent should reject missing fields',
  );

  assert(
    body.error ===
      'channel_name and requester_id are required',
    'POST /api/invite-agent should explain validation failure',
  );
}

// ----------------------------------------------------------
// Invite agent - success
// ----------------------------------------------------------

async function verifyInviteAgentSuccess() {
  const { POST: inviteAgent } =
    await import('../app/api/invite-agent/route');

  const originalCreateSession =
    Agent.prototype.createSession;

  let capturedSessionConfig: {
    channel?: string;
    agentUid?: string;
    remoteUids?: string[];
  } | null = null;

  Agent.prototype.createSession =
    ((sessionConfig: unknown) => {
      capturedSessionConfig =
        sessionConfig as {
          channel?: string;
          agentUid?: string;
          remoteUids?: string[];
        };

      return {
        start: async () => 'mock-agent-id',
      };
    }) as unknown as typeof Agent.prototype.createSession;

  try {
    const request = new NextRequest(
      'http://localhost:3000/api/invite-agent',
      {
        body: JSON.stringify({
          requester_id: 'user-4321',
          channel_name: 'test-channel',
        }),
        method: 'POST',
      },
    );

    const response = await inviteAgent(request);
    const body = await getJson(response);

    assert(
      response.status === 200,
      'POST /api/invite-agent should return 200 on success',
    );

    assert(
      body.agent_id === 'mock-agent-id',
      'POST /api/invite-agent should return the started agent id',
    );

    assert(
      body.state === 'RUNNING',
      'POST /api/invite-agent should return RUNNING state',
    );

    assert(
      capturedSessionConfig !== null,
      'POST /api/invite-agent should call createSession',
    );

    const sessionConfig =
      capturedSessionConfig as {
        channel?: string;
        agentUid?: string;
        remoteUids?: string[];
      };

    assert(
      sessionConfig.channel === 'test-channel',
      'POST /api/invite-agent should pass the requested channel to createSession',
    );

    assert(
      sessionConfig.agentUid === '123456',
      'POST /api/invite-agent should use the shared default agent UID',
    );

    assert(
      JSON.stringify(sessionConfig.remoteUids) ===
        JSON.stringify(['user-4321']),
      'POST /api/invite-agent should scope the session to the requesting user',
    );
  } finally {
    Agent.prototype.createSession =
      originalCreateSession;
  }
}

// ----------------------------------------------------------
// Stop conversation - validation
// ----------------------------------------------------------

async function verifyStopConversationValidation() {
  const { POST: stopConversation } =
    await import('../app/api/stop-conversation/route');

  const request = new NextRequest(
    'http://localhost:3000/api/stop-conversation',
    {
      body: JSON.stringify({}),
      method: 'POST',
    },
  );

  const response = await stopConversation(request);
  const body = await getJson(response);

  assert(
    response.status === 400,
    'POST /api/stop-conversation should reject missing agent_id',
  );

  assert(
    body.error === 'agent_id is required',
    'POST /api/stop-conversation should explain validation failure',
  );
}

// ----------------------------------------------------------
// Stop conversation - success
// ----------------------------------------------------------

async function verifyStopConversationSuccess() {
  const { POST: stopConversation } =
    await import('../app/api/stop-conversation/route');

  const originalStopAgent =
    AgoraClient.prototype.stopAgent;

  let stoppedAgentId: string | null = null;

  AgoraClient.prototype.stopAgent =
    (async function (
      this: AgoraClient,
      agentId: string,
    ) {
      stoppedAgentId = agentId;
    }) as typeof AgoraClient.prototype.stopAgent;

  try {
    const request = new NextRequest(
      'http://localhost:3000/api/stop-conversation',
      {
        body: JSON.stringify({
          agent_id: 'mock-agent-id',
        }),
        method: 'POST',
      },
    );

    const response = await stopConversation(request);
    const body = await getJson(response);

    assert(
      response.status === 200,
      'POST /api/stop-conversation should return 200 on success',
    );

    assert(
      body.success === true,
      'POST /api/stop-conversation should return success',
    );

    assert(
      stoppedAgentId === 'mock-agent-id',
      'POST /api/stop-conversation should call stopAgent with the requested agent id',
    );
  } finally {
    AgoraClient.prototype.stopAgent =
      originalStopAgent;
  }
}

// ----------------------------------------------------------
// Main
// ----------------------------------------------------------

async function main() {
  await verifyInviteAgentValidation();
  await verifyInviteAgentSuccess();
  await verifyStopConversationValidation();
  await verifyStopConversationSuccess();

  console.log('API contract checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});