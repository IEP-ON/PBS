'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

export type DiaryKioskStep = 1 | 2 | 3

const STEPS: { step: DiaryKioskStep; label: string }[] = [
  { step: 1, label: 'QR' },
  { step: 2, label: '말하기' },
  { step: 3, label: '완료' },
]

type DiaryKioskChromeProps = {
  step: DiaryKioskStep
  title: string
  /** 보조 한 줄 (선택) */
  subtitle?: string
  camera: ReactNode
  panel: ReactNode
  /** 기본 true */
  showHomeLink?: boolean
}

function StepIndicator({ current }: { current: DiaryKioskStep }) {
  return (
    <ol
      className="flex w-full max-w-md items-stretch gap-1 sm:gap-2"
      aria-label="말 일기장 진행 단계"
    >
      {STEPS.map(({ step, label }, index) => {
        const done = current > step
        const active = current === step
        return (
          <li key={step} className="min-w-0 flex-1">
            <div
              className={`flex flex-col items-center rounded-xl border-2 px-1 py-2 text-center transition-colors sm:px-2 sm:py-2.5 ${
                active
                  ? 'border-sky-600 bg-sky-50 text-slate-900'
                  : done
                    ? 'border-emerald-400 bg-emerald-50 text-slate-800'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <span
                className={`text-[10px] font-bold sm:text-xs ${active ? 'text-sky-700' : done ? 'text-emerald-700' : ''}`}
              >
                {index + 1}
              </span>
              <span className="mt-0.5 truncate text-xs font-extrabold sm:text-sm">{label}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * 말 일기장 키오스크 공통 셸: 상단 단계 + 카메라 슬롯(가로 왼쪽·세로 위) + 패널(가로 오른쪽·세로 아래).
 * 갤럭시 탭 PWA 가로는 `landscape:`로 2열 고정, `100dvh` 기준.
 */
export function DiaryKioskChrome({
  step,
  title,
  subtitle,
  camera,
  panel,
  showHomeLink = true,
}: DiaryKioskChromeProps) {
  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-100 text-slate-900">
      <header className="shrink-0 border-b border-slate-200 bg-white px-3 py-3 shadow-sm landscape:px-5 landscape:py-3.5">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 landscape:flex-row landscape:items-center landscape:justify-between landscape:gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-sky-700 sm:text-sm">말 일기장</p>
            <h1 className="mt-0.5 truncate text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl landscape:text-3xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-sm font-medium text-slate-600 sm:text-base">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 landscape:flex-row landscape:items-center landscape:gap-4">
            <StepIndicator current={step} />
            {showHomeLink ? (
              <Link
                href="/"
                className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-4 text-base font-bold text-slate-800 transition hover:bg-slate-50 landscape:min-h-[52px] landscape:px-5"
              >
                처음으로
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-3 px-3 pb-3 pt-2 landscape:flex-row landscape:gap-4 landscape:px-4 landscape:pb-4 landscape:pt-3">
        <section
          className="flex min-h-0 min-w-0 flex-[1.15] flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm"
          aria-label="카메라 화면"
        >
          <div className="relative min-h-0 flex-1">{camera}</div>
        </section>

        <section
          className="flex min-h-0 w-full shrink-0 flex-col gap-3 overflow-y-auto landscape:w-[min(42%,560px)] landscape:shrink-0 landscape:overflow-y-auto portrait:max-h-[46dvh] portrait:flex-1"
          aria-label="안내 및 조작"
        >
          {panel}
        </section>
      </main>
    </div>
  )
}
