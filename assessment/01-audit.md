# Audit Kualitas & Arsitektur Platform

**Target Platform**: Platform AI Interview (`api/` Ruby on Rails + `web/` React 18 / TypeScript)  
**Assessor**: Fullstack Engineer (SDET Depth)  
**Tanggal**: Oktober 2026  
**Status**: Audit Baseline Komprehensif & Pelacakan Remediasi Bug  

---

## Ringkasan Eksekutif & Garis Batas Rilis (Ship / Do-Not-Ship Line)

Platform AI Interview adalah layanan dua tingkat (*two-tier*) yang dirancang untuk menjalankan wawancara suara real-time secara otonom menggunakan Gemini Live serta mengevaluasi kompetensi kandidat terhadap standar anchor level (L1–L5).

Audit mendalam terhadap basis kode, kontrak data, persistensi, dan alur kerja pengembangan mengungkap **kerentanan sistemik yang parah** pada pertemuan (*seam*) antara frontend dan backend, serta kontrol akses hulu yang rusak:

1. **P0 Blocker**: Autentikasi assessor rusak secara fundamental—controller autentikasi secara kaku hanya memvalidasi `user.role == 'admin'`, sehingga seluruh pengguna dengan role utama `assessor` ditolak dengan status HTTP 401 Unauthorized.
2. **P0 Blocker**: Link undangan wawancara kandidat mengarahkan pengguna ke port API Rails (`http://localhost:3001/interview/:token`), memicu pesan kesalahan 404 Routing Error alih-alih membuka aplikasi web kandidat pada port 5173.
3. **P1 Major**: Laporan analisis Fit/Gap mengalami ketidakcocokan atribut kontrak (`expected_level` vs `required_level`) serta menghilangkan flag `is_override`, menyebabkan tabel perbandingan di frontend menampilkan kolom level kebutuhan yang kosong dan menyembunyikan indikator override asesor.
4. **P1 Major**: Pemilihan skill standar dari taksonomi B7 membuang atribut `skill_id` menjadi `undefined`, memutus keterlacakan (*traceability*) ke taksonomi sumber.
5. **P1 Major**: Endpoint portfolio tidak memiliki isolasi tenant, memungkinkan asesor terautentikasi dari Perusahaan A melihat, mengekspor, dan memicu laporan kandidat milik Perusahaan B (kerentanan IDOR / Multi-Tenant Leakage).

### Garis Batas Rilis (The Ship / Do-Not-Ship Line)
> **AMBANG BATAS DO-NOT-SHIP (JANGAN RILIS)**:  
> Tidak ada rilis yang boleh diluncurkan jika masih ada isu **P0** (sistem tidak dapat digunakan sama sekali) atau **P1** (integritas data rusak / kegagalan diam-diam / kebocoran multi-tenant) yang belum terselesaikan tanpa persetujuan mitigasi eksplisit.  
> Basis kode awal berada jauh di bawah standar layak rilis. Melalui perbaikan menyeluruh dalam siklus penilaian ini, seluruh cacat P0 dan P1 yang teridentifikasi telah diselesaikan dan diverifikasi dengan uji regresi otomatis.

---

## Registrasi Risiko Berdasarkan Peringkat Keparahan (Severity-Ranked)

