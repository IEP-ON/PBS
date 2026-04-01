'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import QRCode from 'qrcode'
import { formatCurrency } from '@/lib/utils'

interface StudentCard {
  id: string
  name: string
  grade: number | null
  qr_code: string
  pbs_accounts?: {
    balance?: number
  } | { balance?: number }[] | null
}

interface CardWithImage extends StudentCard {
  qrImage: string
  balance: number
}

function getAccountBalance(student: StudentCard) {
  const account = Array.isArray(student.pbs_accounts) ? student.pbs_accounts[0] : student.pbs_accounts
  return account?.balance || 0
}

function chunkCards<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
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
            balance: getAccountBalance(student),
            qrImage: await QRCode.toDataURL(student.qr_code, {
              width: 240,
              margin: 1,
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

  const cardPages = chunkCards(cards, 4)

  return (
    <div className="qr-print-page min-h-screen bg-[#f5f2ea] p-6 text-slate-900">
      <style jsx global>{`
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

          .qr-print-page,
          .qr-print-page * {
            visibility: visible;
          }

          .qr-print-page {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .print-sheet {
            break-after: page;
            page-break-after: always;
          }

          .print-sheet:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          .windows-card-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 6mm;
          }

          .windows-bankbook {
            display: block !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl space-y-6 print:max-w-none">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <Link href={`/${classCode}/students`} className="text-sm font-medium text-slate-500 hover:text-slate-700">
              ← 학생 관리로
            </Link>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">학생 QR 출력</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              전체 인쇄 시 먼저 <strong>ID 카드가 A4 1페이지당 4장</strong>씩 출력되고,
              그 다음에 <strong>통장 겉표지</strong>가 학생별로 한 장씩 이어집니다.
              통장 겉표지는 세로 A4에서 <strong>위에서 아래로 접으면</strong> A5 크기처럼 사용할 수 있게 구성했습니다.
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-black"
          >
            🖨️ 전체 인쇄
          </button>
        </div>

        <div className="rounded-[1.75rem] border-2 border-[#d8c59f] bg-[#fff8eb] px-6 py-5 text-sm text-[#5e4a25] shadow-sm print:hidden">
          <p className="font-bold">인쇄 안내</p>
          <p className="mt-2 leading-6">
            카드 페이지는 잘라서 바로 사용할 수 있고, 통장 페이지는 세로 A4 한 장을 중앙 가로선 기준으로 접으면 됩니다.
            Windows 인쇄 기준으로 색상과 선이 안정적으로 나오도록 단색 배경과 선 중심 레이아웃으로 구성했습니다.
          </p>
        </div>

        {loading && (
          <div className="rounded-3xl border border-white/80 bg-white p-10 text-center text-slate-500 shadow-sm">
            출력 세트를 준비하는 중...
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {cardPages.map((page, pageIndex) => (
              <section key={`card-page-${pageIndex}`} className="print-sheet space-y-4">
                <div className="rounded-[1.75rem] border border-[#d5e1ef] bg-white p-5 shadow-sm print:hidden">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-700">ID CARD PAGE {pageIndex + 1}</p>
                  <p className="mt-2 text-sm text-slate-600">A4 한 장에 학생 카드 4장이 배치됩니다.</p>
                </div>

                <div className="windows-card-grid grid gap-4 lg:grid-cols-2">
                  {page.map((student) => (
                    <article
                      key={student.id}
                      className="overflow-hidden rounded-[1.75rem] border-2 border-[#a7d7d5] bg-[#f8fffe] shadow-sm"
                    >
                      <div className="border-b border-[#cfe9e7] bg-[#cfeee9] px-5 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#255f59]">STUDENT ID</p>
                            <h3 className="mt-2 text-3xl font-black tracking-tight text-[#17322f]">{student.name}</h3>
                            <p className="mt-1 text-sm text-[#476965]">
                              {student.grade ? `${student.grade}학년` : '학년 미입력'} · {classCode}
                            </p>
                          </div>
                          <div className="rounded-full border-2 border-white bg-[#fff7d6] px-4 py-2 text-sm font-black text-[#7a5b16]">
                            학생카드
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-[1.2fr_0.8fr] gap-4 p-5">
                        <div className="rounded-[1.25rem] border border-dashed border-[#bddad7] bg-white px-4 py-4">
                          <p className="text-xs font-bold text-[#2d5a56]">사용처</p>
                          <div className="mt-3 space-y-2 text-sm text-slate-700">
                            <p>🏧 ATM 로그인</p>
                            <p>🎙️ 말 일기장 기록</p>
                            <p>🧒 학생 식별 카드</p>
                          </div>

                          <div className="mt-4 rounded-xl bg-[#eef8f6] px-4 py-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6d8a87]">현재 잔액</p>
                            <p className="mt-1 text-2xl font-black text-[#17322f]">{formatCurrency(student.balance)}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-center justify-between rounded-[1.25rem] border border-[#d4e3e1] bg-white p-3">
                          <img src={student.qrImage} alt={`${student.name} ID 카드 QR`} className="h-32 w-32" />
                          <div className="mt-3 w-full rounded-xl bg-[#f3f7f7] px-3 py-2 text-center">
                            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">QR</p>
                            <p className="mt-1 break-all text-[11px] font-mono text-slate-600">{student.qr_code}</p>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}

            {cards.map((student) => (
              <section key={`bankbook-${student.id}`} className="print-sheet windows-bankbook space-y-4">
                <div className="rounded-[1.75rem] border border-[#e2d8c5] bg-white p-5 shadow-sm print:hidden">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-[#8b6c31]">BANKBOOK COVER</p>
                  <p className="mt-2 text-sm text-slate-600">{student.name} 통장 겉표지 · 세로 A4에서 위쪽을 아래로 접기</p>
                </div>

                <article className="overflow-hidden rounded-[1.75rem] border-2 border-[#d2c2a9] bg-[#fffdf8] shadow-sm">
                  <div className="grid min-h-[278mm] grid-rows-2">
                    <div className="relative border-b-2 border-dashed border-[#ccb793] bg-[#f8f1e6] p-8">
                      <div className="absolute right-6 top-5 rounded-full border border-[#d4c3a8] bg-white px-4 py-1 text-[11px] font-bold text-[#7a6541]">
                        접은 뒤 뒷면
                      </div>
                      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#8a734b]">PBS BANKBOOK BACK</p>
                      <h3 className="mt-5 text-3xl font-black tracking-tight text-[#2f2413]">나의 성장 포트폴리오</h3>
                      <p className="mt-4 max-w-xl text-sm leading-7 text-[#715f46]">
                        이 통장은 ATM 사용, 말 일기장 기록, PBS 보상 흐름을 학생과 함께 차근차근 모아가는 개인 포트폴리오입니다.
                        필요할 때 속지를 추가해 거래내역이나 성장 기록을 함께 묶어 보관할 수 있습니다.
                      </p>

                      <div className="mt-8 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-[1.2rem] border border-[#dacbb2] bg-white px-5 py-4">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-[#9f8a6b]">학급코드</p>
                          <p className="mt-2 text-2xl font-black text-[#2f2413]">{classCode}</p>
                        </div>
                        <div className="rounded-[1.2rem] border border-[#dacbb2] bg-white px-5 py-4">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-[#9f8a6b]">학생 서명</p>
                          <div className="mt-6 h-px bg-[#ccb893]" />
                        </div>
                      </div>
                    </div>

                    <div className="relative bg-[#fffaf1] p-8">
                      <div className="absolute right-6 top-5 rounded-full border border-[#cfc9b5] bg-[#eef7f2] px-4 py-1 text-[11px] font-bold text-[#41635e]">
                        접은 뒤 앞표지
                      </div>
                      <p className="text-[11px] font-black uppercase tracking-[0.34em] text-[#8a734b]">PBS BANKBOOK FRONT</p>

                      <div className="mt-6 flex items-start justify-between gap-6">
                        <div>
                          <h3 className="text-4xl font-black tracking-tight text-[#2f2413]">{student.name}</h3>
                          <p className="mt-2 text-base text-[#78664d]">
                            {student.grade ? `${student.grade}학년 · ` : ''}{classCode}
                          </p>
                          <div className="mt-8 rounded-[1.3rem] border border-[#d9cfbc] bg-white px-5 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a896c]">현재 잔액</p>
                            <p className="mt-2 text-3xl font-black text-[#2f2413]">{formatCurrency(student.balance)}</p>
                          </div>
                        </div>

                        <div className="rounded-[1.4rem] border border-[#d9cfbc] bg-white p-4">
                          <img src={student.qrImage} alt={`${student.name} 통장 QR`} className="h-36 w-36" />
                        </div>
                      </div>

                      <div className="mt-8 rounded-[1.2rem] border border-dashed border-[#d8ccb8] bg-white px-5 py-4">
                        <p className="text-sm font-bold text-[#6b5738]">사용 안내</p>
                        <p className="mt-2 text-sm leading-7 text-[#7b6a52]">
                          ATM 로그인, 말 일기장 기록, 학생 식별은 모두 이 표준 QR 카드 한 장으로 연결됩니다.
                        </p>
                        <p className="mt-3 break-all text-xs font-mono text-[#7b6a52]">{student.qr_code}</p>
                      </div>
                    </div>
                  </div>
                </article>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
