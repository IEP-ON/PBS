/**
 * 말 일기 (pbs_speech_diaries) 분석 스크립트
 *
 * 산출 지표:
 *  1. 학생별 일별 작성 빈도 (기초선 vs 파일럿 기간)
 *  2. 학생별 주별 평균 교정문 길이 (글자 수)
 *  3. 학생별 주별 어휘 다양성 (TTR: Type-Token Ratio)
 *  4. 학생별 감성 분포 (positive/neutral/negative)
 *  5. 전체 키워드 빈도 Top 20
 *
 * 사용법: node scripts/analyze_speech_diary.mjs
 * 결과: scripts/output/speech_diary_analysis.json + 콘솔 요약
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Supabase (환경 변수 필수 — 저장소에 키를 넣지 마세요) ─────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CLASS_CODE = process.env.SPEECH_DIARY_CLASS_CODE || 'NDG-2026-003'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL(또는 NEXT_PUBLIC_SUPABASE_URL)와 SUPABASE_SERVICE_ROLE_KEY 환경 변수를 설정하세요.')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ── 기간 설정 ──────────────────────────────────────────────────────────────
const BASELINE_END   = '2026-04-20'  // 기초선: 학급 운영 시작 ~ 4/20
const PILOT_START    = '2026-04-21'  // 파일럿: 4/21 ~
const PILOT_END      = '2026-05-19'

// ── 유틸 ──────────────────────────────────────────────────────────────────
const toDate = (iso) => iso.slice(0, 10)

/** 어절 단위 TTR (Type-Token Ratio) */
function calcTTR(text) {
  if (!text) return 0
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  const types = new Set(tokens)
  return Math.round((types.size / tokens.length) * 100) / 100
}

