import sys, os, json
sys.path.insert(0, r'C:\Human_Firewall\backend')
import ai_analysis, ai_anonymizer, ai_prompts

print("=== TESTING ANONYMIZATION LAYER LIVE ===")

# Test 1: Single User Context Anonymization
raw_email = "dewi.lestari@netops-dummy.local"
user_ctx = ai_analysis.build_user_context(raw_email, 30)
anon_user_ctx, saved_email = ai_anonymizer.anonymize_user_context(user_ctx)

print("Before Anonymization Email:", user_ctx["email"])
print("After Anonymization Email:", anon_user_ctx["email"])

prompt_text = ai_prompts.build_user_analysis_prompt(anon_user_ctx)
print("Contains Raw Email in Prompt Payload?", raw_email in prompt_text)
print("Contains Pseudonym in Prompt Payload?", anon_user_ctx["email"] in prompt_text)

# Test 2: Deanonymization
mock_llm_response = {
    "email": anon_user_ctx["email"],
    "risk_level": "VULNERABLE",
    "risk_score": 75,
    "education_message": "Halo, mohon berhati-hati saat menerima email link."
}
restored_response = ai_anonymizer.deanonymize_response(mock_llm_response, saved_email)
print("Restored Real Email in Final Response:", restored_response["email"])
