import { expect, test, type Page } from '@playwright/test'

interface TaskOptions {
  title: string
  description?: string
  priority?: '首要' | '次要' | '普通' | '待定'
  startDate?: string
  startTime?: string
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

  if (options.startDate) await page.getByTestId('start-date').fill(options.startDate)
  if (options.startTime) await page.getByTestId('start-time').fill(options.startTime)

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
  // 自动落位 1 条 + 拖入 1 条
  await expect(page.locator('.ev', { hasText: 'E2E 冲突甲' })).toHaveCount(2)

  const beforeSecond = await page.locator('.ev', { hasText: 'E2E 冲突乙' }).count()
  expect(beforeSecond).toBe(1)
  await dragTaskToSlot(page, 'E2E 冲突乙', 3, 16)
  await expect(page.getByText('该时段已被占用')).toBeVisible()
  await expect(page.locator('.ev', { hasText: 'E2E 冲突乙' })).toHaveCount(beforeSecond)
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

test('从卡片上部拖动只移动位置，不改变时长', async ({ page }) => {
  await createTask(page, {
    title: 'E2E 移动不变形',
    endDate: '2026-11-10',
    endTime: '18:00'
  })

  const card = page.locator('.ev', { hasText: 'E2E 移动不变形' })
  const before = await card.boundingBox()
  if (!before) throw new Error('卡片未渲染')

  const columnBox = await page.locator('.cal-col').nth(3).boundingBox()
  if (!columnBox) throw new Error('列未渲染')

  // 抓在卡片上部（避开 6px 拉伸把手），模拟用户想移动却靠近边缘的握法
  const startX = before.x + before.width / 2
  const startY = before.y + 10
  const targetX = columnBox.x + columnBox.width / 2
  const targetY = columnBox.y + 14 * 56 + 10

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(
      startX + ((targetX - startX) * step) / 10,
      startY + ((targetY - startY) * step) / 10
    )
  }
  await page.mouse.up()

  await expect(page.getByText('已调整')).toBeVisible()
  const after = await card.boundingBox()
  if (!after) throw new Error('卡片消失了')

  // 高度必须保持不变：从卡片主体拖动永远只移动
  expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(2)
  expect(Math.abs(after.x - before.x)).toBeGreaterThan(40)
})

test('可以把安排从日程中移除', async ({ page }) => {
  await createTask(page, {
    title: 'E2E 移除安排',
    endDate: '2026-11-10',
    endTime: '19:00'
  })

  const card = page.locator('.ev', { hasText: 'E2E 移除安排' })
  await expect(card).toBeVisible()

  await page.locator('.task-card', { hasText: 'E2E 移除安排' }).click()
  await page.getByRole('button', { name: '移除', exact: true }).click()

  await expect(page.getByText('已从日程移除')).toBeVisible()
  await expect(card).toHaveCount(0)
})
test('可以在详情里手动添加计划时段', async ({ page }) => {
  await createTask(page, {
    title: 'E2E 手动时段',
    endDate: '2026-11-12',
    endTime: '09:00'
  })

  await page.locator('.task-card', { hasText: 'E2E 手动时段' }).click()
  await page.getByRole('button', { name: '移除', exact: true }).click()
  await expect(page.locator('.ev', { hasText: 'E2E 手动时段' })).toHaveCount(0)

  await page.getByTestId('manual-day').fill('2026-11-12')
  await page.getByTestId('manual-start').fill('07:00')
  await page.getByTestId('manual-end').fill('08:30')
  await page.getByTestId('add-placement').click()

  await expect(page.getByText('已添加时段')).toBeVisible()
  await expect(page.locator('.ev', { hasText: 'E2E 手动时段' })).toBeVisible()
})
test('移动过程中预览高度始终不变', async ({ page }) => {
  await createTask(page, {
    title: 'E2E 拖动稳定',
    endDate: '2026-11-10',
    endTime: '18:00'
  })

  const card = page.locator('.ev', { hasText: 'E2E 拖动稳定' })
  const before = await card.boundingBox()
  if (!before) throw new Error('卡片未渲染')

  // 抓卡片主体（避开上下 6px 把手），拖动的过程中分多次采样预览高度
  const startX = before.x + before.width / 2
  const startY = before.y + before.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()

  const heights: number[] = []
  for (let step = 1; step <= 6; step++) {
    await page.mouse.move(startX + step * 18, startY + step * 18)
    await page.waitForTimeout(60)

    const preview = page.getByTestId('drag-preview')
    if ((await preview.count()) > 0) {
      const box = await preview.boundingBox()
      if (box) heights.push(box.height)
    }
  }

  await page.mouse.up()
  await expect(page.getByText('已调整')).toBeVisible()
  await expect(card).toBeVisible()

  expect(heights.length).toBeGreaterThan(2)
  for (const height of heights) {
    expect(Math.abs(height - heights[0]!)).toBeLessThanOrEqual(1)
  }

  const after = await card.boundingBox()
  expect(after).toBeTruthy()
  expect(Math.abs(after!.height - before.height)).toBeLessThanOrEqual(2)
})
test('可以在详情里修改已有时段', async ({ page }) => {
  await createTask(page, {
    title: 'E2E 修改时段',
    endDate: '2026-11-11',
    endTime: '10:00'
  })

  await page.locator('.task-card', { hasText: 'E2E 修改时段' }).click()
  await page.locator('[data-testid^="edit-placement-"]').first().click()

  await page.getByTestId('edit-start').fill('13:00')
  await page.getByTestId('edit-end').fill('14:30')
  await page.getByTestId('save-placement').click()

  await expect(page.getByText('已更新时段')).toBeVisible()
  await expect(page.getByText('11/11 周三 13:00–14:30')).toBeVisible()
})
test('可以在日/周/月视图之间切换', async ({ page }) => {
  await expect(page.locator('.cal-col')).toHaveCount(7)

  await page.getByTestId('view-day').click()
  await expect(page.locator('.cal-col')).toHaveCount(1)

  await page.getByTestId('view-month').click()
  await expect(page.locator('.month-cell')).toHaveCount(42)

  await page.getByTestId('view-week').click()
  await expect(page.locator('.cal-col')).toHaveCount(7)
})