/** ISO 날짜 → YYYY-Wnn (ISO 주차) */
function toWeekKey(isoDate) {
  const d = new Date(isoDate)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000)
  const weekNum = Math.ceil((dayOfYear + jan4.getDay()) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

// ── 학생 이름 조회 ─────────────────────────────────────────────────────────
async function fetchStudentNames(classId) {
  const { data } = await sb.from('pbs_students')
    .select('id, name')
    .eq('class_code_id', classId)
    .eq('is_active', true)
  return Object.fromEntries((data || []).map(s => [s.id, s.name]))
}

// ── 메인 ──────────────────────────────────────────────────────────────────
async function main() {
  // 1. 학급 조회
  const { data: cls } = await sb.from('pbs_class_codes').select('id').eq('code', CLASS_CODE).single()
  if (!cls) { console.error('학급을 찾을 수 없습니다:', CLASS_CODE); process.exit(1) }

  const nameMap = await fetchStudentNames(cls.id)
  const studentIds = Object.keys(nameMap)

  // 2. 말 일기 전체 조회
  const { data: diaries, error } = await sb
    .from('pbs_speech_diaries')
    .select('id, student_id, corrected_text, sentiment, keywords, created_at')
    .in('student_id', studentIds)
    .order('created_at', { ascending: true })

  if (error) { console.error('조회 오류:', error); process.exit(1) }

  console.log(`\n📚 전체 말 일기 로드: ${diaries.length}건\n`)

  // ── 3. 기초선 / 파일럿 분리 ──────────────────────────────────────────────
  const baseline = diaries.filter(d => toDate(d.created_at) <= BASELINE_END)
  const pilot    = diaries.filter(d => toDate(d.created_at) >= PILOT_START && toDate(d.created_at) <= PILOT_END)

  // ── 4. 학생별 분석 ─────────────────────────────────────────────────────
  const studentStats = {}

  for (const sid of studentIds) {
    const name = nameMap[sid]
    const base  = baseline.filter(d => d.student_id === sid)
    const pil   = pilot.filter(d => d.student_id === sid)

    // 기초선 평균 지표
    const baseStats = calcStats(base)
    const pilotStats = calcStats(pil)

    // 주별 분석
    const weeklyBase  = calcWeekly(base)
    const weeklyPilot = calcWeekly(pil)

    // 감성 분포
    const sentBase  = calcSentiment(base)
    const sentPilot = calcSentiment(pil)

    studentStats[sid] = {
      name,
      baseline: {
        count: base.length,
        ...baseStats,
        sentiment: sentBase,
        weekly: weeklyBase,
      },
      pilot: {
        count: pil.length,
        ...pilotStats,
        sentiment: sentPilot,
        weekly: weeklyPilot,
      },
    }
  }

  // ── 5. 전체 키워드 Top 20 ────────────────────────────────────────────────
  const kwFreq = {}
  for (const d of diaries) {
    if (!d.keywords) continue
    for (const kw of d.keywords) {
      kwFreq[kw] = (kwFreq[kw] || 0) + 1
    }
  }
  const topKeywords = Object.entries(kwFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([kw, cnt]) => ({ keyword: kw, count: cnt }))

  // ── 6. 일별 작성 빈도 (전체) ────────────────────────────────────────────
  const dailyFreq = {}
  for (const d of diaries) {
    const date = toDate(d.created_at)
    if (!dailyFreq[date]) dailyFreq[date] = { total: 0, byStudent: {} }
    dailyFreq[date].total++
    dailyFreq[date].byStudent[nameMap[d.student_id] || d.student_id] =
      (dailyFreq[date].byStudent[nameMap[d.student_id]] || 0) + 1
  }

  // ── 7. 결과 저장 ──────────────────────────────────────────────────────
  const outputDir = path.join(__dirname, 'output')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)

  const result = {
    generated_at: new Date().toISOString(),
    class: CLASS_CODE,
    total_diaries: diaries.length,
    baseline_period: `~ ${BASELINE_END}`,
    pilot_period: `${PILOT_START} ~ ${PILOT_END}`,
    students: studentStats,
    top_keywords: topKeywords,
    daily_frequency: dailyFreq,
  }

  const outPath = path.join(outputDir, 'speech_diary_analysis.json')
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8')
  console.log(`✅ 분석 결과 저장: ${outPath}\n`)

  // ── 8. 콘솔 요약 출력 ────────────────────────────────────────────────
  printSummary(studentStats)

  console.log('\n🏷️  전체 키워드 Top 10:')
  topKeywords.slice(0, 10).forEach((k, i) => {
    console.log(`  ${i + 1}. "${k.keyword}" (${k.count}회)`)
  })

  // ── 9. 마크다운 요약 저장 ────────────────────────────────────────────
  const md = generateMarkdownReport(result, studentStats, topKeywords)
  const mdPath = path.join(outputDir, 'speech_diary_report.md')
  fs.writeFileSync(mdPath, md, 'utf8')
  console.log(`\n📄 마크다운 리포트 저장: ${mdPath}`)
}

// ── 통계 헬퍼 ─────────────────────────────────────────────────────────────
function calcStats(entries) {
  if (entries.length === 0) return { avgLength: 0, avgTTR: 0 }
  const lengths = entries.map(d => (d.corrected_text || '').length)
  const ttrs    = entries.map(d => calcTTR(d.corrected_text))
  return {
    avgLength: Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length),
    avgTTR:    Math.round(ttrs.reduce((a, b) => a + b, 0) / ttrs.length * 100) / 100,
  }
}

function calcWeekly(entries) {
  const weeks = {}
  for (const d of entries) {
    const wk = toWeekKey(d.created_at)
    if (!weeks[wk]) weeks[wk] = []
    weeks[wk].push(d)
  }
  return Object.fromEntries(
    Object.entries(weeks).map(([wk, arr]) => [wk, {
      count: arr.length,
      ...calcStats(arr),
      sentiment: calcSentiment(arr),
    }])
  )
}

function calcSentiment(entries) {
  const counts = { positive: 0, neutral: 0, negative: 0, null: 0 }
  for (const d of entries) counts[d.sentiment || 'null']++
  return counts
}

