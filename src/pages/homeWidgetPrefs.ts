/** Home dashboard widget order/visibility, stored per browser. Holds tool IDs only. */
export const HOME_WIDGETS_STORAGE_KEY = 'small-tools.home-widgets.v1'

export interface WidgetPrefs {
  /** Every registered tool ID, in display order. */
  order: string[]
  /** IDs of tools hidden from the dashboard. */
  hidden: string[]
}

export function defaultWidgetPrefs(toolIds: readonly string[]): WidgetPrefs {
  return { order: [...toolIds], hidden: [] }
}

function knownIds(value: unknown, toolIds: readonly string[]): string[] {
  if (!Array.isArray(value)) return []
  const known = new Set(toolIds)
  const ids = new Set<string>()
  for (const id of value) {
    if (typeof id === 'string' && known.has(id)) ids.add(id)
  }
  return [...ids]
}

/**
 * Turns untrusted stored data into valid preferences: unknown and duplicate IDs are dropped,
 * and tools missing from the stored order (e.g. newly added ones) are appended visible.
 */
export function normalizeWidgetPrefs(raw: unknown, toolIds: readonly string[]): WidgetPrefs {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return defaultWidgetPrefs(toolIds)
  }
  const stored = raw as Record<string, unknown>
  if (!Array.isArray(stored.order)) return defaultWidgetPrefs(toolIds)

  const order = knownIds(stored.order, toolIds)
  const storedIds = new Set(order)
  const hidden = knownIds(stored.hidden, toolIds).filter((id) => storedIds.has(id))
  order.push(...toolIds.filter((id) => !storedIds.has(id)))
  return { order, hidden }
}

export function loadWidgetPrefs(toolIds: readonly string[]): WidgetPrefs {
  try {
    const stored = window.localStorage.getItem(HOME_WIDGETS_STORAGE_KEY)
    return normalizeWidgetPrefs(stored === null ? null : JSON.parse(stored), toolIds)
  } catch {
    return defaultWidgetPrefs(toolIds)
  }
}

/** Returns false when storage is unavailable; the in-memory preferences still apply. */
export function saveWidgetPrefs(prefs: WidgetPrefs): boolean {
  try {
    window.localStorage.setItem(HOME_WIDGETS_STORAGE_KEY, JSON.stringify(prefs))
    return true
  } catch {
    return false
  }
}
