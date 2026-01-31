import os
from app import create_app, db
from app.models import User, Contact, EmergencyLog, Zone

app = create_app()

@app.shell_context_processor
def make_shell_context():
    return {'db': db, 'User': User, 'Contact': Contact, 'EmergencyLog': EmergencyLog, 'Zone': Zone}

if __name__ == '__main__':
    app.run(debug=True, port=int(os.environ.get('PORT', 5000)))
