import os
from datetime import datetime
from flask import Blueprint, render_template, flash, redirect, url_for, request, jsonify, current_app
from flask_login import current_user, login_user, logout_user, login_required
from app import db, mail
from flask_mail import Message
from app.models import User, Contact, EmergencyLog, Zone, EvidenceLog


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
    trigger_type = data.get('type', 'manual')
    log = EmergencyLog(user_id=current_user.id, location=data.get('location'), trigger_type=trigger_type)
    db.session.add(log)
    db.session.commit()
    
    # --- AUTOMATIC SERVER-SIDE SMS (REAL TWILIO) ---
    # FILTER: Do not send SMS for periodic location updates
    if trigger_type == 'periodic_update':
        return jsonify({'status': 'success', 'message': 'Location updated (no SMS)'})

    from flask import current_app
    from twilio.rest import Client
    
    account_sid = str(current_app.config.get('TWILIO_ACCOUNT_SID') or '').strip()
    auth_token = str(current_app.config.get('TWILIO_AUTH_TOKEN') or '').strip()
    from_number = str(current_app.config.get('TWILIO_FROM_NUMBER') or '').strip()
    
    sms_sent_count = 0
    contacts = current_user.contacts.all()
    
    # Persistent Debug Logging to File
    with open('sos.log', 'a') as f:
        f.write(f"\n--- {datetime.now()} ---\n")
        f.write(f"TRIGGER: {trigger_type} | USER: {current_user.username}\n")
        f.write(f"LOCATION: {data.get('location')}\n")
        f.write(f"CONTACTS: {len(contacts)}\n")

        if account_sid and auth_token and from_number:
            try:
                client = Client(account_sid, auth_token)
                for contact in contacts:
                    phone = contact.phone.strip()
                    norm_phone = phone
                    if phone.startswith('0'): norm_phone = '+91' + phone[1:]
                    elif len(phone) == 10 and phone.isdigit(): norm_phone = '+91' + phone
                    elif not phone.startswith('+'): norm_phone = '+' + phone

                    # 1. SEND SMS
                    try:
                        message = client.messages.create(
                            body=f"ALERT! {current_user.username} SOS. Location: https://maps.google.com/?q={data.get('location', 'Unknown')}",
                            from_=from_number,
                            to=norm_phone
                        )
                        sms_sent_count += 1
                        f.write(f"SMS SUCCESS: {norm_phone} (SID: {message.sid})\n")
                    except Exception as inner_e:
                        f.write(f"SMS ERROR: {norm_phone} ({str(inner_e)})\n")
                        print(f"❌ [TWILIO ERROR] {norm_phone}: {str(inner_e)}")

                    # 2. SEND EMAIL
                    if contact.email:
                        try:
                            msg = Message(
                                subject=f"EMERGENCY SOS: {current_user.username}",
                                recipients=[contact.email],
                                body=f"I need help! My location: https://maps.google.com/?q={data.get('location', 'Unknown')}\n\nThis is an automated emergency alert from SafeGuard."
                            )
                            mail.send(msg)
                            f.write(f"EMAIL SUCCESS: {contact.email}\n")
                        except Exception as m_e:
                            f.write(f"EMAIL ERROR: {contact.email} ({str(m_e)})\n")
                            print(f"❌ [MAIL ERROR] {contact.email}: {str(m_e)}")

            except Exception as e:
                f.write(f"CLIENT ERROR: {str(e)}\n")
                print(f"❌ [ALERT CLIENT ERROR] {str(e)}")
        else:
            f.write("CONFIG ERROR: Twilio/Mail keys missing in .env\n")
    
    # --------------------------------
    
    return jsonify({
        'status': 'success', 
        'message': 'Emergency triggered', 
        'sms_count': sms_sent_count,
        'mode': 'real' if (account_sid and auth_token) else 'simulation'
    })

@bp.route('/api/upload_evidence', methods=['POST'])
@login_required
def upload_evidence():
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'No selected file'}), 400
    
    if file:
        import os
        from werkzeug.utils import secure_filename
        
        # Ensure uploads dir exists
        upload_folder = os.path.join(bp.root_path, 'static', 'uploads')
        os.makedirs(upload_folder, exist_ok=True)
        
        filename = secure_filename(file.filename)
        path = os.path.join(upload_folder, filename)
        file.save(path)
        
        # Save to DB
        new_evidence = EvidenceLog(
            user_id=current_user.id,
            filename=filename,
            type='video'
        )
        db.session.add(new_evidence)
        db.session.commit()
        
        print(f"🔥 EVIDENCE SAVED: {path}")
        return jsonify({'status': 'success', 'path': path})

@bp.route('/history')
@login_required
def history():
    evidence = EvidenceLog.query.filter_by(user_id=current_user.id).order_by(EvidenceLog.timestamp.desc()).all()
    return render_template('history.html', title='History', evidence_list=evidence)

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
    return jsonify({'contacts': [{'name': c.name, 'phone': c.phone, 'email': c.email} for c in contacts]})

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

@bp.route('/api/evidence/delete/<int:id>', methods=['POST'])
@login_required
def delete_evidence(id):
    evidence = EvidenceLog.query.get_or_404(id)
    if evidence.user_id != current_user.id:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 403
    
    # Delete file
    import os
    file_path = os.path.join(bp.root_path, 'static', 'uploads', evidence.filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Error deleting file: {e}")
        
    db.session.delete(evidence)
    db.session.commit()
    
    return jsonify({'status': 'success'})
