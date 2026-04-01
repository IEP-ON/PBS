'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

type RecordingState = 'idle' | 'recording' | 'processing'
type MediaPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported'

export default function DiaryRecordPage() {
  const AUTO_START_COUNTDOWN = 5
  const AUTO_RECORDING_SECONDS = 15

  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const studentId = params.studentId as string
  const studentName = searchParams.get('name') || '학생'

  const [state, setState] = useState<RecordingState>('idle')
  const [recordingTime, setRecordingTime] = useState(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [snapshotCaptured, setSnapshotCaptured] = useState(false)
  const [error, setError] = useState('')
  const [requestingMedia, setRequestingMedia] = useState(false)
  const [cameraPermission, setCameraPermission] = useState<MediaPermissionState>('unknown')
  const [microphonePermission, setMicrophonePermission] = useState<MediaPermissionState>('unknown')

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotBlobRef = useRef<Blob | null>(null)
  const startRecordingRef = useRef<() => void>(() => {})

  const setupMedia = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    let mounted = true

    setupMedia.current = async () => {
      setRequestingMedia(true)
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

        setCameraPermission('granted')
        setMicrophonePermission('granted')
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setCameraReady(true)
        setCountdown(AUTO_START_COUNTDOWN)
      } catch {
        setCameraPermission('denied')
        setMicrophonePermission('denied')
        setError('카메라와 마이크 권한을 확인해주세요.')
      } finally {
        if (mounted) {
          setRequestingMedia(false)
        }
      }
    }

    const updatePermissions = async () => {
      if (!navigator.permissions?.query) {
        setCameraPermission('unsupported')
        setMicrophonePermission('unsupported')
        return
      }

      try {
        const cameraStatus = await navigator.permissions.query({ name: 'camera' as PermissionName })
        setCameraPermission(cameraStatus.state as MediaPermissionState)
        cameraStatus.onchange = () => setCameraPermission(cameraStatus.state as MediaPermissionState)
      } catch {
        setCameraPermission('unsupported')
      }

      try {
        const microphoneStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        setMicrophonePermission(microphoneStatus.state as MediaPermissionState)
        microphoneStatus.onchange = () => setMicrophonePermission(microphoneStatus.state as MediaPermissionState)
      } catch {
        setMicrophonePermission('unsupported')
      }
    }

    void updatePermissions()

    return () => {
      mounted = false
      if (timerRef.current) clearInterval(timerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
      if (autoStopRef.current) clearTimeout(autoStopRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
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
        if (chunksRef.current.length === 0) {
          setError('녹음된 내용이 없습니다. 다시 시도해주세요.')
          setState('idle')
          setRecordingTime(0)
          return
        }

        const finalMimeType = recorder.mimeType || 'audio/webm'
        const audioBlob = new Blob(chunksRef.current, { type: finalMimeType })
        await processAudio(audioBlob, finalMimeType)
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setState('recording')
      setRecordingTime(0)

      setTimeout(() => captureSnapshot(), 3000)

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1
          if (next >= AUTO_RECORDING_SECONDS) {
            stopRecording()
            return AUTO_RECORDING_SECONDS
          }
          return next
        })
      }, 1000)

      autoStopRef.current = setTimeout(() => stopRecording(), AUTO_RECORDING_SECONDS * 1000)
    } catch {
      setError('녹음을 시작할 수 없습니다.')
    }
  }

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoStopRef.current) clearTimeout(autoStopRef.current)

    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    setState('processing')
    recorder.stop()
  }

  const processAudio = async (audioBlob: Blob, mimeType: string) => {
    const extension = mimeType.includes('mp4') ? 'm4a' : 'webm'
    const formData = new FormData()
    formData.append('audio', audioBlob, `recording-${Date.now()}.${extension}`)
    formData.append('studentId', studentId)

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
        return
      }

      sessionStorage.setItem('speech-diary-result', JSON.stringify({
        diaryId: result.data.diaryId,
        studentName,
        correctedText: result.data.correctedText,
      }))
      router.push('/diary-kiosk/result')
    } catch {
      setError('서버 연결 중 오류가 발생했습니다.')
      setState('idle')
    }
  }

  useEffect(() => {
    startRecordingRef.current = startRecording
  })

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

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_#fff7d6_0%,_#fef3c7_35%,_#e0f2fe_72%,_#f8fafc_100%)] px-4 py-5">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-6xl flex-col items-center justify-center gap-6 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.8fr)] lg:items-center">
        <div className="w-full text-center lg:text-left">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-amber-600/80">Recording Booth</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{studentName}</h1>
          <p className="mt-2 text-base text-slate-600">카운트다운이 끝나면 바로 말해보세요.</p>
          <div className="mt-5 w-full rounded-[1.8rem] bg-white/80 px-6 py-5 text-center shadow-sm ring-1 ring-white/90 lg:text-left">
            <p className="text-lg font-black text-slate-900">오늘 있었던 일을 짧게 말해보세요</p>
            <p className="mt-2 text-sm text-slate-500">학교, 집, 급식, 친구, 주말 이야기 모두 괜찮아요.</p>
          </div>
        </div>

        <div className="w-full rounded-[2.25rem] border border-white/80 bg-white/85 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.15)]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.8rem] bg-slate-900">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${state === 'processing' ? 'opacity-40 blur-sm' : ''}`}
              style={{ transform: 'scaleX(-1)' }}
            />

            {countdown !== null && state === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[2px]">
                <p className="mb-4 rounded-full bg-white/90 px-5 py-2 text-base font-black text-amber-700">
                  {countdown === 0 ? '녹음 시작!' : '곧 시작해요'}
                </p>
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white text-5xl font-black text-slate-900 shadow-2xl">
                  {countdown}
                </div>
              </div>
            )}

            {state === 'recording' && (
              <div className="absolute left-4 top-4 rounded-full bg-rose-500 px-3 py-1 text-sm font-black text-white shadow-lg">
                REC {recordingTime}s / {AUTO_RECORDING_SECONDS}s
              </div>
            )}

            {snapshotCaptured && (
              <div className="absolute right-4 top-4 rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-white shadow-lg">
                SNAPSHOT
              </div>
            )}

            {state === 'processing' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/65">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent" />
                <p className="mt-4 text-lg font-bold text-white">일기를 정리하는 중...</p>
              </div>
            )}

            {!cameraReady && state === 'idle' && countdown === null && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 px-6 text-center">
                {requestingMedia ? (
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent" />
                ) : (
                  <>
                    <p className="text-lg font-black text-white">카메라와 마이크 권한이 필요해요</p>
                    <p className="mt-2 text-sm text-white/70">버튼을 누르면 녹음 준비를 위해 권한 요청이 나타납니다.</p>
                    <button
                      type="button"
                      onClick={() => void setupMedia.current()}
                      className="mt-4 rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-900 shadow-lg transition hover:bg-amber-200"
                    >
                      🎤 권한 요청 및 녹음 준비
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="w-full rounded-2xl bg-rose-50 px-5 py-4 text-center text-sm font-bold text-rose-600">
            {error}
          </div>
        )}

        {!cameraReady && (
          <div className="w-full rounded-2xl bg-white/80 px-5 py-4 text-center shadow-sm ring-1 ring-white/90">
            <p className="text-sm font-bold text-slate-900">
              {cameraPermission === 'denied' || microphonePermission === 'denied'
                ? '권한이 거부되어 있어요. 앱 또는 브라우저 설정에서 카메라와 마이크를 허용해주세요.'
                : '권한을 허용하면 5초 카운트다운 뒤 자동 녹음이 시작됩니다.'}
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
