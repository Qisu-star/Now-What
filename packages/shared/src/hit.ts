export interface HitCard {
  start: number
  end: number
}

export type HitEdge = 'start' | 'end' | 'body'

export interface HitResult {
  index: number
  edge: HitEdge
}

const EDGE_ZONE_PX = 5
const TOLERANCE_PX = 3

/**
 * 判断指针落在哪张卡片上、应该触发哪种操作。
 * 先看指针是否落在卡片区间内（含极小容差），再按离上下边缘的远近决定拉伸还是移动。
 * 两张卡片上下紧贴时，优先选择指针真正落在其区间内的那张，避免误抓相邻卡片。
 */
export function pickCard(cards: readonly HitCard[], y: number, hourPx: number): HitResult | null {
  const toPx = (minutes: number): number => (minutes / 60) * hourPx

  let insideIndex = -1
  let insideDistance = Number.POSITIVE_INFINITY
  let nearIndex = -1
  let nearDistance = Number.POSITIVE_INFINITY

  cards.forEach((card, index) => {
    const top = toPx(card.start)
    const bottom = toPx(card.end)

    if (y >= top && y <= bottom) {
      const distance = Math.min(y - top, bottom - y)
      if (distance < insideDistance) {
        insideDistance = distance
        insideIndex = index
      }
    }

    if (y >= top - TOLERANCE_PX && y <= bottom + TOLERANCE_PX) {
      const distance = y < top ? top - y : y > bottom ? y - bottom : 0
      if (distance < nearDistance) {
        nearDistance = distance
        nearIndex = index
      }
    }
  })

  const index = insideIndex >= 0 ? insideIndex : nearIndex
  if (index < 0) return null

  const card = cards[index]
  if (!card) return null

  const top = toPx(card.start)
  const bottom = toPx(card.end)
  const toTop = Math.abs(y - top)
  const toBottom = Math.abs(y - bottom)

  let edge: HitEdge = 'body'
  if (toTop <= EDGE_ZONE_PX || toBottom <= EDGE_ZONE_PX) {
    edge = toTop <= toBottom ? 'start' : 'end'
  }

  return { index, edge }
}
