'use client';

type ScoreGaugeProps = {
    label: string;
    score: number;
    maxScore?: number;
};

export default function ScoreGauge({
    label,
    score,
    maxScore = 100,
}: ScoreGaugeProps) {
    const safeScore = Number.isFinite(score)
        ? Math.min(maxScore, Math.max(0, score))
        : 0;

    const percentage =
        (safeScore / maxScore) * 100;

    const degrees =
        percentage * 3.6;

    return (
        <div className="flex flex-col items-center">
            <div
                className="relative h-36 w-36 rounded-full"
                style={{
                    background: `conic-gradient(
            #6366f1 0deg ${degrees}deg,
            #27272a ${degrees}deg 360deg
          )`,
                }}
            >
                <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-[#111111]">
                    <span className="text-3xl font-bold text-white">
                        {Math.round(safeScore)}
                    </span>

                    <span className="text-xs text-gray-400">
                        / {maxScore}
                    </span>
                </div>
            </div>

            <p className="mt-4 text-center text-sm font-medium text-white">
                {label}
            </p>
        </div>
    );
}