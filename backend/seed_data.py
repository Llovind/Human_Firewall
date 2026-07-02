import sqlite3
import os
import argparse
from datetime import datetime, timedelta
import random
import database  # Import modul database untuk inisialisasi tabel

DB_PATH = os.path.join('instance', 'human_firewall.db')

def seed_database(telegram_id=None):
    # Pastikan database folder dan skema tabel terinisialisasi terlebih dahulu
    print("Menginisialisasi skema database...")
    database.init_db()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Mengosongkan data lama...")
    cursor.execute("DELETE FROM user_history")
    cursor.execute("DELETE FROM events")
    cursor.execute("DELETE FROM incidents")

    print("Menyuntikkan data karyawan baru (user_history)...")
    
    # 1. Definisikan Karyawan Dummy
    users = [
        # Rina Kusuma: Target Utama Demo Live (Chronic Clicker)
        ("rina.kusuma@netengineering-dummy.local", "Network Engineering", 4, 1, 0, telegram_id),
        
        # Karyawan Divisi Performance & Shared Service (SLA/Operations)
        ("eko.prabowo@perfshared-dummy.local", "Performance & Shared Service", 1, 3, 0, None),
        ("martina.fitri@perfshared-dummy.local", "Performance & Shared Service", 0, 5, 0, None),
        
        # Karyawan Divisi Network Operations (Ops)
        ("budi.santoso@netops-dummy.local", "Network Operations", 2, 2, 1, None),
        ("dewi.lestari@netops-dummy.local", "Network Operations", 6, 0, 4, None), # Chronic Clicker lain
        
        # Karyawan Divisi Sales Support
        ("yudi.hidayat@salessupport-dummy.local", "Sales Support", 0, 4, 0, None),
        ("siti.nurhaliza@salessupport-dummy.local", "Sales Support", 1, 2, 0, None)
    ]

    for email, divisi, clicks, viewed, skipped, chat_id in users:
        cursor.execute('''
            INSERT INTO user_history (email, divisi, click_count, viewed_training_count, skipped_training_count, telegram_chat_id, last_clicked)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (email, divisi, clicks, viewed, skipped, chat_id, 
              (datetime.utcnow() - timedelta(days=random.randint(1, 10))).isoformat() if clicks > 0 else None))

    print("Menyuntikkan log event 30 hari ke belakang...")
    # 2. Tambah data event simulasi historis
    event_types = ['clicked_link', 'submitted_data', 'viewed_training', 'skipped_training']
    for _ in range(50):
        email, divisi, _, _, _, _ = random.choice(users)
        event_type = random.choice(event_types)
        days_ago = random.randint(1, 30)
        timestamp = (datetime.utcnow() - timedelta(days=days_ago)).isoformat()
        
        cursor.execute('''
            INSERT INTO events (email, divisi, event_type, created_at)
            VALUES (?, ?, ?, ?)
        ''', (email, divisi, event_type, timestamp))

    print("Menyuntikkan tiket insiden historis (incidents)...")
    # 3. Tambah tiket insiden tiruan (Flow B & Flow A)
    # Tiket 1: Real-world report (Flow B) - Open
    cursor.execute('''
        INSERT INTO incidents (ticket_id, source_type, reported_url, divisi, severity, vt_verdict, status, created_at)
        VALUES ('INC-A1B2C3D4', 'real_world_report', 'http://phishing-fake-login.com/login', 'Performance & Shared Service', 'high', '8/90 engines malicious', 'open', 
                ?)
    ''', ((datetime.utcnow() - timedelta(hours=5)).isoformat(),))

    # Tiket 2: Real-world report (Flow B) - Closed (untuk kalkulasi MTTC)
    created_at = datetime.utcnow() - timedelta(days=2)
    closed_at = created_at + timedelta(minutes=45) # Ditutup dalam 45 menit
    cursor.execute('''
        INSERT INTO incidents (ticket_id, source_type, reported_url, divisi, severity, vt_verdict, status, created_at, closed_at)
        VALUES ('INC-Z9Y8X7W6', 'real_world_report', 'http://testsafebrowsing.appspot.com/s/malware.html', 'Sales Support', 'medium', '10/92 engines malicious', 'closed', 
                ?, ?)
    ''', (created_at.isoformat(), closed_at.isoformat()))

    # Tiket 3: Simulation Incident (Flow A - Credential Submission)
    cursor.execute('''
        INSERT INTO incidents (ticket_id, source_type, divisi, severity, status, created_at)
        VALUES ('INC-SIMCRED', 'simulation', 'Network Operations', 'high', 'open', 
                ?)
    ''', ((datetime.utcnow() - timedelta(days=1)).isoformat(),))

    conn.commit()
    conn.close()
    print("Database seeding selesai dengan sukses! 🎉")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Human Firewall SQLite database.")
    parser.add_argument("--id", type=str, help="Telegram Chat ID untuk di-map ke rina.kusuma@netengineering-dummy.local")
    args = parser.parse_args()
    
    seed_database(args.id)
