# PTR 자동화 통합 플랜 — QR 토큰경제 × PBS·PTR × GPT API
> 작성일: 2026-04-16
> 목적: 다른 LLM 모델이 읽고 바로 개발할 수 있는 정밀 구현 명세
> 전제: 이 문서는 `token_system/` 폴더의 01~10번 문서와 실제 구현 코드를 전수 분석한 뒤 작성됨

---

## 0. 읽기 전 반드시 이해할 것

### 0.1 시스템 정체성
이 시스템은 **PBS(긍정적 행동지원)의 PTR(Prevent-Teach-Reinforce) 프레임워크**를 **토큰경제(가상화폐)**로 구현한 웹앱이다. QR 카드는 학생 인증 수단이자 강화의 즉시성을 보장하는 전달 매체다.

### 0.2 PTR이란
| 단계 | 목적 | 핵심 질문 |
|---|---|---|
| **Prevent** | 문제 행동이 일어나기 전에 환경을 조절 | "왜 이 행동이 나오나? 어떻게 미리 막을까?" |
| **Teach** | 문제 행동 대신 할 수 있는 적절한 행동을 가르침 | "대신 뭘 하면 되는지 어떻게 단계적으로 알려줄까?" |
| **Reinforce** | 적절한 행동을 했을 때 즉시 강화(보상) | "잘했을 때 어떻게 바로 알아주고 보상할까?" |

### 0.3 현재 상태 요약
- **Reinforce**: 매우 잘 구현됨 (토큰 즉시 입금, 가게, DRO 타이머, 행동계약서, 차별강화 전략 전부 연동)
- **Teach**: 데이터는 있으나(AI 프로필 18개 필드) 교수 절차와 연결 안 됨
- **Prevent**: 데이터는 있으나(antecedent_patterns, prevention_supports) 실시간 활용 안 됨

---

## 1. 현재 구현된 GPT API 파이프라인 (정확한 코드 기준)

### 1.1 자유글 → AI 프로필 구조화

**파일**: `app/api/ai/student-profile/parse/route.ts`
**엔드포인트**: `POST /api/ai/student-profile/parse`
**모델**: `gpt-4o` (temperature: 0.3, max_tokens: 2600)

```
입력: { studentId, studentName, grade, freeText }
출력: {
  draft: {
    profile: {
      current_level_summary, strengths, preferences,
      student_voice_keywords, support_needs, risk_flags,
      observable_behaviors, antecedent_patterns, consequence_patterns,
      hypothesized_functions, replacement_behaviors,
      positive_target_behaviors, prevention_supports,
      reinforcement_preferences, incident_tags,
      class_mode_targets, p_prompt_options, dro_candidate,
      student_registration_summary, ai_plan_one_liner,
      public_cue, public_safe_summary, private_teacher_notes
    },
    follow_up_questions: [...],  // 누락 정보 보강 질문 2~4개
    confidence_by_field: {...}
  }
}
```

**참조하는 DB 테이블**:
- `pbs_behavior_functions` → 행동 기능 4가지 분류 기준 (detection_signals, common_antecedents, common_consequences)
- `pbs_ethics_guidelines` → 윤리 가드레일 (category, guideline_ko, ai_prompt_rule)

### 1.2 AI 프로필 보강 (후속 질문 응답 통합)

**파일**: `app/api/ai/student-profile/refine/route.ts`
**엔드포인트**: `POST /api/ai/student-profile/refine`

```
입력: { studentId, sourceFreeText, currentProfile, answers: { q1: "...", q2: "..." } }
출력: { draft: { profile, follow_up_questions, confidence_by_field } }
```

### 1.3 AI 프로필 저장

**파일**: `app/api/students/[studentId]/ai-profile/route.ts`
**엔드포인트**: `PATCH /api/students/{studentId}/ai-profile`
**저장 테이블**: `pbs_student_ai_profiles`

### 1.4 행동 지원 계획 일괄 생성

