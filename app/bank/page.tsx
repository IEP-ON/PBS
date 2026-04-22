'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

export default function BankHomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [balance, setBalance] = useState(0)
  const [savings, setSavings] = useState(0)
  const [classCode, setClassCode] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/bank/me', { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || '로그인이 필요합니다.')
          router.replace('/bank/lock')
          return
        }
        setName(data.studentName || '')
        setBalance(data.balance ?? 0)
        setSavings(data.savingsBalance ?? 0)
        setClassCode(data.classCode || null)
      } catch {
        setError('불러오기 실패')
        router.replace('/bank/lock')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const logout = async () => {
    await fetch('/api/bank/logout', { method: 'POST' })
    router.push('/bank/lock')
  }

  if (loading) {
    return <p className="text-center text-slate-400">불러오는 중…</p>
  }

  if (error) {
    return <p className="text-center text-rose-300">{error}</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold text-violet-300">뱅킹앱</p>
        <h1 className="mt-1 text-2xl font-black">{name} 학생</h1>
        {classCode ? <p className="mt-1 font-mono text-sm text-slate-400">{classCode}</p> : null}
      </div>

      <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
        <p className="text-sm text-slate-400">통장 잔액</p>
        <p className="mt-1 text-3xl font-black text-white">{formatCurrency(balance)}</p>
      </div>

      <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
        <p className="text-sm text-slate-400">저축 통장</p>
        <p className="mt-1 text-2xl font-black text-emerald-300">{formatCurrency(savings)}</p>
        <p className="mt-2 text-xs text-slate-500">이체·가게·이자 등은 다음 단계에서 연결합니다.</p>
      </div>

      <div className="grid gap-3">
        <div className="rounded-xl border border-dashed border-white/20 bg-black/30 px-4 py-4 text-center text-sm text-slate-400">
          가게 · 송금 · 저축 입출금 UI 준비 중
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-2xl border border-white/20 py-3 text-sm font-bold text-slate-200 hover:bg-white/10"
        >
          잠금(PIN 화면)
        </button>
        <Link href="/" className="block text-center text-sm text-slate-500 hover:text-slate-300">
          처음으로
        </Link>
      </div>
    </div>
  )
}
