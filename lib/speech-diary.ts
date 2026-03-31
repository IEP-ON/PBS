const KST_OFFSET_MS = 9 * 60 * 60 * 1000
export const SPEECH_DIARY_REWARD_AMOUNT = 1
export const SPEECH_DIARY_REWARD_TYPE = 'speech_diary_reward'

export function getKstToday() {
  const now = new Date()
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS)
  return kstNow.toISOString().slice(0, 10)
}

export function getKstDateRange(dateString: string) {
  const baseDate = new Date(dateString)
  const kstDate = new Date(baseDate.getTime() + KST_OFFSET_MS)

  const year = kstDate.getUTCFullYear()
  const month = kstDate.getUTCMonth()
  const day = kstDate.getUTCDate()

  const startMs = Date.UTC(year, month, day) - KST_OFFSET_MS
  const endMs = startMs + 24 * 60 * 60 * 1000

  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  }
}

export function getStoragePath(url: string | null) {
  if (!url) return null

  const marker = '/object/public/audio-diaries/'
  const index = url.indexOf(marker)
  if (index === -1) return null

  return decodeURIComponent(url.slice(index + marker.length))
}

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, '')
}

export function getSpeechDiaryRewardDescription(dateString: string) {
  return `말 일기 작성 보상 (${dateString})`
}
