# 🛡️ DOKUMEN TRANSPARANSI & STATUS RBAC (SEPTEMBER MVP)
> **Status Implementasi:** Opsi 2B — Role-Based Workspace View  
> **Target System:** Human Firewall Lite Platform  
> **Tanggal Update:** 3 Agustus 2026  

---

## 📌 Executive Statement & Definisi Sistem

Sistem autentikasi dan otorisasi saat ini berada pada tahap **Role-Based WORKSPACE VIEW (Frontend Navigation Filtering)**, dan **BUKAN Role-Based ACCESS CONTROL (End-to-End Backend Enforcement)** penuh.

Keputusan ini adalah **keputusan teknis yang diambil secara sadar (Conscious Architectural Decision)** untuk memenuhi tenggat waktu MVP/Demo September 2026 secara stabil, tanpa mempertaruhkan kestabilan routing utama backend Flask yang sudah berjalan.

---

## 🧭 Arsitektur Pembagian 4 Role

Platform mengelompokkan pengguna admin menjadi 4 peran spesifik:

```text
               ┌─────────────────────────────────────────┐
               │          HUMAN FIREWALL RBAC            │
               └────────────────────┬────────────────────┘
                                    │
       ┌──────────────────┬─────────┴────────┬──────────────────┐
       ▼                  ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  PHISHING    │   │     SOC      │   │     GRC      │   │     CISO     │
│    ADMIN     │   │   ANALYST    │   │  SPECIALIST  │   │  EXECUTIVE   │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │                  │
  /dashboard/        /dashboard/        /dashboard/        /dashboard/
 phishing-admin         soc                grc                ciso
```

### Rincian Workspace:
1. **Phishing Admin (`/dashboard/phishing-admin`):**
   - **Tugas:** Eksekusi simulasi, impor landing page, generate email AI, kelola roster.
   - **Fitur Write:** GoPhish Launch/Delete, Site Importer, Resource Manager, Add/Edit Employee, Roster Sync.
2. **SOC Analyst (`/dashboard/soc`):**
   - **Tugas:** Triage insiden real-time, penanganan blokir ancaman, investigasi Agentic AI.
   - **Fitur Write:** Incident Resolve/Reopen, Threat Cache Manager, Policy Engine Audit, Agentic Investigator.
3. **GRC Specialist (`/dashboard/grc`):**
   - **Tugas:** Monitoring kepatuhan, skor gamifikasi, laporan risiko divisi, ekspor PDF eksekutif.
   - **Fitur Manage:** Leaderboard & Badge Manager, Compliance & Financial Impact Map, Executive PDF Export.
4. **CISO Executive (`/dashboard/ciso`):**
   - **Tugas:** Read-only executive summary untuk direksi.
   - **Fitur:** Visibility penuh ke seluruh 17 komponen sistem dengan tombol aksi yang **secara ketat di-disable (readOnly={true})**.

---

## ⚠️ Transparansi Security Debt (Hutang Keamanan Backend)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                         PERINGATAN AUDIT TEKNIS                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Backend Flask saat ini masih menerapkan model ALL-OR-NOTHING.           │
│  Pengguna dengan token admin valid secara teknis masih dapat memanggil   │
│  API endpoint apa saja secara langsung (curl/Postman).                   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Rincian Endpoint yang Terdampak (`// TODO SECURITY DEBT`):
1. **`/api/incidents` (`PATCH`)**: Harusnya dibatasi hanya untuk `SOC`.
2. **`/api/admin/gophish/*` (`POST`, `DELETE`)**: Harusnya dibatasi hanya untuk `Phishing Admin`.
3. **`/api/policy` (`POST`)**: Harusnya dibatasi hanya untuk `SOC`.
4. **`/api/admin/employees` (`POST`, `PUT`)**: Harusnya dibatasi hanya untuk `Phishing Admin`.

---

## 🚀 Roadmap Pasca-MVP (Post-September Release)

Pada fase rilis selanjutnya (Post-MVP), sistem RBAC akan ditingkatkan menjadi **Opsi 3 (End-to-End Enforcement)**:
1. **Database Schema:** Membuat tabel `users` & `roles` resmi di SQLite.
2. **Flask Route Decorators:** Memasang `@require_role('soc')`, `@require_role('phishing_admin')` di seluruh blueprint Flask backend.
3. **JWT Scope Token:** Mengganti cookie session sederhana dengan signed JWT token yang memuat klaim `scope`.
