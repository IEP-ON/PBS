# Windsurf 개발 시작 프롬프트 — PBS 토큰 이코노미 시스템
> 이 파일을 Windsurf에 **가장 먼저** 읽혀야 한다.
> 작성: 2026-03-21 (v5 — 그린필드 기준 아키텍처 확정)
> 두 시스템(HATCH + PBS) 모두 코드 없음. 이 문서가 최초 설계 기준.

---

## 0. 전체 아키텍처 결정 (확정 — Windsurf 임의 변경 금지)

### 결정 A: Repo 구조 — 두 개의 독립 Next.js 프로젝트

```
iepon/
├── hatch/     ← H.A.T.C.H. 인큐베이터 대시보드 (별도 repo, 나중에 개발)
└── pbs/       ← PBS 토큰 이코노미 (이 repo — 지금 개발할 것)
```

**지금 개발할 것은 `pbs/`만이다. `hatch/`는 건드리지 않는다.**

이유: 두 앱의 사용자·목적·배포 주기가 다름. 모노레포로 묶으면 Windsurf가 서로 혼동함.

---

### 결정 B: Supabase — 하나의 프로젝트, PostgreSQL Schema로 격리

```
Supabase 프로젝트: iepon-db (공유 — 하나의 과금 단위)
│
├── Schema: public   ← H.A.T.C.H. 대시보드 (나중에)
└── Schema: pbs      ← PBS 토큰 이코노미 (지금) ← 이 앱의 모든 테이블
    ├── pbs.class_codes
    ├── pbs.students
    ├── pbs.accounts
    └── ... (27개 전부)
```

**⚠️ 핵심 규칙: 모든 SQL과 쿼리는 `pbs` schema를 명시한다.**

```sql
-- ❌ 금지 (public schema에 생성됨)
CREATE TABLE students (...);

-- ✅ 필수 (pbs schema에 생성됨)
CREATE SCHEMA IF NOT EXISTS pbs;
CREATE TABLE pbs.students (...);
```

```typescript
// lib/supabase/client.ts — db.schema 반드시 명시
createBrowserClient(url, key, { db: { schema: 'pbs' } })
```

---

### 결정 C: Cron — Vercel Free 플랜 2개 한도 → Supabase pg_cron 사용

필요한 Cron 5개:
```
08:30  날씨 주가 갱신
09:00  출석 기본급
15:00  PBS 성과급
금14:00 주간 보너스·이자
16:00  소거 감지
```

Vercel Free = 2개 한도 → **5개 불가**. `vercel.json`에 `"crons"` 블록을 작성하지 않는다.

**대신 Supabase pg_cron 사용 (무료):**

```sql
-- Supabase Extensions에서 pg_cron + pg_net 활성화 후 실행
-- (앱 배포 후 실제 URL로 교체)

SELECT cron.schedule('pbs-weather-stock',   '30 23 * * 0-4',
  $$ SELECT net.http_post('https://YOUR_DOMAIN/api/cron/weather-stock',
     '{"Authorization":"Bearer YOUR_CRON_SECRET"}'::jsonb) $$);

SELECT cron.schedule('pbs-daily-salary',    '0 0 * * 1-5',
  $$ SELECT net.http_post('https://YOUR_DOMAIN/api/cron/daily-salary',
     '{"Authorization":"Bearer YOUR_CRON_SECRET"}'::jsonb) $$);

SELECT cron.schedule('pbs-daily-settle',    '0 6 * * 1-5',
  $$ SELECT net.http_post('https://YOUR_DOMAIN/api/cron/daily-settle',
     '{"Authorization":"Bearer YOUR_CRON_SECRET"}'::jsonb) $$);

SELECT cron.schedule('pbs-weekly-bonus',    '0 5 * * 5',
  $$ SELECT net.http_post('https://YOUR_DOMAIN/api/cron/weekly-bonus',
     '{"Authorization":"Bearer YOUR_CRON_SECRET"}'::jsonb) $$);

SELECT cron.schedule('pbs-extinction',      '0 7 * * 1-5',
  $$ SELECT net.http_post('https://YOUR_DOMAIN/api/cron/extinction-check',
     '{"Authorization":"Bearer YOUR_CRON_SECRET"}'::jsonb) $$);
```

