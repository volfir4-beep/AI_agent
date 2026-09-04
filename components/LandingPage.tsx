'use client';

import { useState, useRef, Suspense, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import type { RTMClient } from 'agora-rtm';
import type {
  AgoraTokenData,
  ClientStartRequest,
  AgentResponse,
  AgoraRenewalTokens,
} from '../types/conversation';
import { ErrorBoundary } from './ErrorBoundary';
import { LoadingSkeleton } from './LoadingSkeleton';
import { QuickstartPreCallCard } from './QuickstartPreCallCard';

// Dynamically import the ConversationComponent with ssr disabled
const ConversationComponent = dynamic(() => import('./ConversationComponent'), {
  ssr: false,
});

// Dynamically import AgoraRTCProvider (browser-only).
// The AgoraVoiceAI toolkit is initialized inside ConversationComponent after
// the RTC join succeeds, so this wrapper only needs to provide the RTC client.
const AgoraProvider = dynamic(
  async () => {
    const { AgoraRTCProvider, default: AgoraRTC } =
      await import('agora-rtc-react');

    return {
      default: function AgoraProviders({
        children,
      }: {
        children: React.ReactNode;
      }) {
        // useRef persists across StrictMode's simulated unmount/remount, so only
        // one RTC client is ever created per session.
        const clientRef = useRef<ReturnType<
          typeof AgoraRTC.createClient
        > | null>(null);

        if (!clientRef.current) {
          clientRef.current = AgoraRTC.createClient({
            mode: 'rtc',
            codec: 'vp8',
          });
        }

        return (
          <AgoraRTCProvider client={clientRef.current}>
            {children}
          </AgoraRTCProvider>
        );
      },
    };
  },
  { ssr: false },
);

// ------------------------------------------------------------
// Adaptive interview state returned by /api/interview/state
// ------------------------------------------------------------

type AdaptiveState = {
  interview: {
    finished: boolean;
    turn_count: number;
    max_turns: number;
    progress: string;
  };

  candidate_state: {
    scores: Record<string, number>;
    strengths: string[];
    weaknesses: string[];
    uncertainties: string[];
    evidence: string[];
    turn_count: number;
    focus_area?: string;
    last_assessment_score?: number | null;
  };

  interview_directive: {
    next_interviewer: string;
    question_type: string;
    target_difficulty: number;
    focus_area: string;
    reason: string;
    question_hint: string;
  };
};

export default function LandingPage() {
  const [showConversation, setShowConversation] = useState(false);

  const endingRef = useRef(false);

  // Preload heavy modules on mount so they're already cached when the user
  // clicks "Try it Now" — eliminates the dynamic-import delay.
  useEffect(() => {
    import('agora-rtc-react').catch(() => {});
    import('agora-rtm').catch(() => {});
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agoraData, setAgoraData] = useState<AgoraTokenData | null>(null);
  const [rtmClient, setRtmClient] = useState<RTMClient | null>(null);

  const [agentJoinError, setAgentJoinError] = useState(false);

  // Final interview report
  const [report, setReport] = useState<unknown | null>(null);

  // ------------------------------------------------------------
  // Adaptive interview debug state
  // ------------------------------------------------------------

  const [adaptiveState, setAdaptiveState] =
    useState<AdaptiveState | null>(null);

  // ------------------------------------------------------------
  // Start conversation
  // ------------------------------------------------------------

  const handleStartConversation = async () => {
    endingRef.current = false;

    setIsLoading(true);
    setError(null);
    setAgentJoinError(false);
    setAdaptiveState(null);
    setReport(null);

    try {
      // 1. Fetch RTC token + channel
      const agoraResponse = await fetch('/api/generate-agora-token');

      const responseData = await agoraResponse.json();

      if (!agoraResponse.ok) {
        throw new Error(
          `Failed to generate Agora token: ${JSON.stringify(responseData)}`
        );
      }

      // 2. Run agent invite and RTM setup in parallel.
      const [agentData, rtm] = await Promise.all([
        // 2a. Start the AI agent
        fetch('/api/invite-agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requester_id: responseData.uid,
            channel_name: responseData.channel,
            user_name: 'Candidate',
            role: 'Software Engineer',
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              setAgentJoinError(true);
              return null;
            }

            return res.json() as Promise<AgentResponse>;
          })
          .catch((err) => {
            console.error(
              'Failed to start conversation with agent:',
              err
            );

            setAgentJoinError(true);

            return null;
          }),

        // 2b. Set up RTM
        (async () => {
          const { default: AgoraRTM } = await import('agora-rtm');

          const rtm: RTMClient = new AgoraRTM.RTM(
            process.env.NEXT_PUBLIC_AGORA_APP_ID!,
            responseData.uid
          );

          await rtm.login({
            token: responseData.token,
          });

          await rtm.subscribe(responseData.channel);

          return rtm;
        })(),
      ]);

      // 3. All dependencies ready — store state and show conversation
      setRtmClient(rtm);

      setAgoraData({
        ...responseData,
        agentId: agentData?.agent_id,
        sessionId: agentData?.session_id,
      });

      setShowConversation(true);
    } catch (err) {
      setError(
        'Failed to start conversation. Please try again.'
      );

      console.error('Error starting conversation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------
  // Agora token renewal
  // ------------------------------------------------------------

  const handleTokenWillExpire = useCallback(
    async (uid: string): Promise<AgoraRenewalTokens> => {
      try {
        const channel = agoraData?.channel;

        if (!channel) {
          throw new Error('Missing channel for token renewal');
        }

        // RTC and RTM tokens are renewed independently.
        const [rtcResponse, rtmResponse] = await Promise.all([
          fetch(
            `/api/generate-agora-token?channel=${channel}&uid=${uid}`
          ),

          fetch(
            `/api/generate-agora-token?channel=${channel}&uid=${agoraData.uid}`
          ),
        ]);

        const [rtcData, rtmData] = await Promise.all([
          rtcResponse.json(),
          rtmResponse.json(),
        ]);

        if (!rtcResponse.ok || !rtmResponse.ok) {
          throw new Error(
            'Failed to generate renewal tokens'
          );
        }

        return {
          rtcToken: rtcData.token,
          rtmToken: rtmData.token,
        };
      } catch (error) {
        console.error(
          'Error renewing token:',
          error
        );

        throw error;
      }
    },
    [agoraData]
  );

  // ------------------------------------------------------------
  // End conversation
  // ------------------------------------------------------------

  const handleEndConversation = useCallback(async () => {
    if (endingRef.current) {
      return;
    }

    endingRef.current = true;

    // Stop Agora AI agent
    if (agoraData?.agentId) {
      try {
        const response = await fetch(
          '/api/stop-conversation',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              agent_id: agoraData.agentId,
            }),
          }
        );

        if (!response.ok) {
          console.error(
            'Failed to stop agent:',
            await response.text()
          );
        }
      } catch (error) {
        console.error(
          'Error stopping agent:',
          error
        );
      }
    }

    // Generate final interview report
    if (agoraData?.sessionId) {
      try {
        const res = await fetch(
          '/api/interview/finish',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              session_id: agoraData.sessionId,
            }),
          }
        );

        if (!res.ok) {
          console.error(
            'Failed to fetch final report:',
            await res.text()
          );
        } else {
          setReport(await res.json());
        }
      } catch (error) {
        console.error(
          'Error fetching final report:',
          error
        );
      }
    }

    // Logout RTM
    rtmClient?.logout().catch((err) =>
      console.error(
        'RTM logout error:',
        err
      )
    );

    setRtmClient(null);
    setShowConversation(false);
  }, [agoraData, rtmClient]);

  // ------------------------------------------------------------
  // Poll interview status
  // ------------------------------------------------------------

  useEffect(() => {
    if (
      !showConversation ||
      !agoraData?.sessionId
    ) {
      return;
    }

    const sessionId = agoraData.sessionId;

    let finishTimeout: number | undefined;

    const interval = window.setInterval(
      async () => {
        if (endingRef.current) {
          return;
        }

        try {
          const response = await fetch(
            `/api/interview/status?session_id=${encodeURIComponent(
              sessionId
            )}`,
            {
              cache: 'no-store',
            }
          );

          if (!response.ok) {
            return;
          }

          const status = await response.json();

          console.log(
            `Interview progress: ${status.turnCount}/${status.maxTurns}`
          );

          if (status.finished) {
            window.clearInterval(interval);

            console.log(
              'Interview finished. Waiting for final message to play...'
            );

            finishTimeout = window.setTimeout(
              () => {
                if (!endingRef.current) {
                  void handleEndConversation();
                }
              },
              5000
            );
          }
        } catch (error) {
          console.error(
            'Error checking interview status:',
            error
          );
        }
      },
      1000
    );

    return () => {
      window.clearInterval(interval);

      if (finishTimeout !== undefined) {
        window.clearTimeout(finishTimeout);
      }
    };
  }, [
    showConversation,
    agoraData?.sessionId,
    handleEndConversation,
  ]);

  // ------------------------------------------------------------
  // Poll adaptive candidate state
  // ------------------------------------------------------------

  useEffect(() => {
    if (
      !showConversation ||
      !agoraData?.sessionId
    ) {
      return;
    }

    const sessionId = agoraData.sessionId;

    const fetchAdaptiveState = async () => {
      try {
        const response = await fetch(
          `/api/interview/state?session_id=${encodeURIComponent(
            sessionId
          )}`,
          {
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          return;
        }

        const state =
          (await response.json()) as AdaptiveState;

        setAdaptiveState(state);
      } catch (error) {
        console.error(
          'Error fetching adaptive interview state:',
          error
        );
      }
    };

    // Fetch immediately
    void fetchAdaptiveState();

    // Then keep it updated during the interview
    const interval = window.setInterval(
      fetchAdaptiveState,
      1000
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [
    showConversation,
    agoraData?.sessionId,
  ]);

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  return (
    <div className="relative flex h-dvh min-h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Hero shell: either shows the pre-call CTA or swaps in the live conversation experience. */}
      <div
        className={`flex min-h-0 flex-1 flex-col ${
          showConversation
            ? 'items-stretch justify-start'
            : 'items-center justify-center'
        }`}
      >
        <div
          className={`z-10 flex min-h-0 flex-1 flex-col ${
            showConversation
              ? 'h-full w-full max-w-none items-stretch gap-0 px-0 text-left'
              : 'w-full max-w-none items-center justify-center px-4 text-center'
          }`}
        >
          {!showConversation ? (
            <QuickstartPreCallCard
              isLoading={isLoading}
              error={error}
              onStartConversation={
                handleStartConversation
              }
            />
          ) : agoraData && rtmClient ? (
            <>
              {/* ------------------------------------------------
                  Adaptive Interview Debug Panel
                  ------------------------------------------------ */}

              {adaptiveState && (
                <div className="fixed right-4 top-4 z-40 w-72 rounded-lg border bg-card/95 p-4 text-xs shadow-lg backdrop-blur">
                  <div className="mb-3 font-semibold">
                    🧠 Adaptive Interview
                  </div>

                  {/* Interview progress */}
                  <div className="mb-3 text-muted-foreground">
                    Turn:{' '}
                    {
                      adaptiveState.interview
                        .turn_count
                    }{' '}
                    /{' '}
                    {
                      adaptiveState.interview
                        .max_turns
                    }
                  </div>

                  {/* Candidate scores */}
                  <div className="mb-3 space-y-1">
                    <div className="mb-2 font-medium">
                      Candidate State
                    </div>

                    {Object.entries(
                      adaptiveState
                        .candidate_state
                        .scores
                    ).map(
                      ([
                        dimension,
                        score,
                      ]) => (
                        <div
                          key={dimension}
                          className="flex justify-between gap-3"
                        >
                          <span className="capitalize text-muted-foreground">
                            {dimension.replace(
                              /_/g,
                              ' '
                            )}
                          </span>

                          <span className="font-medium">
                            {Math.round(score)}
                          </span>
                        </div>
                      )
                    )}
                  </div>

                  {/* Current focus */}
                  <div className="space-y-1 border-t pt-3">
                    <div>
                      <span className="text-muted-foreground">
                        Focus:
                      </span>{' '}
                      {adaptiveState
                        .interview_directive
                        .focus_area ||
                        '—'}
                    </div>

                    <div>
                      <span className="text-muted-foreground">
                        Next:
                      </span>{' '}
                      {adaptiveState
                        .interview_directive
                        .next_interviewer ||
                        '—'}
                    </div>

                    <div>
                      <span className="text-muted-foreground">
                        Type:
                      </span>{' '}
                      {adaptiveState
                        .interview_directive
                        .question_type ||
                        '—'}
                    </div>

                    <div>
                      <span className="text-muted-foreground">
                        Difficulty:
                      </span>{' '}
                      {adaptiveState
                        .interview_directive
                        .target_difficulty ??
                        '—'}
                      /10
                    </div>
                  </div>

                  {/* Reason */}
                  {adaptiveState
                    .interview_directive
                    .reason && (
                    <div className="mt-3 border-t pt-3">
                      <div className="mb-1 text-muted-foreground">
                        Why:
                      </div>

                      <div>
                        {
                          adaptiveState
                            .interview_directive
                            .reason
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Non-fatal invite warning */}
              {agentJoinError && (
                <div className="max-w-sm rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  Failed to connect with AI
                  agent. The conversation may
                  not work as expected.
                </div>
              )}

              {/* Browser-only conversation mount */}
              <Suspense
                fallback={
                  <LoadingSkeleton />
                }
              >
                <ErrorBoundary>
                  <AgoraProvider>
                    <ConversationComponent
                      agoraData={agoraData}
                      rtmClient={rtmClient}
                      onTokenWillExpire={
                        handleTokenWillExpire
                      }
                      onEndConversation={
                        handleEndConversation
                      }
                    />
                  </AgoraProvider>
                </ErrorBoundary>
              </Suspense>
            </>
          ) : (
            /* Fallback if session bootstrap partially succeeded */
            <p className="text-sm text-muted-foreground">
              Failed to load conversation
              data.
            </p>
          )}
        </div>
      </div>

      {/* Persistent attribution footer */}
      <footer className="fixed bottom-0 right-0 z-40 py-4 pr-4 md:py-6 md:pr-6">
        <div className="flex items-center justify-end gap-2 text-muted-foreground">
          <span className="text-xs font-medium tracking-wide uppercase">
            Powered by
          </span>

          <a
            href="https://agora.io/en/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-primary"
            aria-label="Visit Agora's website"
          >
            <Image
              src="/agora-logo-rgb-blue.svg"
              alt="Agora"
              width={86}
              height={24}
              priority
              className="h-6 w-auto translate-y-1 transition-opacity hover:opacity-80"
            />

            <span className="sr-only">
              Agora
            </span>
          </a>
        </div>
      </footer>

      {/* --------------------------------------------------------
          Final Report
          -------------------------------------------------------- */}

      {report !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <pre className="max-h-[80vh] max-w-2xl overflow-auto rounded-lg bg-card p-4 text-xs text-foreground">
            {JSON.stringify(
              report,
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}