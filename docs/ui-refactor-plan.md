# PBS 토큰 이코노미 — UI/UX 리팩토링 계획서

> 작성일: 2026-04-15  
> 기준 학급: NDG-2026-003 (수다모여반 · 이성엽 선생님)  
> 목적: PTR 행동중재 흐름 기반 인터페이스 정교화

---

## 1. 현황 분석 요약

### 1.1 데이터 현황 (Supabase 실조회 기준)

| 테이블 | NDG-2026-003 건수 | 비고 |
|--------|-------------------|------|
| pbs_students | 6명 | 전원 pbs_stage=1, behavior_function=null |
| pbs_accounts | 6건 | 전원 잔액 1,000원 (시작잔액만) |
| pbs_transactions | 6건 | 유형: level_up_bonus (시작잔액 지급만) |
| pbs_goals | **0건** | ← 핵심 병목 |
| pbs_records | 0건 | 목표 없으므로 체크 기록 없음 |
| pbs_fba_records | 0건 | 이 학급에서 FBA 미실시 |
| pbs_student_ai_profiles | 1건 (조사영) | 대부분 빈 필드 |
| pbs_behavior_contracts | 1건 (테스트) | `dkssudgktpdy` 등 더미 |
| pbs_dro_timers | 0건 | 이 학급 DRO 미실행 |
| pbs_extinction_alerts | 0건 | |
| pbs_intervention_library | 22개 (전체) | 4중 학술 근거 완비 |
| pbs_shop_items | 1개 (자유시간 10원) | 가격 불균형 |
| pbs_custom_stocks | 1개 (우주에너지 418원) | |
| pbs_speech_diaries | 110건+ | 실사용 중 (서재민, 민규원 등) |
| pbs_salary_rules | 2건 | 출석 500원, 주간보너스 1,000원 |

### 1.2 PTR 프레임워크 매핑 상태

```
사정(Assessment)  →  계획(Plan)      →  실행(Execute)    →  점검(Review)
FBA: 0건             목표: 0건          계약서: 1건(더미)    소거알림: 0건
AI프로필: 1건(빈)    전략연결: 0건      DRO: 0건             추세: 데이터 없음
                                        반응대가: 0건
```

### 1.3 주요 발견사항

1. **토큰 흐름 정지** — pbs_goals 0건으로 전체 강화 루프 미작동
2. **사정탭 순서 역전** — AI 프로필이 FBA보다 상위 노출 (PTR 절차 위반)
3. **용어 혼재** — DRO, FBA, PTR, Response Cost 등 전문 약어 직노출
4. **경로 분산** — 동일 기능이 3개 경로로 분산 (교사 혼란)
5. **헤더 개발 메모 잔류** — "갤럭시탭 가로 PWA 기준 레이아웃" 사용자 노출
6. **가격 불균형** — 출석 기본급 500원 vs 가게 아이템 10원

---

## 2. 리팩토링 계획 (꼬임 최소 순)

### R1. 사정탭 순서 역전
- **파일**: `app/[classCode]/students/[studentId]/page.tsx`
- **변경**: FBA 기록 섹션을 사정탭 상단으로, AI 행동 지원 계획을 하단 보조로
- **근거**: Cooper et al.(2020) — 기능사정은 관찰 데이터가 선행되어야 함
- **상태**: ✅ 완료 (이미 올바른 순서)

### R2. 사이드바 + 탭 용어 한국어화
- **파일**: `app/[classCode]/SidebarNav.tsx`, `app/[classCode]/students/[studentId]/StudentSupportTabs.tsx`
- **변경 목록**:
  - `PBS 체크` → `행동 목표 체크`
  - `학생 지원 (PTR)` → `학생 지원 계획`
  - `토큰 경제` → `보상 · 가게`
  - 탭 hint `AI 프로필 · FBA` → `행동 원인 분석 · AI`
  - 탭 hint `Teach · Prevent` → `목표 · 예방 전략`
  - 탭 hint `계약 · DRO · 거래` → `약속 · 강화 타이머 · 거래`
  - 탭 hint `알림 · 추세 · 링크` → `경보 · 추세 · 연결`
  - 추가 파일: `pbs/page.tsx` — 모든 "PBS 목표" → "행동 목표"
