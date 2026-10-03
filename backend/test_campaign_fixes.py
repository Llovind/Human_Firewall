"""Isolated campaign regression checks; opt-in real GoPhish/Mailpit smoke.

All AFFERENT accounts, events and scores use a temporary SQLite database.
The smoke creates one synthetic Mailpit-only campaign and completes it.
"""
import os
import json
import sys
import tempfile
import time
import unittest
import uuid
from unittest.mock import Mock, patch

_temp = tempfile.TemporaryDirectory()
os.environ.update(APP_ENV='test', DB_PATH=os.path.join(_temp.name, 'campaigns.db'),
                  ADMIN_PASSWORD='CampaignTesting2026!', SECRET_KEY='isolated-campaign-secret-32-characters',
                  SERVICE_API_KEY='isolated-campaign-service-32-characters', DEV_BYPASS_AUTH='false',
                  BOOTSTRAP_ADMIN_EMAIL='campaign-admin@demo.test', PROXY_FEATURE_ENABLED='false',
                  SMTP_HOST='mailpit', SMTP_PORT='1025', SMTP_SECURITY='none')
os.environ.setdefault('SERVER_BASE_URL', 'http://server.test:5000')

import database
import gophish_client as gp
from app import app
from services import auth_service
from services import campaign_materials as materials


def session(email, password):
    otp = {}
    client = app.test_client()
    with patch.object(auth_service.EmailService, 'send_login_otp', side_effect=lambda **values: otp.update(values)):
        challenge = client.post('/api/auth/login', json={'email': email, 'password': password}).get_json()
    result = client.post('/api/auth/verify-otp', json={'challengeId': challenge['challengeId'], 'otp': otp['otp_code']})
    assert result.status_code == 200, result.get_json()
    return {'X-Afferent-Session': result.get_json()['sessionToken']}


class CampaignChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()
        cls.email = 'campaign-employee@demo.test'
        auth_service.create_account(email=cls.email, password='EmployeeTesting2026!', role='employee', division='IT')
        cls.admin = session('campaign-admin@demo.test', 'CampaignTesting2026!')
        cls.employee = session(cls.email, 'EmployeeTesting2026!')

    def test_resources_empty_and_rbac_fail_closed(self):
        with patch.object(gp, 'get_templates', return_value=[]), patch.object(gp, 'get_pages', return_value=[]), patch.object(gp, 'get_sending_profiles', return_value=[]):
            data = self.client.get('/api/admin/gophish/resources', headers=self.admin).get_json()
            self.assertEqual(data['templates'], [])
            self.assertEqual(data['pages'], [])
            self.assertEqual(data['profiles'], [])
        self.assertEqual(self.client.get('/api/admin/gophish/resources', headers=self.employee).status_code, 403)
        self.assertEqual(self.client.post('/api/admin/gophish/launch', json={}, headers=self.employee).status_code, 403)
        with patch.object(gp, 'get_templates', side_effect=gp.GoPhishError('Unavailable', 503)):
            self.assertEqual(self.client.get('/api/admin/gophish/resources', headers=self.admin).status_code, 503)

    def test_real_resource_names_canonical_route_and_tls(self):
        reply = Mock(ok=True, is_redirect=False, text='{}')
        reply.json.return_value = {'id': 91}
        with patch.object(gp, 'GOPHISH_API_KEY', 'isolated-test-key'), patch.object(gp, 'get_templates', return_value=[{'id': 7, 'name': 'Template'}]), patch.object(gp, 'get_pages', return_value=[{'id': 8, 'name': 'Page'}]), patch.object(gp, 'get_sending_profiles', return_value=[{'id': 9, 'name': 'Mailpit'}]), patch.object(gp.requests, 'request', return_value=reply) as send:
            gp.launch_campaign('Test', 7, 'http://server.test:8080', 8, 9, 'Targets')
            values = send.call_args.kwargs
            self.assertTrue(values['url'].endswith('/api/campaigns/'))
            self.assertEqual(values['json']['template'], {'name': 'Template'})
            self.assertEqual(values['json']['page'], {'name': 'Page'})
            self.assertEqual(values['json']['smtp'], {'name': 'Mailpit'})
            self.assertTrue(values['verify'])
            self.assertFalse(values['allow_redirects'])
            self.assertEqual(values['timeout'], (3, 8))

    def test_launch_selected_employee_mailpit_only_no_mock_campaign(self):
        body = {'name': 'Test', 'url': 'http://server.test:8080', 'template_id': 7, 'page_id': 8, 'smtp_id': 9, 'target_emails': [self.email]}
        with patch.object(gp, 'get_templates', return_value=[{'id': 7, 'name': 'Template'}]), patch.object(gp, 'get_pages', return_value=[{'id': 8, 'name': 'Page'}]), patch.object(gp, 'get_sending_profiles', return_value=[{'id': 9, 'name': 'Mailpit', 'host': 'mailpit:1025'}]), patch.object(gp, 'sync_group') as sync, patch.object(gp, 'launch_campaign', return_value={'id': 91}), patch.object(database, 'create_simulation_campaign') as mock_campaign:
            result = self.client.post('/api/admin/gophish/launch', json=body, headers=self.admin)
            self.assertEqual(result.status_code, 201, result.get_json())
            self.assertEqual(sync.call_args.args[1], [self.email])
            mock_campaign.assert_not_called()
            for targets in ([], ['campaign-admin@demo.test']):
                result = self.client.post('/api/admin/gophish/launch', json={**body, 'target_emails': targets}, headers=self.admin)
                self.assertEqual(result.status_code, 400)
        with patch.object(gp, 'get_templates', return_value=[{'id': 7, 'name': 'Template'}]), patch.object(gp, 'get_pages', return_value=[{'id': 8, 'name': 'Page'}]), patch.object(gp, 'get_sending_profiles', return_value=[{'id': 9, 'name': 'External', 'host': 'smtp.external.test:587'}]), patch.object(gp, 'launch_campaign') as launch:
            self.assertEqual(self.client.post('/api/admin/gophish/launch', json=body, headers=self.admin).status_code, 400)
            launch.assert_not_called()

    def test_source_namespace_and_sanitized_details(self):
        campaign = {'id': 9, 'name': 'Test', 'smtp': {'password': 'must-not-leak'}, 'timeline': [{'message': 'Clicked Link', 'details': 'captured-password'}]}
        with patch.object(database, 'list_simulation_campaigns', return_value=[campaign]), patch.object(database, 'delete_simulation_campaign') as local_delete, patch.object(gp, 'delete_campaign') as remote_delete, patch.object(gp, 'get_campaign', return_value=campaign):
            self.assertEqual(self.client.delete('/api/admin/gophish/campaigns/9?source=local', headers=self.admin).status_code, 200)
            local_delete.assert_called_once_with(9)
            remote_delete.assert_not_called()
            self.assertEqual(self.client.delete('/api/admin/gophish/campaigns/9?source=gophish', headers=self.admin).status_code, 200)
            remote_delete.assert_called_once_with(9)
            result = self.client.get('/api/admin/gophish/campaigns/9?source=gophish', headers=self.admin)
            self.assertNotIn('must-not-leak', result.get_data(as_text=True))
            self.assertNotIn('captured-password', result.get_data(as_text=True))

    def test_scoring_idempotent_under_repeated_sync(self):
        before = database.get_user_history(self.email)['points']
        campaign = {'id': 1234, 'timeline': [{'email': self.email, 'message': 'Clicked Link'}]}
        database.sync_gophish_events(campaign)
        database.sync_gophish_events(campaign)
        self.assertEqual(database.get_user_history(self.email)['points'], before - 10)

    def test_clone_removes_credentials_active_content_and_source_forms(self):
        raw = '''<main title="{{.Email}}"><script>fetch('https://external.test')</script>
        <img src="https://external.test/image"><form action="https://external.test/login">
        <input name="email"><input name="password"><input name="csrf" value="secret"></form>
        <iframe src="https://external.test"></iframe></main>'''
        html = materials.safe_clone(raw)
        self.assertNotIn('external.test', html)
        self.assertNotIn('<script', html)
        self.assertNotIn('name="password"', html)
        self.assertNotIn('name="email"', html)
        self.assertNotIn('{{', html)
        self.assertNotIn('secret', html)
        self.assertEqual(html.count('name="'), 2)  # metadata only; no named form fields
        self.assertIn('class="afferent-demo-form"', html)
        self.assertEqual(html.count('<form'), 1)
        with self.assertRaises(gp.GoPhishError):
            materials.safe_clone('<div>JS-only login</div>')

    def test_form_csp_allows_education_redirect_but_not_arbitrary_destinations(self):
        url = 'http://lab.test:3000/simulation/education'
        csp = materials.landing_csp(url)
        self.assertIn("form-action 'self' http://lab.test:3000;", csp)
        self.assertIn("default-src 'none'", csp)
        self.assertNotIn('*', csp)
        html = '<html><head><meta http-equiv="Content-Security-Policy" content="form-action &#39;self&#39;"></head><body></body></html>'
        updated = materials.repair_landing_csp(html, url)
        self.assertIn('http://lab.test:3000', updated)
        self.assertEqual(materials.repair_landing_csp(updated, url), updated)
        with self.assertRaises(gp.GoPhishError):
            materials.landing_csp('http://lab.test:3000/; form-action *')

    def test_firecrawl_v2_contract_and_error_paths(self):
        reply = Mock(ok=True)
        reply.json.return_value = {'success': True, 'data': {'rawHtml': '<form><input name="password"></form>', 'metadata': {'statusCode': 200}}}
        address = [(2, 1, 6, '', ('93.184.215.14', 443))]
        with patch.dict(os.environ, FIRECRAWL_API_KEY='test-provider-key', SIMULATION_EDUCATION_URL='http://lab.test:3000/simulation/education'), patch.object(materials.socket, 'getaddrinfo', return_value=address), patch.object(materials.requests, 'post', return_value=reply) as send:
            result = materials.clone_with_firecrawl('https://owned.example/login', True)
            self.assertEqual(result['provider'], 'firecrawl')
            self.assertFalse(result['capture_passwords'])
            self.assertEqual(send.call_args.args[0], 'https://api.firecrawl.dev/v2/scrape')
            self.assertEqual(send.call_args.kwargs['json']['formats'], ['rawHtml'])
            self.assertFalse(send.call_args.kwargs['allow_redirects'])
            for payload in ([], {'success': True, 'data': []}, {'success': True, 'data': {'rawHtml': 'x', 'metadata': {'statusCode': 'error'}}}):
                reply.json.return_value = payload
                with self.assertRaises(gp.GoPhishError):
                    materials.clone_with_firecrawl('https://owned.example/login', True)
            reply.ok = False; reply.status_code = 402
            with self.assertRaisesRegex(gp.GoPhishError, 'Kredit'):
                materials.clone_with_firecrawl('https://owned.example/login', True)
        with patch.object(materials.requests, 'post') as send:
            for url, authorized in [('https://owned.example', False), ('http://127.0.0.1/login', True), ('https://owned.example/login?token=secret', True)]:
                with self.assertRaises(gp.GoPhishError):
                    materials.clone_with_firecrawl(url, authorized)
            send.assert_not_called()

    def test_saved_form_is_credential_free_even_if_client_requests_capture(self):
        with patch.object(gp, 'create_page', return_value={'id': 77}) as create:
            result = self.client.post('/api/admin/gophish/pages', headers=self.admin, json={
                'name': 'Demo', 'html': '<form action="https://external.test"><input name="password"></form>',
                'capture_credentials': True, 'capture_passwords': True, 'redirect_url': 'http://lab.test:3000/simulation/education'})
            self.assertEqual(result.status_code, 201, result.get_json())
            fields = create.call_args.kwargs
            self.assertFalse(fields['capture_passwords'])
            self.assertFalse(fields['capture_credentials'])
            self.assertNotIn('name="password"', fields['html'])
            self.assertNotIn('external.test', fields['html'])


