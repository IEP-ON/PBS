'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { EconomyConfigNotice, useTokenEconomyHealth } from '../token-economy/health-ui'
import type { TvSettings } from '@/types'

interface Settings {
  currency_unit: number
  starting_balance: number
  min_balance_protection: number
  interest_rate_weekly: number
  interest_min_balance: number
  balance_carryover: boolean
  data_retention_months: number
  weather_location: string
  tv_settings?: TvSettings | null
}

interface SalaryRule {
  rule_type: string
  amount: number
  is_active: boolean
}

export default function SettingsPage() {
  const defaultTvSettings: TvSettings = {
    anonymizeName: false,
    showTicker: true,
  }
  const params = useParams()
  const classCode = params.classCode as string
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const { data: health, loading: healthLoading, error: healthError } = useTokenEconomyHealth()

  const [form, setForm] = useState({
    currencyUnit: '100',
    startingBalance: '500',
    minBalanceProtection: '100',
    interestRateWeekly: '0.5',
    interestMinBalance: '500',
    balanceCarryover: true,
    dataRetentionMonths: '12',
    weatherLocation: '대구',
    attendanceSalary: '100',
    weeklyBonus: '200',
    tvSettings: defaultTvSettings,
  })

  useEffect(() => {
    const init = async () => {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.settings) {
          const s = data.settings as Settings
          setForm({
            currencyUnit: String(s.currency_unit),
            startingBalance: String(s.starting_balance),
            minBalanceProtection: String(s.min_balance_protection),
            interestRateWeekly: String(Number(s.interest_rate_weekly) * 100),
            interestMinBalance: String(s.interest_min_balance),
            balanceCarryover: s.balance_carryover,
            dataRetentionMonths: String(s.data_retention_months),
            weatherLocation: s.weather_location || '대구',
            attendanceSalary: String(data.salaryRules?.find((r: SalaryRule) => r.rule_type === 'attendance')?.amount || 100),
            weeklyBonus: String(data.salaryRules?.find((r: SalaryRule) => r.rule_type === 'weekly_perfect')?.amount || 200),
            tvSettings: {
              anonymizeName: Boolean(s.tv_settings?.anonymizeName),
              showTicker: s.tv_settings?.showTicker !== false,
            },
          })
        }
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
          tvSettings: form.tvSettings,
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

      <EconomyConfigNotice data={health} loading={healthLoading} error={healthError} />

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
        <h2 className="font-bold text-gray-900">💵 급여 설정</h2>
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

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-900">📺 TV 디스플레이</h2>
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
          TV 순위판에서 이름 마스킹과 목표 티커 노출 방식을 조정합니다.
        </div>
        <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">이름 익명화</p>
            <p className="text-xs text-gray-500 mt-1">TV에서 학생 이름을 성+○○ 형식으로 표시합니다.</p>
          </div>
          <input
            type="checkbox"
            checked={form.tvSettings.anonymizeName}
            onChange={(e) => setForm({
              ...form,
              tvSettings: {
                ...form.tvSettings,
                anonymizeName: e.target.checked,
              },
            })}
            className="h-5 w-5 rounded border-gray-300"
          />
        </label>
        <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">목표 티커 표시</p>
            <p className="text-xs text-gray-500 mt-1">학생용 안전 문구인 오늘의 목표를 하단 티커로 순환 표시합니다.</p>
          </div>
          <input
            type="checkbox"
            checked={form.tvSettings.showTicker}
            onChange={(e) => setForm({
              ...form,
              tvSettings: {
                ...form.tvSettings,
                showTicker: e.target.checked,
              },
            })}
            className="h-5 w-5 rounded border-gray-300"
          />
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
            <li>• 행동 원인 분석(사정) 동의서</li>
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

      {/* 확장 전략 카탈로그 — 메인 사이드바에서는 숨김 */}
      <div className="rounded-2xl border-2 border-amber-100 bg-white p-5 space-y-4">
        <div>
          <h2 className="font-bold text-gray-900">🧩 확장 전략 카탈로그</h2>
          <p className="mt-1 text-sm text-gray-600">
            출품작 메인 흐름(말 일기장·통합학급 연계) 바깥의 고급 PBS·경제 도구입니다. URL로 직접 들어오거나 여기 링크로만 이동합니다.
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            { href: `/${classCode}/pbs`, label: '행동 목표 체크' },
            { href: `/${classCode}/fba`, label: 'FBA 사정' },
            { href: `/${classCode}/dro`, label: 'DRO 타이머' },
            { href: `/${classCode}/contracts`, label: '행동계약서' },
            { href: `/${classCode}/interventions`, label: '중재 라이브러리' },
            { href: `/${classCode}/stocks`, label: '주식·금융' },
            { href: `/${classCode}/response-cost`, label: '반응대가' },
            { href: `/${classCode}/extinction-alerts`, label: '소거 경보' },
            { href: `/${classCode}/shop`, label: '가게 관리' },
            { href: `/${classCode}/ethics`, label: '윤리 가이드' },
            { href: `/${classCode}/class-account`, label: '학급 공동 계좌' },
            { href: `/${classCode}/qr-tokens`, label: 'QR 토큰 설정' },
            { href: `/${classCode}/behavior-analysis`, label: '행동 분석 요약' },
          ].map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 transition hover:border-sky-200 hover:bg-sky-50"
              >
                <span>{item.label}</span>
                <span className="text-xs text-gray-400">→</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
