# Arsitektur Sistem Kualitas & Cerita Transisi Red-to-Green

**Penulis**: Fullstack Engineer (SDET Depth)  
**Dokumen**: `/assessment/02-quality-system.md`  
**Cakupan**: Alur Kerja Rekayasa, Gerbang CI/CD, Jaring Uji Frontend & Backend  

---

## 1. Ikhtisar Sistem Kualitas (Quality Net)

Kualitas bukanlah fase tambahan yang ditempelkan di akhir sprint; kualitas adalah jaring pengaman rekayasa yang ditanam langsung ke dalam alur kerja developer sejak commit pertama.

Untuk melindungi tim pengembang dan klien dari regresi, kebutuhan yang terlewat, serta kerusakan data, kami membangun **Jaring Kualitas Dua Tingkat (Two-Tier Quality Net)**:
1. **Gerbang Alur Kerja (Definition of Ready / DoR Gate)**: Memastikan tidak ada perubahan kode yang dapat diproses melalui GitHub Pull Request tanpa membawa prasyarat hulu: tautan Spesifikasi/PRD, Kriteria Penerimaan (Acceptance Criteria), Rencana Solusi/Desain, dan Pengujian Otomatis.
2. **Jaring Uji / CI (Verifikasi Kontrak & Regresi Terarah)**: Rangkaian pengujian otomatis menggunakan Vitest (frontend) dan RSpec (backend) yang memvalidasi alur kritis pengguna, batas isolasi multi-tenant, dan kontrak data pada pertemuan frontend-backend.

```
                      [ DEVELOPER PULL REQUEST ]
                                   │
                                   ▼
               ┌────────────────────────────────────────┐
               │    Gerbang Alur Kerja (verify-pr-dor)  │
               │    Cek: Link Spek, AC, Desain, Tes     │
               └───────────────────┬────────────────────┘
                                   │ Lolos (Passed)
                                   ▼
               ┌────────────────────────────────────────┐
               │         Continuous Integration         │
               ├────────────────────┬───────────────────┤
               │ Frontend (Vitest)  │ Backend (RSpec)   │
               │ - Uji kontrak data │ - Isolasi tenant  │
               │ - Integritas tabel │ - Role auth gate  │
               │ - Uji state form   │ - Default model   │
               └────────────────────┴───────────────────┘
                                   │ Lolos (Passed)
                                   ▼
                        [ SIAP MERGE KE MAIN ]
```

---

## 2. Gerbang Alur Kerja: Penerapan Definition of Ready (DoR)

### Cara Kerja Gerbang
* **Template PR (`.github/pull_request_template.md`)**: Mewajibkan pembuat PR untuk mengisi empat bagian utama: Referensi Spek/PRD, Kriteria Penerimaan (Given/When/Then), Rencana Solusi/Desain Teknis, dan Verifikasi Pengujian.
* **Script Pemeriksa Otomatis (`scripts/verify-pr-dor.js`)**: Mengevaluasi payload PR melalui GitHub Actions. Jika salah satu input wajib atau file pengujian tidak ditemukan, alur CI akan langsung gagal dengan pesan kesalahan yang jelas dan memblokir penggabungan kode (*merge*).
* **Efisien & Tanpa Birokrasi Berlebih**: Gerbang mem-parsing bahasa teknis standar (markdown header, link issue/PRD, diff git) tanpa memerlukan integrasi tools eksternal yang rumit.

---

## 3. Cakupan Jaring Uji: Apa yang Dilindungi & Apa yang Sengaja Tidak Dicakup

Alih-alih mengejar target kuantitas coverage 100% pada elemen visual yang tidak berisiko, jaring uji difokuskan pada **jalur pembawa risiko tinggi dan kontrak data antarmuka**:

| File Pengujian | Lapisan Target | Apa yang Dilindungi | Apa yang Sengaja TIDAK Dicakup |
| :--- | :--- | :--- | :--- |
| `web/src/test/ComparisonTable.test.tsx` | Web / UI Seam | Memastikan tabel Fit/Gap membaca kontrak data backend (`required_level` / `expected_level`) dan memunculkan ikon override (`✏`). | Tidak menguji animasi CSS atau token warna Tailwind. |
| `web/src/test/SkillPicker.test.tsx` | Web / Taksonomi | Memastikan pemilihan skill dari taksonomi B7 mempertahankan nilai `skill_id`. | Tidak meniru debounce pencarian jaringan atau dialog modal. |
| `api/spec/requests/api/v1/authentication_spec.rb` | API / Keamanan | Memastikan assessor dapat login dan memperoleh JWT tanpa diblokir oleh filter admin. | Tidak menguji login OAuth pihak ketiga. |
| `api/spec/services/fit_gap/engine_spec.rb` | API / Logika Domain | Memastikan `FitGap::Engine` menghasilkan kontrak perbandingan lengkap sesuai ekspektasi frontend. | Tidak menguji latensi panggilan API Gemini Flash LLM eksternal. |
| `api/spec/models/session_spec.rb` | API / Integrasi | Memastikan method `invite_url` mengarah ke port aplikasi web klien (5173). | Tidak menguji pengiriman fisik email via server SMTP. |
| `api/spec/requests/api/v1/portfolios_spec.rb` | API / Keamanan | Memastikan isolasi data multi-tenant (Perusahaan A tidak bisa membuka/ekspor portfolio Perusahaan B). | Tidak menguji skenario beban traffic ekstrem (DDoS). |

