# OXION — Qalxacaq / Düşəcək demo terminalı

Node.js 24, PostgreSQL, ayrıca HTML səhifələri və vanilla JavaScript. Hesab, UID, Google girişi, e-poçt və TOTP sistemi saxlanıb. Yeni demo balansları əvvəlki kripto balansından tam ayrıdır.

Ana səhifə və hesab bölmələri OXION brend üslubundadır. Header/profil/pul kisəsi əsas USDT balansını göstərir; trade.html daxilində demo və əsas hesab seçilir. Əsas hesabın seçilməsi real əməliyyatı aktivləşdirmir. [İnterfeys yoxlama hesabatı](docs/UI-REVIEW.md).

## Yerli başlatma

Layihə qovluğunda:

```powershell
npm.cmd ci
npm.cmd start
```

[Terminalı açın](http://localhost:4317/trade.html). Eyni bazanı açan əvvəlki serveri əvvəl dayandırın. Yerli PGlite PostgreSQL bazası ilk startda avtomatik yenilənir; mövcud qeydlər silinmir. Məlumat qovluğu terminalda göstərilir. İlk qeydiyyatdan sonra hesabı təsdiqləyib daxil olun. SMTP yoxdursa təsdiq məktubu yalnız yerli `.local/mail` qovluğunda saxlanır.

Hər hesab üçün birdəfəlik $10,000 virtual balans ayrılır. Pul çıxarmaq və depozit əməliyyatları deaktivdir. Bütün 8 aktiv **simulyasiya qiymətləri** ilə işləyir; real qiymət provayderi bağlı deyil. İlk saniyələrdə qrafik real qeydə alınan demo qiymətləri ilə dolur, keçmiş qiymətlər uydurulmur.

`npm.cmd test` — hesab, maliyyə və demo nəticə testləri. `npm.cmd run check` — JS/HTML və boş env şablonu yoxlaması. `npm.cmd run smoke` — işləyən serverin səhifə/API yoxlaması.

## Neon və Vercel

Mövcud Neon bazasında yalnız yeni modul üçün `docs/directional-demo.sql` faylını işlədin. Tam yeni baza üçün `npm.cmd run db:migrate` tam sxemi qurur. Production backup və əvvəl ayrı Neon branch üzərində yoxlama tələb olunur. SQL istifadəçi və köhnə maliyyə qeydlərini silmir.

Vercel HTTP tətbiqini işlədir. **250 ms qiymət işçisi Vercel funksiyasında işlədilmir.** Eyni Neon bazasına qoşulmuş davamlı Node prosesi üçün `npm.cmd run worker:demo` başladılmalıdır. İşçi qoşulmayıbsa qiymət axını qeyri-aktiv görünür və əməliyyat açmaq bloklanır. Dəqiqəlik cron 3/5 saniyəlik əməliyyatlar üçün uyğun deyil.

`.env.example` dəyərlərsizdir. Serverdə DATABASE_URL, APP_ORIGIN və ENCRYPTION_KEY tələb olunur; Google/SMTP üçün mövcud parametrlər saxlanılır. İşçi yalnız DATABASE_URL tələb edir. Heç bir açarı frontendə yerləşdirməyin. Real pul rejimini aktivləşdirən dəyişən və ya düymə yoxdur.

[Hesablama və qiymət qaydaları](docs/DIRECTIONAL-DEMO.md) · [Real versiya üçün qalan işlər](docs/PRODUCTION-DIRECTIONAL.md) · [Əvvəlki spot modul sənədi — arxiv](docs/legacy-spot-README.md)
