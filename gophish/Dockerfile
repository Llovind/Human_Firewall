FROM gophish/gophish@sha256:8a57cd171999dcd1fa33f346d6898440913ae14be114ffc850cc678354672d29

# Image dasar GoPhish menjalankan aplikasi sebagai user "app" (bukan root),
# tapi folder yang dibuat Docker secara otomatis untuk named volume
# defaultnya dimiliki root. Ini menyebabkan GoPhish gagal menulis
# gophish.db ke folder tersebut ("no such file or directory" / permission
# issue terselubung). Baris di bawah memastikan folder database/ sudah
# ada DAN dimiliki user app SEBELUM volume di-mount menimpa folder ini.

USER root
RUN mkdir -p /opt/gophish/database && chown -R app:app /opt/gophish/database
USER app
