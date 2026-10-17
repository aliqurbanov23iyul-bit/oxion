# OXION — yerli spot ticarət sınaq platforması

**Real pul hərəkəti, real birja icrası və ictimai yayım aktiv deyil.** Loqo istifadəçinin təqdim etdiyi orijinal fayldır. İnterfeys HTML/CSS/vanilla JavaScript, backend Node.js, maliyyə bazası PostgreSQL-dir. Quraşdırma olmadan yerli istifadə üçün PGlite embedded PostgreSQL mühərriki işləyir.

## Başlatma

Node.js 24.x tələb olunur. Layihə qovluğunda:

```powershell
npm.cmd ci
npm.cmd start
```

[Yerli OXION-u açın](http://localhost:4317). Server yalnız `127.0.0.1`-də dinləyir. Faylları birbaşa `file://` ilə açmayın.

İlk start bazanı və TOTP şifrələmə açarını Windows-da `%LOCALAPPDATA%/OXION/<layihə-id>/` daxilində yaradır. Dəqiq yol terminalda göstərilir. Bu seçim OneDrive-ın qovluqları readonly kimi işarələməsindən yaranan PostgreSQL VFS problemini aradan qaldırır. `LOCAL_DATABASE_PATH` ilə başqa yol verilə bilər; sinxronlaşdırılan/readonly qovluq seçməyin. Eyni embedded bazanı iki proses açmasın. TOTP açarını bazanın backup-ı ilə birlikdə məxfi saxlayın.

`.env.example` daxilində bütün dəyərlər boşdur. İstəyə görə `.env`-ə kopyalayın. `PORT` dəyişirsə, uyğun `APP_ORIGIN` də təyin edin. Məsələn origin brauzerdə istifadə olunan host və portla tam uyğun olmalıdır; `localhost` və `127.0.0.1` eyni origin deyil.

### Qeydiyyatı yerli tamamlamaq

1. `signup.html`-də hesab yaradın. Şifrə 8–128 simvol olmalıdır.
2. SMTP qoşulmayıbsa məktub həqiqətən göndərilmir. `.local/mail` içində ən yeni HTML faylını açıb **“Hesabınızı təsdiqləyin”** düyməsini basın.
3. Link 30 dəqiqə ərzində bir dəfə işləyir. Sonra `login.html`-dən daxil olun.
4. `security.html`-də TOTP qurun. Profil səhifəsində UID və kopyalama düyməsi var.
5. Şifrə bərpası da SMTP yoxdursa eyni lokal məktub qovluğunda önizləmə yaradır.

Yerli məktub faylları giriş tokenləri daşıyır. Sınaq bitəndə onları təmizləyin; qovluğu paylaşmayın. Avtomatik testlər `.invalid` ünvanlı məktub nümunələri də yaradır, bunlar istifadəçi hesabı deyil.

### Admin

Əvvəl serveri `Ctrl+C` ilə dayandırın:

```powershell
npm.cmd run admin
```

Email və şifrə daxil edin, göstərilən TOTP açarını authenticator-a əlavə edin və cari kodu yazın. Şifrə daxil edilərkən gizlədilir; TOTP açarı göstərildiyi üçün şəxsi terminaldan istifadə edin. Sonra `npm.cmd start`, `login.html` və [admin bölməsi](http://localhost:4317/admin/).

Admin rolu sessiyada təkbaşına kifayət etmir: TOTP aktiv olmalıdır və girişdə kod tələb edilir. UID/email axtarışı, balans düzəlişi, audit, depozit/çıxarış izləmə, sınaq icrası, müraciətlərə cavab və kampaniya JSON redaktoru var.

Balans düzəlişi `manual` hesabına yazılır, **çıxarıla bilən balans yaratmır**. Səbəb məcburidir, məbləğ müsbət və ya mənfi ola bilər, hesab mənfiyə düşə bilməz. Qarşı hesab və əvvəl/sonra məbləğləri dəyişməyən jurnalda saxlanır.

### Əmr və çıxarış axınını sınaqdan keçirmək

Sınaq vəsaiti həqiqi depozitdən ayrıca `test_funding` kimi qeydə alınır. Standart CLI yalnız embedded yerli bazada işləyir. PostgreSQL üçün yalnız `oxion_testnet` adlı izolyasiya edilmiş sınaq bazası, `ENABLE_BINANCE_TESTNET=true`, `TESTNET_DATABASE_ACK=OXION_TESTNET_ONLY` və ayrıca `--postgres-sandbox` arqumenti birlikdə qəbul olunur. Bu vəsait real depozit deyil. Serveri dayandırın:

```powershell
npm.cmd run fund:test -- your-local-test-email@example.invalid 1000
npm.cmd start
```

Sınaq USDT ilə market/limit əmri yaradın. Təsdiq pəncərəsində komissiya və yekun məbləğ serverdə decimal ilə hesablanır. 30 saniyəlik quote köhnəlibsə və ya market qiyməti dəyişibsə yeni təsdiq tələb olunur. Əmr **open** qalır; birjada icra edilməyib. Admin → Əmrlər bölməsində həmin ID, miqdar və qiymətlə sınaq doldurması yaradın. Az miqdar qismən icra edir; qalan hissə istifadəçi tərəfindən ləğv oluna bilər. Təkrar execution ID yenidən hesablaşdırılmır. Bu mexanizm real likvidlik və ya bazar order matching iddiası deyil.

Çıxarış yalnız USDT/ETH-SEPOLIA sınaq sorğusudur. TOTP, minimum və mövcud balans serverdə yoxlanılır; məbləğ + 1 USDT komissiya rezerv edilir. Admin rədd edəndə rezerv açılır. **Göndərmə və tamamlama aktiv deyil.** Depozit ünvanı və QR custody qoşulmadığı üçün verilmir.

### Ayrı PostgreSQL

PostgreSQL bazası və istifadəçi yaradıb `DATABASE_URL`-i yalnız `.env` içində təyin edin. Əvvəl `npm run db:migrate` ilə sxemi explicit tətbiq edin (sınaq bazası üçün MIGRATION_ACK tələb olunur). Server start-ı uzaq bazada DDL icra etmir. Nümunə bağlantı formatı `postgresql://USER:PASSWORD@HOST:5432/DB`-dir; real məlumatı Git-ə yazmayın. Ayrı PostgreSQL serveri bu mühitdə quraşdırılmadığı üçün həmin yolun əməliyyat sınağı aparılmayıb.

## Səhifələr

`public/` daxilində 24 ayrı HTML səhifəsi və `server/views/admin.html` var. `index.html` bütün bölmələri daşıyan SPA deyil. Hər səhifə ortaq CSS/JS modullarından istifadə edir. Dillər AZ/EN/TR/RU, seçim localStorage-da saxlanır. İstifadəçi profili üçün dil API-si də var.

Ana səhifə: brend posteri, canlı qiymət xülasəsi, kampaniya kartları, bazarlar, üç addımlı izah və SSS. Kampaniya şəkillərində mətn yoxdur; başlıqlar HTML-dir. Karusel istifadə edilmir. Bonus önizləməsi açıq etiketlidir. İnformasiya posterlərinin mətni, `/assets/` daxilində şəkil yolu, daxili link, sırası, 4 dil, başlanğıc/son tarixi və aktivliyi admin JSON redaktorunda dəyişir. Vaxtı bitənlər serverdən qaytarılmır. Bonus aktivliyi isə server tərəfindən bloklanır.

## Test və yoxlama

```powershell
npm.cmd test
npm.cmd run check
npm.cmd audit
```

Server işləyərkən ayrıca terminalda `npm.cmd run smoke` bütün ictimai səhifələri və qorunan admin girişini yoxlayır. Tam nəticələr [QA qeydində](docs/QA.md) göstərilib.

İnteqrasiya testləri təmiz in-memory PGlite PostgreSQL bazası və müvəqqəti HTTP serveri açır; persistent hesabları dəyişmir. Qeydiyyat, şifrə hash-i, tokenlər, sessiya/CSRF, icazələr, UID dəyişməzliyi, balans düzəlişi və jurnal, təkrar depozit, paralel çıxarış, qismən/tam icra və ləğv test olunur. Şəbəkəsi məhdud sandbox-da localhost testlərinə ayrıca icazə lazım ola bilər.

## Təhvilin sərhədləri

İşləyən yerli hesab sistemi və mühasibat sınaq nüvəsi təqdim olunur; tam istehsal kriptobirjası hazır olduğu iddia edilmir. Qiymət inteqrasiyası brauzerdə yoxlanılıb. SMTP, Google, Binance testnet və Fireblocks sandbox üçün hesab/açar verilməyib, onların həqiqi xarici əməliyyat axınları yoxlanmayıb.

- [İnteqrasiyalar və tələb olunan açarlar](docs/INTEGRATIONS.md)
- [Real istifadəyə keçid: qalan texniki və hüquqi işlər](docs/LAUNCH.md)

Sessiyalar kriptoqrafik təsadüfi opaque token və serverdə SHA-256 hash ilə idarə olunur. Mainnet-i aktivləşdirən env keçidi yoxdur. `ENABLE_BINANCE_TESTNET=true` yalnız ayrıca admin Testnet laboratoriyasını açır; əsas trade.html yerli simulyasiya olaraq qalır.

## Ayrıca Testnet və custody diaqnostikası

`npm.cmd run worker:testnet` yalnız ayrıca PostgreSQL, Testnet açarları və açıq konfiqurasiya ilə işləyir. Admin → Binance Testnet bölməsi ayrıca sınaq növbəsi yaradır. Əsas ticarət ekranına təsir etmir. İzolyasiya edilmiş `oxion_testnet` bazasında sınaq balansı üçün bütün yuxarıdakı qoruyucu parametrləri verdikdən sonra `npm.cmd run fund:test -- --postgres-sandbox EMAIL AMOUNT` işlədilə bilər.

`npm.cmd run check:custody` Fireblocks sandbox aktivlərini və mövcud vault ünvanlarını yalnız oxuyur. İstifadəçi depoziti və çıxarışı aktivləşdirmir. Tam açar siyahısı və qalan işlər `docs/INTEGRATIONS.md`-dədir.

Serveri terminalda `stop` yazaraq və ya `Ctrl+C` ilə təmiz dayandırın və çıxış tamamlanmadan yenidən başlatmayın. Əvvəlki OneDrive sınaq bazaları `.local/` altında saxlanılıb; məlumatları avtomatik silən/reset edən startup məntiqi yoxdur.

`.local/` məktub tokenləri, əvvəlki şifrələmə açarı və qorunmuş sınaq bazaları daşıya bilər. Bu qovluğu paylaşmayın və arxivə/repozitoriyaya daxil etməyin; `.gitignore` onu istisna edir.

## Vercel + Neon

Vercel üçün kök `app.js`, `vercel.json`, Neon pooled bağlantısı və ayrıca tranzaksiyalı miqrasiya hazırlanıb. Addım-addım import, dəyişənlər və miqrasiya üçün [VERCEL-NEON.md](docs/VERCEL-NEON.md) sənədinə baxın. Fayllar hazırlanıb; sayt yayımlanmayıb və Neon hesabına qoşulmayıb.
