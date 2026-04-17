'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PublicCue } from '@/types'
import { DiaryKioskChrome } from '@/components/speech-diary/DiaryKioskChrome'

type StudentLookup = {
  studentId: string
  name: string
  publicCue?: PublicCue | null
}

export default function DiaryKioskPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const jsQrRef = useRef<(typeof import('jsqr'))['default'] | null>(null)
  const lookupCacheRef = useRef<Map<string, StudentLookup>>(new Map())
  const lastScanAtRef = useRef(0)
  const handleQrDataRef = useRef<(qr: string) => Promise<void>>(async () => {})

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

  const startCameraRef = useRef<() => Promise<void>>(async () => {})

  const handleQrData = useCallback(
    async (qrCode: string) => {
      if (loading) return

      stopCamera()
      setLoading(true)
      setError('')

      try {
        const cachedStudent = lookupCacheRef.current.get(qrCode)
        if (cachedStudent) {
          sessionStorage.setItem(
            'speech-diary-student',
            JSON.stringify({
              studentId: cachedStudent.studentId,
              name: cachedStudent.name,
              publicCue: cachedStudent.publicCue || null,
            })
          )
          router.push(
            `/diary-kiosk/record/${cachedStudent.studentId}?name=${encodeURIComponent(cachedStudent.name)}`
          )
          return
        }

        const res = await fetch(`/api/speech-diary/student?qrCode=${encodeURIComponent(qrCode)}`, {
          cache: 'no-store',
        })
        const data = (await res.json()) as StudentLookup & { error?: string }

        if (!res.ok) {
          setError(data.error || '학생을 찾지 못했습니다.')
          setLoading(false)
          await startCameraRef.current()
          return
        }

        lookupCacheRef.current.set(qrCode, {
          studentId: data.studentId,
          name: data.name,
          publicCue: data.publicCue || null,
        })
        sessionStorage.setItem(
          'speech-diary-student',
          JSON.stringify({
            studentId: data.studentId,
            name: data.name,
            publicCue: data.publicCue || null,
          })
        )
        router.push(`/diary-kiosk/record/${data.studentId}?name=${encodeURIComponent(data.name)}`)
      } catch {
        setError('학생 조회 중 오류가 발생했습니다.')
        setLoading(false)
        await startCameraRef.current()
      }
    },
    [loading, router, stopCamera]
  )

  useEffect(() => {
    handleQrDataRef.current = handleQrData
  }, [handleQrData])

  const startCamera = useCallback(async () => {
    setError('')
    setReady(false)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 540 },
          frameRate: { ideal: 24, max: 30 },
        },
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

        const now = performance.now()
        if (now - lastScanAtRef.current < 90) {
          requestAnimationFrame(tick)
          return
        }
        lastScanAtRef.current = now

        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState < 2) {
          requestAnimationFrame(tick)
          return
        }

        const sourceWidth = video.videoWidth
        const sourceHeight = video.videoHeight
        const cropSize = Math.floor(Math.min(sourceWidth, sourceHeight) * 0.68)
        const sourceX = Math.floor((sourceWidth - cropSize) / 2)
        const sourceY = Math.floor((sourceHeight - cropSize) / 2)
        const targetSize = Math.min(420, cropSize)

        if (canvas.width !== targetSize || canvas.height !== targetSize) {
          canvas.width = targetSize
          canvas.height = targetSize
        }

        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) {
          requestAnimationFrame(tick)
          return
        }

        context.drawImage(
          video,
          sourceX,
          sourceY,
          cropSize,
          cropSize,
          0,
          0,
          targetSize,
          targetSize
        )
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        const jsQR = jsQrRef.current ?? (await import('jsqr')).default
        jsQrRef.current = jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })

        if (code?.data) {
          void handleQrDataRef.current(code.data)
          return
        }

        requestAnimationFrame(tick)
      }

      requestAnimationFrame(tick)
    } catch {
      setError('카메라를 사용할 수 없습니다. 권한을 확인해주세요.')
    }
  }, [])

  startCameraRef.current = startCamera

  useEffect(() => {
    void import('jsqr').then((module) => {
      jsQrRef.current = module.default
    })
    void startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  const camera = (
    <div className="absolute inset-0 flex min-h-[220px] flex-col bg-slate-900 landscape:min-h-0">
      <video ref={videoRef} className="h-full min-h-0 w-full flex-1 object-cover" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />

      <div className="pointer-events-none absolute inset-0 bg-black/18" />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        <div className="relative aspect-square max-h-[min(72vmin,420px)] w-full max-w-[min(88vw,460px)] rounded-[1.75rem] border-4 border-white/90">
          <div className="absolute -left-1 -top-1 h-10 w-10 rounded-tl-[1.75rem] border-l-8 border-t-8 border-sky-400" />
          <div className="absolute -right-1 -top-1 h-10 w-10 rounded-tr-[1.75rem] border-r-8 border-t-8 border-sky-400" />
          <div className="absolute -bottom-1 -left-1 h-10 w-10 rounded-bl-[1.75rem] border-b-8 border-l-8 border-sky-400" />
          <div className="absolute -bottom-1 -right-1 h-10 w-10 rounded-br-[1.75rem] border-b-8 border-r-8 border-sky-400" />
        </div>
      </div>

      <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/95 px-3 py-2 text-sm font-extrabold text-slate-800 sm:left-4 sm:top-4 sm:text-base">
        {ready ? '스캔 중' : '카메라 준비 중'}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-2xl bg-black/60 px-4 py-3 text-center text-base font-bold text-white sm:bottom-4 sm:text-lg">
        학생 QR 카드를 화면 중앙 네모 안에 맞춰 주세요
      </div>

      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/60">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-white border-t-transparent" />
          <p className="text-base font-bold text-white sm:text-lg">카메라를 연결하고 있어요</p>
        </div>
      )}
    </div>
  )

  const panel = (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">이렇게 사용해요</h2>
        <ol className="mt-4 space-y-4 text-base text-slate-700 sm:text-lg">
          <li className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-lg font-black text-sky-800">
              1
            </span>
            <span>
              <span className="font-extrabold text-slate-900">QR 카드 준비</span>
              <span className="mt-1 block text-slate-600">학생 관리에서 출력한 표준 QR 카드를 사용해 주세요.</span>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-lg font-black text-sky-800">
              2
            </span>
            <span>
              <span className="font-extrabold text-slate-900">화면 중앙에 맞추기</span>
              <span className="mt-1 block text-slate-600">너무 가깝지 않게, 네모 안에 카드가 들어오게 맞춰 주세요.</span>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-lg font-black text-sky-800">
              3
            </span>
            <span>
              <span className="font-extrabold text-slate-900">다음 화면으로 이동</span>
              <span className="mt-1 block text-slate-600">학생이 확인되면 녹음 준비 화면으로 자동으로 넘어가요.</span>
            </span>
          </li>
        </ol>
      </div>

      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 sm:p-5">
        <p className="text-lg font-extrabold text-amber-900 sm:text-xl">스캔이 잘 안 되면</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-base font-medium text-amber-950 sm:text-lg">
          <li>카드가 구겨지지 않았는지 확인해 주세요.</li>
          <li>밝은 곳에서 그림자를 줄여 주세요.</li>
          <li>카드를 살짝 멀리했다 가까이 하며 초점을 맞춰 보세요.</li>
        </ul>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-emerald-600 px-5 py-4 text-center text-lg font-extrabold text-white shadow-md sm:py-5 sm:text-xl">
          학생을 확인하는 중…
        </div>
      ) : null}

      {error ? (
        <div
          className="rounded-2xl border-2 border-rose-300 bg-rose-50 px-5 py-4 text-center text-base font-bold text-rose-800 sm:text-lg"
          role="alert"
        >
          {error}
        </div>
      ) : null}
    </div>
  )

  return (
    <DiaryKioskChrome
      step={1}
      title="QR 코드를 보여 주세요"
      subtitle="학생 카드를 카메라 앞 중앙에 맞춰 주세요."
      camera={camera}
      panel={panel}
    />
  )
}
