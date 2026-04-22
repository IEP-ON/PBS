'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { formatDate } from '@/lib/utils'

interface Diary {
  id: string
  student_id: string
  student_name: string
  raw_transcript: string | null
  corrected_text: string | null
  audio_url: string | null
  image_url: string | null
  sentiment: 'positive' | 'negative' | 'neutral' | null
  keywords: string[] | null
  teacher_note: string | null
  created_at: string
}

interface StudentOption {
  id: string
  name: string
}

export default function SpeechDiaryPage() {
  const params = useParams()
  const classCode = params.classCode as string

  const [diaries, setDiaries] = useState<Diary[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('all')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [message, setMessage] = useState('')
  const selectAllRef = useRef<HTMLInputElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [teacherNote, setTeacherNote] = useState('')

  const loadData = async (studentId?: string) => {
    setLoading(true)
    const query = studentId && studentId !== 'all' ? `?studentId=${studentId}` : ''

    try {
      const res = await fetch(`/api/speech-diary${query}`)
      const data = await res.json()
      if (res.ok) {
        setDiaries(data.diaries || [])
        setStudents(data.students || [])
      } else {
        setMessage(data.error || '말 일기 조회에 실패했습니다.')
      }
    } catch {
      setMessage('말 일기 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => diaries.some((d) => d.id === id)))
  }, [diaries])

  useEffect(() => {
    const el = selectAllRef.current
    if (!el) return
    el.indeterminate = selectedIds.length > 0 && selectedIds.length < diaries.length
  }, [selectedIds, diaries.length])

  const openEdit = (diary: Diary) => {
    setEditingId(diary.id)
    setEditText(diary.corrected_text || diary.raw_transcript || '')
    setTeacherNote(diary.teacher_note || '')
  }

  const saveDiary = async (diaryId: string) => {
    setSavingId(diaryId)
    setMessage('')
    try {
      const res = await fetch(`/api/speech-diary/${diaryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correctedText: editText,
          teacherNote,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || '저장에 실패했습니다.')
      } else {
        setMessage('일기를 수정했습니다.')
        setEditingId(null)
        await loadData(selectedStudentId)
      }
    } catch {
      setMessage('저장 중 오류가 발생했습니다.')
    } finally {
      setSavingId(null)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleSelectAll = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(diaries.map((d) => d.id))
    } else {
      setSelectedIds([])
    }
  }

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return
    if (
      !confirm(
        `선택한 말 일기 ${selectedIds.length}건을 삭제할까요? 삭제 후에는 복구할 수 없습니다.`
      )
    ) {
      return
    }

    setBulkDeleting(true)
    setMessage('')
    try {
      const res = await fetch('/api/speech-diary/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diaryIds: selectedIds }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || '일괄 삭제에 실패했습니다.')
      } else {
        const skipped = typeof data.skippedCount === 'number' && data.skippedCount > 0
        setMessage(
          skipped
            ? `${data.deletedCount}건을 삭제했습니다. (${data.skippedCount}건은 권한 없음으로 건너뜀)`
            : `${data.deletedCount}건을 삭제했습니다.`
        )
        setSelectedIds([])
        await loadData(selectedStudentId)
      }
    } catch {
      setMessage('일괄 삭제 중 오류가 발생했습니다.')
    } finally {
      setBulkDeleting(false)
    }
  }

  const deleteDiary = async (diary: Diary) => {
    if (!confirm(`${diary.student_name} 학생의 ${formatDate(diary.created_at)} 기록 1건을 삭제할까요?`)) {
      return
    }

    setDeletingId(diary.id)
    setMessage('')
    try {
      const res = await fetch(`/api/speech-diary/${diary.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || '삭제에 실패했습니다.')
      } else {
        setMessage('기록 1건을 삭제했습니다.')
        await loadData(selectedStudentId)
      }
    } catch {
      setMessage('삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="tablet-page space-y-6 bg-slate-50">
      <div className="flex flex-col gap-4 rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-bold text-sky-700">말 일기장</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">녹음 일기 목록</h1>
          <p className="mt-1 text-base text-slate-600">QR 카드로 녹음된 학생 일기를 확인하고 수정할 수 있습니다.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/diary-kiosk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-900"
          >
            키오스크 열기 ↗
          </Link>
          <Link
            href={`/${classCode}/speech-diary/analytics`}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-500"
          >
            분석 보기
          </Link>
          <Link
            href={`/${classCode}/speech-diary/context`}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-500"
          >
            오늘의 맥락
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4">
        <span className="text-sm font-medium text-gray-600">학생 필터</span>
        <select
          value={selectedStudentId}
          onChange={(e) => {
            const next = e.target.value
            setSelectedStudentId(next)
            void loadData(next)
          }}
          className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900"
        >
          <option value="all">전체 학생</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>{student.name}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">총 {diaries.length}건</span>
        {diaries.length > 0 && (
          <>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer touch-target">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={diaries.length > 0 && selectedIds.length === diaries.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              전체 선택
            </label>
            <button
              type="button"
              onClick={() => void deleteSelected()}
              disabled={selectedIds.length === 0 || bulkDeleting || loading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {bulkDeleting ? '삭제 중...' : `선택 삭제 (${selectedIds.length})`}
            </button>
          </>
        )}
      </div>

      {message && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          {message}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          불러오는 중...
        </div>
      ) : diaries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-500">아직 저장된 말 일기가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {diaries.map((diary) => (
            <div key={diary.id} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(diary.id)}
                    onChange={() => toggleSelect(diary.id)}
                    disabled={bulkDeleting}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    aria-label={`${diary.student_name} 일기 선택`}
                  />
                  <div className="min-w-0">
                  <p className="font-bold text-gray-900">{diary.student_name}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(diary.created_at).toLocaleString('ko-KR')}
                  </p>
                  </div>
                </div>
                {diary.sentiment && (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    diary.sentiment === 'positive'
                      ? 'bg-green-100 text-green-700'
                      : diary.sentiment === 'negative'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}>
                    {diary.sentiment === 'positive' ? '긍정' : diary.sentiment === 'negative' ? '부정' : '중립'}
                  </span>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-3">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold text-gray-400">원문</p>
                    <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                      {diary.raw_transcript || '원문 없음'}
                    </p>
                  </div>

                  {editingId === diary.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={5}
                        className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <textarea
                        value={teacherNote}
                        onChange={(e) => setTeacherNote(e.target.value)}
                        rows={3}
                        placeholder="교사 메모"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => void saveDiary(diary.id)}
                          disabled={savingId === diary.id}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-xl transition-colors"
                        >
                          {savingId === diary.id ? '저장 중...' : '저장'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-blue-50 p-4">
                      <p className="text-xs font-semibold text-blue-500">정리된 문장</p>
                      <p className="mt-2 text-base font-medium text-gray-900 whitespace-pre-wrap">
                        {diary.corrected_text || diary.raw_transcript || '내용 없음'}
                      </p>
                      {diary.teacher_note && (
                        <p className="mt-3 text-sm text-gray-500">
                          교사 메모: {diary.teacher_note}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {diary.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={diary.image_url}
                      alt={`${diary.student_name} 스냅샷`}
                      className="w-full rounded-2xl border border-gray-100 object-cover"
                    />
                  )}

                  {diary.audio_url && (
                    <audio controls className="w-full">
                      <source src={diary.audio_url} />
                    </audio>
                  )}

                  {diary.keywords && diary.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {diary.keywords.map((keyword) => (
                        <span key={keyword} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {editingId !== diary.id && (
                      <button
                        onClick={() => openEdit(diary)}
                        className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
                      >
                        수정
                      </button>
                    )}
                    <button
                      onClick={() => void deleteDiary(diary)}
                      disabled={deletingId === diary.id || bulkDeleting}
                      className="flex-1 px-4 py-2 bg-rose-50 hover:bg-rose-100 disabled:bg-rose-50 text-rose-600 text-sm font-medium rounded-xl transition-colors"
                    >
                      {deletingId === diary.id ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
