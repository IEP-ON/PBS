import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

function formatViolations(violations: Array<{ id: string; impact?: string; help: string }>) {
  return violations.map((v) => `[${v.impact}] ${v.id}: ${v.help}`).join('\n')
}

async function assertNoSeriousA11yViolations(page: import('@playwright/test').Page, path: string) {
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious, `a11y (serious/critical) on ${path}:\n${formatViolations(serious)}`).toHaveLength(0)
}

/** 로그인 이후 화면: 대시보드·지원 허브 등에서 gray-400 등 대비 이슈가 많아, 흐름 스모크에서는 color-contrast만 제외 */
async function assertNoSeriousA11yExceptColorContrast(page: import('@playwright/test').Page, path: string) {
  const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious, `a11y (serious/critical, no color-contrast) on ${path}:\n${formatViolations(serious)}`).toHaveLength(0)
}

test.describe('public smoke + axe', () => {
  test('landing /', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /PBS 토큰 이코노미/ })).toBeVisible()
    await assertNoSeriousA11yViolations(page, '/')
  })

  test('login — class code step', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
    await expect(page.getByLabel('학급 식별코드')).toBeVisible()
    await assertNoSeriousA11yViolations(page, '/login')
  })
})

test.describe('teacher flow (optional env)', () => {
  test('teacher login → dashboard', async ({ page }) => {
    const classCode = process.env.E2E_CLASS_CODE
    const teacherPin = process.env.E2E_TEACHER_PIN
    test.skip(!classCode || !teacherPin, 'Set E2E_CLASS_CODE and E2E_TEACHER_PIN for this flow')

    await page.goto('/login')
    await page.getByLabel('학급 식별코드').fill(classCode!)
    await page.getByRole('button', { name: '다음' }).click()
    await expect(page.getByRole('button', { name: /교사용/ })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /교사용/ }).click()
    await page.getByLabel('교사 PIN').fill(teacherPin!)
    await page.getByRole('button', { name: '교사 로그인' }).click()
    await expect(page).toHaveURL(/\/[^/]+\/dashboard/, { timeout: 20_000 })
    await assertNoSeriousA11yExceptColorContrast(page, 'teacher dashboard')
  })

  test('teacher: support hub', async ({ page }) => {
    const classCode = process.env.E2E_CLASS_CODE
    const teacherPin = process.env.E2E_TEACHER_PIN
    test.skip(!classCode || !teacherPin, 'Set E2E_CLASS_CODE and E2E_TEACHER_PIN for this flow')

    await page.goto('/login')
    await page.getByLabel('학급 식별코드').fill(classCode!)
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByRole('button', { name: /교사용/ }).click()
    await page.getByLabel('교사 PIN').fill(teacherPin!)
    await page.getByRole('button', { name: '교사 로그인' }).click()
    await expect(page).toHaveURL(/\/[^/]+\/dashboard/, { timeout: 20_000 })

    const code = page.url().match(/\/([^/]+)\/dashboard/)?.[1]
    expect(code).toBeTruthy()
    await page.goto(`/${code}/support`)
    await expect(page.getByRole('heading', { name: '학생 지원 허브' })).toBeVisible({ timeout: 15_000 })
    await assertNoSeriousA11yExceptColorContrast(page, '/[class]/support')
  })
})

test.describe('student flow (optional env)', () => {
  test('student login → home', async ({ page }) => {
    const classCode = process.env.E2E_CLASS_CODE
    const studentName = process.env.E2E_STUDENT_NAME
    const studentPin = process.env.E2E_STUDENT_PIN
    test.skip(
      !classCode || !studentName || !studentPin || !/^\d{4}$/.test(studentPin),
      'Set E2E_CLASS_CODE, E2E_STUDENT_NAME, E2E_STUDENT_PIN (4 digits)',
    )

    await page.goto('/login')
    await page.getByLabel('학급 식별코드').fill(classCode!)
    await page.getByRole('button', { name: '다음' }).click()
    await expect(page.getByRole('button', { name: /학생용/ })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /학생용/ }).click()

    const nameInput = page.getByLabel('이름')
    if (await nameInput.isVisible()) {
      await nameInput.fill(studentName!)
    }

    for (const digit of studentPin!.split('')) {
      await page.getByRole('button', { name: digit, exact: true }).click()
    }

    await expect(page).toHaveURL(/\/s\/[^/]+\/[^/]+\/home/, { timeout: 25_000 })
    await assertNoSeriousA11yExceptColorContrast(page, 'student home')
  })
})
