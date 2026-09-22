import { useEffect, useRef, useState } from 'react'
import ToolPageHeader from '../../components/ToolPageHeader'
import { findToolByPath } from '../../app/tools'
import { createInitialState, formatTime, pause, reset, start, tick, type TimerState } from './timerLogic'

const MODE_LABEL = { focus: '專注', break: '休息' } as const
const tool = findToolByPath('/tools/pomodoro')!

export default function PomodoroTool() {
  const [state, setState] = useState<TimerState>(() => createInitialState('focus'))
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (!state.running) return

    const intervalId = window.setInterval(() => {
      setState((current) => tick(current, Date.now()))
    }, 250)

    return () => window.clearInterval(intervalId)
  }, [state.running])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && stateRef.current.running) {
        setState((current) => tick(current, Date.now()))
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return (
    <>
      <ToolPageHeader title={tool.name} description={tool.shortDescription} />
      <div className="panel pomodoro">
        <div className="pomodoro-mode-tabs" role="group" aria-label="番茄鐘模式">
          {(['focus', 'break'] as const).map((mode) => (
            <span
              key={mode}
              aria-current={state.mode === mode ? 'true' : undefined}
              data-active={state.mode === mode}
              className="pomodoro-mode-tab"
            >
              {MODE_LABEL[mode]}
            </span>
          ))}
        </div>

        <p className="pomodoro-time" data-mode={state.mode}>
          {formatTime(state.remainingSeconds)}
        </p>

        <div className="btn-row">
          {state.running ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setState((current) => pause(current, Date.now()))}
            >
              暫停
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setState((current) => start(current, Date.now()))}
            >
              開始
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => setState((current) => reset(current))}>
            重設
          </button>
        </div>
      </div>
    </>
  )
}
