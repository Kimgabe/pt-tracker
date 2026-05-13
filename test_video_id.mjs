import { YoutubeTranscript } from 'youtube-transcript';

// Test the actual regex used in pt-tracker
function extractVideoId(url) {
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

// Test cases
const testCases = [
  'https://www.youtube.com/watch?v=oMJuiJ9Rs0w',
  'https://youtu.be/oMJuiJ9Rs0w',
  'https://www.youtube.com/embed/oMJuiJ9Rs0w',
  'https://www.youtube.com/shorts/oMJuiJ9Rs0w',
  'oMJuiJ9Rs0w',
];

console.log('Video ID Extraction Tests');
console.log('='.repeat(60));

testCases.forEach(testUrl => {
  const extracted = extractVideoId(testUrl);
  console.log(`\nInput:     ${testUrl}`);
  console.log(`Extracted: ${extracted}`);
  
  if (extracted) {
    console.log(`Length:    ${extracted.length}`);
    console.log(`Chars:     ${extracted.split('').map((c, i) => `[${i}]='${c}'`).join(' ')}`);
    
    // Check for 0 vs O confusion
    const has0 = extracted.includes('0');
    const hasO = extracted.includes('O');
    console.log(`Contains '0' (digit): ${has0}, Contains 'O' (letter): ${hasO}`);
  }
});

// Test actual fetch
console.log('\n' + '='.repeat(60));
console.log('Actual Transcript Fetch Tests');
console.log('='.repeat(60));

async function testFetch() {
  for (const testUrl of testCases) {
    const videoId = extractVideoId(testUrl);
    if (!videoId) continue;
    
    console.log(`\nTesting: ${videoId}`);
    try {
      const result = await YoutubeTranscript.fetchTranscript(videoId);
      console.log(`✓ Success: ${result.length} segments`);
    } catch (e) {
      console.log(`✗ Error: ${e.message}`);
    }
  }
}

testFetch();
