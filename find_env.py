import json
import glob

def main():
    files = glob.glob(r'C:\Human_Firewall\n8n-workflows\*.json')
    for f_path in files:
        with open(f_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if '$env' in content:
                print(f"Found $env in {f_path}")
                # Print lines containing $env
                lines = content.splitlines()
                for i, line in enumerate(lines):
                    if '$env' in line:
                        print(f"{i+1}: {line}")

if __name__ == '__main__':
    main()