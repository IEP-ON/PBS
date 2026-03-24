'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    schoolName: '',
    className: '',
    teacherName: '',
    teacherPin: '',
    teacherPinConfirm: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ classCode: string } | null>(null)

  const updateForm = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    setError('')

    if (!form.schoolName || !form.className || !form.teacherName || !form.teacherPin) {
      setError('모든 항목을 입력해주세요.')
      return
    }

    if (form.teacherPin.length < 4 || form.teacherPin.length > 6) {
      setError('PIN은 4~6자리 숫자여야 합니다.')
      return
    }

    if (form.teacherPin !== form.teacherPinConfirm) {
      setError('PIN이 일치하지 않습니다.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: form.schoolName,
          className: form.className,
          teacherName: form.teacherName,
          teacherPin: form.teacherPin,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        setLoading(false)
        return
      }

      setResult({ classCode: data.classCode })
    } catch {
      setError('서버 연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900">학급 개설 완료!</h1>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
            <p className="text-sm text-gray-500">학급 식별코드</p>
            <p className="text-3xl font-bold font-mono text-blue-600 tracking-wider">
              {result.classCode}
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                ⚠️ 이 코드를 반드시 메모해 두세요.<br />
                이후 로그인과 학생 접속에 사용됩니다.
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push(`/${result.classCode}/dashboard`)}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-2xl transition-colors shadow-lg shadow-blue-200"
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <Link href="/" className="block text-center text-gray-400 hover:text-gray-600 text-sm">
          ← 처음으로
        </Link>

        <div className="text-center space-y-1">
          <div className="text-4xl">🏫</div>
          <h1 className="text-2xl font-bold text-gray-900">새 학급 개설</h1>
          <p className="text-sm text-gray-500">학급 정보를 입력하면 식별코드가 자동 발급됩니다.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">학교명</span>
            <input
              type="text"
              value={form.schoolName}
              onChange={(e) => updateForm('schoolName', e.target.value)}
              placeholder="예: 남대구초등학교"
              className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">학급명</span>
            <input
              type="text"
              value={form.className}
              onChange={(e) => updateForm('className', e.target.value)}
              placeholder="예: 꿈나래반"
              className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">교사명</span>
            <input
              type="text"
              value={form.teacherName}
              onChange={(e) => updateForm('teacherName', e.target.value)}
              placeholder="이름"
              className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">교사 PIN (4~6자리 숫자)</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={form.teacherPin}
              onChange={(e) => updateForm('teacherPin', e.target.value.replace(/\D/g, ''))}
              placeholder="●●●●"
              className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-xl tracking-[0.5em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">PIN 확인</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={form.teacherPinConfirm}
              onChange={(e) => updateForm('teacherPinConfirm', e.target.value.replace(/\D/g, ''))}
              placeholder="●●●●"
              className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-xl tracking-[0.5em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-lg font-semibold rounded-xl transition-colors"
          >
            {loading ? '개설 중...' : '학급 개설하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
