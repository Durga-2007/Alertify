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

    // Safety Toggle Logic
    safetyToggle.addEventListener('click', () => {
        window.safetyModeActive = !window.safetyModeActive;

        if (window.safetyModeActive) {
            // Activate
            safetyToggle.classList.add('active');
            safetyToggle.innerText = 'SOS ON';
            statusText.innerText = 'EMERGENCY MODE ACTIVE - Monitoring Environment';

            // Start Systems
            emergencySystem.startTracking();
            audioDetector.startListening();

        } else {
            // Deactivate
            // In a real app, require PIN here
            if (confirm("Enter PIN to disable (Simulated)")) {
                safetyToggle.classList.remove('active');
                safetyToggle.innerText = 'OFF';
                statusText.innerText = 'Tap to activate Emergency Monitoring';

                // Stop Systems
                emergencySystem.stopTracking();
                audioDetector.stopListening();
            } else {
                window.safetyModeActive = true; // Re-enable if cancelled
            }
        }
    });

    // Add Contact Form
    document.getElementById('addContactForm').addEventListener('submit', async (e) => {
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
