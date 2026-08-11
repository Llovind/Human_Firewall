import zipfile
import os

def zip_fullstack():
    dest_zip = r'C:\Users\lovind\Downloads\human_firewall_codebase.zip'
    base_dir = r'C:\Human_Firewall'
    
    exclude_dirs = {'.git', 'node_modules', '.next', '__pycache__', 'venv', '.venv'}
    
    print(f"Creating ZIP archive of entire project at {dest_zip}...")
    try:
        with zipfile.ZipFile(dest_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(base_dir):
                # Filter out excluded directories in-place
                dirs[:] = [d for d in dirs if d not in exclude_dirs]
                
                for file in files:
                    if file == 'zip_fullstack.py' or file.startswith('debug_auth.log') or file.endswith('.pyc'):
                        continue
                    
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, base_dir)
                    zipf.write(full_path, arcname=rel_path)
                    print(f"  Added to zip: {rel_path}")
                    
        print("ZIP archive of the fullstack project created successfully!")
    except Exception as e:
        print(f"Error creating ZIP archive: {e}")

if __name__ == '__main__':
    zip_fullstack()
