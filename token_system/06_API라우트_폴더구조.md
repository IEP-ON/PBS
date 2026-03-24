# API 라우트 설계 + Next.js 폴더 구조
> 특수학급 PBS 토큰 이코노미 시스템
> 기술 스택: Next.js 14 App Router / Supabase / Vercel
> 인증: 세션 쿠키 (학급코드 + PIN 검증 후 저장)
> 최종 정리: 2026-03-21 (v4 — 두 버전 병합)

---

## 1. 인증 설계

### 1.1 로그인 흐름

```
[교사]
POST /api/auth/teacher
body: { classCode, teacherPin }
→ class_codes 테이블에서 검증 (bcrypt 비교)
→ 세션 쿠키: { role: 'teacher', classCode, classroomId }
→ redirect → /(teacher)/[classCode]/dashboard

[학생]
POST /api/auth/student
body: { classCode, studentName, studentPin }
→ students 테이블에서 검증
→ 세션 쿠키: { role: 'student', classCode, classroomId, studentId }
→ redirect → /(student)/[classCode]/[studentId]/home

[ATM]
쿠키 불필요 — QR 스캔 시 qr_code 값으로 직접 학생 조회
PIN 입력 없이 즉시 잔액 화면 표시
```

### 1.2 세션 타입

```typescript
// lib/session.ts
type SessionData = {
  role: 'teacher' | 'student'
  classCode: string
  classroomId: string
  studentId?: string  // 학생만
}
```

### 1.3 미들웨어 접근 제어

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const session = getSession(request)
  const path = request.nextUrl.pathname

  // 교사 전용 경로
  if (path.includes('/(teacher)')) {
    if (session?.role !== 'teacher') return redirect('/login')
  }

  // 학생 전용 경로 — 본인 경로만 접근
  if (path.includes('/(student)')) {
    if (session?.role !== 'student') return redirect('/login')
    const pathStudentId = path.split('/')[3]
    if (pathStudentId !== session?.studentId) return redirect('/login')
  }
}
```

---

## 2. API 라우트 전체 명세

### 2.1 인증

```typescript
// POST /api/auth/teacher
body: { classCode: string, teacherPin: string }
response: { ok: true } + Set-Cookie

// POST /api/auth/student
body: { classCode: string, studentName: string, studentPin: string }
response: { ok: true, studentId: string } + Set-Cookie

// POST /api/auth/logout
response: { ok: true } + Clear-Cookie
```

### 2.2 학급

```typescript
// POST /api/classroom
// 학급 개설 — 교사가 처음 가입할 때 사용
body: {
  schoolName: string
  teacherName: string
  className: string
  teacherPin: string      // 4~6자리 평문 → 서버에서 bcrypt
  currencyUnit?: number   // 기본 500
  startBalance?: number   // 기본 1000
}
response: {
  classCode: string       // 자동 생성: NDG-2026-001 형식
  classroomId: string
}
// 사이드이펙트:
// - class_codes INSERT
// - system_settings INSERT (기본값)
// - 날씨 주식 4종 stock_items INSERT
// - class_account INSERT (공동계좌)
// - salary_rules INSERT (출석·주간개근 기본규칙)

// GET /api/classroom/[classCode]
// 학급 기본 정보 조회 (랜딩 페이지에서 학급명 표시용)
response: {
  className: string
  schoolName: string
  isActive: boolean
}
```

### 2.3 학생

```typescript
// GET /api/students
// 쿼리: classroomId 세션에서 자동 추출
response: { students: Student[] }

// POST /api/students
// 학생 등록
body: {
  name: string
  grade?: number
  disabilityType?: string[]
  pbsStage?: number       // 기본 1
  pin: string             // 4자리 평문 → bcrypt
}
response: {
  studentId: string
  qrCode: string          // UUID 기반 QR 값
}
// 사이드이펙트: accounts INSERT (잔액 = classroom.startBalance)

// GET /api/students/[studentId]
response: { student: Student, account: Account }

// PATCH /api/students/[studentId]
// PIN 초기화, PBS 단계 변경, 반응대가 활성화 등
body: Partial<Student>
response: { student: Student }

