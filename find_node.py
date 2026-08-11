import json
import sys
import glob

def main():
    try:
        # Find the correct file since it has an em-dash
        files = glob.glob(r'C:\Human_Firewall\n8n-workflows\Flow B*.json')
        if not files:
            print("No file found")
            return
            
        with open(files[0], 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        for node in data.get('nodes', []):
            if node.get('name') == 'Check Registration':
                print(json.dumps(node, indent=2))
                return
    except Exception as e:
        print(e)

if __name__ == '__main__':
    main()