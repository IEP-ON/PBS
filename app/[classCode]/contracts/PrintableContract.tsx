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
  reward_description?: string | null
  behavior_image_url?: string | null
  reward_image_url?: string | null
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
            margin: 5mm 5mm;
          }
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
            zoom: 0.78;
            margin: 0 auto !important;
          }
          .contract-header-inner { padding: 2mm 5mm !important; }
          .contract-body-inner  { padding: 2mm 5mm !important; }

          .contract-body-inner .mb-5 { margin-bottom: 1.5mm !important; }
          .contract-body-inner .mb-4 { margin-bottom: 1.5mm !important; }
          .contract-body-inner .mb-3 { margin-bottom: 1mm !important; }
          .contract-body-inner .mt-6 { margin-top: 2mm !important; }
          .contract-body-inner .pt-4 { padding-top: 1.5mm !important; }

          .qr-attach-strip {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .qr-attach-cell {
            width: 38mm !important;
            height: 38mm !important;
            flex-shrink: 0 !important;
            box-sizing: border-box !important;
          }

          .contract-visual img {
            max-width: 100px !important;
            max-height: 100px !important;
            object-fit: cover !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="no-print flex justify-center gap-3 py-6">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors"
        >
          ← 돌아가기
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
        >
          🖨️ 인쇄하기
        </button>
      </div>

      <div className="print-wrapper contract max-w-[780px] mx-auto pb-10">
        <div className="contract-paper bg-[#faf6ef] border border-[#c8b99a] shadow-[0_2px_0_#b8a888,4px_6px_20px_rgba(0,0,0,0.25)] relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(184,155,96,0.06) 27px, rgba(184,155,96,0.06) 28px)',
            }}
          />

          <div className="contract-header-inner relative bg-[#1a3a6b] text-white px-8 py-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center text-xl flex-shrink-0">
                🤝
              </div>
              <div>
                <div
                  className="text-[12px] font-semibold opacity-90 tracking-[1px]"
                  style={{ fontFamily: "'Noto Serif KR', serif" }}
                >
                  통합학급 · 함께 지키는 약속
                </div>
                <div className="text-[11px] opacity-75 mt-0.5">행복학급 행복은행 · HAENGBOK CLASS BANK</div>
              </div>
            </div>
            <div
              className="text-center text-[24px] font-black tracking-[4px] border-t border-white/30 pt-3"
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              행 동 계 약 서
            </div>
            <div className="text-[10px] opacity-70 text-right mt-1.5 tracking-[1px]">
              계약번호 HCB-{new Date().getFullYear()}-{contract.id.slice(0, 8)}
            </div>
          </div>

          <div className="contract-body-inner relative px-8 py-6 text-[#1a1410]">
            <div className="flex flex-wrap gap-3 items-center bg-[#e8eef8] border-[1.5px] border-[#b8c8e8] rounded-lg p-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-[#1a3a6b] flex items-center justify-center text-2xl flex-shrink-0">
                👦
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm flex-1 min-w-[200px]">
                <div>
                  <span className="text-[10px] text-[#1a3a6b] font-bold">이름</span>
                  <p className="font-bold">{contract.pbs_students?.name || '학생'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-[#1a3a6b] font-bold">계약제목</span>
                  <p className="font-bold">{contract.contract_title}</p>
                </div>
                <div className="col-span-2 text-[13px]">
                  <span className="text-[10px] text-[#1a3a6b] font-bold mr-2">기간</span>
                  {formatDate(contract.contract_start)}
                  <span className="mx-1.5 text-[#4a3f35]">→</span>
                  {contract.contract_end ? formatDate(contract.contract_end) : '종료일 미정'}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div
                className="text-[12px] font-bold text-[#1a3a6b] tracking-[1px] border-b-2 border-[#1a3a6b] pb-1 mb-2"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                📌 내가 지킬 행동
              </div>
              <div className="flex flex-col sm:flex-row gap-3 border-2 border-[#1a1410] rounded-lg overflow-hidden bg-white">
                <div className="contract-visual flex-shrink-0 w-full sm:w-[120px] h-[120px] bg-[#f5f0e6] flex items-center justify-center border-b sm:border-b-0 sm:border-r border-[#c8b99a]">
                  {contract.behavior_image_url ? (
                    <img
                      src={contract.behavior_image_url}
                      alt="표적 행동 그림"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl" aria-hidden>
                      🎯
                    </span>
                  )}
                </div>
                <div className="p-3 flex-1 min-w-0">
                  <p className="text-[16px] font-bold leading-snug">{contract.target_behavior}</p>
                  {contract.behavior_definition && (
                    <p className="text-[13px] text-[#4a3f35] leading-relaxed mt-2 border-l-[3px] border-[#c8b99a] pl-2">
                      {contract.behavior_definition}
                    </p>
                  )}
                  {contract.measurement_method && (
                    <p className="text-[11px] text-[#4a3f35] mt-2">측정: {contract.measurement_method}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div
                className="text-[12px] font-bold text-[#1a3a6b] tracking-[1px] border-b-2 border-[#1a3a6b] pb-1 mb-2"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                🎁 지키면 받을 수 있는 것
              </div>
              <div className="flex flex-col sm:flex-row gap-3 border-2 border-[#b8860b] rounded-lg overflow-hidden bg-white">
                <div className="contract-visual flex-shrink-0 w-full sm:w-[120px] h-[120px] bg-[#fff8f0] flex items-center justify-center border-b sm:border-b-0 sm:border-r border-[#e8c88a]">
                  {contract.reward_image_url ? (
                    <img
                      src={contract.reward_image_url}
                      alt="보상 그림"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl" aria-hidden>
                      🌟
                    </span>
                  )}
                </div>
                <div className="p-3 flex-1 min-w-0">
                  {contract.reward_description && (
                    <p className="text-[15px] font-bold text-[#1a1410] leading-snug">{contract.reward_description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-baseline gap-2">
                    <span className="inline-block bg-[#1a6b3a] text-white px-2.5 py-0.5 rounded-xl text-[14px] font-bold">
                      +{formatCurrency(contract.reward_amount)}
                    </span>
                    <span className="text-[12px] text-[#4a3f35]">조건 달성 시</span>
                  </div>
                  {contract.achievement_criteria && (
                    <p className="text-[12px] text-[#4a3f35] mt-2 leading-relaxed">달성 기준: {contract.achievement_criteria}</p>
                  )}
                </div>
              </div>
            </div>

            {contract.teacher_note && (
              <div className="bg-[#fff8f0] border border-[#e8c88a] rounded-md px-3 py-2 mb-4">
                <p className="text-[10px] font-bold text-[#b8860b] mb-1">교사 참고</p>
                <p className="text-[11px] text-[#4a3f35] leading-relaxed">{contract.teacher_note}</p>
              </div>
            )}

            <div className="mt-6 border-t-2 border-[#c8b99a] pt-4">
              <div
                className="text-[11px] font-bold text-[#4a3f35] tracking-[1px] text-center mb-3"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                위 내용에 동의하며 계약을 체결합니다
              </div>
              <div className="text-center text-[12px] text-[#4a3f35] mb-3">
                {new Date().getFullYear()}년 &nbsp;&nbsp;&nbsp;&nbsp; 월 &nbsp;&nbsp;&nbsp;&nbsp; 일
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="border border-[#c8b99a] rounded-md overflow-hidden">
                  <div className="bg-[#f0e9dc] px-2 py-1.5 text-[10px] font-bold text-[#4a3f35] text-center">교사</div>
                  <div className="px-2 py-2 min-h-[52px] flex flex-col justify-end">
                    <div
                      className={`h-7 border text-[9px] flex items-center justify-center rounded mb-1 ${
                        contract.teacher_signed ? 'border-solid bg-blue-50 text-blue-600 font-bold' : 'border-dashed border-[#c8b99a] text-[#c8b99a]'
                      }`}
                    >
                      {contract.teacher_signed ? '✓' : '서명'}
                    </div>
                    <div className="text-[10px] text-[#4a3f35]">성명: ________</div>
                  </div>
                </div>
                <div className="border border-[#c8b99a] rounded-md overflow-hidden">
                  <div className="bg-[#f0e9dc] px-2 py-1.5 text-[10px] font-bold text-[#4a3f35] text-center">학생</div>
                  <div className="px-2 py-2 min-h-[52px] flex flex-col justify-end">
                    <div
                      className={`h-7 border flex items-center justify-center rounded mb-1 ${
                        contract.student_signed ? 'border-solid bg-green-50 text-lg' : 'border-dashed border-[#c8b99a]'
                      }`}
                    >
                      {contract.student_signed ? '👋' : ''}
                    </div>
                    <div className="text-[11px] font-bold truncate">{contract.pbs_students?.name || ''}</div>
                  </div>
                </div>
                <div className="border border-[#c8b99a] rounded-md overflow-hidden">
                  <div className="bg-[#f0e9dc] px-2 py-1.5 text-[10px] font-bold text-[#4a3f35] text-center">보호자</div>
                  <div className="px-2 py-2 min-h-[52px] flex flex-col justify-end">
                    <div
                      className={`h-7 border text-[9px] flex items-center justify-center rounded mb-1 ${
                        contract.parent_signed ? 'border-solid bg-purple-50 text-purple-600 font-bold' : 'border-dashed border-[#c8b99a] text-[#c8b99a]'
                      }`}
                    >
                      {contract.parent_signed ? '✓' : '서명'}
                    </div>
                    <div className="text-[10px] text-[#4a3f35]">성명: ________</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="qr-attach-strip mt-5 border-t-2 border-[#c8b99a] pt-3">
              <p className="text-[10px] font-bold text-[#4a3f35] tracking-[0.5px] text-center mb-2 leading-snug">
                🪙 실물 QR 토큰(약 40mm)을 아래 칸에 붙여 주세요. 약속을 지킬 때마다 받은 토큰을 하나씩 붙이면 돼요.
              </p>
              <div
                className="flex flex-wrap justify-center gap-[1.5mm]"
                style={{ gap: '1.5mm' }}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className="qr-attach-cell border-2 border-dashed border-[#a89878] rounded-md flex flex-col items-center justify-center bg-white/80"
                  >
                    <span className="text-[#c8b99a] text-[11px] font-black">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
