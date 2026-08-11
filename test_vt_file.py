import urllib.request
import json
import time
import urllib.error

headers = {
    'x-apikey': 'fbfdaaa618dc7446a3e8417c08cd53d6d818e51d7d733dc2208de64e2902cb08',
    'User-Agent': 'Mozilla/5.0'
}

def test_file_upload():
    boundary = '---WebKitFormBoundary7MA4YWxkTrZu0gW'
    eicar_content = b'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
    
    parts = [
        b'--' + boundary.encode(),
        b'Content-Disposition: form-data; name="file"; filename="eicar.txt"',
        b'Content-Type: text/plain',
        b'',
        eicar_content,
        b'--' + boundary.encode() + b'--'
    ]
    data = b'\r\n'.join(parts)
    
    req1 = urllib.request.Request(
        'https://www.virustotal.com/api/v3/files',
        data=data,
        headers={**headers, 'Content-Type': f'multipart/form-data; boundary={boundary}'},
        method='POST'
    )
    
    try:
        r1 = json.loads(urllib.request.urlopen(req1).read().decode('utf-8'))
        aid = r1['data']['id']
        print('Uploaded file successfully. Analysis ID:', aid)
    except urllib.error.HTTPError as e:
        print("HTTP Error:", e.code, e.reason)
        body = e.read().decode('utf-8')
        print("Response Body:", body)
        return

if __name__ == "__main__":
    test_file_upload()
