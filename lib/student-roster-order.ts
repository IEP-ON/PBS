/**
 * 학급 학생 목록 공통 정렬: 학년 오름차순, 같은 학년은 이름(가나다) 오름차순.
 * `from('pbs_students').select(...).eq('class_code_id', …)` 등 필터 뒤에 연결하세요.
 */
// Supabase 체인 타입이 버전마다 달라서 호출부에서 타입이 유지되도록 제네릭만 둡니다.
export function withStudentRosterOrder<Q extends { order: (column: string, options?: { ascending?: boolean }) => Q }>(
  query: Q
): Q {
  return query.order('grade', { ascending: true }).order('name')
}
