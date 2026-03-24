import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData } from '@/types'

const sessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_placeholder',
  cookieName: 'pbs-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, sessionOptions)
  const path = request.nextUrl.pathname

  // 교사 전용 경로
  if (path.match(/^\/[^/]+\/dashboard/) || path.match(/^\/[^/]+\/pbs/) || path.match(/^\/[^/]+\/students/) || path.match(/^\/[^/]+\/stocks/) || path.match(/^\/[^/]+\/shop/) || path.match(/^\/[^/]+\/contracts/) || path.match(/^\/[^/]+\/bankbook/) || path.match(/^\/[^/]+\/ai/) || path.match(/^\/[^/]+\/settings/)) {
    if (!session.role || session.role !== 'teacher') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // 학생 전용 경로
  if (path.match(/^\/s\/[^/]+\/[^/]+\//)) {
    if (!session.role || session.role !== 'student') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|login|register|atm).*)',
  ],
}