def mailpit_smoke():
    import requests
    preset = materials.prepare_password_reset()
    email = 'campaign-smoke-' + uuid.uuid4().hex + '@afferent.test'
    auth_service.create_account(email=email, password='EmployeeTesting2026!', role='employee', division='IT')
    admin = session('campaign-admin@demo.test', 'CampaignTesting2026!')
    profiles = gp.get_sending_profiles()
    profile = next(p for p in profiles if p['host'] == 'mailpit:1025')
    body = {'name': 'AFFERENT Mailpit smoke ' + uuid.uuid4().hex[:8],
            'url': 'http://gophish:80', 'template_id': preset['template_id'],
            'page_id': preset['page_id'], 'smtp_id': profile['id'], 'target_emails': [email]}
    client = app.test_client()
    result = client.post('/api/admin/gophish/launch', json=body, headers=admin)
    assert result.status_code == 201, result.get_json()
    campaign_id = result.get_json()['campaign_id']
    try:
        deadline = time.monotonic() + 35
        while time.monotonic() < deadline:
            campaign = gp.get_campaign(campaign_id)
            if campaign['results'][0]['status'] == 'Email Sent':
                break
            time.sleep(1)
        assert campaign['results'][0]['status'] == 'Email Sent', 'GoPhish did not deliver to Mailpit'
        messages = requests.get('http://mailpit:8025/api/v1/messages', timeout=5).json()['messages']
        assert any(any(to.get('Address') == email for to in m.get('To', [])) for m in messages), 'Synthetic message missing from Mailpit'
        rid = campaign['results'][0]['id']
        response = requests.get('http://gophish:80/', params={'rid': rid}, timeout=5)
        assert response.status_code == 200 and 'afferent-demo-form' in response.text
        assert 'name="password"' not in response.text and 'name="email"' not in response.text
        campaign = gp.get_campaign(campaign_id)
        assert campaign['results'][0]['status'] == 'Clicked Link'
        database.sync_gophish_events(campaign)
        database.sync_gophish_events(campaign)
        assert database.get_user_history(email)['points'] == 90
        for _ in range(2):
            # GoPhish strips every input name when capture is off. Native POST
            # still records Submitted Data; no field values need to be sent.
            submit = requests.post('http://gophish:80/', params={'rid': rid}, data={}, timeout=5, allow_redirects=False)
            assert submit.status_code == 302, submit.status_code
            assert submit.headers['Location'] == preset['educationUrl']
            campaign = gp.get_campaign(campaign_id)
            assert campaign['results'][0]['status'] == 'Submitted Data'
            for event in campaign['timeline']:
                if event.get('message') == 'Submitted Data':
                    details = json.loads(event.get('details') or '{}')
                    assert set(details.get('payload', {})) <= {'rid'}, 'Unexpected captured form field'
            database.sync_gophish_events(campaign)
            database.sync_gophish_events(campaign)
            assert database.get_user_history(email)['points'] == 70
        education = requests.get('http://dashboard:3000/simulation/education', timeout=5)
        assert education.status_code == 200 and 'simulasi phishing' in education.text
        print({'campaign_id': campaign_id, 'mailpit_delivery': 'PASS', 'tracking': 'PASS', 'submit_education': 'PASS', 'score': '100 -> 90 -> 70', 'scoring_dedupe': 'PASS', 'real_employee_scores': 'untouched'})
    finally:
        gp.complete_campaign(campaign_id)
        assert gp.get_campaign(campaign_id)['status'] == 'Completed'
        print({'campaign_id': campaign_id, 'completed': True})


if __name__ == '__main__':
    if '--mailpit-smoke' in sys.argv:
        mailpit_smoke()
    else:
        unittest.main()
