# Mobil terminal və demo balansının çıxarılması

17 oktyabr 2026. Demo hesab seçimi, $10,000 tanıtımı və virtual balans müştəri interfeysindən çıxarılıb. /api/demo/account, positions və ledger müştəri sorğularında 403 DEMO_DISABLED qaytarır. Yeni virtual hesab/grant yaradılmır. Mövcud virtual jurnallar silinmir; audit və regression testləri üçün saxlanır. Müştəri tarixçəsi və əmrlər əvvəlki əsas hesab ekranlarından oxunur.

Telefonda aktivlər açılan paneldə, şaquli iki sütunlu siyahıda seçilir. Məbləğ/müddət yan-yana, 10/25/50/100 hazır məbləğlər və 52px hündürlüklü aşağıda sabit istiqamət düymələri əlavə edilib. Qrafik daha yığcamdır; kiçik ekran üçün vaxt yazılarının sayı azaldılıb. Əsas balans USDT-dir, demo dolları göstərilmir. Xidmətin qeyri-aktiv olması həm düymələrin üstündə, həm açılan izahda görünür.

Real qiymət axını və hesablaşma qoşulmayıb. Bu dəyişiklik pul ilə əməliyyatı aktivləşdirmir. Simulyasiya qiymətləri real birja qiyməti kimi təqdim edilmir.