- **상태**: ✅ 완료

### R3. 헤더 개발 메모 제거
- **파일**: `app/[classCode]/TeacherShell.tsx`
- **변경**: "교사 운영 화면 / 갤럭시탭 가로 PWA 기준 레이아웃" → "PBS 토큰 이코노미 / {classCode} · 교사 운영"
- **상태**: ✅ 완료

### R4. /behavior-analysis → /support 리다이렉트
- **파일**: `app/[classCode]/behavior-analysis/page.tsx`
- **변경**: 87행 → 10행 redirect()으로 교체
- **사이드바**: 이미 /support만 존재, 다른 코드 참조 없음
- **상태**: ✅ 완료

### R5. 학생상세 + support 허브 용어 통일
- **파일**: `students/[studentId]/page.tsx`, `support/page.tsx`, `support/views/*.tsx`
- **변경 목록**:
  - "사정 기록 (FBA)" → "행동 원인 분석 기록"
  - "PBS 행동 목표 (Teach)" → "행동 목표"
  - "중재 전략 (Prevent·Reinforce)" → "중재 전략"
  - "행동계약서 (Teach·Reinforce)" → "행동 약속 계약서"
  - "실행 중인 DRO" → "실행 중인 강화 타이머"
  - "소거 위험 알림" → "소거 위험 경보"
  - "PTR Support Hub" → "학생 지원 허브"
  - "DRO 타이머" → "강화 타이머", "FBA 기록" → "행동 원인 분석"
  - "반응대가 (Response Cost)" → "반응대가"
- **상태**: ✅ 완료

### R6. 대시보드 용어 + 소거경보 문구 개선
- **파일**: `app/[classCode]/dashboard/page.tsx`
- **변경**:
  - "오늘 PBS 체크" → "오늘 행동 체크"
  - "DRO 타이머" → "강화 타이머"
  - "소거 폭발(Extinction Burst) 패턴" → "강화 중단 후 일시적 행동 증가 패턴"
- **상태**: ✅ 완료

### R7. 2차 용어 정비 (수업 모드 · AI 계획 · FBA 뷰 · 도움말 · API 메시지)
- **범위**: 화면에 노출되는 FBA / DRO / PBS 목표 / PBS 체크 표현을 1차와 동일한 기준으로 맞춤. 내부 변수명·DB 필드(`fba_consent` 등)·전략 약어(DRA, FCT 등)는 유지.
- **파일** (요약):
  - `support/views/FbaClassView.tsx`, `InterventionsLibraryView.tsx`, `AlertsView.tsx`
  - `teach/page.tsx`, `students/.../AiBehaviorPlan.tsx`, `PrintableSupportPlan.tsx`
  - `help/page.tsx`, `ethics/page.tsx`, `settings/page.tsx`
  - `api/pbs/goals/*`, `api/pbs/records/*`, `api/dro/*`
  - `support/page.tsx` (버킷 설명, 통계 라벨), `GoalDeleteButton.tsx`, `s/.../home/page.tsx`
- **상태**: ✅ 완료

### R8. 학생 채널 용어 (스스로 체크 · ATM · 통장)
- **원칙**: 교사 화면과 동일하게 **행동 목표**, **스스로 체크**, **학급 보상·토큰** 중심 표기. 약어 PBS/DRO는 학생 화면에 노출하지 않음.
- **파일**: `app/s/.../layout.tsx`, `selfcheck/page.tsx`, `home/page.tsx`, `bankbook/page.tsx`, `app/atm/page.tsx`, `api/pbs/selfcheck/route.ts`, 교사 측 `pbs/page.tsx`·`AiBehaviorPlan.tsx`의 동일 기능 라벨.
- **상태**: ✅ 완료

