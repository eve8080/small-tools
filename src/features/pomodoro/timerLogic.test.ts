import { describe, expect, it } from 'vitest'
import { createInitialState, DURATIONS, formatTime, pause, reset, start, tick } from './timerLogic'

describe('createInitialState', () => {
  it('defaults to focus mode with the full focus duration, not running', () => {
    const state = createInitialState()
    expect(state).toEqual({
      mode: 'focus',
      running: false,
      remainingSeconds: DURATIONS.focus,
      endAt: null,
    })
  })

  it('can start in break mode with the full break duration', () => {
    const state = createInitialState('break')
    expect(state.mode).toBe('break')
    expect(state.remainingSeconds).toBe(DURATIONS.break)
  })
})

describe('start', () => {
  it('marks the timer as running and sets endAt based on remaining time', () => {
    const now = 1_000_000
    const state = createInitialState('focus')
    const started = start(state, now)

    expect(started.running).toBe(true)
    expect(started.endAt).toBe(now + DURATIONS.focus * 1000)
  })

  it('is a no-op when already running', () => {
    const now = 1_000_000
    const state = start(createInitialState('focus'), now)
    const startedAgain = start(state, now + 5000)

    expect(startedAgain).toEqual(state)
  })
})

describe('pause', () => {
  it('freezes remainingSeconds based on elapsed time since start', () => {
    const now = 1_000_000
    const running = start(createInitialState('focus'), now)

    const paused = pause(running, now + 10_000)

    expect(paused.running).toBe(false)
    expect(paused.endAt).toBeNull()
    expect(paused.remainingSeconds).toBe(DURATIONS.focus - 10)
  })

  it('is a no-op when already paused', () => {
    const state = createInitialState('focus')
    expect(pause(state, 1_000_000)).toEqual(state)
  })

  it('advances mode and carries overrun when paused after a single phase boundary', () => {
    const now = 1_000_000
    const running = start(createInitialState('focus'), now)
    const boundary = now + DURATIONS.focus * 1000
    const overrunMs = 1_234

    const paused = pause(running, boundary + overrunMs)

    expect(paused.running).toBe(false)
    expect(paused.endAt).toBeNull()
    expect(paused.mode).toBe('break')
    expect(paused.remainingSeconds).toBe(DURATIONS.break - 1)
  })

  it('advances through many consecutive phase boundaries when paused', () => {
    const now = 1_000_000
    const running = start(createInitialState('break'), now)
    // Skip break -> focus -> break -> focus, landing 10s into the following break.
    const elapsedMs = (DURATIONS.break + DURATIONS.focus + DURATIONS.break + DURATIONS.focus + 10) * 1000

    const paused = pause(running, now + elapsedMs)

    expect(paused.running).toBe(false)
    expect(paused.endAt).toBeNull()
    expect(paused.mode).toBe('break')
    expect(paused.remainingSeconds).toBe(DURATIONS.break - 10)
  })
})

describe('reset', () => {
  it('restores the full duration for the current mode and stops running', () => {
    const now = 1_000_000
    const running = start(createInitialState('focus'), now)
    const ticked = pause(running, now + 60_000)

    const result = reset(ticked)

    expect(result).toEqual({
      mode: 'focus',
      running: false,
      remainingSeconds: DURATIONS.focus,
      endAt: null,
    })
  })
})

describe('tick', () => {
  it('derives remaining time from the timestamp, not from call frequency', () => {
    const now = 1_000_000
    const running = start(createInitialState('focus'), now)

    // Simulate a single tick call after a long throttled gap (e.g. backgrounded tab).
    const ticked = tick(running, now + 61_000)

    expect(ticked.remainingSeconds).toBe(DURATIONS.focus - 61)
    expect(ticked.mode).toBe('focus')
  })

  it('switches from focus to break once remaining time reaches zero', () => {
    const now = 1_000_000
    const running = start(createInitialState('focus'), now)

    const ticked = tick(running, now + DURATIONS.focus * 1000)

    expect(ticked.mode).toBe('break')
    expect(ticked.running).toBe(true)
    expect(ticked.remainingSeconds).toBe(DURATIONS.break)
    expect(ticked.endAt).toBe(now + DURATIONS.focus * 1000 + DURATIONS.break * 1000)
  })

  it('switches from break back to focus once remaining time reaches zero', () => {
    const now = 1_000_000
    const running = start(createInitialState('break'), now)

    const ticked = tick(running, now + DURATIONS.break * 1000 + 500)

    expect(ticked.mode).toBe('focus')
    expect(ticked.remainingSeconds).toBe(DURATIONS.focus)
  })

  it('does not change state when not running', () => {
    const state = createInitialState('focus')
    expect(tick(state, 1_000_000)).toEqual(state)
  })

  it('preserves the exact phase boundary when scheduling the next endAt, instead of drifting by the overrun', () => {
    const now = 1_000_000
    const running = start(createInitialState('focus'), now)
    const boundary = now + DURATIONS.focus * 1000
    const overrunMs = 1_234

    const ticked = tick(running, boundary + overrunMs)

    expect(ticked.mode).toBe('break')
    expect(ticked.endAt).toBe(boundary + DURATIONS.break * 1000)
  })

  it('accounts for elapsed time spanning multiple phase boundaries in a single tick', () => {
    const now = 1_000_000
    const running = start(createInitialState('focus'), now)
    // Elapse through the entire focus phase, the entire break phase, and 40s into the next focus phase.
    const elapsedMs = (DURATIONS.focus + DURATIONS.break + 40) * 1000

    const ticked = tick(running, now + elapsedMs)

    expect(ticked.mode).toBe('focus')
    expect(ticked.running).toBe(true)
    expect(ticked.remainingSeconds).toBe(DURATIONS.focus - 40)
    expect(ticked.endAt).toBe(now + (DURATIONS.focus + DURATIONS.break + DURATIONS.focus) * 1000)
  })

  it('accounts for elapsed time spanning many consecutive phase boundaries', () => {
    const now = 1_000_000
    const running = start(createInitialState('break'), now)
    // Skip break -> focus -> break -> focus, landing 10s into the following break.
    const elapsedMs = (DURATIONS.break + DURATIONS.focus + DURATIONS.break + DURATIONS.focus + 10) * 1000

    const ticked = tick(running, now + elapsedMs)

    expect(ticked.mode).toBe('break')
    expect(ticked.remainingSeconds).toBe(DURATIONS.break - 10)
  })
})

describe('formatTime', () => {
  it('formats seconds as mm:ss', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(5)).toBe('00:05')
    expect(formatTime(65)).toBe('01:05')
    expect(formatTime(DURATIONS.focus)).toBe('25:00')
  })
})