**파일**: `app/api/ai/behavior-plan/route.ts`
**엔드포인트**: `POST /api/ai/behavior-plan`
**모델**: `gpt-4o` (response_format: json_object, max_tokens: 3000)

```
입력: { studentId, optionalPrompt? }
(내부에서 pbs_student_ai_profiles + pbs_students 자동 조회)

출력: {
  plan: {
    fba: {
      estimatedFunction: "attention|escape|sensory|tangible",
      confidence: "high|medium|low",
      rationale: "...",
      behaviorPattern: "..."
    },
    pbsGoals: [{
      behaviorName, behaviorDefinition, strategyType,
      tokenPerOccurrence (100~500), dailyTarget (3~10), rationale
    }],
    contract: {
      contractTitle, targetBehavior, behaviorDefinition,
      measurementMethod, achievementCriteria,
      rewardAmount (1000~5000), teacherNote
    },
    interventions: [{
      strategyName, description, evidenceLevel, applicableFunctions
    }],
    dro: {
      intervalMinutes, tokenReward (100~500), rationale
    },
    extinctionAlert: {
      baselineCount, alertThreshold, rationale
    }
  },
  logId: "..."
}
```

**참조하는 DB 테이블**:
- `pbs_intervention_library` → 근거기반 중재전략 (abbreviation, name_ko, evidence_level, target_functions, description_ko)
- `pbs_function_intervention_map` → 행동 기능별 우선순위 전략 매핑 (function_type, intervention_abbreviation, priority, rationale)
- `pbs_extinction_risk_criteria` → 소거 위험도 기준 (function_type, risk_level, burst_likelihood)

### 1.5 "모두 저장" 시 실제 저장되는 곳

**파일**: `app/[classCode]/students/[studentId]/AiBehaviorPlan.tsx` 의 `saveAll()` 함수

| 생성된 것 | 저장 API | 저장 테이블 | 토큰경제 연결 |
|---|---|---|---|
| FBA 분석 | `POST /api/fba` | `pbs_fba_records` | 기능 → 전략 매핑 기준 |
| PBS 목표 N개 | `POST /api/pbs/goals` | `pbs_goals` | **교사 체크 → 토큰 입금** |
| 행동계약서 | `POST /api/contracts` | `pbs_behavior_contracts` | **달성 → 보너스 토큰** |
| 중재전략 N개 | `POST /api/interventions` | `pbs_intervention_library` | 목표와 전략 자동 연결 |

**저장 순서** (코드 기준):
1. 중재전략 저장 (`saveInterventions`)
2. FBA + PBS 목표 + 계약서 병렬 저장 (`saveFba`, `savePbsGoals`, `saveContract`)
3. 피드백 로그 저장 (`/api/ai/behavior-plan-feedback`)

### 1.6 PBS 목표 → 토큰 입금 흐름 (이미 완성)

```
교사가 PBS 체크 화면에서 목표행동 발생 횟수 입력
    ↓
POST /api/pbs/records
    → pbs_goals.token_per_occurrence × occurrence_count = token_granted
    → pbs_records 에 저장 (is_settled: false)
    ↓
매일 15:00 Cron (POST /api/cron/daily-settle 또는 POST /api/salary/settle)
    → is_settled: false 인 레코드 일괄 정산
    → pbs_accounts.balance += token_granted
    → pbs_transactions INSERT (type: 'salary_pbs')
    ↓
학생 ATM에서 QR 스캔 → 잔액 확인 → 가게에서 구매
```

---

## 2. 현재 PTR 단계별 연결 상태 (정밀 진단)

### 2.1 Prevent 단계

| AI 프로필 필드 | 현재 상태 | 수업 중 사용 여부 |
|---|---|---|
| `antecedent_patterns` | GPT가 자유글에서 추출 | **사용 안 됨** (프로필 카드에만 표시) |
| `prevention_supports` | GPT가 자유글에서 추출 | **사용 안 됨** (프로필 카드에만 표시) |