test('月视图点某天先看日预览，再进入日表', async ({ page }) => {
  await page.getByTestId('view-month').click()
  await expect(page.locator('.month-cell')).toHaveCount(42)

  await page.locator('.month-cell').nth(9).click()
  await expect(page.getByTestId('enter-view')).toHaveText('进入日表')

  await page.getByTestId('enter-view').click()
  await expect(page.locator('.cal-col')).toHaveCount(1)
})

test('月视图行首可以看周预览并进入周表', async ({ page }) => {
  await page.getByTestId('view-month').click()
  await page.locator('[data-testid="week-head"]').first().click()
  await expect(page.getByTestId('enter-view')).toHaveText('进入周表')

  await page.getByTestId('enter-view').click()
  await expect(page.locator('.cal-col')).toHaveCount(7)
})
test('完成归档后进入历史，日程卡片变灰', async ({ page }) => {
  await createTask(page, {
    title: 'E2E 归档',
    endDate: '2026-11-10',
    endTime: '18:00'
  })

  await page.locator('.task-card', { hasText: 'E2E 归档' }).click()
  await page.getByTestId('archive-task').click()
  // 完成时间设在安排之后，保留这段历史，卡片才会继续显示
  await page.getByTestId('archive-date').fill('2026-11-10')
  await page.getByTestId('archive-time').fill('20:00')
  await page.getByTestId('confirm-archive').click()
  await expect(page.getByText('已归档')).toBeVisible()

  await expect(page.locator('.task-card', { hasText: 'E2E 归档' })).toHaveCount(0)

  await page.getByTestId('tab-history').click()
  await expect(
    page.locator('[data-testid="history-item"]', { hasText: 'E2E 归档' })
  ).toBeVisible()

  await expect(page.locator('.ev.archived', { hasText: 'E2E 归档' })).toBeVisible()
})

test('取消归档后回到待办', async ({ page }) => {
  await createTask(page, {
    title: 'E2E 恢复',
    endDate: '2026-11-10',
    endTime: '18:00'
  })

  await page.locator('.task-card', { hasText: 'E2E 恢复' }).click()
  await page.getByTestId('archive-task').click()
  await page.getByTestId('confirm-archive').click()
  await expect(page.getByText('已归档')).toBeVisible()

  await page.getByTestId('tab-history').click()
  await page.locator('[data-testid="history-item"]', { hasText: 'E2E 恢复' }).click()
  await page.getByTestId('unarchive-task').click()
  await expect(page.getByText('已恢复到待办')).toBeVisible()

  await page.getByTestId('tab-todo').click()
  await expect(page.locator('.task-card', { hasText: 'E2E 恢复' })).toBeVisible()
})
test('归档时释放完成时间之后的安排', async ({ page }) => {
  await createTask(page, {
    title: 'E2E 释放未来',
    endDate: '2026-11-10',
    endTime: '18:00'
  })

  await page.locator('.task-card', { hasText: 'E2E 释放未来' }).click()
  await page.getByTestId('manual-day').fill('2026-11-12')
  await page.getByTestId('manual-start').fill('09:00')
  await page.getByTestId('manual-end').fill('10:00')
  await page.getByTestId('add-placement').click()
  await expect(page.getByText('已添加时段')).toBeVisible()

  await page.getByTestId('archive-task').click()
  await expect(page.getByTestId('release-hint')).toContainText('2 个未来安排')
  await page.getByTestId('confirm-archive').click()

  await expect(page.getByText('已归档，释放 2 个未来安排')).toBeVisible()
  await expect(page.locator('.ev', { hasText: 'E2E 释放未来' })).toHaveCount(0)
})

