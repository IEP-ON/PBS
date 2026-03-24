'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

interface QrToken {
  id: string
  code: string
  amount: number
  label: string | null
  is_used: boolean
  used_by: string | null
  used_at: string | null
  created_at: string
  pbs_students?: { name: string } | null
}

const PRESET_AMOUNTS = [100, 200, 500, 1000, 2000, 5000]

export default function QrTokensPage() {
  const [tokens, setTokens] = useState<QrToken[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('500')
  const [count, setCount] = useState('10')
  const [label, setLabel] = useState('')
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [newTokens, setNewTokens] = useState<QrToken[]>([])
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({})
  const printRef = useRef<HTMLDivElement>(null)

  const fetchTokens = async () => {
    const res = await fetch('/api/qr-tokens')
    const data = await res.json()
    setTokens(data.tokens || [])
    setLoading(false)
  }

  useEffect(() => { fetchTokens() }, [])

  // QR 이미지 생성
  const generateQrImages = async (tokenList: QrToken[]) => {
    const urls: Record<string, string> = {}
    for (const t of tokenList) {
      urls[t.id] = await QRCode.toDataURL(t.code, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      })
    }
    setQrDataUrls(prev => ({ ...prev, ...urls }))
  }

  const handleGenerate = async () => {
    if (!amount || !count) return
    setGenerating(true)
    setMessage('')
    try {
      const res = await fetch('/api/qr-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          count: Number(count),
          label: label || `${amount}원 토큰`,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`✅ ${data.count}개 토큰이 생성되었습니다.`)
        setNewTokens(data.tokens)
        await generateQrImages(data.tokens)
        fetchTokens()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } finally {
      setGenerating(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const usedCount = tokens.filter(t => t.is_used).length
  const unusedCount = tokens.filter(t => !t.is_used).length

  return (
    <>
      {/* 인쇄 전용 영역 */}
      <div ref={printRef} className="hidden print:block">
        <style>{`
          @media print {
            @page { margin: 10mm; size: A4; }
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { position: fixed; top: 0; left: 0; }
          }
        `}</style>
        <div className="print-area">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3mm', padding: '5mm' }}>
            {newTokens.map(token => (
              <div
                key={token.id}
                style={{
                  width: '25mm',
                  border: '0.5px solid #ccc',
                  padding: '1mm',
                  textAlign: 'center',
                  pageBreakInside: 'avoid',
                  borderRadius: '2mm',
                }}
              >
                {qrDataUrls[token.id] && (
                  <img
                    src={qrDataUrls[token.id]}
                    alt={token.code}
                    style={{ width: '23mm', height: '23mm', display: 'block' }}
                  />
                )}
                <div style={{ fontSize: '7pt', fontWeight: 'bold', marginTop: '0.5mm' }}>
                  {token.amount.toLocaleString()}원
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 화면 UI */}
      <div className="p-6 space-y-6 print:hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">🪙 QR 토큰 관리</h1>
          <div className="flex gap-3 text-sm">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
              미사용 {unusedCount}개
            </span>
            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
              사용됨 {usedCount}개
            </span>
          </div>
        </div>

        {message && (
          <div className={`px-4 py-3 rounded-xl text-sm font-medium ${message.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}

        {/* 토큰 생성 폼 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="font-bold text-gray-900">새 토큰 배치 생성</h2>

          <div>
            <span className="text-sm font-medium text-gray-700 block mb-2">금액 선택</span>
            <div className="flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map(a => (
                <button
                  key={a}
                  onClick={() => { setAmount(String(a)); setLabel(`${a}원 토큰`) }}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                    amount === String(a)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-blue-300'
                  }`}
                >
                  {a.toLocaleString()}원
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">금액 (원) *</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min={1}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">개수 (최대 200) *</span>
              <input
                type="number"
                value={count}
                onChange={e => setCount(e.target.value)}
                min={1}
                max={200}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">라벨 (선택)</span>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="500원 토큰"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !amount || !count}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
          >
            {generating ? '생성 중...' : `🪙 ${count}개 QR 토큰 생성`}
          </button>
        </div>

        {/* 생성된 토큰 미리보기 + 인쇄 */}
        {newTokens.length > 0 && (
          <div className="bg-white rounded-2xl border border-blue-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">
                방금 생성된 토큰 ({newTokens.length}개)
              </h2>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-xl transition-colors"
              >
                🖨️ 인쇄 (25mm 격자)
              </button>
            </div>
            <p className="text-xs text-gray-500">
              💡 인쇄 후 실물 코인에 스티커로 부착하세요. 각 QR은 25mm × 25mm 크기로 출력됩니다.
            </p>
            <div className="grid grid-cols-6 gap-3">
              {newTokens.map(token => (
                <div key={token.id} className="border border-gray-200 rounded-xl p-2 text-center bg-gray-50">
                  {qrDataUrls[token.id] ? (
                    <img src={qrDataUrls[token.id]} alt={token.code} className="w-full aspect-square" />
                  ) : (
                    <div className="w-full aspect-square bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400">
                      생성중...
                    </div>
                  )}
                  <div className="text-xs font-bold text-gray-700 mt-1">
                    {token.amount.toLocaleString()}원
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 발급 내역 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 mb-4">전체 발급 내역</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : tokens.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">생성된 토큰이 없습니다.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tokens.map(token => (
                <div
                  key={token.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm ${
                    token.is_used
                      ? 'bg-gray-50 border-gray-100 text-gray-400'
                      : 'bg-green-50 border-green-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${token.is_used ? 'bg-gray-300' : 'bg-green-500'}`} />
                    <span className="font-mono text-xs text-gray-500">
                      {token.code.slice(3, 11)}…
                    </span>
                    <span className="font-bold text-gray-700">
                      {token.amount.toLocaleString()}원
                    </span>
                    <span className="text-gray-500">{token.label}</span>
                  </div>
                  <div className="text-right">
                    {token.is_used ? (
                      <span className="text-xs text-gray-400">
                        {token.pbs_students?.name || '—'} 사용 ·{' '}
                        {token.used_at ? new Date(token.used_at).toLocaleDateString('ko-KR') : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-green-600 font-medium">미사용</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
