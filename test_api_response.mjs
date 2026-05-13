// Simulate the error handling in youtube.ts fetchTranscript function

async function simulateError() {
  const errors = [];
  
  // Simulate Tier 1 failure
  errors.push('InnerTube: [YoutubeTranscript] 🚨 Transcript is disabled on this video (oMJuiJ9Rs0w)');
  
  // Simulate WatchPage fetch failure
  errors.push('WatchPage fetch: Watch page 로드 실패');
  
  // Simulate Tier 2 failure
  errors.push('WatchPage: 자막 트랙 없음');
  
  // Simulate Tier 3 failure
  errors.push('Description: 유효한 타임스탐프 없음');
  
  // Simulate Tier 4 failure
  errors.push('Whisper: Whisper: 스트리밍 포맷 없음');
  
  const finalError = `자막을 가져올 수 없습니다.\n${errors.join('\n')}`;
  console.log('Backend error response:');
  console.log(finalError);
  console.log('\n' + '='.repeat(60));
  
  // Simulate how frontend would display this
  console.log('\nHow frontend would display (discover/page.tsx line 129):');
  console.log(`setError("${finalError}")`);
  console.log('\nThen line 225-227 would show it in red box:');
  console.log(`<p className="text-red-400 text-sm">${finalError}</p>`);
}

simulateError();
