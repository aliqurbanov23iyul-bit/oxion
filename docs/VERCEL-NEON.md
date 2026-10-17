# Vercel + Neon — OXION sınaq yerləşdirməsi

Bu fayllar yerləşdirməyə hazırlanıb. Bu sənədin hazırlanması saytı yayımlamır. Real pul hərəkəti, birja icrası və custody aktiv deyil.

## 1. Layihəni Vercel-ə import etmək

1. Layihəni şəxsi GitHub repozitoriyasına yerləşdirin. `.env`, `.local`, `.vercel` və açarlar Git-ə daxil edilməməlidir.
2. Vercel-də həmin repozitoriyanı import edin. Root Directory layihənin kökü olsun — `public` və ya `server` seçməyin.
3. Framework Preset **Express**, Node.js **24.x**, Install Command `npm ci`, Build Command `npm run check`. Output Directory-ni əl ilə `public` etməyin; standart saxlayın.
4. Vercel daxilində Storage/Marketplace-dən Neon qoşun. Yalnız bu layihənin sınağı üçün ayrıca Neon bazası/branch seçin. Mövcud maliyyə bazasını preview deployment-ə bağlamayın.

## 2. Dəyişənləri daxil etmək

Project → Settings → Environment Variables. İlk mərhələdə yalnız seçdiyiniz sınaq deployment mühitinə tətbiq edin.

| Ad | Haradan alınır / dəyər |
| --- | --- |
| `DATABASE_URL` | Neon pooled PostgreSQL URL-si. Hostda `-pooler` olur. SSL parametrlərini saxlayın. Neon başqa prefiksli dəyişən yaradıbsa, onun pooled dəyərini bu ada da əlavə edin. |
| `APP_ORIGIN` | Seçilmiş sabit sayt ünvanı: `https://LAYIHE.vercel.app`. Sonda `/` və səhifə yolu yoxdur. |
| `ENCRYPTION_KEY` | Yeni, təmiz baza üçün `npm run key:generate` ilə kompüterinizdə yaradılan 64 simvolluq hex açar. Eyni baza üçün sabit saxlayın. |
| `ENABLE_BINANCE_TESTNET` | `false`. Vercel veb tətbiqində worker başlamır. |

Məxfi dəyişənləri Sensitive kimi saxlayın. Heç bir açara `VITE_`, `NEXT_PUBLIC_` və ya başqa brauzer prefiksi əlavə etməyin. `PORT` və `LOCAL_DATABASE_PATH` Vercel-də lazım deyil.

Preview və Production ayrı Neon branch-ləri, ayrı açarlar və uyğun `APP_ORIGIN` ilə işləməlidir. Dəyişən preview URL-lərinə uyğunlaşmaq üçün Origin yoxlamasını açmayın: sınaq üçün sabit branch alias seçin və həmin URL-ni `APP_ORIGIN` edin. Bütün origin-ləri qəbul edən wildcard yoxdur. Git branch-in adı Vercel UI-də Production olsa belə OXION real pul rejiminə keçmir.

## 3. Neon sxemini bir dəfə qurmaq

Build zamanı bazaya DDL göndərilmir. Serverless instansiyalar sxemi dəyişmir. Seçilmiş sınaq bazasında sxemi yerli etibarlı terminaldan qurun:

1. `.env.example` faylını `.env` adına kopyalayın.
2. `.env` daxilində `DATABASE_URL_UNPOOLED` dəyərinə Neon-un **direct / unpooled** URL-sini yazın. Bu URL-ni repozitoriyaya və ya çata göndərməyin.
3. Eyni faylda `MIGRATION_ACK=OXION_TEST_ONLY` yazın. Bu, düzgün sınaq bazasını seçdiyinizi təsdiqləyir.
4. `npm.cmd run db:migrate` başladın.
5. Uğurlu nəticədən sonra Vercel-də deployment-i yeniləyin.

Miqrasiya bir PostgreSQL tranzaksiyasında və advisory lock altında işləyir. Mövcud istifadəçi və maliyyə qeydləri silinmir. Xəta olsa tranzaksiya geri qaytarılır. `DATABASE_URL_UNPOOLED` və `MIGRATION_ACK` veb tətbiqə lazım deyil; onları yalnız miqrasiya terminalında saxlamaq olar. Sxem marker-i yoxdursa API 503 qaytarır. Lokal embedded baza yenə avtomatik hazırlanır; istənilən uzaq PostgreSQL üçün əvvəl explicit miqrasiya lazımdır.

