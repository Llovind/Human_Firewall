import json
import glob

def main():
    files = glob.glob(r'C:\Human_Firewall\n8n-workflows\Flow B*.json')
    if not files:
        print("No files found")
        return
        
    with open(files[0], 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    for node in data.get('nodes', []):
        if node.get('name') == 'Check Registration':
            print("Check Registration Parameters:")
            print(json.dumps(node.get('parameters'), indent=2))

if __name__ == '__main__':
    main()