API 라우트 코드(`/api/cron/*`)는 그대로 유지. 나중에 Vercel Pro 업그레이드 시 `vercel.json`만 추가하면 전환 완료.

---

### 결정 D: 학생 데이터 — pbs.students가 단일 진실 공급원

```
pbs.students = 학생 데이터 Source of Truth
HATCH 대시보드가 학생 정보 필요 시 → pbs schema 읽기 전용 참조
```

---

## 1. 이 시스템 개요

특수학급(6명) PBS(긍정적 행동지원) 중재를 화폐·금융 시스템으로 구현한 AI 기반 웹앱.

```
화폐 = 토큰 / 가게 = 백업 강화제 교환소 / 급여 = 토큰 획득 절차
통장 = 행동주의 포트폴리오 / 주식 = 시장경제 교육 + 잔액 조정 도구
```

H.A.T.C.H. 메추리 알 부화 PBL과 병렬 운영되는 학급 인프라. (`10_HATCH_연동컨텍스트.md` 참조)

---

## 2. 기술 스택 (확정)

```
Frontend:  Next.js 14 (App Router) + TypeScript + Tailwind CSS
Backend:   Supabase PostgreSQL (pbs schema) + RLS
Auth:      세션 쿠키 (학급코드 + PIN — 회원가입 없음)
배포:      Vercel (Cron 미사용) + Supabase pg_cron (스케줄 담당)
AI:        Anthropic Claude API — claude-sonnet-4-20250514
날씨:      OpenWeatherMap API
```

> AI는 OpenAI가 아닌 **Anthropic**. 환경변수: `ANTHROPIC_API_KEY`

---

## 3. 환경 변수 (.env.local)

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # 서버 전용, 클라이언트 노출 금지

SESSION_SECRET=                  # 32자 이상 랜덤
CRON_SECRET=                     # pg_cron → API 인증용

ANTHROPIC_API_KEY=               # sk-ant-... (OpenAI 아님)

WEATHER_API_KEY=
WEATHER_DEFAULT_CITY=Daegu

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 4. 참조 문서 목록

| 파일 | 내용 | 중요도 |
|---|---|---|
| `00_Windsurf_시작프롬프트.md` | 이 파일 — 아키텍처 결정 | ⭐⭐⭐ |
| `01_PRD_시스템개요.md` | 제품 요구사항 전체 | ⭐⭐⭐ |
| `02_DB_스키마설계.md` | 27개 테이블 스키마 + RLS | ⭐⭐⭐ |
| `03_AI연동_행동주의전략.md` | Claude API 호출 + PBS 전략 | ⭐⭐ |
| `04_화면흐름_기능명세.md` | 전체 화면 + UX + Phase | ⭐⭐⭐ |
| `05_운영규칙_정책.md` | 화폐·인증·주식·데이터 정책 | ⭐⭐ |
| `06_API라우트_폴더구조.md` | Next.js 구조 + API 명세 | ⭐⭐⭐ |
| `07_자동화스케줄러_날씨API.md` | pg_cron 설정 + 날씨 주가 | ⭐⭐ |
| `08_프론트엔드_디자인가이드.md` | 접근성 기준 + 컴포넌트 | ⭐⭐ |
| `09_GPT_시스템프롬프트.md` | Claude 시스템 프롬프트 | ⭐ |
| `10_HATCH_연동컨텍스트.md` | HATCH 연결 구조 | ⭐ |
| `behavior_db_seed.sql` | 근거 DB 시드 — AI 필수 | ⭐⭐⭐ |

---

## 5. 인증 구조

