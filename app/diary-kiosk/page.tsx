'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type StudentLookup = {
  studentId: string
  name: string
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
      const cachedStudent = lookupCacheRef.current.get(qrCode)
      if (cachedStudent) {
        router.push(`/diary-kiosk/record/${cachedStudent.studentId}?name=${encodeURIComponent(cachedStudent.name)}`)
        return
      }

      const res = await fetch(`/api/speech-diary/student?qrCode=${encodeURIComponent(qrCode)}`, {
        cache: 'no-store',
      })
      const data = await res.json() as StudentLookup & { error?: string }

      if (!res.ok) {
        setError(data.error || '학생을 찾지 못했습니다.')
        setLoading(false)
        return
      }

      lookupCacheRef.current.set(qrCode, {
        studentId: data.studentId,
        name: data.name,
      })
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
    void import('jsqr').then((module) => {
      jsQrRef.current = module.default
    })
    void startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  return (
    <div className="min-h-[100dvh] bg-slate-100 px-4 py-4 lg:px-6 lg:py-6">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-6xl flex-col gap-4 lg:min-h-[calc(100dvh-3rem)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-sky-700">Speech Diary</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 lg:text-4xl">QR 코드를 보여주세요</h1>
          </div>
          <Link
            href="/"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            ← 처음으로
          </Link>
        </div>

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_340px]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[1.5rem] bg-slate-900">
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />

              <div className="pointer-events-none absolute inset-0 bg-black/18" />

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="relative h-full max-h-[360px] w-full max-w-[460px] rounded-[1.75rem] border-4 border-white/90">
                  <div className="absolute -left-1 -top-1 h-10 w-10 rounded-tl-[1.75rem] border-l-8 border-t-8 border-sky-400" />
                  <div className="absolute -right-1 -top-1 h-10 w-10 rounded-tr-[1.75rem] border-r-8 border-t-8 border-sky-400" />
                  <div className="absolute -bottom-1 -left-1 h-10 w-10 rounded-bl-[1.75rem] border-b-8 border-l-8 border-sky-400" />
                  <div className="absolute -bottom-1 -right-1 h-10 w-10 rounded-br-[1.75rem] border-b-8 border-r-8 border-sky-400" />
                </div>
              </div>

              <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-700">
                {ready ? '스캔 중' : '카메라 준비 중'}
              </div>

              <div className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-2xl bg-black/55 px-4 py-3 text-center text-sm font-medium text-white">
                학생 QR 카드를 화면 중앙 네모 안에 맞춰주세요
              </div>

              {!ready && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/60">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent" />
                  <p className="text-sm font-semibold text-white">카메라를 연결하고 있어요</p>
                </div>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black tracking-tight text-slate-900">이렇게 사용해요</h2>
              <div className="mt-5 space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-black text-sky-700">1</div>
                  <div>
                    <p className="font-bold text-slate-900">학생 QR 카드를 준비합니다</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">학생 관리에서 출력한 표준 QR 카드를 사용해주세요.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-black text-sky-700">2</div>
                  <div>
                    <p className="font-bold text-slate-900">화면 중앙에 맞춰 보여줍니다</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">카드를 너무 가까이 대지 말고, 네모 안에 들어오게 맞춰주세요.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-black text-sky-700">3</div>
                  <div>
                    <p className="font-bold text-slate-900">자동으로 다음 화면으로 이동합니다</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">학생 확인 후 녹음 카운트다운이 바로 시작됩니다.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-bold text-slate-900">스캔이 잘 안 되면</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <p>QR 카드가 구겨지지 않았는지 확인해주세요.</p>
                <p>조명을 밝게 하거나 그림자를 줄여주세요.</p>
                <p>카드를 조금 멀리 움직여 초점을 다시 맞춰주세요.</p>
              </div>
            </div>

            {loading && (
              <div className="rounded-[1.5rem] bg-emerald-500 px-5 py-4 text-center text-base font-black text-white shadow-sm">
                학생을 확인하는 중...
              </div>
            )}

            {error && (
              <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-center text-sm font-bold text-rose-600">
                {error}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