**문제**: 데이터는 있지만, 교사가 수업 중에 이걸 보고 행동할 수 있는 UI 경로가 없음.

### 2.2 Teach 단계

| AI 프로필 필드 | 현재 상태 | 수업 중 사용 여부 |
|---|---|---|
| `replacement_behaviors` | GPT가 추출 | PBS 목표 등록 후보로만 사용 |
| `class_mode_targets` | GPT가 추출 | **`/api/teach/summary`에서 제공** ✅ |
| `p_prompt_options` | GPT가 추출 | **`/api/teach/summary`에서 제공** ✅ |
| `positive_target_behaviors` | GPT가 추출 | PBS 목표 등록 후보로만 사용 |

**`pbs_records` 테이블의 `prompted` 컬럼**: boolean (true/false)만 저장.
촉구 수준(전체 촉구/부분 촉구/제스처/독립)은 기록 안 됨.

**문제**: "뭘 가르칠지"는 있지만 "어떻게 가르칠지(교수 절차)"와 "진행도 추적"이 없음.

### 2.3 Reinforce 단계

| 기능 | 구현 상태 | 토큰 연결 |
|---|---|---|
| PBS 목표 체크 → 토큰 | ✅ 완성 | `token_per_occurrence × count` |
| DRO 타이머 → 토큰 | ✅ 완성 | 타이머 완료 시 자동 입금 |
| DRL 주간 보너스 | ✅ 완성 | 금요일 자동 정산 |
| 행동계약서 달성 | ✅ 완성 | `contract_bonus` 토큰 |
| 레벨업 보너스 | ✅ 완성 | `level_up_bonus` 토큰 |
| 반응대가 (차감) | ✅ 완성 | 최저잔액 서버 강제 보호 |
| 가게 (백업강화물) | ✅ 완성 | 토큰으로 구매 |
| 셀프 체크 | ✅ 완성 | 학생 요청 → 교사 승인 → 입금 |

**문제**: 강화물 선호도 평가(preference assessment) 도구 없음. 가게 아이템은 교사 임의 등록.

### 2.4 전체 차원

| 기능 | 구현 상태 |
|---|---|
| 소거 모니터링 Cron | ✅ 구현됨 (`/api/extinction-alerts` POST) |
| 소거 경보 조회/해결 | ✅ 구현됨 (`/api/extinction-alerts` GET/PATCH) |
| 토큰경제 건강도 | ✅ 구현됨 (`/api/token-economy/health`) |
| 학생 지원 단계 분류 | ✅ 구현됨 (`lib/support/classify.ts` → assess/plan/execute/review 4단계) |
| PTR 실행 충실도 | ❌ 없음 |

---

## 3. 구현해야 할 것 (우선순위 순)

### 3.1 Phase 1: Prevent 단계 실시간 활용 (GPT 추가 호출 불필요)

#### Task 1-A: 수업모드에서 prevention_supports 표시

**목표**: `/api/teach/summary` 응답에 `prevention_supports` 필드를 포함시키고, 교사 수업모드 UI에서 학생 카드에 표시

**현재 코드** (`app/api/teach/summary/route.ts` 라인 82~85):
```typescript
const { data: profiles } = await supabase
  .from('pbs_student_ai_profiles')
  .select('student_id, class_mode_targets, p_prompt_options, incident_tags, public_safe_summary')
  .in('student_id', studentIds)
```

**변경 사항**:
1. `select` 문에 `prevention_supports` 추가
2. `TeachStudent` 인터페이스에 `prevention_supports: string[]` 추가
3. 리턴 객체에 `prevention_supports: profileMap.get(student.id)?.prevention_supports || []` 추가

**예상 공수**: 30분
**GPT API 호출**: 없음 (기존 데이터 활용)
**DB 변경**: 없음

#### Task 1-B: behavior-plan API에 ncrSchedule 필드 추가

