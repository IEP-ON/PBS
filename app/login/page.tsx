'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const STUDENT_SAVED_KEY = 'pbs_student_saved'

interface SavedStudent {
  classCode: string
  studentName: string
  classInfo: { className: string; schoolName: string }
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'teacher' | 'student'>('teacher')
  const [classCode, setClassCode] = useState('')
  const [teacherPin, setTeacherPin] = useState('')
  const [studentName, setStudentName] = useState('')
  const [studentPin, setStudentPin] = useState('')
  const [savedStudent, setSavedStudent] = useState<SavedStudent | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'code' | 'auth'>('code')
  const [classInfo, setClassInfo] = useState<{ className: string; schoolName: string } | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STUDENT_SAVED_KEY)
      if (raw) {
        const parsed: SavedStudent = JSON.parse(raw)
        setSavedStudent(parsed)
        setClassCode(parsed.classCode)
        setStudentName(parsed.studentName)
        setClassInfo(parsed.classInfo)
        setMode('student')
        setStep('auth')
      }
    } catch {
      localStorage.removeItem(STUDENT_SAVED_KEY)
    }
  }, [])

  const handleClassCodeSubmit = async () => {
    if (!classCode.trim()) {
      setError('학급코드를 입력해주세요.')
      return
    }
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`/api/classroom/${classCode.toUpperCase()}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '학급을 찾을 수 없습니다.')
        setLoading(false)
        return
      }

      setClassInfo({ className: data.className, schoolName: data.schoolName })
      setStep('auth')
    } catch {
      setError('서버 연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleTeacherLogin = async () => {
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classCode: classCode.toUpperCase(), teacherPin }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        setLoading(false)
        return
      }

      router.push(`/${data.classCode}/dashboard`)
    } catch {
      setError('서버 연결에 실패했습니다.')
      setLoading(false)
    }
  }

  const handleStudentLogin = async (pinOverride?: string) => {
    setError('')
    setLoading(true)
    const pinToSubmit = pinOverride ?? studentPin

    try {
      const res = await fetch('/api/auth/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode: classCode.toUpperCase(),
          studentName,
          studentPin: pinToSubmit,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        setLoading(false)
        return
      }

      if (classInfo) {
        localStorage.setItem(STUDENT_SAVED_KEY, JSON.stringify({
          classCode: classCode.toUpperCase(),
          studentName,
          classInfo,
        }))
      }

      router.push(`/s/${data.classCode}/${data.studentId}/home`)
    } catch {
      setError('서버 연결에 실패했습니다.')
      setLoading(false)
    }
  }

  const handleClearSaved = () => {
    localStorage.removeItem(STUDENT_SAVED_KEY)
    setSavedStudent(null)
    setStudentName('')
    setStudentPin('')
    setClassCode('')
    setClassInfo(null)
    setStep('code')
    setMode('teacher')
    setError('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <Link href="/" className="block text-center text-gray-400 hover:text-gray-600 text-sm">
          ← 처음으로
        </Link>

        <div className="text-center space-y-1">
          <div className="text-4xl">🏦</div>
          <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
        </div>

        {step === 'code' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">학급 식별코드</span>
              <input
                type="text"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                placeholder="예: NDG-2026-001"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-lg font-mono tracking-wider text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleClassCodeSubmit()}
              />
            </label>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              onClick={handleClassCodeSubmit}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
            >
              {loading ? '확인 중...' : '다음'}
            </button>
          </div>
        )}

        {step === 'auth' && classInfo && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-sm text-blue-600 font-medium">{classInfo.schoolName}</p>
              <p className="text-lg font-bold text-blue-900">{classInfo.className}</p>
              <p className="text-xs text-blue-400 font-mono mt-1">{classCode.toUpperCase()}</p>
            </div>

            {/* 모드 선택 탭 */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => { setMode('teacher'); setError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'teacher' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                👩‍🏫 교사
              </button>
              <button
                onClick={() => { setMode('student'); setError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'student' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                🧒 학생
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              {mode === 'teacher' ? (
                <>
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">교사 PIN</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={teacherPin}
                      onChange={(e) => setTeacherPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="4~6자리 숫자"
                      className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-2xl tracking-[0.5em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleTeacherLogin()}
                    />
                  </label>
                  {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                  <button
                    onClick={handleTeacherLogin}
                    disabled={loading || teacherPin.length < 4}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
                  >
                    {loading ? '로그인 중...' : '교사 로그인'}
                  </button>
                </>
              ) : (
                <>
                  {savedStudent ? (
                    <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🔒</span>
                        <div>
                          <p className="text-xs text-blue-500 font-medium">저장된 학생</p>
                          <p className="text-lg font-bold text-gray-900">{savedStudent.studentName}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearSaved}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        다른 학생
                      </button>
                    </div>
                  ) : (
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">이름</span>
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="이름을 입력하세요"
                        className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  )}
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">PIN 4자리</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={studentPin}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '')
                        setStudentPin(v)
                        if (v.length === 4) void handleStudentLogin(v)
                      }}
                      placeholder="●●●●"
                      className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-2xl tracking-[0.5em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus={!!savedStudent}
                      onKeyDown={(e) => e.key === 'Enter' && handleStudentLogin()}
                    />
                  </label>
                  {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                  <button
                    onClick={() => void handleStudentLogin()}
                    disabled={loading || !studentName || studentPin.length !== 4}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors min-h-[56px] text-lg"
                  >
                    {loading ? '로그인 중...' : '학생 로그인'}
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => { setStep('code'); setError(''); setClassInfo(null) }}
              className="w-full text-sm text-gray-400 hover:text-gray-600"
            >
              다른 학급코드 입력
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
