import zipfile
import os

files_to_zip = [
    # Backend files
    ('backend/app.py', 'backend/app.py'),
    ('backend/database.py', 'backend/database.py'),
    ('backend/gophish_client.py', 'backend/gophish_client.py'),
    
    # Frontend files
    ('dashboard/src/app/page.tsx', 'dashboard/src/app/page.tsx'),
    ('dashboard/src/app/admin/page.tsx', 'dashboard/src/app/admin/page.tsx'),
    ('dashboard/src/app/auth/page.tsx', 'dashboard/src/app/auth/page.tsx'),
    ('dashboard/src/context/AuthContext.tsx', 'dashboard/src/context/AuthContext.tsx'),
    ('dashboard/src/app/globals.css', 'dashboard/src/app/globals.css'),
    ('dashboard/src/app/dashboard.css', 'dashboard/src/app/dashboard.css'),
    
    # Proxy API files
    ('dashboard/src/app/api/admin/compliance-summary/route.ts', 'dashboard/src/app/api/admin/compliance-summary/route.ts'),
    ('dashboard/src/app/api/admin/leaderboard/route.ts', 'dashboard/src/app/api/admin/leaderboard/route.ts')
]

dest_zip = r'C:\Users\lovind\Downloads\human_firewall_codebase.zip'
base_dir = r'C:\Human_Firewall'

print(f"Creating ZIP archive at {dest_zip}...")
try:
    with zipfile.ZipFile(dest_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for src_rel, arc_name in files_to_zip:
            src_abs = os.path.join(base_dir, src_rel.replace('/', os.sep))
            if os.path.exists(src_abs):
                zipf.write(src_abs, arcname=arc_name)
                print(f"  Added: {src_rel} -> {arc_name}")
            else:
                print(f"  Warning: File not found: {src_abs}")
    print("ZIP archive created successfully!")
except Exception as e:
    print(f"Error creating ZIP archive: {e}")
