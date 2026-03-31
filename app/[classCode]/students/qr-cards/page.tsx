'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import QRCode from 'qrcode'

interface StudentCard {
  id: string
  name: string
  grade: number | null
  qr_code: string
}

interface CardWithImage extends StudentCard {
  qrImage: string
}

export default function StudentQrCardsPage() {
  const params = useParams()
  const classCode = params.classCode as string

  const [cards, setCards] = useState<CardWithImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadCards = async () => {
      try {
        const res = await fetch('/api/students')
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || '학생 목록을 불러오지 못했습니다.')
          setLoading(false)
          return
        }

        const students = (data.students || []) as StudentCard[]
        const imageEntries = await Promise.all(
          students.map(async (student) => ({
            ...student,
            qrImage: await QRCode.toDataURL(student.qr_code, {
              width: 220,
              margin: 2,
              errorCorrectionLevel: 'M',
              color: { dark: '#111827', light: '#ffffff' },
            }),
          }))
        )

        setCards(imageEntries)
      } catch {
        setError('QR 카드 준비 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    void loadCards()
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <Link href={`/${classCode}/students`} className="text-sm font-medium text-slate-500 hover:text-slate-700">
            ← 학생 관리로
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">QR 카드 일괄 출력</h1>
          <p className="mt-2 text-sm text-gray-600">
            기존 학생도 DB에는 이미 표준 QR이 저장되어 있습니다. 아래 카드를 다시 출력해서 예전 카드 대신 사용하세요.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-black"
        >
          🖨️ 전체 인쇄
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 print:hidden">
        표준 QR 형식은 <span className="font-mono font-bold">QR-...</span> 하나만 사용합니다.
        예전 <span className="font-mono font-bold">PB:</span> 카드와 tool5 전용 카드는 폐기해주세요.
      </div>

      {loading && (
        <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-500">
          QR 카드를 준비하는 중...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-600">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-2">
          {cards.map((student) => (
            <div
              key={student.id}
              className="break-inside-avoid rounded-[1.75rem] border border-gray-200 bg-white p-6 text-center shadow-sm print:rounded-none print:border print:shadow-none"
            >
              <p className="text-xs text-gray-400">PBS 표준 QR 카드</p>
              <h2 className="mt-3 text-2xl font-bold text-gray-900">{student.name}</h2>
              {student.grade && <p className="mt-1 text-sm text-gray-500">{student.grade}학년</p>}

              <div className="mx-auto mt-5 inline-flex rounded-[1.5rem] border-2 border-gray-200 bg-white p-3">
                <img src={student.qrImage} alt={`${student.name} QR 카드`} className="h-44 w-44" />
              </div>

              <p className="mt-4 text-xs font-mono text-gray-500">{student.qr_code}</p>
              <p className="mt-2 text-xs text-gray-400">ATM · 말 일기장 공용</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
