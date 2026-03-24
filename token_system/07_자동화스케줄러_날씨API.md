# 자동화 스케줄러 + 날씨 API 연동
> 특수학급 PBS 토큰 이코노미 시스템
> 최종 정리: 2026-03-21 (v5 — pg_cron 방식으로 확정)

---

## ⚠️ Cron 방식 확정: Supabase pg_cron (Vercel Cron 아님)

Vercel Free 플랜은 Cron Job **2개 한도**. 이 시스템은 5개 필요 → 불가.

**채택: Supabase pg_cron (무료, 한도 없음)**
- `vercel.json`에 `"crons"` 블록을 작성하지 않는다.
- API 라우트 코드(`/api/cron/*`)는 동일하게 유지.
- pg_cron이 HTTP POST로 해당 URL을 호출하는 방식.

**Supabase 설정:**
```sql
-- Supabase Dashboard > Extensions 에서 pg_cron + pg_net 활성화
-- 앱 배포 후 실제 도메인으로 URL 교체하여 실행

SELECT cron.schedule('pbs-weather-stock',
  '30 23 * * 0-4',
  $$ SELECT net.http_post(
    url  := 'https://YOUR_DOMAIN/api/cron/weather-stock',
    headers := '{"Authorization":"Bearer YOUR_CRON_SECRET"}'::jsonb
  ) $$
);
SELECT cron.schedule('pbs-daily-salary',
  '0 0 * * 1-5',
  $$ SELECT net.http_post(
    url := 'https://YOUR_DOMAIN/api/cron/daily-salary',
    headers := '{"Authorization":"Bearer YOUR_CRON_SECRET"}'::jsonb
  ) $$
);
SELECT cron.schedule('pbs-daily-settle',
  '0 6 * * 1-5',
  $$ SELECT net.http_post(
    url := 'https://YOUR_DOMAIN/api/cron/daily-settle',
    headers := '{"Authorization":"Bearer YOUR_CRON_SECRET"}'::jsonb
  ) $$
);
SELECT cron.schedule('pbs-weekly-bonus',
  '0 5 * * 5',
  $$ SELECT net.http_post(
    url := 'https://YOUR_DOMAIN/api/cron/weekly-bonus',
    headers := '{"Authorization":"Bearer YOUR_CRON_SECRET"}'::jsonb
  ) $$
);
SELECT cron.schedule('pbs-extinction',
  '0 7 * * 1-5',
  $$ SELECT net.http_post(
    url := 'https://YOUR_DOMAIN/api/cron/extinction-check',
    headers := '{"Authorization":"Bearer YOUR_CRON_SECRET"}'::jsonb
  ) $$
);
```

---

## 1. 스케줄 전체 구조

```
Supabase pg_cron (UTC 기준)
       ↓ HTTP POST
Next.js API Route (/api/cron/*)
       ↓
Supabase pbs schema DB 처리 + Claude API (소거 감지)
       ↓
accounts.balance 업데이트
```

| KST 시각 | UTC | 작업 | 대상 |
|---|---|---|---|
| 08:30 | 23:30 (전일) | 날씨 주가 갱신 | 활성 학급 전체 |
| 09:00 | 00:00 | 출석 기본급 입금 | 활성 학생 전체 |
| 15:00 | 06:00 | PBS 성과급·역할급 정산 | 오늘 체크 기록 |
| 금 14:00 | 목 05:00 | 주간 보너스·DRL·이자 | 주간 집계 |
| 16:00 | 07:00 | 소거 감지 체크 | 3일 이상 무강화 |

방학 처리: `class_codes.is_active = false` → 모든 Cron 스킵

---

## 2. vercel.json

