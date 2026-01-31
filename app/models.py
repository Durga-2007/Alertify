from app import db, login
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(128))
    points = db.Column(db.Integer, default=0)
    safety_mode = db.Column(db.Boolean, default=False)
    contacts = db.relationship('Contact', backref='owner', lazy='dynamic')
    logs = db.relationship('EmergencyLog', backref='user', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

@login.user_loader
def load_user(id):
    return User.query.get(int(id))

class Contact(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    name = db.Column(db.String(64))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(120))

class EmergencyLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    timestamp = db.Column(db.DateTime, index=True, default=datetime.utcnow)
    location = db.Column(db.String(120)) # Stored as JSON or simple string "lat,lon"
    trigger_type = db.Column(db.String(20)) # 'voice', 'keyword', 'manual'
    status = db.Column(db.String(20), default='active')

class Zone(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    lat = db.Column(db.Float)
    lon = db.Column(db.Float)
    type = db.Column(db.String(10)) # 'safe' or 'unsafe'
    description = db.Column(db.String(140))
    reported_by = db.Column(db.Integer, db.ForeignKey('user.id'))

class EvidenceLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    filename = db.Column(db.String(255))
    timestamp = db.Column(db.DateTime, index=True, default=datetime.utcnow)
    type = db.Column(db.String(20)) # 'video', 'audio', 'image'
