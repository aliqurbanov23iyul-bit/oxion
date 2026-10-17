# Yoxlama qeydi — 17 oktyabr 2026

- 32 avtomatik test keçir: hesab, e-poçt tokenləri, sessiya/CSRF, UID, admin TOTP, balans düzəlişi, dəyişməz maliyyə qeydləri, paralel çıxarış, təkrar depozit, server quote-u, şifrə bərpası/giriş yarışı və Testnet worker vəziyyətləri.
- Bütün 24 ictimai HTML səhifəsi, ortaq CSS/JS/loqo, qorunan admin (anonim 401), olmayan səhifə (404) və real pulun bağlı olması HTTP smoke yoxlamasından keçir.
- JavaScript sintaksisi, 25 HTML giriş faylı və dəyərlərsiz .env.example yoxlanır.
- Brauzerdə həqiqi Binance cavabı ilə 60 şam, 9 alış/9 satış kitab sətri və son bazar ticarətləri göstərilib. Yoxlama anında 14 cütlük dəstəklənirdi; TON/USDT dəstəklənmirdi. Qiymətlər və dəstək siyahısı sonradan dəyişə bilər.
- 390px telefon, 768px planşet və 1440px masaüstü ölçüləri; AZ/EN/TR/RU; mobil menyu, axtarış və şam intervalları yoxlanıb.
- Təmiz dayandırma/təkrar açılış və iki prosesin eyni embedded bazanı açmasının bloklanması yoxlanıb. Windows məlumatları OneDrive-dan kənar AppData/Local/OXION altında saxlanır.

## Yoxlanmamış xarici hissələr

SMTP, Google OAuth, ayrıca PostgreSQL serveri, Binance Testnet hesabı və Fireblocks sandbox üçün hesab/açar verilməyib. Onların xarici E2E axınları keçmiş kimi göstərilmir. Worker testləri nəzarətli adapterdən istifadə edir. Custody ünvanı və kripto göndərişi aktiv deyil. Tam əlçatanlıq/pentest və yük auditi də aparılmayıb.

## Önizləmələr

- [Masaüstü ana səhifə](screenshots/home-desktop.jpg)
- [Mobil ana səhifə](screenshots/home-mobile.jpg)
- [Canlı məlumatlı ticarət ekranı](screenshots/trade-desktop.jpg)

Şəkillər sınaq anının görüntüləridir; göstərilən qiymətlər sonradan dəyişir.

## Təkrar yoxlama

```powershell
npm.cmd test
npm.cmd run check
npm.cmd audit
```

Server işləyərkən ayrıca terminalda:

```powershell
npm.cmd run smoke
```

Şifrə hash-i scrypt N=131072, r=8, p=1 və təsadüfi salt istifadə edir. Parametrlər [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) tövsiyəsinə əsaslanır. Bu, platformanın istehsal və ya hüquqi uyğunluq sertifikatı deyil.

## İnterfeys yenilənməsi — ikinci mərhələ

- Əvvəl müşahidə olunan çatışmazlıqlar: qeydiyyatda şifrə təkrarı və məcburi razılıq yox idi; dəstək qonaqlara bağlı idi; əsas poster deaktiv kampaniyanı brend izahından önə çəkirdi; ortaq menyuda dəstək və hesab keçidləri çatışmırdı; bəzi ikonlar Unicode idi.
- Yeni ana səhifə: brend izahı və hesab/bazar CTA-ları, canlı xülasə, deaktiv bonus önizləməsi, bazar cədvəli, üç addım, mövcud təhlükəsizlik vasitələri və dəstək.
- Yeni SVG ikonları, vahid forma/düymə vəziyyətləri, 20 saniyəlik HTTP gözləmə limiti, təkrar submit kilidi və aria-busy.
- Şifrə təkrarı, göstər/gizlət, e-poçt klaviaturası/placeholder, məcburi razılıq və serverdə TERMS_REQUIRED. Google yönləndirməsində select_account və dəqiq redirect URI testi.
- Qonağa açıq altı dəstək kateqoriyası, mövzu açıqlaması, SSS və giriş tələbi. Kateqoriya DB-yə əlavə edilir; mövcud müraciətlər account kateqoriyasında qorunur. Yeni müraciət nömrəsi/statusu göstərilir. Başqa istifadəçinin şəxsi müraciətinə giriş verilmir.
- 27 test uğurludur, npm run check və npm run smoke keçir. Yeni testlər: razılıqsız qeydiyyatın bloklanması; şəxsi/kateqoriyalı müraciətin saxlanması; OAuth hesab seçimi və redirect/state.
- Brauzerdə ana səhifə, qeydiyyat, ticarət və dəstək 390/768/1440 ölçülərində yoxlanıb; üfüqi səhifə daşması aşkarlanmayıb. Mobil menyu/Escape, dəstək mövzusu, dörd dil, şifrə uyğunsuzluğu və göstər/gizlət yoxlanıb. Mobil ticarət qrafikində 60 həqiqi şam göstərilib. Son baxılan səhifələrdə konsol error/warn qeydi yoxdur.
- Tam qeydiyyat/təsdiq/giriş və müraciət göndərmə avtomatik izolə edilmiş bazada yoxlanıb; əsas bazaya yeni sınaq istifadəçisi əlavə edilməyib. Xarici Google və SMTP hesabı ilə E2E yoxlama aparılmayıb.

Yeni görüntülər: [ana səhifə](screenshots/home-v2-desktop.png), [mobil](screenshots/home-v2-mobile.png), [qeydiyyat](screenshots/signup-v2-desktop.png), [dəstək](screenshots/support-v2-desktop.png), [mobil ticarət](screenshots/trade-v2-mobile.png).

## Vercel / Neon hazırlığı

- 32 test keçir. Yeni testlər hosted konfiqurasiyanın fail-closed davranışını, sxem markerini, yalnız bir dəfə initialization, admin HTML-nin CDN-dən çıxarılmasını və sessiya ilə qorunmasını, Origin yoxlamasını və instansiyalararası atomik SQL sorğu limitini yoxlayır.
- `npm run check`: kök Vercel giriş faylı, 34 JavaScript faylı, 25 HTML səhifəsi, boş env şablonu və adminin public qovluğunda olmaması yoxlanır.
- `npm run smoke` yeni yerli serverdə keçir.
- Həqiqi Neon bağlantısı, direct URL ilə PG miqrasiyası və Vercel platform build/deployment hesab/açar olmadığı üçün yoxlanmayıb. Hosted testlər injected embedded PostgreSQL istifadə edir.
- İctimai yayım və real vəsait aktivləşdirilməyib.
