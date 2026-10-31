# Lentera Ekonomi

Portal edukasi ekonomi Indonesia dengan desain editorial responsif, artikel Markdown, kategori, pencarian, SEO, sitemap, RSS, dan Pages CMS.

- Repository: https://github.com/bravocompanion/lenteraekonomi
- Target domain: https://lenteraekonomi.my.id
- CMS: https://app.pagescms.org

## Struktur

- content/articles/ : naskah Markdown dengan frontmatter YAML.
- .pages.yml : konfigurasi CMS visual.
- scripts/build.mjs : generator HTML static tanpa dependensi eksternal.
- public/ : CSS, JavaScript, favicon, dan unggahan media.
- dist/ : hasil build, tidak ikut GitHub.

## Menjalankan

Gunakan Node.js versi 20 atau lebih tinggi dan jalankan: npm run build

Sajikan folder dist/ dengan server statis. Halaman menggunakan link root sehingga preview sebaiknya melalui localhost, bukan membuka file secara langsung.

## Deploy ke Cloudflare Pages

1. Masuk ke https://dash.cloudflare.com → Workers & Pages.
2. Buat aplikasi Pages dan pilih Import an existing Git repository / Connect to Git.
3. Beri akses ke bravocompanion/lenteraekonomi.
4. Production branch: main.
5. Framework preset: None.
6. Build command: npm run build
7. Build output directory: dist
8. Deploy dan pastikan alamat project.pages.dev berfungsi.
9. Buka Custom domains dan tambahkan lenteraekonomi.my.id.

Catatan: untuk domain apex, Cloudflare Pages mensyaratkan domain ditambahkan sebagai Cloudflare DNS zone dengan nameserver Cloudflare. Jika .my.id tidak dapat ditambahkan ke Cloudflare, gunakan www.lenteraekonomi.my.id sebagai alternatif CNAME pada DNS registrar ke project.pages.dev, serta pertimbangkan redirect domain utama yang disediakan registrar. Tambahkan custom domain melalui menu Pages terlebih dahulu, bukan DNS saja.

Panduan: https://developers.cloudflare.com/pages/configuration/custom-domains/

## CMS artikel

1. Buka https://app.pagescms.org dan login memakai GitHub.
2. Pasang / izinkan Pages CMS GitHub App untuk repository bravocompanion/lenteraekonomi.
3. Pilih repository dan branch main.
4. Buka Artikel Ekonomi. Buat atau edit artikel dengan editor visual.
5. Isi judul, ringkasan, kategori, tanggal, penulis, gambar sampul, dan isi artikel.
6. Aktifkan Publikasikan agar artikel tampil di website. Artikel unggulan akan diprioritaskan di beranda.
7. Simpan. Perubahan akan menjadi commit GitHub dan otomatis membangun ulang situs ketika Cloudflare Pages sudah terhubung.

Alamat /admin/ di situs adalah halaman pengantar ke CMS. Login CMS dikelola oleh GitHub, bukan oleh situs ini. Tidak ada password admin di repository.

## Keamanan dan publikasi

Hanya akun dengan izin yang sesuai pada GitHub repository yang dapat mengubah konten. Jangan menyimpan informasi pribadi, password, atau API token di repository publik. Konten adalah edukasi umum, bukan rekomendasi investasi atau nasihat profesional individual.


## Troubleshooting Cloudflare: static files tidak terdeteksi

Sumber situs menghasilkan HTML dalam folder dist melalui npm run build. Folder dist tidak disimpan di Git: Cloudflare harus menjalankan build sebelum deploy.

Jika menggunakan Cloudflare Workers (bukan Pages):

- Worker project name: lenteraekonomi. Nama harus sama dengan properti name dalam wrangler.jsonc.
- Git branch: main
- Root directory: / (repository root)
- Build command: npm run build
- Deploy command: npx wrangler deploy

Konfigurasi wrangler.jsonc menunjuk assets.directory ke ./dist dan mengatur 404 statis.

Jika menggunakan Cloudflare Pages, gunakan Build command npm run build, Build output directory dist dan Framework preset None. Jangan gunakan folder public sebagai output; folder public adalah sumber aset sebelum build.

