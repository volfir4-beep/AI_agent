'use client';

import {
    PieChart,
    Pie,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
} from 'recharts';

type Dimension = {
    dimension: string;
    score: number;
};

type Props = {
    dimensions: Dimension[];
};

export default function PerformancePieChart({
    dimensions,
}: Props) {
    const data = dimensions
        .map((item) => ({
            name: item.dimension
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (char) =>
                    char.toUpperCase(),
                ),

            value:
                Number(item.score) || 0,
        }))
        .filter(
            (item) => item.value > 0,
        );

    return (
        <div className="h-[320px] w-full">
            <ResponsiveContainer
                width="100%"
                height="100%"
            >
                <PieChart>
                    <Pie
                        data={data}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        innerRadius={60}
                        outerRadius={105}
                        paddingAngle={3}
                        label={({ name }) =>
                            name
                        }
                    >
                        {data.map(
                            (_, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                />
                            ),
                        )}
                    </Pie>

                    <Tooltip />

                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}