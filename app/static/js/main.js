document.addEventListener('DOMContentLoaded', () => {
    const safetyToggle = document.getElementById('safetyToggle');
    const statusText = document.getElementById('statusText');
    window.safetyModeActive = false;

    // Load contacts
    loadContacts();

    // Keyword Logic
    const savedKeyword = localStorage.getItem('emergencyKeyword') || 'help';
    document.getElementById('customKeyword').value = savedKeyword;
    audioDetector.updateKeyword(savedKeyword);

    document.getElementById('saveKeywordBtn').addEventListener('click', () => {
        const keyword = document.getElementById('customKeyword').value;
        if (keyword) {
            localStorage.setItem('emergencyKeyword', keyword);
            audioDetector.updateKeyword(keyword);
            alert(`Emergency keyword saved: "${keyword}"`);
        }
    });

    // 1. SOS Button Logic (Immediate Trigger)
    const sosBtn = document.getElementById('sosBtn');
    if (sosBtn) {
        sosBtn.addEventListener('click', () => {
            // Standardize on centralized trigger
            emergencySystem.triggerEmergency('manual_sos_button');

            // UI Feedback
            statusText.innerText = 'SOS ACTIVE! Sending Alerts & Recording...';
            statusText.classList.add('text-danger', 'fw-bold');
        });
    }

    // 2. Safety Toggle Logic (Monitoring Only)
    safetyToggle.addEventListener('click', () => {
        window.safetyModeActive = !window.safetyModeActive;

        if (window.safetyModeActive) {
            // Activate Monitoring
            safetyToggle.classList.remove('btn-outline-primary');
            safetyToggle.classList.add('btn-primary');
            safetyToggle.innerHTML = '<i class="bi bi-mic-fill"></i> Monitor ON';
            statusText.innerText = 'Listening for keyword...';

            // Start Systems
            emergencySystem.startTracking();
            audioDetector.startListening();

            // Pre-Warm Camera/Mic so emergency recording is instant and silent later
            emergencySystem.preWarmPermissions();

            // NOTE: We do NOT trigger emergency here automatically anymore.
            // The user wants: 
            // 1. SOS Button -> Sends Msg
            // 2. Monitoring -> Waiting for Voice -> Sends Msg

        } else {
            // Deactivate
            safetyToggle.classList.remove('btn-primary');
            safetyToggle.classList.add('btn-outline-primary');
            safetyToggle.innerHTML = '<i class="bi bi-mic-mute"></i> Monitor OFF';
            statusText.innerText = 'Tap to activate Voice & Location Monitoring';

            // Stop Systems
            emergencySystem.stopTracking();
            audioDetector.stopListening();
        }
    });

    // Add Contact Form
    const addContactForm = document.getElementById('addContactForm');
    if (addContactForm) {
        addContactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            const res = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                bootstrap.Modal.getInstance(document.getElementById('addContactModal')).hide();
                loadContacts();
                e.target.reset();
            }
        });
    }

    // --- ROBUST ACTIVATION ---
    // Browsers block Mic/Camera if the user hasn't clicked anything.
    // We try auto-click, but if it fails or doesn't start, we prompt the user.
    console.log("🛠️ System: Initiating Protection Seq...");

    const startProtection = () => {
        if (!window.safetyModeActive) {
            console.log("🛡️ Protection: Starting via User Interaction...");
            safetyToggle.click(); // This will now run in a real Click event or the timeout
            const transcriptDiv = document.getElementById('liveTranscript');
            if (transcriptDiv) {
                transcriptDiv.innerHTML += `<div class="text-primary fw-bold">🛡️ AUTO-PROTECT: System Armed.</div>`;
            }
        }
        // Remove listener after first interaction
        document.removeEventListener('click', startProtection);
    };

    // Try auto-click after 1s
    setTimeout(() => {
        if (!window.safetyModeActive) {
            safetyToggle.click();
            // If it still didn't start (browser blocked it), add a page-wide click listener
            setTimeout(() => {
                if (!window.safetyModeActive) {
                    console.warn("⚠️ System: Browser blocked auto-start. Waiting for any user click...");
                    statusText.innerHTML = '<span class="text-warning fw-bold"><i class="bi bi-hand-index-thumb"></i> CLICK ANYWHERE to arm security</span>';
                    document.addEventListener('click', startProtection);
                }
            }, 500);
        }
    }, 1000);
});

async function loadContacts() {
    const list = document.getElementById('contactsList');
    try {
        const res = await fetch('/api/contacts');
        const data = await res.json();

        list.innerHTML = data.contacts.map(c => `
            <div class="alert alert-secondary d-flex justify-content-between align-items-center">
                <span><strong>${c.name}</strong> (${c.phone})</span>
                <a href="tel:${c.phone}" class="btn btn-success btn-sm" target="_blank">
                    <i class="bi bi-telephone-fill"></i> Call
                </a>
            </div>
        `).join('');

        if (data.contacts.length === 0) {
            list.innerHTML = '<p class="text-muted text-center">No contacts added.</p>';
        }
    } catch (err) {
        console.error('Failed to load contacts', err);
    }
}
