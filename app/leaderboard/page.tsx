'use client';

import { useEffect, useState } from 'react';

export default function LeaderboardPage() {
  const [data, setData] = useState<unknown | null>(null);

  useEffect(() => {
    fetch('/api/interview/leaderboard')
      .then((res) => res.json())
      .then(setData)
      .catch((err) => console.error('Failed to load leaderboard:', err));
  }, []);

  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Leaderboard</h1>
      <pre className="rounded-lg bg-card p-4 text-xs">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}