import { YoutubeTranscript } from 'youtube-transcript';

function extractJsonFromHtml(html, marker) {
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

async function fetchWatchPageData(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

  return player;
}

async function testTier1() {
  const videoId = 'oMJuiJ9Rs0w';
  console.log('\n[TIER 1] youtube-transcript package');
  console.log('─'.repeat(60));
  try {
    let segs = await YoutubeTranscript.fetchTranscript(videoId).catch(() => []);
    if (!segs.length) {
      segs = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ko' });
    }
    if (!segs.length) {
      throw new Error('youtube-transcript: 자막 세그먼트 없음');
    }
    console.log('✓ Success! Got', segs.length, 'segments');
    return true;
  } catch (e) {
    console.log('✗ Failed:', e.message);
    return false;
  }
}

async function testWatchPageFetch() {
  const videoId = 'oMJuiJ9Rs0w';
  console.log('\n[WATCH PAGE FETCH] Shared across Tiers 2-4');
  console.log('─'.repeat(60));
  try {
    const watchData = await fetchWatchPageData(videoId);
    console.log('✓ Fetched successfully');
    
    if (!watchData.captions) {
      console.log('  ⚠ No captions object found');
    } else {
      const tracks = watchData.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      console.log('  Caption tracks:', tracks ? tracks.length : 0);
      if (tracks && tracks.length > 0) {
        tracks.forEach((t, i) => {
          console.log(`    [${i}] ${t.languageCode}`);
        });
      }
    }
    
    if (!watchData.streamingData) {
      console.log('  ⚠ No streamingData object found');
    } else {
      const formats = watchData.streamingData?.adaptiveFormats;
      console.log('  Adaptive formats:', formats ? formats.length : 0);
      if (formats && formats.length > 0) {
        const audioFormats = formats.filter(f => f.mimeType?.startsWith('audio/'));
        console.log('  Audio formats:', audioFormats.length);
      }
    }
    
    return watchData;
  } catch (e) {
    console.log('✗ Failed:', e.message);
    return null;
  }
}

async function testTier2(watchData) {
  const videoId = 'oMJuiJ9Rs0w';
  console.log('\n[TIER 2] Watch page captions');
  console.log('─'.repeat(60));
  
  if (!watchData) {
    console.log('⊘ Skipped (watchData unavailable)');
    return false;
  }
  
  try {
    const tracks = watchData.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks?.length) {
      throw new Error('자막 트랙 없음');
    }
    console.log('✓ Success! Found', tracks.length, 'caption tracks');
    return true;
  } catch (e) {
    console.log('✗ Failed:', e.message);
    return false;
  }
}

async function testTier4(watchData) {
  const videoId = 'oMJuiJ9Rs0w';
  console.log('\n[TIER 4] Whisper fallback');
  console.log('─'.repeat(60));
  
  if (!watchData) {
    console.log('⊘ Skipped (watchData unavailable)');
    return false;
  }
  
  try {
    const formats = watchData.streamingData?.adaptiveFormats;
    if (!formats?.length) {
      throw new Error('Whisper: 스트리밍 포맷 없음');
    }
    const audioFormat = formats
      .filter(f => f.mimeType?.startsWith('audio/'))
      .sort((a, b) => (a.bitrate ?? 0) - (b.bitrate ?? 0))[0];
    
    if (!audioFormat?.url) {
      throw new Error('Whisper: 오디오 URL 없음');
    }
    console.log('✓ Success! Found audio format with URL');
    return true;
  } catch (e) {
    console.log('✗ Failed:', e.message);
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('PT TRACKER YOUTUBE TRANSCRIPT FLOW TEST');
  console.log('Video ID: oMJuiJ9Rs0w');
  console.log('='.repeat(60));
  
  const tier1Success = await testTier1();
  
  const watchData = await testWatchPageFetch();
  const tier2Success = await testTier2(watchData);
  const tier4Success = await testTier4(watchData);
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log('Tier 1 (InnerTube):', tier1Success ? '✓ PASS' : '✗ FAIL');
  console.log('Tier 2 (WatchPage captions):', tier2Success ? '✓ PASS' : '✗ FAIL');
  console.log('Tier 4 (Whisper):', tier4Success ? '✓ PASS' : '✗ FAIL');
  console.log('\nExpected outcome: At least Tier 1 should pass');
}

main().catch(console.error);
