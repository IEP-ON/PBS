'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DiaryKioskChrome } from '@/components/speech-diary/DiaryKioskChrome'

interface ResultState {
  diaryId: string
  studentName: string
  correctedText: string
}

const AUTO_RETURN_SECONDS = 10

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

  const [secondsLeft, setSecondsLeft] = useState(AUTO_RETURN_SECONDS)

  useEffect(() => {
    sessionStorage.removeItem('speech-diary-student')
  }, [])

  useEffect(() => {
    if (secondsLeft <= 0) {
      sessionStorage.removeItem('speech-diary-result')
      sessionStorage.removeItem('speech-diary-student')
      router.push('/diary-kiosk')
      return
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft, router])

  const camera = (
    <div className="absolute inset-0 flex min-h-[200px] flex-col items-center justify-center gap-4 bg-gradient-to-b from-emerald-50 to-sky-50 px-6 text-center landscape:min-h-0">
      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-emerald-100 text-6xl shadow-inner ring-4 ring-emerald-200/80 sm:h-32 sm:w-32 sm:text-7xl">
        ✓
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-900 sm:text-3xl">참 잘했어요!</p>
        <p className="mt-2 text-lg font-semibold text-slate-700 sm:text-xl">
          {result?.studentName || '학생'}의 말 일기가 저장되었어요.
        </p>
      </div>
    </div>
  )

  const panel = (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border-2 border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm font-extrabold text-emerald-800 sm:text-base">저장 완료</p>
        <p className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">정리된 문장</p>
        <p className="mt-4 whitespace-pre-wrap text-xl font-bold leading-relaxed text-slate-900 sm:text-2xl">
          {result?.correctedText || '저장된 내용을 불러오는 중이에요.'}
        </p>
      </div>

      <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-center sm:p-5">
        <p className="text-lg font-extrabold text-slate-800 sm:text-xl">
          {secondsLeft > 0 ? `${secondsLeft}초 후 처음 화면으로 돌아가요` : '이동 중…'}
        </p>
        <div className="mx-auto mt-3 h-3 max-w-xs overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-sky-600 transition-all duration-500"
            style={{
              width: `${((AUTO_RETURN_SECONDS - secondsLeft) / AUTO_RETURN_SECONDS) * 100}%`,
            }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          sessionStorage.removeItem('speech-diary-result')
          sessionStorage.removeItem('speech-diary-student')
          router.push('/diary-kiosk')
        }}
        className="min-h-[56px] w-full rounded-2xl bg-sky-600 px-6 py-4 text-xl font-extrabold text-white shadow-md transition hover:bg-sky-500 sm:min-h-[60px] sm:text-2xl"
      >
        다시 스캔하기
      </button>
    </div>
  )

  return (
    <DiaryKioskChrome
      step={3}
      title="말 일기 저장 완료"
      subtitle="오늘도 잘 말해 주었어요."
      camera={camera}
      panel={panel}
    />
  )
}
