import { Link, NavLink, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-semibold tracking-wide text-ink">
            Prequal
          </Link>
          <nav className="flex gap-4 text-sm font-medium text-steel">
            <NavLink to="/" className="hover:text-signal">
              Dashboard
            </NavLink>
            <NavLink to="/projects" className="hover:text-signal">
              Projects
            </NavLink>
            <NavLink to="/cert-portal" className="hover:text-signal">
              Cert Portal
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
