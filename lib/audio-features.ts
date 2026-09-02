const FILLER_WORDS = /\b(um+|uh+|like|you know|actually|basically|i mean)\b/gi;

export function extractAudioFeatures(transcript: string) {
  const fillerMatches = transcript.match(FILLER_WORDS);
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

  return {
    // Real signal
    filler_count: fillerMatches ? fillerMatches.length : 0,
    // Placeholders — see lib/audio-features.ts limitations note above.
    // 130 wpm is an average conversational pace; used as a safe default.
    speech_rate_wpm: wordCount > 0 ? 130 : 0,
    avg_pause_ms: 250,
    voice_stability: 0.7,
  };
}