```json
{
  "crons": [
    { "path": "/api/cron/weather-stock",    "schedule": "30 23 * * 0-4" },
    { "path": "/api/cron/daily-salary",     "schedule": "0 0 * * 1-5"  },
    { "path": "/api/cron/daily-settle",     "schedule": "0 6 * * 1-5"  },
    { "path": "/api/cron/weekly-bonus",     "schedule": "0 5 * * 5"    },
    { "path": "/api/cron/extinction-check", "schedule": "0 7 * * 1-5"  }
  ]
}
```

---

## 3. Cron 공통 인증 패턴

```typescript
// 모든 Cron 라우트에 적용
export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ... 처리
}
```

---

## 4. 각 Cron 상세 구현

### 4.1 날씨 주가 갱신 (`/api/cron/weather-stock`)

```typescript
export async function POST(req: Request) {
  verifyCron(req)

  const supabase = createServerClient()

  // 활성 학급 + 학급별 도시 설정 조회
  const { data: classrooms } = await supabase
    .from('class_codes')
    .select('id, system_settings(weather_location)')
    .eq('is_active', true)

  for (const classroom of classrooms) {
    const city = classroom.system_settings?.weather_location ?? 'Daegu'
    const weather = await fetchWeather(city)

    // 날씨 연동 종목 4개 주가 계산·갱신
    const stocks = ['icecream', 'hotchoco', 'umbrella', 'picnic']
    for (const stockType of stocks) {
      const newPrice = calcWeatherPrice(stockType, weather)

      await supabase.from('stock_prices').upsert({
        classroom_id: classroom.id,
        stock_type: stockType,
        price_date: today(),
        price: newPrice,
        temperature_celsius: weather.temp,
        precipitation_mm: weather.precipitation,
        weather_condition: weather.description,
      })
    }
  }

  return Response.json({ ok: true })
}
```

### 4.2 일 기본급 정산 (`/api/cron/daily-salary`)

```typescript
export async function POST(req: Request) {
  verifyCron(req)

  const supabase = createServerClient()
  const todayStr = today()

  const { data: classrooms } = await supabase
    .from('class_codes').select('id').eq('is_active', true)

  for (const classroom of classrooms) {
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('classroom_id', classroom.id)
      .eq('is_active', true)

    const { data: rules } = await supabase
      .from('salary_rules')
      .select('*')
      .eq('classroom_id', classroom.id)
      .eq('schedule', 'daily')
      .eq('is_active', true)

    for (const student of students) {
      const transactions = []

      // 출석 기본급 (기본 적용, 교사가 결석 마킹 시 제외)
      const attendance = rules.find(r => r.rule_type === 'attendance')
      if (attendance) {
        transactions.push({
          student_id: student.id,
          classroom_id: classroom.id,
          type: 'salary_basic',
          amount: attendance.amount,
          description: '출석',
          balance_after: 0,  // processTransactions에서 계산
        })
      }

      await processTransactions(supabase, transactions)
    }
  }

  return Response.json({ ok: true })
}
```

### 4.3 PBS·역할 정산 (`/api/cron/daily-settle`)

```typescript
export async function POST(req: Request) {
  verifyCron(req)

  const supabase = createServerClient()
  const todayStr = today()

  // 오늘 teacher_approved=true 이고 아직 정산 안 된 pbs_records 집계
  const { data: pendingRecords } = await supabase
    .from('pbs_records')
    .select('*, pbs_goals(*), students(id, classroom_id)')
    .eq('record_date', todayStr)
    .eq('teacher_approved', true)
    .is('token_granted', null)   // 아직 정산 안 됨

  // 학생별 그룹핑 후 일괄 처리
  const grouped = groupBy(pendingRecords, r => r.student_id)

  for (const [studentId, records] of Object.entries(grouped)) {
    const transactions = records.map(record => {
      const goal = record.pbs_goals
      const isPrompted = record.prompted
      // 독립수행 시 보너스 (10% 추가 — 교사 설정으로 조정 가능)
      const multiplier = isPrompted ? 1.0 : 1.1
      const token = Math.round(goal.token_per_occurrence * record.occurrence_count * multiplier)

      return {
        type: 'salary_pbs' as const,
        amount: token,
        description: `${goal.behavior_name}${isPrompted ? '' : ' (독립수행 ⭐)'}`,
        relatedGoalId: goal.id,
      }
    })

    await processTransactions(supabase, studentId, transactions)

    // pbs_records.token_granted 업데이트 (정산 완료 표시)
    await supabase
      .from('pbs_records')
      .update({ token_granted: transactions.reduce((s, t) => s + t.amount, 0) })
      .in('id', records.map(r => r.id))
  }

  return Response.json({ ok: true })
}
```

