import Link from "next/link";

interface SidebarProps {
  activePage?: "dashboard" | "portfolio";
}

export function Sidebar({ activePage = "dashboard" }: SidebarProps) {
  return (
    <>
      {/* Mobile header */}
      <div className="mobile-header">
        <button className="mobile-menu-btn" id="mobile-menu-toggle" aria-label="Menü">
          ☰
        </button>
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Portföy Takip</span>
      </div>

      {/* Overlay */}
      <div className="sidebar-overlay" id="sidebar-overlay" />

      {/* Sidebar */}
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">📊</div>
            <span>Portföy Takip</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <Link
            href="/"
            className={`sidebar-link ${activePage === "dashboard" ? "active" : ""}`}
          >
            <span className="sidebar-link-icon">🏠</span>
            Dashboard
          </Link>
        </nav>

        <div className="sidebar-footer">
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="btn btn-secondary btn-sm w-full">
              Çıkış Yap
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

export function AppLayout({
  children,
  activePage,
}: {
  children: React.ReactNode;
  activePage?: "dashboard" | "portfolio";
}) {
  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} />
      <main className="main-content">{children}</main>
    </div>
  );
}
