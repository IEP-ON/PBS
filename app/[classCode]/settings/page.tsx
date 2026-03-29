'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Settings {
  currency_unit: number
  starting_balance: number
  min_balance_protection: number
  interest_rate_weekly: number
  interest_min_balance: number
  balance_carryover: boolean
  data_retention_months: number
  weather_location: string
}

interface SalaryRule {
  rule_type: string
  amount: number
  is_active: boolean
}

export default function SettingsPage() {
  const params = useParams()
  const classCode = params.classCode as string
  const [settings, setSettings] = useState<Settings | null>(null)
  const [salaryRules, setSalaryRules] = useState<SalaryRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [form, setForm] = useState({
    currencyUnit: '500',
    startingBalance: '1000',
    minBalanceProtection: '500',
    interestRateWeekly: '0.5',
    interestMinBalance: '2000',
    balanceCarryover: true,
    dataRetentionMonths: '12',
    weatherLocation: '대구',
    attendanceSalary: '500',
    weeklyBonus: '1000',
  })

  useEffect(() => {
    const init = async () => {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.settings) {
          const s = data.settings
          setSettings(s)
          setForm({
            currencyUnit: String(s.currency_unit),
            startingBalance: String(s.starting_balance),
            minBalanceProtection: String(s.min_balance_protection),
            interestRateWeekly: String(Number(s.interest_rate_weekly) * 100),
            interestMinBalance: String(s.interest_min_balance),
            balanceCarryover: s.balance_carryover,
            dataRetentionMonths: String(s.data_retention_months),
            weatherLocation: s.weather_location || '대구',
            attendanceSalary: String(data.salaryRules?.find((r: SalaryRule) => r.rule_type === 'attendance')?.amount || 500),
            weeklyBonus: String(data.salaryRules?.find((r: SalaryRule) => r.rule_type === 'weekly_perfect')?.amount || 1000),
          })
        }
        setSalaryRules(data.salaryRules || [])
      }
      setLoading(false)
    }
    init()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currencyUnit: Number(form.currencyUnit),
          startingBalance: Number(form.startingBalance),
          minBalanceProtection: Number(form.minBalanceProtection),
          interestRateWeekly: Number(form.interestRateWeekly) / 100,
          interestMinBalance: Number(form.interestMinBalance),
          balanceCarryover: form.balanceCarryover,
          dataRetentionMonths: Number(form.dataRetentionMonths),
          weatherLocation: form.weatherLocation,
          attendanceSalary: Number(form.attendanceSalary),
          weeklyBonus: Number(form.weeklyBonus),
        }),
      })
      if (res.ok) {
        setMessage('✅ 설정이 저장되었습니다.')
      } else {
        setMessage('❌ 저장 실패')
      }
    } catch {
      setMessage('❌ 서버 연결 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const Field = ({ label, value, field, suffix, type = 'number' }: { label: string; value: string; field: string; suffix?: string; type?: string }) => (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="flex items-center gap-2 mt-1">
        <input
          type={type}
          value={value}
          onChange={(e) => setForm({ ...form, [field]: e.target.value })}
          className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {suffix && <span className="text-sm text-gray-500 whitespace-nowrap">{suffix}</span>}
      </div>
    </label>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">⚙️ 시스템 설정</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {message && (
        <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{message}</div>
      )}

      {/* 통화 설정 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-900">💰 통화 설정</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="화폐 단위" value={form.currencyUnit} field="currencyUnit" suffix="원" />
          <Field label="시작 잔액" value={form.startingBalance} field="startingBalance" suffix="원" />
          <Field label="최저잔액 보호" value={form.minBalanceProtection} field="minBalanceProtection" suffix="원" />
        </div>
      </div>

      {/* 급여 설정 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-900">� 급여 설정</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="출석 기본급" value={form.attendanceSalary} field="attendanceSalary" suffix="원/일" />
          <Field label="주간 개근 보너스" value={form.weeklyBonus} field="weeklyBonus" suffix="원/주" />
        </div>
      </div>

      {/* 이자 설정 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-900">🏦 이자 설정</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="주간 이자율" value={form.interestRateWeekly} field="interestRateWeekly" suffix="%" />
          <Field label="이자 최소 잔액" value={form.interestMinBalance} field="interestMinBalance" suffix="원" />
        </div>
      </div>

      {/* 기타 설정 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-900">🔧 기타 설정</h2>
        <Field label="날씨 연동 지역" value={form.weatherLocation} field="weatherLocation" type="text" />
        <Field label="데이터 보관 기간" value={form.dataRetentionMonths} field="dataRetentionMonths" suffix="개월" />
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.balanceCarryover}
            onChange={(e) => setForm({ ...form, balanceCarryover: e.target.checked })}
            className="w-5 h-5 rounded border-gray-300"
          />
          <span className="text-sm font-medium text-gray-700">잔액 이월 허용</span>
        </label>
      </div>

      {/* 윤리/동의 설정 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">📜 PBS 윤리 및 동의서 관리</h2>
            <p className="text-sm text-gray-500 mt-1">학기초 1회 설정 후 거의 변경하지 않는 항목</p>
          </div>
          <a
            href={`/${classCode}/ethics`}
            className="text-sm text-blue-600 hover:text-blue-700 underline whitespace-nowrap"
          >
            상세 관리 →
          </a>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-sm text-purple-900 font-medium mb-2">윤리 가이드라인 및 동의서 템플릿</p>
          <p className="text-sm text-purple-700 mb-3">
            PBS 시스템 운영 시 필요한 윤리 가이드라인과 학부모 동의서 템플릿을 관리합니다.
          </p>
          <ul className="text-sm text-purple-600 space-y-1">
            <li>• 최소 제한 원칙 (Least Restrictive Intervention)</li>
            <li>• 행동계약서 학부모 동의서</li>
            <li>• 반응대가 동의서</li>
            <li>• FBA 동의서</li>
            <li>• 개인정보 동의서</li>
          </ul>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">윤리 가이드라인 및 동의서 템플릿은 별도 페이지에서 관리됩니다</span>
          <a
            href={`/${classCode}/ethics`}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            윤리/동의 관리 →
          </a>
        </div>
      </div>
    </div>
  )
}
