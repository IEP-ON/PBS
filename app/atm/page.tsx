'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { formatClassCodeInput, formatCurrency, normalizeClassCode } from '@/lib/utils'
import type { PublicCue } from '@/types'
import {
  speakAtm,
  stopAtmSpeech,
  tokenFailSpeech,
  warmUpSpeechVoices,
} from '@/lib/atm-kiosk-speech'

/** Galaxy Tab S5e PWA · 가로(landscape) 우선 키오스크 */
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

type KioskAccent = 'idle' | 'welcome' | 'hint' | 'error' | 'success'

interface KioskPanel {
  headline: string
  lines: string[]
  accent: KioskAccent
}

const IDLE_PANEL: KioskPanel = {
  headline: '통장 카드를 비춰 주세요',
  lines: [
    '학생 이름이 화면에 나오면,',
    '선생님께 받은 큐알 코인을 비춰 주세요.',
  ],
  accent: 'idle',
}

function welcomePanelFromSession(s: StudentSession): KioskPanel {
  return {
    headline: `${s.studentName} 학생`,
    lines: [
      `현재 잔액 ${formatCurrency(s.balance)}`,
      '선생님께 받은 큐알 코인을 화면에 비춰 주세요.',
    ],
    accent: 'welcome',
  }
}

function accentPanelClass(accent: KioskAccent): string {
  switch (accent) {
    case 'welcome':
      return 'border-sky-500/40 bg-sky-950/80 text-white'
    case 'hint':
      return 'border-amber-400/50 bg-amber-950/85 text-amber-50'
    case 'error':
      return 'border-rose-500/50 bg-rose-950/90 text-rose-50'
    case 'success':
      return 'border-emerald-400/50 bg-emerald-950/90 text-emerald-50'
    default:
      return 'border-white/15 bg-slate-900/90 text-white'
  }
}

