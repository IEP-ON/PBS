'use client'

import { formatCurrency } from '@/lib/utils'

interface Contract {
  id: string
  student_id: string
  contract_title: string
  target_behavior: string
  behavior_definition: string | null
  measurement_method: string | null
  achievement_criteria: string | null
  reward_amount: number
  contract_start: string
  contract_end: string | null
  is_active: boolean
  teacher_signed: boolean
  student_signed: boolean
  parent_signed: boolean
  teacher_note: string | null
  created_at: string
  pbs_students: { name: string } | null
}

interface PrintableContractProps {
  contract: Contract
  onClose: () => void
}

export default function PrintableContract({ contract, onClose }: PrintableContractProps) {
  const handlePrint = () => {
    window.print()
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
  }

  return (
    <div className="fixed inset-0 bg-[#d4c9b5] z-50 overflow-y-auto">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700;900&family=Noto+Sans+KR:wght@400;500;700&display=swap');

        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          @page { size: A4; margin: 0; }
          .contract-paper { 
            box-shadow: none !important; 
            border: 1px solid #000 !important;
            page-break-after: always;
            transform: scale(0.96);
            transform-origin: top center;
          }
          * { color: #000000 !important; }
        }
      `}</style>

      {/* 버튼 영역 (인쇄 시 숨김) */}
      <div className="no-print flex justify-center gap-3 py-6">
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors"
        >
          ← 돌아가기
        </button>
        <button
          onClick={handlePrint}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
        >
          🖨️ 인쇄하기
        </button>
      </div>

      {/* 계약서 본문 */}
      <div className="contract max-w-[780px] mx-auto pb-10">
        <div className="contract-paper bg-[#faf6ef] border border-[#000000] shadow-[0_2px_0_#b8a888,4px_6px_20px_rgba(0,0,0,0.25)] relative overflow-hidden text-[#000000]">
          
          {/* 배경 무늬 */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(0,0,0,0.06) 27px, rgba(0,0,0,0.06) 28px)'
          }}></div>

          {/* 헤더 */}
          <div className="relative bg-[#1a3a6b] text-[#000000] px-8 py-5" style={{ backgroundColor: '#ffffff', borderBottom: '2px solid #000000' }}>
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0 border border-[#000000]">
                🏦
              </div>
              <div>
                <div className="text-[12px] font-semibold tracking-[2px]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  행복학급 행복은행 · HAENGBOK CLASS BANK
                </div>
              </div>
            </div>
            <div className="text-center text-[26px] font-black tracking-[6px] border-t border-[#000000] pt-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              행 동 계 약 서
            </div>
            <div className="text-[11px] text-right mt-1 tracking-[1px]">
              계약번호 HCB-{new Date().getFullYear()}-{contract.id.slice(0, 8)}
            </div>
          </div>

          {/* 본문 */}
          <div className="relative px-8 py-6">
            
            {/* 공식 인장 */}
            <div className="absolute top-6 right-8 w-[60px] h-[60px] border-[2px] border-[#000000] rounded-full flex flex-col items-center justify-center text-[8px] font-black tracking-[0.5px] -rotate-12 text-center leading-tight p-1">
              행복은행<br/>공식<br/>계약
            </div>

            {/* 학생 정보 카드 */}
            <div className="flex items-center gap-4 border-[1px] border-[#000000] rounded-lg p-4 mb-5 bg-white">
              <div className="w-14 h-14 rounded-full border border-[#000000] flex items-center justify-center text-[28px] flex-shrink-0">
                👦
              </div>
              <div className="grid grid-cols-2 gap-y-1 gap-x-6 flex-1">
                <div className="flex gap-2 items-baseline">
                  <span className="text-[11px] font-bold tracking-[0.5px] min-w-[52px]">이름</span>
                  <span className="text-[13px] font-bold">{contract.pbs_students?.name || '학생'}</span>
                </div>
                <div className="flex gap-2 items-baseline">
                  <span className="text-[11px] font-bold tracking-[0.5px] min-w-[52px]">계약번호</span>
                  <span className="text-[13px] font-bold">{contract.id.slice(0, 8)}</span>
                </div>
                <div className="flex gap-2 items-baseline">
                  <span className="text-[11px] font-bold tracking-[0.5px] min-w-[52px]">계약제목</span>
                  <span className="text-[13px] font-bold">{contract.contract_title}</span>
                </div>
                <div className="flex gap-2 items-baseline">
                  <span className="text-[11px] font-bold tracking-[0.5px] min-w-[52px]">상태</span>
                  <span className="text-[13px] font-bold">{contract.is_active ? '진행중' : '종료'}</span>
                </div>
              </div>
            </div>

            {/* 계약 기간 */}
            <div className="border border-[#000000] rounded-lg px-4 py-2.5 flex items-center gap-4 mb-4 bg-white">
              <div className="text-xl">📅</div>
              <div className="flex-1">
                <div className="text-[10px] font-bold tracking-[0.5px] mb-0.5">계약 기간</div>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-bold">{formatDate(contract.contract_start)}</span>
                  <span className="text-[15px] font-bold">→</span>
                  <span className="text-[13px] font-bold">{contract.contract_end ? formatDate(contract.contract_end) : '종료일 미정'}</span>
                </div>
              </div>
            </div>

            {/* 목표 행동 */}
            <div className="mb-4">
              <div className="text-[12px] font-bold tracking-[2px] border-b-[1.5px] border-[#000000] pb-1 mb-2.5 flex items-center gap-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                📌 제1조 — 목표 행동 (업무 내용)
              </div>
              <div className="border border-[#000000] rounded-md overflow-hidden mb-3">
                <div className="border-b border-[#000000] px-4 py-2 text-[11px] font-bold tracking-[1px] flex items-center gap-2 bg-[#f8f8f8]">
                  🎯 내가 약속하는 행동
                </div>
                <div className="bg-white p-3">
                  <div className="text-[15px] font-bold mb-1.5 leading-snug">
                    {contract.target_behavior}
                  </div>
                  {contract.behavior_definition && (
                    <div className="text-[12px] leading-relaxed border-l-[2px] border-[#000000] pl-2.5">
                      {contract.behavior_definition}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 달성 조건 및 보상 */}
            <div className="mb-4">
              <div className="text-[12px] font-bold tracking-[2px] border-b-[1.5px] border-[#000000] pb-1 mb-2.5 flex items-center gap-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                💰 제2조 — 임금 (달성 조건과 보상)
              </div>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="bg-[#f8f8f8] border border-[#000000] px-3 py-2 text-[10px] font-bold tracking-[1px] text-center">조건</th>
                    <th className="bg-[#f8f8f8] border border-[#000000] px-3 py-2 text-[10px] font-bold tracking-[1px] text-center">달성 기준</th>
                    <th className="bg-[#f8f8f8] border border-[#000000] px-3 py-2 text-[10px] font-bold tracking-[1px] text-center">보상</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-[#000000] px-3 py-2.5 align-middle">🌟 기본 보상</td>
                    <td className="border border-[#000000] px-3 py-2.5 align-middle">
                      {contract.achievement_criteria || '목표 행동 달성 시'}
                      {contract.measurement_method && (
                        <div className="text-[10px] mt-1">
                          측정: {contract.measurement_method}
                        </div>
                      )}
                    </td>
                    <td className="border border-[#000000] px-3 py-2.5 align-middle text-center">
                      <span className="inline-block border border-[#000000] px-2 py-0.5 rounded text-[12px] font-bold">
                        +{formatCurrency(contract.reward_amount)}
                      </span>
                      <div className="text-[10px] mt-1">조건 달성 시</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 정산 안내 */}
            <div className="mb-4">
              <div className="text-[12px] font-bold tracking-[2px] border-b-[1.5px] border-[#000000] pb-1 mb-2.5 flex items-center gap-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                🏧 제3조 — 임금 지급일 (정산 방법)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white border border-[#000000] rounded-md px-3 py-2.5 flex gap-2 items-start">
                  <div className="text-lg flex-shrink-0">📱</div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.5px] mb-0.5">확인 방법</div>
                    <div className="text-[12px] font-bold">뱅킹앱</div>
                  </div>
                </div>
                <div className="bg-white border border-[#000000] rounded-md px-3 py-2.5 flex gap-2 items-start">
                  <div className="text-lg flex-shrink-0">⏰</div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.5px] mb-0.5">입금 시간</div>
                    <div className="text-[12px] font-bold">조건 달성 즉시</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 약속 조항 */}
            <div className="mb-4">
              <div className="text-[12px] font-bold tracking-[2px] border-b-[1.5px] border-[#000000] pb-1 mb-2.5 flex items-center gap-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                📜 제4조 — 특약 사항 (우리의 약속)
              </div>
              <div className="bg-white border-[1px] border-[#000000] rounded-lg px-4 py-4 mb-2">
                <div className="text-[10px] font-bold tracking-[1.5px] mb-2">🤝 학생의 약속</div>
                <ul className="space-y-1.5">
                  <li className="flex gap-2 items-start text-[12px] leading-relaxed">
                    <span className="text-[10px] mt-1 flex-shrink-0">◆</span>
                    <span>이 계약서에 명시된 목표 행동을 달성하기 위해 최선을 다하겠습니다.</span>
                  </li>
                  <li className="flex gap-2 items-start text-[12px] leading-relaxed">
                    <span className="text-[10px] mt-1 flex-shrink-0">◆</span>
                    <span>약속한 행동을 지속적으로 실천하겠습니다.</span>
                  </li>
                </ul>
              </div>
              <div className="bg-white border-[1px] border-[#000000] rounded-lg px-4 py-4">
                <div className="text-[10px] font-bold tracking-[1.5px] mb-2">🏫 선생님의 약속</div>
                <ul className="space-y-1.5">
                  <li className="flex gap-2 items-start text-[12px] leading-relaxed">
                    <span className="text-[10px] mt-1 flex-shrink-0">◆</span>
                    <span>조건을 달성하면 약속한 금액을 반드시 제때 입금하겠습니다.</span>
                  </li>
                  <li className="flex gap-2 items-start text-[12px] leading-relaxed">
                    <span className="text-[10px] mt-1 flex-shrink-0">◆</span>
                    <span>계약이 잘 진행되도록 매일 함께 확인하겠습니다.</span>
                  </li>
                </ul>
              </div>
              {contract.teacher_note && (
                <div className="bg-white border-[1px] border-dashed border-[#000000] rounded-md px-3 py-2.5 mt-2">
                  <div className="text-[10px] font-bold tracking-[1px] mb-1 flex items-center gap-1.5">
                    ⚠️ 교사 참고사항
                  </div>
                  <p className="text-[11px] leading-relaxed">{contract.teacher_note}</p>
                </div>
              )}
            </div>

            {/* 서명란 */}
            <div className="mt-6 border-t-[1.5px] border-[#000000] pt-4">
              <div className="text-[11px] font-bold tracking-[2px] text-center mb-4" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                위 내용에 동의하며 계약을 체결합니다
              </div>
              <div className="text-center text-[12px] mb-3">
                {new Date().getFullYear()}년 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 월 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 일
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="border-[1px] border-[#000000] rounded-md overflow-hidden">
                  <div className="bg-[#f8f8f8] border-b border-[#000000] px-2 py-1.5 text-[10px] font-bold tracking-[1px] text-center">
                    🏫 교사 (사용자)
                  </div>
                  <div className="px-2 py-3 min-h-[60px] flex flex-col justify-end bg-white">
                    <div className={`h-8 border-[1px] ${contract.teacher_signed ? 'border-solid' : 'border-dashed'} border-[#000000] rounded flex items-center justify-center text-[9px] font-bold tracking-[0.5px] mb-1`}>
                      {contract.teacher_signed ? '✓ 서명완료' : '인 / 서명'}
                    </div>
                    <div className="border-b border-[#000000] pb-1 text-[12px] font-bold min-h-6"></div>
                    <div className="text-[10px] mt-1">성명: _____________</div>
                  </div>
                </div>
                <div className="border-[1px] border-[#000000] rounded-md overflow-hidden">
                  <div className="bg-[#f8f8f8] border-b border-[#000000] px-2 py-1.5 text-[10px] font-bold tracking-[1px] text-center">
                    👦 학생 (근로자)
                  </div>
                  <div className="px-2 py-3 min-h-[60px] flex flex-col justify-end bg-white">
                    <div className={`h-8 border-[1px] ${contract.student_signed ? 'border-solid' : 'border-dashed'} border-[#000000] rounded flex items-center justify-center text-[9px] font-bold tracking-[0.5px] mb-1`}>
                      {contract.student_signed ? '✓ 서명완료' : '인 / 서명'}
                    </div>
                    <div className="border-b border-[#000000] pb-1 text-[12px] font-bold min-h-6 text-center">
                      {contract.pbs_students?.name || ''}
                    </div>
                    <div className="text-[10px] mt-1 text-center">성명: _____________</div>
                  </div>
                </div>
                <div className="border-[1px] border-[#000000] rounded-md overflow-hidden">
                  <div className="bg-[#f8f8f8] border-b border-[#000000] px-2 py-1.5 text-[10px] font-bold tracking-[1px] text-center">
                    👨‍👩‍👦 보호자 (확인)
                  </div>
                  <div className="px-2 py-3 min-h-[60px] flex flex-col justify-end bg-white">
                    <div className={`h-8 border-[1px] ${contract.parent_signed ? 'border-solid' : 'border-dashed'} border-[#000000] rounded flex items-center justify-center text-[9px] font-bold tracking-[0.5px] mb-1`}>
                      {contract.parent_signed ? '✓ 서명완료' : '인 / 서명'}
                    </div>
                    <div className="border-b border-[#000000] pb-1 text-[12px] font-bold min-h-6"></div>
                    <div className="text-[10px] mt-1">성명: _____________</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
