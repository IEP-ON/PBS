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
  const studentPinSlots = Array.from({ length: 4 }, (_, index) => studentPin[index] ?? '')
  const studentCanLogin = Boolean(studentName) && studentPin.length === 4

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

  const handleStudentPinChange = (value: string) => {
    const nextPin = value.replace(/\D/g, '').slice(0, 4)
    setStudentPin(nextPin)
    setError('')

    if (nextPin.length === 4) {
      void handleStudentLogin(nextPin)
    }
  }

  const handleStudentPinDigit = (digit: string) => {
    if (loading || studentPin.length >= 4) return
    handleStudentPinChange(studentPin + digit)
  }

  const handleStudentPinBackspace = () => {
    if (loading || studentPin.length === 0) return
    setStudentPin((prev) => prev.slice(0, -1))
    setError('')
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff8d6_0%,_#d7efff_38%,_#f6fbff_72%,_#ffffff_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col justify-center">
        <Link href="/" className="mb-4 block text-center text-sm font-medium text-sky-700/70 hover:text-sky-800">
          ← 처음으로
        </Link>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-white/90 text-4xl shadow-[0_18px_50px_rgba(14,116,144,0.18)] ring-4 ring-white/70">
            🏦
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-600/70">PBS Banking</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">로그인</h1>
          <p className="mt-2 text-base text-slate-600">학생이 혼자서도 쉽게 들어갈 수 있도록 큰 버튼으로 만들었어요.</p>
        </div>

        {step === 'code' && (
          <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_rgba(59,130,246,0.15)] backdrop-blur sm:p-8">
            <div className="mb-6 text-center">
              <div className="mb-3 text-5xl">🏫</div>
              <h2 className="text-2xl font-black text-slate-900">학급을 먼저 찾아요</h2>
              <p className="mt-2 text-base text-slate-600">교실 코드를 입력하면 학생과 교사 로그인으로 이어집니다.</p>
            </div>

            <label className="block">
              <span className="text-base font-bold text-slate-700">학급 식별코드</span>
              <input
                type="text"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                placeholder="예: NDG-2026-001"
                className="mt-2 block w-full rounded-[1.5rem] border-2 border-sky-100 bg-sky-50 px-5 py-5 text-center font-mono text-xl font-bold tracking-[0.18em] text-slate-900 shadow-inner outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-200"
                onKeyDown={(e) => e.key === 'Enter' && handleClassCodeSubmit()}
              />
            </label>

            {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-center text-base font-semibold text-red-600">{error}</p>}

            <button
              onClick={handleClassCodeSubmit}
              disabled={loading}
              className="mt-5 w-full rounded-[1.5rem] bg-sky-600 py-5 text-xl font-black text-white shadow-[0_16px_35px_rgba(2,132,199,0.3)] transition hover:bg-sky-700 disabled:bg-sky-300"
            >
              {loading ? '확인 중...' : '다음'}
            </button>
          </div>
        )}

        {step === 'auth' && classInfo && (
          <div className="space-y-5">
            <div className="rounded-[2rem] border border-sky-100 bg-white/90 p-5 text-center shadow-[0_18px_50px_rgba(14,116,144,0.12)]">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-500">{classInfo.schoolName}</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{classInfo.className}</p>
              <p className="mt-2 inline-flex rounded-full bg-sky-50 px-4 py-1.5 font-mono text-sm font-bold tracking-[0.15em] text-sky-700">{classCode.toUpperCase()}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-[2rem] border border-white/70 bg-white/80 p-2 shadow-[0_14px_40px_rgba(148,163,184,0.15)] backdrop-blur">
              <button
                onClick={() => { setMode('teacher'); setError('') }}
                className={`rounded-[1.4rem] px-4 py-4 text-base font-black transition ${
                  mode === 'teacher'
                    ? 'bg-slate-800 text-white shadow-[0_12px_28px_rgba(15,23,42,0.28)]'
                    : 'text-slate-500'
                }`}
              >
                👩‍🏫 교사용
              </button>
              <button
                onClick={() => { setMode('student'); setError('') }}
                className={`rounded-[1.4rem] px-4 py-4 text-base font-black transition ${
                  mode === 'student'
                    ? 'bg-amber-300 text-slate-900 shadow-[0_12px_28px_rgba(251,191,36,0.35)]'
                    : 'text-slate-500'
                }`}
              >
                🧒 학생용
              </button>
            </div>

            <div className={`overflow-hidden rounded-[2rem] border p-6 shadow-[0_24px_70px_rgba(15,23,42,0.14)] sm:p-7 ${
              mode === 'student'
                ? 'border-amber-200 bg-[linear-gradient(180deg,_#fff7cc_0%,_#fffdf5_18%,_#ffffff_100%)]'
                : 'border-white/70 bg-white/95'
            }`}>
              {mode === 'teacher' ? (
                <div className="space-y-5">
                  <div className="text-center">
                    <div className="mb-3 text-5xl">🧑‍🏫</div>
                    <h2 className="text-2xl font-black text-slate-900">교사 로그인</h2>
                    <p className="mt-2 text-base text-slate-600">교사 PIN을 입력하면 대시보드로 이동합니다.</p>
                  </div>

                  <label className="block">
                    <span className="text-base font-bold text-slate-700">교사 PIN</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={teacherPin}
                      onChange={(e) => setTeacherPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="4~6자리 숫자"
                      className="mt-2 block w-full rounded-[1.5rem] border-2 border-slate-100 bg-slate-50 px-4 py-5 text-center text-3xl font-black tracking-[0.5em] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-200"
                      onKeyDown={(e) => e.key === 'Enter' && handleTeacherLogin()}
                    />
                  </label>
                  {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-center text-base font-semibold text-red-600">{error}</p>}
                  <button
                    onClick={handleTeacherLogin}
                    disabled={loading || teacherPin.length < 4}
                    className="w-full rounded-[1.5rem] bg-sky-600 py-5 text-xl font-black text-white shadow-[0_16px_35px_rgba(2,132,199,0.3)] transition hover:bg-sky-700 disabled:bg-sky-300"
                  >
                    {loading ? '로그인 중...' : '교사 로그인'}
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-[1.75rem] bg-white/75 px-5 py-5 text-center ring-1 ring-amber-100">
                    <div className="mb-3 text-6xl">🧒</div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900">학생 로그인</h2>
                    <p className="mt-2 text-lg font-semibold text-amber-700">이름을 확인하고 숫자 4개를 눌러요.</p>
                  </div>

                  {savedStudent ? (
                    <div className="flex items-center justify-between rounded-[1.75rem] border-2 border-amber-200 bg-white px-5 py-4 shadow-sm">
                      <div className="flex items-center gap-4">
                        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-3xl">🔒</span>
                        <div>
                          <p className="text-sm font-bold text-amber-700">저장된 학생</p>
                          <p className="text-2xl font-black text-slate-900">{savedStudent.studentName}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearSaved}
                        className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-500 transition hover:bg-rose-100"
                      >
                        다른 학생
                      </button>
                    </div>
                  ) : (
                    <label className="block">
                      <span className="text-base font-bold text-slate-700">이름</span>
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => {
                          setStudentName(e.target.value)
                          setError('')
                        }}
                        placeholder="이름을 입력하세요"
                        className="mt-2 block w-full rounded-[1.5rem] border-2 border-amber-100 bg-white px-5 py-5 text-center text-2xl font-black text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-200"
                      />
                    </label>
                  )}

                  <div className="rounded-[1.75rem] border-2 border-amber-100 bg-white/85 p-5">
                    <div className="text-center">
                      <p className="text-base font-bold text-slate-700">PIN 4자리</p>
                      <div className="mt-4 grid grid-cols-4 gap-3">
                        {studentPinSlots.map((slot, index) => (
                          <div
                            key={index}
                            className={`flex h-16 items-center justify-center rounded-[1.35rem] border-2 text-3xl font-black transition ${
                              slot
                                ? 'border-amber-400 bg-amber-100 text-slate-900'
                                : 'border-dashed border-amber-200 bg-amber-50/70 text-amber-300'
                            }`}
                          >
                            {slot ? '●' : ''}
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-500">숫자를 누르면 자동으로 로그인해요.</p>
                    </div>

                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={studentPin}
                      onChange={(e) => handleStudentPinChange(e.target.value)}
                      placeholder="●●●●"
                      className="sr-only"
                      autoFocus={!!savedStudent}
                      onKeyDown={(e) => e.key === 'Enter' && handleStudentLogin()}
                    />

                    <div className="mt-5 grid grid-cols-3 gap-3">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                        <button
                          key={digit}
                          type="button"
                          onClick={() => handleStudentPinDigit(digit)}
                          disabled={loading || !studentName}
                          className="rounded-[1.5rem] border border-amber-200 bg-white py-5 text-3xl font-black text-slate-900 shadow-[0_10px_20px_rgba(251,191,36,0.16)] transition active:scale-95 disabled:opacity-40"
                        >
                          {digit}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={handleStudentPinBackspace}
                        disabled={loading || studentPin.length === 0}
                        className="rounded-[1.5rem] border border-rose-200 bg-rose-50 py-5 text-lg font-black text-rose-600 transition active:scale-95 disabled:opacity-40"
                      >
                        지우기
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStudentPinDigit('0')}
                        disabled={loading || !studentName}
                        className="rounded-[1.5rem] border border-amber-200 bg-white py-5 text-3xl font-black text-slate-900 shadow-[0_10px_20px_rgba(251,191,36,0.16)] transition active:scale-95 disabled:opacity-40"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (studentCanLogin) void handleStudentLogin()
                        }}
                        disabled={loading || !studentCanLogin}
                        className="rounded-[1.5rem] bg-emerald-500 py-5 text-lg font-black text-white shadow-[0_12px_28px_rgba(16,185,129,0.3)] transition active:scale-95 disabled:bg-emerald-300"
                      >
                        확인
                      </button>
                    </div>
                  </div>

                  {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-center text-lg font-bold text-red-600">{error}</p>}

                  <button
                    onClick={() => void handleStudentLogin()}
                    disabled={loading || !studentCanLogin}
                    className="w-full rounded-[1.75rem] bg-slate-900 py-5 text-xl font-black text-white shadow-[0_18px_40px_rgba(15,23,42,0.24)] transition hover:bg-slate-800 disabled:bg-slate-300"
                  >
                    {loading ? '로그인 중...' : '학생 로그인'}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => { setStep('code'); setError(''); setClassInfo(null) }}
              className="w-full text-base font-semibold text-slate-500 hover:text-slate-700"
            >
              다른 학급코드 입력
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
