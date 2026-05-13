import { execFile } from 'child_process';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

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

/** Parse json3 caption events into TranscriptSegments */
function parseJson3Events(events: InnerTubeEvent[]): TranscriptSegment[] {
  return events
    .filter(e => e.segs && e.segs.some(s => s.utf8?.trim()))
    .map(e => ({
      text: e.segs!.map(s => s.utf8).join('').trim(),
      offset: (e.tStartMs ?? 0) / 1000,
      duration: (e.dDurationMs ?? 0) / 1000,
    }))
    .filter(s => s.text.length > 0);
}

/** Try yt-dlp for a single language, return segments or null */
async function tryYtDlpLang(videoId: string, lang: string): Promise<TranscriptResult | null> {
  const prefix = join(tmpdir(), `yt-sub-${videoId}-${lang}-${Date.now()}`);
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const filePath = `${prefix}.${lang}.json3`;

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = execFile(
        'yt-dlp',
        [
          '--write-auto-sub',
          '--sub-lang', lang,
          '--sub-format', 'json3',
          '--skip-download',
          '--no-warnings',
          '-o', prefix,
          url,
        ],
        { timeout: 30_000 },
        (err) => (err ? reject(err) : resolve()),
      );
      proc.stderr?.on('data', () => {}); // drain
    });

    const raw = await readFile(filePath, 'utf-8');
    const captionData = JSON.parse(raw);
    const events: InnerTubeEvent[] = captionData.events ?? [];
    const segments = parseJson3Events(events);

    if (segments.length === 0) return null;

    const text = segments.map(s => s.text).join(' ');
    return { text, segments, videoId };
  } catch {
    return null;
  } finally {
    unlink(filePath).catch(() => {});
  }
}

/** Fallback: use yt-dlp CLI to fetch auto-generated subtitles (try each lang separately to avoid rate-limit cascading) */
async function fetchTranscriptViaCli(videoId: string): Promise<TranscriptResult> {
  for (const lang of ['ko', 'en']) {
    const result = await tryYtDlpLang(videoId, lang);
    if (result) return result;
  }
  throw new Error('yt-dlp: 자막을 가져올 수 없습니다');
}

export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
  // 1) Try InnerTube API first (fast, no subprocess)
  try {
    const result = await fetchTranscriptViaInnerTube(videoId);
    return result;
  } catch {
    // InnerTube failed — fall through to yt-dlp
  }

  // 2) Fallback: yt-dlp CLI (handles bot-blocking, JS challenges, auto-captions)
  return fetchTranscriptViaCli(videoId);
}

async function fetchTranscriptViaInnerTube(videoId: string): Promise<TranscriptResult> {
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
  const segments = parseJson3Events(events);

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
