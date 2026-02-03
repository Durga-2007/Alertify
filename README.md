# Alertify - Smart Emergency Safety App

Alertify is a powerful emergency safety application designed to provide instant protection and alerting through voice detection and automated SOS protocols.

## 🚀 Features
- **Voice Triggered SOS**: Automatically detects danger keywords (e.g., "Help") to trigger alerts hands-free.
- **Silent Real SMS**: Delivers immediate location-based SMS alerts to emergency contacts via the Twilio API.
- **Automatic Monitoring**: Starts listening and location tracking automatically upon login for zero-delay protection.
- **Evidence History**: Records audio, video, and GPS coordinates during emergencies for later review and download.
- **Safety Maps**: Report and view safe/unsafe zones within your community.

## 🛠️ Technology Stack
- **Backend**: Flask (Python), SQLAlchemy, SQLite
- **Frontend**: Vanilla JavaScript (ES6+), Bootstrap 5, TensorFlow.js (for Audio)
- **APIs**: Twilio (SMS), Web Speech API, Geolocation API, MediaRecorder API
- **Mobile Transition**: Capacitor (Hybrid wrapper)

## 📋 Setup Instructions
1. **Clone the repository**:
   ```bash
   git clone https://github.com/Durga-2007/Alertify.git
   ```
2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Configure Environment Variables**:
   Create a `.env` file and fill in your Twilio credentials:
   ```text
   SECRET_KEY=your_secret_key
   TWILIO_ACCOUNT_SID=your_sid
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_FROM_NUMBER=your_twilio_number
   ```
4. **Initialize the Database**:
   ```bash
   python init_db.py
   ```
5. **Run the application**:
   ```bash
   python run.py
   ```

## 🛡️ Safety Protocols
The app is designed to be **unobtrusive**. Once permissions are granted, monitoring runs silently. SMS alerts are sent from the server side to ensure they bypass browser limitations and arrive instantly.

---
Developed with ❤️ by Durga | [Alertify GitHub Repository](https://github.com/Durga-2007/Alertify.git)


































