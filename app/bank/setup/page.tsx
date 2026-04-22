'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { formatClassCodeInput, normalizeClassCode } from '@/lib/utils'

const DEVICE_TOKEN_KEY = 'pbs_bank_device_token'

export default function BankSetupPage() {
  const router = useRouter()
  const [classCode, setClassCode] = useState('')
  const [studentName, setStudentName] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async () => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/bank/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode: normalizeClassCode(classCode),
          studentName,
          studentPin: pin,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || '등록에 실패했습니다.')
        return
      }
      if (typeof window !== 'undefined' && data.deviceToken) {
        window.localStorage.setItem(DEVICE_TOKEN_KEY, data.deviceToken)
      }
      router.push('/bank/lock')
    } catch {
      setMessage('네트워크 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold text-violet-300">뱅킹앱</p>
        <h1 className="mt-1 text-2xl font-black">기기 등록</h1>
        <p className="mt-2 text-sm text-slate-400">
          이 탭에서 한 번만 학급·이름·PIN을 입력하면 기기 토큰이 저장됩니다. 이후에는 PIN만 입력하면 됩니다.
        </p>
      </div>

      <label className="block text-sm font-semibold text-slate-200">
        학급 코드
        <input
          value={classCode}
          onChange={(e) => setClassCode(formatClassCodeInput(e.target.value))}
          className="mt-2 w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 font-mono text-lg text-white placeholder:text-slate-500"
          placeholder="NDG-2026-003"
          autoComplete="off"
        />
      </label>

      <label className="block text-sm font-semibold text-slate-200">
        이름
        <input
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-lg text-white placeholder:text-slate-500"
          placeholder="홍길동"
          autoComplete="name"
        />
      </label>

      <label className="block text-sm font-semibold text-slate-200">
        PIN (4자리)
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          type="password"
          inputMode="numeric"
          className="mt-2 w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-lg tracking-widest text-white"
          placeholder="••••"
          autoComplete="one-time-code"
        />
      </label>

      {message ? <p className="rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-sm text-rose-100">{message}</p> : null}

      <button
        type="button"
        disabled={busy || !normalizeClassCode(classCode) || !studentName.trim() || pin.length < 4}
        onClick={() => void submit()}
        className="w-full rounded-2xl bg-violet-600 py-4 text-lg font-black text-white hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-400"
      >
        {busy ? '등록 중…' : '등록하고 잠금 화면으로'}
      </button>

      <Link href="/bank/lock" className="block text-center text-sm font-semibold text-sky-300 hover:text-sky-200">
        이미 등록했어요 → PIN 입력
      </Link>

      <Link href="/" className="block text-center text-sm text-slate-500 hover:text-slate-300">
        처음으로
      </Link>
    </div>
  )
}
