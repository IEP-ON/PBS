-- R9: 행동 목표가 없는 활성 학생에게 기본 목표 2개 부여 + 지나치게 낮은 가게 가격 하한선 정리
-- idempotent: 목표는 "활성 행동 목표 0개"인 학생에게만 삽입. 가게는 price < 100 인 활성 상품만 상향.

insert into pbs_goals (
  student_id,
  class_code_id,
  behavior_name,
  behavior_definition,
  token_per_occurrence,
  daily_target,
  allow_self_check,
  is_active,
  is_dro,
  is_drl
)
select
  s.id,
  s.class_code_id,
  seed.behavior_name,
  seed.behavior_definition,
  seed.token_per_occurrence,
  seed.daily_target,
  seed.allow_self_check,
  true,
  false,
  false
from pbs_students s
cross join (
  values
    ('수업에 참여하기'::text, '선생님 지시에 따라 수업 활동에 차례로 참여한다.'::text, 50::int, 5::int, true::boolean),
    ('예의 있게 소통하기'::text, '눈을 보며 차분한 목소리로 말한다.'::text, 40::int, 4::int, true::boolean)
) as seed(behavior_name, behavior_definition, token_per_occurrence, daily_target, allow_self_check)
where s.class_code_id is not null
  and coalesce(s.is_active, true) = true
  and not exists (
    select 1
    from pbs_goals g
    where g.student_id = s.id
      and coalesce(g.is_active, true) = true
  );

update pbs_shop_items
set price = 200
where coalesce(is_active, true) = true
  and price > 0
  and price < 100;
