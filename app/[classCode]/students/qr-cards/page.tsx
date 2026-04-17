'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import QRCode from 'qrcode'
import { formatCurrency, normalizeClassCode } from '@/lib/utils'

interface StudentCard {
  id: string
  name: string
  grade: number | null
  qr_code: string
  pbs_accounts?: { balance?: number } | { balance?: number }[] | null
}

interface CardWithImage extends StudentCard {
  qrImage: string
  balance: number
}

interface ClassroomMeta {
  className: string | null
  schoolName: string | null
  academicYear: number | null
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

function gradeClassLine(grade: number | null, className: string | null, classCode: string) {
  const g = grade != null ? `${grade}학년` : '학년 미입력'
  if (className?.trim()) {
    const c = className.trim()
    const hasBan = /반\s*$/.test(c)
    return `학년 / 반 : ${g} ${hasBan ? c : `${c}반`}`
  }
  return `학년 / 반 : ${g} · 학급 ${classCode}`
}

function issuerLine(schoolName: string | null) {
  if (!schoolName?.trim()) return '발행처 : 담임교사'
  const s = schoolName.trim()
  if (s.endsWith('학교')) return `발행처 : ${s}장`
  return `발행처 : ${s} 교장`
}

function validityLine(academicYear: number | null) {
  const y = academicYear ?? new Date().getFullYear()
  return `유효기간 : ${y}학년도`
}

/** 책 위 나무 — 인쇄 시 벡터로 선명하게 유지 */
function TreeBookMotif({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 88" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M24 62h72c2 0 4 2 4 4v6H20v-6c0-2 2-4 4-4z"
        fill="#c8e6f5"
        stroke="#7eb8d8"
        strokeWidth="1.5"
      />
      <path d="M28 62V52h64v10" fill="#e8f4fc" stroke="#7eb8d8" strokeWidth="1.2" />
      <line x1="60" y1="52" x2="60" y2="62" stroke="#7eb8d8" strokeWidth="1" />
      <ellipse cx="60" cy="34" rx="22" ry="20" fill="#6bbf6b" stroke="#3d8f3d" strokeWidth="1.2" />
      <ellipse cx="48" cy="40" rx="12" ry="14" fill="#7dcc7d" stroke="#3d8f3d" strokeWidth="1" />
      <ellipse cx="72" cy="40" rx="12" ry="14" fill="#7dcc7d" stroke="#3d8f3d" strokeWidth="1" />
      <circle cx="60" cy="28" r="6" fill="#ffd54f" stroke="#e6a800" strokeWidth="0.8" />
      <path d="M58 52h4v10h-4z" fill="#8d6e63" />
    </svg>
  )
}

function StudentIdFaceCard({
  student,
  rosterNumber,
  classMeta,
  classCode,
}: {
  student: CardWithImage
  rosterNumber: number
  classMeta: ClassroomMeta
  classCode: string
}) {
  return (
    <article className="id-face-card">
      <div className="id-face-card__frame">
        <div className="id-face-card__inner">
          <div className="id-face-card__top">
            <TreeBookMotif className="id-face-card__motif" />
            <p className="id-face-card__line id-face-card__line--strong">
              {gradeClassLine(student.grade, classMeta.className, classCode)}
            </p>
            <p className="id-face-card__line id-face-card__line--strong">번 호 : {rosterNumber}번</p>
            <p className="id-face-card__name">{student.name}</p>
          </div>

          <div className="id-face-card__qr-block">
            <div className="id-face-card__qr-frame">
              <img
                src={student.qrImage}
                alt=""
                width={512}
                height={512}
                className="id-face-card__qr-img"
              />
            </div>
            <p className="id-face-card__qr-hint">자세한 정보는 QR 코드를 스캔하세요.</p>
            <p className="id-face-card__qr-hint id-face-card__qr-hint--en">Scan for detailed info</p>
          </div>

          <footer className="id-face-card__footer">
            <p className="id-face-card__footer-line">{issuerLine(classMeta.schoolName)}</p>
            <p className="id-face-card__footer-line">{validityLine(classMeta.academicYear)}</p>
          </footer>
        </div>
      </div>
    </article>
  )
}

export default function StudentQrCardsPage() {
  const params = useParams()
  const classCode = params.classCode as string

  const [cards, setCards] = useState<CardWithImage[]>([])
  const [classMeta, setClassMeta] = useState<ClassroomMeta>({
    className: null,
    schoolName: null,
    academicYear: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const normalizedClassCode = normalizeClassCode(classCode)
        const [studentsRes, classRes] = await Promise.all([
          fetch('/api/students'),
          fetch(`/api/classroom/${encodeURIComponent(normalizedClassCode)}`),
        ])

        const classJson = classRes.ok ? await classRes.json() : {}
        if (classRes.ok && !classJson.error) {
          setClassMeta({
            className: classJson.className ?? null,
            schoolName: classJson.schoolName ?? null,
            academicYear: typeof classJson.academicYear === 'number' ? classJson.academicYear : null,
          })
        }

        const data = await studentsRes.json()
        if (!studentsRes.ok) {
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
              width: 512,
              margin: 1,
              errorCorrectionLevel: 'H',
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

    void load()
  }, [classCode])

  const cardPages = chunkCards(cards, 4)

  return (
    <div className="qr-print-page min-h-screen bg-[#eef6fc] p-6 text-slate-900">
      <style jsx global>{`
        .id-face-card {
          font-family:
            'Malgun Gothic',
            'Apple SD Gothic Neo',
            'Noto Sans KR',
            system-ui,
            sans-serif;
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .id-face-card__frame {
          flex: 1;
          min-height: 0;
          border-radius: 14px;
          padding: 7px;
          background: linear-gradient(
            125deg,
            #7ec8e3 0%,
            #ffe566 18%,
            #ffb3c6 40%,
            #98d9a0 62%,
            #ffb366 82%,
            #9fd4ff 100%
          );
          box-sizing: border-box;
        }

        .id-face-card__inner {
          background: #fff;
          border-radius: 10px;
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          overflow: hidden;
        }

        .id-face-card__top {
          text-align: center;
          padding: 6px 10px 4px;
          flex-shrink: 0;
        }

        .id-face-card__motif {
          width: clamp(72px, 22vw, 108px);
          height: auto;
          margin: 0 auto 2px;
        }

        .id-face-card__line {
          margin: 0;
          font-size: clamp(11px, 2.6vw, 13px);
          font-weight: 800;
          color: #111827;
          line-height: 1.35;
        }

        .id-face-card__name {
          margin: 4px 0 0;
          font-size: clamp(13px, 3.2vw, 16px);
          font-weight: 900;
          color: #0f172a;
        }

        .id-face-card__qr-block {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4px 10px 6px;
        }

        /* 고정 정사각형 — 가로·세로 비율 강제로 QR 왜곡 방지 */
        .id-face-card__qr-frame {
          width: clamp(104px, 30vw, 132px);
          height: clamp(104px, 30vw, 132px);
          max-width: 38mm;
          max-height: 38mm;
          aspect-ratio: 1 / 1;
          flex-shrink: 0;
          box-sizing: border-box;
          border: 2px solid #9fd4f0;
          border-radius: 6px;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 5px;
        }

        .id-face-card__qr-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .id-face-card__qr-hint {
          margin: 6px 0 0;
          font-size: clamp(9px, 2.1vw, 11px);
          font-weight: 700;
          color: #1e293b;
          text-align: center;
          line-height: 1.3;
        }

        .id-face-card__qr-hint--en {
          font-weight: 600;
          color: #475569;
          margin-top: 2px;
        }

        .id-face-card__footer {
          flex-shrink: 0;
          background: #bfe4f7;
          padding: 8px 10px 9px;
          text-align: center;
        }

        .id-face-card__footer-line {
          margin: 0;
          font-size: clamp(10px, 2.4vw, 12px);
          font-weight: 800;
          color: #0f172a;
          line-height: 1.45;
        }

        .id-print-sheet {
          width: 100%;
          max-width: 920px;
          margin: 0 auto;
        }

        /* 행을 항상 2줄로 고정 — 마지막 페이지에 1~3명만 있어도 카드 높이가 4명일 때와 동일 */
        .id-print-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 12px;
          width: 100%;
          max-width: 920px;
          margin-inline: auto;
          aspect-ratio: 200 / 287;
          min-height: 0;
        }

        .id-print-grid__cell {
          min-height: 0;
          min-width: 0;
          height: 100%;
          overflow: hidden;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
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
            min-height: 0 !important;
          }

          .id-print-sheet {
            width: 210mm !important;
            max-width: none !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 5mm !important;
            box-sizing: border-box !important;
            break-after: page;
            page-break-after: always;
          }

          .id-print-grid {
            width: 100%;
            height: calc(297mm - 10mm);
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 1fr 1fr;
            gap: 4mm !important;
            min-height: 0 !important;
            aspect-ratio: auto;
            max-width: none;
          }

          .id-print-grid__cell {
            min-height: 0 !important;
            height: 100%;
            max-height: 100%;
            overflow: hidden;
          }

          .id-face-card__motif {
            width: 92px;
            max-width: none;
          }

          .id-face-card__line {
            font-size: 11.5pt;
          }

          .id-face-card__name {
            font-size: 13pt;
          }

          .id-face-card__qr-frame {
            width: 36mm;
            height: 36mm;
            max-width: none;
            max-height: none;
          }

          .id-face-card__qr-hint {
            font-size: 9pt;
          }

          .id-face-card__footer-line {
            font-size: 10pt;
          }

          .windows-bankbook {
            display: block !important;
          }

          .print-sheet {
            break-after: page;
            page-break-after: always;
          }

          .print-sheet:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          .bankbook-qr-box img {
            width: 36mm;
            height: 36mm;
            object-fit: contain;
            display: block;
          }
        }

        .bankbook-qr-box img {
          width: 9rem;
          height: 9rem;
          object-fit: contain;
          display: block;
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
              <strong>학생증(ID) 카드</strong>는 예시와 같은 세로형 레이아웃이며, Windows 인쇄 시{' '}
              <strong>A4 한 장에 카드 4장(2×2)</strong>이 맞물리도록 mm 단위 그리드로 맞춰 두었습니다. QR은 정사각형
              프레임 안에 <strong>비율 고정·고해상도(512px) 생성</strong>으로 인쇄 시 늘어남을 막았습니다. 이어서{' '}
              <strong>통장 겉표지</strong>가 학생별로 출력됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-black"
          >
            🖨️ 전체 인쇄
          </button>
        </div>

        <div className="rounded-[1.75rem] border border-sky-200 bg-white px-6 py-5 text-sm text-slate-700 shadow-sm print:hidden">
          <p className="font-bold text-slate-900">인쇄 안내</p>
          <p className="mt-2 leading-6">
            브라우저 인쇄 대화상자에서 <strong>용지 크기 A4</strong>, <strong>여백 없음/최소</strong>에 가깝게 맞추면
            Windows에서도 격자가 안정적으로 맞습니다. 발행처·유효기간은 학급 정보(학교명·학년도)를 사용합니다.
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
              <section key={`card-page-${pageIndex}`} className="id-print-sheet space-y-4 print:space-y-0">
                <div className="rounded-[1.75rem] border border-sky-200 bg-white p-5 shadow-sm print:hidden">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-700">ID CARD · PAGE {pageIndex + 1}</p>
                  <p className="mt-2 text-sm text-slate-600">A4 1페이지당 학생증 4장(2×2)입니다.</p>
                </div>

                <div className="id-print-grid">
                  {page.map((student, i) => {
                    const globalIndex = pageIndex * 4 + i + 1
                    return (
                      <div key={student.id} className="id-print-grid__cell">
                        <StudentIdFaceCard
                          student={student}
                          rosterNumber={globalIndex}
                          classMeta={classMeta}
                          classCode={classCode}
                        />
                      </div>
                    )
                  })}
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
                            {student.grade ? `${student.grade}학년 · ` : ''}
                            {classCode}
                          </p>
                          <div className="mt-8 rounded-[1.3rem] border border-[#d9cfbc] bg-white px-5 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a896c]">현재 잔액</p>
                            <p className="mt-2 text-3xl font-black text-[#2f2413]">{formatCurrency(student.balance)}</p>
                          </div>
                        </div>

                        <div className="bankbook-qr-box flex-shrink-0 rounded-[1.4rem] border border-[#d9cfbc] bg-white p-4">
                          <img src={student.qrImage} alt={`${student.name} 통장 QR`} width={512} height={512} />
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
