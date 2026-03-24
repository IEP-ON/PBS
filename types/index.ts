// ===== 공통 타입 정의 =====

export type TransactionType =
  | 'salary_basic'      // 출석·역할 기본급
  | 'salary_pbs'        // PBS 성과급
  | 'salary_bonus'      // 주간 보너스
  | 'purchase'          // 가게 구매
  | 'gift_sent'         // 선물 보냄
  | 'gift_received'     // 선물 받음
  | 'stock_buy'         // 주식 매수
  | 'stock_sell'        // 주식 매도
  | 'interest'          // 저축 이자
  | 'response_cost'     // 반응대가 차감
  | 'dro_reward'        // DRO 타이머 보상
  | 'contract_bonus'    // 계약 달성 보너스
  | 'level_up_bonus'    // 행동형성 레벨업 보너스
  | 'class_reward'      // 학급 공동 보상

export type BehaviorFunction = 'attention' | 'escape' | 'automatic' | 'access'
export type PbsStage = 1 | 2 | 3
export type AdjustmentType = 'surge' | 'rise' | 'flat' | 'fall' | 'crash' | 'manual_input'

export type ContractStrategyType =
  | 'DRA' | 'DRI' | 'DRO' | 'DRL'
  | 'FCT' | 'NCR' | 'BC' | 'Shaping'
  | 'SM' | 'TA' | 'TM-CM'

export type UserRole = 'teacher' | 'student'

// ===== 세션 =====

export interface SessionData {
  role: UserRole
  classCode: string
  classroomId: string
  studentId?: string
  studentName?: string
}

// ===== 데이터 모델 =====

export interface ClassCode {
  id: string
  code: string
  school_name: string | null
  class_name: string | null
  teacher_name: string | null
  teacher_pin_hash: string
  academic_year: number
  semester: number
  is_active: boolean
  created_at: string
  expires_at: string | null
}

export interface Student {
  id: string
  class_code_id: string
  name: string
  grade: number | null
  pin_hash: string
  qr_code: string
  disability_type: string[] | null
  pbs_stage: PbsStage
  behavior_function: string | null
  response_cost_enabled: boolean
  parental_consent_rc: boolean
  min_balance: number
  created_at: string
  is_active: boolean
}

export interface Account {
  id: string
  student_id: string
  balance: number
  total_earned: number
  total_spent: number
  created_at: string
}

export interface Transaction {
  id: string
  student_id: string
  type: TransactionType
  amount: number
  balance_after: number
  description: string
  related_id: string | null
  created_at: string
}

export interface PbsGoal {
  id: string
  student_id: string
  class_code_id: string
  behavior_name: string
  behavior_definition: string | null
  behavior_function: BehaviorFunction | null
  strategy_type: string | null
  token_per_occurrence: number
  daily_target: number | null
  weekly_target: number | null
  is_dro: boolean
  dro_interval_minutes: number | null
  is_drl: boolean
  drl_max_per_week: number | null
  allow_self_check: boolean
  is_active: boolean
  created_at: string
}

export interface PbsRecord {
  id: string
  student_id: string
  goal_id: string
  record_date: string
  occurrence_count: number
  prompted: boolean
  context_note: string | null
  token_granted: number
  is_settled: boolean
  is_self_check: boolean
  self_check_approved: boolean | null
  created_at: string
}

export interface SalaryRule {
  id: string
  class_code_id: string
  rule_name: string
  rule_type: string
  amount: number
  is_active: boolean
  created_at: string
}

export interface ShopItem {
  id: string
  class_code_id: string
  name: string
  category: 'activity' | 'snack' | 'goods'
  price: number
  stock: number | null
  is_giftable: boolean
  emoji: string | null
  is_active: boolean
  created_at: string
}

export interface StockPrice {
  id: string
  stock_name: string
  stock_type: string
  price_date: string
  price: number
  temperature_celsius: number | null
  precipitation_mm: number | null
  weather_condition: string | null
  calculation_note: string | null
}

export interface CustomStock {
  id: string
  class_code_id: string
  name: string
  emoji: string
  description: string | null
  current_price: number
  created_by: string | null
  named_by: string | null
  is_active: boolean
  created_at: string
}

export interface StockHolding {
  id: string
  student_id: string
  stock_name: string
  stock_type: string
  quantity: number
  avg_buy_price: number
  created_at: string
}

export interface SystemSettings {
  id: string
  class_code_id: string
  currency_unit: number
  starting_balance: number
  min_balance_protection: number
  interest_rate_weekly: number
  interest_min_balance: number
  balance_carryover: boolean
  data_retention_months: number
  weather_location: string
  updated_at: string
}
