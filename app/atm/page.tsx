'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

type Mode = 'setup' | 'login' | 'dashboard' | 'scan_token' | 'scan_passbook'
type ScanTarget = 'passbook' | 'token' | null

interface StudentSession {
  studentId: string
  studentName: string
  classCode: string
  balance: number
}

const ATM_CLASS_CODE_KEY = 'atm_class_code'

export default function AtmPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [savedClassCode, setSavedClassCode] = useState<string | null>(null)

  // 설정 모드 상태
  const [setupCode, setSetupCode] = useState('')
  const [setupError, setSetupError] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)

  // 로그인 모드 상태
  const [studentName, setStudentName] = useState('')
  const [pin, setPin] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // 로그인된 학생 세션
  const [session, setSession] = useState<StudentSession | null>(null)
  const [scanTarget, setScanTarget] = useState<ScanTarget>(null)

  // QR 스캐너
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const [scanError, setScanError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [redeemResult, setRedeemResult] = useState<{ amount: number; balanceAfter: number } | null>(null)

  // 초기화: localStorage에서 학급코드 불러오기
  useEffect(() => {
    const stored = localStorage.getItem(ATM_CLASS_CODE_KEY)
    if (stored) {
      setSavedClassCode(stored)
      setMode('login')
    } else {
      setMode('setup')
    }
  }, [])

  // 카메라 정지
  const stopCamera = useCallback(() => {
    scanningRef.current = false
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setScanning(false)
  }, [])

  // QR 스캔 처리
  const handleQrData = useCallback(async (data: string) => {
    stopCamera()

    if (data.startsWith('PB:')) {
      // 통장 QR → 이름 자동 채우기
      const parts = data.split(':')
      if (parts.length >= 2) {
        const passbookQrCode = data
        setScanTarget(null)
        setMode('login')
        // 통장 QR을 통한 로그인: 이름 필드에 QR 코드 저장 (숨김 처리)
        // 실제로는 로그인 폼에서 passbookQrCode를 같이 전송
        // state로 관리
        setStudentName('\uD1B5\uC7A5QR:' + passbookQrCode)
      }
    } else if (data.startsWith('PT:')) {
      // 토큰 코인 QR → 충전
      if (!session) {
        setScanError('먼저 로그인이 필요합니다.')
        setMode('dashboard')
        return
      }
      setScanTarget(null)
      setRedeemLoading(true)
      setMode('dashboard')
      try {
        const res = await fetch('/api/qr-tokens/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: data,
            classCode: session.classCode,
            studentId: session.studentId,
          }),
        })
        const result = await res.json()
        if (res.ok) {
          setRedeemResult({ amount: result.amount, balanceAfter: result.balanceAfter })
          setSession(prev => prev ? { ...prev, balance: result.balanceAfter } : prev)
        } else {
          setScanError(result.error || '충전에 실패했습니다.')
        }
      } finally {
        setRedeemLoading(false)
      }
    } else {
      setScanError('인식할 수 없는 QR 코드입니다.')
      setMode(session ? 'dashboard' : 'login')
    }
  }, [session, pin, stopCamera])

  // 카메라 시작 + jsqr 스캔 루프
  const startCamera = useCallback(async (target: ScanTarget) => {
    setScanTarget(target)
    setScanError('')
    setRedeemResult(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      setScanning(true)
      setMode(target === 'token' ? 'scan_token' : 'scan_passbook')

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      }, 100)

      scanningRef.current = true

      const tick = async () => {
        if (!scanningRef.current) return
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState < 2) {
          requestAnimationFrame(tick)
          return
        }

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) { requestAnimationFrame(tick); return }
        ctx.drawImage(video, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const jsQR = (await import('jsqr')).default
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code?.data) {
          handleQrData(code.data)
          return
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    } catch {
      setScanError('카메라에 접근할 수 없습니다. 권한을 확인해주세요.')
      setMode(session ? 'dashboard' : 'login')
    }
  }, [session, handleQrData])

  // 학급 설정 저장
  const handleSetupSave = async () => {
    if (!setupCode.trim()) return
    setSetupLoading(true)
    setSetupError('')
    try {
      const res = await fetch('/api/atm/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classCode: setupCode, studentName: '_test_', studentPin: '0000' }),
      })
      const data = await res.json()
      // 학급코드 유효성 확인 (401이 아니면 학급 존재)
      if (res.status !== 401 || data.error !== '학급코드가 올바르지 않습니다.') {
        localStorage.setItem(ATM_CLASS_CODE_KEY, setupCode.toUpperCase())
        setSavedClassCode(setupCode.toUpperCase())
        setMode('login')
      } else {
        setSetupError('학급코드가 올바르지 않습니다.')
      }
    } catch {
      setSetupError('서버 연결 오류')
    } finally {
      setSetupLoading(false)
    }
  }

  const handleResetSetup = () => {
    localStorage.removeItem(ATM_CLASS_CODE_KEY)
    setSavedClassCode(null)
    setSession(null)
    setPin('')
    setStudentName('')
    setMode('setup')
  }

  // 학생 로그인
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!savedClassCode) return
    setLoginError('')
    setLoginLoading(true)

    const isPassbookScan = studentName.startsWith('통장QR:')
    const passbookQrCode = isPassbookScan ? studentName.replace('통장QR:', '') : undefined
    const nameToSend = isPassbookScan ? undefined : studentName

    try {
      const res = await fetch('/api/atm/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode: savedClassCode,
          studentName: nameToSend,
          studentPin: pin,
          passbookQrCode,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSession({
          studentId: data.studentId,
          studentName: data.studentName,
          classCode: savedClassCode,
          balance: data.balance,
        })
        setMode('dashboard')
        setStudentName('')
        setPin('')
      } else {
        setLoginError(data.error)
      }
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = () => {
    setSession(null)
    setPin('')
    setStudentName('')
    setScanError('')
    setRedeemResult(null)
    stopCamera()
    setMode('login')
  }

  // ── 렌더 ──────────────────────────────────────────────

  // 교사 설정 화면
  if (mode === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="text-6xl">🏧</div>
            <h1 className="text-2xl font-bold text-white">ATM 기기 설정</h1>
            <p className="text-sm text-slate-400">교사만 접근 가능합니다</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-300">학급코드</span>
              <input
                type="text"
                value={setupCode}
                onChange={e => setSetupCode(e.target.value.toUpperCase())}
                placeholder="예: NDG-2026-001"
                className="mt-1 block w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-center font-mono tracking-wider text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>
            {setupError && <p className="text-red-400 text-sm text-center">{setupError}</p>}
            <button
              onClick={handleSetupSave}
              disabled={setupLoading || setupCode.length < 3}
              className="w-full py-3 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-800 text-white font-semibold rounded-xl transition-colors"
            >
              {setupLoading ? '확인 중...' : '이 기기에 학급 설정'}
            </button>
          </div>
          <Link href="/" className="block text-center text-slate-500 hover:text-slate-300 text-sm transition-colors">
            ← 처음으로
          </Link>
        </div>
      </div>
    )
  }

  // QR 스캔 화면 (통장 또는 토큰)
  if (mode === 'scan_token' || mode === 'scan_passbook') {
    const isToken = mode === 'scan_token'
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <div className="relative w-full max-w-sm">
          <video
            ref={videoRef}
            className="w-full rounded-2xl"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />
          {/* 스캔 가이드 오버레이 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-4 border-white/70 rounded-2xl" />
          </div>
        </div>
        <div className="mt-6 text-center space-y-2">
          <p className="text-white font-semibold text-lg">
            {isToken ? '🪙 토큰 QR 코드를 카메라에 비춰주세요' : '📔 통장 QR 코드를 카메라에 비춰주세요'}
          </p>
          <p className="text-gray-400 text-sm">
            {isToken ? '실물 동전의 QR을 인식시키면 자동으로 충전됩니다' : '통장 QR을 인식하면 이름이 자동으로 입력됩니다'}
          </p>
          <button
            onClick={() => { stopCamera(); setMode(session ? 'dashboard' : 'login') }}
            className="mt-4 px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    )
  }

  // 로그인 화면
  if (mode === 'login') {
    const isPassbookScan = studentName.startsWith('통장QR:')
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 to-slate-900 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center space-y-1">
            <div className="text-6xl">🏧</div>
            <h1 className="text-3xl font-bold text-white">행복은행 ATM</h1>
            <p className="text-sm text-blue-300 font-mono">{savedClassCode}</p>
          </div>

          <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
            {isPassbookScan ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="text-2xl">📔</span>
                <div>
                  <p className="text-xs text-blue-600 font-medium">통장 QR 인식됨</p>
                  <p className="text-sm text-gray-700">PIN을 입력해주세요</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStudentName('')}
                  className="ml-auto text-gray-400 hover:text-gray-600 text-sm"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="block">
                <span className="text-sm font-medium text-gray-700">이름</span>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={studentName}
                    onChange={e => setStudentName(e.target.value)}
                    placeholder="이름 입력"
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => startCamera('passbook')}
                    title="통장 QR 스캔"
                    className="px-3 py-3 bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-600 rounded-xl transition-colors text-xl"
                  >
                    📔
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1 text-right">또는 📔 버튼으로 통장 QR 스캔</p>
              </label>
            )}

            <label className="block">
              <span className="text-sm font-medium text-gray-700">PIN 4자리</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="●●●●"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-3xl tracking-[0.5em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </label>

            {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}

            <button
              type="submit"
              disabled={loginLoading || (!isPassbookScan && !studentName) || pin.length !== 4}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-lg font-bold rounded-xl transition-colors"
            >
              {loginLoading ? '확인 중...' : '로그인'}
            </button>
          </form>

          <button
            onClick={handleResetSetup}
            className="block mx-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ⚙️ 교사 설정
          </button>
        </div>
      </div>
    )
  }

  // 대시보드 (로그인 후)
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-slate-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-4">
        <div className="text-center space-y-1">
          <div className="text-5xl">🏧</div>
          <p className="text-sm text-blue-300 font-mono">{session?.classCode}</p>
        </div>

        {/* 잔액 카드 */}
        <div className="bg-white rounded-2xl shadow-xl p-6 text-center space-y-2">
          <p className="text-sm text-gray-500">{session?.studentName}님의 잔액</p>
          <p className="text-5xl font-bold text-blue-600">
            {session ? formatCurrency(session.balance) : '—'}
          </p>
          <p className="text-xs text-gray-400">행복은행 토큰 경제</p>
        </div>

        {/* 충전 결과 */}
        {redeemResult && (
          <div className="bg-green-500 rounded-2xl p-4 text-center text-white">
            <p className="text-2xl font-bold">+{formatCurrency(redeemResult.amount)} 충전!</p>
            <p className="text-sm opacity-80">잔액: {formatCurrency(redeemResult.balanceAfter)}</p>
          </div>
        )}

        {/* 오류 메시지 */}
        {scanError && (
          <div className="bg-red-500 rounded-2xl p-4 text-center text-white">
            <p className="text-sm font-medium">{scanError}</p>
          </div>
        )}

        {/* 충전 로딩 */}
        {redeemLoading && (
          <div className="bg-white/10 rounded-2xl p-4 text-center">
            <div className="inline-block animate-spin w-6 h-6 border-4 border-white border-t-transparent rounded-full" />
            <p className="text-white text-sm mt-2">충전 중...</p>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => { setScanError(''); setRedeemResult(null); startCamera('token') }}
            disabled={redeemLoading}
            className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-white text-lg font-bold rounded-2xl transition-colors flex items-center justify-center gap-3"
          >
            <span className="text-2xl">🪙</span>
            토큰 코인 스캔 (충전)
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors"
        >
          로그아웃
        </button>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}
