'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ResultState {
  diaryId: string
  studentName: string
  correctedText: string
}

export default function DiaryResultPage() {
  const router = useRouter()
  const [result] = useState<ResultState | null>(() => {
    if (typeof window === 'undefined') return null

    try {
      const raw = sessionStorage.getItem('speech-diary-result')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      sessionStorage.removeItem('speech-diary-result')
      router.push('/diary-kiosk')
    }, 10000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_#fff7d6_0%,_#d1fae5_28%,_#e0f2fe_64%,_#f8fafc_100%)] px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-5xl flex-col items-center justify-center gap-8 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
        <div className="flex h-32 w-32 items-center justify-center rounded-full bg-emerald-100 text-7xl shadow-inner ring-8 ring-white/80">
          ✅
        </div>

        <div className="w-full text-center lg:text-left">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-600/70">Saved</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">참 잘했어요!</h1>
          <p className="mt-3 text-lg text-slate-600">{result?.studentName || '학생'}의 말 일기가 저장되었어요.</p>

          <div className="mt-6 w-full rounded-[2rem] border border-white/80 bg-white/90 p-6 text-center shadow-[0_24px_80px_rgba(15,23,42,0.14)] lg:text-left">
            <p className="text-sm font-bold text-slate-500">정리된 문장</p>
            <p className="mt-4 whitespace-pre-wrap text-2xl font-black leading-relaxed text-slate-900">
              {result?.correctedText || '저장된 내용을 불러오는 중입니다.'}
            </p>
          </div>

          <button
            onClick={() => {
              sessionStorage.removeItem('speech-diary-result')
              router.push('/diary-kiosk')
            }}
            className="mt-6 rounded-[1.4rem] bg-amber-300 px-8 py-4 text-xl font-black text-slate-900 shadow-[0_16px_40px_rgba(251,191,36,0.28)] transition hover:bg-amber-200"
          >
            다시 스캔하기
          </button>
        </div>
      </div>
    </div>
  )
}
