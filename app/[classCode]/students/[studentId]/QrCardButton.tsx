'use client'

import { useState } from 'react'
import QRCode from 'qrcode'

interface Props {
  studentId: string
}

interface QrData {
  student: { name: string; grade: number | null; qrCode: string }
  classroom: { code: string; className: string; schoolName: string }
}

export default function QrCardButton({ studentId }: Props) {
  const [showCard, setShowCard] = useState(false)
  const [data, setData] = useState<QrData | null>(null)
  const [loading, setLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  const handleOpen = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/students/${studentId}/qr`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
        // QR 이미지 생성
        const url = await QRCode.toDataURL(json.student.qrCode, {
          width: 240,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#1a1a1a', light: '#ffffff' },
        })
        setQrDataUrl(url)
        setShowCard(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => window.print()

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={loading}
        className="px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white text-sm font-medium rounded-xl transition-colors"
      >
        {loading ? '로딩...' : '🪪 QR 카드'}
      </button>

      {showCard && data && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl">
            <div id="qr-print-area" className="p-6 text-center space-y-3">
              <p className="text-xs text-gray-400">
                {data.classroom.schoolName} · {data.classroom.className}
              </p>
              <p className="text-xs font-mono text-gray-400">학급코드: {data.classroom.code}</p>
              <div className="border-t border-gray-100 pt-3">
                <h2 className="text-2xl font-bold text-gray-900">{data.student.name}</h2>
                {data.student.grade && (
                  <p className="text-sm text-gray-500">{data.student.grade}학년</p>
                )}
              </div>
              {qrDataUrl ? (
                <div className="mx-auto w-fit p-3 bg-white border-2 border-gray-200 rounded-2xl inline-block">
                  <img
                    src={qrDataUrl}
                    alt="통장 QR"
                    className="w-40 h-40"
                  />
                </div>
              ) : (
                <div className="w-40 h-40 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center">
                  <div className="animate-spin w-6 h-6 border-4 border-gray-400 border-t-transparent rounded-full" />
                </div>
              )}
              <p className="text-xs text-gray-400">🪪 ATM에서 이 QR 카드를 스캔하세요</p>
            </div>

            <div className="flex gap-3 p-4 border-t border-gray-100">
              <button
                onClick={() => setShowCard(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >
                닫기
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-900 text-white font-semibold rounded-xl transition-colors"
              >
                🖨️ 인쇄
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 인쇄 전용: QR 통장 카드만 출력 */}
      {showCard && data && qrDataUrl && (
        <div className="hidden print:flex flex-col items-center justify-center p-8 text-center space-y-3">
          <p className="text-xs text-gray-400">{data.classroom.schoolName} · {data.classroom.className}</p>
          <h2 className="text-2xl font-bold text-gray-900">{data.student.name}</h2>
          {data.student.grade && <p className="text-sm text-gray-500">{data.student.grade}학년</p>}
          <img src={qrDataUrl} alt="통장 QR" style={{ width: '160px', height: '160px' }} />
          <p className="text-xs text-gray-500">학급코드: {data.classroom.code}</p>
          <p className="text-xs text-gray-400">📔 ATM에서 스캔하세요</p>
        </div>
      )}

    </>
  )
}
