import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

from app import create_app, db
from app.models import User, Contact, EmergencyLog, Zone, EvidenceLog

app = create_app()

# Twilio Startup Check
sid = app.config.get('TWILIO_ACCOUNT_SID', '').strip()
if sid:
    print(f"📡 [STARTUP] Twilio SID loaded: {sid[:5]}...{sid[-5:]}")
else:
    print("⚠️ [STARTUP] TWILIO_ACCOUNT_SID is missing in .env")

@app.shell_context_processor
def make_shell_context():
    return {'db': db, 'User': User, 'Contact': Contact, 'EmergencyLog': EmergencyLog, 'Zone': Zone}

if __name__ == '__main__':
    app.run(debug=True, port=int(os.environ.get('PORT', 5000)))
