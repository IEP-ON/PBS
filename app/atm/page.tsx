'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { formatClassCodeInput, formatCurrency, normalizeClassCode } from '@/lib/utils'
import type { PublicCue } from '@/types'

/** Galaxy Tab S5e 등 탭 PWA 키오스크 튜닝 */
const ATM_CLASS_CODE_KEY = 'atm_class_code'
const DEBOUNCE_MS = 2200
const CLEAR_SESSION_AFTER_REDEEM_MS = 8000
const DECODE_INTERVAL_MS = 100
const CROP_FRACTION = 0.68
const CROP_TARGET_MAX = 420

type Mode = 'setup' | 'listen'

interface StudentSession {
  studentId: string
  studentName: string
  classCode: string
  balance: number
  publicCue: PublicCue | null
}

type Banner =
  | { kind: 'error'; message: string }
  | { kind: 'hint'; message: string }

export default function AtmPage() {
  const [mode, setMode] = useState<Mode>('listen')
  const [savedClassCode, setSavedClassCode] = useState<string | null>(null)

  const [setupCode, setSetupCode] = useState('')
  const [setupError, setSetupError] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)

  const [session, setSession] = useState<StudentSession | null>(null)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [redeemSuccess, setRedeemSuccess] = useState<{ amount: number; balanceAfter: number } | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraDenied, setCameraDenied] = useState(false)
  const [requestingCamera, setRequestingCamera] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const decodePausedRef = useRef(false)
  const lastDecodeAtRef = useRef(0)
  const lastPayloadRef = useRef<string | null>(null)
  const lastPayloadAtRef = useRef(0)
  const jsQrRef = useRef<(typeof import('jsqr'))['default'] | null>(null)
  const sessionClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const bannerClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionRef = useRef<StudentSession | null>(null)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const stopCamera = useCallback(() => {
    scanningRef.current = false
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }, [])

  const clearSessionTimer = useCallback(() => {
    if (sessionClearTimerRef.current) {
      clearTimeout(sessionClearTimerRef.current)
      sessionClearTimerRef.current = null
    }
  }, [])

  const scheduleSessionClearAfterRedeem = useCallback(() => {
    clearSessionTimer()
    sessionClearTimerRef.current = setTimeout(() => {
      setSession(null)
      setRedeemSuccess(null)
      sessionClearTimerRef.current = null
    }, CLEAR_SESSION_AFTER_REDEEM_MS)
  }, [clearSessionTimer])

  const showBanner = useCallback((next: Banner | null, autoClearMs?: number) => {
    if (bannerClearTimerRef.current) {
      clearTimeout(bannerClearTimerRef.current)
      bannerClearTimerRef.current = null
    }
    setBanner(next)
    if (next && autoClearMs) {
      bannerClearTimerRef.current = setTimeout(() => {
        setBanner(null)
        bannerClearTimerRef.current = null
      }, autoClearMs)
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(ATM_CLASS_CODE_KEY)
    if (stored) {
      setSavedClassCode(normalizeClassCode(stored))
      setMode('listen')
    } else {
      setMode('setup')
    }
  }, [])

  useEffect(() => {
    void import('jsqr').then(m => {
      jsQrRef.current = m.default
    })
  }, [])

  const processPayload = useCallback(
    async (data: string) => {
      const trimmed = data.trim()
      if (!trimmed) return

      const now = Date.now()
      if (trimmed === lastPayloadRef.current && now - lastPayloadAtRef.current < DEBOUNCE_MS) {
        return
      }
      lastPayloadRef.current = trimmed
      lastPayloadAtRef.current = now

      decodePausedRef.current = true

      if (trimmed.startsWith('PT:')) {
        if (!savedClassCode) {
          showBanner({ kind: 'error', message: '학급 설정이 필요합니다.' }, 4500)
          decodePausedRef.current = false
          return
        }

        const activeSession = sessionRef.current
        if (!activeSession) {
          showBanner({ kind: 'hint', message: '먼저 학생 카드를 화면 중앙에 비춰 주세요.' }, 5000)
          decodePausedRef.current = false
          return
        }

        try {
          const res = await fetch('/api/qr-tokens/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: trimmed,
              classCode: activeSession.classCode,
              studentId: activeSession.studentId,
            }),
          })
          const result = await res.json()
          if (res.ok) {
            setRedeemSuccess({ amount: result.amount, balanceAfter: result.balanceAfter })
            setSession(prev =>
              prev ? { ...prev, balance: result.balanceAfter as number } : prev,
            )
            showBanner(null)
            scheduleSessionClearAfterRedeem()
          } else {
            showBanner({ kind: 'error', message: (result.error as string) || '충전에 실패했습니다.' }, 6000)
          }
        } catch {
          showBanner({ kind: 'error', message: '서버 연결에 실패했습니다.' }, 5000)
        } finally {
          decodePausedRef.current = false
        }
        return
      }

      if (!savedClassCode) {
        showBanner({ kind: 'error', message: '먼저 학급을 설정해 주세요.' }, 5000)
        decodePausedRef.current = false
        return
      }

      try {
        const res = await fetch('/api/atm/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classCode: savedClassCode,
            qrCode: trimmed,
          }),
        })
        const result = await res.json()
        if (res.ok) {
          clearSessionTimer()
          setRedeemSuccess(null)
          setSession({
            studentId: result.studentId,
            studentName: result.studentName,
            classCode: savedClassCode,
            balance: result.balance,
            publicCue: result.publicCue || null,
          })
          showBanner(null)
        } else {
          showBanner({ kind: 'error', message: (result.error as string) || '카드를 인식하지 못했습니다.' }, 5500)
        }
      } catch {
        showBanner({ kind: 'error', message: '서버 연결에 실패했습니다.' }, 5000)
      } finally {
        decodePausedRef.current = false
      }
    },
    [savedClassCode, scheduleSessionClearAfterRedeem, showBanner, clearSessionTimer],
  )

  const processPayloadRef = useRef(processPayload)
  processPayloadRef.current = processPayload

  const startCamera = useCallback(async () => {
    if (mode !== 'listen' || !savedClassCode) return

    stopCamera()

    setCameraDenied(false)
    setRequestingCamera(true)
    decodePausedRef.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
      })
      streamRef.current = stream
      scanningRef.current = true

      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play()
      }
      setCameraReady(true)

      const tick = async () => {
        if (!scanningRef.current) return
        if (decodePausedRef.current) {
          requestAnimationFrame(() => void tick())
          return
        }

        const frameNow = performance.now()
        if (frameNow - lastDecodeAtRef.current < DECODE_INTERVAL_MS) {
          requestAnimationFrame(() => void tick())
          return
        }
        lastDecodeAtRef.current = frameNow

        const v = videoRef.current
        const canvas = canvasRef.current
        if (!v || !canvas || v.readyState < 2) {
          requestAnimationFrame(() => void tick())
          return
        }

        const sourceWidth = v.videoWidth
        const sourceHeight = v.videoHeight
        const cropSize = Math.floor(Math.min(sourceWidth, sourceHeight) * CROP_FRACTION)
        const sourceX = Math.floor((sourceWidth - cropSize) / 2)
        const sourceY = Math.floor((sourceHeight - cropSize) / 2)
        const targetSize = Math.min(CROP_TARGET_MAX, cropSize)

        if (canvas.width !== targetSize || canvas.height !== targetSize) {
          canvas.width = targetSize
          canvas.height = targetSize
        }

        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) {
          requestAnimationFrame(() => void tick())
          return
        }

        context.drawImage(
          v,
          sourceX,
          sourceY,
          cropSize,
          cropSize,
          0,
          0,
          targetSize,
          targetSize,
        )

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        const jsQR = jsQrRef.current ?? (await import('jsqr')).default
        jsQrRef.current = jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })

        if (code?.data) {
          void processPayloadRef.current(code.data)
        }

        requestAnimationFrame(() => void tick())
      }

      requestAnimationFrame(() => void tick())
    } catch {
      setCameraDenied(true)
      scanningRef.current = false
    } finally {
      setRequestingCamera(false)
    }
  }, [mode, savedClassCode, stopCamera])

  useEffect(() => {
    if (mode !== 'listen' || !savedClassCode) {
      stopCamera()
      return
    }
    void startCamera()
    return () => {
      stopCamera()
    }
  }, [mode, savedClassCode, startCamera, stopCamera])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        stopCamera()
      } else if (mode === 'listen' && savedClassCode) {
        void startCamera()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [mode, savedClassCode, startCamera, stopCamera])

  useEffect(() => {
    if (mode !== 'listen' || !('wakeLock' in navigator)) return
    let cancelled = false
    const req = navigator.wakeLock
      ?.request?.('screen')
      .then(lock => {
        if (!cancelled) wakeLockRef.current = lock
      })
      .catch(() => {})
    return () => {
      cancelled = true
      void req
      wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
    }
  }, [mode])

  useEffect(() => {
    return () => {
      clearSessionTimer()
      if (bannerClearTimerRef.current) clearTimeout(bannerClearTimerRef.current)
    }
  }, [clearSessionTimer])

  const handleSetupSave = async () => {
    const normalizedCode = normalizeClassCode(setupCode)
    if (!normalizedCode) return
    setSetupLoading(true)
    setSetupError('')
    setSetupCode(normalizedCode)
    try {
      const res = await fetch(`/api/classroom/${normalizedCode}`)
      const data = await res.json()
      if (res.ok && data.isActive !== false) {
        localStorage.setItem(ATM_CLASS_CODE_KEY, normalizedCode)
        setSavedClassCode(normalizedCode)
        setMode('listen')
      } else {
        setSetupError('학급코드가 올바르지 않습니다.')
      }
    } catch {
      setSetupError('서버 연결 오류')
    } finally {
      setSetupLoading(false)
    }
  }

  const handleFullReset = () => {
    localStorage.removeItem(ATM_CLASS_CODE_KEY)
    setSavedClassCode(null)
    setSession(null)
    setSetupCode('')
    setRedeemSuccess(null)
    showBanner(null)
    clearSessionTimer()
    setMode('setup')
  }

  const openSetupFromListen = () => {
    stopCamera()
    setSetupCode(savedClassCode || '')
    setMode('setup')
  }

  const safePad = {
    paddingTop: 'max(1rem, env(safe-area-inset-top))',
    paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
    paddingLeft: 'max(1rem, env(safe-area-inset-left))',
    paddingRight: 'max(1rem, env(safe-area-inset-right))',
  } as const

  if (mode === 'setup') {
    return (
      <div
        className="flex min-h-[100dvh] w-full flex-col bg-gradient-to-b from-slate-900 to-black text-white"
        style={safePad}
      >
        <div className="flex w-full flex-1 flex-col justify-center gap-8 px-4 py-6 sm:px-8">
          <div className="text-center">
            <div className="text-7xl sm:text-8xl">🏧</div>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">ATM 기기 설정</h1>
            <p className="mt-2 text-lg text-slate-400">교사용 · 학급 코드만 입력하면 됩니다</p>
          </div>

          <div className="w-full space-y-6 rounded-3xl border border-white/15 bg-white/10 p-6 sm:p-10">
            <label className="block">
              <span className="text-lg font-bold text-slate-200">학급 코드</span>
              <input
                type="text"
                value={setupCode}
                onChange={e => setSetupCode(formatClassCodeInput(e.target.value))}
                placeholder="예: NDG-2026-001"
                className="mt-3 block w-full rounded-2xl border-2 border-white/25 bg-black/30 px-5 py-5 text-center font-mono text-2xl tracking-wider text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-500/30 sm:text-3xl"
              />
            </label>
            <p className="text-lg leading-relaxed text-slate-300">
              학생은 <strong className="text-white">통장 QR 카드</strong>와 <strong className="text-white">토큰 QR</strong>만 순서대로 비추면 충전됩니다. 상점·주식은 뱅킹 앱에서 이용합니다.
            </p>
            {setupError && (
              <p className="text-center text-xl font-bold text-rose-400">{setupError}</p>
            )}
            <button
              type="button"
              onClick={() => void handleSetupSave()}
              disabled={setupLoading || setupCode.length < 3}
              className="w-full rounded-2xl bg-sky-500 py-5 text-2xl font-black text-white transition hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-400"
            >
              {setupLoading ? '확인 중…' : '이 기기에 저장'}
            </button>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            {savedClassCode && (
              <button
                type="button"
                onClick={() => setMode('listen')}
                className="rounded-2xl border-2 border-white/30 px-8 py-4 text-xl font-bold text-white hover:bg-white/10"
              >
                스캔 화면으로
              </button>
            )}
            <button
              type="button"
              onClick={handleFullReset}
              className="rounded-2xl border-2 border-rose-500/50 px-8 py-4 text-xl font-bold text-rose-300 hover:bg-rose-950/40"
            >
              저장된 학급 지우기
            </button>
            <Link
              href="/"
              className="rounded-2xl border-2 border-white/20 px-8 py-4 text-center text-xl font-bold text-slate-300 hover:bg-white/5"
            >
              처음으로
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-black"
      style={safePad}
    >
      <div className="relative min-h-0 w-full flex-1">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        <div className="pointer-events-none absolute inset-0 bg-black/20" />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
          <div
            className="rounded-[2rem] border-[6px] border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
            style={{
              width: 'min(88vmin, 94vw)',
              height: 'min(88vmin, 94vw)',
            }}
          />
        </div>

        <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[85%] rounded-2xl bg-black/55 px-4 py-3 text-white backdrop-blur-sm">
          <p className="font-mono text-sm text-sky-200 sm:text-base">{savedClassCode}</p>
          {session && (
            <p className="mt-1 text-2xl font-black sm:text-3xl">
              {session.studentName}{' '}
              <span className="text-sky-300">{formatCurrency(session.balance)}</span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={openSetupFromListen}
          className="absolute right-4 top-4 z-20 rounded-xl border border-white/30 bg-black/50 px-4 py-2 text-sm font-bold text-white backdrop-blur hover:bg-black/70 sm:text-base"
        >
          학급 설정
        </button>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-6 pt-24 text-center">
          <p className="text-2xl font-black leading-snug text-white sm:text-3xl">
            카드를 화면 중앙 네모에 맞춰 주세요
          </p>
          <p className="mt-2 text-lg font-semibold text-white/85 sm:text-xl">
            너무 가깝지 않게 · 밝은 곳에서 · 잠시만 유지해 주세요
          </p>
        </div>

        {(!cameraReady || requestingCamera) && !cameraDenied && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/65">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-white border-t-transparent" />
            <p className="text-2xl font-bold text-white">카메라 준비 중…</p>
          </div>
        )}

        {cameraDenied && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black/90 px-6 text-center">
            <p className="text-3xl font-black text-white">카메라를 켤 수 없습니다</p>
            <p className="max-w-xl text-xl text-slate-300">
              갤럭시 탭 설정 → 앱 → 브라우저 → 권한에서 카메라를 허용한 뒤, 이 페이지를 다시 열어 주세요.
            </p>
            <button
              type="button"
              onClick={() => void startCamera()}
              className="rounded-2xl bg-sky-500 px-10 py-5 text-2xl font-black text-white hover:bg-sky-400"
            >
              다시 시도
            </button>
          </div>
        )}

        {banner && (
          <div
            className={`absolute inset-x-4 bottom-32 z-30 rounded-2xl px-6 py-6 text-center sm:inset-x-8 ${
              banner.kind === 'error'
                ? 'bg-rose-600 text-white'
                : 'bg-amber-500 text-black'
            }`}
          >
            <p className="text-2xl font-black leading-tight sm:text-3xl">{banner.message}</p>
          </div>
        )}

        {redeemSuccess && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-emerald-600/95 p-6 text-center">
            <p className="text-4xl font-black text-white sm:text-5xl">
              +{formatCurrency(redeemSuccess.amount)} 충전 완료
            </p>
            <p className="mt-6 text-3xl font-bold text-white/95 sm:text-4xl">
              잔액 {formatCurrency(redeemSuccess.balanceAfter)}
            </p>
            <p className="mt-8 text-xl text-white/80">잠시 후 다음 학생을 위해 초기화됩니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
