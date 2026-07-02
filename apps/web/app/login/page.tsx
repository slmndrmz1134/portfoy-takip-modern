import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="login-container">
      <div className="login-card animate-in">
        <div className="login-logo">
          <div className="login-logo-icon">📊</div>
          <h1 className="login-title">Portföy Takip</h1>
          <p className="login-subtitle">Yatırımlarını güvenilir verilerle takip et</p>
        </div>

        {message && (
          <div className="login-message success" style={{ marginBottom: '1rem' }}>
            ✓ {message}
          </div>
        )}
        {error && (
          <div className="login-message error" style={{ marginBottom: '1rem' }}>
            ✕ {error}
          </div>
        )}

        <form className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email">E-posta</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="form-input"
              placeholder="ornek@email.com"
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Şifre</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="form-input"
              placeholder="En az 6 karakter"
              autoComplete="current-password"
            />
          </div>
          <div className="login-actions">
            <button formAction={signIn} className="btn btn-primary">
              Giriş Yap
            </button>
            <button formAction={signUp} className="btn btn-secondary">
              Kayıt Ol
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
