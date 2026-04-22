'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import Link from 'next/link'

const SECTIONS = [
  { id: 9, icon: '📋', label: '심사 기준과 대응', group: '교육자료전' },
  { id: 0, icon: '👋', label: '서비스 소개', group: '준비' },
  { id: 1, icon: '🔐', label: '회원가입·로그인', group: '준비' },
  { id: 2, icon: '👨‍🎓', label: '학생 등록', group: '준비' },
  { id: 3, icon: '✅', label: '행동 목표 설정', group: '수업 설정' },
  { id: 4, icon: '🤖', label: 'AI 행동 지원 계획', group: '수업 설정', badge: 'GPT-4o' },
  { id: 5, icon: '👨‍🏫', label: '수업 모드', group: '매일 사용' },
  { id: 10, icon: '📈', label: 'PTR·강화 도구', group: '매일 사용' },
  { id: 6, icon: '📺', label: 'TV 순위판', group: '매일 사용' },
  { id: 7, icon: '🔍', label: '행동 원인 분석', group: '매일 사용' },
  { id: 8, icon: '🎉', label: '시작 준비 완료', group: '마무리' },
]

const GROUPS = ['교육자료전', '준비', '수업 설정', '매일 사용', '마무리'] as const

function cnNav(active: boolean) {
  return [
    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
    active ? 'bg-blue-50 font-semibold text-blue-800' : 'text-slate-600 hover:bg-slate-50',
  ].join(' ')
}

