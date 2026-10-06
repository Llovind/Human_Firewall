"""Short "why" texts for the seeded quiz questions (Indonesian, like the questions).

Keyed by the first 80 characters of the question so existing databases are filled in too."""

EXPLANATIONS = {
  "Anda menerima email dari HRD meminta Anda segera memverifikasi nomor rekening ba": "Email yang meminta data keuangan lewat tautan hampir selalu penipuan, walau terdengar menguntungkan. Hubungi HRD lewat nomor resmi yang sudah Anda kenal, bukan nomor atau tautan dari email itu.",
  "Apa tanda utama email phishing yang memanfaatkan urgensi emosional (Urgency)?": "Penipu ingin Anda bertindak sebelum sempat berpikir. Batas waktu yang mendesak adalah tanda paling umum dari phishing.",
  "Jika Anda menerima email mencurigakan dari alamat internal yang meminta verifika": "Jangan membalas atau mengeklik apa pun. Teruskan ke kanal keamanan resmi supaya tim bisa memeriksa tanpa Anda ikut berisiko.",
  "Apa yang dimaksud dengan 'Spear Phishing'?": "Spear phishing dibuat khusus untuk satu orang atau perusahaan, sering memakai nama atasan atau proyek asli, sehingga terlihat sangat meyakinkan.",
  "Anda menerima email simulasi phishing. Anda mendeteksi bahwa tautannya palsu. Ap": "Melaporkan tautan palsu membantu tim keamanan melindungi rekan lain. Jangan mengeklik, dan jangan meneruskannya ke orang lain.",
  "Mengapa taktik 'Teachable Moment' penting setelah karyawan tidak sengaja mengkli": "Pelajaran paling melekat saat orang baru saja menyadari kesalahannya. Karena itu edukasi diberikan tepat setelah klik, bukan berminggu-minggu kemudian.",
  "Anda menerima email yang mengaku dari rekan setim Anda, namun alamat email pengi": "Alamat pengirim yang mirip aslinya tapi salah satu huruf (typosquatting) adalah trik umum. Selalu baca alamat email lengkap, bukan hanya nama pengirim.",
  "Apa risiko terbesar dari mengklik gambar di dalam email spam dari pengirim tidak": "Gambar di email spam bisa memuat kode yang mengunduh malware tanpa Anda sadari (drive-by download). Jangan buka gambar dari pengirim tak dikenal.",
  "Jika Anda tidak sengaja memasukkan password akun kantor ke form login dari link ": "Ganti kata sandi segera dan laporkan ke SOC supaya akses penyerang bisa ditutup dan akun lain dicek. Semakin cepat, semakin kecil kerusakannya.",
  "Teknik manipulasi psikologis apa yang biasa digunakan penyerang agar korban tida": "Penyerang membuat korban panik atau tergiur agar tidak berpikir kritis. Jika sebuah pesan membuat Anda terburu-buru, berhenti dan periksa dulu.",
  "Seseorang menelepon Anda mengaku dari tim IT Dukungan Pusat dan meminta Anda mem": "Tim IT resmi tidak pernah meminta kode OTP. Kode itu hanya untuk Anda; siapa pun yang memintanya sedang mencoba masuk ke akun Anda.",
  "Taktik 'Baiting' dalam rekayasa sosial sering kali melibatkan:": "Baiting memancing rasa penasaran, misalnya flash disk yang \"tertinggal\". Jangan colok perangkat tak dikenal; serahkan ke tim keamanan.",
  "Apa yang dimaksud dengan rekayasa sosial (Social Engineering)?": "Rekayasa sosial menyerang manusia, bukan sistem: penyerang membujuk orang agar sendiri memberikan informasi atau akses.",
  "Seseorang tak dikenal mengikuti Anda di belakang melewati pintu masuk kantor tan": "Tailgating memanfaatkan sikap sungkan. Minta orang itu menempelkan kartunya sendiri atau laporkan ke sekuriti; itu bukan sikap tidak sopan.",
  "Penyerang rekayasa sosial sering kali berpura-pura menjadi figur otoritas (seper": "Orang cenderung patuh pada atasan atau pihak berwenang. Penyerang memakai itu agar Anda tidak bertanya. Perintah mendesak tetap perlu diverifikasi lewat jalur resmi.",
  "Metode 'Pretexting' dalam social engineering melibatkan:": "Pretexting memakai cerita bohong yang masuk akal, misalnya audit atau kunjungan vendor, supaya korban mau memberikan data.",
  "Apa arti 'Vishing' dalam variasi rekayasa sosial?": "Vishing adalah phishing lewat telepon. Penelepon bisa terdengar profesional; jika diminta data sensitif, tutup dan hubungi balik lewat nomor resmi.",
  "Karakteristik password yang kuat menurut standar keamanan modern adalah:": "Kata sandi yang panjang dan beragam jauh lebih sulit ditebak. Panjang minimal 12 karakter dengan huruf besar, huruf kecil, angka, dan simbol adalah standar yang aman.",
  "Mengapa penggunaan Multi-Factor Authentication (MFA) sangat direkomendasikan?": "MFA menambah satu langkah verifikasi, sehingga kata sandi yang bocor saja tidak cukup bagi penyerang untuk masuk.",
  "Apa bahaya menggunakan password yang sama untuk akun personal (seperti e-commerc": "Kata sandi yang sama di banyak akun berarti satu kebocoran membuka semuanya, termasuk akun kantor. Pakai kata sandi berbeda untuk tiap akun.",
  "Apa itu 'Credential Stuffing'?": "Credential stuffing mencoba kombinasi email dan kata sandi hasil kebocoran ke banyak situs sekaligus. Kata sandi unik di tiap akun membuatnya gagal.",
  "Kapan waktu terbaik untuk mengganti password akun kantor Anda?": "Ganti kata sandi segera jika ada tanda kebocoran atau Anda salah klik. Menunggu hanya memberi penyerang waktu lebih lama.",
  "Bagaimana cara aman untuk menyimpan password yang banyak dan kompleks?": "Password manager korporat menyimpan banyak kata sandi kompleks terenkripsi, jadi Anda tidak perlu mengingat atau menuliskannya.",
  "Apa fungsi utama dari pengamanan 'OTP' (One-Time Password)?": "OTP berlaku sebentar dan sekali pakai, jadi kode yang dicuri cepat kedaluwarsa. Tetap jangan pernah membagikannya.",
  "Manakah dari domain URL berikut yang merupakan domain resmi perusahaan PT Infran": "Domain resmi harus sama persis. Alamat yang mirip, atau diawali nama perusahaan tapi berakhir di domain lain, bukan milik perusahaan.",
  "Protokol HTTPS (https://) di awal alamat URL menandakan bahwa:": "HTTPS berarti data antara browser dan server dienkripsi. Itu tidak menjamin situsnya terpercaya: situs penipuan pun bisa memakai HTTPS.",
  "Anda melihat link dengan alamat: http://infranexia.co.id.attacker-domain.com/log": "Bagian yang menentukan tujuan adalah domain tepat sebelum garis miring pertama. Di sini domainnya attacker-domain.com; \"infranexia.co.id\" hanya subdomain palsu di depannya.",
  "Taktik 'URL Shortener' (seperti bit.ly atau tinyurl) sering disalahgunakan peret": "Pemendek tautan menyembunyikan alamat asli. Penyerang memakainya agar tautan berbahaya terlihat biasa. Periksa tujuan sebelum membuka.",
  "Apa itu 'Quishing'?": "Quishing menyembunyikan tautan berbahaya di balik kode QR. Jangan memindai kode QR dari sumber yang tidak Anda percaya.",
  "Anda mengarahkan kursor (hover) ke sebuah link di email kantor, teks link menuli": "Teks tautan bisa dipalsukan, tetapi alamat tujuan yang muncul saat kursor diarahkan tidak. Jika berbeda, itu penipuan."
}
