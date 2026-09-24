export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type Placed<T> = T & Rect

// Worst aspect ratio in a row of areas laid along a side of the given length.
function worstRatio(areas: number[], side: number): number {
  const sum = areas.reduce((total, area) => total + area, 0)
  const max = Math.max(...areas)
  const min = Math.min(...areas)
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
}

/**
 * Squarified treemap (Bruls, Huizing & van Wijk): places items in `rect` with areas proportional
 * to `value`, keeping tiles as close to square as possible. Items with no value are dropped.
 */
export function squarify<T extends { value: number }>(items: T[], rect: Rect): Placed<T>[] {
  const sorted = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value)
  const total = sorted.reduce((sum, item) => sum + item.value, 0)
  if (total === 0 || rect.width <= 0 || rect.height <= 0) return []

  const scale = (rect.width * rect.height) / total
  const placed: Placed<T>[] = []
  let free = { ...rect }
  let row: T[] = []

  const layoutRow = (rowItems: T[]) => {
    const areas = rowItems.map((item) => item.value * scale)
    const rowArea = areas.reduce((sum, area) => sum + area, 0)
    const horizontal = free.width >= free.height // lay the row along the shorter side
    if (horizontal) {
      const width = rowArea / free.height
      let y = free.y
      rowItems.forEach((item, index) => {
        const height = areas[index] / width
        placed.push({ ...item, x: free.x, y, width, height })
        y += height
      })
      free = { x: free.x + width, y: free.y, width: free.width - width, height: free.height }
    } else {
      const height = rowArea / free.width
      let x = free.x
      rowItems.forEach((item, index) => {
        const width = areas[index] / height
        placed.push({ ...item, x, y: free.y, width, height })
        x += width
      })
      free = { x: free.x, y: free.y + height, width: free.width, height: free.height - height }
    }
  }

  for (const item of sorted) {
    const side = Math.min(free.width, free.height)
    const current = row.map((rowItem) => rowItem.value * scale)
    const next = [...current, item.value * scale]
    if (row.length === 0 || worstRatio(next, side) <= worstRatio(current, side)) {
      row.push(item)
    } else {
      layoutRow(row)
      row = [item]
    }
  }
  if (row.length > 0) layoutRow(row)
  return placed
}