// GET /api/students/[studentId]/qr
// QR ID 카드 이미지 생성 (PNG or SVG)
response: QR 이미지 스트림
```

### 2.4 계좌·거래

```typescript
// GET /api/accounts/[studentId]
response: { balance: number, totalEarned: number, totalSpent: number }

// GET /api/accounts/[studentId]/transactions
// 쿼리: from?, to?, type?, limit?
response: { transactions: Transaction[] }

// POST /api/accounts/transfer
// 내부 사용 — 모든 거래는 이 함수를 통과
// 외부 직접 호출 불가 (서버사이드 전용)
body: {
  studentId: string
  type: TransactionType
  amount: number          // 양수=입금, 음수=출금
  description: string
  relatedId?: string
}
// 검증: 출금 시 balance - amount >= min_balance(500)
```

### 2.5 PBS 체크 (교사 핵심 기능)

```typescript
// GET /api/pbs/goals
// 쿼리: studentId
response: { goals: PbsGoal[] }

// POST /api/pbs/goals
// 새 PBS 목표 행동 등록
body: {
  studentId: string
  behaviorName: string
  behaviorDefinition?: string
  behaviorFunction?: BehaviorFunction
  strategyType?: string
  tokenPerOccurrence: number
  dailyTarget?: number
  weeklyTarget?: number
  isDro?: boolean
  droIntervalMinutes?: number
  isDrl?: boolean
  drlMaxPerWeek?: number
  allowSelfCheck?: boolean
}
response: { goal: PbsGoal }

// PATCH /api/pbs/goals/[goalId]
// 단가·목표 수정, 비활성화
body: Partial<PbsGoal>

// POST /api/pbs/records
// 교사가 PBS 체크 입력 — 당일 정산 대기 상태로 저장
body: {
  studentId: string
  goalId: string
  occurrenceCount: number
  prompted: boolean
  contextNote?: string
}
response: {
  recordId: string
  tokenGranted: number    // 오늘 15:00 정산 시 입금 예정 금액
}
// 사이드이펙트: 소거 감지 체크 트리거

// POST /api/pbs/records/selfcheck
// 학생 셀프 체크 요청 (교사 승인 대기)
body: { goalId: string }
response: { requestId: string, status: 'pending' }

// PATCH /api/pbs/records/selfcheck
// 교사 승인/거절
body: { requestId: string, approved: boolean }

// POST /api/pbs/dro/start
body: { studentId: string, goalId: string }
response: { timerId: string, endsAt: string }

// POST /api/pbs/dro/reset
// 문제행동 발생 시 타이머 리셋
body: { timerId: string }
response: { timerId: string, status: 'reset' }
```

### 2.6 정산

```typescript
// GET /api/salary/preview
// 오늘 PBS 체크 기준 정산 예정 금액 미리보기
// 쿼리: date (기본 오늘)
response: {
  students: Array<{
    studentId: string
    name: string
    basicSalary: number
    pbsSalary: number
    total: number
  }>
}

// POST /api/salary/settle/daily
// 수동 실행용 (Cron 실패 시 교사 수동 실행)
// 헤더: Authorization: Bearer CRON_SECRET
body: { date?: string }  // 기본 오늘
response: { settled: number, totalAmount: number }

// POST /api/salary/settle/weekly
// 수동 실행용
body: { weekStart?: string }
response: { settled: number }
```

### 2.7 주식

```typescript
// GET /api/stocks
// 전체 종목 (날씨 + 커스텀) 현재 시세
response: {
  weatherStocks: StockPrice[]
  customStocks: CustomStock[]
  todayWeather: WeatherSummary
}

// POST /api/stocks/custom
// 교사 커스텀 종목 생성
body: {
  name: string
  emoji?: string
  description?: string
  initialPrice: number
  namedBy?: string   // 종목 이름 지은 학생명
}
response: { stock: CustomStock }

// PATCH /api/stocks/custom/[stockId]/price
// 교사 주가 수동 조정
body: {
  newPrice?: number            // 직접 입력
  adjustmentType?: 'surge' | 'rise' | 'flat' | 'fall' | 'crash'
  teacherNote?: string         // 학생에게 비공개 내부 메모
}
// adjustmentType별 배율:
// surge: ×2~3, rise: ×1.2~1.5, flat: ×1, fall: ×0.7~0.8, crash: ×0.3~0.5
response: { previousPrice: number, newPrice: number }

