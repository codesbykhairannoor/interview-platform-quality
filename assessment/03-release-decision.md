# Keputusan Rilis & Evaluasi Gerbang Rilis (Release Gate): Versi v1.0.0

**Versi Target**: `v1.0.0`  
**Tanggal Evaluasi**: Oktober 2026  
**Quality Engineer**: Fullstack Engineer (SDET Depth)  
**Pipeline Gate**: GitHub Actions Release Quality Gate (`.github/workflows/release-gate.yml`)  

---

## 1. Keputusan Rilis Eksekutif

```
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║               STATUS: LAYAK RILIS DENGAN SYARAT (CONDITIONAL)         ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

* **Keputusan Akhir**: **RELEASABLE (LAYAK RILIS)** untuk Lingkungan Staging Klien & Uji Coba Produksi Terkendali.
* **Penjelasan untuk Pemangku Kepentingan Non-Teknis**:  
  Seluruh blocker kritis yang menghambat login assessor (P0) dan akses wawancara kandidat (P0) telah diperbaiki dan diverifikasi. Masalah integritas data laporan dan taksonomi (P1) serta celah keamanan multi-tenant (P1) telah tuntas diselesaikan dan lolos uji regresi otomatis. Satu sisa isu P1 non-kritis (penghapusan skill saat edit) telah diungkap secara transparan lengkap dengan prosedur mitigasi operasional dan penanggung jawab (*owner*) di bawah ini.

---

## 2. Ringkasan Verifikasi Gerbang Kualitas

Gerbang Kualitas Rilis (Release Gate) mengevaluasi versi `v1.0.0` berdasarkan empat kriteria otomatis:

| Pemeriksaan Gerbang | Metode Evaluasi | Hasil | Catatan |
| :--- | :--- | :--- | :--- |
| **Gerbang Dokumentasi** | Verifikasi keberadaan `RELEASE_NOTES.md` & Catatan Keputusan | **LOLOS (PASS)** | `RELEASE_NOTES.md` dan `03-release-decision.md` terverifikasi. |
| **Gerbang Alur Kerja (DoR)** | Linter Definition of Ready via `scripts/verify-pr-dor.js` | **LOLOS (PASS)** | Seluruh perubahan menyertakan spek, kriteria penerimaan, dan tes. |
| **Jaring Uji Frontend** | Test Suite Vitest (`npm test`) | **LOLOS (PASS)** | 100% tes komponen kontrak dan taksonomi lulus. |
| **Build Frontend & Tipe** | Kompilasi Produksi Vite (`tsc && vite build`) | **LOLOS (PASS)** | Typecheck TypeScript ketat lulus tanpa error. |
| **Jaring Uji Backend** | Test Suite RSpec (`bundle exec rspec`) | **LOLOS (PASS)** | Tes Autentikasi, URL Sesi, Fit/Gap, dan IDOR lulus 100%. |

---

## 3. Pengungkapan Risiko Sisa & Mitigasi ("Kejujuran Mengalahkan Status Hijau")

Mengacu pada prinsip utama rekayasa kualitas—*Kejujuran lebih penting daripada sekadar memaksakan status hijau*—kami mengungkap seluruh risiko terbuka yang tersisa secara transparan:

### Risiko Sisa DAT-03: Penghapusan Skill Bersarang saat Edit Assessment (Tingkat: P1 Major)
* **Deskripsi**: Saat assessor menghapus skill yang sudah ada pada halaman edit (`AssessmentEditPage.tsx`), item hanya dihapus dari array state tampilan. Karena backend Rails menggunakan `accepts_nested_attributes_for`, penghapusan record anak memerlukan parameter `{ id: ..., _destroy: true }`. Akibatnya, skill yang dihapus saat ini masih tersimpan di database jika form di-update.
* **Dampak Operasional**: Assessor yang menghapus skill pada assessment yang sudah ada mungkin masih melihat skill tersebut muncul di agenda wawancara, kecuali jika dibuat assessment baru.
* **Mitigasi**:
  - Langkah Sementara: Assessor disarankan membuat assessment baru (*Create New Assessment*) jika ingin mengubah susunan skill secara drastis, daripada mengedit assessment yang sedang aktif.
  - Perbaikan Terjadwal: Pull Request perbaikan yang menambahkan flag `_destroy: true` pada `useFieldArray` dijadwalkan meluncur pada patch release `v1.0.1`.
* **Penanggung Jawab Risiko (Owner)**: Tech Lead / SDET Lead (Ahmad Rizky).

### Risiko Sisa ROU-01: Kode Terbengkalai `/signup` (Tingkat: P2 Minor)
* **Deskripsi**: Terdapat file `SignupPage.tsx` usang yang memanggil `/api/v1/signup`. Pada arsitektur produksi, pengguna dibuat melalui mekanisme seeding organisasi oleh admin.
* **Dampak Operasional**: Nol dampak ke pengguna. Route ini tidak dapat diakses melalui navigasi dan tidak didaftarkan pada routing produksi `App.tsx`.
* **Mitigasi**: Pembersihan kode usang (*dead code cleanup*) dijadwalkan pada sprint refactoring berikutnya.
* **Penanggung Jawab Risiko (Owner)**: Frontend Squad Lead.

---

## 4. Rencana Rollback & Pemantauan (Monitoring)

1. **Pemantauan Telemetri & Log**:
   - Pantau lonjakan error 401 pada endpoint `/api/v1/auth/login`.
   - Pantau metrik kestabilan koneksi WebSocket Gemini Live (`/ws/sessions/:id/audio`).
2. **Pemicu Rollback (Rollback Trigger)**:
   - Terjadi penolakan login 401 Unauthorized kembali untuk akun assessor.
   - Terjadi laporan 404 Routing Error saat kandidat membuka link wawancara.
3. **Prosedur Rollback**:
   - Kembalikan container ke tag stabil sebelumnya (`HEAD~1`).
