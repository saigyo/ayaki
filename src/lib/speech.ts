function synth(): SpeechSynthesis | undefined {
  return (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis
}

/** Japanese voices, localService first, then alphabetical by name (stable dropdown order). */
export function listJaVoices(): SpeechSynthesisVoice[] {
  const voices = synth()?.getVoices() ?? []
  return voices
    .filter((v) => v.lang.toLowerCase().startsWith('ja'))
    .sort((a, b) =>
      a.localService === b.localService ? a.name.localeCompare(b.name) : a.localService ? -1 : 1,
    )
}

/** Preferred voice by exact voiceURI when available, else the auto heuristic:
 *  first local-service Japanese voice, else first Japanese voice — "first" in
 *  listJaVoices() order (localService first, then alphabetical), not browser order. */
export function pickVoice(preferredURI: string | null = null): SpeechSynthesisVoice | null {
  const ja = listJaVoices()
  if (preferredURI) {
    const preferred = ja.find((v) => v.voiceURI === preferredURI)
    if (preferred) return preferred
  }
  return ja.find((v) => v.localService) ?? ja[0] ?? null
}

export function speechAvailable(): boolean {
  return synth() !== undefined && pickVoice() !== null
}

/** Speak Japanese text, cancelling any utterance already in progress. */
export function speak(text: string, rate = 1, voiceURI: string | null = null): void {
  const s = synth()
  if (!s) return
  s.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = pickVoice(voiceURI)
  if (voice) utterance.voice = voice
  utterance.lang = 'ja-JP'
  utterance.rate = rate
  s.speak(utterance)
}

export function stopSpeech(): void {
  synth()?.cancel()
}
