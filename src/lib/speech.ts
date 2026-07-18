function synth(): SpeechSynthesis | undefined {
  return (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis
}

export function pickVoice(): SpeechSynthesisVoice | null {
  const voices = synth()?.getVoices() ?? []
  const ja = voices.filter((v) => v.lang.toLowerCase().startsWith('ja'))
  return ja.find((v) => v.localService) ?? ja[0] ?? null
}

export function speechAvailable(): boolean {
  return synth() !== undefined && pickVoice() !== null
}

/** Speak Japanese text, cancelling any utterance already in progress. */
export function speak(text: string, rate = 1): void {
  const s = synth()
  if (!s) return
  s.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = pickVoice()
  if (voice) utterance.voice = voice
  utterance.lang = 'ja-JP'
  utterance.rate = rate
  s.speak(utterance)
}

export function stopSpeech(): void {
  synth()?.cancel()
}
