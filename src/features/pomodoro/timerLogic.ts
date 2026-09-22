export type Mode = 'focus' | 'break'

export const DURATIONS: Record<Mode, number> = {
  focus: 25 * 60,
  break: 5 * 60,
}

export interface TimerState {
  mode: Mode
  running: boolean
  remainingSeconds: number
  /** Epoch ms at which the countdown reaches zero, if left running uninterrupted. */
  endAt: number | null
}

export function createInitialState(mode: Mode = 'focus'): TimerState {
  return { mode, running: false, remainingSeconds: DURATIONS[mode], endAt: null }
}

export function start(state: TimerState, now: number): TimerState {
  if (state.running) return state
  return { ...state, running: true, endAt: now + state.remainingSeconds * 1000 }
}

export function pause(state: TimerState, now: number): TimerState {
  if (!state.running || state.endAt === null) return state
  const { mode, endAt } = advancePhases(state.mode, state.endAt, now)
  return {
    mode,
    running: false,
    endAt: null,
    remainingSeconds: Math.max(0, Math.ceil((endAt - now) / 1000)),
  }
}

export function reset(state: TimerState): TimerState {
  return createInitialState(state.mode)
}

/** Remaining time is always derived from the target timestamp, so it stays
 * accurate even if the browser throttles timers in a backgrounded tab. */
export function computeRemainingSeconds(state: TimerState, now: number): number {
  if (!state.running || state.endAt === null) return state.remainingSeconds
  return Math.max(0, Math.ceil((state.endAt - now) / 1000))
}

/** Advance one phase boundary at a time so overrun carries forward exactly,
 * even when elapsed time spans multiple focus/break phases. */
function advancePhases(mode: Mode, endAt: number, now: number): { mode: Mode; endAt: number } {
  while (now >= endAt) {
    mode = mode === 'focus' ? 'break' : 'focus'
    endAt += DURATIONS[mode] * 1000
  }
  return { mode, endAt }
}

export function tick(state: TimerState, now: number): TimerState {
  if (!state.running || state.endAt === null) return state

  const { mode, endAt } = advancePhases(state.mode, state.endAt, now)

  return {
    mode,
    running: true,
    remainingSeconds: Math.max(0, Math.ceil((endAt - now) / 1000)),
    endAt,
  }
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0')
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0')
  return `${minutes}:${seconds}`
}
