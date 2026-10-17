# OXION interfeys və mobil yoxlama — 17 oktyabr 2026

## Dəyişikliklər
- Ana səhifədə əvvəlki OXION loqo kompozisiyası, posterlər, bazar xülasəsi, işləmə qaydası və SSS quruluşu bərpa edildi. Ticarət et/Depozit et keçidləri və aşağıda ayrıca terminal tanıtımı əlavə olundu.
- Yeni istiqamət terminalı yalnız trade.html-dədir. Demo və Əsas hesab seçimi URL/localStorage-də saxlanır. Demo dolları ilə əsas USDT hesabı ayrıca göstərilir. Əsas hesabın vəsaiti simulyasiya əməliyyatına göndərilmir; server də account=real sorğusunu rədd edir.
- Profil, header və pul kisəsi yalnız əsas USDT available balansını oxuyur. Manual/bonus məbləğlər available balansına qatılmır. Demo rəqəmləri USDT kimi göstərilmir.
- Silinmiş needAuth yoxlaması bərpa edildi: profil, pul kisəsi, təhlükəsizlik və dəstək səhifələrinin ReferenceError xətası düzəldi.
- Sessiyada agent boş olduqda təhlükəsizlik səhifəsinin slice xətası düzəldi.
- Mobil mətn sətirləri, min-width, cədvəl daxilində sürüşdürmə, menyu sərhədləri, toxunma hədəfləri və müddət xəbərdarlığının grid sırası düzəldildi. Dekorativ hero elementi klikləri tutmur.
- Depozit/çıxarış səhifələri hesab üslubunda xidmət vəziyyəti, pul kisəsi və dəstək keçidləri göstərir. Qoşulmamış xidmət üçün ünvan və tamamlanmış maliyyə əməliyyatı yaradılmır.

## Brauzer yoxlaması
24 ictimai səhifə 390 px telefon ölçüsündə açıldı; səhifə səviyyəsində xəta və sənədin üfüqi daşması yoxlandı. Ana səhifə, profil, pul kisəsi, ticarət, dəstək, təhlükəsizlik, depozit və qeydiyyat əlavə 320/768 px ölçülərdə yoxlandı. Əsas axınlarda mətn elementlərinin ekran kənarından çıxması ayrıca ölçüldü.

Profil menyusu, menyudan pul kisəsinə keçid, mobil naviqasiya, əsas/demo hesab keçidi yoxlandı. Yerli fixture-də əsas balans 0.00 USDT, demo balansı isə ayrıca təxminən 10,000 DEMO dollar göstərdi. Hesab seçimi real maliyyə əməliyyatı açmır.

## Qalan asılılıqlar
Saytdakı demo feed üçün ayrıca davamlı Node worker yoxdur; istifadəçi ayrıca serverinin olmadığını təsdiqləyib. Vercel təkbaşına 250 ms işçini işlətmir. Real qiymət/hesablaşma/custody xidmətləri və real rejim hazır deyil. UI-nin testdən keçməsi real pul məhsulunun istifadəyə hazır olması demək deyil.
