# Admin tərəfindən idarə edilən depozitlər

1. Neon SQL Editor-də docs/manual-deposits.sql faylının bütün mətnini Run edin. Mövcud məlumatlar silinmir. Sonra Vercel deployment-i tamamlayın.
2. /admin/ → Depozit: aktiv (məsələn USDT), şəbəkə (BEP20), özünüzə məxsus ünvan, tələb olunursa memo, minimum və təsdiq sayını daxil edin. Aktiv et seçimini işarələyib saxlayın.
3. İstifadəçi /deposit.html səhifəsində aktiv üsulları, ünvanı və QR kodu görür, məbləğ və TXID göndərir. Bu, ödəniş sübutunun avtomatik təsdiqi deyil.
4. Admin şəbəkənin rəsmi explorer-ində TXID, doğru token müqaviləsi, uğurlu status, qəbul ünvanı, memo, faktiki token məbləği və kifayət qədər təsdiq olduğunu yoxlayır. Qeyd yazır, yoxlama qutusunu işarələyir və Təsdiqlə seçir. Uyğun olmayan iddianı rədd edir. Məbləğ səhvdirsə təsdiqləməyin; düzgün məlumatla yeni sorğu tələb edin.
5. Təsdiq mövcud balans hesabına ikitərəfli jurnal ilə bir dəfə yazılır. Admin və səbəb saxlanır. Sorğular və qərarlar dəyişdirilmir. Eyni şəbəkə/TXID ikinci hesaba yazıla bilməz. Bu versiya hər TXID üçün yalnız bir depozit iddiası qəbul edir; çoxalıcı batch köçürmələr nəzərdə tutulmayıb.
6. Ünvanı dəyişmək üçün yeni üsul yaradın, köhnəni deaktiv edin. Əvvəlki sorğuda əvvəlki ünvan saxlanır.

Provayder hesabı tələb olunmur. Avtomatik blokçeyn yoxlaması, avtomatik depozit aşkarlanması və avtomatik çıxarış bu dəyişiklikdə yoxdur. Ünvan və token şəbəkəsinin düzgünlüyünü administrator yoxlayır. Mövcud spot əmr icrası hələ sınaq/simulyasiya rejimindədir.


## 15 hazır seçim və QR

Admin depozit bölməsində USDT/BEP20, USDT/TRC20, USDT/ERC20, BTC, ETH/ERC20, BNB/BEP20, SOL, XRP, DOGE, ADA, TRX, AVAX-C, LINK/ERC20, LTC və BCH seçimləri var. Bunlar boş şablonlardır; yalnız öz qəbul ünvanınızı daxil edib aktiv etdikdən sonra müştəriyə görünür. Təklif edilən təsdiq sayları admin tərəfindən dəyişdirilə bilər; bunlar maliyyə yekunluğu zəmanəti deyil. Ünvan formatı yoxlanır; token müqaviləsi və ünvanın sahibliyi avtomatik təsdiqlənmir.

Bütün yeni üsullar üçün minimum 10 USDT qarşılığıdır (təxminən 10 ABŞ dolları). USDT üçün 1 USDT = 1 qiymət vahidi qəbul edilir; fiat USD məzənnəsi inteqrasiyası yoxdur. Digər aktivlərdə cari ictimai bazar qiyməti serverdə yoxlanır. Qiymət alınmırsa sorğu qəbul edilmir. Məbləğ, qiymət və USDT qarşılığı sorğuda saxlanır. Məbləğ göndərilməzdən əvvəl qiymət dəyişə bilər; şəbəkə komissiyası ayrıca ödənilir.

QR avtomatik yaradılır və ya 100 KB-dək PNG/JPG kimi bazada saxlanır; Vercel diskinə yazılmır. Yüklənən QR-nin ünvan və memo ilə eyniliyini administrator yoxlamalıdır. SVG yükləmək olmur. Solana TXID-lərində hərf registri qorunur, hex TXID-lərdə 0x prefiksi və registr təkrar hesablanmanı keçə bilmir. Hər TXID yalnız bir iddiaya aiddir.

Profil ekranı istifadəçi adını serverdə saxlayır, USDT mövcud/bloklanmış/bonus balanslarını ayrıca göstərir. Balansı gizlətmə seçimi brauzerdə saxlanır. Bonus çıxarıla bilən balansa daxil edilmir. Sınaq əmrləri real birja icrası deyil; Binance Testnet texniki alətlər bölməsindədir.


Depozit və çıxarış ekranları kripto seçimi, aktiv/şəbəkə formaları və kompakt kartlar ilə hazırlanıb. Çıxarış göndərişi hazır deyil: mövcud forma yalnız ETH-SEPOLIA sınaq sorğusunu saxlayır, kripto göndərmir. Tarixçədə depozit iddiaları və çıxarış sorğuları faktiki statusları ilə göstərilir; bütün jurnal hərəkətləri ayrıca açılan hissədə saxlanır. Əmrlər ekranında hamısı/açıq/bağlanmış filtrləri var.


## Müştəridən TXID tələb edilmir

Son versiyada müştəri yalnız məbləği bildirir. Brauzer avtomatik sorğu açarı göndərir; eyni sorğunun təkrarı yeni qeyd yaratmır. Sorğu gözləmədədir və balans artmır. Təsdiqləyən admin blokçeyndə köçürməni, məbləği, qəbul ünvanını və istifadəçiyə aid olduğunu yoxlayıb TXID-ni admin formasında daxil edir. Rədd zamanı TXID tələb olunmur. Təsdiqlənmiş TXID şəbəkə üzrə unikal saxlanır; paralel təsdiqlərdən yalnız biri hesaba yazılır. İlkin sorğu dəyişdirilmir, adminin TXID-si ayrıca dəyişməz qərar qeydində saxlanır.

Mövcud baza üçün docs/deposit-no-txid.sql faylını Neon SQL Editor-də Run edin. Yeni quraşdırmada docs/manual-deposits.sql bütün tələb olunan əlavələri ehtiva edir. Əvvəlki sənəddə müştəridən TXID göndərilməsi barədə olan addım bu dəyişikliklə əvəz olunur.