### 4.4 주간 보너스·이자 (`/api/cron/weekly-bonus`)

```typescript
export async function POST(req: Request) {
  verifyCron(req)

  const supabase = createServerClient()
  const { weekStart, weekEnd } = getThisWeek()

  const classrooms = await getActiveClassrooms(supabase)

  for (const classroom of classrooms) {
    const students = await getActiveStudents(supabase, classroom.id)
    const settings = classroom.system_settings

    for (const student of students) {
      const transactions = []

      // 1. 주간 개근 보너스
      const attendanceDays = await countAttendance(supabase, student.id, weekStart, weekEnd)
      if (attendanceDays >= 5) {
        const rule = await getSalaryRule(supabase, classroom.id, 'weekly_attendance')
        if (rule) transactions.push({
          type: 'salary_bonus',
          amount: rule.amount,
          description: '주간 개근 보너스 🎉',
        })
      }

      // 2. PBS 주간 목표 달성 보너스
      const goals = await getActiveGoals(supabase, student.id)
      for (const goal of goals) {
        if (goal.weekly_target) {
          const count = await countWeeklyOccurrences(supabase, student.id, goal.id, weekStart, weekEnd)
          if (count >= goal.weekly_target) {
            transactions.push({
              type: 'salary_bonus',
              amount: goal.token_per_occurrence * 2,
              description: `주간 목표 달성: ${goal.behavior_name} ⭐`,
            })
          }
        }
      }

      // 3. DRL 달성 보너스 (낮은비율 — 특정 횟수 이하)
      const drlGoals = goals.filter(g => g.is_drl)
      for (const goal of drlGoals) {
        const count = await countWeeklyOccurrences(supabase, student.id, goal.id, weekStart, weekEnd)
        if (count <= goal.drl_max_per_week) {
          transactions.push({
            type: 'salary_bonus',
            amount: goal.token_per_occurrence,
            description: `DRL 달성: ${goal.behavior_name}`,
          })
        }
      }

      // 4. 행동계약 달성 보너스
      const contracts = await getActiveContracts(supabase, student.id)
      for (const contract of contracts) {
        const achieved = await checkContractAchievement(supabase, contract, weekStart, weekEnd)
        if (achieved) {
          transactions.push({
            type: 'contract_bonus',
            amount: contract.reward_amount,
            description: `계약 달성: ${contract.contract_title} 🏆`,
            relatedContractId: contract.id,
          })
        }
      }

      // 5. 저축 이자
      const account = await getAccount(supabase, student.id)
      if (settings?.interest_rate_weekly && account.balance >= (settings.interest_min_balance ?? 2000)) {
        const interest = Math.floor(account.balance * settings.interest_rate_weekly)
        if (interest > 0) {
          transactions.push({
            type: 'interest',
            amount: interest,
            description: `저축 이자 (${(settings.interest_rate_weekly * 100).toFixed(1)}%)`,
          })
        }
      }

      await processTransactions(supabase, student.id, transactions)

      // 6. 주간 통장 스냅샷 저장 (PDF 생성 대기)
      await saveWeeklySnapshot(supabase, student.id, weekStart, weekEnd)
    }
  }

  return Response.json({ ok: true })
}
```

### 4.5 소거 감지 (`/api/cron/extinction-check`)

