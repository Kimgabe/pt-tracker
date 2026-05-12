export interface TranscriptSegment {
  text: string;
  offset: number;  // seconds
  duration: number;
}

export interface TranscriptResult {
  text: string;
  segments: TranscriptSegment[];
  videoId: string;
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

interface InnerTubeCaptionTrack {
  baseUrl: string;
  languageCode: string;
}

interface InnerTubeEvent {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8: string }[];
}

export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
  // Use YouTube InnerTube API — resilient to bot-blocking on serverless (Vercel)
  const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoId,
      context: {
        client: { clientName: 'WEB', clientVersion: '2.20250501.00.00', hl: 'ko' },
      },
    }),
    cache: 'no-store',
  });

  if (!playerRes.ok) {
    throw new Error('YouTube 서버에 연결할 수 없습니다');
  }

  const player = await playerRes.json();
  const tracks: InnerTubeCaptionTrack[] | undefined =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!tracks?.length) {
    throw new Error('이 영상에는 자막이 없습니다');
  }

  // Prefer ko → en → first available
  const track =
    tracks.find(t => t.languageCode === 'ko') ??
    tracks.find(t => t.languageCode === 'en') ??
    tracks[0];

  const captionRes = await fetch(track.baseUrl + '&fmt=json3', { cache: 'no-store' });
  if (!captionRes.ok) {
    throw new Error('자막 데이터를 가져올 수 없습니다');
  }

  const captionData = await captionRes.json();
  const events: InnerTubeEvent[] = captionData.events ?? [];

  const segments: TranscriptSegment[] = events
    .filter(e => e.segs && e.segs.some(s => s.utf8?.trim()))
    .map(e => ({
      text: e.segs!.map(s => s.utf8).join('').trim(),
      offset: (e.tStartMs ?? 0) / 1000,
      duration: (e.dDurationMs ?? 0) / 1000,
    }))
    .filter(s => s.text.length > 0);

  if (segments.length === 0) {
    throw new Error('자막을 찾을 수 없습니다');
  }

  const text = segments.map(s => s.text).join(' ');
  return { text, segments, videoId };
}

export async function fetchVideoMetadata(videoUrl: string): Promise<{ title: string | null; author: string | null }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`,
      { cache: 'no-store' },
    );
    if (res.ok) {
      const data = await res.json();
      return { title: data.title ?? null, author: data.author_name ?? null };
    }
  } catch {}
  return { title: null, author: null };
}
