import { Suspense } from 'react'
import HomeClient from './home-client'

export default function Home() {
  return (
    <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center bg-slate-50">불러오는 중…</div>}>
      <HomeClient />
    </Suspense>
  )
}
