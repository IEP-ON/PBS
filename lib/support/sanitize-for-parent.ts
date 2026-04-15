const FORBIDDEN_PARENT_KEYS = new Set([
  'private_teacher_notes',
  'risk_flags',
  'hypothesized_functions',
  'teacher_verified',
  'teacher_verified_at',
  'confidence_by_field',
  'source_free_text',
  'generated_follow_up_questions',
])

export function redactForParent<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => redactForParent(item)) as T
  }

  if (input && typeof input === 'object') {
    const redacted = Object.entries(input as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, value]) => {
      if (FORBIDDEN_PARENT_KEYS.has(key)) {
        return acc
      }
      acc[key] = redactForParent(value)
      return acc
    }, {})

    return redacted as T
  }

  return input
}