// ── 콘솔 출력 ────────────────────────────────────────────────────────────
function printSummary(stats) {
  console.log('═'.repeat(60))
  console.log('  학생별 말 일기 분석 요약')
  console.log('═'.repeat(60))
  for (const [, s] of Object.entries(stats)) {
    console.log(`\n▸ ${s.name}`)
    console.log(`  기초선: ${s.baseline.count}건 | 평균길이 ${s.baseline.avgLength}자 | TTR ${s.baseline.avgTTR}`)
    console.log(`          감성: 긍정 ${s.baseline.sentiment.positive} / 중립 ${s.baseline.sentiment.neutral} / 부정 ${s.baseline.sentiment.negative}`)
    if (s.pilot.count > 0) {
      const lengthChange = s.pilot.avgLength - s.baseline.avgLength
      const ttrChange    = Math.round((s.pilot.avgTTR - s.baseline.avgTTR) * 100) / 100
      console.log(`  파일럿: ${s.pilot.count}건 | 평균길이 ${s.pilot.avgLength}자 (${lengthChange >= 0 ? '+' : ''}${lengthChange}) | TTR ${s.pilot.avgTTR} (${ttrChange >= 0 ? '+' : ''}${ttrChange})`)
      console.log(`          감성: 긍정 ${s.pilot.sentiment.positive} / 중립 ${s.pilot.sentiment.neutral} / 부정 ${s.pilot.sentiment.negative}`)
    } else {
      console.log(`  파일럿: 데이터 없음`)
    }
  }
  console.log('\n' + '═'.repeat(60))
}

// ── 마크다운 리포트 ───────────────────────────────────────────────────────
function generateMarkdownReport(result, stats, topKeywords) {
  const lines = []
  lines.push(`# 말 일기 분석 리포트`)
  lines.push(`> 생성일: ${result.generated_at.slice(0,10)} | 학급: ${result.class} | 총 ${result.total_diaries}건\n`)

  lines.push(`## 기간 설정`)
  lines.push(`| 구분 | 기간 |`)
  lines.push(`|---|---|`)
  lines.push(`| 기초선 | ${result.baseline_period} |`)
  lines.push(`| 파일럿 | ${result.pilot_period} |\n`)

  lines.push(`## 학생별 요약`)
  lines.push(`| 학생 | 기초선 건수 | 평균길이(자) | TTR | 긍정 | 파일럿 건수 | 평균길이(자) | TTR | 긍정 |`)
  lines.push(`|---|---:|---:|---:|---:|---:|---:|---:|---:|`)

  for (const [, s] of Object.entries(stats)) {
    lines.push([
      `| ${s.name}`,
      s.baseline.count,
      s.baseline.avgLength,
      s.baseline.avgTTR,
      s.baseline.sentiment.positive,
      s.pilot.count || '-',
      s.pilot.count ? s.pilot.avgLength : '-',
      s.pilot.count ? s.pilot.avgTTR : '-',
      s.pilot.count ? s.pilot.sentiment.positive : '-',
      '|',
    ].join(' | '))
  }

  lines.push(`\n## 전체 키워드 Top 20\n`)
  lines.push(`| 순위 | 키워드 | 빈도 |`)
  lines.push(`|---:|---|---:|`)
  topKeywords.forEach((k, i) => {
    lines.push(`| ${i + 1} | ${k.keyword} | ${k.count} |`)
  })

  lines.push(`\n## 주별 변화 상세\n`)
  for (const [, s] of Object.entries(stats)) {
    lines.push(`### ${s.name}`)
    lines.push(`| 주차 | 건수 | 평균길이 | TTR | 긍정 | 중립 | 부정 |`)
    lines.push(`|---|---:|---:|---:|---:|---:|---:|`)
    const allWeekly = { ...s.baseline.weekly, ...s.pilot.weekly }
    for (const [wk, w] of Object.entries(allWeekly).sort()) {
      lines.push(`| ${wk} | ${w.count} | ${w.avgLength} | ${w.avgTTR} | ${w.sentiment.positive} | ${w.sentiment.neutral} | ${w.sentiment.negative} |`)
    }
    lines.push('')
  }

  lines.push(`\n---\n*이 리포트는 \`scripts/analyze_speech_diary.mjs\` 로 자동 생성됩니다.*`)
  return lines.join('\n')
}

main().catch(console.error)
