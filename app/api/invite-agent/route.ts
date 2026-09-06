import { NextRequest, NextResponse } from 'next/server';

import {
  AgoraClient,
  Agent,
  Area,
  DeepgramSTT,
  ExpiresIn,
  MiniMaxTTS,
  OpenAI,
} from 'agora-agents';

import type { ClientStartRequest } from '@/types/conversation';

import { DEFAULT_AGENT_UID } from '@/lib/agora';
import { randomUUID } from 'crypto';
import { createSession } from '@/lib/interview-session-store';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

const ADA_PROMPT = `You are Ada, an agentic developer advocate from Agora. You help developers understand and build with Agora's Conversational AI platform.

You are friendly, technically credible, and concise.

Default to brief responses because this is a voice conversation.
Never list or enumerate.
Ask at most one question per turn.
Guide, don't lecture.`;

const GREETING =
  `Hi there! I'm Ada, your virtual assistant from Agora. How can I help?`;

const agentUid = String(DEFAULT_AGENT_UID);

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

export async function POST(request: NextRequest) {
  try {
    /**
     * ----------------------------------------------------------
     * 1. Parse request
     * ----------------------------------------------------------
     */

    const body: ClientStartRequest & {
      user_name?: string;
      role?: string;
    } = await request.json();

    const {
      requester_id,
      channel_name,
      role = 'Software Engineer',
    } = body;

    /**
     * Validate BEFORE Supabase authentication.
     *
     * This is important because validation tests run outside
     * a real Next.js request context.
     */

    if (!channel_name || !requester_id) {
      return NextResponse.json(
        {
          error:
            'channel_name and requester_id are required',
        },
        { status: 400 },
      );
    }

    /**
     * ----------------------------------------------------------
     * 2. Authenticate user
     * ----------------------------------------------------------
     */

    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          error: 'Authentication required',
        },
        { status: 401 },
      );
    }

    /**
     * ----------------------------------------------------------
     * 3. User information
     * ----------------------------------------------------------
     */

    const userName =
      (
        user.user_metadata?.full_name as
          | string
          | undefined
      )?.trim() ||
      user.email?.split('@')[0] ||
      'Candidate';

    /**
     * ----------------------------------------------------------
     * 4. Environment
     * ----------------------------------------------------------
     */

    const appId = requireEnv(
      'NEXT_PUBLIC_AGORA_APP_ID',
    );

    const appCertificate = requireEnv(
      'NEXT_AGORA_APP_CERTIFICATE',
    );

    /**
     * ----------------------------------------------------------
     * 5. Interview session
     * ----------------------------------------------------------
     */

    const sessionId = randomUUID();

    const firstQuestion =
      `Hi ${userName}, thanks for joining. To start, can you walk me through your background as it relates to the ${role} role?`;

    await createSession(sessionId, {
      userId: user.id,
      userName,
      role,
      lastQuestion: firstQuestion,
    });

    /**
     * ----------------------------------------------------------
     * 6. Agora client
     * ----------------------------------------------------------
     */

    const client = new AgoraClient({
      area: Area.US,
      appId,
      appCertificate,
    });

    /**
     * ----------------------------------------------------------
     * 7. Interview instructions
     * ----------------------------------------------------------
     */

    const interviewInstructions = `SESSION_ID:${sessionId}
USER_ID:${user.id}
USER_NAME:${userName}
ROLE:${role}

You are conducting a live spoken job interview.

When you receive a prompt from the system, respond with EXACTLY the question text you are given.

Do not add extra commentary.
Do not rephrase the question.
Speak naturally as if you are the interviewer.`;

    /**
     * ----------------------------------------------------------
     * 8. AI agent
     * ----------------------------------------------------------
     */

    const agent = new Agent({
      client,
      instructions: interviewInstructions,
      greeting: firstQuestion,
      failureMessage: 'Please wait a moment.',
      maxHistory: 50,

      turnDetection: {
        config: {
          speech_threshold: 0.5,

          start_of_speech: {
            mode: 'vad',

            vad_config: {
              interrupt_duration_ms: 160,
              prefix_padding_ms: 300,
            },
          },

          end_of_speech: {
            mode: 'vad',

            vad_config: {
              silence_duration_ms: 480,
            },
          },
        },
      },

      advancedFeatures: {
        enable_rtm: true,
        enable_tools: true,
      },

      parameters: {
        audio_scenario: 'chorus',
        data_channel: 'rtm',
        enable_error_message: true,
        enable_metrics: true,
      },
    })
      .withStt(
        new DeepgramSTT({
          model: 'nova-3',
          language: 'en',
        }),
      )

      .withLlm(
        new OpenAI({
          apiKey: requireEnv('NEXT_LLM_API_KEY'),
          url: requireEnv('NEXT_LLM_URL'),
          model: 'gpt-4o-mini',
          greetingMessage: firstQuestion,
          failureMessage: 'Please wait a moment.',
          maxHistory: 15,
          maxTokens: 1024,
          temperature: 0.7,
          topP: 0.95,
        }),
      )

      .withTts(
        new MiniMaxTTS({
          model: 'speech_2_6_turbo',
          voiceId:
            'English_captivating_female1',
        }),
      );

    /**
     * ----------------------------------------------------------
     * 9. Agora session
     * ----------------------------------------------------------
     */

    const session = agent.createSession({
      channel: channel_name,
      agentUid,
      remoteUids: [requester_id],
      idleTimeout: 30,
      expiresIn: ExpiresIn.hours(1),
      debug: false,
    });

    /**
     * ----------------------------------------------------------
     * 10. Start
     * ----------------------------------------------------------
     */

    const agentId = await session.start();

    /**
     * ----------------------------------------------------------
     * 11. Response
     * ----------------------------------------------------------
     */

    return NextResponse.json({
      agent_id: agentId,
      session_id: sessionId,
      create_ts: Math.floor(Date.now() / 1000),
      state: 'RUNNING',
    });
  } catch (error) {
    console.error(
      'Error starting conversation:',
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to start conversation',
      },
      { status: 500 },
    );
  }
}