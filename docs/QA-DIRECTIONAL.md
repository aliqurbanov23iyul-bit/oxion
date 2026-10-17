# Directional demo — 2026-10-17 yoxlama hesabatı

- npm test: **51/51 keçdi**. Hesab qeydiyyatı/təsdiqi/giriş/CSRF/TOTP, əvvəlki maliyyə regression testləri və yeni demo mexanizmi daxildir.
- Yeni demo üzrə 12 test: UP/DOWN uğur və itki, bərabərlik, qiymət kəsilməsi və geri qaytarılma, bağlanış tick qaydası, 87%/sent yuvarlaqlaşdırması, dəyişməz faiz və nəticə, yetərsiz balans, paralel açılış/grant/settlement, təkrar idempotent sorğu, diskdə restart/bərpa, HTTP icazələri və client saxtalaşdırmalarının nəzərə alınmaması.
- npm run check: 58 JavaScript, 25 HTML və dəyərlərsiz env şablonu keçdi.
- npm run smoke: 24 ictimai səhifə, ortaq assetlər, qorunan admin, 404 və demo statusu keçdi.
- Brauzer: $10/3 saniyə UP virtual əməliyyatı $8.70 xalis qazanc verdi, $18.70 qaytarıldı. DOWN əməliyyatı və itki nəticəsi də baxıldı. 60 saniyəlik əməliyyat səhifə yenilənəndən sonra eyni ID, qiymət və bitmə vaxtı ilə bərpa olundu.
- 390×844 mobil: sənədin üfüqi daşması yoxdur; istiqamət düymələri 54 px hündürdür; məbləğ/müddət yan-yana və nəticə qaydası görünür.
- Admin: 8 aktivin simulyasiya axını, mövqe/jurnal bölmələri və yeni əməliyyatlara aid qaydalar paneli açıldı.

Sınaqlar yerli PostgreSQL-compatible PGlite ilə aparılıb. Neon üzərində load/lock/latency və production təhlükəsizlik auditi aparılmayıb. Yeni demo branch productiona aktivləşdirilməyib. Real maliyyə əməliyyatı, canlı qiymət provayderi və custody xidməti yoxlanmış kimi iddia edilmir.