---

## 4. Cara Menjalankan Sistem Kualitas di Lokal

### Menjalankan Gerbang Alur Kerja (DoR Gate)
Untuk menguji apakah commit lokal memenuhi Definition of Ready:
```bash
# Pada direktori root platform:
node scripts/verify-pr-dor.js
```

### Menjalankan Pengujian Frontend (Web)
```bash
cd web
npm install --legacy-peer-deps
npm test
```

### Menjalankan Pengujian Backend (API)
```bash
cd api
bundle exec rspec
```

---

## 5. Cerita Transisi Red-to-Green (Merah ke Hijau)

Sesuai prinsip dasar rekayasa—*Status Hijau harus diraih lewat bukti, bukan dipaksakan*—setiap pengujian diverifikasi **RED (GAGAL)** terlebih dahulu pada kode baseline yang rusak sebelum perbaikan kode mengubah statusnya menjadi **GREEN (LULUS)**.

### Transisi 1: Penghapusan ID Taksonomi di SkillPicker (`SkillPicker.test.tsx`)
* **Kondisi Merah (Red)**:
  ```
  FAIL src/test/SkillPicker.test.tsx
  AssertionError: expected undefined to be 'sk-eng-001'
  - Expected: "sk-eng-001"
  + Received: undefined
  ```
* **Akar Masalah**: File `types/index.ts` mendefinisikan `AssessmentSkill.skill_id` sebagai `number`, padahal taksonomi menggunakan `string` (`sk-eng-001`). Untuk meredam peringatan compiler TypeScript, pengembang sebelumnya memaksanya menjadi `skill_id: undefined`.
* **Perbaikan**: Mengubah `skill_id?: string` pada `types/index.ts` dan mengembalikan nilai asli `skill_id: s.skill_id` pada `SkillPicker.tsx`.
* **Kondisi Hijau (Green)**:
  ```
  ✓ src/test/SkillPicker.test.tsx (1 test)
  Test Files  1 passed (1)
  ```

---

### Transisi 2: Ketidakcocokan Kontrak Tabel Perbandingan Fit/Gap (`ComparisonTable.test.tsx`)
* **Kondisi Merah (Red)**:
  ```
  FAIL src/test/ComparisonTable.test.tsx
  AssertionError: expected false to be true
  - Expected: true
  + Received: false (L3 tidak muncul pada kolom Required)
  ```
* **Akar Masalah**: Backend `FitGap::Engine` mengirimkan `expected_level`, sedangkan komponen frontend `ComparisonTable.tsx` mencari `required_level`, mengakibatkan `LEVEL_LABELS[undefined]` tampil kosong.
* **Perbaikan**:
  - Backend: Menambahkan `required_level: expected_level` dan `is_override: portfolio_skill&.dig(:overridden) || false` pada `FitGap::Engine#build_skill_comparisons`.
  - Frontend: Mengoptimalkan `ComparisonTable.tsx` agar membaca `c.required_level ?? c.expected_level`.
* **Kondisi Hijau (Green)**:
  ```
  ✓ src/test/ComparisonTable.test.tsx (3 tests)
  Test Files  1 passed (1)
  ```

---

### Transisi 3: Penolakan Role Autentikasi Assessor (`authentication_spec.rb`)
* **Kondisi Merah (Red)**:
  ```
  expected: 200 OK
       got: 401 Unauthorized (Invalid email or password)
  ```
* **Akar Masalah**: `AuthenticationController#authenticate` membatasi login hanya untuk `unless user.role == 'admin'`, menolak akun assessor.
* **Perbaikan**: Menambahkan `'assessor'` ke `User::ROLES` di `user.rb` dan mengizinkan `%w[admin assessor]` pada controller autentikasi.
* **Kondisi Hijau (Green)**: Login assessor berhasil dengan status HTTP 200 dan menghasilkan token JWT yang valid.

---

### Transisi 4: Mismatch Port URL Undangan Wawancara (`session_spec.rb`)
* **Kondisi Merah (Red)**:
  ```
  expected "http://localhost:3001/interview/tok-123" not to include ":3001"
  ```
* **Akar Masalah**: Method `Session#invite_url` menggunakan port default 3001 (port API), sehingga link menghasilkan 404 Routing Error saat dibuka oleh kandidat.
* **Perbaikan**: Memperbarui default fallback `Session#invite_url` menjadi port aplikasi web `http://localhost:5173`.
* **Kondisi Hijau (Green)**: URL undangan kandidat berhasil mengarah ke port aplikasi web antarmuka kandidat.

---

### Transisi 5: Celah IDOR Multi-Tenant pada Portfolio (`portfolios_spec.rb`)
* **Kondisi Merah (Red)**:
  ```
  expected: 404 Not Found
       got: 200 OK (Data kandidat lintas perusahaan bocor)
  ```
* **Akar Masalah**: `PortfoliosController` mengeksekusi pencarian tanpa batasan tenant: `Portfolio.find(params[:id])`.
* **Perbaikan**: Menambahkan filter relasi tenant eksplisit: `Portfolio.joins(:session).where(sessions: { tenant_id: current_tenant_id })`.
* **Kondisi Hijau (Green)**: Permintaan akses data lintas tenant langsung ditolak dengan status HTTP 404 Not Found.