Apabila nama Worker di dashboard bukan lenteraekonomi, ubah name dalam wrangler.jsonc agar sama. Setelah memperbarui pengaturan Cloudflare, ulangi build (Retry build atau push commit baru).


### Built assets included for Workers Git deploy

The `dist/` directory is now included in Git as a verified initial static asset snapshot so `wrangler deploy` can find it even if Cloudflare's optional Build command was left empty. **For every article/CMS update, the recommended Workers Deploy command is `npm run deploy`, which rebuilds dist from source before publishing**, regardless of the Build command setting. Set Root directory to `/` and Worker name to `lenteraekonomi`. If Cloudflare Workers Build command already says `npm run build`, `npx wrangler deploy` also works, but `npm run deploy` makes the dependency explicit. The checked-in `dist/` serves as a fallback; it is not the source of truth.

If you use Cloudflare Pages rather than Workers, set build command `npm run build` and output directory `dist`.

## CMS pribadi dan autentikasi Cloudflare Workers

Halaman login: /admin/. Setelah login: /admin/editor/.

Editor memakai Cloudflare Worker server-side dan GitHub REST API; Pages CMS yang ada di situs lain tetap memakai login GitHub terpisah.

### Deploy

Aplikasi harus dideploy sebagai **Cloudflare Worker**, bukan Pages statis. Konfigurasi ada di wrangler.jsonc. Gunakan root /, branch main, build command npm run build dan deploy command npm run deploy.

### Wajib: set tiga Secret di Cloudflare

Masuk Cloudflare dashboard → Workers & Pages → lenteraekonomi → Settings → Variables and Secrets. Tambahkan 3 nilai dengan tipe **Secret**:

- ADMIN_PASSWORD: password editor yang ditentukan pemilik website (nilai tidak boleh disimpan di source code).
- SESSION_SECRET: secret acak unik setidaknya 32 karakter untuk menandatangani sesi login; buat dengan password manager.
- GITHUB_TOKEN: fine-grained personal access token GitHub, hanya repository bravocompanion/lenteraekonomi, permissions Contents: Read and write.

Username editor diatur pada server sebagai pakde. Password yang dikirim dalam chat TIDAK otomatis tersimpan sebagai Secret Cloudflare. Pemilik website harus mengisi ADMIN_PASSWORD secara manual; jangan masukkan nilainya atau token GitHub ke repo, file publik, URL, atau percakapan.

Tekan Deploy setelah memasang Secret, atau jalankan deployment ulang dengan perintah yang tercantum. Tanpa ketiga Secret, API akan menolak login dan memberi pesan konfigurasi.

### Fungsi CMS

- Login/logout melalui cookie HttpOnly, Secure dan SameSite Strict dengan sesi delapan jam.
- Halaman /admin/editor/ hanya diberikan setelah autentikasi Worker.
- Tambah, sunting, hapus artikel serta status draft/terbit dan unggulan.
- Upload gambar sampul JPEG, PNG, WebP sampai 1,5 MB.
- Konten disimpan sebagai file Markdown ke GitHub (branch main), lalu memicu rebuild Cloudflare dari commit.
- Draft tidak ditampilkan di website publik.

### Keamanan tambahan

Terdapat pembatasan login best-effort per instance Worker, belum pembatasan global. Atur Cloudflare WAF Rate Limiting untuk POST /api/admin/login (misalnya 5 permintaan dalam 15 menit per IP) dan pertimbangkan Cloudflare Access atau 2FA. Logout menghapus cookie pada browser, tetapi sesi yang telah dicuri belum dapat dicabut secara server-side sampai kedaluwarsa tanpa storage sesi tambahan. Rotasi SESSION_SECRET membatalkan seluruh sesi lama.

### Tes end-to-end

1. Deploy Workers dan set Secret.
2. Buka /admin/ lalu login.
3. Buat artikel draft dan simpan; periksa commit GitHub.
4. Publikasikan, tunggu deploy, lalu periksa halaman artikel.
5. Logout dan pastikan /admin/editor/ mengarahkan kembali ke halaman login.

Catatan: Pages CMS eksternal tetap membutuhkan autentikasi GitHub tersendiri. Sistem login ini hanya mengendalikan editor kustom internal.
