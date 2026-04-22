'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type AnalyticsResponse = {
  totalDiaries: number
  studentCount: number
  classAvgLength: number
  classAvgTTR: number
  classAvgRawCorrectedJaccard: number
  classAvgRewriteIntensity: number
  topKeywords: { keyword: string; count: number }[]
  weekly: { week: string; count: number }[]
  byStudent: {
    studentId: string
    name: string
    count: number
    avgLength: number
    avgTTR: number
    avgRawCorrectedJaccard: number
    avgRewriteIntensity: number
    sentiment: { positive: number; neutral: number; negative: number; null: number }
    activeDays: number
  }[]
  error?: string
}

export default function SpeechDiaryAnalyticsPage() {
  const params = useParams()
  const classCode = params.classCode as string
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/speech-diary/analytics', { cache: 'no-store' })
        const json = (await res.json()) as AnalyticsResponse & { error?: string }
        if (!res.ok) {
          setMessage(json.error || '분석을 불러오지 못했습니다.')
          setData(null)
        } else {
          setData(json)
        }
      } catch {
        setMessage('네트워크 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="tablet-page space-y-6 bg-slate-50">
      <div className="flex flex-col gap-4 rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-bold text-sky-700">말 일기장</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">분석 · 요약</h1>
          <p className="mt-1 text-base text-slate-600">
            참여 빈도, 문장 길이, 어휘 다양성(TTR), 위스퍼 전사와 보정문 유사도(자카드)를 학급·학생별로 봅니다.
          </p>
        </div>
        <Link
          href={`/${classCode}/speech-diary`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-100"
        >
          일기 목록으로
        </Link>
      </div>

      {message ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">불러오는 중…</div>
      ) : !data ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">총 일기</p>
              <p className="mt-1 text-3xl font-black text-slate-900">{data.totalDiaries}</p>
              <p className="text-sm text-slate-600">학생 {data.studentCount}명 기준</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">학급 평균 길이</p>
              <p className="mt-1 text-3xl font-black text-slate-900">{data.classAvgLength}자</p>
              <p className="text-sm text-slate-600">보정문 기준</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">학급 평균 TTR</p>
              <p className="mt-1 text-3xl font-black text-slate-900">{data.classAvgTTR}</p>
              <p className="text-sm text-slate-600">어절 다양성</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">전사→보정 유사도</p>
              <p className="mt-1 text-3xl font-black text-slate-900">{data.classAvgRawCorrectedJaccard}</p>
              <p className="text-sm text-slate-600">1에 가까울수록 덜 고침 · 보정 강도 {data.classAvgRewriteIntensity}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-extrabold text-slate-900">주차별 작성 수</h2>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
                {data.weekly.map((w) => (
                  <li key={w.week} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="font-mono text-slate-700">{w.week}</span>
                    <span className="font-bold text-slate-900">{w.count}건</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-extrabold text-slate-900">키워드 Top 20</h2>
              <ol className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
                {data.topKeywords.map((k, i) => (
                  <li key={k.keyword} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-700">
                      {i + 1}. {k.keyword}
                    </span>
                    <span className="font-bold text-slate-900">{k.count}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-900">학생별 요약</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="pb-2 pr-3">학생</th>
                    <th className="pb-2 pr-3">건수</th>
                    <th className="pb-2 pr-3">활동일</th>
                    <th className="pb-2 pr-3">평균 길이</th>
                    <th className="pb-2 pr-3">TTR</th>
                    <th className="pb-2 pr-3">전사·보정 유사도</th>
                    <th className="pb-2 pr-3">긍정</th>
                    <th className="pb-2">부정</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byStudent.map((s) => (
                    <tr key={s.studentId} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-semibold text-slate-900">{s.name}</td>
                      <td className="py-2 pr-3">{s.count}</td>
                      <td className="py-2 pr-3">{s.activeDays}일</td>
                      <td className="py-2 pr-3">{s.avgLength}자</td>
                      <td className="py-2 pr-3">{s.avgTTR}</td>
                      <td className="py-2 pr-3">{s.avgRawCorrectedJaccard}</td>
                      <td className="py-2 pr-3 text-emerald-700">{s.sentiment.positive}</td>
                      <td className="py-2 text-rose-700">{s.sentiment.negative}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