```typescript
export async function POST(req: Request) {
  verifyCron(req)

  const supabase = createServerClient()
  const students = await getAllActiveStudents(supabase)

  for (const student of students) {
    const goals = await getActiveGoals(supabase, student.id)

    for (const goal of goals) {
      // 마지막 강화 기록 조회
      const { data: lastRecord } = await supabase
        .from('pbs_records')
        .select('record_date')
        .eq('student_id', student.id)
        .eq('goal_id', goal.id)
        .not('token_granted', 'is', null)
        .order('record_date', { ascending: false })
        .limit(1)
        .single()

      if (!lastRecord) continue

      const daysSince = daysBetween(lastRecord.record_date, today())
      if (daysSince < 3) continue  // 3일 미만 → 무시

      // 이미 알림 있는지 확인 (중복 방지)
      const existing = await supabase
        .from('extinction_alerts')
        .select('id')
        .eq('student_id', student.id)
        .eq('goal_id', goal.id)
        .eq('teacher_acknowledged', false)
        .single()

      if (existing.data) continue  // 이미 미확인 알림 존재

      // 행동 기능별 소거 위험도 조회 (근거 DB)
      const riskLevel = getRiskByFunction(goal.behavior_function)
      // automatic → 소거 불가, escape → 높음, attention → 중간, access → 중간

      // Claude API로 소거 분석
      const gptRecommendation = await analyzeExtinction({
        student,
        goal,
        daysSince,
        riskLevel,
      })

      await supabase.from('extinction_alerts').insert({
        student_id: student.id,
        goal_id: goal.id,
        alert_date: today(),
        days_without_reinforcement: daysSince,
        estimated_function: goal.behavior_function,
        burst_risk_level: riskLevel,
        gpt_recommendation: gptRecommendation,
      })
    }
  }

  return Response.json({ ok: true })
}

function getRiskByFunction(fn: BehaviorFunction): 'high' | 'medium' | 'low' | 'not_applicable' {
  switch (fn) {
    case 'automatic': return 'not_applicable'  // 소거 불가
    case 'escape':    return 'high'
    case 'attention': return 'medium'
    case 'access':    return 'medium'
    default:          return 'medium'
  }
}
```

---

## 5. 날씨 API 상세

### 5.1 OpenWeatherMap 호출

```typescript
// lib/weather/index.ts
export async function fetchWeather(city: string = 'Daegu') {
  const url = new URL('https://api.openweathermap.org/data/2.5/weather')
  url.searchParams.set('q', `${city},KR`)
  url.searchParams.set('appid', process.env.WEATHER_API_KEY!)
  url.searchParams.set('units', 'metric')
  url.searchParams.set('lang', 'kr')

  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  const data = await res.json()

  return {
    city: data.name,
    temp: data.main.temp as number,
    tempMin: data.main.temp_min as number,
    tempMax: data.main.temp_max as number,
    precipitation: (data.rain?.['1h'] ?? 0) as number,
    sky: data.weather[0].id,     // 날씨 코드 (200대=뇌우, 500대=비, 800=맑음)
    description: data.weather[0].description,
    icon: data.weather[0].icon,
    humidity: data.main.humidity,
    fetchedAt: new Date().toISOString(),
  }
}
```

### 5.2 주가 계산 공식 (확정)

