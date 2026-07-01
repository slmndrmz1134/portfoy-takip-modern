import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main style={{ maxWidth: 360 }}>
      <h1>Portföy Takip — Giriş</h1>
      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <form style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label>
          E-posta
          <input name="email" type="email" required style={{ width: "100%" }} />
        </label>
        <label>
          Şifre
          <input name="password" type="password" required minLength={6} style={{ width: "100%" }} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button formAction={signIn}>Giriş yap</button>
          <button formAction={signUp}>Kayıt ol</button>
        </div>
      </form>
    </main>
  );
}
