-- Faz 2: Kullanıcı yeni bir sembol (enstrüman) eklediğinde (ör. henüz kataloğa
-- girmemiş bir hisse alırken) instruments tablosuna INSERT edebilmeli.
-- Bu paylaşımlı bir katalog (fiyat bilgisi içermez, hassas değildir) — bu yüzden
-- herhangi bir giriş yapmış (authenticated) kullanıcının eklemesine izin veriyoruz.
create policy "authenticated_insert_instruments" on instruments
  for insert to authenticated with check (true);
