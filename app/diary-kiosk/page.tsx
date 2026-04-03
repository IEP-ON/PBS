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
    <div className="min-h-[100dvh] overflow-hidden bg-[linear-gradient(135deg,#fef3c7_0%,#fde68a_18%,#f8fafc_46%,#dbeafe_74%,#e0f2fe_100%)] px-4 py-4 lg:px-6 lg:py-5">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-7xl flex-col gap-4 rounded-[2.5rem] border border-white/70 bg-white/60 p-4 shadow-[0_30px_120px_rgba(15,23,42,0.14)] backdrop-blur-xl lg:min-h-[calc(100dvh-2.5rem)] lg:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] bg-slate-950 px-5 py-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.34em] text-amber-300/80">Speech Diary Kiosk</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">말 일기장 QR 스캔</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white/90">
              {ready ? '카메라 준비 완료' : '카메라 연결 중'}
            </div>
            <Link
              href="/"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/15"
            >
              ← 처음으로
            </Link>
          </div>
        </div>

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.78fr)]">
          <section className="rounded-[2rem] border border-slate-900/10 bg-slate-950 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[1.65rem] bg-slate-900">
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />

              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_42%,rgba(2,6,23,0.56)_100%)]" />

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 lg:p-10">
                <div className="relative h-full max-h-[420px] w-full max-w-[520px] rounded-[2rem] border-[3px] border-dashed border-white/75 bg-white/[0.03] shadow-[0_0_0_999px_rgba(2,6,23,0.22)]">
                  <div className="absolute -left-1 -top-1 h-12 w-12 rounded-tl-[2rem] border-l-[9px] border-t-[9px] border-amber-300" />
                  <div className="absolute -right-1 -top-1 h-12 w-12 rounded-tr-[2rem] border-r-[9px] border-t-[9px] border-amber-300" />
                  <div className="absolute -bottom-1 -left-1 h-12 w-12 rounded-bl-[2rem] border-b-[9px] border-l-[9px] border-sky-300" />
                  <div className="absolute -bottom-1 -right-1 h-12 w-12 rounded-br-[2rem] border-b-[9px] border-r-[9px] border-sky-300" />
                  <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/45 px-4 py-2 text-xs font-black uppercase tracking-[0.26em] text-white/90">
                    QR Frame
                  </div>
                </div>
              </div>

              <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-emerald-400/90 px-3 py-2 text-xs font-black uppercase tracking-[0.24em] text-emerald-950 shadow-lg">
                Live Scan
              </div>

              <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap items-center gap-2">
                <div className="rounded-full bg-black/45 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur">
                  학생 QR 카드를 프레임 중앙에 맞춰주세요
                </div>
                <div className="rounded-full bg-black/35 px-4 py-2 text-sm font-semibold text-white/80 backdrop-blur">
                  인식되면 자동으로 다음 단계로 이동합니다
                </div>
              </div>

              {!ready && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/65">
                  <div className="h-14 w-14 animate-spin rounded-full border-4 border-white border-t-transparent" />
                  <p className="text-base font-bold text-white/90">카메라 화면을 준비하고 있어요</p>
                </div>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <div className="rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-sm">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-amber-600/80">How To Scan</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">카드만 보여주면 끝나요</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                표준 학생 QR 카드를 카메라 안쪽 네모에 맞춰 보여주면, 학생 확인 뒤 자동으로 녹음 화면으로 넘어갑니다.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50/90 p-5">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-700">Step 1</p>
                <p className="mt-2 text-lg font-black text-slate-900">QR 카드 펼치기</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">구겨지지 않게 펴서 검은 QR가 잘 보이도록 해주세요.</p>
              </div>
              <div className="rounded-[1.6rem] border border-sky-200 bg-sky-50/90 p-5">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-700">Step 2</p>
                <p className="mt-2 text-lg font-black text-slate-900">프레임 중앙 맞추기</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">카드를 너무 가까이 대지 말고, 네모 안에 꽉 차게 맞춰주세요.</p>
              </div>
              <div className="rounded-[1.6rem] border border-emerald-200 bg-emerald-50/90 p-5">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">Step 3</p>
                <p className="mt-2 text-lg font-black text-slate-900">자동 녹음 시작</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">학생 이름 확인 후 5초 카운트다운과 15초 녹음이 이어집니다.</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200/80 bg-slate-50/90 p-5">
              <p className="text-sm font-black text-slate-900">스캔이 잘 안 될 때</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <p>밝기를 높이고 QR 카드의 그림자를 줄여주세요.</p>
                <p>카드를 살짝 뒤로 빼서 카메라 초점이 맞게 해주세요.</p>
                <p>학생 관리에서 출력한 표준 학생 QR 카드를 사용해주세요.</p>
              </div>
            </div>

            {loading && (
              <div className="rounded-[1.8rem] bg-emerald-500 px-6 py-5 text-center text-lg font-black text-white shadow-lg">
                학생을 확인하는 중...
              </div>
            )}

            {error && (
              <div className="rounded-[1.8rem] border border-rose-200 bg-rose-50 px-6 py-5 text-center text-base font-bold text-rose-600">
                {error}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
