import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { submitTurn } from '@/lib/n8n-client';
import { extractAudioFeatures } from '@/lib/audio-features';
import {
  getSession,
  updateSession,
  createSession,
} from '@/lib/interview-session-store';

type ChatMessage = {
  role: string;
  content: unknown;
};

type ChatBody = {
  messages?: ChatMessage[];
  model?: string;
  [key: string]: unknown;
};

function extractSessionId(messages: ChatMessage[]): string | null {
  const system = messages.find((m) => m.role === 'system');

  const text =
    typeof system?.content === 'string'
      ? system.content
      : '';

  const match = text.match(/SESSION_ID:([a-f0-9-]+)/i);

  return match ? match[1] : null;
}

function extractSystemValue(
  messages: ChatMessage[],
  key: string,
): string | null {
  const system = messages.find((m) => m.role === 'system');
  const text =
    typeof system?.content === 'string'
      ? system.content
      : '';

  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(
    new RegExp(`(?:^|\\n)${escapedKey}:([^\\n]+)`, 'i'),
  );

  return match ? match[1].trim() : null;
}

function lastUserMessageText(messages: ChatMessage[]): string {
  const userMessages = messages.filter(
    (m) => m.role === 'user',
  );

  const last = userMessages[userMessages.length - 1];

  return typeof last?.content === 'string'
    ? last.content
    : '';
}

export async function POST(request: NextRequest) {
  let body: ChatBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const messages = body.messages ?? [];

  const sessionId = extractSessionId(messages);

  if (!sessionId) {
    return NextResponse.json(
      {
        error: 'Missing SESSION_ID in system prompt',
      },
      { status: 400 },
    );
  }

  let session = await getSession(sessionId);

  // Next.js development restarts can clear the in-memory session.
  // Recover the stable identity from the system prompt that was created
  // when the authenticated interview started.
  if (!session) {
    const recoveredUserId = extractSystemValue(messages, 'USER_ID');
    const recoveredUserName =
      extractSystemValue(messages, 'USER_NAME') ?? 'Candidate';
    const recoveredRole =
      extractSystemValue(messages, 'ROLE') ?? 'Software Engineer';

    if (!recoveredUserId) {
      return createSSEResponse(
        'Sorry, this interview session expired. Please start the interview again.',
        body.model,
      );
    }

    session = await createSession(sessionId, {
      userId: recoveredUserId,
      userName: recoveredUserName,
      role: recoveredRole,
      lastQuestion: 'Could you repeat that?',
    });
  }

  // If the interview was already finished, don't generate another question.
  if (session.finished) {
    return createSSEResponse(
      'Thank you. The interview has concluded.',
      body.model,
    );
  }

  const transcript = lastUserMessageText(messages);

  let questionText: string;

  try {
    const turnResponse = await submitTurn({
      session_id: sessionId,
      user_id: session.userId,
      user_name: session.userName,
      role: session.role,
      question_context: session.lastQuestion,
      transcript,
      audio_features: extractAudioFeatures(transcript),
      candidate_state: session.candidateState,
      turn_count: session.turnCount,
      difficulty: session.difficulty,
    });

    const newTurnCount = session.turnCount + 1;

    /*
     * IMPORTANT:
     * n8n already returns an assessment for the candidate's answer.
     * Previously we received it and immediately discarded it.
     *
     * We now retain every assessment in the interview session so the
     * final report can use the complete evidence from all turns.
     */
    const updatedAssessments = [
      ...session.assessments,
      turnResponse.assessment ?? {
        score: null,
        note: 'No assessment returned for this turn',
      },
    ];

    const isFinalTurn =
      newTurnCount >= session.maxTurns;

    if (isFinalTurn) {
      questionText =
        'Thank you. That concludes the interview. Your responses will now be evaluated.';

      await updateSession(sessionId, {
        candidateState: turnResponse.candidate_state,
        lastQuestion: questionText,
        turnCount: newTurnCount,
        difficulty:
          turnResponse.next_turn?.target_difficulty ??
          session.difficulty,
        assessments: updatedAssessments,
        finished: true,
      });
    } else {
      questionText =
        turnResponse.next_turn?.question_text ??
        'Could you elaborate on your answer?';

      await updateSession(sessionId, {
        candidateState: turnResponse.candidate_state,
        lastQuestion: questionText,
        turnCount: newTurnCount,
        difficulty:
          turnResponse.next_turn?.target_difficulty ??
          session.difficulty,
        assessments: updatedAssessments,
      });
    }
  } catch (err) {
    console.error(
      '[chat/completions] n8n turn failed:',
      err,
    );

    questionText =
      "Sorry, I'm having trouble right now — could you repeat that?";
  }

  return createSSEResponse(
    questionText,
    body.model,
  );
}

/*
 * Creates an OpenAI-compatible SSE response
 * for the Agora conversational agent.
 */
function createSSEResponse(
  questionText: string,
  model?: string,
) {
  const encoder = new TextEncoder();

  const id = `chatcmpl-${randomUUID()}`;

  const created = Math.floor(
    Date.now() / 1000,
  );

  const selectedModel =
    model ?? 'n8n-interview-director';

  const sseChunk = (
    delta: Record<string, unknown>,
    finishReason: string | null = null,
  ) =>
    encoder.encode(
      `data: ${JSON.stringify({
        id,
        object: 'chat.completion.chunk',
        created,
        model: selectedModel,
        choices: [
          {
            index: 0,
            delta,
            finish_reason: finishReason,
          },
        ],
      })}\n\n`,
    );

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        sseChunk({
          role: 'assistant',
          content: '',
        }),
      );

      controller.enqueue(
        sseChunk({
          content: questionText,
        }),
      );

      controller.enqueue(
        sseChunk({}, 'stop'),
      );

      controller.enqueue(
        encoder.encode('data: [DONE]\n\n'),
      );

      controller.close();
    },
  });

  return new NextResponse(stream, {
    status: 200,

    headers: {
      'Content-Type':
        'text/event-stream',
      'Cache-Control':
        'no-cache',
      Connection: 'keep-alive',
    },
  });
}
