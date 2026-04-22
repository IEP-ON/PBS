import Link from 'next/link'
import { getSession } from '@/lib/session'
import { withStudentRosterOrder } from '@/lib/student-roster-order'
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/** 파일럿·교육자료전 기준 학생별 통합학급 지급 안내 문구 — 이름 매칭 시 카드에 표시 */
const INTEGRATED_HINT_BY_NAME: Record<string, string> = {
  박창율: '통합학급 스티커 10개당 QR 토큰 1개',
  신지민: '울음·짜증 시 이유 설명 후 진정하면 지급',
  김효주: '설정 시간(점진 축소) 안에서 울음 진정하면 지급',
  조사영: '모두에게 들리게 발표 성공 시 지급',
  서재민: '수업 시간 학습지 완수 시 지급',
  민규원: '경청·되묻기 등 개선 관찰 시 지급(정성평가)',
}

export default async function IntegratedPage({
  params,
}: {
  params: Promise<{ classCode: string }>
}) {
  const session = await getSession()
  if (!session.classroomId || session.role !== 'teacher') redirect('/login')

  const { classCode } = await params
  const supabase = await createServerSupabase()

  const { data: students } = await withStudentRosterOrder(
    supabase.from('pbs_students').select('id, name, grade').eq('class_code_id', session.classroomId).eq('is_active', true)
  )

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-bold text-emerald-700">통합학급 연계</p>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">통합학급 연계 QR 토큰</h1>
        <p className="max-w-3xl text-base leading-relaxed text-slate-600">
          특수학급과 통합학급 사이 실물 QR 토큰 흐름을 같은 화면에서 준비합니다. ATM 스캔 후 지급 환경 태깅·통계는 다음 단계에서 연결합니다.
        </p>
      </div>

      <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">운영 참고</h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">
          <li>통합담임에게는 웹 접근 없이 종이·PDF 등 오프라인 자료만 전달하는 방향과 맞춥니다.</li>
          <li>행동계약서·기록지·설문 출력은 향후 인쇄 양식 센터에서 묶습니다.</li>
        </ul>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900">학생별 지급 기준 카드</h2>
          <Link
            href={`/${classCode}/contracts`}
            className="text-sm font-semibold text-sky-700 underline underline-offset-2 hover:text-sky-900"
          >
            행동계약서 목록 →
          </Link>
        </div>

        {!students?.length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-slate-600">
            등록된 학생이 없습니다. 학생 관리에서 먼저 추가해 주세요.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {students.map((s) => {
              const hint = INTEGRATED_HINT_BY_NAME[s.name.trim()] ?? '통합학급 QR 지급 조건은 행동계약서·파일럿 운영 계획과 함께 확정합니다.'
              return (
                <article
                  key={s.id}
                  className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-extrabold text-slate-900">{s.name}</p>
                      <p className="text-xs font-medium text-slate-400">{s.grade ? `${s.grade}학년` : '학년 미입력'}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                      통합 QR
                    </span>
                  </div>
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">{hint}</p>
                  <p className="mt-4 text-xs text-slate-400">지급 건수 차트·환경 태깅은 연결 예정</p>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
