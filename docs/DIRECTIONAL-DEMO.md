# Demo nəticə və qiymət qaydaları

## Hesab və riyaziyyat
Hər istifadəçiyə bir dəfə 10,000.00 DEMO-USD ayrılır. Bu, virtual hesab vahididir, bank USD depoziti və ya USDT deyil. Mövcud kripto accounts/journals/entries saxlanır; yeni demo_accounts/demo_journals/demo_entries ayrıca ikitərəfli jurnal təşkil edir.

Məbləğ ən çox iki onluq rəqəmlə qəbul olunur. Server Decimal.js ilə hesablayır. Xalis qazanc = məbləğ × qəbul anındakı faiz / 100; qazanc sentə aşağı yuvarlaqlaşdırılır (ROUND_DOWN). Məsələn 1.01 × 87% = 0.8787 → 0.87; ümumi qaytarılma 1.88. Brauzerin önizləməsi BigInt sent hesablamasıdır. Server qərarı əsasdır.

10.00 / 87% nümunəsi: açılışda mövcud balansdan rezervə 10.00; uğurda rezerv sistem hesabına və 18.70 istifadəçiyə; itkidə rezerv sistem hesabına keçir, əlavə tutulma yoxdur; bərabər/etibarsız nəticədə rezervdən 10.00 geri qaytarılır. Hər jurnal sıfıra balanslaşır, istifadəçi hesabları mənfi ola bilməz. Faiz uğur ehtimalı deyil.

## Qiymət və vaxt
Mənbə simulation-v1-dir. Bütün kripto, metal, valyuta və səhm alətləri SIMULYASİYADIR; canlı birja sessiyası iddiası yoxdur. Qiymət funksiyası yalnız aktiv və zamanla müəyyən edilir, istifadəçi, məbləğ və istiqamət nəticəyə təsir etmir. Təsadüfi qalib/məğlub seçimi yoxdur. Bu axın gələcək qiyməti proqnozlaşdırıla bildiyi üçün real pul üçün yararsızdır.

İşçi müşahidə etdiyi cari 250 ms zaman aralığına qiymət yazır. Tarixi boşluqlar sonradan doldurulmur. Hər tick üçün qiymət vaxtı və serverdə qəbul vaxtı saxlanır. Açılışda gələcəkdən olmayan ən son tick seçilir. 3/5 saniyə üçün yaşı ən çox 500 ms, digər müddətlər üçün 1000 ms olmalıdır. Uyğun axın yoxdursa müddət/düymələr deaktivdir; server də rədd edir.

Server qəbul vaxtı + seçilən müddət = bitmə vaxtı. Bağlanış qiyməti bitmə vaxtında və ya ondan sonra olan ilk etibarlı saxlanmış tick-dir; maksimum 1500 ms bağlanış pəncərəsi var. Tick ən çox 1000 ms çatdırılma gecikməsi ilə və bağlanış pəncərəsi bitmədən qəbul edilmiş olmalıdır. Vaxt keçdikdən sonra sonradan çatmış qiymət istifadə olunmur. Pəncərədə qiymət yoxdursa etibarsız nəticə və tam geri qaytarılma olur. Bərabərlik səkkiz onluq qiymət dəqiqliyində müqayisə olunur.

## Davamlılıq və icazələr
Açıq mövqe, rezerv və qəbul olunmuş faiz eyni DB tranzaksiyasındadır. İstifadəçi kilidi paralel açılışlarda artıq xərcləməni dayandırır. Idempotency-Key təkrarı eyni əməliyyatı qaytarır; fərqli məzmunla eyni açar rədd edilir. Brauzer cavabı itəndə açarı sessionStorage-də saxlayır. Nəticə mövqe kilidi və unikal position_id ilə bir dəfə yazılır. Səhifənin bağlanması server işçisini dayandırmır. Server restartdan sonra saxlanmış bağlanış tick-i varsa onu istifadə edir, yoxdursa geri qaytarır.

Admin yalnız yeni əməliyyatların faizini və minimum/maksimum məbləğini səbəblə yeni versiya kimi yaza bilər. Aktiv əməliyyatın faizi dəyişmir. Qiymət, nəticə və qəbul olunmuş mövqelər üçün dəyişdirmə/silmə API-si yoxdur. Cədvəllərdə UPDATE/DELETE/TRUNCATE qadağası var. DB sahibi texniki olaraq triggerləri ləğv edə bilər; production ayrıca məhdud DB rolları, xarici audit və backup tələb edir.

İlkin limit: 1.00–1000.00 DEMO-USD, istifadəçiyə 20 açıq mövqe. Mövcud legacy maliyyə POST endpointləri normal tətbiqdə REAL_MONEY_DISABLED verir. Legacy rejimi yalnız daxili regression test fixture-lərində istifadə olunur.

## Yerli və hosted işçi
npm start yerli qiymət/hesablama işçisini də başladır. Vercel-də ayrıca daimi Node prosesi npm run worker:demo ilə eyni Neon bazasına qoşulmalıdır. Browser sorğuları hazır nəticələrin tamamlanmasına kömək edir, lakin qiymət axını yaratmır. İşçi dayanarsa yeni mövqelər qəbul olunmur. Cron və serverless timer 3 saniyəlik mənbə əvəzi deyil.

Hazırkı tick cədvəli append-only-dir. Bu, auditli demo üçün qurulub; uzunmüddətli hosted istismardan əvvəl partition/arxiv və saxlama siyasəti tələb edir. 8 aktiv × saniyədə 4 tick təxminən gündə 2.76 milyon tick deməkdir. Lokal sınaq üçün uyğundur, pulsuz Neon planında limitsiz daimi işlətmək üçün ölçüləndirilməyib.