```
[랜딩] 학급 식별코드 입력 (예: NDG-2026-001)
          ↓
    ┌─────┴─────┐
   교사         학생
   교사 PIN     이름 목록 선택 + PIN 4자리
    ↓            ↓
교사 대시보드  학생 모바일뱅킹 홈

[ATM] QR카드 스캔 → PIN 없이 즉시 잔액 확인
```

```typescript
type SessionData = {
  role: 'teacher' | 'student'
  classCode: string
  classroomId: string
  studentId?: string
}
```

---

## 6. 핵심 폴더 구조

```
pbs/
├── .env.local
├── next.config.ts
├── vercel.json          # crons 블록 없음 (pg_cron 사용)
│
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (teacher)/[classCode]/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── pbs/page.tsx                    ← Phase 1 핵심
│   │   ├── pbs/[studentId]/page.tsx
│   │   ├── students/page.tsx
│   │   ├── students/[studentId]/page.tsx
│   │   ├── stocks/page.tsx
│   │   ├── shop/page.tsx
│   │   ├── contracts/page.tsx
│   │   ├── contracts/new/page.tsx
│   │   ├── contracts/[contractId]/page.tsx
│   │   ├── bankbook/page.tsx
│   │   ├── ai/page.tsx
│   │   └── settings/page.tsx
│   ├── (student)/[classCode]/[studentId]/
│   │   ├── layout.tsx
│   │   ├── home/page.tsx                   ← Phase 1 핵심
│   │   ├── bankbook/page.tsx
│   │   ├── stocks/page.tsx
│   │   ├── shop/page.tsx
│   │   └── selfcheck/page.tsx
│   ├── atm/[classCode]/page.tsx
│   └── api/
│       ├── auth/teacher/route.ts
│       ├── auth/student/route.ts
│       ├── auth/logout/route.ts
│       ├── classroom/route.ts
│       ├── classroom/[classCode]/route.ts
│       ├── students/route.ts
│       ├── students/[studentId]/route.ts
│       ├── students/[studentId]/qr/route.ts
│       ├── accounts/[studentId]/route.ts
│       ├── accounts/[studentId]/transactions/route.ts
│       ├── pbs/goals/route.ts
│       ├── pbs/goals/[goalId]/route.ts
│       ├── pbs/records/route.ts
│       ├── pbs/records/selfcheck/route.ts
│       ├── pbs/dro/start/route.ts
│       ├── pbs/dro/reset/route.ts
│       ├── salary/settle/daily/route.ts
│       ├── salary/settle/weekly/route.ts
│       ├── salary/preview/route.ts
│       ├── stocks/route.ts
│       ├── stocks/custom/route.ts
│       ├── stocks/custom/[stockId]/price/route.ts
│       ├── stocks/trade/route.ts
│       ├── shop/items/route.ts
│       ├── shop/purchase/route.ts
│       ├── contracts/route.ts
│       ├── contracts/[contractId]/route.ts
│       ├── contracts/[contractId]/activate/route.ts
│       ├── contracts/[contractId]/pdf/route.ts
│       ├── contracts/draft/route.ts
│       ├── ai/fba/route.ts
│       ├── ai/alerts/route.ts
│       ├── bankbook/[studentId]/weekly/route.ts
│       ├── bankbook/[studentId]/pdf/route.ts
│       └── cron/                            # pg_cron이 HTTP 호출
│           ├── daily-salary/route.ts
│           ├── daily-settle/route.ts
│           ├── weekly-bonus/route.ts
│           ├── weather-stock/route.ts
│           └── extinction-check/route.ts
│
├── components/
│   ├── ui/
│   │   ├── BigButton.tsx
│   │   ├── BalanceCard.tsx
│   │   ├── DepositAnimation.tsx
│   │   ├── ConfirmModal.tsx
│   │   ├── TransactionItem.tsx
│   │   ├── StockCard.tsx
│   │   ├── PinInput.tsx
│   │   └── ClassCodeInput.tsx
│   ├── teacher/
│   │   ├── PbsCheckBoard.tsx
│   │   ├── StudentTabs.tsx
│   │   ├── DroTimer.tsx
│   │   ├── SettlePreview.tsx
│   │   ├── StockPriceEditor.tsx
│   │   ├── ContractEditor.tsx
│   │   └── BankbookPrint.tsx
│   ├── student/
│   │   ├── ShopGrid.tsx
│   │   ├── SelfCheckList.tsx
│   │   └── GiftModal.tsx
│   └── atm/
│       └── QrScanner.tsx
│
└── lib/
    ├── supabase/
    │   ├── client.ts          # schema: 'pbs' 필수
    │   └── server.ts          # schema: 'pbs' 필수
    ├── ai/
    │   ├── fba-analyzer.ts
    │   └── contract-drafter.ts
    ├── weather/
    │   └── price-calculator.ts
    ├── salary/
    │   └── settler.ts
    ├── session.ts
    └── utils.ts
```

