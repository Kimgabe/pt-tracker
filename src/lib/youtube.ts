import OpenAI from 'openai';
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

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
}

interface CaptionEvent {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8: string }[];
}

interface AdaptiveFormat {
  mimeType?: string;
  bitrate?: number;
  url?: string;
}

interface WatchPageData {
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
  streamingData?: { adaptiveFormats?: AdaptiveFormat[] };
}

/** Parse json3 caption events into TranscriptSegments */
function parseJson3Events(events: CaptionEvent[]): TranscriptSegment[] {
  return events
    .filter(e => e.segs && e.segs.some(s => s.utf8?.trim()))
    .map(e => ({
      text: e.segs!.map(s => s.utf8).join('').trim(),
      offset: (e.tStartMs ?? 0) / 1000,
      duration: (e.dDurationMs ?? 0) / 1000,
    }))
    .filter(s => s.text.length > 0);
}

/** Extract JSON object from HTML using brace-matching (not regex — handles 60KB+ payloads) */
function extractJsonFromHtml(html: string, marker: string): object | null {
  const idx = html.indexOf(marker);
  if (idx < 0) return null;

  const startBrace = html.indexOf('{', idx);
  if (startBrace < 0) return null;

  let depth = 0;
  for (let i = startBrace; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.substring(startBrace, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// ─── Watch page fetch (shared between tiers) ───

async function fetchWatchPageData(videoId: string): Promise<WatchPageData> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Watch page 로드 실패');
  }

  const html = await res.text();
  const player = extractJsonFromHtml(html, 'ytInitialPlayerResponse');

  if (!player) {
    throw new Error('Watch page: ytInitialPlayerResponse 파싱 실패');
  }

  return player as WatchPageData;
}

// ─── Tier 1: Watch page → 자막 추출 (free, 가장 안정적) ───

async function fetchTranscriptFromCaptions(
  data: WatchPageData,
  videoId: string,
): Promise<TranscriptResult> {
  const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!tracks?.length) {
    throw new Error('자막 트랙 없음');
  }

  const track =
    tracks.find(t => t.languageCode === 'ko') ??
    tracks.find(t => t.languageCode === 'en') ??
    tracks[0];

  const captionRes = await fetch(track.baseUrl + '&fmt=json3', { cache: 'no-store' });
  if (!captionRes.ok) {
    throw new Error('자막 데이터 가져오기 실패');
  }

  const captionData = await captionRes.json();
  const events: CaptionEvent[] = captionData.events ?? [];
  const segments = parseJson3Events(events);

  if (segments.length === 0) {
    throw new Error('파싱된 자막 세그먼트 없음');
  }

  const text = segments.map(s => s.text).join(' ');
  return { text, segments, videoId };
}

// ─── Tier 2: Watch page streamingData → Whisper API (비용 발생) ───

async function fetchTranscriptViaWhisper(
  data: WatchPageData,
  videoId: string,
): Promise<TranscriptResult> {
  const formats = data.streamingData?.adaptiveFormats;

  if (!formats?.length) {
    throw new Error('Whisper: 스트리밍 포맷 없음');
  }

  const audioFormat = formats
    .filter((f: AdaptiveFormat) => f.mimeType?.startsWith('audio/'))
    .sort((a: AdaptiveFormat, b: AdaptiveFormat) => (a.bitrate ?? 0) - (b.bitrate ?? 0))[0];

  if (!audioFormat?.url) {
    throw new Error('Whisper: 오디오 URL 없음');
  }

  // Download audio (limit ~10MB for Whisper API / Vercel memory)
  const audioRes = await fetch(audioFormat.url, {
    headers: { Range: 'bytes=0-10485760' },
  });

  if (!audioRes.ok && audioRes.status !== 206) {
    throw new Error('Whisper: 오디오 다운로드 실패');
  }

  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  const audioFile = new File([audioBuffer], `${videoId}.webm`, { type: 'audio/webm' });

  const openai = new OpenAI();
  const whisperRes = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file: audioFile,
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSegments = (whisperRes as any).segments as Array<{
    start: number;
    end: number;
    text: string;
  }> | undefined;

  const segments: TranscriptSegment[] = (rawSegments ?? []).map(s => ({
    text: s.text.trim(),
    offset: s.start,
    duration: s.end - s.start,
  })).filter(s => s.text.length > 0);

  const text = segments.length > 0
    ? segments.map(s => s.text).join(' ')
    : (whisperRes.text ?? '');

  if (!text.trim()) {
    throw new Error('Whisper: 음성 인식 결과가 비어 있습니다');
  }

  if (segments.length === 0) {
    segments.push({ text: text.trim(), offset: 0, duration: 0 });
  }

  return { text, segments, videoId };
}

// ─── Tier 1: youtube-transcript 패키지 (Android InnerTube, 서버리스 친화적) ───

