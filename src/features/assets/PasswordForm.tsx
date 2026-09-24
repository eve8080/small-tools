import { useState, type FormEvent } from 'react'

interface PasswordFormProps {
  onUnlock: (password: string) => void
  error?: string
  id?: string
  submitLabel?: string
}

export default function PasswordForm({
  onUnlock,
  error,
  id = 'assets-password',
  submitLabel = '顯示資產',
}: PasswordFormProps) {
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password) onUnlock(password)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor={id} className="field-label">
          密碼
        </label>
        <input
          id={id}
          type="password"
          autoComplete="current-password"
          className="field-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="field-hint">密碼只會儲存在此裝置的瀏覽器中。</p>
      </div>
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={!password}>
          {submitLabel}
        </button>
      </div>
      {error && (
        <p className="status-message status-message--error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