export default function AtmPage() {
  const [mode, setMode] = useState<Mode>('listen')
  const [savedClassCode, setSavedClassCode] = useState<string | null>(null)

  const [setupCode, setSetupCode] = useState('')
  const [setupError, setSetupError] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)

  const [session, setSession] = useState<StudentSession | null>(null)
  const [kioskPanel, setKioskPanel] = useState<KioskPanel>(IDLE_PANEL)
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
  const panelClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      setKioskPanel(IDLE_PANEL)
      sessionClearTimerRef.current = null
    }, CLEAR_SESSION_AFTER_REDEEM_MS)
  }, [clearSessionTimer])

  const resolvePanelAfterTransient = useCallback(() => {
    const s = sessionRef.current
    if (s) setKioskPanel(welcomePanelFromSession(s))
    else setKioskPanel(IDLE_PANEL)
  }, [])

  const showKioskTransient = useCallback(
    (panel: KioskPanel, autoClearMs: number) => {
      if (panelClearTimerRef.current) {
        clearTimeout(panelClearTimerRef.current)
        panelClearTimerRef.current = null
      }
      setKioskPanel(panel)
      panelClearTimerRef.current = setTimeout(() => {
        panelClearTimerRef.current = null
        resolvePanelAfterTransient()
      }, autoClearMs)
    },
    [resolvePanelAfterTransient],
  )

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
    warmUpSpeechVoices()
    const onVoices = () => warmUpSpeechVoices()
    window.speechSynthesis.addEventListener('voiceschanged', onVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', onVoices)
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
          speakAtm('학급 설정이 필요합니다.')
          showKioskTransient(
            {
              headline: '설정 필요',
              lines: ['교사가 학급 코드를 먼저 저장해 주세요.'],
              accent: 'error',
            },
            4500,
          )
          decodePausedRef.current = false
          return
        }

        const activeSession = sessionRef.current
        if (!activeSession) {
          speakAtm('먼저 학생 통장 카드를 화면에 비춰 주세요.')
          showKioskTransient(
            {
              headline: '통장 카드부터',
              lines: ['학생 통장 카드를 먼저 비춰 주세요.', '그다음 큐알 코인을 비춰 주세요.'],
              accent: 'hint',
            },
            5200,
          )
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
            const amount = result.amount as number
            const balanceAfter = result.balanceAfter as number
            setRedeemSuccess({ amount, balanceAfter })
            setSession(prev => (prev ? { ...prev, balance: balanceAfter } : prev))
            setKioskPanel({
              headline: '인식되었습니다',
              lines: [
                `${formatCurrency(amount)}이 충전되었습니다.`,
                `현재 잔액 ${formatCurrency(balanceAfter)}`,
              ],
              accent: 'success',
            })
            speakAtm(
              `인식이 되었습니다. ${formatCurrency(amount)}이 충전되었습니다. 현재 잔액은 ${formatCurrency(balanceAfter)}입니다.`,
            )
            scheduleSessionClearAfterRedeem()
          } else {
            const apiError = (result.error as string) || '충전에 실패했습니다.'
            const spoken = tokenFailSpeech(apiError)
            speakAtm(spoken)
            showKioskTransient(
              {
                headline: '큐알 코인',
                lines: [spoken],
                accent: 'error',
              },
              6500,
            )
          }
        } catch {
          speakAtm('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.')
          showKioskTransient(
            {
              headline: '연결 오류',
              lines: ['잠시 후 다시 비춰 주세요.'],
              accent: 'error',
            },
            5000,
          )
        } finally {
          decodePausedRef.current = false
        }
        return
      }

      if (!savedClassCode) {
        speakAtm('먼저 학급을 설정해 주세요.')
        showKioskTransient(
          {
            headline: '학급 설정',
            lines: ['교사가 학급 코드를 저장한 뒤 이용해 주세요.'],
            accent: 'error',
          },
          5000,
        )
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
          if (panelClearTimerRef.current) {
            clearTimeout(panelClearTimerRef.current)
            panelClearTimerRef.current = null
          }
          setRedeemSuccess(null)
          const nextSession: StudentSession = {
            studentId: result.studentId,
            studentName: result.studentName,
            classCode: savedClassCode,
            balance: result.balance,
            publicCue: result.publicCue || null,
          }
          setSession(nextSession)
          const wp = welcomePanelFromSession(nextSession)
          setKioskPanel(wp)
          speakAtm(
            `안녕하세요, ${nextSession.studentName} 학생. 현재 잔액은 ${formatCurrency(nextSession.balance)}입니다. 선생님께 받은 큐알 코인이 있으면, 화면에 비춰 주세요.`,
          )
        } else {
          const msg = (result.error as string) || '카드를 인식하지 못했습니다.'
          speakAtm(`카드를 인식하지 못했습니다. ${msg}`)
          showKioskTransient(
            {
              headline: '다시 시도',
              lines: [msg],
              accent: 'error',
            },
            5500,
          )
        }
      } catch {
        speakAtm('서버에 연결할 수 없습니다.')
        showKioskTransient(
          {
            headline: '연결 오류',
            lines: ['잠시 후 다시 비춰 주세요.'],
            accent: 'error',
          },
          5000,
        )
      } finally {
        decodePausedRef.current = false
      }
    },
    [savedClassCode, scheduleSessionClearAfterRedeem, showKioskTransient, clearSessionTimer],
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
        stopAtmSpeech()
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
      if (panelClearTimerRef.current) clearTimeout(panelClearTimerRef.current)
      stopAtmSpeech()
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
    stopAtmSpeech()
    localStorage.removeItem(ATM_CLASS_CODE_KEY)
    setSavedClassCode(null)
    setSession(null)
    setSetupCode('')
    setRedeemSuccess(null)
    setKioskPanel(IDLE_PANEL)
    clearSessionTimer()
    if (panelClearTimerRef.current) clearTimeout(panelClearTimerRef.current)
    setMode('setup')
  }

  const openSetupFromListen = () => {
    stopAtmSpeech()
    stopCamera()
    setSetupCode(savedClassCode || '')
    setMode('setup')
  }

  const safePad = {
    paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
    paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
    paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
    paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
  } as const

  if (mode === 'setup') {
    return (
      <div
        className="flex min-h-[100dvh] w-full flex-col bg-gradient-to-b from-slate-900 to-black text-white landscape:min-h-[100dvh] landscape:flex-row landscape:items-stretch"
        style={safePad}
      >
        <div className="flex w-full flex-1 flex-col justify-center gap-6 px-4 py-6 sm:px-8 landscape:flex-1 landscape:overflow-y-auto landscape:py-8">
          <div className="text-center landscape:text-left">
            <div className="text-7xl sm:text-8xl landscape:inline-block">🏧</div>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl landscape:mt-2 landscape:text-4xl">
              ATM 기기 설정
            </h1>
            <p className="mt-2 text-lg text-slate-400 landscape:text-xl">교사용 · 학급 코드</p>
          </div>

          <div className="w-full space-y-6 rounded-3xl border border-white/15 bg-white/10 p-6 sm:p-10 landscape:max-w-none">
            <label className="block">
              <span className="text-lg font-bold text-slate-200">학급 코드</span>
              <input
                type="text"
                value={setupCode}
                onChange={e => setSetupCode(formatClassCodeInput(e.target.value))}
                placeholder="예: NDG-2026-001"
                className="mt-3 block w-full rounded-2xl border-2 border-white/25 bg-black/30 px-5 py-5 text-center font-mono text-2xl tracking-wider text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-500/30 landscape:py-6 landscape:text-3xl"
              />
            </label>
            <p className="text-lg leading-relaxed text-slate-300 landscape:text-xl">
              학생은 <strong className="text-white">통장 QR</strong> 후 <strong className="text-white">큐알 코인</strong> 순서로 비추면 됩니다. 음성 안내가 나옵니다.
            </p>
            {setupError && (
              <p className="text-center text-xl font-bold text-rose-400 landscape:text-2xl">{setupError}</p>
            )}
            <button
              type="button"
              onClick={() => void handleSetupSave()}
              disabled={setupLoading || setupCode.length < 3}
              className="w-full rounded-2xl bg-sky-500 py-5 text-2xl font-black text-white transition hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-400 landscape:py-6 landscape:text-3xl"
            >
              {setupLoading ? '확인 중…' : '이 기기에 저장'}
            </button>
          </div>

          <div className="flex flex-col gap-4 landscape:flex-row landscape:flex-wrap landscape:justify-start">
            {savedClassCode && (
              <button
                type="button"
                onClick={() => setMode('listen')}
                className="rounded-2xl border-2 border-white/30 px-8 py-4 text-xl font-bold text-white hover:bg-white/10 landscape:py-5 landscape:text-2xl"
              >
                스캔 화면으로
              </button>
            )}
            <button
              type="button"
              onClick={handleFullReset}
              className="rounded-2xl border-2 border-rose-500/50 px-8 py-4 text-xl font-bold text-rose-300 hover:bg-rose-950/40 landscape:py-5 landscape:text-2xl"
            >
              저장된 학급 지우기
            </button>
            <Link
              href="/"
              className="rounded-2xl border-2 border-white/20 px-8 py-4 text-center text-xl font-bold text-slate-300 hover:bg-white/5 landscape:py-5 landscape:text-2xl"
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
      className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-black landscape:flex-row"
      style={safePad}
    >
      {/* 카메라 열 (가로: 왼쪽 약 58%, 세로: 위쪽 가변) */}
      <div className="relative min-h-[42dvh] flex-1 landscape:min-h-0 landscape:flex-[1.15] landscape:min-w-0">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        <div className="pointer-events-none absolute inset-0 bg-black/15" />

        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center p-3 landscape:hidden"
          aria-hidden
        >
          <div
            className="rounded-[1.75rem] border-[5px] border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.32)]"
            style={{ width: 'min(88vmin, 92vw)', height: 'min(88vmin, 92vw)' }}
          />
        </div>
        <div
          className="pointer-events-none absolute inset-0 hidden items-center justify-center p-4 landscape:flex"
          aria-hidden
        >
          <div
            className="rounded-3xl border-[6px] border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.32)]"
            style={{
              width: 'min(78dvh, 44vw)',
              height: 'min(78dvh, 44vw)',
            }}
          />
        </div>

        <button
          type="button"
          onClick={openSetupFromListen}
          className="absolute right-3 top-3 z-20 rounded-xl border border-white/35 bg-black/55 px-3 py-2 text-sm font-bold text-white backdrop-blur hover:bg-black/75 landscape:right-4 landscape:top-4 landscape:px-4 landscape:py-2 landscape:text-base"
        >
          학급 설정
        </button>

        {(!cameraReady || requestingCamera) && !cameraDenied && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/65 landscape:gap-4">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-white border-t-transparent landscape:h-16 landscape:w-16" />
            <p className="text-xl font-bold text-white landscape:text-2xl">카메라 준비 중…</p>
          </div>
        )}

        {cameraDenied && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black/92 px-5 text-center landscape:gap-6 landscape:px-10">
            <p className="text-2xl font-black text-white landscape:text-3xl">카메라를 켤 수 없습니다</p>
            <p className="max-w-xl text-lg text-slate-300 landscape:text-xl">
              설정 → 앱 → 브라우저 → 권한에서 카메라를 허용한 뒤 다시 시도해 주세요.
            </p>
            <button
              type="button"
              onClick={() => void startCamera()}
              className="rounded-2xl bg-sky-500 px-8 py-4 text-xl font-black text-white hover:bg-sky-400 landscape:px-10 landscape:py-5 landscape:text-2xl"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 세로 모드: 충전 성공 풀스크린 */}
        {redeemSuccess && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-emerald-600/95 p-6 text-center landscape:hidden">
            <p className="text-3xl font-black text-white sm:text-4xl">인식되었습니다</p>
            <p className="mt-5 text-4xl font-black text-white sm:text-5xl">
              +{formatCurrency(redeemSuccess.amount)}
            </p>
            <p className="mt-4 text-2xl font-bold text-white/95 sm:text-3xl">
              현재 잔액 {formatCurrency(redeemSuccess.balanceAfter)}
            </p>
            <p className="mt-8 text-lg text-white/85">잠시 후 다음 학생 화면으로 돌아갑니다</p>
          </div>
        )}
      </div>

      {/* 안내 패널: 가로 우측 큰 타이포 / 세로 하단 */}
      <aside
        className={`flex max-h-[46dvh] min-h-0 w-full shrink-0 flex-col border-t border-white/10 bg-slate-950 landscape:max-h-none landscape:h-full landscape:w-[min(42%,560px)] landscape:shrink-0 landscape:flex-none landscape:border-l landscape:border-t-0 ${
          redeemSuccess ? 'hidden max-h-0 overflow-hidden border-0 landscape:flex landscape:max-h-none' : ''
        }`}
      >
        <div className="shrink-0 border-b border-white/10 px-4 py-3 landscape:px-6 landscape:py-4">
          <p className="font-mono text-xs text-sky-300/90 landscape:text-sm">{savedClassCode}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 landscape:text-xs">
            가로 모드 권장 · 음성 안내
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto px-4 py-4 text-center landscape:gap-5 landscape:px-8 landscape:py-6 landscape:text-left">
          {redeemSuccess ? (
            <div className="hidden flex-col gap-3 landscape:flex">
              <p className="text-3xl font-black text-emerald-400 landscape:text-4xl">인식되었습니다</p>
              <p className="text-4xl font-black text-white landscape:text-5xl">
                +{formatCurrency(redeemSuccess.amount)}
              </p>
              <p className="text-2xl font-bold text-slate-200 landscape:text-3xl">
                현재 잔액 {formatCurrency(redeemSuccess.balanceAfter)}
              </p>
              <p className="text-lg text-slate-400 landscape:text-xl">잠시 후 다음 학생 화면으로 돌아갑니다</p>
            </div>
          ) : (
            <div
              className={`flex flex-col gap-3 rounded-2xl border-2 p-4 landscape:gap-4 landscape:rounded-3xl landscape:p-6 ${accentPanelClass(kioskPanel.accent)}`}
            >
              <p className="text-2xl font-black leading-tight landscape:text-3xl">{kioskPanel.headline}</p>
              {kioskPanel.lines.map((line, i) => (
                <p key={i} className="text-lg font-semibold leading-snug landscape:text-2xl">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
