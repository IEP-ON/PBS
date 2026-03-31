'use client'

import type { FormEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

type Mode = 'setup' | 'login' | 'dashboard' | 'scan_token' | 'scan_student' | 'shop' | 'stocks'
type ScanTarget = 'student' | 'token' | null

interface StudentSession {
  studentId: string
  studentName: string
  classCode: string
  balance: number
}

interface ShopItem {
  id: string
  name: string
  emoji: string
  price: number
  stock: number | null
}

interface StockItem {
  id: string
  name: string
  emoji: string
  current_price: number
}

interface Holding {
  stock_name: string
  quantity: number
  avg_buy_price: number
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

  // QR 스캐너
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const [scanError, setScanError] = useState('')
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [redeemResult, setRedeemResult] = useState<{ amount: number; balanceAfter: number } | null>(null)

  // 상점 상태
  const [shopItems, setShopItems] = useState<ShopItem[]>([])
  const [shopLoading, setShopLoading] = useState(false)
  const [shopMessage, setShopMessage] = useState('')
  const [purchasingId, setPurchasingId] = useState<string | null>(null)

  // 주식 상태
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [stocksLoading, setStocksLoading] = useState(false)
  const [stockMessage, setStockMessage] = useState('')
  const [tradingId, setTradingId] = useState<string | null>(null)

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
  }, [])

  // QR 스캔 처리
  const handleQrData = useCallback(async (data: string) => {
    stopCamera()

    if (data.startsWith('PT:')) {
      // 토큰 코인 QR → 충전
      if (!session) {
        setScanError('먼저 로그인이 필요합니다.')
        setMode('dashboard')
        return
      }
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
      if (!savedClassCode) {
        setScanError('먼저 학급 설정이 필요합니다.')
        setMode('setup')
        return
      }

      setLoginLoading(true)
      setLoginError('')
      setMode('login')

      try {
        const res = await fetch('/api/atm/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classCode: savedClassCode,
            qrCode: data,
          }),
        })
        const result = await res.json()

        if (res.ok) {
          setSession({
            studentId: result.studentId,
            studentName: result.studentName,
            classCode: savedClassCode,
            balance: result.balance,
          })
          setMode('dashboard')
          setStudentName('')
          setPin('')
        } else {
          setLoginError(result.error || 'QR 로그인에 실패했습니다.')
        }
      } catch {
        setLoginError('서버 연결에 실패했습니다.')
      } finally {
        setLoginLoading(false)
      }
    }
  }, [savedClassCode, session, stopCamera])

  // 카메라 시작 + jsqr 스캔 루프
  const startCamera = useCallback(async (target: ScanTarget) => {
    setScanError('')
    setRedeemResult(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      setMode(target === 'token' ? 'scan_token' : 'scan_student')

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
      const normalizedCode = setupCode.toUpperCase()
      const res = await fetch(`/api/classroom/${normalizedCode}`)
      const data = await res.json()

      if (res.ok && data.isActive !== false) {
        localStorage.setItem(ATM_CLASS_CODE_KEY, normalizedCode)
        setSavedClassCode(normalizedCode)
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
  const handleLogin = async (e?: FormEvent, pinOverride?: string) => {
    if (e) e.preventDefault()
    if (!savedClassCode) return
    setLoginError('')
    setLoginLoading(true)
    const pinToSubmit = pinOverride ?? pin

    try {
      const res = await fetch('/api/atm/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode: savedClassCode,
          studentName,
          studentPin: pinToSubmit,
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
    setShopItems([])
    setShopMessage('')
    setStocks([])
    setHoldings([])
    setStockMessage('')
    stopCamera()
    setMode('login')
  }

  // 상점 아이템 로드
  const loadShopItems = async () => {
    if (!session) return
    setShopLoading(true)
    setShopMessage('')
    try {
      const res = await fetch(`/api/atm/shop?classCode=${session.classCode}`)
      const data = await res.json()
      if (res.ok) setShopItems(data.items || [])
    } catch { /* ignore */ } finally {
      setShopLoading(false)
    }
  }

  // 상점 구매 (1개 즉시)
  const handlePurchase = async (item: ShopItem) => {
    if (!session) return
    setPurchasingId(item.id)
    setShopMessage('')
    try {
      const res = await fetch('/api/atm/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode: session.classCode,
          studentId: session.studentId,
          itemId: item.id,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setShopMessage(`${data.emoji || '🎉'} ${data.item} 구매 완료! 남은 잔액: ${formatCurrency(data.balanceAfter)}`)
        setSession(prev => prev ? { ...prev, balance: data.balanceAfter } : prev)
        loadShopItems()
      } else {
        setShopMessage(data.error || '구매 실패')
      }
    } catch {
      setShopMessage('서버 오류')
    } finally {
      setPurchasingId(null)
    }
  }

  // 주식 목록 + 보유현황 로드
  const loadStocks = async () => {
    if (!session) return
    setStocksLoading(true)
    setStockMessage('')
    try {
      const res = await fetch(`/api/atm/stocks?classCode=${session.classCode}&studentId=${session.studentId}`)
      const data = await res.json()
      if (res.ok) {
        setStocks(data.stocks || [])
        setHoldings(data.holdings || [])
      }
    } catch { /* ignore */ } finally {
      setStocksLoading(false)
    }
  }

  // 주식 매수/매도 (1주)
  const handleTrade = async (stock: StockItem, action: 'buy' | 'sell') => {
    if (!session) return
    setTradingId(stock.id)
    setStockMessage('')
    try {
      const res = await fetch('/api/atm/stocks/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode: session.classCode,
          studentId: session.studentId,
          stockId: stock.id,
          stockName: stock.name,
          action,
          quantity: 1,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const actionText = action === 'buy' ? '매수' : '매도'
        setStockMessage(`${stock.emoji} ${stock.name} 1주 ${actionText} 완료! 잔액: ${formatCurrency(data.balanceAfter)}`)
        setSession(prev => prev ? { ...prev, balance: data.balanceAfter } : prev)
        loadStocks()
      } else {
        setStockMessage(data.error || '거래 실패')
      }
    } catch {
      setStockMessage('서버 오류')
    } finally {
      setTradingId(null)
    }
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
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              학생 QR 카드는 PIN 없이 바로 로그인되고, 이름 입력 로그인만 PIN 4자리를 사용합니다.
            </div>
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
  if (mode === 'scan_token' || mode === 'scan_student') {
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
            {isToken ? '🪙 토큰 QR 코드를 카메라에 비춰주세요' : '🪪 학생 QR 카드를 카메라에 비춰주세요'}
          </p>
          <p className="text-gray-400 text-sm">
            {isToken ? '실물 동전의 QR을 인식시키면 자동으로 충전됩니다' : '학생 QR을 인식하면 PIN 없이 바로 로그인됩니다'}
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
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 to-slate-900 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center space-y-1">
            <div className="text-6xl">🏧</div>
            <h1 className="text-3xl font-bold text-white">행복은행 ATM</h1>
            <p className="text-sm text-blue-300 font-mono">{savedClassCode}</p>
          </div>

          <button
            type="button"
            onClick={() => startCamera('student')}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-2xl transition-colors flex items-center justify-center gap-3 shadow-lg"
          >
            <span className="text-2xl">🪪</span>
            QR 카드 스캔으로 바로 로그인
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">또는 이름으로 직접 입력</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">이름</span>
              <input
                type="text"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="이름 입력"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">PIN 4자리</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '')
                  setPin(v)
                  if (v.length === 4) void handleLogin(undefined, v)
                }}
                placeholder="●●●●"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-3xl tracking-[0.5em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </label>

            {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}

            <button
              type="submit"
              disabled={loginLoading || !studentName || pin.length !== 4}
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

  // 상점 화면
  if (mode === 'shop') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-800 to-slate-900 flex flex-col items-center p-4">
        <div className="max-w-md w-full space-y-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMode('dashboard')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-lg transition-colors"
            >
              ← 돌아가기
            </button>
            <div className="text-right">
              <p className="text-sm text-emerald-300">{session?.studentName}</p>
              <p className="text-lg font-bold text-white">{session ? formatCurrency(session.balance) : '—'}</p>
            </div>
          </div>

          <div className="text-center">
            <div className="text-5xl mb-1">🛒</div>
            <h2 className="text-2xl font-bold text-white">상점</h2>
            <p className="text-sm text-emerald-200">사고 싶은 물건을 터치하세요!</p>
          </div>

          {/* 메시지 */}
          {shopMessage && (
            <div className={`rounded-2xl p-4 text-center text-white ${shopMessage.includes('완료') ? 'bg-green-500' : 'bg-red-500'}`}>
              <p className="text-lg font-bold">{shopMessage}</p>
            </div>
          )}

          {/* 아이템 목록 */}
          {shopLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
              <p className="text-white mt-2">불러오는 중...</p>
            </div>
          ) : shopItems.length === 0 ? (
            <div className="text-center py-8 text-white/60">
              <p className="text-4xl mb-2">📭</p>
              <p>등록된 상품이 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {shopItems.map(item => {
                const soldOut = item.stock != null && item.stock <= 0
                const tooExpensive = session ? item.price > session.balance : true
                return (
                  <button
                    key={item.id}
                    onClick={() => !soldOut && !tooExpensive && handlePurchase(item)}
                    disabled={purchasingId === item.id || soldOut || tooExpensive}
                    className={`flex flex-col items-center p-5 rounded-2xl text-center transition-all transform active:scale-95 ${
                      soldOut
                        ? 'bg-gray-700 opacity-50 cursor-not-allowed'
                        : tooExpensive
                        ? 'bg-white/5 border-2 border-red-400/30 opacity-70'
                        : 'bg-white/10 hover:bg-white/20 border-2 border-white/20 hover:border-emerald-400'
                    }`}
                  >
                    <span className="text-5xl mb-2">{item.emoji || '🎁'}</span>
                    <span className="text-white font-bold text-base">{item.name}</span>
                    <span className="text-emerald-300 font-bold text-lg mt-1">{formatCurrency(item.price)}</span>
                    {soldOut && <span className="text-red-400 text-xs mt-1">품절</span>}
                    {tooExpensive && !soldOut && <span className="text-red-300 text-xs mt-1">잔액 부족</span>}
                    {purchasingId === item.id && (
                      <div className="mt-1 animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // 주식 화면
  if (mode === 'stocks') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-slate-900 flex flex-col items-center p-4">
        <div className="max-w-md w-full space-y-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMode('dashboard')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-lg transition-colors"
            >
              ← 돌아가기
            </button>
            <div className="text-right">
              <p className="text-sm text-purple-300">{session?.studentName}</p>
              <p className="text-lg font-bold text-white">{session ? formatCurrency(session.balance) : '—'}</p>
            </div>
          </div>

          <div className="text-center">
            <div className="text-5xl mb-1">📈</div>
            <h2 className="text-2xl font-bold text-white">주식</h2>
            <p className="text-sm text-purple-200">1주씩 사고 팔 수 있어요!</p>
          </div>

          {/* 메시지 */}
          {stockMessage && (
            <div className={`rounded-2xl p-4 text-center text-white ${stockMessage.includes('완료') ? 'bg-green-500' : 'bg-red-500'}`}>
              <p className="text-lg font-bold">{stockMessage}</p>
            </div>
          )}

          {/* 주식 목록 */}
          {stocksLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
              <p className="text-white mt-2">불러오는 중...</p>
            </div>
          ) : stocks.length === 0 ? (
            <div className="text-center py-8 text-white/60">
              <p className="text-4xl mb-2">📭</p>
              <p>등록된 종목이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stocks.map(stock => {
                const holding = holdings.find(h => h.stock_name === stock.name)
                const qty = holding?.quantity || 0
                const canBuy = session ? stock.current_price <= session.balance : false
                return (
                  <div key={stock.id} className="bg-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{stock.emoji || '🎲'}</span>
                      <div className="flex-1">
                        <p className="text-white font-bold text-lg">{stock.name}</p>
                        <p className="text-purple-300 font-bold">{formatCurrency(stock.current_price)} / 주</p>
                      </div>
                      {qty > 0 && (
                        <div className="bg-purple-500/30 px-3 py-1 rounded-full">
                          <span className="text-white font-bold">{qty}주 보유</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTrade(stock, 'buy')}
                        disabled={tradingId === stock.id || !canBuy}
                        className="flex-1 py-3 bg-blue-500 hover:bg-blue-400 disabled:bg-gray-600 disabled:opacity-50 text-white font-bold text-lg rounded-xl transition-colors active:scale-95 transform"
                      >
                        {tradingId === stock.id ? '...' : '📥 1주 사기'}
                      </button>
                      <button
                        onClick={() => handleTrade(stock, 'sell')}
                        disabled={tradingId === stock.id || qty <= 0}
                        className="flex-1 py-3 bg-red-500 hover:bg-red-400 disabled:bg-gray-600 disabled:opacity-50 text-white font-bold text-lg rounded-xl transition-colors active:scale-95 transform"
                      >
                        {tradingId === stock.id ? '...' : '📤 1주 팔기'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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
          <p className="text-lg text-gray-500">환영합니다, <strong className="text-gray-900">{session?.studentName}</strong>님!</p>
          <p className="text-5xl font-bold text-blue-600">
            {session ? formatCurrency(session.balance) : '—'}
          </p>
          <p className="text-xs text-gray-400">행복은행 토큰 경제</p>
        </div>

        {/* 충전 결과 */}
        {redeemResult && (
          <div className="bg-green-500 rounded-2xl p-4 text-center text-white animate-bounce">
            <p className="text-3xl font-bold">🪙 +{formatCurrency(redeemResult.amount)} 충전!</p>
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
            <div className="inline-block animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
            <p className="text-white text-sm mt-2">충전 중...</p>
          </div>
        )}

        {/* 메인 액션 버튼들 (큰 터치 영역) */}
        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => { setScanError(''); setRedeemResult(null); startCamera('token') }}
            disabled={redeemLoading}
            className="w-full py-5 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-white text-xl font-bold rounded-2xl transition-all transform active:scale-95 flex items-center justify-center gap-3 shadow-lg"
          >
            <span className="text-3xl">🪙</span>
            토큰 충전하기
          </button>

          <button
            onClick={() => { loadShopItems(); setMode('shop') }}
            className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-white text-xl font-bold rounded-2xl transition-all transform active:scale-95 flex items-center justify-center gap-3 shadow-lg"
          >
            <span className="text-3xl">🛒</span>
            상점 가기
          </button>

          <button
            onClick={() => { loadStocks(); setMode('stocks') }}
            className="w-full py-5 bg-purple-500 hover:bg-purple-400 text-white text-xl font-bold rounded-2xl transition-all transform active:scale-95 flex items-center justify-center gap-3 shadow-lg"
          >
            <span className="text-3xl">📈</span>
            주식 투자
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
