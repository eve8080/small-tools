import { Link, Outlet } from 'react-router-dom'
import FullscreenButton from '../components/FullscreenButton'

export default function AppShell() {
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        跳至主要內容
      </a>
      <header className="shell-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            🧰
          </span>
          <span>Small Tools 工具箱</span>
        </Link>
        <FullscreenButton />
      </header>
      <main id="main-content" className="shell-main">
        <Outlet />
      </main>
      <footer className="shell-footer">
        <p>Small Tools · 簡單好用的網頁小工具</p>
      </footer>
    </div>
  )
}
