import sys, os, json
sys.path.insert(0, r'C:\Human_Firewall\backend')
import database, ai_analysis

print("=== TESTING ALL 5 SQL QUERIES LIVE ===")

# Query 1: get_all_users_summary()
q1 = ai_analysis.get_all_users_summary()
print(f"1. get_all_users_summary(): Row count = {len(q1)}")
if q1:
    print("   Sample row 1:", json.dumps(q1[0], default=str))

# Query 2: get_user_events()
test_email = q1[0]['email'] if q1 else 'yudi.hidayat@salessupport-dummy.local'
q2 = ai_analysis.get_user_events(test_email, days=365)
print(f"2. get_user_events('{test_email}', days=365): Row count = {len(q2)}")
if q2:
    print("   Sample row 1:", json.dumps(q2[0], default=str))

# Query 3: get_org_events()
q3 = ai_analysis.get_org_events(days=365)
print(f"3. get_org_events(days=365): Row count = {len(q3)}")
if q3:
    print("   Sample row 1:", json.dumps(q3[0], default=str))

# Query 4: get_incidents_by_divisi()
test_divisi = q1[0]['divisi'] if q1 else 'Sales'
q4 = ai_analysis.get_incidents_by_divisi(test_divisi, days=365)
print(f"4. get_incidents_by_divisi('{test_divisi}', days=365): Row count = {len(q4)}")
if q4:
    print("   Sample row 1:", json.dumps(q4[0], default=str))

# Query 5: get_all_incidents()
q5 = ai_analysis.get_all_incidents(days=365)
print(f"5. get_all_incidents(days=365): Row count = {len(q5)}")
if q5:
    print("   Sample row 1:", json.dumps(q5[0], default=str))
