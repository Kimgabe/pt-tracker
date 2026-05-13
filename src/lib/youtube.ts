import OpenAI from 'openai';

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

// ─── Tier 1: InnerTube API (보정된 파라미터) ───

async function fetchTranscriptViaInnerTube(videoId: string): Promise<TranscriptResult> {
  const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': '2.20260510.00.00',
    },
    body: JSON.stringify({
      videoId,
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20260510.00.00',
          hl: 'ko',
          gl: 'KR',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      },
    }),
    cache: 'no-store',
  });

  if (!playerRes.ok) {
    throw new Error('YouTube InnerTube 서버에 연결할 수 없습니다');
  }

  const player = await playerRes.json();
  const tracks: InnerTubeCaptionTrack[] | undefined =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!tracks?.length) {
    throw new Error('InnerTube: 자막 트랙 없음');
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
    throw new Error('InnerTube: 파싱된 자막 세그먼트 없음');
  }

  const text = segments.map(s => s.text).join(' ');
  return { text, segments, videoId };
}

// ─── Tier 2: Watch page HTML 파싱 (Vercel 호환) ───

async function fetchTranscriptViaWatchPage(videoId: string): Promise<TranscriptResult> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(watchUrl, {
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

  // Extract ytInitialPlayerResponse from the HTML
  // Use a greedy match up to the closing }; pattern — handles varying script contexts
  const playerMatch = html.match(/var\s+ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\})\s*;/);
  if (!playerMatch) {
    throw new Error('Watch page: ytInitialPlayerResponse를 찾을 수 없습니다');
  }

  let player: Record<string, unknown>;
  try {
    player = JSON.parse(playerMatch[1]);
  } catch {
    throw new Error('Watch page: Player 응답 JSON 파싱 실패');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const captions = (player as any)?.captions?.playerCaptionsTracklistRenderer?.captionTracks as InnerTubeCaptionTrack[] | undefined;

  if (!captions?.length) {
    throw new Error('Watch page: 자막 트랙 없음');
  }

  const track =
    captions.find(t => t.languageCode === 'ko') ??
    captions.find(t => t.languageCode === 'en') ??
    captions[0];

  const captionRes = await fetch(track.baseUrl + '&fmt=json3', { cache: 'no-store' });
  if (!captionRes.ok) {
    throw new Error('Watch page: 자막 데이터 가져오기 실패');
  }

  const captionData = await captionRes.json();
  const events: InnerTubeEvent[] = captionData.events ?? [];
  const segments = parseJson3Events(events);

  if (segments.length === 0) {
    throw new Error('Watch page: 파싱된 자막 세그먼트 없음');
  }

  const text = segments.map(s => s.text).join(' ');
  return { text, segments, videoId };
}

// ─── Tier 3: Whisper API fallback (Vercel 호환) ───

/** Extract a direct audio stream URL from YouTube using the InnerTube streaming data */
async function getAudioStreamUrl(videoId: string): Promise<string> {
  const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.youtube/19.47.53 (Linux; U; Android 14)',
    },
    body: JSON.stringify({
      videoId,
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '19.47.53',
          androidSdkVersion: 34,
          hl: 'ko',
          gl: 'KR',
        },
      },
    }),
    cache: 'no-store',
  });

  if (!playerRes.ok) {
    throw new Error('Whisper: 오디오 스트림 정보 가져오기 실패');
  }

  const player = await playerRes.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formats = (player as any)?.streamingData?.adaptiveFormats as any[] | undefined;

  if (!formats?.length) {
    throw new Error('Whisper: 스트리밍 포맷 없음');
  }

  // Find audio-only format, prefer low bitrate for speed
  const audioFormat = formats
    .filter((f: { mimeType?: string }) => f.mimeType?.startsWith('audio/'))
    .sort((a: { bitrate?: number }, b: { bitrate?: number }) => (a.bitrate ?? 0) - (b.bitrate ?? 0))[0];

  if (!audioFormat?.url) {
    throw new Error('Whisper: 오디오 URL을 찾을 수 없습니다');
  }

  return audioFormat.url;
}

async function fetchTranscriptViaWhisper(videoId: string): Promise<TranscriptResult> {
  const audioUrl = await getAudioStreamUrl(videoId);

  // Download audio into a buffer (limit to ~10MB for Whisper API / Vercel memory)
  const audioRes = await fetch(audioUrl, {
    headers: { Range: 'bytes=0-10485760' },
  });

  if (!audioRes.ok && audioRes.status !== 206) {
    throw new Error('Whisper: 오디오 다운로드 실패');
  }

  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

  // Create a File-like object for the OpenAI SDK
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

  // If no segments from Whisper, create a single segment from the full text
  if (segments.length === 0) {
    segments.push({ text: text.trim(), offset: 0, duration: 0 });
  }

  return { text, segments, videoId };
}

// ─── Main entry: 3-tier fallback chain ───

export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
  const errors: string[] = [];

  // Tier 1: InnerTube API (fastest, free)
  try {
    return await fetchTranscriptViaInnerTube(videoId);
  } catch (e) {
    errors.push(`InnerTube: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Tier 2: Watch page HTML parsing (free, Vercel compatible)
  try {
    return await fetchTranscriptViaWatchPage(videoId);
  } catch (e) {
    errors.push(`WatchPage: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Tier 3: Whisper API (costs money, but always works for audio content)
  try {
    return await fetchTranscriptViaWhisper(videoId);
  } catch (e) {
    errors.push(`Whisper: ${e instanceof Error ? e.message : String(e)}`);
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