// POST /api/stocks/trade
// 매수/매도 (교사 창구 대행)
body: {
  studentId: string
  stockId: string
  stockType: 'weather' | 'custom'
  action: 'buy' | 'sell'
  quantity: number
}
// 검증: 매수 시 balance >= price×quantity + min_balance
response: { transaction: Transaction, holding: StockHolding }
```

### 2.8 가게

```typescript
// GET /api/shop/items
// 전체 활성 아이템 목록
response: { items: ShopItem[] }

// POST /api/shop/items
body: {
  name: string
  category: 'activity' | 'snack' | 'goods'
  price: number
  stock?: number          // null = 무제한
  isGiftable?: boolean    // 기본 true
  emoji?: string
}
response: { item: ShopItem }

// PATCH /api/shop/items/[itemId]
body: Partial<ShopItem>

// POST /api/shop/purchase
body: {
  buyerId: string
  itemId: string
  isGift: boolean
  recipientId?: string    // 선물 시 상대방 ID
}
// 검증: balance - price >= 500 (최저잔액)
// 재고 있는 아이템: stock -= 1
response: { transactionId: string, balanceAfter: number }
// 선물 시 사이드이펙트:
// - buyer: transactions INSERT (gift_sent, -price)
// - recipient: transactions INSERT (gift_received, +price)
```

### 2.9 행동계약서

```typescript
// GET /api/contracts
// 쿼리: studentId?
response: { contracts: BehaviorContract[] }

// POST /api/contracts
// 새 계약 작성 (GPT 초안 or 수동)
body: {
  studentId: string
  contractTitle: string
  targetBehavior: string
  behaviorDefinition: string
  measurementMethod: string
  achievementCriteria: string
  rewardAmount: number
  contractStart: string
  contractEnd: string
  fbaRecordId?: string
}
response: { contract: BehaviorContract }

// PATCH /api/contracts/[contractId]
// 서명 상태 업데이트, 내용 수정
body: Partial<BehaviorContract>

// POST /api/contracts/[contractId]/activate
// 서명 완료 후 계약 활성화 → 자동 정산 규칙 등록
body: {
  teacherSigned: boolean
  studentSigned: boolean
  parentSigned?: boolean   // 반응대가 포함 시 필수
}
// 사이드이펙트:
// - is_active = true
// - 계약 조건 → pbs_goals or salary_rules 자동 등록
// - DRO 연동 시 → dro_timers 세팅
response: { contract: BehaviorContract }

// GET /api/contracts/[contractId]/pdf
// 계약서 PDF 생성 (react-pdf 또는 puppeteer)
response: PDF 스트림

// POST /api/contracts/draft
// Claude API로 계약서 초안 자동 생성
body: {
  studentId: string
  fbaRecordId: string
  strategyType: string
}
response: { draft: Partial<BehaviorContract> }
```

### 2.10 AI (Claude API)

```typescript
// POST /api/ai/fba
// FBA 분석 요청 — Claude API 호출
body: {
  studentId: string
  behaviorDescription: string
  antecedentPatterns: string[]
  consequencePatterns: string[]
  frequencyData?: object
}
response: {
  estimatedFunction: BehaviorFunction
  confidence: 'high' | 'medium' | 'low'
  recommendedStrategies: string[]
  gptAnalysis: string        // Claude 원문 출력
  recommendationId: string   // ai_recommendations 테이블 저장 ID
}

// GET /api/ai/alerts
// 소거 감지 알림 목록 (미확인 우선)
response: { alerts: ExtinctionAlert[] }

// PATCH /api/ai/recommendations/[id]
// 교사가 AI 제안 수락/거절 기록
body: {
  accepted: boolean
  teacherFeedback?: string
}
```

### 2.11 통장

```typescript
// GET /api/bankbook/[studentId]/weekly
// 쿼리: weekStart (ISO date)
response: {
  student: Student
  weekRange: { start: string, end: string }
  transactions: Transaction[]
  pbsSummary: PbsWeeklySummary[]
  contractAchievements: ContractResult[]
}

// GET /api/bankbook/[studentId]/pdf
// 통장 PDF 생성 (주간 or 학기)
// 쿼리: type ('weekly' | 'semester'), weekStart?
response: PDF 스트림
```

### 2.12 Cron (Vercel Cron Jobs 전용)

```typescript
// 모든 Cron 라우트 공통 인증
const auth = req.headers.get('authorization')
if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

