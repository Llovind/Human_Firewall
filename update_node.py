import json
import glob

def main():
    files = glob.glob(r'C:\Human_Firewall\n8n-workflows\Flow B*.json')
    if not files:
        print("No files found")
        return
        
    f_path = files[0]
    with open(f_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    modified = False
    for node in data.get('nodes', []):
        if node.get('name') == 'Check Registration':
            params = node.get('parameters', {})
            if 'headers' in params:
                headers = params.pop('headers')
                values = headers.get('values', [])
                params['headerParameters'] = {
                    'parameters': values
                }
                modified = True
                print("Successfully updated Check Registration node parameters.")
                
    if modified:
        with open(f_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    else:
        print("No updates needed or node not found.")

if __name__ == '__main__':
    main()