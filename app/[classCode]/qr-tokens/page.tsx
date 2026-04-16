'use client'

import { useEffect, useState } from 'react'
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

/** QR 배치 생성 시 금액 빠른 선택 (낮은 단위부터) */
const PRESET_AMOUNTS = [10, 50, 100, 200, 500, 1000, 2000, 5000]
const PRINT_COLUMNS = 4
const PRINT_ROWS = 6
const TOKENS_PER_PRINT_PAGE = PRINT_COLUMNS * PRINT_ROWS

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

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
  const newTokenPages = chunkItems(newTokens, TOKENS_PER_PRINT_PAGE)
  const canPrintNewTokens = newTokens.length > 0 && newTokens.every(token => Boolean(qrDataUrls[token.id]))

  return (
    <>
      {/* 인쇄 전용 영역 */}
      <div className="hidden print:block">
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm;
            }

            html,
            body {
              background: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body * {
              visibility: hidden;
            }

            .token-print-root,
            .token-print-root * {
              visibility: visible;
            }

            .token-print-root {
              position: absolute;
              inset: 0;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }

            .token-print-sheet {
              break-after: page;
              page-break-after: always;
            }

            .token-print-sheet:last-child {
              break-after: auto;
              page-break-after: auto;
            }

            .token-print-grid {
              display: grid !important;
              grid-template-columns: repeat(4, 40mm);
              gap: 4mm;
              justify-content: center;
              align-content: start;
            }

            .token-print-sticker {
              width: 40mm;
              height: 40mm;
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        `}</style>
        <div className="token-print-root">
          {newTokenPages.map((page, pageIndex) => (
            <section key={`print-page-${pageIndex}`} className="token-print-sheet">
              <div className="token-print-grid">
                {page.map(token => (
                  <div
                    key={token.id}
                    className="token-print-sticker flex flex-col items-center justify-center rounded-full border-[1.2px] border-slate-300 bg-[#fffdf8] p-[2.8mm] text-center"
                  >
                    <p className="text-[8px] font-black uppercase tracking-[0.28em] text-slate-500">
                      QR TOKEN
                    </p>
                    {qrDataUrls[token.id] && (
                      <div className="mt-[1.2mm] rounded-[4mm] border border-slate-200 bg-white p-[1.4mm]">
                        <img
                          src={qrDataUrls[token.id]}
                          alt={token.code}
                          style={{ width: '22mm', height: '22mm', display: 'block' }}
                        />
                      </div>
                    )}
                    <div className="mt-[1.4mm] rounded-full bg-slate-900 px-[2.2mm] py-[0.7mm] text-[9px] font-black text-white">
                      {token.amount.toLocaleString()}원
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
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
            <span className="mb-2 block text-sm font-medium text-gray-700">금액 선택</span>
            <div className="grid max-w-2xl grid-cols-4 gap-2 sm:gap-3">
              {PRESET_AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    setAmount(String(a))
                    setLabel(`${a}원 토큰`)
                  }}
                  className={`rounded-xl border-2 px-2 py-2.5 text-sm font-bold transition-all sm:px-3 sm:py-3 ${
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
                disabled={!canPrintNewTokens}
                className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                🖨️ 인쇄 (40mm 원형)
              </button>
            </div>
            <p className="text-xs text-gray-500">
              💡 Windows 인쇄 기준으로 각 토큰이 지름 40mm 원형 스티커로 출력됩니다. QR은 원형 안쪽 중앙에 배치됩니다.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {newTokens.map(token => (
                <div
                  key={token.id}
                  className="flex aspect-square flex-col items-center justify-center rounded-full border-2 border-[#d7e2ef] bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#f8fbff_58%,_#e8f1fb_100%)] p-4 text-center"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
                    QR TOKEN
                  </p>
                  {qrDataUrls[token.id] ? (
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                      <img src={qrDataUrls[token.id]} alt={token.code} className="aspect-square w-full max-w-[116px]" />
                    </div>
                  ) : (
                    <div className="mt-2 flex aspect-square w-full max-w-[116px] items-center justify-center rounded-2xl bg-gray-200 text-xs text-gray-400">
                      생성중...
                    </div>
                  )}
                  <div className="mt-3 rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white">
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
