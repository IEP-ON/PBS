/**
 * 공용 갤탭 PWA: 최초 설정 후 홈(/) 접속 시 고정 경로로 보내기 위한 localStorage 잠금.
 */
export const KIOSK_LOCK_STORAGE_KEY = 'pbs_kiosk_lock_v1'

export type KioskLockMode = 'diary' | 'atm' | 'bank'

export interface KioskLockPayload {
  v: 1
  mode: KioskLockMode
}

export function getKioskLock(): KioskLockPayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KIOSK_LOCK_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as KioskLockPayload
    if (parsed?.v === 1 && (parsed.mode === 'diary' || parsed.mode === 'atm' || parsed.mode === 'bank')) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function setKioskLock(mode: KioskLockMode): void {
  if (typeof window === 'undefined') return
  const payload: KioskLockPayload = { v: 1, mode }
  window.localStorage.setItem(KIOSK_LOCK_STORAGE_KEY, JSON.stringify(payload))
}

export function clearKioskLock(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(KIOSK_LOCK_STORAGE_KEY)
}

export function kioskLockRedirectPath(lock: KioskLockPayload): string {
  switch (lock.mode) {
    case 'diary':
      return '/diary-kiosk'
    case 'atm':
      return '/atm'
    case 'bank':
      return '/bank/lock'
    default:
      return '/'
  }
}
