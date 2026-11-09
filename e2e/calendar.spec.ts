import { expect, test, type Page } from '@playwright/test'

interface TaskOptions {
  title: string
  description?: string
  priority?: '首要' | '次要' | '普通' | '待定'
  endDate: string
  endTime: string
}

async function createTask(page: Page, options: TaskOptions): Promise<void> {
  await page.getByTestId('new-task').click()

  const form = page.locator('form')
  await page.getByTestId('task-title').fill(options.title)
  await page.getByTestId('task-description').fill(options.description ?? 'E2E 描述')

  if (options.priority) {
    await form.getByRole('button', { name: options.priority, exact: true }).click()
  }

  await page.getByTestId('end-date').fill(options.endDate)
  await page.getByTestId('end-time').fill(options.endTime)
  await page.getByTestId('save-task').click()

  await expect(page.locator('.task-card', { hasText: options.title })).toBeVisible()
}

/** 把右侧列表里的某张事务拖到日历第 columnIndex 列（0 = 周一）的指定小时 */
async function dragTaskToSlot(
  page: Page,
  title: string,
  columnIndex: number,
  hour: number
): Promise<void> {
  const card = page.locator('.task-card', { hasText: title })
  const column = page.locator('.cal-col').nth(columnIndex)

  const cardBox = await card.boundingBox()
  const columnBox = await column.boundingBox()
  if (!cardBox || !columnBox) throw new Error('找不到可拖拽的卡片或列')

  const startX = cardBox.x + cardBox.width / 2
  const startY = cardBox.y + 20
  const targetX = columnBox.x + columnBox.width / 2
  const targetY = columnBox.y + hour * 56 + 10

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(
      startX + ((targetX - startX) * step) / 10,
      startY + ((targetY - startY) * step) / 10
    )
  }
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('new-task')).toBeVisible()
})

test('创建事务后自动落位到截止时间', async ({ page }) => {
  await createTask(page, {
    title: 'E2E 自动落位',
    endDate: '2026-11-10',
    endTime: '18:00'
  })

  await expect(page.locator('.ev', { hasText: 'E2E 自动落位' })).toBeVisible()
})

test('拖拽事务到空白时段完成排期', async ({ page }) => {
  await createTask(page, {
    title: 'E2E 拖拽排期',
    endDate: '2026-11-13',
    endTime: '09:00'
  })

  const before = await page.locator('.ev').count()
  await dragTaskToSlot(page, 'E2E 拖拽排期', 2, 15)

  await expect(page.getByText('已安排')).toBeVisible()
  await expect(page.locator('.ev')).toHaveCount(before + 1)
})

test('拖到已占用时段被拒绝且不产生新卡片', async ({ page }) => {
  await createTask(page, {
    title: 'E2E 冲突甲',
    endDate: '2026-11-13',
    endTime: '09:00'
  })
  await createTask(page, {
    title: 'E2E 冲突乙',
    endDate: '2026-11-13',
    endTime: '10:00'
  })

  await dragTaskToSlot(page, 'E2E 冲突甲', 3, 16)
  await expect(page.getByText('已安排')).toBeVisible()
  const occupied = await page.locator('.ev').count()

  await dragTaskToSlot(page, 'E2E 冲突乙', 3, 16)
  await expect(page.getByText('该时段已被占用')).toBeVisible()
  await expect(page.locator('.ev')).toHaveCount(occupied)
})

test('修改截止时间后自动卡片跟随', async ({ page }) => {
  await createTask(page, {
    title: 'E2E 改期',
    endDate: '2026-11-11',
    endTime: '10:00'
  })

  await page.locator('.task-card', { hasText: 'E2E 改期' }).click()
  await page.getByTestId('edit-task').click()
  await page.getByTestId('end-date').fill('2026-11-12')
  await page.getByTestId('end-time').fill('11:00')
  await page.getByTestId('save-task').click()

  await expect(page.locator('.ev', { hasText: 'E2E 改期' })).toBeVisible()
})
