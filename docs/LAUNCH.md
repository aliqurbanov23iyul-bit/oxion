# Real istifadəyə keçid — qalan işlər

İctimai yayım və real pul hərəkəti bu təhvilin hissəsi deyil. Layihənin mövcud vəziyyətini istehsal birjası kimi təqdim etmək olmaz.

## Texniki

- Hazır Testnet worker-ini ayrıca PostgreSQL və həqiqi Testnet hesabı ilə E2E yoxlamaq; imzalı user-data stream, bütün fill səhifələri, sistem komissiya ehtiyatı və review həllini tamamlamaq. Custody ingest-i və çıxarışın processing/completed vəziyyət maşınını provayderə qoşmaq.
- Real PostgreSQL serverində paralellik, deadlock retry, backup/restore, failover, migrasiya, decimal sərhədləri və yüksək yük testləri. Hazır testlər embedded PostgreSQL/PGlite üzərindədir; ayrıca PostgreSQL serverində icra edilməyib.
- Schema migrasiyalarını tətbiq startından ayırmaq; tətbiq DB roluna yalnız lazım olan SELECT/INSERT/UPDATE səlahiyyətləri vermək, DDL, trigger söndürmə, owner/superuser və TRUNCATE səlahiyyətini verməmək. DB administratoru triggerləri söndürə bilər; immutable qeydlər həmin səlahiyyətə qarşı müdafiə iddiası deyil.
- Tam journal nəzarəti, hər aktiv üzrə ehtiyatlar, subhesab hesablaşması, komissiya gəliri və custody reconciliation-u. Hazır simulyasiya clearing hesablarından istifadə edir, real təminat iddia etmir.
- TLS, secret manager/KMS, uzunömürlü şifrələmə açarı, rotasiya, proses ayrılması, monitorinq, alertlər, şifrəli backup, təhlükəsizlik/pentest və insident planı.
- Paylanmış rate-limit/session store, sessiya və token təmizləmə işi, brute-force aşkarlama, admin üçün ayrıca domen və daha sərt səlahiyyət bölgüsü. Hazır rate limit bir Node prosesi üçündür.
- TOTP bərpa kodları və təhlükəsiz hesab bərpası; admin parol sıfırlamasının TOTP-ni ləğv etmədiyini qorumaq. Hazır versiyada recovery code yoxdur.
- SMTP və Google-un həqiqi hesablarla sınağı; e-poçt dəyişmə və Google hesabını mövcud hesaba təhlükəsiz bağlama axını. Hazırda avtomatik email əsaslı birləşdirmə bloklanır.
- Bütün xətalar, əlçatanlıq, klaviatura və ekran oxuyucu üzrə ayrıca audit; hazır yoxlama 390px/768px/1440px brauzer baxışı və əsas axın testləridir.
- Bonus limitləri, pillələr, şəbəkələr, müddət, istifadə/çıxarış şərtləri, mühasibat və sui-istifadə nəzarəti tamamlanmadan bonus aktivləşdirilməməlidir.

## Fəaliyyət ölkəsi müəyyən edildikdən sonra hüquqi və əməliyyat baxışı

Ölkə göstərilmədiyi üçün burada lisenziya və ya uyğunluq təsdiqi verilmir. Yerli hüquqşünas və müvafiq tənzimləyici ilə ən azı bunlar müəyyən edilməlidir:

- Hüquqi şəxs, xidmət ölkələri və rezidentlik məhdudiyyətləri; spot birja/custody/VASP lisenziyası və ya qeydiyyatın tələb olunması.
- KYC/KYB, benefisiar sahiblik, AML/CFT, sanksiya yoxlaması, əməliyyat monitorinqi, şübhəli fəaliyyət hesabatı və tətbiq edilirsə Travel Rule.
- Müştəri aktivlərinin ayrılması və saxlanması, mühasibat, vergi, ehtiyat/kapital, şikayət və insident prosedurları.
- Məxfilik nəzarətçisi, məlumatların saxlanma müddəti və yerləşməsi, istifadəçi hüquqları, beynəlxalq məlumat ötürülməsi və vendor müqavilələri.
- İstifadə şərtləri, risk açıqlaması, komissiyalar, istehlakçı hüquqları və kampaniya/bonus reklam məhdudiyyətləri.

Ümumi çərçivə üçün [FATF virtual aktivlər və VASP materiallarına](https://www.fatf-gafi.org/en/publications/Virtualassets/Virtual-assets-fatf-standards.html) baxın. Bunlar ayrıca ölkənin qanunlarının və hüquqi rəyin əvəzi deyil. Saytdakı hüquqi səhifələr ilkin mətn kimi işarələnib.
