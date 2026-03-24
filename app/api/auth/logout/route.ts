import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/session'

// POST /api/auth/logout
export async function POST(request: Request) {
  try {
    await clearSession()

    // HTML form 제출 시 redirect, fetch 호출 시 JSON 응답
    const accept = request.headers.get('accept') || ''
    if (accept.includes('text/html')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