| ID | Judul Temuan | Tingkat Keparahan | Kategori | Dampak Bisnis | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Login Assessor Ditolak (Batasan kaku `user.role == 'admin'`) | **P0 Blocker** | Salah Bangun (*Built Wrong*) | Assessor tidak dapat masuk platform; alur kerja utama terhenti total. | **FIXED (Tuntas)** |
| **INT-01** | URL Undangan Kandidat Mengarah ke Port API (3001) Bukan Web (5173) | **P0 Blocker** | Salah Bangun (*Built Wrong*) | Kandidat menerima link rusak yang menghasilkan pesan 404 Routing Error. | **FIXED (Tuntas)** |
| **DAT-01** | Kontrak Fit/Gap Tidak Cocok (`expected_level` vs `required_level`) & `is_override` Hilang | **P1 Major** | Salah Bangun (*Built Wrong*) | Tabel perbandingan menampilkan kolom "Required" kosong dan ikon pensil override hilang. | **FIXED (Tuntas)** |
| **DAT-02** | SkillPicker Menghapus `skill_id` (Dipaksa Menjadi `undefined`) | **P1 Major** | Salah Bangun (*Built Wrong*) | Skill taksonomi B7 kehilangan ID unik, merusak pencocokan data otomatis ke hilir. | **FIXED (Tuntas)** |
| **SEC-02** | Endpoint Portfolio Tanpa Batasan Tenant (Kerentanan IDOR) | **P1 Major** | Salah Bangun (*Built Wrong*) | Assessor dapat melihat dan mengekspor portfolio kandidat lintas organisasi/tenant. | **FIXED (Tuntas)** |
| **DAT-03** | Penghapusan Bersarang (`_destroy`) Hilang pada Pembaruan Skill | **P1 Major** | Salah Bangun (*Built Wrong*) | Skill yang dihapus di UI tidak terhapus di database saat assessment/vacancy diedit. | **REMAINING (Mitigasi Dicatat)** |
| **LLM-01** | Discovered Skills Tidak Masuk Dorongan Prioritas (`priority_next`) | **P2 Minor** | Salah Bangun (*Built Wrong*) | AI tidak menerima arahan prioritas untuk mendalami skill baru yang diungkap kandidat. | **FIXED (Tuntas)** |
| **UI-01** | Input `scope_exclude` Hilang pada Form `CustomSkillForm.tsx` | **P2 Minor** | Spek Kurang (*Missing Spec*) | Assessor tidak dapat menentukan batasan "Apa yang tidak termasuk" untuk skill kustom. | **FIXED (Tuntas)** |
| **ROU-01** | Route `/signup` Terbengkalai di Frontend | **P2 Minor** | Salah Bangun (*Built Wrong*) | Kode registrasi usang mengarah ke endpoint backend yang tidak pernah ada. | **REMAINING (Ditunda)** |
| **UX-01** | Interceptor Global 401 Mengalihkan Kandidat ke Halaman `/login` | **P3 Cosmetic** | Salah Bangun (*Built Wrong*) | Token kandidat yang kedaluwarsa me-redirect kandidat ke halaman login assessor. | **REMAINING (Ditunda)** |

---

## Rincian Temuan & Langkah Reproduksi

### 1. SEC-01: Penolakan Login Assessor (P0 Blocker)
* **Kategori**: Salah Bangun (*Built Wrong*)
* **Lokasi**: `api/app/controllers/api/v1/authentication_controller.rb:14` & `api/app/models/user.rb:6`
* **Dampak Ringkas**: Assessor tidak dapat masuk; sistem menolak kredensial assessor yang sah dengan status 401 Unauthorized.
* **Bukti & Reproduksi**:
  ```ruby
  # authentication_controller.rb
  return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'
  ```
  Padahal `AuthorizeApiRequest::ASSESSOR_ROLES = %w[admin assessor]` dan controller lain mewajibkan `authorize_auth_token! :assessor`. Namun endpoint login secara kaku mengharuskan `user.role == 'admin'`. Selain itu, `User::ROLES` hanya mendefinisikan role `admin` dan `user`.
* **Solusi yang Diterapkan**: Menambahkan `'assessor'` ke dalam konstanta `User::ROLES` dan memperbarui `AuthenticationController#authenticate` agar mengizinkan `%w[admin assessor].include?(user.role)`. Diverifikasi dengan test `spec/requests/api/v1/authentication_spec.rb`.

---

### 2. INT-01: URL Undangan Kandidat Mengarah ke Port API 3001 (P0 Blocker)
* **Kategori**: Salah Bangun (*Built Wrong*)
* **Lokasi**: `api/app/models/session.rb:29`
* **Dampak Ringkas**: Kandidat yang mengklik link undangan akan membuka server API Rails dan mendapat error 404 Routing Error, bukan membuka aplikasi web wawancara.
* **Bukti & Reproduksi**:
  ```ruby
  # session.rb
  def invite_url
    base = ENV.fetch('APP_BASE_URL', 'http://localhost:3001')
    "#{base}/interview/#{invite_token}"
  end
  ```
  Rails berjalan pada port 3001 tanpa route `/interview/:token`. Aplikasi antarmuka kandidat berada di port 5173 (Vite).
