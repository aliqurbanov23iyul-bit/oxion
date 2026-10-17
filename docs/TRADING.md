# Spot əmri forması

- Aktiv cütlüyü seçin. Yalnız provayderin dəstəklədiyi USDT cütlükləri göstərilir.
- Al və ya Sat seçin. Market əmri üçün qiymət bazardan götürülür; Limit üçün qiyməti yazın və ya sifariş kitabında qiymətə klikləyin.
- Aktiv miqdarını yazın, yaxud USDT məbləği daxil edib Hesabla basın. Alış büdcəsinə komissiya daxildir; satışda USDT məbləği komissiyadan sonra alınacaq məbləğdir.
- 25/50/75/100% seçimi mövcud balansdan serverdə hesablanır. Bonus və manual düzəliş istifadə edilmir. Qalıq, komissiya və provayderin miqdar addımı nəzərə alınır; aşağı yuvarlaqlaşdırma nəticəsində az qalıq qala bilər. Bu hesablama balansı bloklamır və əmr yaratmır.
- Formadakı qiymətlər təxminidir. Son təsdiq pəncərəsində məbləğ və komissiya serverin 30 saniyəlik təklifindən alınır. Balans və bazar qiyməti dəyişibsə əmr rədd edilə bilər.
- Mövcud icra local-simulation rejimidir. Əmr göndərilməsi real birja icrası demək deyil; cari interfeysdə və təsdiq pəncərəsində bu göstərilir. Binance Testnet worker-i ayrıca texniki inteqrasiyadır. Real birja icrası üçün provayder hesabı və API inteqrasiyası ayrıca tamamlanmalıdır.

Başlıqdakı USDT balansı yalnız available hesabından oxunur. Maliyyə sorğularından sonra, səhifə yenidən aktiv olanda və görünən səhifədə 60 saniyəlik aralıqla yenilənir. Balans bağlantısı alınmırsa sıfır uydurulmur: “—” göstərilir. Telefonlarda balans və depozit düyməsi başlığın ikinci sətrindədir.
