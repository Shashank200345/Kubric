from dotenv import load_dotenv
load_dotenv()
import os, httpx
url = os.getenv('INSFORGE_URL')
api_key = os.getenv('INSFORGE_API_KEY')
sql = 'CREATE POLICY "Enable read access for all users" ON investigation_progress FOR SELECT USING (true);'
r = httpx.post(f'{url}/api/database/sql', headers={'Authorization': f'Bearer {api_key}'}, json={'query': sql})
print(r.status_code)
print(r.text)
