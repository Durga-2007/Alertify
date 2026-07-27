// --- UTILITY FUZZY MATCHING FUNCTIONS ---

function levenshtein(s1, s2) {
    const track = Array(s2.length + 1).fill(null).map(() =>
        Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) {
        track[0][i] = i;
    }
    for (let j = 0; j <= s2.length; j += 1) {
        track[j][0] = j;
    }
    for (let j = 1; j <= s2.length; j += 1) {
        for (let i = 1; i <= s1.length; i += 1) {
            const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1, // deletion
                track[j - 1][i] + 1, // insertion
                track[j - 1][i - 1] + indicator // substitution
            );
        }
    }
    return track[s2.length][s1.length];
}

function getSoundex(word) {
    if (!word) return "";
    const a = word.toLowerCase().replace(/[^a-z]/g, '').split('');
    if (a.length === 0) return "";
    const first = a.shift();
    const codes = {
        a: '', e: '', i: '', o: '', u: '', y: '', h: '', w: '',
        b: '1', f: '1', p: '1', v: '1',
        c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
        d: '3', t: '3',
        l: '4',
        m: '5', n: '5',
        r: '6'
    };
    
    let result = first + a.map(char => codes[char] || '').join('');
    
    // Remove adjacent duplicates
    result = result.replace(/(.)\1+/g, '$1');
    
    // Pad or truncate to 4 chars
    return (result + '0000').substring(0, 4).toUpperCase();
}

function isFuzzyMatch(transcript, targetKeyword) {
    const cleanTranscript = transcript.toLowerCase().trim();
    const cleanKeyword = targetKeyword.toLowerCase().trim();
    
    // 1. Direct substring check (fast path)
    if (cleanTranscript.includes(cleanKeyword)) {
        return { matched: true, reason: 'exact' };
    }
    
    // Split into words
    const transcriptWords = cleanTranscript.split(/\s+/).filter(w => w.length > 0);
    const keywordWords = cleanKeyword.split(/\s+/).filter(w => w.length > 0);
    const kwLength = keywordWords.length;
    
    if (transcriptWords.length < kwLength) return { matched: false };
    
    const kwSoundex = keywordWords.map(getSoundex).filter(x => x.length > 0);
    
    // Sliding window of words
    for (let i = 0; i <= transcriptWords.length - kwLength; i++) {
        const windowWords = transcriptWords.slice(i, i + kwLength);
        const windowStr = windowWords.join(' ');
        
        // Check Levenshtein similarity (threshold >= 0.65 for high tolerance)
        const dist = levenshtein(windowStr, cleanKeyword);
        const maxLen = Math.max(windowStr.length, cleanKeyword.length);
        const similarity = maxLen === 0 ? 1 : 1 - (dist / maxLen);
        
        if (similarity >= 0.65) {
            return { matched: true, reason: `fuzzy similarity (${Math.round(similarity * 100)}%)` };
        }
        
        // Check Soundex phonetic match
        const windowSoundex = windowWords.map(getSoundex);
        let soundexMatch = true;
        for (let j = 0; j < kwLength; j++) {
            if (!kwSoundex[j] || windowSoundex[j] !== kwSoundex[j]) {
                soundexMatch = false;
                break;
            }
        }
        if (soundexMatch && kwSoundex.length > 0) {
            return { matched: true, reason: `phonetic matching (soundex)` };
        }
    }
    
    return { matched: false };
}

class AudioDetector {
    constructor(emergencySystem) {
        this.emergencySystem = emergencySystem;
        this.isListening = false;
        this.recognition = null;
        this.targetKeyword = 'mathew'; // Default
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

                        // 1. Check Confidence (Changed to 0.30 as requested)
                        const isHighConfidence = confidence >= 0.30;

                        // 2. Perform Exact, Fuzzy, and Phonetic Check
                        const matchResult = isFuzzyMatch(transcript, this.targetKeyword);

                        if (matchResult.matched) {
                            const now = Date.now();

                            if (isHighConfidence) {
                                // CASE A: HIGH CONFIDENCE MATCH (>= 30%) -> TRIGGER IMMEDIATELY
                                console.warn(`CONFIRMED MATCH via ${matchResult.reason}:`, this.targetKeyword);
                                transcriptDiv.innerHTML += `<div class="text-success fw-bold">🛡️ CONFIRMED (${matchResult.reason}): ${this.targetKeyword.toUpperCase()}</div>`;
                                this.stopListening(true);
                                this.emergencySystem.triggerEmergency('voice_keyword_confirmed');
                            } else {
                                // CASE B: VERY LOW CONFIDENCE (< 30%) -> REQUIRE SECOND MATCH WITHIN 10 SECONDS
                                if (now - this.lastMatchTime < 10000) {
                                    this.matchCount++;
                                } else {
                                    this.matchCount = 1;
                                }
                                this.lastMatchTime = now;

                                if (this.matchCount >= 2) {
                                    console.warn(`CONFIRMED MATCH via ${matchResult.reason} (Double Match):`, this.targetKeyword);
                                    transcriptDiv.innerHTML += `<div class="text-success fw-bold">🛡️ CONFIRMED (2nd Match - ${matchResult.reason}): ${this.targetKeyword.toUpperCase()}</div>`;
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
        this.targetKeyword = word.toLowerCase().trim();
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
