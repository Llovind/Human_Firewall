import os
import time

downloads_dir = r"C:\Users\lovind\Downloads"

def list_recent_files():
    if not os.path.exists(downloads_dir):
        print("Downloads directory not found.")
        return

    files = []
    for f in os.listdir(downloads_dir):
        path = os.path.join(downloads_dir, f)
        if os.path.isfile(path):
            mtime = os.path.getmtime(path)
            files.append((f, mtime, os.path.getsize(path)))

    # Urutkan berdasarkan waktu modifikasi terbaru
    files.sort(key=lambda x: x[1], reverse=True)

    print("=== FILE TERBARU DI DOWNLOADS (URUT WAKTU) ===")
    for name, mtime, size in files[:10]:
        time_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(mtime))
        print(f"File: {name} | Modifikasi: {time_str} | Ukuran: {size} bytes")

if __name__ == "__main__":
    list_recent_files()
