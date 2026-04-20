import Link from 'next/link'

interface Props {
  studentId: string
  classCode: string
}

export default function QrCardButton({ studentId, classCode }: Props) {
  const href = `/${classCode}/students/qr-cards?studentId=${encodeURIComponent(studentId)}`
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-xl transition-colors"
    >
      🪪 QR 카드
    </Link>
  )
}