### R9. 데이터 — 기본 행동 목표 시드 + 가게 최저가 정리
- **마이그레이션**: `supabase/migrations/010_seed_starter_goals_and_shop_floor.sql`
  - 활성 행동 목표가 **하나도 없는** 학생에게만 기본 목표 2개 삽입(회당 50원·40원, 일일 목표 5·4회, 스스로 체크 허용).
  - 활성 가게 상품 중 **가격이 100 미만(0 초과)** 인 항목 가격을 **200**으로 상향(지나치게 낮은 소비 재화 보정).
- **적용 방법**: Supabase에 `supabase db push` 또는 SQL Editor에서 해당 파일 실행. 이미 목표가 있는 학생·100원 이상 상품에는 영향 없음(멱등).
- **원격 적용(실행됨)**: `node scripts/apply-010-seed-remote.mjs` — 서비스 롤로 동일 로직 실행. 결과 예: 행동 목표 20행(학생 10명), 가게「자유 시간」10→200원 1건.
- **상태**: ✅ 완료 (원격 DB 반영 완료)

---

## 3. 진척 기록

| 시각 | 작업 | 상태 | 변경 파일 |
|------|------|------|-----------|
| 2026-04-15 22:20 | 분석 보고서 완료, MD 문서 생성 | ✅ | `docs/ui-refactor-plan.md` |
| 2026-04-15 22:21 | R1 — 사정탭 순서 확인 → 이미 FBA 우선 | ✅ (skip) | — |
| 2026-04-15 22:22 | R2 — 사이드바 + 탭 용어 한국어화 | ✅ | `SidebarNav.tsx`, `StudentSupportTabs.tsx` |
| 2026-04-15 22:23 | R3 — 헤더 개발 메모 → 학급명+코드 | ✅ | `TeacherShell.tsx` |
| 2026-04-15 22:24 | R4 — /behavior-analysis → redirect | ✅ | `behavior-analysis/page.tsx` |
| 2026-04-15 22:25 | R5 — 학생상세+support 허브 용어 통일 | ✅ | `students/[studentId]/page.tsx`, `support/page.tsx`, views 3개 |
| 2026-04-15 22:28 | R6 — 대시보드 용어 + 소거경보 문구 | ✅ | `dashboard/page.tsx` |
| 2026-04-15 22:28 | R2 확장 — pbs/page.tsx 내 용어 통일 | ✅ | `pbs/page.tsx` |
| 2026-04-15 22:35 | `next build` 성공 — 린트 에러 0, 빌드 OK | ✅ | — |
| 후속 | R7 — 2차 용어 정비 (교사·학생·도움말·API) | ✅ | FbaClassView, teach, AiBehaviorPlan, help, api 등 다수 |
| 후속 | R7 후 `next build` | ✅ | 성공 |
| 후속 | R8 — 학생 채널·ATM·통장 용어 | ✅ | `app/s/**`, `atm`, `api/pbs/selfcheck`, `pbs`, `AiBehaviorPlan` |
| 후속 | R9 — 마이그레이션 010 시드·가게 하한 | ✅ | `010_seed_starter_goals_and_shop_floor.sql` |
| 후속 | R8·R9 후 `next build` | ✅ | 성공 |

---

## 4. 참고 학술 근거

- Cooper, Heron & Heward (2020). *Applied Behavior Analysis* 3rd ed.
- Dunlap, Iovannone, Kincaid et al. (2010). *PTR: Prevent-Teach-Reinforce* manual.
- Kazdin, A.E. (2012). *The Token Economy: A Review and Evaluation.*
- Lerman, D.C. & Iwata, B.A. (1995). Prevalence of the extinction burst.
- Repp, A.C. & Dietz, S.M. (1974). DRO interval setting principles. *JABA, 7(2).*
- Carr, E.G. et al. (2002). PBS: Evolution of an applied science. *JPBI, 4(1).*
- 국립특수교육원 (2019). *PBS 실행 매뉴얼* 3장.
