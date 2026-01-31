from app import create_app, db
from app.models import User

app = create_app()

with app.app_context():
    print("Creating database tables...")
    db.create_all()
    print("Tables created.")
    
    # Check if admin exists
    if not User.query.filter_by(username='admin').first():
        print("Creating admin user...")
        u = User(username='admin', email='admin@example.com')
        u.set_password('password')
        db.session.add(u)
        db.session.commit()
        print("Admin user created (admin/password).")
    else:
        print("Admin user already exists.")
