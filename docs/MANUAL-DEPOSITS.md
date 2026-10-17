# Admin tərəfindən idarə edilən depozitlər

1. Neon SQL Editor-də docs/manual-deposits.sql faylının bütün mətnini Run edin. Mövcud məlumatlar silinmir. Sonra Vercel deployment-i tamamlayın.
2. /admin/ → Depozit: aktiv (məsələn USDT), şəbəkə (BEP20), özünüzə məxsus ünvan, tələb olunursa memo, minimum və təsdiq sayını daxil edin. Aktiv et seçimini işarələyib saxlayın.
3. İstifadəçi /deposit.html səhifəsində aktiv üsulları, ünvanı və QR kodu görür, məbləğ və TXID göndərir. Bu, ödəniş sübutunun avtomatik təsdiqi deyil.
4. Admin şəbəkənin rəsmi explorer-ində TXID, doğru token müqaviləsi, uğurlu status, qəbul ünvanı, memo, faktiki token məbləği və kifayət qədər təsdiq olduğunu yoxlayır. Qeyd yazır, yoxlama qutusunu işarələyir və Təsdiqlə seçir. Uyğun olmayan iddianı rədd edir. Məbləğ səhvdirsə təsdiqləməyin; düzgün məlumatla yeni sorğu tələb edin.
5. Təsdiq mövcud balans hesabına ikitərəfli jurnal ilə bir dəfə yazılır. Admin və səbəb saxlanır. Sorğular və qərarlar dəyişdirilmir. Eyni şəbəkə/TXID ikinci hesaba yazıla bilməz. Bu versiya hər TXID üçün yalnız bir depozit iddiası qəbul edir; çoxalıcı batch köçürmələr nəzərdə tutulmayıb.
6. Ünvanı dəyişmək üçün yeni üsul yaradın, köhnəni deaktiv edin. Əvvəlki sorğuda əvvəlki ünvan saxlanır.

Provayder hesabı tələb olunmur. Avtomatik blokçeyn yoxlaması, avtomatik depozit aşkarlanması və avtomatik çıxarış bu dəyişiklikdə yoxdur. Ünvan və token şəbəkəsinin düzgünlüyünü administrator yoxlayır. Mövcud spot əmr icrası hələ sınaq/simulyasiya rejimindədir.
