# Perencanaan Perbaikan Poin 3 dan 4 - Xender-In WhatsApp Automation

## Latar Belakang
Berdasarkan Hasil Investigasi sebelumnya, teridentifikasi dua masalah utama:
1. Masalah "Status Template tidak ada" saat pengiriman pesan (Poin 3)
2. Masalah Asset Handling Error/Retry/Fallback (Poin 4)

## Pendekatan Utama - Force Fetch & Sync saat Send Page Triggered
Solusi utama yang disepakati: Melakukan force fetch dari cloud saat halaman kirim pesan di-trigger, dengan implementasi loading state jika diperlukan sync karena metadata mismatch.

## Poin 3: Status Template Tidak Ada Saat Pengiriman Pesan

### Hasil Investigasi Penyakit
**File Terkait:**
- `src/main\MessageProcessor.ts` - Baris 438-443 (proses pengambilan template)
- `src\main\ipcHandlers.ts` - Baris 120-130 (handler pengiriman job)
- `src\components\SendPage.tsx` - Fungsi pengiriman pesan
- `src\lib\services\TemplateService.ts` - Fungsi fetch template

**Penyebab Utama:**
- Tidak ada force fetch data dari cloud saat halaman pengiriman diakses
- Template bisa null/undefined karena tidak di-load dengan benar atau data tidak sinkron
- Tidak ada pengecekan integritas template sebelum dimulainya proses pengiriman

### Rencana Perbaikan Poin 3

#### 1. Implementasi Force Fetch saat Send Page Di-trigger
- [ ] Modifikasi `SendPage.tsx` untuk memanggil force sync sebelum render
- [ ] Implementasi loading state saat sync berlangsung
- [ ] Tambahkan cek awal apakah perlu sync berdasarkan metadata mismatch
- [ ] Jika metadata cocok, lanjutkan render tanpa loading
- [ ] Jika metadata berbeda, tampilkan loading dialog dan lakukan sync

#### 2. Implementasi Template Integrity Check di Frontend
- [ ] Tambahkan validasi sebelum mengizinkan pengiriman pesan
- [ ] Pastikan template telah dimuat dan valid sebelum menampilkan tombol kirim
- [ ] Tambahkan validasi bahwa template memiliki variants atau content
- [ ] Tambahkan state management untuk menunjukkan kesiapan template

#### 3. Implementasi Template Integrity Check di IPC Handler
- [ ] Tambahkan pengecekan template valid di `ipcHandlers.ts` sebelum memproses job
- [ ] Kembalikan error yang jelas jika template tidak valid
- [ ] Tambahkan logging untuk membantu debugging

#### 4. Implementasi Layer Validasi di MessageProcessor
- [ ] Tambahkan pengecekan early return jika template tidak valid di `MessageProcessor.ts`
- [ ] Kembalikan error yang jelas ke frontend
- [ ] Tambahkan logging untuk proses validasi template

#### 5. Implementasi State Management Template
- [ ] Pastikan template yang dipilih di frontend selalu valid sebelum bisa dikirim
- [ ] Tambahkan loading state sebelum memungkinkan pengiriman

## Poin 4: Asset Handling Error/Retry/Fallback

### Hasil Investigasi Penyakit
**File Terkait:**
- `src\main\WhatsAppManager.ts` - Baris 345-390 (fungsi `sendMessageWithMedia` dan `downloadFile`)
- `src\lib\services\AssetService.ts` - Fungsi cache dan download asset
- `src\components\SendPage.tsx` - Fungsi pemilihan asset
- `src\lib\services\TemplateService.ts` - Fungsi fetch template (karena template bisa memiliki asset)

**Penyebab Utama:**
- Tidak ada force fetch dan validasi asset saat halaman pengiriman diakses
- Tidak ada retry mechanism saat download file gagal
- Tidak ada pre-validation bahwa asset bisa diakses sebelum pengiriman
- Tidak ada jaminan bahwa asset yang akan dikirim benar-benar tersedia

### Rencana Perbaikan Poin 4

#### 1. Implementasi Force Fetch & Validation saat Send Page Di-trigger
- [ ] Modifikasi `SendPage.tsx` untuk juga memvalidasi asset yang terkait dengan template
- [ ] Implementasi force fetch metadata asset dari cloud
- [ ] Tambahkan loading state saat sync asset berlangsung
- [ ] Jika asset metadata mismatch, lakukan sync asset sebelum melanjutkan

#### 2. Implementasi Asset Validation & Caching
- [ ] Tambahkan fungsi untuk memvalidasi asset sebelum pengiriman
- [ ] Pastikan asset yang dipilih telah ter-cache sebelum pengiriman
- [ ] Tambahkan validasi format dan ukuran asset sebelum pengiriman
- [ ] Tambahkan fallback ke asset lokal jika URL tidak bisa diakses

#### 3. Implementasi Retry Mechanism untuk Download Asset
- [ ] Tambahkan exponential backoff retry di fungsi `downloadFile` di `WhatsAppManager.ts`
- [ ] Tambahkan timeout konfigurasi untuk download
- [ ] Tambahkan counter maksimal retry sebelum gagal permanen

#### 4. Implementasi Asset Integrity Check
- [ ] Pastikan asset yang dipilih untuk pengiriman telah disimpan secara lokal dan valid
- [ ] Tambahkan pengecekan bahwa asset tidak hanya memiliki URL tapi juga bisa diakses
- [ ] Tambahkan fungsi untuk verifikasi ketersediaan asset sebelum pengiriman

#### 5. Implementasi Local Asset Availability Guarantee
- [ ] Bangun sistem di mana asset harus disimpan lokal sebelum bisa dipilih
- [ ] Tambahkan proses verifikasi sebelum memperbolehkan penggunaan asset
- [ ] Hanya tampilkan asset yang telah terverifikasi ketersediaannya di UI

## Pendekatan Prevention
Daripada hanya menangani error ketika terjadi, pendekatan ini fokus pada:
1. **Force Fetch & Sync** - Memastikan data selalu aktual sebelum pengiriman
2. **Pencegahan** - Memastikan masalah tidak terjadi di awal
3. **Validasi Ketat** - Memastikan data selalu valid sebelum proses
4. **Integrity Check** - Memastikan semua dependency tersedia sebelum eksekusi
5. **Pre-Validation** - Memastikan semua komponen siap sebelum eksekusi

## Urutan Implementasi
1. Implementasi force fetch & sync saat Send Page di-trigger (untuk template dan asset)
2. Implementasi loading state untuk sync process
3. Implementasi validasi di IPC handler
4. Implementasi retry mechanism untuk asset download
5. Implementasi integrity check di MessageProcessor
6. Testing dan validasi keseluruhan flow

## Hasil yang Diharapkan
- Tidak ada lagi error "Status Template tidak ada" karena data di-force sync sebelum pengiriman
- Tidak ada lagi gagal pengiriman karena asset tidak bisa diakses karena asset telah divalidasi dan dispesifikasikan ketersediaannya sebelum pengiriman
- Pengalaman pengguna lebih baik karena sync otomatis terjadi saat diperlukan
- Loading state yang jelas saat proses sync sedang berlangsung
- Data selalu aktual karena diambil dari cloud saat diperlukan
- Logging lebih jelas untuk debugging