```typescript
// lib/weather/price-calculator.ts
export function calcWeatherPrice(
  stockType: 'icecream' | 'hotchoco' | 'umbrella' | 'picnic',
  weather: WeatherData,
  basePrice: number = 100
): number {
  switch (stockType) {
    case 'icecream':
      if (weather.temp >= 30) return round(basePrice * 2.0)
      if (weather.temp >= 25) return round(basePrice * 1.5)
      if (weather.temp >= 20) return round(basePrice * 1.2)
      if (weather.temp >= 15) return round(basePrice * 1.0)
      if (weather.temp >= 10) return round(basePrice * 0.7)
      return round(basePrice * 0.5)

    case 'hotchoco':  // 아이스크림 역방향
      if (weather.temp <= 0)  return round(basePrice * 2.0)
      if (weather.temp <= 5)  return round(basePrice * 1.7)
      if (weather.temp <= 10) return round(basePrice * 1.4)
      if (weather.temp <= 15) return round(basePrice * 1.0)
      if (weather.temp <= 20) return round(basePrice * 0.7)
      return round(basePrice * 0.5)

    case 'umbrella':
      if (weather.precipitation >= 10) return round(basePrice * 2.0)
      if (weather.precipitation >= 1)  return round(basePrice * 1.8)
      if (weather.sky >= 500 && weather.sky < 600) return round(basePrice * 1.5)  // 비 코드
      if (weather.sky >= 200 && weather.sky < 300) return round(basePrice * 1.3)  // 뇌우
      return round(basePrice * 0.6)  // 맑음

    case 'picnic':
      const comfy = weather.temp >= 15 && weather.temp <= 22
      const clear = weather.sky === 800 && weather.precipitation === 0  // 800=맑음
      if (comfy && clear)   return round(basePrice * 2.0)
      if (comfy)            return round(basePrice * 1.5)
      if (clear)            return round(basePrice * 1.2)
      if (weather.temp > 30 || weather.temp < 5) return round(basePrice * 0.5)
      return round(basePrice * 0.8)
  }
}

function round(n: number) { return Math.round(n / 10) * 10 }  // 10원 단위 반올림
```

### 5.3 수업 활용 시나리오

```
아침 홈룸:
"오늘 대구 기온이 28도예요. 어떤 주식이 올랐을까요?"
→ 학생들이 예측 → 대시보드에서 실제 시세 확인
→ 맞힌 학생 PBS 체크 추가 보상 가능

겨울 시즌:
아이스크림 폭락 + 핫초코 폭등
→ "왜 그럴까?" 토론 → 수요·공급 개념 자연 학습

교사 커스텀 활용:
소풍 전날 "소풍주식" 급등 → 학급 이벤트 기대감 조성
잔액 불균형 시 특정 학생 보유 종목 조정
```

---

## 6. 커스텀 주식 주가 조정 로직

```typescript
// PATCH /api/stocks/custom/[stockId]/price
export function applyAdjustment(
  currentPrice: number,
  type: AdjustmentType,
  directPrice?: number
): number {
  switch (type) {
    case 'manual_input': return directPrice!
    case 'surge':  return Math.round(currentPrice * (2 + Math.random()))       // ×2~3
    case 'rise':   return Math.round(currentPrice * (1.2 + Math.random() * 0.3)) // ×1.2~1.5
    case 'flat':   return currentPrice
    case 'fall':   return Math.round(currentPrice * (0.7 + Math.random() * 0.1)) // ×0.7~0.8
    case 'crash':  return Math.round(currentPrice * (0.3 + Math.random() * 0.2)) // ×0.3~0.5
  }
}
```

---

## 7. 수동 실행 (긴급·방학 중 처리)

교사 설정 페이지에서 직접 호출 가능:

```
POST /api/salary/settle/daily   body: { date: '2026-03-18' }
POST /api/salary/settle/weekly  body: { weekStart: '2026-03-16' }
```

---

## 8. Cron 실패 처리 패턴

```typescript
// 한 학급 실패가 전체 중단 방지
for (const classroom of classrooms) {
  try {
    await processClassroom(supabase, classroom)
  } catch (error) {
    console.error(`Cron failed for classroom ${classroom.id}:`, error)
    // 실패 기록 (선택적 — cron_logs 테이블)
    await supabase.from('cron_logs').insert({
      cron_type: 'daily-salary',
      classroom_id: classroom.id,
      error_message: error.message,
      run_date: today(),
    })
    continue  // 다음 학급 계속
  }
}
```
