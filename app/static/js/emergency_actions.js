class EmergencySystem {
    constructor() {
        this.watchId = null;
        this.isTracking = false;
        this.emergencyTimer = null;
        this.isEmergencyPending = false;
        this.lastLat = 0;
        this.lastLon = 0;
    }

    startTracking() {
        if (!navigator.geolocation) {
            console.error('Geolocation is not supported');
            return;
        }

        this.isTracking = true;
        document.getElementById('gpsStatus').textContent = 'Active';
        document.getElementById('gpsStatus').className = 'badge bg-success';

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.handlePositionUpdate(position);
            },
            (error) => {
                console.error('Error getting location', error);
                document.getElementById('gpsStatus').textContent = 'Error';
                document.getElementById('gpsStatus').className = 'badge bg-danger';
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    }

    stopTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isTracking = false;
        document.getElementById('gpsStatus').textContent = 'Inactive';
        document.getElementById('gpsStatus').className = 'badge bg-secondary';
    }

    handlePositionUpdate(position) {
        const { latitude, longitude } = position.coords;
        this.lastLat = latitude;
        this.lastLon = longitude;

        console.log(`Location updated: ${latitude}, ${longitude}`);

        if (window.safetyModeActive && !this.isEmergencyPending) {
            this.sendLocation(latitude, longitude, 'periodic_update');
        }
    }

    async sendLocation(lat, lon, type = 'emergency') {
        try {
            const response = await fetch('/api/emergency/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location: `${lat},${lon}`, type: type })
            });
            const data = await response.json();

            if (data.sms_count > 0 && type !== 'periodic_update') {
                const transcriptDiv = document.getElementById('liveTranscript');
                if (transcriptDiv) transcriptDiv.innerHTML += `<div class="text-success fw-bold">✅ SERVER: Alerts sent to ${data.sms_count} contacts!</div>`;
            }
            return data;
        } catch (error) {
            console.log('Update error', error);
            return null;
        }
    }

    async preWarmPermissions() {
        console.log("Pre-warming Camera & Mic permissions...");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            stream.getTracks().forEach(track => track.stop());
            document.getElementById('cameraStatus').textContent = 'Ready';
            document.getElementById('cameraStatus').className = 'badge bg-success';
        } catch (e) {
            console.warn("Camera pre-warm failed:", e);
        }
    }

    async triggerEmergency(type = 'manual') {
        if (this.isEmergencyPending) return;

        console.warn('EMERGENCY INITIATED:', type);
        this.isEmergencyPending = true;
        this.showCancelOverlay(type);
    }

    showCancelOverlay(type) {
        const overlay = document.createElement('div');
        overlay.id = 'emergencyCancelOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,0,0,0.95);z-index:10000;display:flex;align-items:center;justify-content:center;color:white;flex-direction:column;text-align:center;padding:20px;';

        let secondsLeft = 5;
        overlay.innerHTML = `
            <div class="mb-4"><i class="bi bi-exclamation-octagon-fill" style="font-size:6rem; color: #fff; animation: pulse 1s infinite;"></i></div>
            <h1 class="display-1 fw-bold mb-0">${secondsLeft}</h1>
            <h2 class="mb-4">SENDING SOS IN...</h2>
            <p class="lead mb-5">Source: <strong>${type.toUpperCase()}</strong></p>
            <button id="cancelEmergencyBtn" class="btn btn-light btn-lg px-5 py-3 fw-bold text-danger border-0 shadow-lg" style="border-radius: 50px;">
                <i class="bi bi-x-circle-fill me-2"></i> STOP / CANCEL SOS
            </button>
            <style>
                @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
            </style>
        `;
        document.body.appendChild(overlay);

        const countdownDisplay = overlay.querySelector('h1');
        this.emergencyTimer = setInterval(() => {
            secondsLeft--;
            if (countdownDisplay) countdownDisplay.innerText = secondsLeft;
            if (secondsLeft <= 0) {
                clearInterval(this.emergencyTimer);
                this.executeEmergencyActions(type);
            }
        }, 1000);

        document.getElementById('cancelEmergencyBtn').onclick = () => this.cancelEmergency();
    }

    cancelEmergency() {
        console.log("EMERGENCY CANCELLED.");
        clearInterval(this.emergencyTimer);
        this.isEmergencyPending = false;
        const overlay = document.getElementById('emergencyCancelOverlay');
        if (overlay) overlay.remove();

        const transcriptDiv = document.getElementById('liveTranscript');
        if (transcriptDiv) transcriptDiv.innerHTML += `<div class="text-info fw-bold">🛡️ CANCELLED: SOS sequence stopped.</div>`;
    }

    async executeEmergencyActions(type) {
        this.isEmergencyPending = false;
        const overlay = document.getElementById('emergencyCancelOverlay');
        if (overlay) overlay.remove();

        this.showEmergencyUI();
        this.startTracking();
        this.startRecording();

        const transcriptDiv = document.getElementById('liveTranscript');
        if (transcriptDiv) transcriptDiv.innerHTML += `<div class="text-danger fw-bold">🚨 EXECUTING SOS PROTOCOLS...</div>`;

        const dispatchSOS = () => {
            this.sendLocation(this.lastLat || 0, this.lastLon || 0, 'emergency_sos_' + type)
                .then(data => {
                    console.log("SOS Dispatch Result:", data);
                    if (data && data.sms_count === 0) {
                        if (transcriptDiv) transcriptDiv.innerHTML += `<div class="text-warning fw-bold">⚠️ WARNING: No contacts found! SMS NOT SENT.</div>`;
                    }
                });
        };

        // Attempt fresh location (3s timeout) then dispatch
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                this.lastLat = position.coords.latitude;
                this.lastLon = position.coords.longitude;
                dispatchSOS();
            }, (err) => {
                console.warn("Location error, using cached:", err);
                dispatchSOS();
            }, { timeout: 3000, enableHighAccuracy: true });
        } else {
            dispatchSOS();
        }
    }

    showEmergencyUI() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;color:white;font-size:2rem;flex-direction:column;text-align:center;';
        overlay.innerHTML = `
            <div><i class="bi bi-exclamation-triangle-fill" style="font-size:5rem;"></i></div>
            <h1>EMERGENCY ACTIVE</h1>
            <p>Alerts Sent. Recording Evidence.</p>
            <button onclick="this.parentElement.remove()" class="btn btn-light mt-4">DISMISS</button>
        `;
        document.body.appendChild(overlay);
    }

    async startRecording() {
        console.log("Starting Evidence Recording...");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const chunks = [];

            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                await this.uploadEvidence(blob);

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'emergency_evidence_' + Date.now() + '.webm';
                document.body.appendChild(a);
                a.click();

                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                stream.getTracks().forEach(track => track.stop());

                const transcriptDiv = document.getElementById('liveTranscript');
                if (transcriptDiv) transcriptDiv.innerHTML += `<div class="text-info fw-bold">💾 Evidence Saved & Uploaded!</div>`;
            };

            mediaRecorder.start();
            setTimeout(() => { if (mediaRecorder.state !== 'inactive') mediaRecorder.stop(); }, 15000); // 15s clip

        } catch (err) {
            console.error('Recording error:', err);
        }
    }

    async uploadEvidence(blob) {
        const formData = new FormData();
        formData.append('file', blob, 'evidence_' + Date.now() + '.webm');
        try {
            await fetch('/api/upload_evidence', { method: 'POST', body: formData });
        } catch (e) {
            console.error("Upload failed", e);
        }
    }
}

const emergencySystem = new EmergencySystem();
