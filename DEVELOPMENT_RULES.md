# PulseNOC - Development Rules & Engineering Standards

Dokumentasi ini menetapkan standar pengembangan, alur percabangan Git, pedoman **Anti-Slop AI**, dan integrasi pipeline otomatis (CI/CD & AI Reviewer) untuk proyek **PulseNOC**.

---

## 1. Visi & Lingkup Proyek

**PulseNOC** adalah platform Network Operations Center (NOC) yang bertugas memantau:
1. **Debian Laptop Monitoring (Local)**:
   - Telemetri hardware dan sistem operasi secara real-time: penggunaan CPU, alokasi memori (RAM), partisi penyimpanan (storage), suhu perangkat (thermals), status baterai, proses aktif, dan performa kartu jaringan.
2. **External Services Monitoring (Remote)**:
   - Pemantauan layanan dan infrastruktur di luar laptop Debian (misal: HTTP/HTTPS REST API, port TCP/UDP, DNS query, ping latency ICMP, database eksternal, dan microservice).

---

## 2. Alur Percabangan Git (Branching Workflow)

> [!IMPORTANT]
> **Larangan Commit Langsung ke `main`**:
> Branch `main` diproteksi secara permanen. Tidak boleh ada commit langsung ke `main`. Semua pengerjaan wajib dilakukan pada branch terisolasi.

### Konvensi Penamaan Branch:
- `feature/<nama-fitur>`: Penambahan fitur baru (misal: `feature/external-icmp-ping`, `feature/disk-health-widget`)
- `fix/<nama-bug>`: Perbaikan bug atau celah sistem (misal: `fix/websocket-reconnect-loop`, `fix/ssh-memory-leak`)
- `refactor/<nama-tugas>`: Restrukturisasi atau optimasi kode tanpa mengubah fungsionalitas
- `chore/<nama-tugas>`: Konfigurasi tool, dependency, CI/CD, atau dokumentasi

### Langkah Pengerjaan:
```bash
# 1. Pastikan main up-to-date
git checkout main
git pull origin main

# 2. Buat branch baru dari main
git checkout -b feature/nama-fitur-baru

# 3. Lakukan pengerjaan dengan standar Anti-Slop AI
# ...

# 4. Verifikasi seluruh checks secara lokal sebelum push
./scripts/verify-pipeline.sh

# 5. Commit dan push branch ke origin
git add .
git commit -m "feat(prober): implement external tcp service probe"
git push -u origin feature/nama-fitur-baru

# 6. Buka Pull Request (PR) ke main melalui GitHub
```

---

## 3. Standar Anti-Slop AI (Code & UI)

Setiap pengerjaan (baik oleh developer maupun AI Assistant Jarvis) wajib mengaktifkan skill `antislop` (`.agents/skills/antislop/`):

### A. Standar Kode (Anti-Slop Code)
1. **Strict TypeScript & Zero `any`**:
   - Dilarang keras menggunakan tipe `any` sebagai jalan pintas.
   - Gunakan interface, DTO, discriminated unions, atau `unknown` dengan type-guarding (`typeof`, `instanceof`, Zod/class-validator).
2. **Defensive Error Handling**:
   - Dilarang menulis catch block kosong (`catch (_) {}`).
   - Setiap error harus dicatat dengan log kontekstual (service, timestamp, input params) atau dilempar ulang sebagai domain exception yang terdefinisi.
3. **Pembersihan Resource (No Memory Leaks)**:
   - Pastikan koneksi SSH, socket channel, interval timer, dan database pool selalu ditutup/dibersihkan saat komponen/service di-destroy.
4. **Tidak Ada Kode Placeholder**:
   - Dilarang meninggalkan mock palsu atau `// TODO: nanti diimplementasikan` di alur produksi.

### B. Standar Tampilan (Anti-Slop UI/UX)
1. **Estetika NOC (Cyber / Modern Dark-Mode)**:
   - Bukan template AI generik dengan kartu pastel kosong.
   - Layout berdensitas informasi tinggi dengan kontras yang jelas dan ambient neon telemetry.
   - Gunakan font monospace untuk data teknis: IP Address, Port, Latency (ms), CPU (%), dan Timestamp.
