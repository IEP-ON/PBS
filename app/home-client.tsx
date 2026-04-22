'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  clearKioskLock,
  getKioskLock,
  kioskLockRedirectPath,
  setKioskLock,
  type KioskLockMode,
} from '@/lib/kiosk-lock'

export default function HomeClient() {
  const router = useRouter()
  const [lockMode, setLockMode] = useState<KioskLockMode | null>(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    const lock = getKioskLock()
    if (lock) {
      setLockMode(lock.mode)
      router.replace(kioskLockRedirectPath(lock))
      return
    }
    setLockMode(null)
    setBooting(false)
  }, [router])

  useEffect(() => {
    const onStorage = () => {
      const lock = getKioskLock()
      setLockMode(lock?.mode ?? null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const applyLock = (mode: KioskLockMode) => {
    setKioskLock(mode)
    setLockMode(mode)
    router.push(kioskLockRedirectPath({ v: 1, mode }))
  }

  const releaseLock = () => {
    clearKioskLock()
    setLockMode(null)
  }

  if (booting) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 text-slate-600">
        {getKioskLock() ? '키오스크 모드로 이동하는 중…' : '불러오는 중…'}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-amber-50 px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col justify-center gap-8 lg:flex-row lg:items-center lg:gap-12">
        <div className="flex-1 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm">
            <span className="text-lg">🎙️</span>
            말 일기 · QR 토큰 · 행동계약 · 뱅킹
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">말로 모으는 하루</h1>
            <p className="max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
              학생 말 일기와 행동계약 보상 QR, ATM 충전, 개별 뱅킹을 한 흐름으로 운영하는 특수학급 플랫폼입니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-sky-100 bg-white/85 p-4 shadow-sm">
              <p className="text-sm font-bold text-sky-700">핵심 1</p>
              <p className="mt-1 text-lg font-extrabold text-slate-900">말 일기장</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">QR 카드로 녹음하고 기록이 쌓입니다.</p>
            </div>
            <div className="rounded-3xl border border-emerald-100 bg-white/85 p-4 shadow-sm">
              <p className="text-sm font-bold text-emerald-700">핵심 2</p>
              <p className="mt-1 text-lg font-extrabold text-slate-900">QR 토큰 · ATM</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">계약 달성 보상을 실물 QR로 주고 ATM에서 충전합니다.</p>
            </div>
            <div className="rounded-3xl border border-amber-100 bg-white/85 p-4 shadow-sm">
              <p className="text-sm font-bold text-amber-700">핵심 3</p>
              <p className="mt-1 text-lg font-extrabold text-slate-900">뱅킹 · 가게</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">학생 기기에서 PIN으로 잔액과 가게를 이용합니다.</p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white/90 p-6 text-center shadow-xl shadow-sky-100 backdrop-blur">
          <div className="space-y-2">
            <div className="text-6xl">💬</div>
            <h2 className="text-2xl font-black text-slate-900">시작하기</h2>
            <p className="text-sm text-slate-500">교사 로그인, 키오스크·ATM·뱅킹 설정을 선택하세요.</p>
          </div>

          <div className="mt-6 space-y-4">
            <Link
              href="/login"
              className="block w-full rounded-2xl bg-sky-600 px-6 py-4 text-lg font-semibold text-white transition-colors shadow-lg shadow-sky-200 hover:bg-sky-700"
            >
              로그인
            </Link>

            <Link
              href="/register"
              className="block w-full rounded-2xl border-2 border-sky-200 bg-white px-6 py-4 text-lg font-semibold text-sky-700 transition-colors hover:bg-sky-50"
            >
              새 학급 개설
            </Link>

            <Link
              href="/diary-kiosk"
              className="block w-full rounded-2xl bg-emerald-100 px-6 py-3 font-medium text-emerald-800 transition-colors hover:bg-emerald-200"
            >
              말 일기 키오스크
            </Link>

            <Link
              href="/atm"
              className="block w-full rounded-2xl bg-slate-100 px-6 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-200"
            >
              ATM 키오스크
            </Link>

            <Link
              href="/bank/setup"
              className="block w-full rounded-2xl border-2 border-violet-200 bg-violet-50 px-6 py-3 font-medium text-violet-900 transition-colors hover:bg-violet-100"
            >
              뱅킹앱 기기 등록
            </Link>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6 text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">공용 갤탭 고정</p>
            <p className="mt-1 text-sm text-slate-600">
              이 브라우저에서 홈으로 돌아와도 바로 키오스크로 가려면 아래에서 고정하세요. 해제는 같은 기기에서만
              됩니다.
            </p>
            {lockMode ? (
              <p className="mt-2 text-sm font-semibold text-sky-800">
                현재 고정:{' '}
                {lockMode === 'diary' ? '말 일기' : lockMode === 'atm' ? 'ATM' : '뱅킹'}
              </p>
            ) : null}
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => applyLock('diary')}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500"
              >
                이 기기를 말 일기 키오스크로 고정
              </button>
              <button
                type="button"
                onClick={() => applyLock('atm')}
                className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-white hover:bg-slate-700"
              >
                이 기기를 ATM으로 고정
              </button>
              <button
                type="button"
                onClick={() => applyLock('bank')}
                className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white hover:bg-violet-600"
              >
                이 기기를 뱅킹(잠금 화면)으로 고정
              </button>
              {lockMode ? (
                <button
                  type="button"
                  onClick={releaseLock}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  고정 해제
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
