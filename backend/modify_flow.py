import json
import os

filepath = os.path.join(os.path.dirname(__file__), '..', 'n8n-workflows', 'Flow B — Threat Reporting (Fully Configured).json')
with open(filepath, 'r') as f:
    flow = json.load(f)

# 1. Update Parse Input Code
parse_input_node = next(n for n in flow['nodes'] if n['name'] == 'Parse Input')
new_js_code = """const msg = $input.item.json.message;

if (msg.text) {
  const text = msg.text.trim();

  if (text.startsWith('/')) {
    return {
      json: {
        type: "command",
        command: text,
        chat_id: msg.chat.id,
        reporter_name: msg.from.first_name || 'User'
      }
    };
  }

  const urlRegex = /^https?:\\/\\/\\S+$/i;

  if (urlRegex.test(text)) {
    return {
      json: {
        type: "url",
        url: text,
        chat_id: msg.chat.id,
        reporter_name: msg.from.first_name || 'User'
      }
    };
  }
}

if (msg.document) {
  return {
    json: {
      type: "file",
      file_id: msg.document.file_id,
      file_name: msg.document.file_name,
      mime_type: msg.document.mime_type,
      chat_id: msg.chat.id,
      reporter_name: msg.from.first_name || 'User'
    }
  };
}

return {
  json: {
    type: "invalid",
    chat_id: msg.chat.id,
    reporter_name: msg.from.first_name || 'User'
  }
};"""
parse_input_node['parameters']['jsCode'] = new_js_code

# 2. Update Route Type Switch node rules
route_type_node = next(n for n in flow['nodes'] if n['name'] == 'Route Type')
rules = route_type_node['parameters']['rules']['values']

# Replace switch rules to have: URL, File, Command, Invalid
command_rule = {
  "conditions": {
    "options": {
      "caseSensitive": True,
      "leftValue": "",
      "typeValidation": "strict",
      "version": 3
    },
    "conditions": [
      {
        "leftValue": "={{ $json.type }}",
        "rightValue": "command",
        "operator": {
          "type": "string",
          "operation": "equals"
        },
        "id": "command-rule-id"
      }
    ],
    "combinator": "and"
  },
  "renameOutput": True,
  "outputKey": "Command"
}

# Insert Command rule before Invalid rule (which is at index 2 currently)
rules.insert(2, command_rule)

# 3. Add the two new nodes
handle_cmd_node = {
  "parameters": {
    "method": "POST",
    "url": "http://flask_api:5000/api/telegram/command",
    "sendHeaders": True,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "=Bearer {{$env.SERVICE_API_KEY}}"
        }
      ]
    },
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": "={\n  \"chat_id\": \"{{$json.chat_id}}\",\n  \"command\": \"{{$json.command}}\",\n  \"first_name\": \"{{$json.reporter_name}}\"\n}",
    "options": {}
  },
  "id": "handle-telegram-command-node-id",
  "name": "Handle Telegram Command",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.1,
  "position": [
    -272,
    856
  ]
}

reply_cmd_node = {
  "parameters": {
    "chatId": "={{ $('Parse Input').item.json.chat_id }}",
    "text": "={{ $json.reply }}",
    "additionalFields": {
      "appendAttribution": False
    }
  },
  "id": "reply-command-response-node-id",
  "name": "Reply Command Response",
  "type": "n8n-nodes-base.telegram",
  "typeVersion": 1.2,
  "position": [
    0,
    856
  ],
  "webhookId": "reply-command-response-webhook-id",
  "credentials": {
    "telegramApi": {
      "id": "I44oUHC8lBGyDI79",
      "name": "Telegram account 2"
    }
  }
}

flow['nodes'].extend([handle_cmd_node, reply_cmd_node])

# 4. Update connections
connections = flow['connections']

# Connect Switch outputs correctly
# Old: 0 -> Threat Intelligence API, 1 -> Get TG File Path, 2 -> Reply Invalid
# New: 0 -> Threat Intelligence API, 1 -> Get TG File Path, 2 -> Handle Telegram Command, 3 -> Reply Invalid
connections['Route Type']['main'] = [
  [{"node": "Threat Intelligence API", "type": "main", "index": 0}],
  [{"node": "Get TG File Path", "type": "main", "index": 0}],
  [{"node": "Handle Telegram Command", "type": "main", "index": 0}],
  [{"node": "Reply Invalid", "type": "main", "index": 0}]
]

# Connect Handle Telegram Command to Reply Command Response
connections['Handle Telegram Command'] = {
  "main": [
    [{"node": "Reply Command Response", "type": "main", "index": 0}]
  ]
}

with open(filepath, 'w') as f:
    json.dump(flow, f, indent=2)

print("Successfully modified Flow B JSON workflow file.")
