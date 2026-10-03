import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HOME_WIDGETS_STORAGE_KEY,
  defaultWidgetPrefs,
  loadWidgetPrefs,
  normalizeWidgetPrefs,
  saveWidgetPrefs,
} from './homeWidgetPrefs'

const ids = ['a', 'b', 'c', 'd']

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('normalizeWidgetPrefs', () => {
  it('returns source order with nothing hidden for the defaults', () => {
    expect(defaultWidgetPrefs(ids)).toEqual({ order: ['a', 'b', 'c', 'd'], hidden: [] })
  })

  it.each([[null], [undefined], [42], ['a,b'], [[]], [['a']], [{ order: 'a' }], [{ order: {} }]])(
    'falls back to defaults for invalid input %j',
    (raw: unknown) => {
      expect(normalizeWidgetPrefs(raw, ids)).toEqual(defaultWidgetPrefs(ids))
    },
  )

  it('drops unknown and duplicate IDs and appends new tools visible in source order', () => {
    const raw = { order: ['c', 'ghost', 'a', 'c', 7, 'a'], hidden: ['a', 'ghost', 'd', 'a', null] }

    expect(normalizeWidgetPrefs(raw, ids)).toEqual({ order: ['c', 'a', 'b', 'd'], hidden: ['a'] })
  })

  it('treats a non-array hidden list as nothing hidden', () => {
    expect(normalizeWidgetPrefs({ order: ['b', 'a', 'c', 'd'], hidden: 'b' }, ids)).toEqual({
      order: ['b', 'a', 'c', 'd'],
      hidden: [],
    })
  })
})

describe('loadWidgetPrefs / saveWidgetPrefs', () => {
  it('round-trips through one versioned localStorage key', () => {
    expect(saveWidgetPrefs({ order: ['d', 'c', 'b', 'a'], hidden: ['c'] })).toBe(true)

    expect(Object.keys(localStorage)).toEqual([HOME_WIDGETS_STORAGE_KEY])
    expect(HOME_WIDGETS_STORAGE_KEY).toMatch(/v\d+/)
    expect(loadWidgetPrefs(ids)).toEqual({ order: ['d', 'c', 'b', 'a'], hidden: ['c'] })
  })

  it('ignores malformed JSON', () => {
    localStorage.setItem(HOME_WIDGETS_STORAGE_KEY, '{not json')

    expect(loadWidgetPrefs(ids)).toEqual(defaultWidgetPrefs(ids))
  })

  it('recovers to defaults when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })

    expect(loadWidgetPrefs(ids)).toEqual(defaultWidgetPrefs(ids))
    expect(saveWidgetPrefs(defaultWidgetPrefs(ids))).toBe(false)
  })
})
