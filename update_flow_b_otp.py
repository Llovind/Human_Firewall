import json
import os

def update_flow_b():
    file_path = r"C:\Human_Firewall\n8n-workflows\Flow B — Threat Reporting (Fully Configured).json"
    if not os.path.exists(file_path):
        print(f"File tidak ditemukan di: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 1. Update Parse Input Node JS Code
    parse_input_node = None
    for node in data.get('nodes', []):
        if node.get('name') == 'Parse Input':
            parse_input_node = node
            break

    if parse_input_node:
        new_js = (
            "const message = $input.item.json.message;\n"
            "const text = (message.text || message.caption || '').trim();\n"
            "const chatId = message.chat.id;\n"
            "const reporterName = message.from.first_name || 'Unknown';\n\n"
            "if (text.startsWith('/start')) {\n"
            "  return { json: { type: 'start', chat_id: chatId, reporter_name: reporterName } };\n"
            "}\n\n"
            "if (text.startsWith('/dashboard')) {\n"
            "  return { json: { type: 'dashboard', chat_id: chatId, reporter_name: reporterName } };\n"
            "}\n\n"
            "const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$/;\n"
            "if (emailRegex.test(text)) {\n"
            "  return { json: { type: 'email', email: text.toLowerCase(), chat_id: chatId, reporter_name: reporterName } };\n"
            "}\n\n"
            "const otpRegex = /^\\d{6}$/;\n"
            "if (otpRegex.test(text)) {\n"
            "  return { json: { type: 'otp', otp: text, chat_id: chatId, reporter_name: reporterName } };\n"
            "}\n\n"
            "const urlRegex = /https?:\\/\\/\\S+/gi;\n"
            "const urls = text.match(urlRegex);\n"
            "if (urls && urls.length > 0) {\n"
            "  return { json: { type: 'url', url: urls[0], chat_id: chatId, reporter_name: reporterName } };\n"
            "} else if (message.document) {\n"
            "  return { json: { type: 'file', file_id: message.document.file_id, file_name: message.document.file_name || 'unknown_file', chat_id: chatId, reporter_name: reporterName } };\n"
            "} else {\n"
            "  return { json: { type: 'invalid', chat_id: chatId, reporter_name: reporterName } };\n"
            "}"
        )
        parse_input_node['parameters']['jsCode'] = new_js
        print("Sukses memperbarui kode JavaScript pada node 'Parse Input'.")

    # 2. Update Route Type Switch Node
    route_type_node = None
    for node in data.get('nodes', []):
        if node.get('name') == 'Route Type':
            route_type_node = node
            break

    if route_type_node:
        rules = route_type_node['parameters']['rules']['values']
        # Pastikan kita tidak menambah duplikat
        rule_keys = [r.get('outputKey') for r in rules]
        
        # Tambahkan rule Start
        if 'Start' not in rule_keys:
            rules.append({
                "conditions": {
                    "options": {
                        "caseSensitive": True,
                        "leftValue": "",
                        "typeValidation": "loose"
                    },
                    "conditions": [
                        {
                            "leftValue": "={{ $json.type }}",
                            "rightValue": "start",
                            "operator": {
                                "type": "string",
                                "operation": "equals"
                            }
                        }
                    ],
                    "combinator": "and"
                },
                "renameOutput": True,
                "outputKey": "Start"
            })
            
        # Tambahkan rule Email
        if 'Email' not in rule_keys:
            rules.append({
                "conditions": {
                    "options": {
                        "caseSensitive": True,
                        "leftValue": "",
                        "typeValidation": "loose"
                    },
                    "conditions": [
                        {
                            "leftValue": "={{ $json.type }}",
                            "rightValue": "email",
                            "operator": {
                                "type": "string",
                                "operation": "equals"
                            }
                        }
                    ],
                    "combinator": "and"
                },
                "renameOutput": True,
                "outputKey": "Email"
            })
            
        # Tambahkan rule OTP
        if 'OTP' not in rule_keys:
            rules.append({
                "conditions": {
                    "options": {
                        "caseSensitive": True,
                        "leftValue": "",
                        "typeValidation": "loose"
                    },
                    "conditions": [
                        {
                            "leftValue": "={{ $json.type }}",
                            "rightValue": "otp",
                            "operator": {
                                "type": "string",
                                "operation": "equals"
                            }
                        }
                    ],
                    "combinator": "and"
                },
                "renameOutput": True,
                "outputKey": "OTP"
            })

        # Tambahkan rule Dashboard
        if 'Dashboard' not in rule_keys:
            rules.append({
                "conditions": {
                    "options": {
                        "caseSensitive": True,
                        "leftValue": "",
                        "typeValidation": "loose"
                    },
                    "conditions": [
                        {
                            "leftValue": "={{ $json.type }}",
                            "rightValue": "dashboard",
                            "operator": {
                                "type": "string",
                                "operation": "equals"
                            }
                        }
                    ],
                    "combinator": "and"
                },
                "renameOutput": True,
                "outputKey": "Dashboard"
            })
        print("Sukses memperbarui rule percabangan pada node 'Route Type'.")

    # 3. Definisikan Node-Node Baru
    new_nodes = [
        # A. Reply Start Node
        {
            "parameters": {
                "chatId": "={{ $('Parse Input').item.json.chat_id }}",
                "text": "👋 <b>Selamat datang di Human Firewall Infranexia!</b>\n\nSaya adalah asisten keamanan siber Anda. Platform ini membantu Anda mengidentifikasi ancaman dan menguji refleks keamanan siber Anda.\n\n<b>Berikut langkah cepat verifikasi akun:</b>\n1️⃣ <b>Kirim email korporat dummy Anda</b> di sini (misal: <code>rina.kusuma@netengineering-dummy.local</code>).\n2️⃣ <b>Ambil 6-digit kode OTP</b> yang dikirimkan ke kotak masuk Anda. Karena ini lingkungan simulasi, Anda bisa melihat email OTP di tab <b>Webmail Inbox</b> pada SOC Dashboard Anda (http://localhost:3000/admin).\n3️⃣ <b>Kirim kode OTP tersebut ke bot ini</b> untuk menghubungkan akun Anda.\n\nSetelah terhubung, Anda bisa mengetik <code>/dashboard</code> untuk mendapatkan tautan masuk ke Personal Security Dashboard Anda, atau langsung memforward link/file mencurigakan ke sini untuk dianalisis secara instan!\n\nSilakan kirimkan email korporat Anda sekarang untuk memulai 👇",
                "additionalFields": {
                    "parse_mode": "HTML"
                }
            },
            "id": "node-reply-start",
            "name": "Reply Start",
            "type": "n8n-nodes-base.telegram",
            "typeVersion": 1.2,
            "position": [
                720,
                820
            ],
            "credentials": {
                "telegramApi": {
                    "id": "I44oUHC8lBGyDI79",
                    "name": "Telegram account 2"
                }
            }
        },
        # B. Generate OTP Node
        {
            "parameters": {
                "mode": "runOnceForEachItem",
                "jsCode": "const otp = Math.floor(100000 + Math.random() * 900000).toString();\nreturn { json: { ...$input.item.json, otp_code: otp } };"
            },
            "id": "node-generate-otp",
            "name": "Generate OTP",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [
                720,
                1000
            ]
        },
        # C. HTTP Request Create OTP in Flask
        {
            "parameters": {
                "method": "POST",
                "url": "http://flask_api:5000/api/otp/create",
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={\"email\": \"{{ $json.email }}\", \"telegram_chat_id\": \"{{ $json.chat_id }}\", \"otp_code\": \"{{ $json.otp_code }}\"}",
                "options": {}
            },
            "id": "node-flask-create-otp",
            "name": "Create OTP in Flask",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.4,
            "position": [
                940,
                1000
            ]
        },
        # D. Reply Email Received (Inform user check email)
        {
            "parameters": {
                "chatId": "={{ $('Parse Input').item.json.chat_id }}",
                "text": "=📨 <b>Kode OTP telah dikirimkan!</b>\n\nSilakan periksa kotak masuk email korporat Anda (<b>{{ $('Generate OTP').item.json.email }}</b>) atau cek tab <b>Webmail Inbox</b> di Dashboard.\n\nMasukkan 6-digit kode OTP tersebut di sini untuk memverifikasi akun Anda. 🛡️",
                "additionalFields": {
                    "parse_mode": "HTML"
                }
            },
            "id": "node-reply-email-received",
            "name": "Reply Email Received",
            "type": "n8n-nodes-base.telegram",
            "typeVersion": 1.2,
            "position": [
                1160,
                1000
            ],
            "credentials": {
                "telegramApi": {
                    "id": "I44oUHC8lBGyDI79",
                    "name": "Telegram account 2"
                }
            }
        },
        # E. HTTP Request Verify OTP in Flask
        {
            "parameters": {
                "method": "POST",
                "url": "http://flask_api:5000/api/otp/verify",
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={\"telegram_chat_id\": \"{{ $json.chat_id }}\", \"otp_code\": \"{{ $json.otp }}\"}",
                "options": {
                    "response": {
                        "response": {
                            "neverError": True
                        }
                    }
                }
            },
            "id": "node-flask-verify-otp",
            "name": "Verify OTP in Flask",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.4,
            "position": [
                720,
                1180
            ]
        },
        # F. IF OTP Valid
        {
            "parameters": {
                "conditions": {
                    "options": {
                        "caseSensitive": True,
                        "leftValue": "",
                        "typeValidation": "loose"
                    },
                    "conditions": [
                        {
                            "leftValue": "={{ $json.status }}",
                            "rightValue": "success",
                            "operator": {
                                "type": "string",
                                "operation": "equals"
                            }
                        }
                    ],
                    "combinator": "and"
                }
            },
            "id": "node-is-otp-valid",
            "name": "Is OTP Valid?",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2.2,
            "position": [
                940,
                1180
            ]
        },
        # G. Create Magic Link
        {
            "parameters": {
                "method": "POST",
                "url": "http://dashboard:3000/api/auth/magic-link",
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={\n  \"email\": \"{{ $json.email }}\",\n  \"telegramId\": \"{{ $('Parse Input').item.json.chat_id }}\"\n}",
                "options": {}
            },
            "id": "node-flask-create-magic-link",
            "name": "Create Magic Link",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.4,
            "position": [
                1180,
                1120
            ]
        },
        # H. Reply OTP Success
        {
            "parameters": {
                "chatId": "={{ $('Parse Input').item.json.chat_id }}",
                "text": "=✅ <b>Akun Anda berhasil terverifikasi!</b>\n\nTelegram Chat ID Anda sekarang terhubung ke email: <b>{{ $('Verify OTP in Flask').item.json.email }}</b>.\n\nSilakan masuk ke Personal Dashboard Anda melalui link sekali pakai berikut (berlaku 15 menit):\n🔗 <a href=\"{{ $json.url }}\"><b>Masuk ke Dashboard</b></a>\n\n<i>Ketik <code>/dashboard</code> kapan saja di sini untuk mendapatkan link masuk yang baru.</i>",
                "additionalFields": {
                    "parse_mode": "HTML"
                }
            },
            "id": "node-reply-otp-success",
            "name": "Reply OTP Success",
            "type": "n8n-nodes-base.telegram",
            "typeVersion": 1.2,
            "position": [
                1400,
                1120
            ],
            "credentials": {
                "telegramApi": {
                    "id": "I44oUHC8lBGyDI79",
                    "name": "Telegram account 2"
                }
            }
        },
        # I. Reply OTP Failed
        {
            "parameters": {
                "chatId": "={{ $('Parse Input').item.json.chat_id }}",
                "text": "❌ <b>Kode OTP salah atau kedaluwarsa.</b>\n\nSilakan periksa kembali kode Anda atau ketik email Anda lagi untuk meminta OTP baru.",
                "additionalFields": {
                    "parse_mode": "HTML"
                }
            },
            "id": "node-reply-otp-failed",
            "name": "Reply OTP Failed",
            "type": "n8n-nodes-base.telegram",
            "typeVersion": 1.2,
            "position": [
                1400,
                1260
            ],
            "credentials": {
                "telegramApi": {
                    "id": "I44oUHC8lBGyDI79",
                    "name": "Telegram account 2"
                }
            }
        },
        # J. Reply Invalid (Adaptif)
        {
            "parameters": {
                "chatId": "={{ $('Parse Input').item.json.chat_id }}",
                "text": "=⚠️ <b>Format input tidak dikenal.</b>\n\n• Jika Anda <b>belum mendaftarkan akun</b>, silakan masukkan <b>email korporat Anda</b> (misal: <code>rina.kusuma@netengineering-dummy.local</code>) untuk memulai verifikasi OTP.\n• Jika Anda <b>sudah terverifikasi</b>, silakan kirimkan <b>URL mencurigakan</b> (teks berisi http/https) atau <b>file attachment</b> untuk dianalisis.\n\n<i>Ketik <code>/start</code> kapan saja untuk melihat panduan lengkap.</i>",
                "additionalFields": {
                    "parse_mode": "HTML"
                }
            },
            "id": "8f0befaf-8f34-4b16-9b7a-9a9dc112038d",
            "name": "Reply Invalid",
            "type": "n8n-nodes-base.telegram",
            "typeVersion": 1.2,
            "position": [
                720,
                640
            ],
            "credentials": {
                "telegramApi": {
                    "id": "I44oUHC8lBGyDI79",
                    "name": "Telegram account 2"
                }
            }
        },
        # K. Check Registration
        {
            "parameters": {
                "method": "GET",
                "url": "=http://flask_api:5000/api/telegram/user?chat_id={{ $('Parse Input').item.json.chat_id }}",
                "options": {}
            },
            "id": "node-check-registration",
            "name": "Check Registration",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.4,
            "position": [
                720,
                1420
            ]
        },
        # L. Is Registered?
        {
            "parameters": {
                "conditions": {
                    "options": {
                        "caseSensitive": True,
                        "leftValue": "",
                        "typeValidation": "loose"
                    },
                    "conditions": [
                        {
                            "leftValue": "={{ $json.registered }}",
                            "rightValue": true,
                            "operator": {
                                "type": "boolean",
                                "operation": "true"
                            }
                        }
                    ],
                    "combinator": "and"
                }
            },
            "id": "node-is-registered",
            "name": "Is Registered?",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2.2,
            "position": [
                940,
                1420
            ]
        },
        # M. Create Magic Link for Command
        {
            "parameters": {
                "method": "POST",
                "url": "http://dashboard:3000/api/auth/magic-link",
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={\n  \"email\": \"{{ $json.email }}\",\n  \"telegramId\": \"{{ $('Parse Input').item.json.chat_id }}\"\n}",
                "options": {}
            },
            "id": "node-create-magic-link-cmd",
            "name": "Create Magic Link for Command",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.4,
            "position": [
                1180,
                1400
            ]
        },
        # N. Reply Dashboard Link
        {
            "parameters": {
                "chatId": "={{ $('Parse Input').item.json.chat_id }}",
                "text": "=🔗 <b>Tautan masuk ke Personal Dashboard Anda:</b>\n\nSilakan klik tautan sekali pakai di bawah ini (berlaku 15 menit):\n👉 <a href=\"{{ $json.url }}\"><b>Masuk ke Dashboard</b></a>",
                "additionalFields": {
                    "parse_mode": "HTML"
                }
            },
            "id": "node-reply-dashboard-link",
            "name": "Reply Dashboard Link",
            "type": "n8n-nodes-base.telegram",
            "typeVersion": 1.2,
            "position": [
                1400,
                1400
            ],
            "credentials": {
                "telegramApi": {
                    "id": "I44oUHC8lBGyDI79",
                    "name": "Telegram account 2"
                }
            }
        },
        # O. Reply Not Registered
        {
            "parameters": {
                "chatId": "={{ $('Parse Input').item.json.chat_id }}",
                "text": "❌ <b>Akun Telegram Anda belum terhubung ke email korporat dummy.</b>\n\nSilakan kirimkan email korporat Anda di sini (misal: <code>rina.kusuma@netengineering-dummy.local</code>) untuk memulai pendaftaran.",
                "additionalFields": {
                    "parse_mode": "HTML"
                }
            },
            "id": "node-reply-not-registered",
            "name": "Reply Not Registered",
            "type": "n8n-nodes-base.telegram",
            "typeVersion": 1.2,
            "position": [
                1180,
                1540
            ],
            "credentials": {
                "telegramApi": {
                    "id": "I44oUHC8lBGyDI79",
                    "name": "Telegram account 2"
                }
            }
        }
    ]

    # Tambahkan node baru jika namanya belum terdaftar, atau update jika sudah ada
    for new_node in new_nodes:
        existing_node = None
        for n in data.get('nodes', []):
            if n.get('name') == new_node['name']:
                existing_node = n
                break
        if existing_node:
            existing_node['parameters'] = new_node['parameters']
            if 'position' in new_node:
                existing_node['position'] = new_node['position']
            print(f"Sukses mengupdate node '{new_node['name']}'.")
        else:
            data['nodes'].append(new_node)
            print(f"Sukses menambahkan node '{new_node['name']}' ke daftar nodes.")

    # 4. Hubungkan Node-Node Baru
    connections = data.get('connections', {})
    
    # Hubungkan Route Type ke output Start, Email, dan OTP
    if 'Route Type' in connections:
        main_conn = connections['Route Type']['main']
        while len(main_conn) < 7:
            main_conn.append([])
            
        # Index 3: Start -> Reply Start
        main_conn[3] = [{"node": "Reply Start", "type": "main", "index": 0}]
            
        # Index 4: Email -> Generate OTP
        main_conn[4] = [{"node": "Generate OTP", "type": "main", "index": 0}]
            
        # Index 5: OTP -> Verify OTP in Flask
        main_conn[5] = [{"node": "Verify OTP in Flask", "type": "main", "index": 0}]

        # Index 6: Dashboard -> Check Registration
        main_conn[6] = [{"node": "Check Registration", "type": "main", "index": 0}]

    # Hubungkan Generate OTP -> Create OTP in Flask
    connections['Generate OTP'] = {
        "main": [
            [
                {
                    "node": "Create OTP in Flask",
                    "type": "main",
                    "index": 0
                }
            ]
        ]
    }

    # Hubungkan Create OTP in Flask -> Reply Email Received
    connections['Create OTP in Flask'] = {
        "main": [
            [
                {
                    "node": "Reply Email Received",
                    "type": "main",
                    "index": 0
                }
            ]
        ]
    }

    # Hubungkan Verify OTP in Flask -> Is OTP Valid?
    connections['Verify OTP in Flask'] = {
        "main": [
            [
                {
                    "node": "Is OTP Valid?",
                    "type": "main",
                    "index": 0
                }
            ]
        ]
    }

    # Hubungkan Is OTP Valid? -> True: Create Magic Link, False: Reply OTP Failed
    connections['Is OTP Valid?'] = {
        "main": [
            [
                {
                    "node": "Create Magic Link",
                    "type": "main",
                    "index": 0
                }
            ],
            [
                {
                    "node": "Reply OTP Failed",
                    "type": "main",
                    "index": 0
                }
            ]
        ]
    }

    # Hubungkan Create Magic Link -> Reply OTP Success
    connections['Create Magic Link'] = {
        "main": [
            [
                {
                    "node": "Reply OTP Success",
                    "type": "main",
                    "index": 0
                }
            ]
        ]
    }

    # Hubungkan Check Registration -> Is Registered?
    connections['Check Registration'] = {
        "main": [
            [
                {
                    "node": "Is Registered?",
                    "type": "main",
                    "index": 0
                }
            ]
        ]
    }

    # Hubungkan Is Registered? -> True: Create Magic Link for Command, False: Reply Not Registered
    connections['Is Registered?'] = {
        "main": [
            [
                {
                    "node": "Create Magic Link for Command",
                    "type": "main",
                    "index": 0
                }
            ],
            [
                {
                    "node": "Reply Not Registered",
                    "type": "main",
                    "index": 0
                }
            ]
        ]
    }

    # Hubungkan Create Magic Link for Command -> Reply Dashboard Link
    connections['Create Magic Link for Command'] = {
        "main": [
            [
                {
                    "node": "Reply Dashboard Link",
                    "type": "main",
                    "index": 0
                }
            ]
        ]
    }
    
    print("Sukses menghubungkan alur node baru.")

    # Simpan kembali ke file JSON
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("file JSON Flow B berhasil diperbarui!")

if __name__ == "__main__":
    update_flow_b()
