

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { submitTurn } from '@/lib/n8n-client';
import { extractAudioFeatures } from '@/lib/audio-features';
import { getSession, updateSession, createSession } from '@/lib/interview-session-store';

type ChatMessage = { role: string; content: unknown };
type ChatBody = { messages?: ChatMessage[]; model?: string; [key: string]: unknown };

function extractSessionId(messages: ChatMessage[]): string | null {
  const system = messages.find((m) => m.role === 'system');
  const text = typeof system?.content === 'string' ? system.content : '';
  const match = text.match(/SESSION_ID:([a-f0-9-]+)/i);
  return match ? match[1] : null;
}

function lastUserMessageText(messages: ChatMessage[]): string {
  const userMessages = messages.filter((m) => m.role === 'user');
  const last = userMessages[userMessages.length - 1];
  return typeof last?.content === 'string' ? last.content : '';
}

export async function POST(request: NextRequest) {
  let body: ChatBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const messages = body.messages ?? [];
  const sessionId = extractSessionId(messages);

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing SESSION_ID in system prompt' }, { status: 400 });
  }

 let session = getSession(sessionId);
  
  // Prevent crash when Next.js dev server wipes memory
  if (!session) {
    session = createSession(sessionId, {
      userId: "recovered-user",
      userName: "Candidate",
      role: "Software Engineer",
      firstQuestion: "Could you repeat that?"
    });
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

    questionText = turnResponse.next_turn.question_text;

    updateSession(sessionId, {
      candidateState: turnResponse.candidate_state,
      lastQuestion: questionText,
      turnCount: session.turnCount + 1,
      difficulty: turnResponse.next_turn.target_difficulty ?? session.difficulty,
    });
  } catch (err) {
    console.error('[chat/completions] n8n turn failed:', err);
    questionText = "Sorry, I'm having trouble right now — could you repeat that?";
  }

  // Stream back exactly like an OpenAI SSE completion, so the Agora agent
  // TTS's this text as if the LLM had said it.
  const encoder = new TextEncoder();
  const id = `chatcmpl-${randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const model = body.model ?? 'n8n-interview-director';

  const sseChunk = (delta: Record<string, unknown>, finishReason: string | null = null) =>
    encoder.encode(
      `data: ${JSON.stringify({
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{ index: 0, delta, finish_reason: finishReason }],
      })}\n\n`,
    );

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sseChunk({ role: 'assistant', content: '' }));
      controller.enqueue(sseChunk({ content: questionText }));
      controller.enqueue(sseChunk({}, 'stop'));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}