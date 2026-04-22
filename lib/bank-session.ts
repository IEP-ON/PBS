import { getIronSession, type IronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { BankSessionData } from '@/types'

const bankSessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_placeholder',
  cookieName: 'pbs-bank-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 12,
  },
}

export async function getBankSession(): Promise<IronSession<BankSessionData>> {
  const cookieStore = await cookies()
  return getIronSession<BankSessionData>(cookieStore, bankSessionOptions)
}

export async function clearBankSession(): Promise<void> {
  const session = await getBankSession()
  session.destroy()
}
