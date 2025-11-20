# Root Cause Analysis: Dashboard Initialization Failure

This document provides a detailed root cause analysis of the "No master user ID available" error occurring during the application's initialization in the `Dashboard` component.

## 1. Analisis Log & Alur Eksekusi

### Analisis Log
Log yang diberikan menunjukkan urutan kejadian sebagai berikut:
```
1. UserContextManager.ts:155 User context established for: andry@xalesin.id (Master: ce73a29f-b232-439d-b10f-90c8868513f9)
2. supabase.ts:178 Getting user quota for: ce73a29f-b232-439d-b10f-90c8868513f9
3. UserContextManager.ts:155 User context established for: andry@xalesin.id (Master: ce73a29f-b232-439d-b10f-90c8868513f9)
4. supabase.ts:178 Getting user quota for: ce73a29f-b232-439d-b10f-90c8868513f9
5. 2supabase.ts:201 Found quota data: 1 records
6. Dashboard.tsx:64 App initialization failed: Error: No master user ID available. Please log in again.
```

**Interpretasi:**
*   **Panggilan Ganda:** Log "User context established" dan "Getting user quota" muncul dua kali. Dalam konteks React, ini sangat mengindikasikan bahwa komponen yang memicu logika ini (kemungkinan komponen level atas seperti `App.tsx` atau `LoginPage.tsx` yang kemudian me-render `Dashboard.tsx`) mengalami **re-render**. Panggilan ganda ini bisa disebabkan oleh perubahan state, perubahan props, atau efek dari React Strict Mode yang memanggil `useEffect` dua kali dalam development.
*   **Urutan Asinkron:** Meskipun konteks pengguna tampaknya berhasil dibuat (log #1 dan #3), error di `Dashboard.tsx` (log #6) tetap terjadi. Ini menunjukkan adanya *race condition*. `Dashboard.tsx` dieksekusi dan mencoba mengambil `master_user_id` **sebelum** proses penetapan konteks di `UserContextManager` selesai dan nilainya stabil dan dapat diakses secara sinkron.

### Alur Eksekusi di `Dashboard.tsx`
1.  Komponen `Dashboard` di-mount.
2.  `useEffect` dengan dependency array kosong `[]` dipanggil satu kali setelah render pertama.
3.  Di dalam `useEffect`, `initializeApp()` dieksekusi.
4.  `initializeApp()` memanggil `await userContextManager.getCurrentMasterUserId()`.
5.  Di dalam `UserContextManager.ts`, `getCurrentMasterUserId()` memanggil `await this.getCurrentUser()`.
6.  `getCurrentUser()` memeriksa `this.currentUser`. Pada render pertama, `this.currentUser` kemungkinan besar masih `null` karena proses `setCurrentUser` yang asinkron (dipicu oleh login atau perubahan state auth) belum selesai.
7.  Karena `getCurrentUser()` mengembalikan `null`, maka `getCurrentMasterUserId()` juga mengembalikan `null`.
8.  Kembali di `Dashboard.tsx`, `masterUserId` menjadi `null`, kondisi `if (!masterUserId)` menjadi `true`.
9.  `throw new Error('No master user ID available...')` dieksekusi pada baris 44, yang kemudian ditangkap oleh `catch` block dan dicatat sebagai error di baris 64.

## 2. Evaluasi Hipotesis & Referensi Arsitektur

### Validasi Hipotesis
1.  **Masalah Timing/Race Condition (Sangat Mungkin Benar):**
    *   **Bukti:** Alur eksekusi di atas secara jelas menunjukkan race condition. `Dashboard.tsx`'s `useEffect` berjalan secara independen dari proses login dan penetapan konteks. `userContextManager.getCurrentMasterUserId()` adalah `async` tetapi cara pemanggilannya di `Dashboard.tsx` mengasumsikan bahwa state di dalam `userContextManager` sudah siap.
    *   **Referensi Arsitektur (`RE_ARCHITECTURE_PLAN.md`):** Dokumen ini secara eksplisit menyatakan masalah ini di bagian `1.1 Current Issues`: *"UserContextManager tidak guarantee ter-set sebelum service dipanggil"*. Rencana re-arsitektur di `Phase 2` bertujuan menjadikan `Dashboard` sebagai orkestrator yang memastikan `masterUserId` ada **sebelum** menginisialisasi service lain. Kode yang ada saat ini adalah implementasi dari rencana tersebut, namun tampaknya gagal menangani momen transisi ketika `userContextManager` itu sendiri belum siap.

2.  **Masalah Backend/Data (Kurang Mungkin Benar sebagai Penyebab Utama):**
    *   **Bukti:** Log `User context established for: ... (Master: ce73a29f-...)` menunjukkan bahwa `master_user_id` **berhasil didapatkan** dari suatu tempat (kemungkinan dari Supabase setelah auth berhasil) dan sedang dalam proses penetapan di `UserContextManager`. Jadi, datanya ada di backend. Masalahnya adalah ketersediaannya di *client-side* pada saat yang tepat.
    *   **Referensi Arsitektur:** Arsitektur mendefinisikan bahwa `master_user_id` adalah kunci untuk semua operasi. Jika data ini tidak ada di backend, seluruh aplikasi akan gagal lebih awal, kemungkinan besar saat login, bukan di dalam `Dashboard`.

### Deviasi dari Arsitektur
Alur yang terlihat di log tidak menyimpang dari *rencana* arsitektur, melainkan menunjukkan kelemahan dalam implementasi rencana tersebut. Rencana di `RE_ARCHITECTURE_PLAN.md` (Phase 2, 2.1) adalah:
```typescript
// 1. Get master user ID
const masterUserId = await userContextManager.getCurrentMasterUserId();
if (!masterUserId) throw new Error('No master user ID available');
// 2. Initialize all services
...
```
Kode ini mengasumsikan `userContextManager` adalah sebuah state machine yang statusnya sudah `ready` saat `Dashboard` di-render. Kenyataannya, `userContextManager` adalah sebuah *singleton class* yang state internalnya (`this.currentUser`, `this.currentMasterUserId`) diisi secara asinkron. Tidak ada mekanisme *subscription* atau *state management* (seperti React Context atau Zustand) yang diekspos oleh `userContextManager` untuk memberitahu komponen seperti `Dashboard` kapan datanya siap.

## 3. Identifikasi Akar Masalah

**Akar Masalah Utama:** **Manajemen State yang Tidak Reaktif dan Asinkron.**

`UserContextManager` dirancang sebagai singleton, tetapi state internalnya (`currentUser` dan `currentMasterUserId`) diatur secara asinkron. Komponen `Dashboard` tidak memiliki cara untuk "menunggu" atau "bereaksi" terhadap perubahan state internal di dalam `UserContextManager`.

Secara spesifik:
1.  **Render Awal:** `Dashboard` render untuk pertama kalinya.
2.  **Konteks Belum Siap:** Pada saat itu, `userContextManager.currentUser` masih `null`.
3.  **Eksekusi `useEffect`:** `useEffect` di `Dashboard` langsung berjalan dan memanggil `initializeApp`.
4.  **Kegagalan Pengambilan ID:** `initializeApp` memanggil `userContextManager.getCurrentMasterUserId()`, yang langsung mengembalikan `null` karena state internalnya belum diisi.
5.  **Error Dilempar:** Aplikasi melempar error `No master user ID available`.

Log `User context established` yang muncul menunjukkan bahwa di *event loop* berikutnya, proses `setCurrentUser` di `UserContextManager` sebenarnya berhasil. Namun, `Dashboard` sudah terlanjur gagal pada render pertamanya dan masuk ke state `error`. Re-render yang menyebabkan log ganda hanya memperburuk kondisi, tetapi bukan penyebab utama. Penyebab utamanya adalah **ketidaksesuaian antara siklus hidup komponen React yang sinkron dan inisialisasi state yang asinkron.**

## 4. Rekomendasi Langkah Investigasi Lanjutan

Untuk mengkonfirmasi diagnosis ini, developer harus melakukan langkah-langkah berikut:

1.  **Lacak State Internal `UserContextManager`:**
    *   Tambahkan `console.log` di dalam konstruktor dan di awal setiap method publik dari `UserContextManager` untuk melihat kapan instance dibuat dan method dipanggil.
    *   **Lokasi:** `src/lib/security/UserContextManager.ts`
    *   **Contoh:**
        ```typescript
        // Di dalam method getCurrentMasterUserId
        public async getCurrentMasterUserId(): Promise<string | null> {
          console.log('[Debug] getCurrentMasterUserId called. Current internal master ID is:', this.currentMasterUserId);
          const user = await this.getCurrentUser();
          console.log('[Debug] getCurrentUser returned:', user);
          return user?.master_user_id || null;
        }

        // Di dalam method setCurrentUser
        public async setCurrentUser(user: User, sessionToken?: string): Promise<void> {
          console.log('[Debug] setCurrentUser CALLED for user:', user.email);
        }
        ```

2.  **Verifikasi Alur Login dan Transisi ke Dashboard:**
    *   Periksa komponen yang bertanggung jawab untuk login (kemungkinan `LoginPage.tsx`). Lacak bagaimana `userContextManager.setCurrentUser` dipanggil setelah login berhasil dan **sebelum** navigasi ke `/dashboard`.
    *   Tambahkan `console.log` tepat sebelum navigasi untuk memastikan `setCurrentUser` sudah di-`await`.

3.  **Gunakan Breakpoint di Browser DevTools:**
    *   Letakkan breakpoint pada baris `const masterUserId = await userContextManager.getCurrentMasterUserId();` di `Dashboard.tsx:42`.
    *   Saat breakpoint kena, periksa nilai dari `userContextManager.currentUser` dan `userContextManager.currentMasterUserId` di console. Ini akan secara definitif menunjukkan bahwa nilainya `null` pada panggilan pertama.

4.  **Query Manual ke Supabase (untuk menyingkirkan hipotesis backend):**
    *   Gunakan Supabase SQL Editor atau MCP Supabase untuk menjalankan query berikut dan memastikan data user memang ada dan konsisten.
    *   **Query:**
        ```sql
        SELECT id, master_user_id, role, is_active 
        FROM profiles 
        WHERE id = 'ce73a29f-b232-439d-b10f-90c8868513f9';
        ```
    *   Ini akan memastikan bahwa hipotesis #2 (masalah data) benar-benar tidak relevan.

Langkah-langkah ini akan memberikan bukti konkret bahwa masalahnya adalah *timing* dan *state management*, bukan ketiadaan data di backend.