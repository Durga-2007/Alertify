from app import create_app, db
from app.models import User, Contact
app = create_app()
from app.models import EmergencyLog
with app.app_context():
    print("--- LAST 10 EMERGENCY LOGS ---")
    logs = EmergencyLog.query.order_by(EmergencyLog.timestamp.desc()).limit(10).all()
    for l in logs:
        print(f"{l.timestamp}: {l.trigger_type} ({l.location})")
