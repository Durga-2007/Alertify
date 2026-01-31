class AudioDetector {
    constructor(emergencySystem) {
        this.emergencySystem = emergencySystem;
        this.isListening = false;
        this.recognition = null;
        this.targetKeyword = 'help'; // Default
        this.audioContext = null; // For volume meter
        this.mediaStream = null;

        this.initSpeechRecognition();
    }

    async initVolumeMeter() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            // Reuse stream if possible or get new one. 
            // Note: SpeechRecognition usually manages its own stream. We might need a separate one or try to hook into it (hard).
            // Simplest is to request user media for "loud noise" visualization separately.

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaStream = stream;

            const source = this.audioContext.createMediaStreamSource(stream);
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const updateMeter = () => {
                if (!this.isListening) return; // Stop if not listening

                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;

                // Update UI (scale 0-255 to 0-100%)
                const volElement = document.getElementById('micVolume');
                if (volElement) {
                    volElement.style.width = Math.min(100, (average * 2)) + '%';

                    if (average > 5 && volElement.classList.contains('bg-danger')) {
                        // Reset color if receiving input
                        volElement.className = 'progress-bar bg-success';
                    }
                }

                requestAnimationFrame(updateMeter);
            };
            updateMeter();

        } catch (e) {
            console.error('Volume meter init failed', e);
            const transcriptDiv = document.getElementById('liveTranscript');
            if (transcriptDiv) transcriptDiv.innerHTML += `<div class="text-warning">⚠️ Visualizer Error: ${e.message}</div>`;
        }
    }

    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.lang = 'en-US';
            this.recognition.interimResults = false;

            this.recognition.onresult = (event) => {
                const transcriptDiv = document.getElementById('liveTranscript');

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        const transcript = event.results[i][0].transcript.trim().toLowerCase();
                        console.log('Heard:', transcript);

                        // Update UI
                        transcriptDiv.innerHTML += `<div>> ${transcript}</div>`;
                        transcriptDiv.scrollTop = transcriptDiv.scrollHeight;

                        if (transcript.includes(this.targetKeyword.toLowerCase())) {
                            console.warn('KEYWORD MATCHED:', this.targetKeyword);
                            transcriptDiv.innerHTML += `<div class="text-danger fw-bold">MATCHED: ${this.targetKeyword}</div>`;
                            this.emergencySystem.triggerEmergency('keyword_match');
                        }
                    }
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                const transcriptDiv = document.getElementById('liveTranscript');
                transcriptDiv.innerHTML += `<div class="text-danger">Error: ${event.error}</div>`;

                // Auto-restart if it cuts out, but be careful of infinite loops
                if (this.isListening && event.error !== 'not-allowed') {
                    // setTimeout(() => this.recognition.start(), 1000);
                }
            };

            this.recognition.onend = () => {
                if (this.isListening) {
                    this.recognition.start();
                }
            };
        } else {
            console.warn('Speech Recognition API not supported in this browser.');
        }
    }

    updateKeyword(word) {
        this.targetKeyword = word;
        console.log('Keyword updated to:', this.targetKeyword);
    }

    async startListening() {
        this.isListening = true;
        document.getElementById('audioStatus').textContent = 'Listening (Keyword)';
        document.getElementById('audioStatus').className = 'badge bg-success';

        // Start Visualizer
        this.initVolumeMeter();

        const transcriptDiv = document.getElementById('liveTranscript');
        transcriptDiv.innerHTML += `<div class="text-success">System: Starting Microphone...</div>`;

        if (this.recognition) {
            try {
                this.recognition.start();
                transcriptDiv.innerHTML += `<div class="text-success">System: Listening active. Speak now.</div>`;
            } catch (e) {
                console.log('Recognition already started');
                transcriptDiv.innerHTML += `<div class="text-warning">System: Already listening.</div>`;
            }
        } else {
            transcriptDiv.innerHTML += `<div class="text-danger">System: Speech API not supported.</div>`;
        }

        // Also keep the loud noise detection if needed? 
        // For battery efficiency, SpeechRecognition is better optimized by the browser than raw ScriptProcessor.
        // We will stick to just SpeechRecognition for this "Custom Keyword" tasks, as it covers the requirement.
    }

    stopListening() {
        this.isListening = false;
        document.getElementById('audioStatus').textContent = 'Inactive';
        document.getElementById('audioStatus').className = 'badge bg-secondary';

        if (this.recognition) {
            this.recognition.stop();
        }
    }
}

const audioDetector = new AudioDetector(emergencySystem);