**목표**: GPT가 행동 지원 계획 생성 시 NCR(비수반 강화) 일정도 함께 추천

**변경 파일**: `app/api/ai/behavior-plan/route.ts`

**systemPrompt에 추가할 내용**:
```
8. ncrSchedule은 행동 기능이 attention 또는 tangible일 때만 생성하세요.
   intervalMinutes는 기저선 행동 간격의 70~80% 수준 (Vollmer et al. 1993 기준).
   sensory/escape 기능에는 ncrSchedule을 null로 반환하세요.
```

**userPrompt JSON 구조에 추가**:
```json
"ncrSchedule": {
  "intervalMinutes": "숫자 (NCR 제공 간격, 분 단위)",
  "reinforcerType": "attention|tangible|activity 중 하나",
  "description": "구체적 NCR 실행 방법 (1-2문장)",
  "rationale": "간격 설정 근거"
} | null
```

**프론트엔드 표시**: `AiBehaviorPlan.tsx`의 DRO 타이머 카드 옆에 NCR 일정 카드 추가
**DB 저장**: `pbs_goals`에 `is_ncr: boolean`, `ncr_interval_minutes: int` 컬럼 추가 필요

**예상 공수**: 2시간
**GPT API 호출**: 기존 behavior-plan 호출에 포함 (추가 호출 없음)

#### Task 1-C: pbs_records에 context_note 기반 선행사건 퀵태그

**현재 상태**: `pbs_records.context_note`은 자유 텍스트 필드 (교사 수기)

**변경 사항**:
1. `pbs_records`에 `antecedent_tag text` 컬럼 추가
2. PBS 체크 화면에서 `p_prompt_options`처럼 AI 프로필의 `antecedent_patterns`를 드롭다운으로 표시
3. 교사가 1탭으로 선행사건 태그 선택 가능

**예상 공수**: 2시간
**GPT API 호출**: 없음
**DB 변경**: `ALTER TABLE pbs_records ADD COLUMN antecedent_tag text;`

---

### 3.2 Phase 2: Teach 단계 교수 절차 기록

#### Task 2-A: pbs_records에 prompt_level 컬럼 추가

**목표**: 교사가 PBS 체크 시 촉구 수준을 기록할 수 있게 함

**DB 변경**:
```sql
ALTER TABLE pbs.pbs_records
ADD COLUMN prompt_level text CHECK (prompt_level IN ('full', 'partial', 'gesture', 'independent'));
```

**API 변경** (`app/api/pbs/records/route.ts`):
- POST body에 `promptLevel` 파라미터 추가
- INSERT 시 `prompt_level: promptLevel || null` 추가
- 기존 `prompted: boolean`은 하위 호환 유지 (`prompt_level !== null && prompt_level !== 'independent'`이면 `prompted = true`)

**UI 변경** (PBS 체크 화면):
- 기존 촉구 여부 토글 → 4단계 드롭다운으로 교체
  - 전체 촉구 (full): 교사가 행동을 전부 안내
  - 부분 촉구 (partial): 힌트만 제공
  - 제스처 (gesture): 눈짓/손짓만
  - 독립 (independent): 학생 스스로 수행

**예상 공수**: 1.5시간
**GPT API 호출**: 없음

#### Task 2-B: FCT 교수 시나리오 API 추가

**새 파일**: `app/api/ai/fct-script/route.ts`
**엔드포인트**: `POST /api/ai/fct-script`

```
입력: {
  studentId: string,
  replacementBehavior: string,      // "도와주세요"라고 말하기
  behaviorFunction: string,          // attention
  currentPromptLevel: string,        // full
  antecedentPatterns: string[],      // 프로필에서 자동 주입
}

출력: {
  script: {
    setup: "string (상황 설정 방법)",
    prompt: "string (촉구 제공 방법)",
    expectedResponse: "string (학생 반응 예시)",
    reinforcement: "string (강화 방법 — 토큰경제 연계)",
    errorCorrection: "string (오류 수정 방법)"
  },
  fadingPlan: {
    currentLevel: "full|partial|gesture|independent",
    nextLevel: "partial|gesture|independent",
    criterionToAdvance: "string (예: 3일 연속 80% 독립 수행 시 전환)",
    rationale: "string"
  }
}
```

