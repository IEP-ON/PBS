'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DiaryKioskPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  const stopCamera = useCallback(() => {
    scanningRef.current = false
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const handleQrData = useCallback(async (qrCode: string) => {
    if (loading) return

    stopCamera()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/speech-diary/student?qrCode=${encodeURIComponent(qrCode)}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '학생을 찾지 못했습니다.')
        setLoading(false)
        return
      }

      router.push(`/diary-kiosk/record/${data.studentId}?name=${encodeURIComponent(data.name)}`)
    } catch {
      setError('학생 조회 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }, [loading, router, stopCamera])

  const startCamera = useCallback(async () => {
    setError('')
    setReady(false)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      })

      streamRef.current = stream
      scanningRef.current = true

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setReady(true)

      const tick = async () => {
        if (!scanningRef.current) return

        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState < 2) {
          requestAnimationFrame(tick)
          return
        }

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const context = canvas.getContext('2d')
        if (!context) {
          requestAnimationFrame(tick)
          return
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        const jsQR = (await import('jsqr')).default
        const code = jsQR(imageData.data, imageData.width, imageData.height)

        if (code?.data) {
          void handleQrData(code.data)
          return
        }

        requestAnimationFrame(tick)
      }

      requestAnimationFrame(tick)
    } catch {
      setError('카메라를 사용할 수 없습니다. 권한을 확인해주세요.')
    }
  }, [handleQrData])

  useEffect(() => {
    void startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_#fff6d8_0%,_#ffedd5_30%,_#e0f2fe_68%,_#f8fafc_100%)] px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-5xl flex-col items-center justify-center gap-6 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.8fr)] lg:items-center">
        <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-700">
          ← 처음으로
        </Link>

        <div className="text-center lg:text-left">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-600/70">Speech Diary</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">말 일기장</h1>
          <p className="mt-3 text-lg text-slate-600">학생 QR 카드를 보여주면 녹음이 자동으로 시작돼요.</p>
          <div className="mt-5 rounded-[1.75rem] bg-white/80 px-6 py-5 text-center shadow-sm ring-1 ring-white/80 lg:text-left">
            <p className="text-lg font-black text-slate-900">네모 안에 QR 카드만 보여주세요</p>
            <p className="mt-2 text-sm text-slate-500">인식되면 5초 카운트다운 뒤 15초 녹음이 자동 시작됩니다.</p>
          </div>
        </div>

        <div className="w-full rounded-[2.5rem] border border-white/80 bg-white/85 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur">
          <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] bg-slate-900">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
              <div className="relative h-full w-full rounded-[2rem] border-4 border-dashed border-white/80">
                <div className="absolute -left-1 -top-1 h-10 w-10 rounded-tl-[2rem] border-l-8 border-t-8 border-amber-300" />
                <div className="absolute -right-1 -top-1 h-10 w-10 rounded-tr-[2rem] border-r-8 border-t-8 border-amber-300" />
                <div className="absolute -bottom-1 -left-1 h-10 w-10 rounded-bl-[2rem] border-b-8 border-l-8 border-sky-300" />
                <div className="absolute -bottom-1 -right-1 h-10 w-10 rounded-br-[2rem] border-b-8 border-r-8 border-sky-300" />
              </div>
            </div>

            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent" />
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl bg-emerald-500 px-6 py-4 text-center text-lg font-black text-white shadow-lg">
            학생을 확인하는 중...
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-rose-50 px-6 py-4 text-center text-base font-bold text-rose-600">
            {error}
          </div>
        )}

      </div>
    </div>
  )
}
