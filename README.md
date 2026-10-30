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
