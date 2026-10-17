# İnteqrasiyaların vəziyyəti

Layihə localhost və sınaq mühiti üçündür. Mainnet endpoint-i, real kripto göndərişi və ictimai yayım aktiv deyil. Əsas trade.html həmişə yerli simulyasiyadır. Binance Testnet ayrıca admin laboratoriyası və ayrıca worker ilə işləyir; standart konfiqurasiyada bağlıdır.

| Hissə                | Vəziyyət                                                                                                                                                                                                                                | Hesab və konfiqurasiya                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bazar məlumatı       | Binance public API: qiymət, 24 saatlıq dəyişiklik/həcm, 60 şam, sifariş kitabı və son ticarətlər. Brauzerdə həqiqi cavab yoxlanılıb.                                                                                                    | Açar tələb etmir; internet və ölkədə provayder əlçatanlığı tələb olunur.                                                                                     |
| Cütlüklər            | 15 nəzərdə tutulan aktiv exchangeInfo ilə dinamik yoxlanılır. Yoxlama anında 14 cütlük dəstəklənirdi, TON/USDT dəstəklənmirdi. Bu nəticə sabit kodlaşdırılmayıb.                                                                        | Provayderin cari kataloqu.                                                                                                                                   |
| Əsas ticarət         | Yerli simulyasiya. Server quote-u, 30 saniyəlik təsdiq, decimal komissiya/yekun, balans rezervi, qismən/tam icra və ləğv.                                                                                                               | Hesab və təsdiqlənmiş e-poçt. Heç bir birjaya göndərilmir.                                                                                                   |
| Binance Testnet      | İmzalı adapter, davamlı execution_jobs outbox-ı, ayrıca worker, status reconciliation-u, faktiki feeAsset/quoteQty hesablaşması və admin laboratoriyası hazırdır. Nəzarətli test adapteri ilə yoxlanıb. Xarici hesabla E2E yoxlanmayıb. | Ayrı PostgreSQL, ENABLE_BINANCE_TESTNET=true, BINANCE_TESTNET_API_KEY və BINANCE_TESTNET_API_SECRET.                                                         |
| Custody              | İstifadəçi depozit ünvanı/QR verilmir və çıxarış göndərilmir. Yerli sorğu rezerv yaradır; admin rədd edib rezervi açır.                                                                                                                 | Custody hesabı, sandbox vault-lar, aktiv/şəbəkə siyasəti və aşağıdakı ingest işi.                                                                            |
| Fireblocks sandbox   | RSA JWT, dəstəklənən aktivlər, mövcud ünvanlar, tranzaksiya statusu, ünvan yoxlaması və externalTxId ilə test çıxarışı adapteri hazırlanıb. Yalnız oxuma diaqnostik CLI var. İstifadəçi route-larına bağlanmayıb.                       | FIREBLOCKS_SANDBOX_API_KEY, FIREBLOCKS_SANDBOX_PRIVATE_KEY_PATH, FIREBLOCKS_SANDBOX_VAULT_ID, FIREBLOCKS_SANDBOX_ASSET_ID. Açar olmadan xaricdə yoxlanmayıb. |
| Depozit hesablaşması | confirmedDeposit server modulu: şəbəkə/minimum, təsdiq həddi, dəyişməz transfer ID-si üzrə deduplikasiya və payload uyğunluğu. Testlər keçir. Açıq webhook yoxdur.                                                                      | Müstəqil yoxlanmış provayder məlumatı və istifadəçi–vault əlaqəsi tələb olunur.                                                                              |
| E-poçt               | SMTP adapteri hazırdır. SMTP olmadan məktub yalnız .local/mail içində yerli HTML önizləməsidir.                                                                                                                                         | SMTP_HOST/PORT/USER/PASSWORD, MAIL_FROM və SPF/DKIM/DMARC. Həqiqi göndəriş yoxlanmayıb.                                                                      |
| Google               | OAuth state, ID token/audience/email yoxlaması, sabit Google subject və TOTP challenge. Eyni e-poçtlu mövcud hesaba avtomatik bağlanmır.                                                                                                | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET və GOOGLE_REDIRECT_URI. Hesabsız xarici axın yoxlanmayıb.                                                             |
| Kampaniyalar         | İnformasiya posterləri adminin sırası, dilləri, şəkli, linki və tarixlərinə əsasən göstərilir. Bonus yalnız deaktiv önizləmədir, aktivləşdirmə bloklanır.                                                                               | Bonus limitləri, faiz pillələri, uyğun depozitlər/şəbəkələr, müddət, istifadə/çıxarış qaydaları və hüquqi baxış.                                             |
| Sosial hesablar      | İkonlar var; saxta link yoxdur.                                                                                                                                                                                                         | HTTPS INSTAGRAM_URL və TIKTOK_URL.                                                                                                                           |

## Binance Testnet worker-i

Admin → Binance Testnet bölməsi yalnız aşağıdakı konfiqurasiya olduqda sorğu qəbul edir. Əsas ticarət ekranı bununla real rejimə keçmir.

