import { YoutubeTranscript } from 'youtube-transcript';

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

export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
  const entries = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ko' })
    .catch(() => YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' }))
    .catch(() => YoutubeTranscript.fetchTranscript(videoId));

  if (!entries || entries.length === 0) {
    throw new Error('자막을 찾을 수 없습니다');
  }

  const segments: TranscriptSegment[] = entries.map(e => ({
    text: e.text,
    offset: e.offset / 1000,
    duration: e.duration / 1000,
  }));

  const text = segments.map(s => s.text).join(' ');

  return { text, segments, videoId };
}

export async function fetchVideoMetadata(videoUrl: string): Promise<{ title: string | null; author: string | null }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`
    );
    if (res.ok) {
      const data = await res.json();
      return { title: data.title ?? null, author: data.author_name ?? null };
    }
  } catch {}
  return { title: null, author: null };
}