2. **Indikator Status Real-time**:
   - Status koneksi WebSocket harus selalu terlihat (Connected, Reconnecting, Disconnected).
   - Skema warna semantik:
     - 🟢 **Healthy / Up**: `#10b981`
     - 🟡 **Warning / Degraded**: `#f59e0b`
     - 🔴 **Error / Down**: `#ef4444`
     - 🚨 **Critical**: `#f43f5e` (animasi pulse)
     - ⚪ **Unknown / Stale**: `#64748b`
3. **State Feedback**:
   - Skeleton loader yang menyerupai bentuk grafik/tabel aslinya.
   - Empty state yang komunikatif disertai aksi pemulihan/tambah data.

---

## 4. Pipeline CI/CD (Checks, Test & Build)

Setiap Pull Request yang masuk akan memicu pipeline **GitHub Actions CI** (`.github/workflows/ci.yml`):

1. **Linting & Code Style**:
   - Backend: `npm run lint` (ESLint)
   - Frontend: `npm run lint` (Next ESLint)
2. **Type Checking**:
   - Backend & Frontend: `tsc --noEmit`
3. **Automated Tests**:
   - Backend & Frontend: `npm run test` (Jest test suite)
4. **Production Build**:
   - Backend: `npm run build` (NestJS build)
   - Frontend: `npm run build` (Next.js build)

Jika salah satu tahap gagal, PR tidak dapat di-merge.

---

## 5. Pipeline AI Reviewer: Security, Performance & Bug Gatekeeper

Pipeline **AI Code Reviewer** (`.github/workflows/ai-code-reviewer.yml`) secara otomatis menganalisis setiap `pull_request` terhadap `main`. AI mengaudit diff kode secara mendalam khusus pada aspek **Security**, **Performance**, **Bugs & Reliability**, dan **Saran Enhancement**.

### Kategori Temuan AI Reviewer:

| Kategori | Deskripsi | Status Merge |
| :--- | :--- | :--- |
| **Low** | Saran enhancement, minor code style, peningkatan keterbacaan kode tanpa mengubah fungsionalitas. | ✅ **Boleh Merge** |
| **Medium** | Saran optimasi performa non-kritis, refactoring ringan, defensive programming tweaks. | ✅ **Boleh Merge** |
| **High** | Bug logika, performa lambat/bottleneck parah, potensi memory leak, unhandled fatal exceptions, risiko celah keamanan. | ⛔ **DILARANG MERGE** |
| **Critical** | Kebocoran kredensial/rahasia, celah eksploitasi fatal (RCE, injection), server crash, risiko korupsi/kehilangan data. | ⛔ **DILARANG MERGE** |

### Aturan Gatekeeping:
- Apabila ditemukan **minimal 1 temuan berlabel `High` atau `Critical`**, pipeline akan **FAIL (Exit Code 1)**.
- GitHub status check akan menandai review sebagai gagal dan memblokir tombol merge PR.
- Developer harus memperbaiki temuan tersebut pada branch, kemudian push ulang untuk memicu re-evaluasi otomatis oleh AI Reviewer.

---

## 6. Pipeline CD Otomatis ke Laptop Debian (Self-Hosted Runner)

Setiap Pull Request yang berhasil dimerge ke branch `main` akan memicu pipeline Continuous Deployment (CD) otomatis (`.github/workflows/deploy.yml`):
1. **Target Host**: Laptop Debian yang menjalankan GitHub Actions Self-Hosted Runner (`runs-on: [self-hosted, linux]`).
2. **Eksekusi Deployment**:
   - Kode terbaru ditarik langsung ke host runner.
   - Stack kontainer di-*rebuild* dan di-*restart* di background menggunakan Docker Compose:
     ```bash
     docker compose up -d --build --remove-orphans
     ```
   - Health check memvalidasi bahwa kontainer `pulsenoc-backend` (port 4000) dan `pulsenoc-frontend` (port 3002) berjalan normal.