1. İzolyasiya edilmiş PostgreSQL bazası yaradın. Sınaq vəsaiti CLI-sindən istifadə ediləcəksə bazanın adı dəqiq oxion_testnet olmalıdır.
2. DATABASE_URL, ENABLE_BINANCE_TESTNET=true və testnet açarlarını .env daxilində verin. Mainnet açarlarından istifadə etməyin.
3. Serveri və worker-i ayrı terminallarda başladın: npm start və npm run worker:testnet.
4. Admin hesabı, TOTP və test ledger vəsaiti hazırlayın. Testnet hesabında da uyğun sınaq aktivləri olmalıdır. TESTNET_DATABASE_ACK=OXION_TESTNET_ONLY və --postgres-sandbox arqumenti olmadan PostgreSQL-ə test vəsaiti əlavə edilmir.
5. Admin laboratoriyasında əmr məlumatını yoxlayıb növbəyə göndərin. Növbəyə yazılma icra uğuru kimi göstərilmir.

Sorğu göndərilməzdən əvvəl job davamlı olaraq unknown vəziyyətinə keçir. Timeout və ya prosesin kəsilməsindən sonra yeni POST edilmir; eyni clientOrderId ilə status soruşulur. Qəbul edilmənin sübutu alınmadan rezerv buraxılmır. Qismən icralar trade ID-si ilə təkrarsız hesablaşır. Ləğv sorğusu əvvəl provayderdə yoxlanılır, təsdiqlənmiş icralar yazılır, sonra qalan rezerv açılır. Hələ göndərilməmiş əmr ləğv edilərsə birjaya ötürülmür.

Komissiyanın aktivi və quoteQty provayderdən götürülür. Market alışında ilkin rezervə 2% əlavə test buferi qoyulur. Bu qiymət zəmanəti deyil: faktiki xərc rezervi aşarsa, üçüncü komissiya aktivi üçün vəsait çatmazsa, məlumat uyğun gəlməzsə, 1000 və daha çox fill varsa və ya status 12 cəhddən sonra hələ bilinmirsə job review vəziyyətində saxlanır. Vəsait açılmır və əmr uğurla tamamlanmış göstərilmir. Review halının müstəqil provayder sübutu ilə həlli hələ ayrıca operator proseduru tələb edir.

Hazırkı worker polling ilə işləyir. İstehsaldan əvvəl imzalı user-data stream, provayder reset/reorg siyasəti, bütün fill səhifələrinin emalı, subhesablar, sistem komissiya ehtiyatı, reconciliation və monitorinq tamamlanmalıdır. Ayrı PostgreSQL və həqiqi Binance Testnet hesabı bu mühitdə olmadığından onların E2E sınağı aparılmayıb.

## Fireblocks və custody sərhədi

npm run check:custody yalnız sandbox provayderində aktiv dəstəyini və mövcud vault ünvanlarını oxuyur. Çıxarış yaratmır. Diaqnostikada alınan ünvanlar OXION istifadəçisinə bağlanmayıb və depozit səhifəsində istifadə edilmir.

confirmedDeposit üçün verified=true dəyərini frontend və ya xam webhook-dan götürmək olmaz. Webhook V2 imzası, timestamp və replay ID-si yoxlanmalı, tranzaksiya ayrıca autentifikasiyalı GET ilə yenidən alınmalı və bunlar təsdiqlənməlidir:

- Yekun COMPLETED statusu, faktiki təsdiq sayı, düzgün test/mainnet asset və şəbəkə.
- Vault/ünvan/memo ilə əvvəlcədən serverdə saxlanmış istifadəçi əlaqəsi.
- Hər transfer/output üçün unikal ID; yalnız tx hash çoxsaylı output-lara kifayət etmir.
- Məbləğ, minimum, AML/risk qərarı və reorg siyasəti.

Çıxarışın requested → awaiting_review → processing → completed/failed vəziyyət maşını, iki şəxs təsdiqi, eyni externalTxId ilə idempotency, timeout reconciliation-u və yekun provayder təsdiqindən sonra hesablaşma hələ qoşulmalıdır. Yerli versiya awaiting_review → failed və rezervin açılmasını həyata keçirir. Real processing/completed statusu uydurulmur.

## Rəsmi mənbələr

- [Binance Spot REST API](https://developers.binance.com/en/docs/products/spot/rest-api)
- [Binance Spot Testnet](https://github.com/binance/binance-spot-api-docs/blob/master/testnet/general-info.md)
- [Fireblocks JWT](https://fireblocks.readme.io/reference/signing-a-request-jwt-structure)
- [Fireblocks idempotency](https://fireblocks.readme.io/reference/api-idempotency)
- [Fireblocks transaction webhooks](https://fireblocks.readme.io/reference/transaction-webhooks)
- [PGlite fayl sistemləri](https://pglite.dev/docs/filesystems)

## Google OAuth yerli quraşdırma

Google Cloud layihəsində OAuth consent screen və **Web application** client yaradın. Serverdə `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` və `GOOGLE_REDIRECT_URI` təyin edin. Bu yerli quruluş üçün dəqiq redirect URI:

`http://localhost:4317/api/auth/google/callback`

Google Console-da Authorized redirect URIs sahəsinə həmin ünvanı əlavə edin. Lazım olduqda Authorized JavaScript origins: `http://localhost:4317`. Test rejimində giriş edəcək Google hesablarını test users siyahısına əlavə edin. Serveri yenidən başladın. `prompt=select_account` hesab seçimini tələb edir; OXION Google şifrəsini istəmir. Mövcud e-poçtlu hesab avtomatik əlaqələndirilmir və TOTP yoxlaması saxlanır. Client secret yalnız server mühitində saxlanmalıdır.

Açarlar olmadan düymə səbəbi göstərilərək bağlıdır. Yerli avtomatik test yalnız 302 yönləndirməsinin parametrlərini və state cookie-sini yoxlayır; Google hesabı ilə xarici giriş sınağı aparılmayıb.