**시스템 프롬프트 참조 문헌**: Carr & Durand (1985) FCT 원저, Cooper et al. (2020) ABA 3판 14장

**호출 시점**: 
- 옵션 A: behavior-plan 생성 시 함께 호출 (별도 API)
- 옵션 B: PBS 목표 상세 화면에서 "교수 시나리오 생성" 버튼

**예상 공수**: 3시간
**GPT API 호출**: 1회 (gpt-4o, max_tokens: 1500)

#### Task 2-C: 촉구 페이딩 진행도 분석 API

**새 파일**: `app/api/ai/teach-progress/route.ts`
**엔드포인트**: `POST /api/ai/teach-progress`

```
입력: {
  studentId: string,
  goalId: string,
  days: number (기본 14)
}

내부 조회:
- pbs_records WHERE student_id = ? AND goal_id = ? AND record_date >= 14일 전
  → prompt_level 집계 (일별 full/partial/gesture/independent 비율)

출력: {
  progress: {
    totalRecords: number,
    levelDistribution: { full: number, partial: number, gesture: number, independent: number },
    trend: "improving|stable|regressing",
    independenceRate: number (0~100%),
    readyToFade: boolean
  },
  recommendation: "string (GPT 권고: 다음 촉구 수준으로 전환 시점)"
}
```

**GPT 호출 여부**: 선택적. `prompt_level` 데이터 집계는 서버에서 직접 계산. GPT는 `recommendation` 한 줄 생성에만 사용 (호출 안 해도 됨).

**예상 공수**: 3시간

---

### 3.3 Phase 3: 강화물 최적화

#### Task 3-A: 선호도 평가 화면

**새 파일**: `app/[classCode]/students/[studentId]/preference-assessment/page.tsx`
**새 API**: `app/api/preference-assessment/route.ts`

**방식**: 단일자극법 (Single Stimulus) — 특수교육 현장 실행 가능성 고려

```
1. 교사가 가게 아이템 목록에서 평가할 아이템 5~8개 선택
2. 각 아이템을 학생에게 하나씩 제시 → 반응 기록 (접근/무반응/거부)
3. 3회 반복 → 접근률 순으로 선호 서열 자동 산출

DB 저장:
CREATE TABLE pbs.pbs_preference_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES pbs_students(id),
  class_code_id uuid REFERENCES pbs_class_codes(id),
  items jsonb NOT NULL,           -- [{itemId, name, approachCount, totalTrials}]
  ranked_preferences text[],      -- 선호 서열 (높→낮)
  assessment_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
```

**AI 프로필 연동**: 완료 시 `pbs_student_ai_profiles.reinforcement_preferences` 자동 업데이트

**예상 공수**: 5시간
**GPT API 호출**: 없음

#### Task 3-B: 강화 효과성 분석 API

**새 파일**: `app/api/ai/reinforcement-efficacy/route.ts`

```
입력: { studentId, days: 30 }

내부 조회:
- pbs_records (목표행동 발생 추이)
- pbs_transactions (강화물 소비 이력)
- 시간순 결합 분석

출력: {
  efficacy: [{
    goalName: string,
    preReinforcement: { avgOccurrence: number, trend: string },
    postReinforcement: { avgOccurrence: number, trend: string },
    effectSize: "large|medium|small|none"
  }],
  recommendation: "string"
}
```

**예상 공수**: 3시간
**GPT API 호출**: 선택적 (recommendation 한 줄)

#### Task 3-C: 강화 일정 자동 희석 필드

**behavior-plan API 확장** (`app/api/ai/behavior-plan/route.ts`):

