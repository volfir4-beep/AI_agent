'use client';

import {
  useState,
  useRef,
  Suspense,
  useEffect,
  useCallback,
} from 'react';

import dynamic from 'next/dynamic';

import Image from 'next/image';
import Link from 'next/link';

import type { RTMClient } from 'agora-rtm';

import type {
  AgoraTokenData,
  AgentResponse,
  AgoraRenewalTokens,
} from '../types/conversation';

import type {
  InterviewEvaluation,
  DimensionBreakdown,
} from '../types/interview';

import { ErrorBoundary } from './ErrorBoundary';

import { LoadingSkeleton } from './LoadingSkeleton';

import { QuickstartPreCallCard } from './QuickstartPreCallCard';

import ScoreGauge from './ScoreGauge';

import PerformancePieChart from './PerformancePieChart';
import UserMenu from './UserMenu';

const ConversationComponent =
  dynamic(
    () =>
      import(
        './ConversationComponent'
      ),
    {
      ssr: false,
    },
  );

const AgoraProvider = dynamic(
  async () => {
    const {
      AgoraRTCProvider,
      default: AgoraRTC,
    } = await import(
      'agora-rtc-react'
    );

    return {
      default: function AgoraProviders({
        children,
      }: {
        children: React.ReactNode;
      }) {
        const clientRef =
          useRef<
            ReturnType<
              typeof AgoraRTC.createClient
            > | null
          >(null);

        if (!clientRef.current) {
          clientRef.current =
            AgoraRTC.createClient({
              mode: 'rtc',
              codec: 'vp8',
            });
        }

        return (
          <AgoraRTCProvider
            client={
              clientRef.current
            }
          >
            {children}
          </AgoraRTCProvider>
        );
      },
    };
  },
  {
    ssr: false,
  },
);

