/**
 * Faz 0/1 iskelet dashboard'u. Faz 3-4'te gerçek TWR/XIRR verisiyle,
 * dağılım grafiğiyle ve fiyat tazelik rozetleriyle doldurulacak.
 */
export default function DashboardPage() {
  return (
    <main>
      <h1>Portföy Takip</h1>
      <p>
        Backend/mimari iskeleti kuruldu: Supabase + fiyat cron altyapısı + TWR/XIRR
        hesap motoru (<code>@portfoy/core</code>) hazır ve test edildi.
      </p>
      <p>Sıradaki adım: Supabase şemasının uygulanması ve gerçek portföy verisiyle bağlanma.</p>
    </main>
  );
}
