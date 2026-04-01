'use client'

import { useState } from 'react'
import Link from 'next/link'

const SECTIONS = [
  { id: 0, icon: '👋', label: '서비스 소개', group: '준비' },
  { id: 1, icon: '🔐', label: '회원가입·로그인', group: '준비' },
  { id: 2, icon: '👨‍🎓', label: '학생 등록', group: '준비' },
  { id: 3, icon: '✅', label: 'PBS 목표 설정', group: '수업 설정' },
  { id: 4, icon: '🤖', label: 'AI 행동 지원 계획', group: '수업 설정', badge: 'GPT-4o' },
  { id: 5, icon: '👨‍🏫', label: '수업 모드', group: '매일 사용' },
  { id: 6, icon: '📺', label: 'TV 순위판', group: '매일 사용' },
  { id: 7, icon: '🔍', label: 'FBA 분석', group: '매일 사용' },
  { id: 8, icon: '🎉', label: '시작 준비 완료', group: '마무리' },
]

const groups = ['준비', '수업 설정', '매일 사용', '마무리']

export default function HelpPage() {
  const [current, setCurrent] = useState(0)
  const [visited, setVisited] = useState<Set<number>>(new Set([0]))

  const goto = (idx: number) => {
    setCurrent(idx)
    setVisited(prev => new Set([...prev, idx]))
  }

  const pct = Math.round((visited.size / SECTIONS.length) * 100)

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', overflow: 'hidden', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: '#f8fafc', color: '#1e293b' }}>

      {/* ── 사이드바 ─────────────────────────────────────── */}
      <aside style={{ width: 'clamp(220px, 22vw, 280px)', minWidth: 220, background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#1d4ed8' }}>🏫 PBS 시작 가이드</p>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>특수학급 행동 지원 플랫폼</p>
        </div>

        <div style={{ flex: 1, padding: '8px 8px 0' }}>
          {groups.map(group => (
            <div key={group}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 8px 4px' }}>{group}</p>
              {SECTIONS.filter(s => s.group === group).map(s => (
                <button
                  key={s.id}
                  onClick={() => goto(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                    padding: '8px 10px', border: 'none', cursor: 'pointer',
                    borderRadius: 8, fontSize: 12.5, textAlign: 'left',
                    marginBottom: 1, transition: 'all 0.15s',
                    background: current === s.id ? '#eff6ff' : 'transparent',
                    color: current === s.id ? '#1d4ed8' : '#475569',
                    fontWeight: current === s.id ? 700 : 400,
                  }}
                >
                  <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>{s.icon}</span>
                  <span style={{ flex: 1 }}>{s.label}</span>
                  {s.badge && (
                    <span style={{ fontSize: 9, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '1px 5px', borderRadius: 99 }}>{s.badge}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>{visited.size} / {SECTIONS.length} 완료</p>
          <div style={{ background: '#f1f5f9', borderRadius: 99, height: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg,#3b82f6,#6366f1)', borderRadius: 99, width: `${pct}%`, transition: 'width 0.4s' }} />
          </div>
        </div>
      </aside>

      {/* ── 메인 ─────────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: 'clamp(20px, 2.8vw, 36px)' }}>
        {current === 0 && <Sec0 goto={goto} />}
        {current === 1 && <Sec1 goto={goto} />}
        {current === 2 && <Sec2 goto={goto} />}
        {current === 3 && <Sec3 goto={goto} />}
        {current === 4 && <Sec4 goto={goto} />}
        {current === 5 && <Sec5 goto={goto} />}
        {current === 6 && <Sec6 goto={goto} />}
        {current === 7 && <Sec7 goto={goto} />}
        {current === 8 && <Sec8 goto={goto} />}
      </main>
    </div>
  )
}

// ── 공통 스타일 컴포넌트 ────────────────────────────────────

function SectionHeader({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#6366f1', background: '#eef2ff', padding: '3px 10px', borderRadius: 99, marginBottom: 10 }}>{step}</span>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{title}</h2>
      <p style={{ fontSize: 14, color: '#64748b', marginTop: 6, lineHeight: 1.6 }}>{desc}</p>
    </div>
  )
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px 22px', marginBottom: 16 }}>
      {title && <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>{title}</h3>}
      {children}
    </div>
  )
}

function Tip({ type = 'warn', children }: { type?: 'warn' | 'danger' | 'success'; children: React.ReactNode }) {
  const colors = {
    warn:    { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    danger:  { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#14532d' },
  }
  const c = colors[type]
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{type === 'danger' ? '⚠️' : type === 'success' ? '✅' : '💡'}</span>
      <p style={{ fontSize: 12.5, color: c.text, lineHeight: 1.6, margin: 0 }}>{children}</p>
    </div>
  )
}

function Steps({ items }: { items: { title: string; desc: string }[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: 14, marginBottom: 18, alignItems: 'flex-start' }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
          <div>
            <strong style={{ fontSize: 13.5, color: '#0f172a', display: 'block', marginBottom: 3 }}>{item.title}</strong>
            <span style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: item.desc }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 16 }}>{children}</div>
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <strong style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 4 }}>{title}</strong>
      <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, margin: 0 }}>{desc}</p>
    </div>
  )
}

function Flow({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: 16, background: '#f8fafc', borderRadius: 12, marginBottom: 16 }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{item}</span>
          {i < items.length - 1 && <span style={{ color: '#94a3b8', fontSize: 14 }}>→</span>}
        </span>
      ))}
    </div>
  )
}

// ── 각 섹션 ─────────────────────────────────────────────────

function Sec0({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader
        step="✨ 환영합니다"
        title="PBS 기반 디지털 행동지원 플랫폼"
        desc="본 플랫폼은 특수학급에서 긍정적 행동지원(PBS)을 체계적으로 운영하기 위한 디지털 교육자료입니다. 학생별 목표행동 설정, 즉시 강화, 사건기록, 기능 기반 행동분석(FBA), 행동지원계획 수립 기능을 한 흐름으로 연결합니다."
      />
      <Card title="🏛 서비스 정체성">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>상위 이념</p>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: '#334155', margin: 0 }}>
              학생을 통제하기 위한 시스템이 아니라, 기대행동과 대체행동을 가르치고 유지하도록 돕는
              <strong style={{ color: '#0f172a' }}> 긍정적·예방적 행동지원 체계</strong>입니다.
            </p>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>작동 원리</p>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: '#334155', margin: 0 }}>
              PBS를 상위 운영 틀로 두고, <strong style={{ color: '#0f172a' }}>ABA 기반 강화·기록·분석 원리</strong>를
              실행 레이어로 활용합니다. ABA는 엔진이고, PBS는 교실 운영 체계입니다.
            </p>
          </div>
        </div>
      </Card>
      <Card title="🧭 원리 · 이념 · 계층">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>핵심 원리</p>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {[
                '긍정적 강화: 목표행동 발생 시 즉시 토큰 제공',
                '기능 기반 이해: 사건기록과 FBA로 행동 기능 추정',
                '예방 중심 지원: 수업 전 목표와 지원을 먼저 설정',
                '데이터 기반 조정: 기록 자동 집계 후 계획 재설정',
              ].map((item) => (
                <li key={item} style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.8, marginBottom: 2 }}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>계층 구조</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                ['0층', '교육적 목적', '기대행동 형성, 자기조절 향상, 수업 참여 확대'],
                ['1층', '상위 운영 틀', 'PBS 기반 긍정적 행동지원'],
                ['2층', '실행 전략', '토큰경제, DRO, FBA, 촉구, 사건기록, 행동계약'],
                ['3층', '플랫폼 기능', '학생등록, AI 계획, 수업 모드, 정산, TV 순위판'],
              ].map(([level, title, desc]) => (
                <div key={level} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px' }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', margin: 0 }}>{level} · {title}</p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0', lineHeight: 1.6 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
      <Card title="🔄 운영 흐름">
        <Flow items={['학생 등록', '목표행동 설정', 'AI 계획 생성', '수업 중 강화·기록', '분석', '정산·교환', '계획 수정']} />
        <p style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.7, margin: 0 }}>
          이 플랫폼은 메뉴를 늘어놓은 도구가 아니라, <strong style={{ color: '#0f172a' }}>설정 → 실행 → 기록 → 분석 → 정산 → 수정</strong>의
          순환 구조로 행동지원을 운영하도록 설계되었습니다.
        </p>
      </Card>
      <Grid2>
        <FeatureCard icon="✅" title="PBS 토큰 체크" desc="학생별 목표행동 달성 시 토큰을 즉시 지급하고, 하루 기록을 자동 집계합니다." />
        <FeatureCard icon="👨‍🏫" title="수업 모드" desc="6명 동시 모니터링, DRO 타이머, 촉구 기록, 사건기록을 한 화면에서 처리합니다." />
        <FeatureCard icon="🤖" title="AI 행동 지원 계획" desc="자유입력 → 구조화 → FBA 분석 → PBS 목표·계약서·중재전략 생성까지 연결합니다." />
        <FeatureCard icon="📊" title="학급 경제" desc="게임 요소가 아니라, 강화의 누적·선택·지연교환을 학습하는 동기 유지 시스템입니다." />
      </Grid2>
      <Flow items={['🔐 가입', '👨‍🎓 학생 등록', '🤖 AI 계획', '👨‍🏫 수업 모드', '💰 정산']} />
      <Tip type="warn"><strong>읽는 법:</strong> 이 도움말의 상단은 작품의 철학과 구조를 설명하고, 아래 단계들은 실제 사용 순서를 안내합니다. 즉, <strong>상단 20%는 개념 설명</strong>, <strong>나머지 80%는 운영 매뉴얼</strong>입니다.</Tip>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 28, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => goto(1)} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#3b82f6', color: '#fff' }}>다음: 회원가입 →</button>
      </div>
    </div>
  )
}

function Sec1({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader step="STEP 1" title="회원가입 · 로그인" desc="교사 계정을 만들면 고유한 학급 코드가 발급됩니다. 이 코드가 학생·학부모 접속의 열쇠입니다." />
      <Card title="📝 교사 회원가입">
        <Steps items={[
          { title: '/register 접속', desc: '이름, 학교명, 이메일, 비밀번호를 입력합니다.' },
          { title: '학급 코드 확인', desc: '가입 완료 후 대시보드에서 고유 학급 코드(예: <code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:11px">abc123</code>)를 확인합니다.' },
          { title: '학생에게 공유', desc: '학생은 이 코드로 <code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:11px">/s/[코드]/[학생ID]/home</code>에 접속합니다.' },
        ]} />
      </Card>
      <Card title="🔑 로그인 후 URL 구조">
        <div style={{ background: '#1e293b', color: '#e2e8f0', borderRadius: 10, padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}>
          <span style={{ color: '#64748b' }}># 교사 대시보드{'\n'}</span>
          {'/'}<span style={{ color: '#7dd3fc' }}>[학급코드]</span>/dashboard{'\n\n'}
          <span style={{ color: '#64748b' }}># 수업 모드 (매일 메인){'\n'}</span>
          {'/'}<span style={{ color: '#7dd3fc' }}>[학급코드]</span>/teach{'\n\n'}
          <span style={{ color: '#64748b' }}># TV 순위판 (새 탭){'\n'}</span>
          /tv/<span style={{ color: '#7dd3fc' }}>[학급코드]</span>
        </div>
      </Card>
      <Tip type="danger"><strong>학급 코드는 URL에 포함됩니다.</strong> 다른 사람이 알아도 학생 데이터를 수정할 수 없지만, 학생 이름과 토큰 잔액은 열람 가능합니다. 공개 게시 주의.</Tip>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => goto(0)} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#f1f5f9', color: '#64748b' }}>← 이전</button>
        <button onClick={() => goto(2)} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#3b82f6', color: '#fff' }}>다음: 학생 등록 →</button>
      </div>
    </div>
  )
}

function Sec2({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader step="STEP 2" title="학생 등록" desc="학생을 등록하면 자동으로 토큰 계좌가 개설됩니다. QR 통장도 바로 인쇄할 수 있습니다." />
      <Card title="👨‍🎓 학생 등록 방법">
        <Steps items={[
          { title: '학생 관리 → 학생 추가', desc: '이름, 학년, 장애 유형, PBS 단계(1~5)를 입력합니다.' },
          { title: 'PBS 단계 설정', desc: '1단계 = 완전 촉구, 5단계 = 독립 수행. 처음엔 1~2단계로 시작하세요.' },
          { title: 'QR 통장 인쇄', desc: '학생 상세 → QR 통장 발급 버튼. 학생이 자신의 잔액을 스캔으로 확인합니다.' },
        ]} />
      </Card>
      <Grid2>
        <FeatureCard icon="💳" title="자동 계좌 개설" desc="등록과 동시에 PBS 토큰 계좌 생성. 초기 잔액 설정 가능." />
        <FeatureCard icon="🪙" title="QR 코드 토큰" desc="실물 코인 대신 QR 코드로 토큰 지급·상환. QR 토큰 탭에서 배치 생성." />
      </Grid2>
      <Tip type="success"><strong>권장 순서:</strong> 학생 등록 → AI 행동 지원 계획 생성 → PBS 목표 자동 설정. 목표를 수동으로 입력할 필요 없이 AI가 학생 정보 기반으로 초안을 만들어 줍니다.</Tip>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => goto(1)} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#f1f5f9', color: '#64748b' }}>← 이전</button>
        <button onClick={() => goto(3)} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#3b82f6', color: '#fff' }}>다음: PBS 목표 →</button>
      </div>
    </div>
  )
}

function Sec3({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader step="STEP 3" title="PBS 목표 설정" desc="각 학생에게 목표 행동을 등록하고 토큰 단가와 하루 목표 횟수를 설정합니다. AI로 자동 생성하는 것을 추천합니다." />
      <Card title="✅ 목표 등록 필드">
        <ul style={{ paddingLeft: 18 }}>
          {[
            ['행동명', '관찰 가능한 형태로 (예: "자리에 앉아 과제를 5분 이상 수행하기")'],
            ['토큰 단가', '1회 달성 시 지급 토큰 (100~500원 권장)'],
            ['하루 목표 횟수', '진행률 바로 시각화됨'],
            ['DRO 연동', '체크 시 DRO 타이머 자동 시작 여부'],
          ].map(([k, v]) => (
            <li key={k} style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 4 }}><strong style={{ color: '#0f172a' }}>{k}</strong> — {v}</li>
          ))}
        </ul>
      </Card>
      <Card title="📦 일괄 체크 기능">
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>같은 목표를 여러 학생이 공유하는 경우, <strong>일괄 체크 버튼</strong>으로 한 번에 처리할 수 있습니다.</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['행동명 선택', '→ 해당 학생 목록 표시', '→ +1/2/3 일괄 적용'].map(t => (
            <span key={t} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: '#dbeafe', color: '#1d4ed8' }}>{t}</span>
          ))}
        </div>
      </Card>
      <Card title="↩ 실수 취소 (Undo)">
        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>체크 후 <strong>6초 이내</strong>에 토스트 알림의 실행취소 버튼을 누르면 기록이 삭제됩니다. 잘못 누른 경우 즉시 취소하세요.</p>
      </Card>
      <Tip type="success"><strong>AI 자동 생성 권장:</strong> 학생 관리 → 학생 상세 → AI 행동 지원 계획 탭에서 학생 정보를 입력하면 ABA 근거 기반 PBS 목표가 자동으로 만들어집니다.</Tip>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => goto(2)} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#f1f5f9', color: '#64748b' }}>← 이전</button>
        <button onClick={() => goto(4)} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#3b82f6', color: '#fff' }}>다음: AI 계획 →</button>
      </div>
    </div>
  )
}

function Sec4({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader step="STEP 4 · GPT-4o" title="AI 행동 지원 계획" desc="자유롭게 학생을 서술하면 AI가 학생 이해 정보를 구조화하고, 이를 바탕으로 FBA → PBS 목표 → 행동계약서 → 중재전략을 한 흐름으로 생성합니다." />
      <Card title="🖊 자유 텍스트 입력 예시">
        <div style={{ background: '#1e293b', color: '#e2e8f0', borderRadius: 10, padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7 }}>
          <span style={{ color: '#64748b' }}># 이렇게 자유롭게 써도 됩니다{'\n'}</span>
          <span style={{ color: '#7dd3fc' }}>
            {`김민준, 3학년, 지적장애 경도.\n수업 중 자리를 이탈해서 교실을 돌아다녀요.\n특히 수학 시간에 자주 발생하고, 친구들이\n웃어주면 더 심해지는 것 같아요.`}
          </span>
        </div>
      </Card>
      <Card title="🧠 AI의 역할">
        <Steps items={[
          { title: '학생 이해 정보 구조화', desc: '강점, 선호, 지원 필요, 위험요인, 관찰 행동, 선행·결과 사건을 먼저 정리합니다.' },
          { title: '학생별 AI 프로필 저장', desc: '한 번 구조화한 정보는 학생 상세에 저장되어 이후 계획 생성과 수업 운영에 재사용됩니다.' },
          { title: '행동지원 산출물 생성', desc: '저장된 프로필을 바탕으로 FBA, PBS 목표, 계약서, 중재전략, DRO 후보를 만듭니다.' },
        ]} />
      </Card>
      <Card title="🤖 AI가 자동으로 생성하는 것">
        <Steps items={[
          { title: 'FBA 기능 분석', desc: '주의추구 / 회피 / 감각 / 물건획득 중 추정 기능과 신뢰도를 분석합니다.' },
          { title: 'PBS 목표 2개 이상', desc: '대체행동 + 보완행동으로 구성. 토큰 단가와 DRO 일정 포함.' },
          { title: '행동계약서 초안', desc: '달성 기준, 측정 방법, 보상 금액이 포함된 계약서를 즉시 인쇄 가능.' },
          { title: '근거기반 중재전략', desc: 'FCT·DRO·NCR 등 18개 전략 DB에서 기능에 맞는 전략을 우선순위로 추천.' },
        ]} />
      </Card>
      <Tip type="danger"><strong>AI 산출물은 초안입니다.</strong> 이 플랫폼은 PBS를 상위 운영 틀로 두고 ABA 기반 원리를 활용하지만, 최종 판단은 반드시 교사가 해야 합니다. 감각 기능 행동 소거 금지 등 주요 안전 규칙은 자동 반영되더라도 저장 전 검토·수정은 필수입니다.</Tip>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => goto(3)} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#f1f5f9', color: '#64748b' }}>← 이전</button>
        <button onClick={() => goto(5)} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#3b82f6', color: '#fff' }}>다음: 수업 모드 →</button>
      </div>
    </div>
  )
}

function Sec5({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader step="매일 사용" title="수업 모드 👨‍🏫" desc="40분 수업 동안 6명을 동시에 모니터링하는 핵심 화면입니다. 사이드바 맨 위의 수업 모드 버튼으로 진입하세요." />
      <Grid2>
        <FeatureCard icon="⏰" title="교시 선택" desc="1~6교시 또는 방과후 선택 시 세션 타이머 시작. 경과 시간 실시간 표시." />
        <FeatureCard icon="+1" title="즉시 토큰 지급" desc="학생 카드의 +1/+2/+3 버튼 탭 한 번으로 지급. ABA 3초 강화 원칙 준수." />
        <FeatureCard icon="P" title="촉구 토글" desc="P 버튼 활성화 시 다음 체크가 '촉구 행동'으로 기록. 독립/촉구 비율 추적." />
        <FeatureCard icon="⏱" title="DRO 타이머" desc="학생 카드 내에 타이머 내장. 행동 발생 시 ↩ 리셋, 완료 시 토큰 지급." />
      </Grid2>
      <Card title="⚠️ FAB 버튼 — 즉각 사건 기록">
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>화면 우하단 빨간 버튼. 3탭으로 사건을 기록합니다:</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {['① 학생 선택', '→ ② 행동 유형', '→ ③ 저장'].map(t => (
            <span key={t} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: '#fed7aa', color: '#c2410c' }}>{t}</span>
          ))}
        </div>
        <p style={{ fontSize: 12, color: '#64748b' }}>자리이탈 · 공격행동 · 자해행동 · 수업방해 · 물건던지기 · 거부/회피 · 기타</p>
      </Card>
      <Card title="🏁 수업 종료 · 일괄 정산">
        <ul style={{ paddingLeft: 18 }}>
          {[
            '미정산 토큰이 있으면 상단에 수업 종료 버튼이 활성화됩니다.',
            '클릭 시 학생별 미정산 금액 확인 후 일괄 정산으로 전원 계좌 입금.',
            '정산 완료 후 다음 교시 선택으로 연속 운영 가능.',
          ].map((t, i) => (
            <li key={i} style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 4 }}>{t}</li>
          ))}
        </ul>
      </Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => goto(4)} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#f1f5f9', color: '#64748b' }}>← 이전</button>
        <button onClick={() => goto(6)} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#3b82f6', color: '#fff' }}>다음: TV 순위판 →</button>
      </div>
    </div>
  )
}

function Sec6({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader step="교실 디스플레이" title="TV 순위판 📺" desc="교실 TV나 빔프로젝터에 띄우는 전용 화면입니다. 학생 잔액 순위가 30초마다 자동 갱신됩니다." />
      <Card title="🖥 실행 방법">
        <Steps items={[
          { title: '사이드바 맨 아래 TV 순위판 클릭', desc: '새 탭으로 열립니다. 이 탭을 교실 TV에 전송하세요 (크롬캐스트·미러링).' },
          { title: '상단 버튼으로 정렬 모드 변경', desc: '오늘 획득 토큰 순 / 전체 잔액 순 전환 가능.' },
          { title: 'TOP 3는 메달 시상대로 표시', desc: '나머지 학생은 카드 그리드로 표시. 교실 분위기를 자연스럽게 조성합니다.' },
        ]} />
      </Card>
      <Tip type="warn"><strong>활용 팁:</strong> 수업 종료 후 정산이 완료되면 즉시 TV에 반영됩니다. 수업 끝나고 모두 함께 확인하는 루틴이 강화 효과를 높입니다.</Tip>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => goto(5)} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#f1f5f9', color: '#64748b' }}>← 이전</button>
        <button onClick={() => goto(7)} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#3b82f6', color: '#fff' }}>다음: FBA 분석 →</button>
      </div>
    </div>
  )
}

function Sec7({ goto }: { goto: (n: number) => void }) {
  return (
    <div>
      <SectionHeader step="데이터 기반 중재" title="FBA 기능행동분석 🔍" desc="수업 중 발생한 사건 기록이 쌓이면 FBA 탭에서 패턴을 분석하고, 기능에 맞는 중재전략을 바로 조회할 수 있습니다." />
      <Card title="📊 기록 → 분석 흐름">
        <Flow items={['⚠️ 수업 중 사건', 'FBA 탭 자동 저장', '기능 추정', '전략 조회']} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['주의추구', '#ede9fe', '#7c3aed'], ['회피/도피', '#fed7aa', '#c2410c'], ['감각자극', '#dcfce7', '#15803d'], ['물건획득', '#dbeafe', '#1d4ed8']].map(([label, bg, color]) => (
            <span key={label} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: bg, color }}>{label}</span>
          ))}
        </div>
      </Card>
      <Card title="PBS와 ABA의 관계">
        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.8, margin: 0 }}>
          이 플랫폼에서 <strong style={{ color: '#0f172a' }}>PBS는 상위 운영 틀</strong>이고,
          <strong style={{ color: '#0f172a' }}> ABA는 작동 원리 일부</strong>입니다.
          강화, 토큰 지급, 촉구, DRO, 사건기록, FBA 같은 기법은 ABA 기반 원리를 활용하지만,
          전체 운영 목표는 학교·학급 맥락에서 예방적이고 교육적인 행동지원을 수행하는 PBS에 있습니다.
        </p>
      </Card>
      <Card title="📚 중재전략 인라인 조회">
        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>각 FBA 기록에서 <strong>&ldquo;중재전략 보기 ▼&rdquo;</strong> 버튼 클릭 시 해당 기능에 맞는 근거기반 전략 상위 3개가 바로 펼쳐집니다. &ldquo;PBS 목표로 →&rdquo; 버튼으로 바로 연결.</p>
      </Card>
      <Tip type="danger"><strong>소거(EXT) 주의:</strong> 감각 기능 행동에는 소거가 적용 불가합니다. 회피 기능 자해·공격 행동 소거는 폭발 위험이 높으므로 전문가 팀 협의 후 진행하세요 (Lerman &amp; Iwata, 1995).</Tip>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => goto(6)} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#f1f5f9', color: '#64748b' }}>← 이전</button>
        <button onClick={() => goto(8)} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#10b981', color: '#fff' }}>완료 화면 →</button>
      </div>
    </div>
  )
}

function Sec8({ goto }: { goto: (n: number) => void }) {
  const checklist = [
    '교사 계정 생성 및 학급 코드 확인',
    '학생 6명 등록 완료',
    '각 학생 AI 행동 지원 계획 생성 및 저장',
    'PBS 목표 최소 1개 이상 / 학생',
    'TV 순위판 새 탭 열기 확인',
    '수업 모드에서 교시 선택 테스트',
    '행동계약서 출력 (선택)',
  ]
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>준비 완료!</h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, maxWidth: 400, margin: '0 auto' }}>모든 기능을 확인했습니다. 아래 체크리스트로 첫 수업 전 준비 상태를 점검하세요.</p>
      <div style={{ textAlign: 'left', maxWidth: 360, margin: '24px auto 0' }}>
        {checklist.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < checklist.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: 13, color: '#374151' }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700 }}>✓</span>
            {item}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 28, display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={() => goto(0)} style={{ padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#f1f5f9', color: '#64748b' }}>처음으로 돌아가기</button>
        <Link href="/login" style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: '#10b981', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>🏫 시작하기</Link>
      </div>
    </div>
  )
}
