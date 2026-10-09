# Catatan Rilis (Release Notes) — Platform AI Interview v1.0.0

**Tanggal Rilis**: Oktober 2026  
**Versi**: `v1.0.0`  
**Status Kualitas**: LAYAK RILIS / RELEASABLE (Diverifikasi oleh Gerbang Kualitas Otomatis)  

---

## Apa yang Dihadirkan pada Versi v1.0.0

Rilis ini menghadirkan fondasi stabil dari **Platform AI Interview**, mentransformasikan prototipe awal menjadi sistem yang aman, andal, dan siap digunakan oleh klien rekrutmen.

### Kemampuan Utama yang Dirilis

1. **Mesin Wawancara Audio Real-time Otonom**:
   - Streaming audio interaktif dua arah antara kandidat dan model Google Gemini Live.
   - Pelacakan cakupan kompetensi secara dinamis yang mengevaluasi jawaban teknis berdasarkan anchor perilaku (L1–L5).
   - Kontrol ritme dan penutupan wawancara otomatis sesuai batas waktu yang ditentukan.

2. **Portfolio Kompetensi Otomatis & Analisis Fit/Gap**:
   - Evaluasi otomatis pasca-wawancara yang mengekstrak kutipan langsung kandidat sebagai bukti kompetensi.
   - Perhitungan matematis kecocokan kandidat (Fit/Gap) terhadap standar kebutuhan lowongan pekerjaan.
   - Alur kerja override nilai oleh assessor manusia (*human-in-the-loop*).
   - Ekspor laporan portfolio dalam format PDF dan JSON dengan satu klik.

---

## Perbaikan Kritis yang Disertakan pada v1.0.0

* **[P0 Blocker Tuntas] Autentikasi Assessor**: Memperbaiki isu penolakan login untuk pengguna ber-role `assessor`. Assessor kini dapat masuk dan mengelola evaluasi kandidat dengan lancar.
* **[P0 Blocker Tuntas] Resolusi Link Undangan Wawancara**: Memperbaiki port default URL undangan ke port aplikasi web (5173), mencegah terjadinya 404 Routing Error pada kandidat.
* **[P1 Major Tuntas] Penyelarasan Kontrak Fit/Gap**: Menyelaraskan atribut `required_level` dan `expected_level` antara backend dan frontend, memperbaiki kolom kebutuhan yang kosong, serta mengembalikan penanda pensil override (`✏`).
* **[P1 Major Tuntas] Keterlacakan Taksonomi**: Memperbaiki issue pada `SkillPicker` di mana pemilihan skill dari taksonomi B7 membuang nilai `skill_id` menjadi `undefined`.
* **[P1 Major Tuntas] Isolasi Multi-Tenant pada Portfolio**: Menerapkan filter tenant yang ketat pada akses dan ekspor portfolio, menutup celah keamanan IDOR lintas tenant.

---

## Sistem Kualitas & Verifikasi

* **Gerbang Alur Kerja (DoR)**: Terverifikasi melalui linter otomatis Pull Request (`scripts/verify-pr-dor.js`).
* **Suite Regresi Otomatis**: Lulus 100% pada suite pengujian frontend (Vitest) dan backend (RSpec).
* **Catatan Keputusan Rilis**: Terdokumentasi lengkap pada [`assessment/03-release-decision.md`](assessment/03-release-decision.md).
