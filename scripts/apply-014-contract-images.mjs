/**
 * 014 계약 이미지 컬럼을 원격 Postgres에 직접 적용합니다.
 * (Supabase SQL Editor에 붙여넣기와 동일한 내용)
 *
 * 사용:
 *   npm run db:apply-014
 *
 * 요구:
 *   .env.local 에 DATABASE_URL
 *   Supabase → Project Settings → Database → Connection string → URI
 *   (Direct connection 권장, 비밀번호 포함. sslmode=require 유지)
 *
 * MCP만 쓰는 경우: Supabase 대시보드 SQL Editor에
 *   scripts/sql/apply_014_contract_images.sql
 *   전체를 붙여넣어 실행해도 동일합니다.
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvLocal() {
  const env = {}
  try {
    readFileSync(join(repoRoot, '.env.local'), 'utf8').split('\n').forEach((line) => {
      const t = line.trim()
      if (!t || t.startsWith('#')) return
      const eq = t.indexOf('=')
      if (eq === -1) return
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      env[k] = v
    })
  } catch (e) {
    console.error('❌ .env.local 을 읽을 수 없습니다.', e.message)
    process.exit(1)
  }
  return env
}

async function main() {
  const env = loadEnvLocal()
  const databaseUrl = env.DATABASE_URL
  if (!databaseUrl) {
    console.error(
      '❌ DATABASE_URL 이 없습니다.\n' +
        '   Supabase → Settings → Database → Connection string → URI 를 .env.local 에 넣으세요.\n' +
        '   또는 SQL Editor에서 scripts/sql/apply_014_contract_images.sql 을 실행하세요.',
    )
    process.exit(1)
  }

  const sqlPath = join(repoRoot, 'scripts/sql/apply_014_contract_images.sql')
  const sqlText = readFileSync(sqlPath, 'utf8')

  const { default: postgres } = await import('postgres')
  const sql = postgres(databaseUrl, { ssl: 'require', max: 1 })

  try {
    await sql.unsafe(sqlText)
    console.log('✅ apply_014_contract_images.sql 적용 완료 (PostgREST 캐시 reload 포함)')
  } catch (e) {
    console.error('❌ SQL 실행 실패:', e.message)
    process.exit(1)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main()
