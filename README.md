# Plan C — Sistem Terpadu Harta & Antam

Sistem terpadu berbasis **Docker + PostgreSQL + FastAPI** yang menggabungkan:
1. **Mode Harta:** Scanner QR/Barcode 2-Step Sequential untuk hardware barcode scanner fisik.
2. **Mode Antam:** Pengambilan & unggah foto terorganisir per folder device (`/photos/{device_id}/`).
3. **Penyimpanan Terpusat:** PostgreSQL database + Docker volume.
4. **Live Counter:** Statistik scan Harta & foto Antam realtime.
5. **Export Excel (.xlsx):** Sekali klik untuk mengunduh rekap Harta, Antam, maupun file gabungan multi-sheet.

---

## 🚀 Cara Menjalankan dengan Docker (Rekomendasi)

### 1. Masuk ke direktori proyek
```bash
cd "C:\Users\mco-user\Desktop\Plan C\plan-c-system"
```

### 2. Jalankan Container
Pastikan Docker Desktop sudah berjalan di komputer server Anda, lalu jalankan perintah:
```bash
docker-compose up -d --build
```

Container backend dan database PostgreSQL akan otomatis menyala:
- Backend: `http://localhost:8089`
- PostgreSQL: Port internal `5432`

---

## 🌐 Cara Akses dari Device Lain di Jaringan LAN

1. Cek IP Address komputer server (host) di command prompt:
   ```cmd
   ipconfig
   ```
   Misalnya IP server adalah `192.168.1.100`.

2. Buka browser di perangkat/laptop/tablet lain yang terhubung ke Wi-Fi / LAN yang sama:
   👉 **`http://192.168.1.100:8089`**

3. Pilih identitas perangkat di pojok kanan atas (contoh: **Device 2** atau **Device 3**). Identitas perangkat akan tersimpan otomatis.

---

## ⚙️ Mengubah Port Aplikasi

Jika port `8089` bentrok dengan container lain, Anda cukup mengedit file `.env`:
```env
API_PORT=8095
```
Lalu restart container:
```bash
docker-compose down
docker-compose up -d
```

---

## 📊 Format Unduhan Excel

Klik tombol **"Export Excel"** di antarmuka web:
- **Harta Saja:** Kolom `No | Waktu Scan | Device ID | URL Harta | ID Mandiri`
- **Antam Saja:** Kolom `No | Waktu Upload | Device ID | Nama File | Relatif Path`
- **Rekap Lengkap (Multi-Sheet):** Sheet 1 (Harta) + Sheet 2 (Antam)
