# OXION — ticarət interfeysi

Demo balansı və müştəri demo hesab API-ləri deaktivdir. Header/profil/pul kisəsi əsas USDT balansını göstərir. Mobil terminalda açılan aktiv seçimi, hazır məbləğlər və aşağıda sabit istiqamət düymələri var. Köhnə virtual qeydlər audit üçün saxlanır. Real qiymət/hesablaşma bağlantısı olmadığı üçün real əməliyyat qəbul edilmir. Qiymət mənbəyi hazırda simulyasiyadır və açıq işarələnir.

## Yerli başlatma

Node.js 24. Layihə qovluğunda `npm.cmd ci`, sonra `npm.cmd start`. Sayt http://localhost:4317 ünvanında açılır. Yerli baza əvvəlki qeydləri saxlayır; `.env.example` dəyərlərsizdir.

`npm.cmd test` — hesab, maliyyə və API testləri. `npm.cmd run check` — JS/HTML yoxlaması. `npm.cmd run smoke` — işləyən saytın səhifə yoxlaması.

Vercel sayt, Neon baza üçündür. Real xidmətləri aktivləşdirən dəyişən əlavə edilməyib. Serverdə daxili `demoEnabled` seçimi yalnız köhnə demo regression testləri üçündür; HTTP və ya env vasitəsilə aktiv edilmir.

[Əvvəlki mexanizmin texniki sənədi — arxiv](docs/DIRECTIONAL-DEMO.md) · [Real xidmət üçün qalan işlər](docs/PRODUCTION-DIRECTIONAL.md)