---

## 7. Supabase 클라이언트 패턴 (schema 필수)

```typescript
// lib/supabase/client.ts (브라우저)
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'pbs' } }   // ← 반드시
  )

// lib/supabase/server.ts (서버)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createServerSupabase = () =>
  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => cookies().getAll() },
      db: { schema: 'pbs' }      // ← 반드시
    }
  )
```

---

## 8. Phase 계획

### Phase 1 (먼저 완성)
```
① 학급 개설 + 식별코드 자동 발급
② 학생 등록 (이름 + PIN + QR)
③ 학생 계좌 생성 (시작 잔액 1,000원)
④ 교사 PBS 체크 화면
⑤ 자동 정산 (pg_cron → API)
⑥ 학생 잔액 확인 태블릿 화면
```

### Phase 2
```
⑦ 가게 + 구매 + 선물하기
⑧ 통장 출력물 PDF
⑨ 날씨 연동 주식 4종
⑩ 교사 커스텀 주식 + 주가 조정 UI
⑪ 행동계약서 + PDF
⑫ 시스템 설정 + 동의서
```

### Phase 3
```
⑬ Claude FBA 분석
⑭ 소거 감지 모니터링
⑮ 계약서 AI 초안 생성
⑯ 학급 공동계좌 + 집단수반성
```

---

## 9. 절대 규칙 (비즈니스 로직)

```
① 최저잔액 500원 이하 차감 불가 — 서버 레벨 강제
② 반응대가 기본값: 모든 학생 비활성
③ Cron 인증: Authorization: Bearer {CRON_SECRET} 헤더 필수
④ AI 제안 화면: "이 제안은 보조적 도구입니다. 최종 판단은 담당 교사가 합니다." 고정 표시
⑤ teacher_note → 학생 화면 절대 노출 금지
⑥ 학생 버튼 최소 56px (08_디자인가이드 참조)
⑦ 모든 DB 쿼리 pbs schema 명시 — schema 생략 금지
```

---

## 10. 개발 시작 순서

```
STEP 1.  npx create-next-app@latest pbs --typescript --tailwind --app
         npm install @supabase/ssr @supabase/supabase-js iron-session

STEP 2.  .env.local 작성

STEP 3.  Supabase SQL Editor:
         a. CREATE SCHEMA IF NOT EXISTS pbs;
            GRANT USAGE ON SCHEMA pbs TO anon, authenticated;
            ALTER DEFAULT PRIVILEGES IN SCHEMA pbs
              GRANT ALL ON TABLES TO anon, authenticated;
         b. 02_DB_스키마설계.md SQL 실행
            (각 CREATE TABLE 앞에 pbs. 붙여서 실행)
         c. behavior_db_seed.sql 실행
            (근거 DB — Claude FBA 기능 필수)
         d. Extensions: pg_cron + pg_net 활성화

STEP 4.  lib/supabase/client.ts + server.ts 작성 (schema: 'pbs' 포함)

STEP 5.  인증 라우트 → 학급 개설 → 학생 등록 → PBS 체크 화면 순서로 개발

STEP 6.  배포 후 pg_cron schedule 등록 (위 결정 C의 SQL, 실제 도메인으로 교체)
```
