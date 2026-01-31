from flask import Blueprint, render_template, flash, redirect, url_for, request, jsonify
from flask_login import current_user, login_user, logout_user, login_required
from app import db
from app.models import User, Contact, EmergencyLog, Zone


bp = Blueprint('main', __name__)

@bp.route('/')
@bp.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html', title='Dashboard')

@bp.route('/index')
def index():
     return render_template('index.html', title='Home')

@bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    # Logic for POST login usually handled here
    if request.method == 'POST':
        user = User.query.filter_by(username=request.form['username']).first()
        if user is None or not user.check_password(request.form['password']):
            flash('Invalid username or password')
            return redirect(url_for('main.login'))
        login_user(user)
        return redirect(url_for('main.dashboard'))
    return render_template('login.html', title='Sign In')

@bp.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('main.index'))

@bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
         return redirect(url_for('main.dashboard'))
    if request.method == 'POST':
        user = User(username=request.form['username'], email=request.form['email'])
        user.set_password(request.form['password'])
        db.session.add(user)
        db.session.commit()
        flash('Congratulations, you are now a registered user!')
        return redirect(url_for('main.login'))
    return render_template('register.html', title='Register')

@bp.route('/api/emergency/trigger', methods=['POST'])
@login_required
def trigger_emergency():
    data = request.json
    log = EmergencyLog(user_id=current_user.id, location=data.get('location'), trigger_type=data.get('type'))
    db.session.add(log)
    db.session.commit()
    
    # --- AUTOMATIC SMS SIMULATION ---
    # In a real app, this is where Twilio/Vonage code would go.
    # Since we are "Automatic", the server takes control here.
    contacts = current_user.contacts.all()
    print("\n" + "="*50)
    print(f"🚨 EMERGENCY ALERT RECEIVED FROM USER: {current_user.username}")
    print(f"📍 LOCATION: {data.get('location')}")
    print("📲 INITIATING AUTOMATIC SMS ACTIONS...")
    
    if not contacts:
         print("❌ NO CONTACTS FOUND! CANNOT SEND SMS.")
    
    for contact in contacts:
        # Simulate Network Request to SMS Gateway
        print(f"   -> [SERVER] Sending AUTO-SMS to {contact.name} ({contact.phone})...")
        print(f"   -> [CONTENT] 'SOS! {current_user.username} is in danger! Location: {data.get('location')}'")
        print(f"   -> [STATUS] ✅ SENT (Simulated)")
        
    print("="*50 + "\n")
    # --------------------------------
    
    return jsonify({'status': 'success', 'message': 'Emergency triggered', 'sms_count': len(contacts)})

@bp.route('/api/contacts', methods=['GET', 'POST'])
@login_required
def manage_contacts():
    if request.method == 'POST':
        data = request.json
        contact = Contact(user_id=current_user.id, name=data['name'], phone=data['phone'], email=data['email'])
        db.session.add(contact)
        db.session.commit()
        return jsonify({'status': 'success'})
    contacts = current_user.contacts.all()
    return jsonify({'contacts': [{'name': c.name, 'phone': c.phone} for c in contacts]})

@bp.route('/api/zones', methods=['GET', 'POST'])
def handle_zones():
    if request.method == 'POST':
        if not current_user.is_authenticated:
            return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
            
        data = request.json
        zone = Zone(
            lat=data['lat'], 
            lon=data['lon'], 
            type=data['type'], 
            description=data.get('description', 'User Reported'),
            reported_by=current_user.id
        )
        db.session.add(zone)
        db.session.commit()
        return jsonify({'status': 'success', 'id': zone.id})

    zones = Zone.query.all()
    return jsonify([{'lat': z.lat, 'lon': z.lon, 'type': z.type, 'desc': z.description} for z in zones])

@bp.route('/map')
@login_required
def safety_map():
    return render_template('map.html', title='Safety Map')
