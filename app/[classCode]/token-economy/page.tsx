'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function TokenEconomyPage() {
  const params = useParams()
  const classCode = params.classCode as string

  const tabs = [
    { id: 'shop', label: '가게', icon: '🏪', description: '상점 아이템 관리', href: `/${classCode}/shop` },
    { id: 'stocks', label: '주식', icon: '📈', description: '모의 주식 시장', href: `/${classCode}/stocks` },
    { id: 'qr-tokens', label: 'QR 토큰', icon: '🪙', description: '실물 코인 QR', href: `/${classCode}/qr-tokens` },
    { id: 'class-account', label: '학급 계좌', icon: '🏫', description: '공동 적립금', href: `/${classCode}/class-account` },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🏪 토큰 경제 시스템</h1>
        <p className="text-sm text-gray-500 mt-1">토큰의 획득·소비·투자·공동 관리를 한 곳에서</p>
      </div>

      {/* 안내 메시지 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-900 font-medium mb-2">📌 토큰 경제 통합 페이지</p>
        <p className="text-sm text-blue-700">
          가게, 주식, QR 토큰, 학급 계좌 기능이 하나의 &quot;토큰 경제&quot; 카테고리로 통합되었습니다.
          아래 버튼을 클릭하여 각 기능으로 이동하세요.
        </p>
      </div>

      {/* 탭 네비게이션 (큰 버튼) */}
      <div className="grid grid-cols-2 gap-4">
        {tabs.map(tab => (
          <Link
            key={tab.id}
            href={tab.href}
            className="flex flex-col items-center gap-3 p-6 bg-white border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-2xl transition-all group"
          >
            <span className="text-5xl group-hover:scale-110 transition-transform">{tab.icon}</span>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{tab.label}</div>
              <div className="text-sm text-gray-500 mt-1">{tab.description}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* 설명 */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-600">
        <p><strong className="text-gray-900">🏪 가게:</strong> 학생들이 토큰으로 구매할 수 있는 아이템 관리</p>
        <p><strong className="text-gray-900">📈 주식:</strong> 모의 주식 시장 가격 및 종목 관리</p>
        <p><strong className="text-gray-900">🪙 QR 토큰:</strong> 실물 코인용 QR 코드 배치 생성 및 인쇄</p>
        <p><strong className="text-gray-900">🏫 학급 계좌:</strong> 학급 공동 적립금 입출금 관리</p>
      </div>
    </div>
  )
}
