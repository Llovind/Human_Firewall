import json
import glob

def main():
    files = glob.glob(r'C:\Human_Firewall\n8n-workflows\*.json')
    for f_path in files:
        with open(f_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        for node in data.get('nodes', []):
            if node.get('type') == 'n8n-nodes-base.httpRequest':
                print(f"Node '{node.get('name')}' in {f_path}:")
                print(json.dumps(node.get('parameters'), indent=2))
                print("-" * 40)

if __name__ == '__main__':
    main()