function NavFooter({
  goto,
  prev,
  next,
  prevLabel = '← 이전',
  nextLabel = '다음 →',
  nextPrimary = 'blue',
}: {
  goto: (n: number) => void
  prev?: number
  next?: number
  prevLabel?: string
  nextLabel?: string
  nextPrimary?: 'blue' | 'emerald'
}) {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
      {prev != null ? (
        <button
          type="button"
          onClick={() => goto(prev)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {prevLabel}
        </button>
      ) : (
        <span />
      )}
      {next != null ? (
        <button
          type="button"
          onClick={() => goto(next)}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${
            nextPrimary === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {nextLabel}
        </button>
      ) : null}
    </div>
  )
}

function SectionHeader({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <header className="mb-8">
      <span className="mb-3 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
        {step}
      </span>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">{desc}</p>
    </header>
  )
}

function HCard({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:p-6 ${className}`}
    >
      {title ? <h3 className="mb-3 text-sm font-bold text-slate-900 md:text-base">{title}</h3> : null}
      {children}
    </section>
  )
}

function HTip({ type = 'warn', children }: { type?: 'warn' | 'danger' | 'success'; children: ReactNode }) {
  const styles = {
    warn: 'border-amber-200 bg-amber-50 text-amber-950',
    danger: 'border-red-200 bg-red-50 text-red-950',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  }
  const icon = type === 'danger' ? '⚠️' : type === 'success' ? '✅' : '💡'
  return (
    <div className={`mb-4 flex gap-3 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${styles[type]}`}>
      <span className="shrink-0 text-base">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function HSteps({ items }: { items: { title: string; desc: ReactNode }[] }) {
  return (
    <ul className="space-y-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {i + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="font-semibold text-slate-900">{item.title}</p>
            <div className="mt-1 text-sm leading-relaxed text-slate-600">{item.desc}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function HGrid({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid gap-3 sm:grid-cols-2">{children}</div>
}

function FeatureTile({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
      <div className="mb-2 text-2xl">{icon}</div>
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600 md:text-sm">{desc}</p>
    </div>
  )
}

function HFlow({ items }: { items: string[] }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800">
            {item}
          </span>
          {i < items.length - 1 ? <span className="text-slate-400">→</span> : null}
        </span>
      ))}
    </div>
  )
}

function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-800">{children}</code>
  )
}

type CriteriaRowProps = {
  criterion: string
  points: string
  official: string
  mapping: string
}

function CriteriaRow({ criterion, points, official, mapping }: CriteriaRowProps) {
  return (
    <tr className="border-b border-slate-100 align-top last:border-0">
      <td className="px-3 py-3 text-xs font-bold text-blue-900 md:px-4 md:text-sm md:w-[18%]">
        {criterion}
        <span className="mt-1 block text-[10px] font-semibold text-slate-500">{points}</span>
      </td>
      <td className="px-3 py-3 text-xs leading-relaxed text-slate-600 md:px-4 md:text-sm md:w-[34%]">{official}</td>
      <td className="px-3 py-3 text-xs leading-relaxed text-slate-800 md:px-4 md:text-sm md:w-[48%]">{mapping}</td>
    </tr>
  )
}

export default function HelpPage() {
  const [current, setCurrent] = useState(9)
  const [visited, setVisited] = useState<Set<number>>(new Set([9]))

  const goto = (idx: number) => {
    setCurrent(idx)
    setVisited((prev) => new Set([...prev, idx]))
  }

  const pct = Math.round((visited.size / SECTIONS.length) * 100)

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50 text-slate-800 lg:flex-row">
      {/* 모바일: 상단 탭 */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex gap-1 overflow-x-auto px-2 py-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goto(s.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                current === s.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between px-3 pb-2 text-[10px] text-slate-500">
          <span>
            {visited.size}/{SECTIONS.length} 섹션 열람
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* 데스크톱 사이드바 */}
      <aside className="hidden w-[min(100%,280px)] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-100 p-5">
          <p className="text-lg font-bold text-blue-700">도움말</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">말로 모으는 하루 · 교육자료전 · PTR 연동</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {GROUPS.map((group) => (
            <div key={group}>
              <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group}</p>
              {SECTIONS.filter((s) => s.group === group).map((s) => (
                <button key={s.id} type="button" onClick={() => goto(s.id)} className={cnNav(current === s.id)}>
                  <span className="text-lg">{s.icon}</span>
                  <span className="flex-1 truncate">{s.label}</span>
                  {s.badge ? (
                    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      {s.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <p className="text-[10px] text-slate-500">
            {visited.size} / {SECTIONS.length} 열람
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-8 lg:py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          {current === 9 && <Sec9 goto={goto} />}
          {current === 0 && <Sec0 goto={goto} />}
          {current === 1 && <Sec1 goto={goto} />}
          {current === 2 && <Sec2 goto={goto} />}
          {current === 3 && <Sec3 goto={goto} />}
          {current === 4 && <Sec4 goto={goto} />}
          {current === 5 && <Sec5 goto={goto} />}
          {current === 10 && <Sec10 goto={goto} />}
          {current === 6 && <Sec6 goto={goto} />}
          {current === 7 && <Sec7 goto={goto} />}
          {current === 8 && <Sec8 goto={goto} />}
        </div>
      </main>
    </div>
  )
}

function Sec9({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader
        step="교육자료전 · 100점 만점"
        title="심사 기준과 본 플랫폼 대응"
        desc="대구광역시 교육자료전 요강 심사 기준(각 20점)과 현재 버전 기능·PTR 기록·경로를 한눈에 정리합니다."
      />
      <HCard title="심사 기준 요약 (공문 기준)">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b-2 border-blue-200 bg-blue-50/80">
                <th className="px-3 py-2.5 font-bold text-blue-950">기준</th>
                <th className="px-3 py-2.5 font-bold text-blue-950">공문상 주요 내용</th>
                <th className="px-3 py-2.5 font-bold text-blue-950">본 작품 대응</th>
              </tr>
            </thead>
            <tbody>
              <CriteriaRow
                criterion="자료의 적절성"
                points="20점"
                official="교육과정 연관성, 제작 목적 명확성, 교수·학습 효과"
                mapping="특수교육과정 맥락의 PBS 실행. 사정→계획→실행→점검을 학생 지원·상세 탭으로 구조화. 행동 목표 체크에 Prevent·Teach 필드(선행·촉구 단계)를 반영해 연구·현장 점검에 대응."
              />
              <CriteriaRow
                criterion="창의성"
                points="20점"
                official="참신성·독창성, 본인 직접 제작 여부"
                mapping="토큰경제를 통장·ATM·가게·주식으로 일관 시각화. GPT-4o 행동 지원 계획, Whisper 말 일기장, PTR 충실도·FCT 시나리오 API 등 데이터 기반 확장."
              />
              <CriteriaRow
                criterion="완성도"
                points="20점"
                official="목적 부합, 제작 기술, 매체 활용, 견고성·편의성"
                mapping="Next.js 실서비스. 강화 타이머·소거 경보·반응대가·NCR 일정·강화 일정 희석 로드맵까지 화면에 반영. 용어 통일(행동 목표, 행동 원인 분석 등)."
              />
              <CriteriaRow
                criterion="교육에의 기여도"
                points="20점"
                official="교육문제 해결, 교육효과 증진, 현장 개선"
                mapping="즉시 토큰·정산으로 강화 지연 감소. 사건 기록→행동 원인 분석→중재 DB. 스스로 체크·계약서로 자기관리. 선호도 평가로 강화물 개별화."
              />
              <CriteriaRow
                criterion="일반화 가능성"
                points="20점"
                official="경비·보급·경제성, 제작 용이성"
                mapping="학급 코드·웹만으로 타 학급 확장. Supabase 시드·가격 하한으로 경제 균형 조정 가능."
              />
            </tbody>
          </table>
        </div>
      </HCard>
      <HCard title="주요 경로 (시연·심사용)">
        <ul className="space-y-3 text-sm text-slate-700">
          {[
            ['행동 목표 체크', '/[학급코드]/pbs', '토큰 지급·일괄 체크·Undo·Prevent/Teach 기록'],
            ['수업 모드', '/[학급코드]/teach', '6인 모니터·촉구 4단계·선행 태그·예방 블록·사건·정산'],
            ['PTR·강화 인사이트', '/[학급코드]/students/[학생ID]/ptr-insights', '충실도·촉구 진행도·FCT·강화 효과성'],
            ['선호도 평가', '/[학급코드]/students/[학생ID]/preference-assessment', '가게 아이템 단일자극법·프로필 반영'],
            ['학생 지원 계획', '/[학급코드]/support', '사정·계획·실행·점검 허브'],
            ['행동 원인 분석', '/[학급코드]/fba', 'ABC·기능 가설·중재 전략'],
          ].map(([title, path, desc]) => (
            <li key={title}>
              <strong className="text-slate-900">{title}</strong>
              <code className="mt-1 block rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">{path}</code>
              <span className="text-xs text-slate-500">{desc}</span>
            </li>
          ))}
        </ul>
      </HCard>
      <HTip type="success">
        <strong>시연 권장(약 5분):</strong> 로그인 → 행동 목표 체크(선행·촉구 확인) → 수업 모드 → 학생 상세 PTR·강화 인사이트 → 학생 지원 계획 → 스스로 체크·통장 → TV 순위판.
      </HTip>
      <HTip type="warn">
        <strong>윤리:</strong> AI 산출물은 초안입니다. 감각 기능 행동의 소거 금지 등 안전 규칙은 반드시 교사 검토 후 적용하세요.
      </HTip>
      <NavFooter
        goto={goto}
        prev={0}
        next={1}
        prevLabel="← 서비스 소개"
        nextLabel="STEP 1 회원가입 →"
      />
    </div>
  )
}

function Sec0({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader
        step="환영합니다"
        title="PBS 기반 디지털 행동지원"
        desc="긍정적 행동지원(PBS)을 학급에서 운영하기 위한 웹앱입니다. ABA 원리(강화·기록·분석)를 실행 레이어로 두고, 예방(Prevent)·교수(Teach)·강화(Reinforce) 기록이 PTR 점검과 이어지도록 설계했습니다."
      />
      <HGrid>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">상위 이념</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            통제가 아니라 <strong className="text-slate-900">기대행동·대체행동을 가르치고 유지</strong>하는 예방적 지원입니다.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">작동 원리</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            PBS가 운영 틀, <strong className="text-slate-900">ABA가 강화·데이터·촉구</strong> 등 실행 원리를 담당합니다.
          </p>
        </div>
      </HGrid>
      <HCard title="핵심 원리">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>긍정적 강화: 목표 행동 시 즉시 토큰</li>
          <li>기능 기반 이해: 사건·FBA로 행동 기능 추정</li>
          <li>예방: AI 계획의 예방 문구·선행 태그를 수업·PBS 체크에 연결</li>
          <li>데이터: PTR 충실도·촉구 진행도·강화 효과성으로 점검</li>
        </ul>
      </HCard>
      <HCard title="계층 구조">
        <div className="grid gap-2 text-sm">
          {[
            ['0층', '교육적 목적', '기대행동·자기조절·수업 참여'],
            ['1층', 'PBS', '긍정적 행동지원 운영 틀'],
            ['2층', '실행', '토큰경제, 타이머, FBA, Prevent·Teach 기록, 사건, 계약'],
            ['3층', '플랫폼', '등록, AI 계획, 수업 모드, PTR 인사이트, 정산, TV'],
          ].map(([lv, t, d]) => (
            <div key={lv} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="font-bold text-blue-700">{lv}</span> · {t}
              <p className="text-xs text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </HCard>
      <HCard title="운영 흐름">
        <HFlow
          items={['학생 등록', '행동 목표', '지원 계획', 'AI 초안', '수업·PBS', 'PTR 점검', 'FBA', '정산', '수정']}
        />
        <p className="text-sm text-slate-600">
          설정 → 실행(기록 포함) → 분석 → 정산 → 수정의 순환입니다.
        </p>
      </HCard>
      <HGrid>
        <FeatureTile
          icon="✅"
          title="행동 목표 체크"
          desc="수업 모드와 동일하게 선행·촉구 4단계를 기록합니다."
        />
        <FeatureTile icon="👨‍🏫" title="수업 모드" desc="6인·타이머·Prevent·선행·촉구·사건·정산." />
        <FeatureTile icon="📈" title="PTR·강화 인사이트" desc="충실도·촉구·FCT·강화 효과성을 한 화면에서." />
        <FeatureTile icon="🤖" title="AI 행동 지원 계획" desc="FBA·목표·계약·중재·NCR·강화 일정 희석 초안." />
      </HGrid>
      <HTip type="warn">
        왼쪽 맨 위 <strong>심사 기준</strong>은 배점·시연용입니다. 아래 단계는 실제 사용 순서입니다.
      </HTip>
      <NavFooter
        goto={goto}
        prev={9}
        next={1}
        prevLabel="← 심사 기준"
        nextLabel="다음: 회원가입 →"
      />
    </div>
  )
}

function Sec1({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader
        step="STEP 1"
        title="회원가입 · 로그인"
        desc="교사 계정 생성 시 학급 코드가 발급됩니다. 학생·학부모는 이 코드로 접속합니다."
      />
      <HCard title="교사 회원가입">
        <HSteps
          items={[
            {
              title: '/register',
              desc: '이름, 학교, 이메일, 비밀번호 입력.',
            },
            {
              title: '학급 코드',
              desc: (
                <>
                  대시보드에서 고유 코드 확인 (예: <InlineCode>abc123</InlineCode>).
                </>
              ),
            },
            {
              title: '학생에게 공유',
              desc: (
                <>
                  학생 URL: <InlineCode>/s/[코드]/[학생ID]/home</InlineCode>
                </>
              ),
            },
          ]}
        />
      </HCard>
      <HCard title="교사 URL 구조">
        <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-[11px] leading-relaxed text-slate-200 md:text-xs">
          {`/[학급코드]/dashboard
/[학급코드]/pbs              # 행동 목표 체크
/[학급코드]/teach            # 수업 모드
/[학급코드]/students/[id]/ptr-insights
/[학급코드]/students/[id]/preference-assessment
/[학급코드]/support
/tv/[학급코드]`}
        </pre>
      </HCard>
      <HTip type="danger">
        <strong>학급 코드는 URL에 노출됩니다.</strong> 토큰 잔액·이름 열람 가능성을 고려해 공개 게시에 주의하세요.
      </HTip>
      <NavFooter goto={goto} prev={0} next={2} prevLabel="← 이전" nextLabel="다음: 학생 등록 →" />
    </div>
  )
}

function Sec2({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader step="STEP 2" title="학생 등록" desc="등록 시 토큰 계좌가 열리고 QR 통장을 인쇄할 수 있습니다." />
      <HCard>
        <HSteps
          items={[
            { title: '학생 관리 → 추가', desc: '이름, 학년, 장애유형, PBS LV. 입력.' },
            { title: 'LV. 설계', desc: '초기에는 낮은 단계에서 촉구 비중을 높이고, 독립 비율을 점진적으로 늘리는 계획과 맞춥니다.' },
            { title: 'QR 통장', desc: '학생 상세에서 발급·인쇄.' },
          ]}
        />
      </HCard>
      <HTip type="success">
        권장: 학생 상세 <strong>사정</strong> 탭에서 AI 행동 지원 계획 → 「한 번에 저장」으로 FBA·목표·계약·중재 연결.
      </HTip>
      <NavFooter goto={goto} prev={1} next={3} prevLabel="← 이전" nextLabel="다음: 행동 목표 →" />
    </div>
  )
}

function Sec3({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader step="STEP 3" title="행동 목표 설정" desc="목표별 토큰 단가·일일 목표·전략을 설정합니다. AI 생성을 권장합니다." />
      <HCard title="등록 필드">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>행동명 — 관찰 가능한 문장</li>
          <li>토큰 단가, 하루 목표 횟수</li>
          <li>강화 타이머(DRO) 연동 여부</li>
        </ul>
      </HCard>
      <HCard title="일괄 체크 · PTR 기록">
        <p className="text-sm text-slate-700">
          같은 행동명을 여러 학생에게 적용할 때 모달에서 <strong>촉구 수준(공통)</strong>과{' '}
          <strong>선행 태그(선택)</strong>를 지정할 수 있습니다. 단일 학생 PBS 화면에서도 수업 모드와 동일하게{' '}
          <InlineCode>antecedent_tag</InlineCode>·<InlineCode>prompt_level</InlineCode>이 저장됩니다.
        </p>
      </HCard>
      <HCard title="Undo">
        <p className="text-sm text-slate-700">체크 후 6초 이내 토스트에서 실행 취소 가능합니다.</p>
      </HCard>
      <NavFooter goto={goto} prev={2} next={4} prevLabel="← 이전" nextLabel="다음: AI 계획 →" />
    </div>
  )
}

function Sec4({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader
        step="STEP 4 · GPT-4o"
        title="AI 행동 지원 계획"
        desc="자유 서술 → 구조화 프로필 → FBA·목표·계약·중재·DRO·NCR 일정·강화 일정 희석(scheduleFading) 초안까지 한 번에 생성합니다."
      />
      <HCard title="AI가 만드는 것">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>행동 원인(FBA) 추정·신뢰도</li>
          <li>행동 목표 2개 이상(대체·보완)</li>
          <li>행동 계약서 초안</li>
          <li>근거기반 중재 전략(FCT·DRO·NCR 등)</li>
          <li>NCR 일정(기능이 attention/tangible일 때)</li>
          <li>강화 일정 희석 로드맵(FR→VR 등 단계·전환 기준)</li>
        </ul>
      </HCard>
      <HTip type="warn">「한 번에 저장」은 FBA·목표·계약·중재까지입니다. 타이머 <strong>실행</strong>·소거 <strong>경보 등록</strong>은 전용 화면에서 하세요.</HTip>
      <HTip type="danger">AI 출력은 초안입니다. 저장 전 반드시 검토·수정하세요.</HTip>
      <NavFooter goto={goto} prev={3} next={5} prevLabel="← 이전" nextLabel="다음: 수업 모드 →" />
    </div>
  )
}

function Sec5({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader
        step="매일 사용"
        title="수업 모드"
        desc="6명 동시 모니터링. 체크마다 Prevent·Teach 맥락이 기록되어 PTR 분석과 연결됩니다."
      />
      <HGrid>
        <FeatureTile icon="⏰" title="교시" desc="1~6교시·방과후, 세션 타이머." />
        <FeatureTile icon="+1" title="즉시 지급" desc="+1/+2/+3, 3초 강화 원칙." />
        <FeatureTile icon="📶" title="촉구 4단계" desc="전체·부분·제스처·독립. PBS와 동일 스키마." />
        <FeatureTile icon="⏱" title="강화 타이머" desc="리셋·완료 시 지급." />
      </HGrid>
      <HCard title="Prevent · 선행 퀵태그">
        <p className="text-sm leading-relaxed text-slate-700">
          AI 프로필의 <strong>예방(Prevent)</strong> 요약·<strong>선행</strong> 칩·<InlineCode>p_prompt_options</InlineCode> 힌트를 카드에 표시합니다.
        </p>
      </HCard>
      <HCard title="사건 기록 · 정산">
        <p className="text-sm text-slate-700">FAB로 사건 유형 기록. 미정산 시 수업 종료 후 일괄 정산.</p>
      </HCard>
      <NavFooter goto={goto} prev={4} next={10} prevLabel="← 이전" nextLabel="다음: PTR·강화 도구 →" />
    </div>
  )
}

function Sec10({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader
        step="매일 사용"
        title="PTR·강화 도구"
        desc="학생 상세에서 Prevent·Teach·Reinforce 데이터를 점검하고, 가게 강화물 선호도를 평가합니다."
      />
      <HGrid>
        <FeatureTile
          icon="📊"
          title="PTR·강화 인사이트"
          desc="주간 PTR 충실도, 목표별 촉구 진행도, FCT 교수 시나리오(GPT), 강화 효과성(기록·구매). GPT 한 줄 권고는 선택."
        />
        <FeatureTile
          icon="💜"
          title="선호도 평가"
          desc="가게 아이템 5~8개 단일자극법 3회 시도 → 서열. 프로필 reinforcement_preferences 반영."
        />
      </HGrid>
      <HCard title="배포 전 DB">
        <p className="text-sm text-slate-700">
          Supabase 마이그레이션 <InlineCode>012_ptr_phase1…</InlineCode> (기록·NCR 메타),{' '}
          <InlineCode>013_pbs_preference_assessments</InlineCode> (선호도 저장) 적용 후, 저장소의{' '}
          <InlineCode>supabase/verify_ptr_schema.sql</InlineCode>로 컬럼·테이블을 확인하세요.
        </p>
      </HCard>
      <NavFooter goto={goto} prev={5} next={6} prevLabel="← 수업 모드" nextLabel="다음: TV 순위판 →" />
    </div>
  )
}

function Sec6({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader step="교실" title="TV 순위판" desc="30초마다 갱신. 교실 TV에 전송해 사용합니다." />
      <HCard>
        <HSteps
          items={[
            { title: '사이드바 TV 순위판', desc: '새 탭 → 크롬캐스트·미러링.' },
            { title: '정렬', desc: '오늘 획득 / 전체 잔액.' },
            { title: 'TOP 3', desc: '메달 표시.' },
          ]}
        />
      </HCard>
      <HTip type="warn">정산 직후 TV에 반영되면 강화 효과가 커집니다.</HTip>
      <NavFooter goto={goto} prev={10} next={7} prevLabel="← PTR·강화" nextLabel="다음: 행동 원인 분석 →" />
    </div>
  )
}

function Sec7({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader step="분석" title="행동 원인 분석" desc="사건 기록이 쌓이면 기능 추정·중재 전략 DB와 연결됩니다." />
      <HCard title="기능 유형">
        <div className="flex flex-wrap gap-2">
          {['주의추구', '회피/도피', '감각', '물건획득'].map((label) => (
            <span key={label} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {label}
            </span>
          ))}
        </div>
      </HCard>
      <HTip type="danger">
        감각 기능에는 소거가 적용되지 않습니다. 회피·자해·공격의 소거는 전문가 팀 협의 후 진행하세요.
      </HTip>
      <NavFooter
        goto={goto}
        prev={6}
        next={8}
        prevLabel="← 이전"
        nextLabel="완료 화면 →"
        nextPrimary="emerald"
      />
    </div>
  )
}

function Sec8({ goto }: { goto: (n: number) => void }) {
  const checklist = [
    '교사 계정·학급 코드',
    '학생 등록·통장',
    '행동 목표(AI 또는 수동)',
    '학생 지원 계획(/support)',
    '학생 홈·스스로 체크',
    '수업 모드·PBS 체크·TV 시연',
    'DB 012·013 + verify_ptr_schema.sql',
    'PTR 인사이트·선호도 평가(선택)',
    '계약서 인쇄(선택)',
  ]
  return (
    <div className="py-6 text-center">
      <div className="text-5xl md:text-6xl">🎉</div>
      <h2 className="mt-4 text-2xl font-bold text-slate-900">준비 완료</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">첫 수업 전 아래를 점검하세요.</p>
      <ul className="mx-auto mt-8 max-w-md space-y-2 text-left text-sm text-slate-700">
        {checklist.map((item) => (
          <li key={item} className="flex gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => goto(9)}
          className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
        >
          심사 기준
        </button>
        <button
          type="button"
          onClick={() => goto(0)}
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          서비스 소개
        </button>
        <Link
          href="/login"
          className="inline-flex items-center rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          시작하기
        </Link>
      </div>
      <NavFooter goto={goto} prev={7} prevLabel="← 이전" />
    </div>
  )
}