**userPrompt JSON에 추가**:
```json
"scheduleFading": {
  "currentSchedule": "FR1|FR2|VR3 등 (현재 강화 일정)",
  "targetSchedule": "VR5|VI10 등 (목표 강화 일정)",
  "criterionToFade": "string (전환 기준: 예: 5일 연속 dailyTarget 달성 시)",
  "steps": ["FR1→FR2→VR3→VR5"],
  "rationale": "Ferster & Skinner (1957) 기반"
}
```

**예상 공수**: 1시간 (기존 API 확장)

---

### 3.4 Phase 4: PTR 실행 충실도 모니터링

#### Task 4-A: PTR 실행 충실도 API

**새 파일**: `app/api/ai/ptr-fidelity/route.ts`
**엔드포인트**: `POST /api/ai/ptr-fidelity`

```
입력: { studentId, weekStart: "2026-04-14" }

내부 조회 (GPT 호출 없이 서버에서 계산):
1. Prevent 실행률:
   - pbs_records에서 antecedent_tag NOT NULL 비율 → "선행사건을 기록했는가?"
   - pbs_student_ai_profiles.prevention_supports 대비 실제 적용 기록 여부

2. Teach 실행률:
   - pbs_records에서 prompt_level NOT NULL 비율 → "촉구 수준을 기록했는가?"
   - prompt_level 분포 → "점진적 촉구 페이딩이 이뤄지고 있는가?"

3. Reinforce 실행률:
   - pbs_records 총 건수 / pbs_goals.daily_target 합계 × 수업일 수 → "목표 대비 실제 강화 비율"
   - pbs_transactions에서 salary_pbs 건수 → "정산이 이뤄졌는가?"

출력: {
  fidelity: {
    prevent: {
      score: number (0~100),
      antecedentTagRate: number,
      details: "string"
    },
    teach: {
      score: number (0~100),
      promptLevelRate: number,
      independenceRate: number,
      details: "string"
    },
    reinforce: {
      score: number (0~100),
      goalCheckRate: number,
      settlementRate: number,
      details: "string"
    },
    overall: number (0~100)
  },
  warnings: ["string"],          // 부족한 단계 경고
  recommendation: "string"       // GPT 1줄 권고 (선택적)
}
```

**핵심 가치**: 연구대회 출품 시 **중재 충실도(implementation fidelity) 데이터**를 자동으로 생성할 수 있음. 기존 수상작(Chat PBS 등)에는 없는 차별점.

**예상 공수**: 4시간
**GPT API 호출**: 선택적 (recommendation 한 줄만)

---

## 4. 전체 데이터 흐름도 (완성 시)

