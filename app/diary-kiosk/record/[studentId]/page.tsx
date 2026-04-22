'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import type { PublicCue } from '@/types'
import { DiaryKioskChrome } from '@/components/speech-diary/DiaryKioskChrome'
import { useMicLevel } from '@/components/speech-diary/useMicLevel'

type RecordingState = 'idle' | 'recording' | 'processing'
type EndedBy = 'student' | 'timeout' | 'error'

interface RecordingMeta {
  durationSeconds: number
  endedBy: EndedBy
}

function readStoredPublicCue(studentId: string): PublicCue | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = sessionStorage.getItem('speech-diary-student')
    if (!raw) return null

    const parsed = JSON.parse(raw) as { studentId?: string; publicCue?: PublicCue | null }
    return parsed.studentId === studentId ? parsed.publicCue || null : null
  } catch {
    return null
  }
}

export default function DiaryRecordPage() {
  const AUTO_START_COUNTDOWN = 5
  const MAX_RECORDING_SECONDS = 60

  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const studentId = params.studentId as string
  const studentName = searchParams.get('name') || '학생'

  const [state, setState] = useState<RecordingState>('idle')
  const [recordingTime, setRecordingTime] = useState(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [meterStream, setMeterStream] = useState<MediaStream | null>(null)
  const [snapshotCaptured, setSnapshotCaptured] = useState(false)
  const [error, setError] = useState('')
  const [showLowVoiceHint, setShowLowVoiceHint] = useState(false)
  const publicCue = useMemo(() => readStoredPublicCue(studentId), [studentId])
  const lowStreakRef = useRef(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotBlobRef = useRef<Blob | null>(null)
  const startRecordingRef = useRef<() => void>(() => {})
  const stopRecordingRef = useRef<(reason: EndedBy) => void>(() => {})
  const recordingStartedAtRef = useRef<number | null>(null)
  const recordingMetaRef = useRef<RecordingMeta | null>(null)

  const meterActive =
    Boolean(meterStream) &&
    (state === 'recording' ||
      (state === 'idle' && countdown !== null && countdown <= 2 && countdown >= 1))

  const micLevel = useMicLevel(meterStream, meterActive)
  const micLevelRef = useRef(0)
  micLevelRef.current = micLevel

  const sessionProgress = useMemo(() => {
    if (state === 'processing') return 100
    if (state === 'recording') {
      return 25 + Math.min(1, recordingTime / MAX_RECORDING_SECONDS) * 75
    }
    if (countdown === null || countdown < 0) return 0
    if (countdown === 0) return 25
    return ((AUTO_START_COUNTDOWN - countdown) / AUTO_START_COUNTDOWN) * 25
  }, [state, countdown, recordingTime])

  useEffect(() => {
    if (state !== 'recording') {
      lowStreakRef.current = 0
      setShowLowVoiceHint(false)
      return
    }
    const id = setInterval(() => {
      const level = micLevelRef.current
      if (level < 0.085) {
        lowStreakRef.current += 1
        if (lowStreakRef.current >= 5) setShowLowVoiceHint(true)
      } else {
        lowStreakRef.current = 0
        if (level > 0.14) setShowLowVoiceHint(false)
      }
    }, 450)
    return () => clearInterval(id)
  }, [state])

  useEffect(() => {
    let mounted = true

    const setupMedia = async () => {
      setError('')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        })

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        setMeterStream(stream)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setCameraReady(true)
        setCountdown(AUTO_START_COUNTDOWN)
      } catch {
        setError('카메라와 마이크 권한을 확인해 주세요.')
      }
    }

    void setupMedia()

    return () => {
      mounted = false
      if (timerRef.current) clearInterval(timerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
      if (autoStopRef.current) clearTimeout(autoStopRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      recordingStartedAtRef.current = null
      recordingMetaRef.current = null
      setMeterStream(null)
    }
  }, [])

  const captureSnapshot = () => {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 120
    const context = canvas.getContext('2d')
    if (!context) return

    context.translate(canvas.width, 0)
    context.scale(-1, 1)
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (blob) {
        snapshotBlobRef.current = blob
        setSnapshotCaptured(true)
      }
    }, 'image/jpeg', 0.4)
  }

  const startRecording = () => {
    if (state !== 'idle' || !streamRef.current) return

    const audioTracks = streamRef.current.getAudioTracks()
    if (audioTracks.length === 0) {
      setError('마이크를 사용할 수 없습니다.')
      return
    }

    chunksRef.current = []
    const audioOnlyStream = new MediaStream(audioTracks)
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''

    try {
      const recorder = mimeType
        ? new MediaRecorder(audioOnlyStream, { mimeType })
        : new MediaRecorder(audioOnlyStream)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        const fallbackDurationSeconds =
          recordingStartedAtRef.current === null
            ? 0
            : Number(
                (
                  Math.min(MAX_RECORDING_SECONDS * 1000, Math.max(0, performance.now() - recordingStartedAtRef.current)) / 1000
                ).toFixed(1)
              )
        const meta = recordingMetaRef.current ?? {
          durationSeconds: fallbackDurationSeconds,
          endedBy: 'error' as EndedBy,
        }

        if (chunksRef.current.length === 0) {
          setError('녹음된 내용이 없습니다. 다시 시도해 주세요.')
          setState('idle')
          setRecordingTime(0)
          recordingStartedAtRef.current = null
          recordingMetaRef.current = null
          return
        }

        const finalMimeType = recorder.mimeType || 'audio/webm'
        const audioBlob = new Blob(chunksRef.current, { type: finalMimeType })
        await processAudio(audioBlob, finalMimeType, meta)
      }

      mediaRecorderRef.current = recorder
      recordingStartedAtRef.current = performance.now()
      recordingMetaRef.current = null
      recorder.start()
      setState('recording')
      setRecordingTime(0)

      setTimeout(() => captureSnapshot(), 3000)

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1
          if (next >= MAX_RECORDING_SECONDS) {
            stopRecordingRef.current('timeout')
            return MAX_RECORDING_SECONDS
          }
          return next
        })
      }, 1000)

      autoStopRef.current = setTimeout(() => stopRecordingRef.current('timeout'), MAX_RECORDING_SECONDS * 1000)
    } catch {
      setError('녹음을 시작할 수 없습니다.')
      recordingStartedAtRef.current = null
      recordingMetaRef.current = null
    }
  }

  const stopRecording = (reason: EndedBy) => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }

    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    const startedAt = recordingStartedAtRef.current ?? performance.now()
    const durationSeconds = Number(
      (
        Math.min(MAX_RECORDING_SECONDS * 1000, Math.max(0, performance.now() - startedAt)) / 1000
      ).toFixed(1)
    )

    recordingMetaRef.current = {
      durationSeconds,
      endedBy: reason,
    }
    setState('processing')
    recorder.stop()
  }

  const processAudio = async (audioBlob: Blob, mimeType: string, meta: RecordingMeta) => {
    const extension = mimeType.includes('mp4') ? 'm4a' : 'webm'
    const formData = new FormData()
    formData.append('audio', audioBlob, `recording-${Date.now()}.${extension}`)
    formData.append('studentId', studentId)
    formData.append('durationSeconds', String(meta.durationSeconds))
    formData.append('endedBy', meta.endedBy)

    if (snapshotBlobRef.current) {
      formData.append('image', snapshotBlobRef.current, `snapshot-${Date.now()}.jpg`)
    }

    try {
      const res = await fetch('/api/speech-diary/transcribe', {
        method: 'POST',
        body: formData,
      })

      const result = await res.json()
      if (!res.ok || !result.success) {
        setError(result.error || '일기 저장에 실패했습니다.')
        setState('idle')
        setRecordingTime(0)
        setCountdown(null)
        recordingStartedAtRef.current = null
        recordingMetaRef.current = null
        return
      }

      sessionStorage.setItem(
        'speech-diary-result',
        JSON.stringify({
          diaryId: result.data.diaryId,
          studentName,
          correctedText: result.data.correctedText,
        })
      )
      router.push('/diary-kiosk/result')
    } catch {
      setError('서버 연결 중 오류가 발생했습니다.')
      setState('idle')
    } finally {
      recordingStartedAtRef.current = null
      recordingMetaRef.current = null
    }
  }

  useEffect(() => {
    startRecordingRef.current = startRecording
    stopRecordingRef.current = stopRecording
  })

  useEffect(() => {
    if (state !== 'recording') return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault()
        stopRecordingRef.current('student')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state])

  useEffect(() => {
    if (!cameraReady || countdown === null || countdown <= 0) return

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return prev
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          setTimeout(() => startRecordingRef.current(), 250)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [cameraReady, countdown])

  const camera = (
    <div className="absolute inset-0 min-h-[200px] bg-slate-900 landscape:min-h-0">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover ${state === 'processing' ? 'opacity-40 blur-sm' : ''}`}
        style={{ transform: 'scaleX(-1)' }}
      />

      {countdown !== null && state === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 px-4">
          <p className="mb-4 rounded-full bg-white px-6 py-2 text-lg font-extrabold text-amber-800 sm:text-xl">
            {countdown === 0 ? '녹음 시작!' : '곧 시작해요'}
          </p>
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white text-6xl font-black text-slate-900 shadow-2xl sm:h-36 sm:w-36 sm:text-7xl">
            {countdown}
          </div>
          {publicCue?.selfCheckPrompts?.length ? (
            <div className="mt-5 max-h-[40%] w-full max-w-lg overflow-y-auto rounded-2xl bg-white/95 px-4 py-3 text-left shadow-xl">
              <p className="text-sm font-extrabold text-slate-600">생각해 보고 말해요</p>
              <ul className="mt-2 space-y-1.5 text-base font-semibold text-slate-900">
                {publicCue.selfCheckPrompts.map((prompt) => (
                  <li key={prompt}>• {prompt}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {state === 'recording' && (
        <div className="absolute left-3 top-3 rounded-full bg-rose-600 px-4 py-2 text-base font-extrabold text-white shadow-lg sm:left-4 sm:top-4 sm:text-lg">
          녹음 {recordingTime}초 / {MAX_RECORDING_SECONDS}초
        </div>
      )}

      {snapshotCaptured && (
        <div className="absolute right-3 top-3 rounded-full bg-emerald-600 px-3 py-2 text-sm font-extrabold text-white shadow-lg sm:right-4 sm:top-4 sm:text-base">
          사진 저장
        </div>
      )}

      {state === 'processing' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-white border-t-transparent" />
          <p className="mt-4 text-xl font-bold text-white">일기를 정리하는 중…</p>
        </div>
      )}

      {!cameraReady && state === 'idle' && countdown === null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/75 px-6 text-center">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-white border-t-transparent" />
          <p className="mt-4 text-lg font-bold text-white">카메라를 준비하고 있어요</p>
        </div>
      )}
    </div>
  )

  const panel = (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm font-bold text-sky-700 sm:text-base">말하기 단계</p>
        <p className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">{studentName}</p>
        <p className="mt-2 text-lg font-semibold text-slate-700">
          카운트다운이 끝나면 바로 말하고, 말이 끝나면 완료 버튼을 눌러 주세요.
        </p>

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm font-bold text-slate-600 sm:text-base">
            <span>진행</span>
            <span>{Math.round(sessionProgress)}%</span>
          </div>
          <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-sky-600 transition-[width] duration-300 ease-out"
              style={{ width: `${sessionProgress}%` }}
            />
          </div>
        </div>

        {(meterActive || state === 'recording') && (
          <div className="mt-5">
            <p className="text-sm font-extrabold text-slate-700 sm:text-base">목소리 크기 (참고)</p>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">기기마다 다를 수 있어요. 막대가 움직이면 잘 들리고 있어요.</p>
            <div className="mt-2 h-6 w-full overflow-hidden rounded-full bg-slate-200 sm:h-7">
              <div
                className="h-full min-w-[4px] rounded-full bg-emerald-500 transition-[width] duration-100"
                style={{ width: `${Math.round(micLevel * 100)}%` }}
              />
            </div>
          </div>
        )}

        {showLowVoiceHint && state === 'recording' ? (
          <p className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-base font-bold text-amber-950">
            탭에 조금 더 가까이 가서, 크게 말해 볼까요?
          </p>
        ) : null}

        {state === 'recording' ? (
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => stopRecording('student')}
              className="min-h-[80px] w-full rounded-2xl bg-sky-600 px-6 py-4 text-2xl font-extrabold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-500"
            >
              말하기 끝
            </button>
            <p className="text-center text-sm font-medium text-slate-500">
              말이 끝났으면 눌러요. 스페이스바나 Enter 키로도 끝낼 수 있어요.
            </p>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 sm:p-5">
        <p className="text-xl font-extrabold text-slate-900 sm:text-2xl">오늘 있었던 일을 짧게 말해 보세요</p>
        <p className="mt-2 text-base text-slate-600 sm:text-lg">
          학교, 집, 급식, 친구, 주말 이야기 모두 괜찮아요. 최대 60초까지 천천히 말할 수 있어요.
        </p>
        {publicCue?.todayGoal && (
          <p className="mt-4 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-base font-bold text-amber-950">
            오늘의 목표 · {publicCue.todayGoal}
          </p>
        )}
        {publicCue?.replacementBehavior && (
          <p className="mt-3 text-base font-semibold text-emerald-800">대체 행동 · {publicCue.replacementBehavior}</p>
        )}
        {publicCue?.selfCheckPrompts?.length ? (
          <div className="mt-4 rounded-xl border-2 border-slate-200 bg-white px-4 py-3">
            <p className="text-sm font-extrabold text-slate-600">생각해 볼 질문</p>
            <ul className="mt-2 space-y-2 text-base text-slate-800">
              {publicCue.selfCheckPrompts.map((prompt) => (
                <li key={prompt}>• {prompt}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-4 text-center text-base font-bold text-rose-800">
          {error}
        </div>
      ) : null}
    </div>
  )

  return (
    <DiaryKioskChrome
      step={2}
      title="말 일기 녹음"
      subtitle={`${studentName} 학생`}
      camera={camera}
      panel={panel}
    />
  )
}