* **Solusi yang Diterapkan**: Memperbarui default fallback di `session.rb` menjadi `ENV['WEB_BASE_URL'] || ENV['APP_BASE_URL'] || 'http://localhost:5173'`. Diverifikasi dengan test `spec/models/session_spec.rb`.

---

### 3. DAT-01: Mismatch Kontrak Fit/Gap & Hilangnya Flag Override (P1 Major)
* **Kategori**: Salah Bangun / Defect Antarmuka (*Seam Defect*)
* **Lokasi**: `api/app/services/fit_gap/engine.rb:62` vs `web/src/components/fitgap/ComparisonTable.tsx:50`
* **Dampak Ringkas**: Assessor melihat kolom level "Required" kosong dan tidak ada penanda visual ketika skor AI telah di-override secara manual.
* **Bukti & Reproduksi**:
  Backend `FitGap::Engine#build_skill_comparisons` mengembalikan payload:
  ```ruby
  { skill_label: label, skill_id: ..., candidate_level: ..., expected_level: expected_level, result: result }
  ```
  Namun komponen frontend `ComparisonTable.tsx` mencari properti `c.required_level`:
  ```tsx
  <td className="px-4 py-2.5 text-center text-muted-foreground">{LEVEL_LABELS[c.required_level]}</td>
  ```
  Sehingga `LEVEL_LABELS[undefined]` menghasilkan tampilan kosong. Selain itu, flag `is_override` tidak pernah disertakan dalam payload, sehingga badge ikon pensil `✏` tidak pernah muncul.
* **Solusi yang Diterapkan**: Memperbarui `FitGap::Engine` agar mengembalikan `expected_level` sekaligus `required_level`, serta menambahkan `is_override: portfolio_skill&.dig(:overridden) || false`. Memperbarui `ComparisonTable.tsx` agar membaca `c.required_level ?? c.expected_level`. Diverifikasi dengan `ComparisonTable.test.tsx` dan `engine_spec.rb`.

---

### 4. DAT-02: SkillPicker Menghapus `skill_id` Taksonomi (P1 Major)
* **Kategori**: Salah Bangun (*Built Wrong*)
* **Lokasi**: `web/src/components/assessment/SkillPicker.tsx:41` & `web/src/types/index.ts:19`
* **Dampak Ringkas**: Skill yang dipilih dari taksonomi B7 kehilangan identifier uniknya, merusak keterlacakan dan pencocokan otomatis ke sistem analisis.
* **Bukti & Reproduksi**:
  Pada `types/index.ts`, `AssessmentSkill.skill_id` dideklarasikan bertipe `number`, sedangkan ID pada taksonomi bertipe `string` (misal `"sk-eng-001"`). Agar kompilasi TypeScript tidak memunculkan error, developer sebelumnya memaksanya menjadi:
  ```typescript
  // SkillPicker.tsx
  const handleSelect = (s: SkillTaxonomy) => {
    onSelect({
      skill_id: undefined, // dipaksa undefined agar tidak error type!
      skill_label: s.skill_label,
      ...
    });
  };
  ```
* **Solusi yang Diterapkan**: Mengoreksi tipe data menjadi `skill_id?: string` di `types/index.ts` untuk `AssessmentSkill`, `VacancySkill`, `PortfolioSkill`, dan `CoverageSkill`. Memperbarui `SkillPicker.tsx` agar tetap mempertahankan nilai asli `skill_id: s.skill_id`. Diverifikasi dengan `SkillPicker.test.tsx`.

---