type AdaptiveState = {
  interview: {
    finished: boolean;
    turn_count: number;
    max_turns: number;
    progress: string;
    difficulty: number;
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

function getDimensionScore(
  report: InterviewEvaluation,
  names: string[],
): number {
  const dimension =
    report.dimension_breakdown?.find(
      (item) =>
        names.some(
          (name) =>
            item.dimension
              .toLowerCase()
              .replace(/_/g, ' ') ===
            name.toLowerCase(),
        ),
    );

  if (dimension) {
    return Number(dimension.score) || 0;
  }

  const breakdown =
    report.breakdown ?? {};

  for (const name of names) {
    const key =
      Object.keys(breakdown).find(
        (key) =>
          key
            .toLowerCase()
            .replace(/_/g, ' ') ===
          name.toLowerCase(),
      );

    if (key) {
      return (
        Number(
          breakdown[key],
        ) || 0
      );
    }
  }

  return 0;
}

function Scorecard({
  report,
}: {
  report: InterviewEvaluation;
}) {
  const technicalScore =
    getDimensionScore(
      report,
      ['knowledge'],
    );

  const problemSolvingScore =
    getDimensionScore(
      report,
      ['reasoning'],
    );

  const communicationScore =
    getDimensionScore(
      report,
      ['communication'],
    );

  const dimensions =
    report.dimension_breakdown ??
    Object.entries(
      report.breakdown ?? {},
    ).map(
      ([dimension, score]) => ({
        dimension,
        score,
        feedback: '',
      }),
    );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#09090b] text-white">
      <div className="mx-auto min-h-full w-full max-w-6xl px-4 py-8 md:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-3 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-1 text-sm text-indigo-400">
              AI INTERVIEW RESULT
            </p>

            <h1 className="text-3xl font-bold md:text-4xl">
              Interview Scorecard
            </h1>

            <p className="mt-2 text-sm text-gray-400">
              {report.target_role ||
                'Software Engineer'}
              {' · '}
              {report.user_name ||
                'Candidate'}
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-gray-400">
            Interview completed
          </div>
        </div>

        {/* Overall Score */}
        <section className="mb-8 grid gap-6 md:grid-cols-[260px_1fr]">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-8">
            <div
              className="relative flex h-44 w-44 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(
                  #6366f1 ${Math.min(
                  100,
                  Math.max(
                    0,
                    report.overall_score,
                  ),
                ) * 3.6}deg,
                  #27272a 0deg
                )`,
              }}
            >
              <div className="absolute inset-[12px] flex flex-col items-center justify-center rounded-full bg-[#111113]">
                <span className="text-5xl font-bold">
                  {Math.round(
                    report.overall_score,
                  )}
                </span>

                <span className="text-sm text-gray-400">
                  Overall Score
                </span>
              </div>
            </div>

            <p className="mt-4 text-center text-sm text-gray-400">
              Overall interview performance
            </p>
          </div>

          {/* Main gauges */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="mb-8 text-xl font-semibold">
              Performance
            </h2>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              <ScoreGauge
                label="Technical"
                score={
                  technicalScore
                }
                maxScore={100}
              />

              <ScoreGauge
                label="Problem Solving"
                score={
                  problemSolvingScore
                }
                maxScore={100}
              />

              <ScoreGauge
                label="Communication"
                score={
                  communicationScore
                }
                maxScore={100}
              />
            </div>
          </div>
        </section>

        {/* Dimension chart + summary */}
        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="mb-2 text-xl font-semibold">
              Performance Distribution
            </h2>

            <p className="mb-4 text-sm text-gray-400">
              Distribution across evaluated
              interview dimensions.
            </p>

            {dimensions.length >
              0 ? (
              <PerformancePieChart
                dimensions={
                  dimensions.map(
                    (
                      item: DimensionBreakdown,
                    ) => ({
                      dimension:
                        item.dimension,
                      score:
                        item.score,
                    }),
                  )
                }
              />
            ) : (
              <div className="flex h-[320px] items-center justify-center text-sm text-gray-500">
                No dimension data
                available.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="mb-4 text-xl font-semibold">
              Overall Feedback
            </h2>

            <p className="leading-7 text-gray-300">
              {report.summary ||
                'No summary was provided.'}
            </p>

            {report.disclosure && (
              <div className="mt-6 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs leading-5 text-gray-400">
                {report.disclosure}
              </div>
            )}
          </div>
        </section>

        {/* Dimension details */}
        {dimensions.length >
          0 && (
            <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="mb-5 text-xl font-semibold">
                Detailed Evaluation
              </h2>

              <div className="space-y-5">
                {dimensions.map(
                  (item) => (
                    <div
                      key={
                        item.dimension
                      }
                      className="rounded-xl border border-white/10 bg-black/20 p-5"
                    >
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <h3 className="font-semibold capitalize">
                          {item.dimension.replace(
                            /_/g,
                            ' ',
                          )}
                        </h3>

                        <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-sm font-semibold text-indigo-400">
                          {Math.round(
                            item.score,
                          )}
                          /100
                        </span>
                      </div>

                      {item.feedback && (
                        <p className="text-sm leading-6 text-gray-400">
                          {
                            item.feedback
                          }
                        </p>
                      )}
                    </div>
                  ),
                )}
              </div>
            </section>
          )}

        {/* Strengths + Weaknesses */}
        <section className="mb-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="mb-5 text-xl font-semibold">
              Strengths
            </h2>

            {report.strengths
              ?.length ? (
              <ul className="space-y-3">
                {report.strengths.map(
                  (
                    strength,
                    index,
                  ) => (
                    <li
                      key={index}
                      className="flex gap-3 text-sm leading-6 text-gray-300"
                    >
                      <span className="mt-1 text-green-400">
                        ✓
                      </span>

                      <span>
                        {strength}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">
                No specific strengths
                were identified.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="mb-5 text-xl font-semibold">
              Areas to Improve
            </h2>

            {report.weaknesses
              ?.length ? (
              <ul className="space-y-3">
                {report.weaknesses.map(
                  (
                    weakness,
                    index,
                  ) => (
                    <li
                      key={index}
                      className="flex gap-3 text-sm leading-6 text-gray-300"
                    >
                      <span className="mt-1 text-yellow-400">
                        !
                      </span>

                      <span>
                        {weakness}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">
                No specific weaknesses
                were identified.
              </p>
            )}
          </div>
        </section>

        {/* Red flags */}
        {report.red_flags
          ?.length > 0 && (
            <section className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
              <h2 className="mb-5 text-xl font-semibold text-red-400">
                Interview Flags
              </h2>

              <ul className="space-y-3">
                {report.red_flags.map(
                  (
                    flag,
                    index,
                  ) => (
                    <li
                      key={index}
                      className="flex gap-3 text-sm text-gray-300"
                    >
                      <span className="text-red-400">
                        •
                      </span>

                      <span>
                        {flag}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </section>
          )}

        {/* Improvement plan */}
        {report.improvement_plan
          ?.length > 0 && (
            <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="mb-5 text-xl font-semibold">
                Improvement Plan
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                {report.improvement_plan.map(
                  (
                    item,
                    index,
                  ) => (
                    <div
                      key={index}
                      className="rounded-xl border border-white/10 bg-black/20 p-5"
                    >
                      <h3 className="mb-2 font-semibold capitalize">
                        {item.area}
                      </h3>

                      <p className="mb-4 text-sm leading-6 text-gray-400">
                        {
                          item.recommendation
                        }
                      </p>

                      {item.resource && (
                        <div className="text-xs text-indigo-400">
                          Resource:{' '}
                          {
                            item.resource
                          }
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            </section>
          )}

        {/* Warning */}
        {report.warning && (
          <div className="mb-6 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 text-xs text-yellow-300">
            {report.warning}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col items-center justify-center gap-4 border-t border-white/10 py-8 text-center">
          <p className="text-xs text-gray-500">
            AI-generated interview assessment. This scorecard is saved to your account.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
            >
              View interview history
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Start another interview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [
    showConversation,
    setShowConversation,
  ] = useState(false);

  const endingRef =
    useRef(false);

  const [
    isLoading,
    setIsLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    agoraData,
    setAgoraData,
  ] =
    useState<AgoraTokenData | null>(
      null,
    );

  const [
    rtmClient,
    setRtmClient,
  ] =
    useState<RTMClient | null>(
      null,
    );

  const [
    agentJoinError,
    setAgentJoinError,
  ] = useState(false);

  const [
    report,
    setReport,
  ] =
    useState<InterviewEvaluation | null>(
      null,
    );

  const [
    adaptiveState,
    setAdaptiveState,
  ] =
    useState<AdaptiveState | null>(
      null,
    );

  useEffect(() => {
    import('agora-rtc-react').catch(
      () => { },
    );

    import('agora-rtm').catch(
      () => { },
    );
  }, []);

  const handleStartConversation =
    async () => {
      endingRef.current = false;

      setIsLoading(true);

      setError(null);

      setAgentJoinError(false);

      setAdaptiveState(null);

      setReport(null);

      try {
        const agoraResponse =
          await fetch(
            '/api/generate-agora-token',
          );

        const responseData =
          await agoraResponse.json();

        if (!agoraResponse.ok) {
          throw new Error(
            `Failed to generate Agora token: ${JSON.stringify(
              responseData,
            )}`,
          );
        }

        const [
          agentData,
          rtm,
        ] = await Promise.all([
          fetch(
            '/api/invite-agent',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                requester_id:
                  responseData.uid,

                channel_name:
                  responseData.channel,

                user_name:
                  'Candidate',

                role:
                  'Software Engineer',
              }),
            },
          )
            .then(async (res) => {
              if (!res.ok) {
                setAgentJoinError(
                  true,
                );

                return null;
              }

              return res.json() as Promise<AgentResponse>;
            })
            .catch((err) => {
              console.error(
                'Failed to start conversation with agent:',
                err,
              );

              setAgentJoinError(
                true,
              );

              return null;
            }),

          (async () => {
            const {
              default: AgoraRTM,
            } =
              await import(
                'agora-rtm'
              );

            const rtm: RTMClient =
              new AgoraRTM.RTM(
                process.env
                  .NEXT_PUBLIC_AGORA_APP_ID!,
                responseData.uid,
              );

            await rtm.login({
              token:
                responseData.token,
            });

            await rtm.subscribe(
              responseData.channel,
            );

            return rtm;
          })(),
        ]);

        setRtmClient(rtm);

        setAgoraData({
          ...responseData,
          agentId:
            agentData?.agent_id,

          sessionId:
            agentData?.session_id,
        });

        setShowConversation(
          true,
        );
      } catch (err) {
        console.error(
          'Error starting conversation:',
          err,
        );

        setError(
          'Failed to start conversation. Please try again.',
        );
      } finally {
        setIsLoading(false);
      }
    };

  const handleTokenWillExpire =
    useCallback(
      async (
        uid: string,
      ): Promise<AgoraRenewalTokens> => {
        try {
          const channel =
            agoraData?.channel;

          if (!channel) {
            throw new Error(
              'Missing channel for token renewal',
            );
          }

          const [
            rtcResponse,
            rtmResponse,
          ] = await Promise.all([
            fetch(
              `/api/generate-agora-token?channel=${channel}&uid=${uid}`,
            ),

            fetch(
              `/api/generate-agora-token?channel=${channel}&uid=${agoraData.uid}`,
            ),
          ]);

          const [
            rtcData,
            rtmData,
          ] = await Promise.all([
            rtcResponse.json(),
            rtmResponse.json(),
          ]);

          if (
            !rtcResponse.ok ||
            !rtmResponse.ok
          ) {
            throw new Error(
              'Failed to generate renewal tokens',
            );
          }

          return {
            rtcToken:
              rtcData.token,

            rtmToken:
              rtmData.token,
          };
        } catch (error) {
          console.error(
            'Error renewing token:',
            error,
          );

          throw error;
        }
      },
      [agoraData],
    );

  const handleEndConversation =
    useCallback(async () => {
      if (endingRef.current) {
        return;
      }

      endingRef.current = true;

      if (agoraData?.agentId) {
        try {
          const response =
            await fetch(
              '/api/stop-conversation',
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json',
                },

                body: JSON.stringify({
                  agent_id:
                    agoraData.agentId,
                }),
              },
            );

          if (!response.ok) {
            console.error(
              'Failed to stop agent:',
              await response.text(),
            );
          }
        } catch (error) {
          console.error(
            'Error stopping agent:',
            error,
          );
        }
      }

      if (agoraData?.sessionId) {
        try {
          const res =
            await fetch(
              '/api/interview/finish',
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json',
                },

                body: JSON.stringify({
                  session_id:
                    agoraData.sessionId,
                }),
              },
            );

          if (!res.ok) {
            console.error(
              'Failed to fetch final report:',
              await res.text(),
            );
          } else {
            const finalReport =
              (await res.json()) as InterviewEvaluation;

            console.log(
              'Final interview report:',
              finalReport,
            );

            setReport(
              finalReport,
            );
          }
        } catch (error) {
          console.error(
            'Error fetching final report:',
            error,
          );
        }
      }

      rtmClient?.logout().catch(
        (err) =>
          console.error(
            'RTM logout error:',
            err,
          ),
      );

      setRtmClient(null);

      setShowConversation(
        false,
      );
    }, [
      agoraData,
      rtmClient,
    ]);

  useEffect(() => {
    if (
      !showConversation ||
      !agoraData?.sessionId
    ) {
      return;
    }

    const sessionId =
      agoraData.sessionId;

    let finishTimeout:
      | number
      | undefined;

    const interval =
      window.setInterval(
        async () => {
          if (
            endingRef.current
          ) {
            return;
          }

          try {
            const response =
              await fetch(
                `/api/interview/status?session_id=${encodeURIComponent(
                  sessionId,
                )}`,
                {
                  cache:
                    'no-store',
                },
              );

            if (!response.ok) {
              return;
            }

            const status =
              await response.json();

            console.log(
              `Interview progress: ${status.turnCount}/${status.maxTurns}`,
            );

            if (
              status.finished
            ) {
              window.clearInterval(
                interval,
              );

              console.log(
                'Interview finished. Waiting for final message to play...',
              );

              finishTimeout =
                window.setTimeout(
                  () => {
                    if (
                      !endingRef.current
                    ) {
                      void handleEndConversation();
                    }
                  },
                  5000,
                );
            }
          } catch (error) {
            console.error(
              'Error checking interview status:',
              error,
            );
          }
        },
        1000,
      );

    return () => {
      window.clearInterval(
        interval,
      );

      if (
        finishTimeout !==
        undefined
      ) {
        window.clearTimeout(
          finishTimeout,
        );
      }
    };
  }, [
    showConversation,
    agoraData?.sessionId,
    handleEndConversation,
  ]);

  useEffect(() => {
    if (
      !showConversation ||
      !agoraData?.sessionId
    ) {
      return;
    }

    const sessionId =
      agoraData.sessionId;

    const fetchAdaptiveState =
      async () => {
        try {
          const response =
            await fetch(
              `/api/interview/state?session_id=${encodeURIComponent(
                sessionId,
              )}`,
              {
                cache:
                  'no-store',
              },
            );

          if (!response.ok) {
            return;
          }

          const state =
            (await response.json()) as AdaptiveState;

          setAdaptiveState(
            state,
          );
        } catch (error) {
          console.error(
            'Error fetching adaptive interview state:',
            error,
          );
        }
      };

    void fetchAdaptiveState();

    const interval =
      window.setInterval(
        fetchAdaptiveState,
        1000,
      );

    return () => {
      window.clearInterval(
        interval,
      );
    };
  }, [
    showConversation,
    agoraData?.sessionId,
  ]);

  return (
    <div className="relative flex h-dvh min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed right-4 top-4 z-[60]">
        <div className="pointer-events-auto">
          <UserMenu />
        </div>
      </div>
      <div
        className={`flex min-h-0 flex-1 flex-col ${showConversation
          ? 'items-stretch justify-start'
          : 'items-center justify-center'
          }`}
      >
        <div
          className={`z-10 flex min-h-0 flex-1 flex-col ${showConversation
            ? 'h-full w-full max-w-none items-stretch gap-0 px-0 text-left'
            : 'w-full max-w-none items-center justify-center px-4 text-center'
            }`}
        >
          {!showConversation ? (
            <>
              {report ? (
                <Scorecard
                  report={report}
                />
              ) : (
                <QuickstartPreCallCard
                  isLoading={
                    isLoading
                  }
                  error={error}
                  onStartConversation={
                    handleStartConversation
                  }
                />
              )}
            </>
          ) : agoraData &&
            rtmClient ? (
            <>
              {adaptiveState && (
                <div className="fixed right-4 top-4 z-40 w-72 rounded-lg border bg-card/95 p-4 text-xs shadow-lg backdrop-blur">
                  <div className="mb-3 font-semibold">
                    🧠 Adaptive
                    Interview
                  </div>

                  <div className="mb-3 text-muted-foreground">
                    Turn:{' '}
                    {
                      adaptiveState
                        .interview
                        .turn_count
                    }{' '}
                    /{' '}
                    {
                      adaptiveState
                        .interview
                        .max_turns
                    }
                  </div>

                  <div className="mb-3 space-y-1">
                    <div className="mb-2 font-medium">
                      Candidate
                      State
                    </div>

                    {Object.entries(
                      adaptiveState
                        .candidate_state
                        .scores,
                    ).map(
                      ([
                        dimension,
                        score,
                      ]) => (
                        <div
                          key={
                            dimension
                          }
                          className="flex justify-between gap-3"
                        >
                          <span className="capitalize text-muted-foreground">
                            {dimension.replace(
                              /_/g,
                              ' ',
                            )}
                          </span>

                          <span className="font-medium">
                            {Math.round(
                              score,
                            )}
                          </span>
                        </div>
                      ),
                    )}
                  </div>

                  <div className="space-y-1 border-t pt-3">
                    <div>
                      <span className="text-muted-foreground">
                        Focus:
                      </span>{' '}
                      {
                        adaptiveState
                          .interview_directive
                          .focus_area
                      }
                    </div>

                    <div>
                      <span className="text-muted-foreground">
                        Next:
                      </span>{' '}
                      {
                        adaptiveState
                          .interview_directive
                          .next_interviewer
                      }
                    </div>

                    <div>
                      <span className="text-muted-foreground">
                        Type:
                      </span>{' '}
                      {
                        adaptiveState
                          .interview_directive
                          .question_type
                      }
                    </div>

                    <div>
                      <span className="text-muted-foreground">
                        Difficulty:
                      </span>{' '}
                      {
                        adaptiveState
                          .interview_directive
                          .target_difficulty
                      }
                      /10
                    </div>
                  </div>

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

              {agentJoinError && (
                <div className="max-w-sm rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  Failed to connect
                  with AI agent.
                  The conversation
                  may not work as
                  expected.
                </div>
              )}

              <Suspense
                fallback={
                  <LoadingSkeleton />
                }
              >
                <ErrorBoundary>
                  <AgoraProvider>
                    <ConversationComponent
                      agoraData={
                        agoraData
                      }
                      rtmClient={
                        rtmClient
                      }
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
            <p className="text-sm text-muted-foreground">
              Failed to load
              conversation data.
            </p>
          )}
        </div>
      </div>

      {!report && (
        <footer className="fixed bottom-0 right-0 z-40 py-4 pr-4 md:py-6 md:pr-6">
          <div className="flex items-center justify-end gap-2 text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wide">
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
      )}
    </div>
  );
}