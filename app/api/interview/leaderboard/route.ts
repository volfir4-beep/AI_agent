import { NextRequest, NextResponse } from 'next/server';
import { fetchLeaderboard } from '@/lib/n8n-client';

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get('role') ?? undefined;
  try {
    const data = await fetchLeaderboard(role);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch leaderboard' },
      { status: 500 },
    );
  }
}