Bu addım yerli istifadəçiləri Neon-a köçürmür. Neon ayrıca boş sınaq bazasıdır. Köçürmə istənilərsə ayrıca backup/export/import və ledger reconciliation aparılmalı, TOTP məlumatları üçün əvvəlki `ENCRYPTION_KEY` qorunmalıdır.

## 4. E-poçt və Google

SMTP üçün `SMTP_HOST`, `SMTP_PORT` (587 və ya 465), `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` əlavə edin. Göndərən domeni provayderdə təsdiqləyin. SMTP olmadan HTTPS mühitində məktub diskə yazılmır və göndərilmiş kimi göstərilmir.

Google üçün `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` əlavə edin. Redirect URI dəqiq `APP_ORIGIN` + `/api/auth/google/callback` olmalıdır. Bu ünvan Google Console-da da qeyd edilməlidir. Secret brauzerə verilmir. Hesab seçimi, OAuth state və mövcud TOTP qorunur.

Sosial hesablar üçün istəyə görə `INSTAGRAM_URL`, `TIKTOK_URL`, `TELEGRAM_URL` — həqiqi HTTPS hesab ünvanları.

## 5. Yoxlama

- Yerləşdirmədən əvvəl: `npm.cmd run check`, `npm.cmd test`.
- Yerli `.env`-də hostinq dəyərləri ilə: `npm.cmd run check:hosting`. Bu əmr yalnız konfiqurasiyanı yoxlayır, Neon-a qoşulmur və yayım etmir.
- Yerləşdirmə sonrası: `/api/status`, `/api/me`, qeydiyyat → həqiqi təsdiq məktubu → giriş → TOTP, dəstək müraciəti və çıxış.
- Qonaq üçün `/admin`, `/admin/`, `/admin/index.html` 401 olmalıdır. Admin HTML CDN qovluğunda deyil; rol və TOTP serverdə yoxlanılır.
- Admin yaratmaq üçün yerli şəxsi terminalda `.env`-də həmin sınaq `DATABASE_URL` və eyni `ENCRYPTION_KEY` ilə `npm.cmd run admin`. Parol və TOTP-ni paylaşmayın. Bu CLI production provisioning prosesi kimi təsdiqlənməyib.

## Texniki quruluş və sərhədlər

- Kök `app.js`: Vercel üçün Express default export, port açmır. Bir warm instansiyada bir DB pool (maksimum 3 bağlantı), təkrar istifadə edilən init promise. Config/sxem yoxdursa 503; driver məxfi məlumatları cavaba yazılmır.
- `server/index.js`: yalnız yerli `npm start`, əvvəlki localhost axını saxlanır.
- `server/views/admin.html`: qorunan sənəd. `public` yalnız ictimai HTML və asset-lərdir.
- Sessiya, CSRF və maliyyə jurnalı Neon-da; rate limit atomik PostgreSQL UPSERT ilə bütün instansiyalarda paylaşılır. Vercel-in təyin etdiyi `x-real-ip` istifadə olunur; tətbiqi başqa proxy-də yerləşdirəcəksinizsə bu qayda ayrıca dəyişdirilməlidir.
- `request_limits` texniki cədvəlində vaxtı keçmiş sayğaclar üçün `npm run db:cleanup` əmri var. Bunu vaxtaşırı etibarlı terminaldan işlətmək olar. Maliyyə jurnalı təmizlənmir.
- Testnet worker ayrıca uzunömürlü prosesdir; Vercel HTTP sorğusunda, build-də və ya interval ilə işə salınmır. Real ticarət/depozit/çıxarış aktivləşdirilmir.
- Neon/Vercel hesabları və açarları bu mühitə qoşulmayıb. Həqiqi Neon SQL, Vercel build/deployment, SMTP və Google E2E testləri aparılmayıb. Yerli avtomatik testlər hosted konfiqurasiyanı, routing-i və paylaşılan limiter SQL-ni embedded PostgreSQL ilə yoxlayır; bu, cloud deployment sübutu deyil.

Rəsmi istinadlar: [Vercel Express](https://vercel.com/docs/frameworks/backend/express), [Neon pooling](https://neon.com/docs/connect/connection-pooling), [Vercel environment variables](https://vercel.com/docs/environment-variables).