```
교사 자유글 입력
    │
    ▼
[GPT 1차] /api/ai/student-profile/parse
    │  → 18개 필드 구조화 (Prevent·Teach·Reinforce 전부)
    ▼
교사 검토 + 후속 질문 보강
    │
    ▼
[GPT 2차] /api/ai/behavior-plan
    │  → FBA + PBS 목표 + 계약서 + 중재전략 + DRO + NCR + 소거 임계값
    │  → (Phase 2 완료 시) FCT 교수 시나리오 + 촉구 페이딩 로드맵
    │  → (Phase 3 완료 시) 강화 일정 희석 로드맵
    ▼
"모두 저장" 클릭
    │
    ├─→ pbs_fba_records          (행동 기능 분석)
    ├─→ pbs_goals                (PBS 목표 — 토큰 단가 포함)
    ├─→ pbs_behavior_contracts   (행동계약서)
    ├─→ pbs_intervention_library (중재전략)
    └─→ pbs_student_ai_profiles  (전체 AI 프로필)
         │
         ▼
    ┌────────────────────────────────────────────┐
    │              수업 중 (교사 PBS 체크)           │
    │                                              │
    │  Prevent:                                    │
    │  ├─ prevention_supports 실시간 팝업 (Phase 1) │
    │  └─ antecedent_tag 1탭 선택 (Phase 1)        │
    │                                              │
    │  Teach:                                      │
    │  ├─ class_mode_targets 표시 ✅ (이미 있음)     │
    │  ├─ p_prompt_options 표시 ✅ (이미 있음)       │
    │  ├─ prompt_level 4단계 기록 (Phase 2)         │
    │  └─ FCT 교수 시나리오 참조 (Phase 2)          │
    │                                              │
    │  Reinforce:                                  │
    │  ├─ 목표행동 체크 → 토큰 입금 ✅               │
    │  ├─ DRO 타이머 → 토큰 입금 ✅                 │
    │  ├─ NCR 일정 알림 (Phase 1)                   │
    │  └─ 셀프 체크 → 교사 승인 ✅                   │
    └────────────────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────────────────┐
    │              자동 정산 (Cron)                 │
    │  09:00 출석 기본급 → 15:00 PBS 일괄 정산      │
    │  금 14:00 주간 보너스 + DRL + 이자             │
    └────────────────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────────────────┐
    │              모니터링 (자동/주간)              │
    │  ├─ 소거 폭발 감지 → 교사 경고 ✅             │
    │  ├─ 토큰경제 건강도 분석 ✅                    │
    │  ├─ 학생 지원 단계 분류 ✅                     │
    │  ├─ PTR 실행 충실도 점검 (Phase 4)            │
    │  └─ 촉구 페이딩 진행도 분석 (Phase 2)          │
    └────────────────────────────────────────────┘
         │
         ▼
    통장 출력 (주간/학기말) → IEP 보고서 첨부
```

---

## 5. DB 변경 사항 총정리

```sql
-- Phase 1
ALTER TABLE pbs.pbs_records ADD COLUMN antecedent_tag text;
ALTER TABLE pbs.pbs_goals ADD COLUMN is_ncr boolean DEFAULT false;
ALTER TABLE pbs.pbs_goals ADD COLUMN ncr_interval_minutes int;

-- Phase 2
ALTER TABLE pbs.pbs_records ADD COLUMN prompt_level text
  CHECK (prompt_level IN ('full', 'partial', 'gesture', 'independent'));

-- Phase 3
CREATE TABLE pbs.pbs_preference_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES pbs.pbs_students(id),
  class_code_id uuid REFERENCES pbs.pbs_class_codes(id),
  items jsonb NOT NULL,
  ranked_preferences text[],
  assessment_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
```

---

## 6. GPT API 호출 비용 추정

| 기능 | 호출 시점 | 모델 | 예상 토큰 | 비용/회 |
|---|---|---|---|---|
| 프로필 구조화 | 학생 등록 시 1회 | gpt-4o | ~3000 | ~$0.03 |
| 행동 지원 계획 | 학생 등록 시 1회 | gpt-4o | ~4000 | ~$0.04 |
| FCT 시나리오 | 목표별 1회 (선택) | gpt-4o | ~2000 | ~$0.02 |
| PTR 충실도 | 주 1회 (선택) | 서버 계산 | 0 | $0 |
| 촉구 진행도 | 주 1회 (선택) | 서버 계산 | 0 | $0 |

**학생 6명 기준 월간 예상**: ~$1~2 (초기 설정 후 추가 호출 거의 없음)

---

## 7. 구현 순서 요약

