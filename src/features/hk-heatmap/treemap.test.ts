import { describe, expect, it } from 'vitest'
import { squarify } from './treemap'

const rect = { x: 10, y: 20, width: 600, height: 400 }

describe('squarify', () => {
  const items = [6, 6, 4, 3, 2, 2, 1].map((value, index) => ({ id: index, value }))
  const placed = squarify(items, rect)

  it('gives every item an area proportional to its value', () => {
    const total = 24
    for (const tile of placed) {
      expect(tile.width * tile.height).toBeCloseTo((tile.value / total) * rect.width * rect.height, 6)
    }
  })

  it('fills the rectangle without leaving it', () => {
    const area = placed.reduce((sum, tile) => sum + tile.width * tile.height, 0)
    expect(area).toBeCloseTo(rect.width * rect.height, 6)
    for (const tile of placed) {
      expect(tile.x).toBeGreaterThanOrEqual(rect.x - 1e-9)
      expect(tile.y).toBeGreaterThanOrEqual(rect.y - 1e-9)
      expect(tile.x + tile.width).toBeLessThanOrEqual(rect.x + rect.width + 1e-9)
      expect(tile.y + tile.height).toBeLessThanOrEqual(rect.y + rect.height + 1e-9)
    }
  })

  it('does not overlap tiles', () => {
    for (const a of placed) {
      for (const b of placed) {
        if (a === b) continue
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
        expect(overlapX > 1e-9 && overlapY > 1e-9).toBe(false)
      }
    }
  })

  it('keeps tiles reasonably square', () => {
    for (const tile of placed) {
      expect(Math.max(tile.width / tile.height, tile.height / tile.width)).toBeLessThan(4)
    }
  })

  it('drops empty values and handles empty input', () => {
    expect(squarify([{ value: 0 }, { value: 5 }], rect)).toHaveLength(1)
    expect(squarify([], rect)).toEqual([])
    expect(squarify([{ value: 1 }], { x: 0, y: 0, width: 0, height: 10 })).toEqual([])
  })
})
