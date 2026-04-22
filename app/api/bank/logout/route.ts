import { NextResponse } from 'next/server'
import { clearBankSession } from '@/lib/bank-session'

export async function POST() {
  await clearBankSession()
  return NextResponse.json({ ok: true })
}
