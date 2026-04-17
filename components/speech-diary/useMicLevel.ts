'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 마이크 RMS 레벨 0~1 (기기·거리에 따라 상대값). 녹음 품질에는 영향 없음(모니터만).
 */
export function useMicLevel(stream: MediaStream | null, active: boolean) {
  const [level, setLevel] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!stream || !active) {
      setLevel(0)
      return
    }

    let audioCtx: AudioContext | null = null
    let source: MediaStreamAudioSourceNode | null = null
    let analyser: AnalyserNode | null = null
    const timeData = new Uint8Array(256)

    const start = async () => {
      try {
        audioCtx = new AudioContext()
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume().catch(() => {})
        }
        source = audioCtx.createMediaStreamSource(stream)
        analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.82
        source.connect(analyser)

        const tick = () => {
          if (!analyser) return
          analyser.getByteTimeDomainData(timeData)
          let sumSq = 0
          for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i]! - 128) / 128
            sumSq += v * v
          }
          const rms = Math.sqrt(sumSq / timeData.length)
          const normalized = Math.min(1, rms * 4.2)
          setLevel((prev) => prev * 0.65 + normalized * 0.35)
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch {
        setLevel(0)
      }
    }

    void start()

    return () => {
      cancelAnimationFrame(rafRef.current)
      try {
        source?.disconnect()
        analyser?.disconnect()
      } catch {
        /* ignore */
      }
      if (audioCtx) {
        void audioCtx.close()
      }
    }
  }, [stream, active])

  return level
}
