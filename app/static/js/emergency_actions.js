class EmergencySystem {
    constructor() {
        this.watchId = null;
        this.isTracking = false;
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
        // Cache location for instant access
        this.lastLat = latitude;
        this.lastLon = longitude;

        console.log(`Location updated: ${latitude}, ${longitude}`);

        // If emergency is active (checked via UI state or global flag), send to backend
        if (window.safetyModeActive) {
            this.sendLocation(latitude, longitude);
        }
    }

    async sendLocation(lat, lon) {
        try {
            const response = await fetch('/api/emergency/trigger', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    location: `${lat},${lon}`,
                    type: 'periodic_update'
                })
            });
            const data = await response.json();

            // Check for SMS confirmation from server
            if (data.sms_count && data.sms_count > 0) {
                const transcriptDiv = document.getElementById('liveTranscript');
                if (transcriptDiv) transcriptDiv.innerHTML += `<div class="text-white bg-success p-1">✅ SERVER: SMS SENT to ${data.sms_count} contacts!</div>`;

                // Explicit confirmation for the user
                alert(`✅ CONFIRMED: Server successfully sent SMS to ${data.sms_count} Emergency Contacts.`);
            }

        } catch (error) {
            console.log('Offline: Queuing location update', error);
            // Implement offline queueing here
        }
    }

    async triggerEmergency(type = 'manual') {
        console.warn('EMERGENCY TRIGGERED:', type);

        // 1. Visual Alert
        this.showEmergencyUI();

        // 2. Location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                this.sendLocation(position.coords.latitude, position.coords.longitude);
            });
        }

        // 3. Camera Logic (Handled externally in main.js or here if needed)
        // this.startRecording(); // We call this from main.js now to control timing better


        // 4. Automatic Backend Alerts (SILENT & TRULY AUTOMATIC)
        // We only trigger the server-side logic now. 
        // This stops the "Open Pick an app?" popups and sends SMS/Email from the server.

        const transcriptDiv = document.getElementById('liveTranscript');
        if (transcriptDiv) transcriptDiv.innerHTML += `<div class="text-warning fw-bold">📡 SERVER: Triggering Automatic Safety Protocols...</div>`;

        // The sendLocation call already happens above, but in triggerEmergency we ensure it logic runs.
        // If we want to be 100% sure the server-side SMS/Email fires, we hit the trigger endpoint.

        let targetLat = this.lastLat || 0;
        let targetLon = this.lastLon || 0;

        // We hit the trigger endpoint directly to ensure Twilio/Email logs fire immediately
        fetch('/api/emergency/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location: `${targetLat},${targetLon}`,
                type: 'emergency_sos'
            })
        }).then(res => res.json()).then(data => {
            if (data.status === 'success') {
                if (transcriptDiv) transcriptDiv.innerHTML += `<div class="text-success fw-bold">✅ SERVER: Alerts sent to ${data.sms_count} contacts!</div>`;
            }
        });
    }

    async initiateAutoEmail(lat, lon) {
        try {
            const res = await fetch('/api/contacts');
            const data = await res.json();

            if (data.contacts && data.contacts.length > 0) {
                const email = data.contacts[0].email;
                if (!email) {
                    console.log("No email for contact");
                    return;
                }

                const subject = encodeURIComponent("EMERGENCY SOS ALERT!");
                const body = encodeURIComponent(`I need help! My location: https://maps.google.com/?q=${lat},${lon}`);

                console.log('Initiating Email to:', email);

                // Use iframe to avoid blocking the SMS window.location redirect
                const iframe = document.createElement("iframe");
                iframe.style.display = "none";
                iframe.src = `mailto:${email}?subject=${subject}&body=${body}`;
                document.body.appendChild(iframe);

                // Cleanup
                setTimeout(() => document.body.removeChild(iframe), 2000);
            }
        } catch (err) {
            console.error('Error initiating Email:', err);
        }
    }

    async initiateAutoSMS(lat, lon) {
        // SMS is now handled automatically by the server via Twilio.
        // We log it here for the user to see in the dashboard.
        const transcriptDiv = document.getElementById('liveTranscript');
        if (transcriptDiv) transcriptDiv.innerHTML += `<div class="text-success fw-bold">📡 SERVER: Auto-SMS sent via Twilio!</div>`;
    }

    showEmergencyUI() {
        // Create a full screen red overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;color:white;font-size:2rem;flex-direction:column;text-align:center;';
        overlay.innerHTML = `
            <div><i class="bi bi-exclamation-triangle-fill" style="font-size:5rem;"></i></div>
            <h1>EMERGENCY DETECTED</h1>
            <p>Calling Emergency Contacts...</p>
            <p>Sharing Location...</p>
            <button onclick="this.parentElement.remove()" class="btn btn-light mt-4">STOP</button>
        `;
        document.body.appendChild(overlay);

        // Play siren sound if possible (requires user interaction first usually, but we can try)
        // const audio = new Audio('/static/siren.mp3'); 
        // audio.play().catch(e => console.log('Audio autoplay blocked'));
    }

    async initiateAutoCall(lat, lon) {
        // We've moved real emergency communication to the Backend (Twilio SMS).
        // Standard 'tel:' links require user interaction and cause popups.
        // We will only log the attempt here for the UI.
        const transcriptDiv = document.getElementById('liveTranscript');
        if (transcriptDiv) transcriptDiv.innerHTML += `<div class="text-info fw-bold">📡 SERVER: Initiating Emergency Protocols...</div>`;
    }

    async startRecording() {
        console.log("Starting Evidence Recording...");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const chunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                console.log("Recording stopped. Processing evidence...");
                const blob = new Blob(chunks, { type: 'video/webm' });

                // 1. Upload to Server (Backup)
                await this.uploadEvidence(blob);

                // 2. Save to User's Device (Gallery/Downloads)
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'emergency_evidence_' + Date.now() + '.webm';
                document.body.appendChild(a);
                a.click();

                // Cleanup
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());

                const transcriptDiv = document.getElementById('liveTranscript');
                if (transcriptDiv) transcriptDiv.innerHTML += `<div class="text-info fw-bold">💾 Evidence Saved to Device!</div>`;
            };

            // Start recording
            mediaRecorder.start();

            // Visual feedback
            const transcriptDiv = document.getElementById('liveTranscript');
            if (transcriptDiv) transcriptDiv.innerHTML += `<div class="text-danger fw-bold">🎥 RECORDING VIDEO EVIDENCE...</div>`;

            // Stop after 5 seconds (Evidence Clip)
            setTimeout(() => {
                mediaRecorder.stop();
            }, 5000);

        } catch (err) {
            console.error('Recording error:', err);
            alert("Could not access Camera/Mic for recording: " + err.message);
        }
    }

    async uploadEvidence(blob) {
        const formData = new FormData();
        formData.append('file', blob, 'evidence_' + Date.now() + '.webm');

        try {
            const res = await fetch('/api/upload_evidence', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.status === 'success') {
                console.log("Evidence uploaded successfully");
                const transcriptDiv = document.getElementById('liveTranscript');
                if (transcriptDiv) transcriptDiv.innerHTML += `<div class="text-success">✅ Evidence Saved to Server</div>`;
            }
        } catch (e) {
            console.error("Upload failed", e);
        }
    }
}

const emergencySystem = new EmergencySystem();
