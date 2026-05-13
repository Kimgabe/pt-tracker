import { YoutubeTranscript } from 'youtube-transcript';

async function fetchTranscriptViaPackage(videoId) {
  let segs = await YoutubeTranscript.fetchTranscript(videoId).catch(() => []);
  if (!segs.length) {
    segs = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ko' });
  }
  if (!segs.length) {
    throw new Error('youtube-transcript: 자막 세그먼트 없음');
  }
  return segs;
}

async function test() {
  const videoId = 'oMJuiJ9Rs0w';
  console.log('Testing PT Tracker flow with:', videoId);
  try {
    const result = await fetchTranscriptViaPackage(videoId);
    console.log('✓ Success! Got', result.length, 'segments');
  } catch (e) {
    console.log('✗ Error:', e.message);
  }
}

test();