| 순서 | Task | 예상 시간 | 핵심 효과 |
|---|---|---|---|
| 1 | 1-A: teach/summary에 prevention_supports 추가 | 30분 | Prevent 실시간 활용 |
| 2 | 1-C: pbs_records에 antecedent_tag 추가 | 2시간 | Prevent 기록 |
| 3 | 2-A: pbs_records에 prompt_level 추가 | 1.5시간 | Teach 기록 |
| 4 | 1-B: behavior-plan에 ncrSchedule 추가 | 2시간 | NCR 자동 추천 |
| 5 | 4-A: PTR 실행 충실도 API | 4시간 | 연구대회 핵심 데이터 |
| 6 | 2-B: FCT 교수 시나리오 API | 3시간 | Teach 자동화 |
| 7 | 2-C: 촉구 진행도 분석 API | 3시간 | 촉구 페이딩 추적 |
| 8 | 3-A: 선호도 평가 화면 | 5시간 | 강화물 개별화 |
| 9 | 3-B: 강화 효과성 분석 | 3시간 | 강화물 효과 검증 |
| 10 | 3-C: 강화 일정 희석 필드 | 1시간 | FR→VR 전환 자동 추천 |

**총 예상 공수**: ~25시간
**Phase 1만 (Task 1~4)**: ~6시간 → PTR 루프 기본 완성

---

## 8. 구현 진행 로그 (검수용)

> 배포 전 Supabase에 `012_ptr_phase1_prevent_teach_columns.sql` 적용 필수. 선호도 평가 저장을 쓰려면 `013_pbs_preference_assessments.sql`도 적용하세요. 적용 후 컬럼·테이블 존재 여부는 `supabase/verify_ptr_schema.sql`을 SQL Editor에서 실행해 확인할 수 있습니다. 교사 UI: 학생 상세 → **PTR·강화 인사이트** (`…/students/[id]/ptr-insights`).

| Task | 상태 | 변경 요약 |
|---|---|---|
| 1-A teach/summary + `antecedent_patterns` | 완료 | `TeachStudent`에 `prevention_supports`, `antecedent_patterns` 추가, 프로필 조회 SELECT 확장 |
| 1-A 수업 모드 UI | 완료 | `app/[classCode]/teach/page.tsx` — 예방(Prevent) 블록, 선행 퀵태그 칩 |
| 1-C `antecedent_tag` | 완료 | 마이그레이션 + `POST /api/pbs/records` body `antecedentTag` |
| 2-A `prompt_level` | 완료 | 마이그레이션 + `POST /api/pbs/records` body `promptLevel`, 촉구 4단계 셀렉트(수업 모드) |
| 1-B NCR | 완료 | `behavior-plan` 프롬프트·`ncrSchedule` 정규화 + `pbs_goals` `is_ncr`/`ncr_interval_minutes` + `AiBehaviorPlan` 저장·UI 카드 |
| PATCH goals NCR/DRO | 완료 | `PATCH /api/pbs/goals/[goalId]`에 `isDro`, `droIntervalMinutes`, `isNcr`, `ncrIntervalMinutes` 허용 |
| 4-A PTR 충실도 | 완료 | `POST /api/ai/ptr-fidelity`, `lib/ptr-fidelity.ts` — 서버 산출 + `includeRecommendation` 시 GPT 1문장 |
| 2-B FCT 시나리오 | 완료 | `POST /api/ai/fct-script` — GPT-4o JSON, 프로필 선행 자동 주입 |
| 2-C 촉구 진행도 | 완료 | `POST /api/ai/teach-progress` + `lib/teach-progress.ts`, `includeRecommendation` 선택 |
| 3-A 선호도 평가 | 완료 | `013` 테이블 + `GET/POST /api/preference-assessment` + `…/preference-assessment/page.tsx`, 프로필 `reinforcement_preferences` 반영 |
| 3-B 강화 효과성 | 완료 | `POST /api/ai/reinforcement-efficacy` + `lib/reinforcement-efficacy.ts` |
| 3-C 강화 일정 희석 | 완료 | `behavior-plan` `scheduleFading` + `normalizeScheduleFading`, `AiBehaviorPlan` 카드 |
| 배포 검증·UI 연동 | 완료 | `supabase/verify_ptr_schema.sql`, `012`/`013` 주석 보강, 학생 상세 → **PTR·강화 인사이트** (`ptr-fidelity`·`teach-progress`·`fct-script`·`reinforcement-efficacy`) |
