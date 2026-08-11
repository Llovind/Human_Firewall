import gophish_client
import sys

try:
    res = gophish_client.launch_campaign(
        name="Q1: Testing Test",
        template_id="Phising Test",
        url="http://localhost:8080",
        page_id="Educational Social Engineering - Tier 1",
        smtp_id="Mailtrap Test",
        group_name="HFL_Target_Group"
    )
    print("Success:", res)
except Exception as e:
    print("Error during launch:", e)
    if hasattr(e, 'response') and e.response is not None:
        print("Response status:", e.response.status_code)
        print("Response body:", e.response.text)