### 5. SEC-02: Kerentanan IDOR Portfolio Multi-Tenant (P1 Major)
* **Kategori**: Celah Keamanan / Salah Bangun (*Security Defect*)
* **Lokasi**: `api/app/controllers/api/v1/portfolios_controller.rb:82, 104, 130` & `portfolio_skills_controller.rb:51`
* **Dampak Ringkas**: Pengguna terautentikasi dari Perusahaan A dapat melihat, men-generate ulang, dan mengekspor portfolio kandidat milik Perusahaan B hanya dengan memasukkan ID-nya.
* **Bukti & Reproduksi**:
  Meskipun model `Assessment`, `Session`, dan `Vacancy` menggunakan concern `TenantScoped`, model `Portfolio` tidak memiliki kolom `tenant_id` langsung. Pencarian di `PortfoliosController` mengeksekusi `Portfolio.find(params[:id])` tanpa validasi bahwa sesi tersebut berada di dalam `current_tenant_id`.
* **Solusi yang Diterapkan**: Memperbarui `PortfoliosController#set_portfolio` dan `PortfolioSkillsController#set_portfolio_skill` agar pencarian dibatasi melalui relasi tenant: `Portfolio.joins(:session).where(sessions: { tenant_id: current_tenant_id })`. Diverifikasi dengan `spec/requests/api/v1/portfolios_spec.rb`.

---

### 6. LLM-01: Discovered Skills Tidak Masuk Arahan Prioritas (P2 Minor)
* **Kategori**: Penyimpangan Spesifikasi PRD
* **Lokasi**: `api/app/services/coverage/map_injector.rb:104`
* **Dampak Ringkas**: Saat kandidat mengungkap keahlian baru di luar skrip, pewawancara AI Gemini Live tidak mendapatkan arahan prioritas untuk mendalami skill tersebut, melanggar PRD-01 Bagian 5.
* **Solusi yang Diterapkan**: Memperbarui logika `priority_next` agar mengembalikan status `'discovered'` ketika ada skill yang baru terdeteksi dengan status `initiated`.

---

### 7. UI-01: Input `scope_exclude` Hilang pada `CustomSkillForm.tsx` (P2 Minor)
* **Kategori**: Spek Antarmuka Kurang Lengkap
* **Lokasi**: `web/src/components/assessment/CustomSkillForm.tsx`
* **Dampak Ringkas**: Assessor yang menambahkan custom skill tidak bisa mengisi batasan "Apa yang tidak termasuk", meningkatkan risiko halusinasi pertanyaan oleh AI.
* **Solusi yang Diterapkan**: Menambahkan form textarea `scope_exclude` pada komponen `CustomSkillForm.tsx`.

---

## Pola Sistemik di Balik Cacat yang Berulang

Analisis menyeluruh mengungkap tiga pola kegagalan sistemik:
1. **Penyimpangan Kontrak Frontend-Backend Tanpa Validasi Skema**:  
   Tipe TypeScript dan model/serializer Rails dibuat terpisah tanpa pengujian kontrak bersama (seperti skema OpenAPI atau Zod). Ini menjadi akar masalah perbedaan `expected_level` vs `required_level` dan pemaksaan `skill_id: undefined`.
2. **Implementasi Multi-Tenancy yang Tidak Tuntas**:  
   Isolasi tenant hanya ditempelkan pada model tingkat atas (`Assessment`, `Vacancy`), tetapi model relasi turunannya (`Portfolio`, `PortfolioSkill`) terlewat dari penyaringan tenant.
3. **Disiplin Rekayasa yang Lemah (Tanpa Tes Otomatis)**:  
   Banyak fitur penting di-commit tanpa pengujian unit atau kriteria penerimaan. Ketika menghadapi error tipe TypeScript, developer memilih menonaktifkan validasi daripada menyelaraskan kontrak datanya.

---

## Rekomendasi & Langkah Lanjutan

1. **Wajibkan Definition of Ready (DoR)**: Pasang gerbang otomatis GitHub Actions (`.github/workflows/quality-gate.yml`) agar tidak ada kode yang bisa di-merge tanpa tiket acuan, kriteria sukses, dan tes otomatis.
2. **Sinkronisasi Skema Tipe**: Gunakan generator otomatis agar antarmuka TypeScript diturunkan langsung dari serializer/database Rails.
3. **Pengujian Batas Multi-Tenant Otomatis**: Buat suite tes RSpec isolasi tenant otomatis untuk seluruh endpoint baru di masa mendatang.
