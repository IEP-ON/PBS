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

/** 실물 QR 토큰 부착 슬롯 개수 (인쇄 하단 점선 칸) */
const QR_ATTACH_SLOT_COUNT = 4

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
    <div className="print-outer fixed inset-0 bg-slate-100 z-50 overflow-y-auto font-sans">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');

        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
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
          
          /* A4 width is 210mm. Margins are 8mm each side. Available width = 194mm */
          .print-wrapper {
            width: 194mm !important;
            max-width: 194mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }

          .qr-attach-strip {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .qr-attach-cell {
            width: 40mm !important;
            height: 40mm !important;
            flex-shrink: 0 !important;
            box-sizing: border-box !important;
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
          className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors shadow-sm"
        >
          ← 돌아가기
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm"
        >
          🖨️ 인쇄하기
        </button>
      </div>

      <div className="print-wrapper w-full max-w-[194mm] min-h-[277mm] mx-auto bg-white border border-slate-200 shadow-xl relative flex flex-col mb-10" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
        
        {/* Header */}
        <div className="text-center py-8 border-b-[6px] border-blue-500 bg-blue-50/30">
          <p className="text-[14px] font-bold text-blue-600 tracking-[2px] mb-2">통합학급에서 함께 지키는 약속</p>
          <h1 className="text-[32px] font-black text-slate-900 tracking-tight">행동 약속 증서</h1>
          <div className="absolute top-6 right-8 text-right">
            <p className="text-[11px] text-slate-400 font-medium">No. HCB-{new Date().getFullYear()}-{contract.id.slice(0, 8)}</p>
          </div>
        </div>

        {/* Info Bar */}
        <div className="flex justify-between items-center px-10 py-5 border-b border-slate-200">
          <div className="flex items-baseline gap-3">
            <span className="text-[13px] font-bold text-slate-400">학생</span>
            <span className="text-[20px] font-black text-slate-900">{contract.pbs_students?.name || '학생'}</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-[13px] font-bold text-slate-400">계약기간</span>
            <span className="text-[15px] font-bold text-slate-800">
              {formatDate(contract.contract_start)} ~ {contract.contract_end ? formatDate(contract.contract_end) : '종료일 미정'}
            </span>
          </div>
        </div>

        {/* Main Content: 2 Columns */}
        <div className="flex gap-6 px-10 py-8 flex-1">
          
          {/* Behavior Column */}
          <div className="flex-1 bg-blue-50/50 rounded-3xl p-6 border-2 border-blue-100 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-blue-400"></div>
            <div className="bg-blue-500 text-white px-5 py-1.5 rounded-full text-[13px] font-bold tracking-wide mb-6 mt-2 shadow-sm">
              내가 지킬 행동
            </div>
            
            <div className="w-[120px] h-[120px] bg-white rounded-2xl border-2 border-blue-100 flex items-center justify-center mb-6 shadow-sm overflow-hidden">
              {contract.behavior_image_url ? (
                <img src={contract.behavior_image_url} alt="표적 행동" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[60px]" aria-hidden>🎯</span>
              )}
            </div>

            <h2 className="text-[20px] font-black text-slate-900 mb-3 leading-tight break-keep">
              {contract.target_behavior}
            </h2>
            
            {contract.behavior_definition && (
              <p className="text-[14px] text-slate-600 leading-relaxed font-medium break-keep">
                {contract.behavior_definition}
              </p>
            )}
            
            {contract.measurement_method && (
              <div className="mt-auto pt-4">
                <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-[12px] font-bold">
                  측정: {contract.measurement_method}
                </span>
              </div>
            )}
          </div>

          {/* Reward Column */}
          <div className="flex-1 bg-amber-50/50 rounded-3xl p-6 border-2 border-amber-100 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-amber-400"></div>
            <div className="bg-amber-500 text-white px-5 py-1.5 rounded-full text-[13px] font-bold tracking-wide mb-6 mt-2 shadow-sm">
              지키면 받는 것
            </div>
            
            <div className="w-[120px] h-[120px] bg-white rounded-2xl border-2 border-amber-100 flex items-center justify-center mb-6 shadow-sm overflow-hidden">
              {contract.reward_image_url ? (
                <img src={contract.reward_image_url} alt="보상" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[60px]" aria-hidden>🎁</span>
              )}
            </div>

            <h2 className="text-[20px] font-black text-slate-900 mb-3 leading-tight break-keep">
              {contract.reward_description || '약속 달성 보상'}
            </h2>

            {contract.achievement_criteria && (
              <p className="text-[14px] text-slate-600 leading-relaxed font-medium break-keep mb-4">
                조건: {contract.achievement_criteria}
              </p>
            )}

            <div className="mt-auto pt-2">
              <span className="inline-block bg-green-600 text-white px-4 py-1.5 rounded-xl text-[18px] font-black shadow-sm">
                +{formatCurrency(contract.reward_amount)} 코인
              </span>
            </div>
          </div>

        </div>

        {/* Signatures */}
        <div className="px-10 py-6">
          <p className="text-center text-[15px] font-bold text-slate-700 mb-6">
            위 약속을 잘 지킬 것을 다짐하며 서명합니다.
          </p>
          <div className="flex justify-center gap-6">
            {/* Teacher */}
            <div className="w-[140px] border-b-2 border-slate-300 pb-2 text-center relative">
              <span className="text-[11px] font-bold text-slate-400 absolute top-[-18px] left-0 right-0">선생님</span>
              <div className="h-[40px] flex items-end justify-center">
                {contract.teacher_signed ? <span className="text-blue-600 font-bold text-[14px]">✓ 서명완료</span> : <span className="text-slate-300 text-[12px]">(서명)</span>}
              </div>
            </div>
            {/* Student */}
            <div className="w-[140px] border-b-2 border-slate-300 pb-2 text-center relative">
              <span className="text-[11px] font-bold text-slate-400 absolute top-[-18px] left-0 right-0">학생</span>
              <div className="h-[40px] flex items-end justify-center">
                {contract.student_signed ? <span className="text-[24px]">👋</span> : <span className="text-slate-300 text-[12px]">(손도장/서명)</span>}
              </div>
            </div>
            {/* Parent */}
            <div className="w-[140px] border-b-2 border-slate-300 pb-2 text-center relative">
              <span className="text-[11px] font-bold text-slate-400 absolute top-[-18px] left-0 right-0">보호자</span>
              <div className="h-[40px] flex items-end justify-center">
                {contract.parent_signed ? <span className="text-purple-600 font-bold text-[14px]">✓ 서명완료</span> : <span className="text-slate-300 text-[12px]">(서명)</span>}
              </div>
            </div>
          </div>
        </div>

        {/* QR Strip */}
        <div className="qr-attach-strip mt-auto bg-slate-50 px-10 py-8 border-t border-slate-200">
          <div className="flex items-center justify-center gap-2 mb-5">
            <span className="text-[16px]">🪙</span>
            <p className="text-[13px] font-bold text-slate-600 tracking-wide">
              약속을 지킬 때마다 아래 {QR_ATTACH_SLOT_COUNT}칸에 QR 토큰(약 40mm)을 붙여주세요!
            </p>
          </div>
          
          <div className="flex justify-between items-center max-w-[194mm] mx-auto">
            {Array.from({ length: QR_ATTACH_SLOT_COUNT }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                className="qr-attach-cell bg-white border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center shadow-sm"
                style={{ width: '40mm', height: '40mm' }}
              >
                <span className="text-slate-200 text-[24px] font-black">{n}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}