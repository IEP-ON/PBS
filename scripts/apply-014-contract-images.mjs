/**
 * contract_images_setup.sql 을 DATABASE_URL 로 원격 실행 (선택)
 * 권장: Supabase SQL Editor 에 scripts/sql/contract_images_setup.sql 전체 붙여넣기
 *
 * 사용: npm run db:apply-014
 * 요구: .env.local 에 DATABASE_URL (Connection string URI)
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
        '   Supabase SQL Editor에서 scripts/sql/contract_images_setup.sql 을 실행하세요.',
    )
    process.exit(1)
  }

  const sqlPath = join(repoRoot, 'scripts/sql/contract_images_setup.sql')
  const sqlText = readFileSync(sqlPath, 'utf8')

  const { default: postgres } = await import('postgres')
  const sql = postgres(databaseUrl, { ssl: 'require', max: 1 })

  try {
    await sql.unsafe(sqlText)
    console.log('✅ contract_images_setup.sql 적용 완료')
  } catch (e) {
    console.error('❌ SQL 실행 실패:', e.message)
    process.exit(1)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main()