// POST /api/cron/weather-stock     → KST 08:30 (UTC 23:30 전날)
// POST /api/cron/daily-salary      → KST 09:00 (UTC 00:00)
// POST /api/cron/daily-settle      → KST 15:00 (UTC 06:00)
// POST /api/cron/weekly-bonus      → 금 KST 14:00 (UTC 05:00)
// POST /api/cron/extinction-check  → KST 16:00 (UTC 07:00)
```

---

## 3. vercel.json Cron 설정 (UTC 기준)

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

## 4. 공통 타입 정의

```typescript
// types/index.ts

type TransactionType =
  | 'salary_basic'      // 출석·역할 기본급
  | 'salary_pbs'        // PBS 성과급
  | 'salary_bonus'      // 주간 보너스
  | 'purchase'          // 가게 구매
  | 'gift_sent'         // 선물 보냄
  | 'gift_received'     // 선물 받음
  | 'stock_buy'         // 주식 매수 (날씨+커스텀 공통)
  | 'stock_sell'        // 주식 매도
  | 'interest'          // 저축 이자
  | 'response_cost'     // 반응대가 차감
  | 'dro_reward'        // DRO 타이머 보상
  | 'contract_bonus'    // 계약 달성 보너스
  | 'level_up_bonus'    // 행동형성 레벨업 보너스
  | 'class_reward'      // 학급 공동 보상

type BehaviorFunction = 'attention' | 'escape' | 'automatic' | 'access'
type PbsStage = 1 | 2 | 3
type AdjustmentType = 'surge' | 'rise' | 'flat' | 'fall' | 'crash' | 'manual_input'

type ContractStrategyType =
  | 'DRA' | 'DRI' | 'DRO' | 'DRL'
  | 'FCT' | 'NCR' | 'BC' | 'Shaping'
  | 'SM' | 'TA' | 'TM-CM'
```

---

## 5. 공통 컴포넌트 목록

```
components/
├── ui/
│   ├── BigButton.tsx          # 56px 이상 대형 버튼 (학생용)
│   ├── BalanceCard.tsx        # 잔액 + 동전 시각화
│   ├── DepositAnimation.tsx   # 전체화면 입금 애니메이션
│   ├── ConfirmModal.tsx       # 2단계 확인 모달 (출금 전)
│   ├── TransactionItem.tsx    # 거래내역 한 줄
│   ├── StockCard.tsx          # 주식 종목 카드
│   ├── PinInput.tsx           # PIN 4자리 입력
│   └── ClassCodeInput.tsx     # 학급코드 입력
│
├── teacher/
│   ├── PbsCheckBoard.tsx      # PBS 체크 보드 (핵심)
│   ├── StudentTabs.tsx        # 학생 탭 전환
│   ├── DroTimer.tsx           # DRO 타이머 위젯
│   ├── SettlePreview.tsx      # 정산 미리보기
│   ├── StockPriceEditor.tsx   # 커스텀 주가 조정 UI
│   ├── ContractEditor.tsx     # 계약서 작성 폼
│   └── BankbookPrint.tsx      # 통장 출력 레이아웃
│
├── student/
│   ├── ShopGrid.tsx           # 가게 이모지 카드 그리드
│   ├── SelfCheckList.tsx      # 셀프 체크 목록
│   └── GiftModal.tsx          # 선물하기 모달
│
└── atm/
    └── QrScanner.tsx          # QR 카메라 스캔
```

---

## 6. lib 구조

```
lib/
├── supabase/
│   ├── client.ts              # 브라우저 클라이언트
│   └── server.ts              # 서버 클라이언트 (Service Role)
├── ai/
│   ├── fba-analyzer.ts        # Claude FBA 분석 함수
│   └── contract-drafter.ts    # Claude 계약서 초안 생성
├── weather/
│   └── price-calculator.ts    # 날씨 → 주가 계산
├── salary/
│   └── settler.ts             # 정산 핵심 로직
├── session.ts                 # 세션 쿠키 유틸
└── utils.ts                   # 공통 유틸 (날짜, 금액 포맷 등)
```
