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
    <div className="print-outer fixed inset-0 bg-[#d4c9b5] z-50 overflow-y-auto">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700;900&family=Noto+Sans+KR:wght@400;500;700&display=swap');

        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          /* 전체 숨김 → 계약서 컨테이너만 표시 */
          body * { visibility: hidden !important; }
          .print-outer,
          .print-outer * { visibility: visible !important; }

          .no-print { display: none !important; }

          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-outer {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            background: white !important;
            overflow: visible !important;
            z-index: 99999 !important;
          }
          .print-wrapper {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .contract-paper {
            box-shadow: none !important;
            border: none !important;
            zoom: 0.73;
            margin: 0 auto !important;
          }
          .contract-header-inner { padding: 3mm 6mm !important; }
          .contract-body-inner  { padding: 3mm 7mm !important; }

          /* 섹션 간격 압축 */
          .contract-header-inner .mb-4  { margin-bottom: 1mm !important; }
          .contract-header-inner .pt-4  { padding-top: 1.5mm !important; }
          .contract-header-inner .mt-2  { margin-top: 0.5mm !important; }

          .contract-body-inner .mb-7    { margin-bottom: 2mm !important; }
          .contract-body-inner .mb-6    { margin-bottom: 2mm !important; }
          .contract-body-inner .mb-5    { margin-bottom: 2mm !important; }
          .contract-body-inner .mb-4    { margin-bottom: 1.5mm !important; }
          .contract-body-inner .mb-3    { margin-bottom: 1.5mm !important; }
          .contract-body-inner .mb-2\.5 { margin-bottom: 1mm !important; }
          .contract-body-inner .mb-1\.5 { margin-bottom: 0.5mm !important; }
          .contract-body-inner .mb-3\.5 { margin-bottom: 1.5mm !important; }
          .contract-body-inner .mt-8    { margin-top: 3mm !important; }
          .contract-body-inner .pt-6    { padding-top: 2mm !important; }
          .contract-body-inner .pb-1\.5 { padding-bottom: 0.5mm !important; }

          /* 내부 패딩 압축 */
          .contract-body-inner .py-5    { padding-top: 2mm !important; padding-bottom: 2mm !important; }
          .contract-body-inner .py-4    { padding-top: 1.5mm !important; padding-bottom: 1.5mm !important; }
          .contract-body-inner .py-3    { padding-top: 1.5mm !important; padding-bottom: 1.5mm !important; }
          .contract-body-inner .py-3\.5 { padding-top: 1.5mm !important; padding-bottom: 1.5mm !important; }
          .contract-body-inner .py-2\.5 { padding-top: 1mm !important; padding-bottom: 1mm !important; }

          /* 리스트 간격 */
          .contract-body-inner .space-y-2 > * + * { margin-top: 0.5mm !important; }

          /* 서명란 압축 */
          .contract-body-inner .min-h-\[70px\] { min-height: 36px !important; }
          .contract-body-inner .h-9            { height: 20px !important; }
          .contract-body-inner .min-h-7        { min-height: 16px !important; }
          .contract-body-inner .gap-4          { gap: 2mm !important; }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
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
      <div className="print-wrapper contract max-w-[780px] mx-auto pb-10">
        <div className="contract-paper bg-[#faf6ef] border border-[#c8b99a] shadow-[0_2px_0_#b8a888,4px_6px_20px_rgba(0,0,0,0.25)] relative overflow-hidden">
          
          {/* 배경 무늬 */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(184,155,96,0.06) 27px, rgba(184,155,96,0.06) 28px)'
          }}></div>

          {/* 헤더 */}
          <div className="contract-header-inner relative bg-[#1a3a6b] text-white px-10 py-7">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl flex-shrink-0">
                🏦
              </div>
              <div>
                <div className="text-[13px] font-semibold opacity-85 tracking-[2px]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  행복학급 행복은행 · HAENGBOK CLASS BANK
                </div>
              </div>
            </div>
            <div className="text-center text-[28px] font-black tracking-[6px] border-t border-white/30 pt-4" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              행 동 계 약 서
            </div>
            <div className="text-[11px] opacity-70 text-right mt-2 tracking-[1px]">
              계약번호 HCB-{new Date().getFullYear()}-{contract.id.slice(0, 8)}
            </div>
          </div>

          {/* 본문 */}
          <div className="contract-body-inner relative px-11 py-9">
            
            {/* 공식 인장 */}
            <div className="absolute top-9 right-11 w-[68px] h-[68px] border-[3px] border-[#c0392b] rounded-full flex flex-col items-center justify-center text-[#c0392b] text-[9px] font-black tracking-[0.5px] opacity-60 -rotate-12 text-center leading-tight p-1.5">
              행복은행<br/>공식<br/>계약
            </div>

            {/* 학생 정보 카드 */}
            <div className="flex items-center gap-5 bg-[#e8eef8] border-[1.5px] border-[#b8c8e8] rounded-lg p-5 mb-7">
              <div className="w-16 h-16 rounded-full bg-[#1a3a6b] flex items-center justify-center text-[30px] flex-shrink-0">
                👦
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-6 flex-1">
                <div className="flex gap-2 items-baseline">
                  <span className="text-[11px] text-[#1a3a6b] font-bold tracking-[0.5px] min-w-[52px]">이름</span>
                  <span className="text-[14px] font-bold text-[#1a1410]">{contract.pbs_students?.name || '학생'}</span>
                </div>
                <div className="flex gap-2 items-baseline">
                  <span className="text-[11px] text-[#1a3a6b] font-bold tracking-[0.5px] min-w-[52px]">계약번호</span>
                  <span className="text-[14px] font-bold text-[#1a1410]">{contract.id.slice(0, 8)}</span>
                </div>
                <div className="flex gap-2 items-baseline">
                  <span className="text-[11px] text-[#1a3a6b] font-bold tracking-[0.5px] min-w-[52px]">계약제목</span>
                  <span className="text-[14px] font-bold text-[#1a1410]">{contract.contract_title}</span>
                </div>
                <div className="flex gap-2 items-baseline">
                  <span className="text-[11px] text-[#1a3a6b] font-bold tracking-[0.5px] min-w-[52px]">상태</span>
                  <span className="text-[14px] font-bold text-[#1a1410]">{contract.is_active ? '진행중' : '종료'}</span>
                </div>
              </div>
            </div>

            {/* 계약 기간 */}
            <div className="bg-[#f0e9dc] border border-[#c8b99a] rounded-lg px-5 py-3.5 flex items-center gap-4 mb-5">
              <div className="text-2xl">📅</div>
              <div className="flex-1">
                <div className="text-[11px] text-[#4a3f35] font-bold tracking-[0.5px] mb-0.5">계약 기간</div>
                <div className="flex items-center gap-3">
                  <span className="text-[15px] font-bold text-[#1a1410]">{formatDate(contract.contract_start)}</span>
                  <span className="text-[#4a3f35] text-lg">→</span>
                  <span className="text-[15px] font-bold text-[#1a1410]">{contract.contract_end ? formatDate(contract.contract_end) : '종료일 미정'}</span>
                </div>
              </div>
            </div>

            {/* 목표 행동 */}
            <div className="mb-6">
              <div className="text-[13px] font-bold text-[#1a3a6b] tracking-[2px] border-b-2 border-[#1a3a6b] pb-1.5 mb-3.5 flex items-center gap-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                📌 제1조 — 목표 행동 (업무 내용)
              </div>
              <div className="border-2 border-[#1a1410] rounded-md overflow-hidden mb-4">
                <div className="bg-[#1a1410] text-white px-4 py-2.5 text-[12px] font-bold tracking-[1px] flex items-center gap-2">
                  🎯 내가 약속하는 행동
                </div>
                <div className="bg-white p-4">
                  <div className="text-lg font-bold text-[#1a1410] mb-2 leading-snug">
                    {contract.target_behavior}
                  </div>
                  {contract.behavior_definition && (
                    <div className="text-[13px] text-[#4a3f35] leading-relaxed border-l-[3px] border-[#c8b99a] pl-3">
                      {contract.behavior_definition}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 달성 조건 및 보상 */}
            <div className="mb-6">
              <div className="text-[13px] font-bold text-[#1a3a6b] tracking-[2px] border-b-2 border-[#1a3a6b] pb-1.5 mb-3.5 flex items-center gap-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                💰 제2조 — 임금 (달성 조건과 보상)
              </div>
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr>
                    <th className="bg-[#f0e9dc] border border-[#c8b99a] px-3.5 py-2.5 text-[11px] font-bold text-[#4a3f35] tracking-[1px] text-center">조건</th>
                    <th className="bg-[#f0e9dc] border border-[#c8b99a] px-3.5 py-2.5 text-[11px] font-bold text-[#4a3f35] tracking-[1px] text-center">달성 기준</th>
                    <th className="bg-[#f0e9dc] border border-[#c8b99a] px-3.5 py-2.5 text-[11px] font-bold text-[#4a3f35] tracking-[1px] text-center">보상</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-[#c8b99a] px-3.5 py-3 align-middle text-[#1a1410]">🌟 기본 보상</td>
                    <td className="border border-[#c8b99a] px-3.5 py-3 align-middle text-[#1a1410]">
                      {contract.achievement_criteria || '목표 행동 달성 시'}
                      {contract.measurement_method && (
                        <div className="text-[11px] text-[#1a1410] mt-1">
                          측정: {contract.measurement_method}
                        </div>
                      )}
                    </td>
                    <td className="border border-[#c8b99a] px-3.5 py-3 align-middle text-center">
                      <span className="inline-block bg-[#1a6b3a] text-white px-2.5 py-0.5 rounded-xl text-[13px] font-bold">
                        +{formatCurrency(contract.reward_amount)}
                      </span>
                      <div className="text-[11px] text-[#1a1410] mt-1">조건 달성 시</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 정산 안내 */}
            <div className="mb-6">
              <div className="text-[13px] font-bold text-[#1a3a6b] tracking-[2px] border-b-2 border-[#1a3a6b] pb-1.5 mb-3.5 flex items-center gap-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                🏧 제3조 — 임금 지급일 (정산 방법)
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white border border-[#c8b99a] rounded-md px-3.5 py-3 flex gap-2.5 items-start">
                  <div className="text-xl flex-shrink-0 mt-0.5">📱</div>
                  <div>
                    <div className="text-[11px] text-[#4a3f35] font-bold tracking-[0.5px] mb-0.5">확인 방법</div>
                    <div className="text-[13px] font-bold text-[#1a1410]">뱅킹앱</div>
                  </div>
                </div>
                <div className="bg-white border border-[#c8b99a] rounded-md px-3.5 py-3 flex gap-2.5 items-start">
                  <div className="text-xl flex-shrink-0 mt-0.5">⏰</div>
                  <div>
                    <div className="text-[11px] text-[#4a3f35] font-bold tracking-[0.5px] mb-0.5">입금 시간</div>
                    <div className="text-[13px] font-bold text-[#1a1410]">조건 달성 즉시</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 약속 조항 */}
            <div className="mb-6">
              <div className="text-[13px] font-bold text-[#1a3a6b] tracking-[2px] border-b-2 border-[#1a3a6b] pb-1.5 mb-3.5 flex items-center gap-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                📜 제4조 — 특약 사항 (우리의 약속)
              </div>
              <div className="bg-white border-2 border-[#b8860b] rounded-lg px-5 py-5 mb-2.5">
                <div className="text-[11px] font-bold text-[#b8860b] tracking-[1.5px] mb-3">🤝 학생의 약속</div>
                <ul className="space-y-2">
                  <li className="flex gap-2.5 items-start text-[13px] leading-relaxed text-[#1a1410]">
                    <span className="text-[#b8860b] text-[10px] mt-1 flex-shrink-0">◆</span>
                    <span>이 계약서에 명시된 목표 행동을 달성하기 위해 최선을 다하겠습니다.</span>
                  </li>
                  <li className="flex gap-2.5 items-start text-[13px] leading-relaxed text-[#1a1410]">
                    <span className="text-[#b8860b] text-[10px] mt-1 flex-shrink-0">◆</span>
                    <span>약속한 행동을 지속적으로 실천하겠습니다.</span>
                  </li>
                </ul>
              </div>
              <div className="bg-white border-2 border-[#1a3a6b] rounded-lg px-5 py-5">
                <div className="text-[11px] font-bold text-[#1a3a6b] tracking-[1.5px] mb-3">🏫 선생님의 약속</div>
                <ul className="space-y-2">
                  <li className="flex gap-2.5 items-start text-[13px] leading-relaxed text-[#1a1410]">
                    <span className="text-[#1a3a6b] text-[10px] mt-1 flex-shrink-0">◆</span>
                    <span>조건을 달성하면 약속한 금액을 반드시 제때 입금하겠습니다.</span>
                  </li>
                  <li className="flex gap-2.5 items-start text-[13px] leading-relaxed text-[#1a1410]">
                    <span className="text-[#1a3a6b] text-[10px] mt-1 flex-shrink-0">◆</span>
                    <span>계약이 잘 진행되도록 매일 함께 확인하겠습니다.</span>
                  </li>
                </ul>
              </div>
              {contract.teacher_note && (
                <div className="bg-[#fff8f0] border-[1.5px] border-[#e8c88a] rounded-md px-4 py-3.5 mt-2">
                  <div className="text-[11px] font-bold text-[#b8860b] tracking-[1px] mb-2 flex items-center gap-1.5">
                    ⚠️ 교사 참고사항
                  </div>
                  <p className="text-[12px] text-[#4a3f35] leading-relaxed">{contract.teacher_note}</p>
                </div>
              )}
            </div>

            {/* 서명란 */}
            <div className="mt-8 border-t-2 border-[#c8b99a] pt-6">
              <div className="text-[12px] font-bold text-[#4a3f35] tracking-[2px] text-center mb-5" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                위 내용에 동의하며 계약을 체결합니다
              </div>
              <div className="text-center text-[13px] text-[#4a3f35] mb-4">
                {new Date().getFullYear()}년 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 월 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 일
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="border-[1.5px] border-[#c8b99a] rounded-md overflow-hidden">
                  <div className="bg-[#f0e9dc] px-3 py-2 text-[11px] font-bold text-[#4a3f35] tracking-[1px] text-center">
                    🏫 교사 (사용자)
                  </div>
                  <div className="px-3 py-4 min-h-[70px] flex flex-col justify-end">
                    <div className={`h-9 border-[1.5px] ${contract.teacher_signed ? 'border-solid bg-blue-50' : 'border-dashed'} border-[#c8b99a] rounded flex items-center justify-center text-[10px] ${contract.teacher_signed ? 'text-blue-600 font-bold' : 'text-[#c8b99a] font-bold'} tracking-[0.5px] mb-1.5`}>
                      {contract.teacher_signed ? '✓ 서명완료' : '인 / 서명'}
                    </div>
                    <div className="border-b border-[#c8b99a] pb-1 text-[13px] font-bold text-[#1a1410] min-h-7"></div>
                    <div className="text-[11px] text-[#4a3f35] mt-1.5">성명: ________________</div>
                  </div>
                </div>
                <div className="border-[1.5px] border-[#c8b99a] rounded-md overflow-hidden">
                  <div className="bg-[#f0e9dc] px-3 py-2 text-[11px] font-bold text-[#4a3f35] tracking-[1px] text-center">
                    👦 학생 (근로자)
                  </div>
                  <div className="px-3 py-4 min-h-[70px] flex flex-col justify-end">
                    <div className={`h-9 border-[1.5px] ${contract.student_signed ? 'border-solid bg-green-50' : 'border-dashed'} border-[#c8b99a] rounded flex items-center justify-center text-xl ${contract.student_signed ? 'text-green-600' : 'text-[#c8b99a]'} mb-1.5`}>
                      {contract.student_signed ? '👋' : ''}
                    </div>
                    <div className="border-b border-[#c8b99a] pb-1 text-[13px] font-bold text-[#1a1410] min-h-7">
                      {contract.pbs_students?.name || ''}
                    </div>
                    <div className="text-[11px] text-[#4a3f35] mt-1.5">손도장 또는 서명</div>
                  </div>
                </div>
                <div className="border-[1.5px] border-[#c8b99a] rounded-md overflow-hidden">
                  <div className="bg-[#f0e9dc] px-3 py-2 text-[11px] font-bold text-[#4a3f35] tracking-[1px] text-center">
                    👨‍👩‍👦 보호자 (확인)
                  </div>
                  <div className="px-3 py-4 min-h-[70px] flex flex-col justify-end">
                    <div className={`h-9 border-[1.5px] ${contract.parent_signed ? 'border-solid bg-purple-50' : 'border-dashed'} border-[#c8b99a] rounded flex items-center justify-center text-[10px] ${contract.parent_signed ? 'text-purple-600 font-bold' : 'text-[#c8b99a] font-bold'} tracking-[0.5px] mb-1.5`}>
                      {contract.parent_signed ? '✓ 서명완료' : '인 / 서명'}
                    </div>
                    <div className="border-b border-[#c8b99a] pb-1 text-[13px] font-bold text-[#1a1410] min-h-7"></div>
                    <div className="text-[11px] text-[#4a3f35] mt-1.5">성명: ________________</div>
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
