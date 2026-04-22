'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { formatClassCodeInput, normalizeClassCode } from '@/lib/utils'

const DEVICE_TOKEN_KEY = 'pbs_bank_device_token'

export default function BankLockPage() {
  const router = useRouter()
  const [deviceReady, setDeviceReady] = useState(false)
  const [classCode, setClassCode] = useState('')
  const [studentName, setStudentName] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const t = window.localStorage.getItem(DEVICE_TOKEN_KEY)
    setDeviceReady(Boolean(t))
  }, [])

  const submit = async () => {
    if (typeof window === 'undefined') return
    const deviceToken = window.localStorage.getItem(DEVICE_TOKEN_KEY)
    if (!deviceToken) {
      setMessage('기기 등록이 필요합니다.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/bank/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode: normalizeClassCode(classCode),
          studentName,
          studentPin: pin,
          deviceToken,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || '로그인에 실패했습니다.')
        return
      }
      router.push('/bank')
    } catch {
      setMessage('네트워크 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (!deviceReady) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-lg font-bold text-white">이 기기는 아직 등록되지 않았습니다.</p>
        <Link href="/bank/setup" className="inline-block rounded-2xl bg-violet-600 px-6 py-3 font-bold text-white">
          기기 등록하기
        </Link>
        <div>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            처음으로
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold text-violet-300">뱅킹앱</p>
        <h1 className="mt-1 text-2xl font-black">PIN 입력</h1>
        <p className="mt-2 text-sm text-slate-400">등록된 기기에서 학급·이름·PIN을 입력하세요.</p>
      </div>

      <label className="block text-sm font-semibold text-slate-200">
        학급 코드
        <input
          value={classCode}
          onChange={(e) => setClassCode(formatClassCodeInput(e.target.value))}
          className="mt-2 w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 font-mono text-lg text-white"
        />
      </label>

      <label className="block text-sm font-semibold text-slate-200">
        이름
        <input
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-lg text-white"
        />
      </label>

      <label className="block text-sm font-semibold text-slate-200">
        PIN
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          type="password"
          inputMode="numeric"
          className="mt-2 w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-lg tracking-widest text-white"
        />
      </label>

      {message ? <p className="rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-sm text-rose-100">{message}</p> : null}

      <button
        type="button"
        disabled={busy || !normalizeClassCode(classCode) || !studentName.trim() || pin.length < 4}
        onClick={() => void submit()}
        className="w-full rounded-2xl bg-violet-600 py-4 text-lg font-black text-white hover:bg-violet-500 disabled:bg-slate-700"
      >
        {busy ? '확인 중…' : '들어가기'}
      </button>

      <Link href="/bank/setup" className="block text-center text-sm text-slate-400 hover:text-slate-200">
        기기 다시 등록
      </Link>
    </div>
  )
}
