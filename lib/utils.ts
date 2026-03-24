// 금액 포맷 (예: 1000 → "1,000원")
export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

// 날짜 포맷 (ISO → "2026-03-21")
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// 학급 식별코드 생성 (예: NDG-2026-001)
export function generateClassCode(schoolName: string, year: number, seq: number): string {
  // 학교명에서 초성 추출 (간단 버전: 첫 3글자 영문화)
  const abbr = getSchoolAbbreviation(schoolName)
  const seqStr = String(seq).padStart(3, '0')
  return `${abbr}-${year}-${seqStr}`
}

// 학교 약어 생성 (한글 학교명 → 영문 약어)
function getSchoolAbbreviation(name: string): string {
  const chosung = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
    'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
  ]
  const chosungMap: Record<string, string> = {
    'ㄱ': 'G', 'ㄲ': 'GG', 'ㄴ': 'N', 'ㄷ': 'D', 'ㄸ': 'DD',
    'ㄹ': 'R', 'ㅁ': 'M', 'ㅂ': 'B', 'ㅃ': 'BB', 'ㅅ': 'S',
    'ㅆ': 'SS', 'ㅇ': '', 'ㅈ': 'J', 'ㅉ': 'JJ', 'ㅊ': 'C',
    'ㅋ': 'K', 'ㅌ': 'T', 'ㅍ': 'P', 'ㅎ': 'H',
  }

  const cleaned = name.replace(/초등학교|중학교|고등학교|학교|초|중|고/g, '').trim()
  let result = ''

  for (const char of cleaned) {
    const code = char.charCodeAt(0) - 0xAC00
    if (code >= 0 && code <= 11171) {
      const chosungIdx = Math.floor(code / 588)
      const mapped = chosungMap[chosung[chosungIdx]]
      if (mapped) result += mapped
    }
    if (result.length >= 3) break
  }

  return (result || 'PBS').toUpperCase().slice(0, 3)
}

// QR 코드 값 생성
export function generateQrCode(): string {
  return `QR-${crypto.randomUUID()}`
}

// Cron 인증 헤더 검증
export function verifyCronAuth(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

// 최저잔액 검증 (출금 가능 여부)
export function canWithdraw(currentBalance: number, amount: number, minBalance: number = 500): boolean {
  return currentBalance - amount >= minBalance
}
