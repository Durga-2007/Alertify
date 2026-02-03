class AudioDetector {
    constructor(emergencySystem) {
        this.emergencySystem = emergencySystem;
        this.isListening = false;
        this.recognition = null;
        this.targetKeyword = 'help'; // Default
        this.audioContext = null; // For volume meter
        this.mediaStream = null;

        this.matchCount = 0;
        this.lastMatchTime = 0;
        this.initSpeechRecognition();
    }

    async initVolumeMeter() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaStream = stream;

            const source = this.audioContext.createMediaStreamSource(stream);
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const updateMeter = () => {
                if (!this.isListening) return;
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                const average = sum / dataArray.length;
                const volElement = document.getElementById('micVolume');
                if (volElement) {
                    volElement.style.width = Math.min(100, (average * 2)) + '%';
                    if (average > 5 && volElement.classList.contains('bg-danger')) {
                        volElement.className = 'progress-bar bg-success';
                    }
                }
                requestAnimationFrame(updateMeter);
            };
            updateMeter();
        } catch (e) {
            console.error('Volume meter init failed', e);
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
                        const result = event.results[i][0];
                        const transcript = result.transcript.trim().toLowerCase();
                        const confidence = result.confidence;

                        console.log(`Heard: "${transcript}" (Confidence: ${confidence})`);

                        // Update UI - Show what is heard
                        transcriptDiv.innerHTML += `<div>> ${transcript} <small class="text-muted">(${Math.round(confidence * 100)}%)</small></div>`;
                        transcriptDiv.scrollTop = transcriptDiv.scrollHeight;

                        // 0. Validate Keyword
                        if (!this.targetKeyword || this.targetKeyword.trim().length < 2) continue;

                        // 1. Check Confidence (STRICT: 0.85)
                        const isHighConfidence = confidence >= 0.85;

                        // 2. Word Boundary Check
                        const escapedKeyword = this.targetKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const keywordRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');

                        if (keywordRegex.test(transcript)) {
                            const now = Date.now();

                            if (isHighConfidence) {
                                // CASE A: HIGH CONFIDENCE MATCH -> TRIGGER IMMEDIATELY
                                console.warn('CONFIRMED MATCH (High Confidence):', this.targetKeyword);
                                transcriptDiv.innerHTML += `<div class="text-success fw-bold">🛡️ CONFIRMED: ${this.targetKeyword.toUpperCase()}</div>`;
                                this.stopListening(true);
                                this.emergencySystem.triggerEmergency('voice_keyword_confirmed');
                            } else {
                                // CASE B: LOW CONFIDENCE -> REQUIRE SECOND MATCH WITHIN 10 SECONDS
                                if (now - this.lastMatchTime < 10000) {
                                    this.matchCount++;
                                } else {
                                    this.matchCount = 1;
                                }
                                this.lastMatchTime = now;

                                if (this.matchCount >= 2) {
                                    console.warn('CONFIRMED MATCH (Double Match):', this.targetKeyword);
                                    transcriptDiv.innerHTML += `<div class="text-success fw-bold">🛡️ CONFIRMED (2nd Match): ${this.targetKeyword.toUpperCase()}</div>`;
                                    this.stopListening(true);
                                    this.emergencySystem.triggerEmergency('voice_keyword_confirmed_double');
                                } else {
                                    console.log('SUSPICIOUS: Keyword detected once (low confidence). Waiting for second match...');
                                    transcriptDiv.innerHTML += `<div class="text-warning small italic">Suspicious... say "${this.targetKeyword}" again to confirm.</div>`;
                                }
                            }
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
        const oldKeyword = this.targetKeyword;
        this.targetKeyword = word.toLowerCase();
        console.log('Keyword updated to:', this.targetKeyword);

        // If it changed while listening, we might need to reset recognition
        if (this.isListening && oldKeyword !== this.targetKeyword) {
            this.recognition.stop();
        }
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

    stopListening(immediate = false) {
        this.isListening = false;
        document.getElementById('audioStatus').textContent = 'Inactive';
        document.getElementById('audioStatus').className = 'badge bg-secondary';

        if (this.recognition) {
            if (immediate) {
                this.recognition.abort(); // Hard stop
            } else {
                this.recognition.stop();
            }
        }
    }
}

const audioDetector = new AudioDetector(emergencySystem);
