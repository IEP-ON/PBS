# README — PBS 토큰 이코노미 개발 문서
> 최종 정리: 2026-03-21 (리팩토링 v4)
> **이 폴더의 문서만 사용할 것. 구버전 파일은 모두 폐기.**

---

## 문서 목록 및 읽기 순서

### MD 문서 (Windsurf 참조용)

| 파일 | 내용 | 상태 |
|---|---|---|
| `00_Windsurf_시작프롬프트.md` | 전체 맥락·스택·개발순서 — **Windsurf 첫 번째 입력** | ✅ 신규 작성 |
| `01_PRD_시스템개요.md` | 제품 요구사항 전체 | ✅ v3 기반 |
| `02_DB_스키마설계.md` | 27개 테이블 스키마 + RLS | ✅ v3 기반 |
| `03_AI연동_행동주의전략.md` | Claude API + PBS 전략 매핑 | ✅ 원본 유지 |
| `04_화면흐름_기능명세.md` | 전체 화면 + UX 흐름 | ✅ v3 기반 |
| `05_운영규칙_정책.md` | 화폐·인증·주식·데이터 정책 | ✅ 번호 재배치 |
| `06_API라우트_폴더구조.md` | Next.js 구조 + API 명세 전체 | ✅ 두 파일 병합 |
| `07_자동화스케줄러_날씨API.md` | Vercel Cron + 날씨 주가 | ✅ 두 파일 병합 |
| `08_프론트엔드_디자인가이드.md` | 접근성 기준 + 컴포넌트 | ✅ 두 파일 병합 |
| `09_GPT_시스템프롬프트.md` | Claude AI 어시스턴트 프롬프트 | ✅ 재배치 |
| `10_HATCH_연동컨텍스트.md` | H.A.T.C.H. 프로젝트 연결 구조 | ✅ 신규 작성 |

---

## 리팩토링 변경 내역

### 폐기된 구버전 파일 (사용 금지)

| 구버전 파일명 | 이유 | 대체 파일 |
|---|---|---|
| `00_Windsurf_시작프롬프트_Phase1.md` | Phase 1 MVP 기준, HATCH 맥락 없음 | `00_Windsurf_시작프롬프트.md` |
| `01_PRD_시스템개요.md` (v1) | v3 이전 버전, 주식·인증 설계 누락 | `01_PRD_시스템개요.md` (v3 기반) |
| `02_DB_스키마설계.md` (v1) | v3 이전, class_codes·커스텀주식 없음 | `02_DB_스키마설계.md` (v3 기반) |
| `04_화면흐름_기능명세.md` (v1) | v3 이전, 학급 개설·커스텀 주식 없음 | `04_화면흐름_기능명세.md` (v3 기반) |
| `06_API라우트_NextJS폴더구조.md` | 세션 인증 설계 불완전 | `06_API라우트_폴더구조.md` (병합) |
| `06_API라우트_Next_js폴더구조.md` | 동일 내용 중복 | `06_API라우트_폴더구조.md` (병합) |
| `06_운영규칙_정책.md` | 번호 06 충돌 | `05_운영규칙_정책.md` (번호 변경) |
| `08_자동화스케줄러_날씨API.md` | 소거 감지 Cron 누락 | `07_자동화스케줄러_날씨API.md` (병합) |
| `08_09_자동화스케줄러_날씨API.md` | 동일 내용 중복 | `07_자동화스케줄러_날씨API.md` (병합) |
| `10_프론트엔드디자인가이드.md` | 동일 내용 중복 | `08_프론트엔드_디자인가이드.md` (병합) |
| `10_프론트엔드_디자인가이드.md` | 동일 내용 중복 | `08_프론트엔드_디자인가이드.md` (병합) |
| `gpt_system_prompt.md` | 경로·번호 정규화 필요 | `09_GPT_시스템프롬프트.md` |

### 주요 수정 사항

1. **AI API 통일**: 모든 문서에서 Anthropic Claude API 사용으로 통일
   - 모델: `claude-sonnet-4-20250514`
   - 엔드포인트: `https://api.anthropic.com/v1/messages`
   - 환경변수: `ANTHROPIC_API_KEY` (OPENAI_API_KEY 아님)

2. **H.A.T.C.H. 연동 컨텍스트 추가**: `10_HATCH_연동컨텍스트.md` 신규

3. **번호 체계 정규화**: 00~10 연속, 중복·결번 제거

4. **시작 프롬프트 전면 재작성**: Phase 1 MVP → 전체 시스템 기준

---

## Windsurf 사용 방법

```
Step 1: 이 README를 읽어 전체 구조 파악
Step 2: 00_Windsurf_시작프롬프트.md를 Windsurf에 첫 번째로 입력
Step 3: 개발하려는 기능에 맞는 참조 파일을 추가로 입력
        - DB 관련 → 02_DB_스키마설계.md
        - API 관련 → 06_API라우트_폴더구조.md
        - Cron 관련 → 07_자동화스케줄러_날씨API.md
        - UI 관련 → 08_프론트엔드_디자인가이드.md
        - AI 기능 → 03_AI연동_행동주의전략.md + 09_GPT_시스템프롬프트.md
Step 4: H.A.T.C.H. 맥락이 필요하면 → 10_HATCH_연동컨텍스트.md 추가
```

---

## ⚠️ 개발 시작 전 필수 체크리스트

```
STEP 1. Supabase SQL Editor → 02_DB_스키마설계.md 의 SQL 실행 (테이블 27개 생성)
STEP 2. Supabase SQL Editor → behavior_db_seed.sql 실행 (근거 DB 시드 — AI FBA 필수)
STEP 3. .env.local 환경변수 설정
         ANTHROPIC_API_KEY=   ← Claude API (OpenAI 아님)
         WEATHER_API_KEY=
         CRON_SECRET=
         SESSION_SECRET=
         NEXT_PUBLIC_SUPABASE_URL=
         NEXT_PUBLIC_SUPABASE_ANON_KEY=
         SUPABASE_SERVICE_ROLE_KEY=
STEP 4. Windsurf에 00_Windsurf_시작프롬프트.md 첫 번째 입력
STEP 5. 개발 시작 (06_API라우트_폴더구조.md 폴더 구조 그대로 생성)
```

**SQL 파일 실행 순서 (순서 틀리면 외래키 오류):**
```
1. behavior_functions
2. intervention_library
3. function_intervention_map  ← behavior_functions 참조
4. extinction_risk_criteria
5. ethics_guidelines
6. class_codes
7. students                   ← class_codes 참조
8. accounts                   ← students 참조
9. (이하 02_DB_스키마설계.md 순서대로)
```