test('已归档的日程卡片只读，不能被拖动', async ({ page }) => {
  await createTask(page, {
    title: 'E2E 只读卡片',
    startDate: '2026-11-09',
    startTime: '08:00',
    endDate: '2026-11-09',
    endTime: '09:00'
  })

  await page.locator('.task-card', { hasText: 'E2E 只读卡片' }).click()
  await page.getByTestId('archive-task').click()
  await page.getByTestId('archive-time').fill('12:00')
  await page.getByTestId('confirm-archive').click()
  await expect(page.getByText('已归档')).toBeVisible()

  const card = page.locator('.ev.archived', { hasText: 'E2E 只读卡片' })
  await expect(card).toBeVisible()
  const before = await card.boundingBox()
  if (!before) throw new Error('卡片未渲染')

  const startX = before.x + before.width / 2
  const startY = before.y + before.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  for (let step = 1; step <= 6; step++) {
    await page.mouse.move(startX + step * 18, startY + step * 12)
  }
  await page.mouse.up()
  await page.waitForTimeout(300)

  await expect(page.getByText('已调整')).toHaveCount(0)
  const after = await card.boundingBox()
  if (!after) throw new Error('卡片消失了')
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1)
})
test('可以上传、预览和删除附件', async ({ page }) => {
  await createTask(page, {
    title: 'E2E 附件',
    endDate: '2026-11-10',
    endTime: '18:00'
  })

  await page.locator('.task-card', { hasText: 'E2E 附件' }).click()

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
  await page.getByTestId('attachment-input').setInputFiles({
    name: 'dot.png',
    mimeType: 'image/png',
    buffer: png
  })

  await expect(page.getByText('附件已上传')).toBeVisible()
  await expect(page.getByTestId('attachment-image')).toBeVisible()

  await page.getByTestId('attachment-delete').click()
  await page.getByTestId('attachment-delete-confirm').click()
  await expect(page.getByText('附件已删除')).toBeVisible()
  await expect(page.getByText('dot.png')).toHaveCount(0)
})
test('新建事务时可以一起上传附件', async ({ page }) => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )

  await page.getByTestId('new-task').click()
  await page.getByTestId('task-title').fill('E2E 带附件新建')
  await page.getByTestId('task-description').fill('E2E 描述')
  await page.getByTestId('end-date').fill('2026-11-10')
  await page.getByTestId('end-time').fill('18:00')
  await page.getByTestId('task-attachments').setInputFiles({
    name: 'plan.png',
    mimeType: 'image/png',
    buffer: png
  })
  await page.getByTestId('save-task').click()

  await expect(page.locator('.task-card', { hasText: 'E2E 带附件新建' })).toBeVisible()
  await page.locator('.task-card', { hasText: 'E2E 带附件新建' }).click()
  await expect(page.getByText('plan.png')).toBeVisible()
})

test('归档时可以附加完成材料，并与事务附件分组显示', async ({ page }) => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )

  await createTask(page, {
    title: 'E2E 完成附件',
    endDate: '2026-11-10',
    endTime: '18:00'
  })

  await page.locator('.task-card', { hasText: 'E2E 完成附件' }).click()
  await page.getByTestId('attachment-input').setInputFiles({
    name: 'task.png',
    mimeType: 'image/png',
    buffer: png
  })
  await expect(page.getByText('附件已上传')).toBeVisible()

  await page.getByTestId('archive-task').click()
  await page.getByTestId('archive-date').fill('2026-11-10')
  await page.getByTestId('archive-time').fill('20:00')
  await page.getByTestId('archive-attachments').setInputFiles({
    name: 'done.png',
    mimeType: 'image/png',
    buffer: png
  })
  await page.getByTestId('confirm-archive').click()
  await expect(page.getByText('已归档')).toBeVisible()

  await page.getByTestId('tab-history').click()
  await page.locator('[data-testid="history-item"]', { hasText: 'E2E 完成附件' }).click()

  await expect(page.getByText('事务附件', { exact: true })).toBeVisible()
  await expect(page.getByText('完成附件', { exact: true })).toBeVisible()
  await expect(page.getByText('task.png')).toBeVisible()
  await expect(page.getByText('done.png')).toBeVisible()
})