async function fetchTranscriptViaPackage(videoId: string): Promise<TranscriptResult> {
  // lang 제한 없이 시도 → 자동생성 자막 포함 모든 언어 허용
  let segs = await YoutubeTranscript.fetchTranscript(videoId).catch(() => []);

  // 실패 시 한국어 명시 재시도
  if (!segs.length) {
    segs = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ko' });
  }

  if (!segs.length) {
    throw new Error('youtube-transcript: 자막 세그먼트 없음');
  }

  const segments: TranscriptSegment[] = segs.map(s => ({
    text: s.text.trim(),
    offset: (s.offset ?? 0) / 1000,
    duration: (s.duration ?? 0) / 1000,
  })).filter(s => s.text.length > 0);

  if (segments.length === 0) {
    throw new Error('youtube-transcript: 파싱된 세그먼트 없음');
  }

  const text = segments.map(s => s.text).join(' ');
  return { text, segments, videoId };
}

// ─── Tier 2.5: Description 타임스탬프 파싱 (비용 0, Whisper보다 저렴한 fallback) ───

function parseDescriptionTimestamps(description: string, videoId: string): TranscriptResult | null {
  // 타임스탬프 패턴: "0:00 제목" or "00:00 제목" or "0:00:00 제목"
  const lines = description.split('\n');
  const timestampRegex = /^(\d{1,2}:)?(\d{1,2}):(\d{2})\s+(.+)/;
  const segments: TranscriptSegment[] = [];

  for (const line of lines) {
    const match = line.trim().match(timestampRegex);
    if (match) {
      const hours = match[1] ? parseInt(match[1]) : 0;
      const minutes = parseInt(match[2]);
      const seconds = parseInt(match[3]);
      const text = match[4].trim();
      const offset = hours * 3600 + minutes * 60 + seconds;
      segments.push({ text, offset, duration: 0 });
    }
  }

  if (segments.length < 3) return null; // 타임스탬프가 너무 적으면 무의미

  // duration 계산 (다음 세그먼트까지의 시간)
  for (let i = 0; i < segments.length - 1; i++) {
    segments[i].duration = segments[i + 1].offset - segments[i].offset;
  }
  if (segments.length > 0) {
    segments[segments.length - 1].duration = 60; // 마지막은 임의 1분
  }

  const text = segments.map(s => s.text).join(' ');
  return { text, segments, videoId };
}

// ─── Main entry: 4-tier fallback (watch page 1회 공유) ───

export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
  const errors: string[] = [];

  // Tier 1: youtube-transcript 패키지 (Android InnerTube 경유, 비용 0)
  try {
    return await fetchTranscriptViaPackage(videoId);
  } catch (e) {
    errors.push(`InnerTube: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Watch page 1회만 fetch → Tier 2, 3, 4에서 공유
  let watchData: WatchPageData | null = null;
  try {
    watchData = await fetchWatchPageData(videoId);
  } catch (e) {
    errors.push(`WatchPage fetch: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Tier 2: Watch page 자막 트랙 (비용 0)
  if (watchData) {
    try {
      return await fetchTranscriptFromCaptions(watchData, videoId);
    } catch (e) {
      errors.push(`WatchPage: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Tier 3: Description 타임스탬프 파싱 (비용 0)
  let descriptionText: string | null = null;
  try {
    const metadata = await fetchVideoMetadata(`https://www.youtube.com/watch?v=${videoId}`);
    descriptionText = metadata.description || null;
    if (descriptionText) {
      const result = parseDescriptionTimestamps(descriptionText, videoId);
      if (result) return result;
    }
    errors.push('Description: 유효한 타임스탬프 없음');
  } catch (e) {
    errors.push(`Description: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Tier 3.5: Description 텍스트 그대로 사용 — 타임스탬프 없어도 내용 추출 가능
  if (descriptionText && descriptionText.length > 200) {
    return { text: descriptionText, segments: [], videoId };
  }

  // Tier 4: Whisper STT (비용 발생, 최종 fallback)
  if (watchData) {
    try {
      return await fetchTranscriptViaWhisper(watchData, videoId);
    } catch (e) {
      errors.push(`Whisper: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  throw new Error(`자막을 가져올 수 없습니다.\n${errors.join('\n')}`);
}

export async function fetchVideoMetadata(videoUrl: string): Promise<{
  title: string | null;
  author: string | null;
  description: string | null;
}> {
  let title: string | null = null;
  let author: string | null = null;
  let description: string | null = null;

  // oEmbed for title and author
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`,
      { cache: 'no-store' },
    );
    if (res.ok) {
      const data = await res.json();
      title = data.title ?? null;
      author = data.author_name ?? null;
    }
  } catch {}

  // Fetch description from watch page (useful for timestamp fallback)
  try {
    const res = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
      },
      cache: 'no-store',
    });
    if (res.ok) {
      const html = await res.text();
      const descMatch = html.match(/"shortDescription"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (descMatch) {
        description = descMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
      }
    }
  } catch {}

  return { title, author, description };
}
