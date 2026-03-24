import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

export default async function StudentHomePage({
  params,
}: {
  params: Promise<{ classCode: string; studentId: string }>
}) {
  const session = await getSession()
  if (!session.studentId || session.role !== 'student') redirect('/login')

  const { studentId } = await params
  const supabase = await createServerSupabase()

  // 학생 정보 + 계좌
  const { data: student } = await supabase
    .from('pbs_students')
    .select('*, pbs_accounts(*)')
    .eq('id', studentId)
    .single()

  if (!student) redirect('/login')

  const account = Array.isArray(student.pbs_accounts) ? student.pbs_accounts[0] : student.pbs_accounts

  // 최근 거래내역 5건
  const { data: recentTx } = await supabase
    .from('pbs_transactions')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(5)

  // 오늘 획득 금액
  const today = new Date().toISOString().split('T')[0]
  const { data: todayRecords } = await supabase
    .from('pbs_records')
    .select('token_granted')
    .eq('student_id', studentId)
    .eq('record_date', today)

  const todayEarned = todayRecords?.reduce((sum, r) => sum + r.token_granted, 0) || 0

  // 보유 주식
  const { data: holdings } = await supabase
    .from('pbs_stock_holdings')
    .select('stock_name, quantity, avg_buy_price')
    .eq('student_id', studentId)
    .gt('quantity', 0)

  // 셀프체크 가능 목표 수
  const { data: selfCheckGoals } = await supabase
    .from('pbs_goals')
    .select('id')
    .eq('student_id', studentId)
    .eq('is_active', true)
    .eq('allow_self_check', true)

  // 활성 계약서
  const { data: activeContracts } = await supabase
    .from('pbs_behavior_contracts')
    .select('contract_title, target_behavior, achievement_criteria, reward_amount')
    .eq('student_id', studentId)
    .eq('is_active', true)

  const txTypeEmoji: Record<string, string> = {
    salary_basic: '💰',
    salary_pbs: '⭐',
    salary_bonus: '🎉',
    purchase: '🛒',
    gift_sent: '🎁',
    gift_received: '🎁',
    stock_buy: '📈',
    stock_sell: '📉',
    interest: '🏦',
    response_cost: '⚠️',
    dro_reward: '⏱️',
    contract_bonus: '📝',
    level_up_bonus: '🆙',
    class_reward: '🏫',
  }

  return (
    <div className="p-4 space-y-6">
      {/* 잔액 카드 */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-200">
        <p className="text-blue-100 text-sm">{student.name}의 잔액</p>
        <p className="text-4xl font-bold mt-2">{formatCurrency(account?.balance || 0)}</p>
        {todayEarned > 0 && (
          <p className="text-blue-200 text-sm mt-2">
            오늘 +{formatCurrency(todayEarned)} 획득 예정 ✨
          </p>
        )}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500">총 수입</p>
          <p className="text-lg font-bold text-green-600">{formatCurrency(account?.total_earned || 0)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500">총 지출</p>
          <p className="text-lg font-bold text-red-500">{formatCurrency(account?.total_spent || 0)}</p>
        </div>
      </div>

      {/* 보유 주식 */}
      {holdings && holdings.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">📈 보유 주식</h2>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {holdings.map((h, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{h.stock_name}</p>
                  <p className="text-xs text-gray-400">평단 {formatCurrency(h.avg_buy_price)}</p>
                </div>
                <p className="font-bold text-blue-600">{h.quantity}주</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 셀프체크 + 계약서 퀵카드 */}
      <div className="grid grid-cols-2 gap-3">
        {selfCheckGoals && selfCheckGoals.length > 0 && (
          <div className="bg-green-50 rounded-2xl border border-green-100 p-4 text-center">
            <p className="text-2xl mb-1">✅</p>
            <p className="text-xs text-gray-500">셀프체크 가능</p>
            <p className="text-lg font-bold text-green-600">{selfCheckGoals.length}개 목표</p>
          </div>
        )}
        {activeContracts && activeContracts.length > 0 && (
          <div className="bg-purple-50 rounded-2xl border border-purple-100 p-4 text-center">
            <p className="text-2xl mb-1">📝</p>
            <p className="text-xs text-gray-500">활성 계약서</p>
            <p className="text-lg font-bold text-purple-600">{activeContracts.length}건</p>
          </div>
        )}
      </div>

      {/* 활성 계약서 상세 */}
      {activeContracts && activeContracts.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">📝 나의 행동계약서</h2>
          <div className="space-y-2">
            {activeContracts.map((c, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="font-bold text-gray-900 text-sm">{c.contract_title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.target_behavior} · {c.achievement_criteria}</p>
                {c.reward_amount > 0 && (
                  <p className="text-xs text-green-600 mt-1">달성 보상: {formatCurrency(c.reward_amount)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 최근 거래 */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">최근 거래</h2>
        {(!recentTx || recentTx.length === 0) ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">아직 거래가 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {recentTx.map((tx) => (
              <div key={tx.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{txTypeEmoji[tx.type] || '💵'}</span>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{tx.description}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(tx.created_at).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                <p className={`font-bold text-sm ${tx.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
