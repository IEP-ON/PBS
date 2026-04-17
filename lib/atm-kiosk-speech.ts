/** ATM 키오스크 Web Speech API (한국어, 갤럭시 탭 등) */

function pickKoVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  return (
    voices.find(v => v.lang === 'ko-KR' && /samsung|google|korean/i.test(v.name)) ??
    voices.find(v => v.lang === 'ko-KR') ??
    voices.find(v => v.lang.toLowerCase().startsWith('ko')) ??
    null
  )
}

export function warmUpSpeechVoices(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.getVoices()
}

export function speakAtm(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ko-KR'
  const voice = pickKoVoice()
  if (voice) utterance.voice = voice
  utterance.rate = 0.9
  utterance.pitch = 1
  utterance.volume = 1
  window.speechSynthesis.speak(utterance)
}

export function stopAtmSpeech(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
}

export function tokenFailSpeech(apiError: string): string {
  if (apiError.includes('이미 사용')) {
    return '만료되었거나, 이미 사용된 큐알 코인입니다.'
  }
  if (apiError.includes('유효하지')) {
    return '만료되었거나, 인식할 수 없는 큐알 코인입니다.'
  }
  return '인식할 수 없거나, 만료된 큐알 코인입니다.'
}
