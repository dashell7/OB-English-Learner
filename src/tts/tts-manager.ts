// Temporary stub for TTS Manager - needs full implementation
import { App, requestUrl } from 'obsidian';
import { LinguaSyncSettings } from '../types';

export class TTSManager {
    app: App;
    settings: LinguaSyncSettings;

    constructor(app: App, settings: LinguaSyncSettings) {
        this.app = app;
        this.settings = settings;
    }

    async speak(text: string): Promise<void> {
        if (!text || text.trim().length === 0) {
            throw new Error('No text provided for TTS');
        }

        const provider = this.settings.ttsProvider || 'openai';
        
        try {
            let audioBuffer: ArrayBuffer;
            
            switch (provider) {
                case 'openai':
                    audioBuffer = await this.speakOpenAI(text);
                    break;
                case 'azure':
                    audioBuffer = await this.speakAzure(text);
                    break;
                case 'elevenlabs':
                    audioBuffer = await this.speakElevenLabs(text);
                    break;
                default:
                    throw new Error(`Unsupported TTS provider: ${provider}`);
            }
            
            // Play audio
            await this.playAudio(audioBuffer);
            
        } catch (error) {
            console.error('TTS speak error:', error);
            throw error;
        }
    }

    private async playAudio(audioBuffer: ArrayBuffer): Promise<void> {
        return new Promise((resolve, reject) => {
            const audioContext = new AudioContext();
            
            audioContext.decodeAudioData(audioBuffer.slice(0), (buffer) => {
                const source = audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContext.destination);
                
                source.onended = () => {
                    audioContext.close();
                    resolve();
                };
                
                source.start(0);
            }, (error) => {
                audioContext.close();
                reject(new Error('Failed to decode audio: ' + error));
            });
        });
    }

    async getAzureVoices(): Promise<any[]> {
        try {
            const apiKey = this.settings.ttsApiKey || this.settings.aiApiKey;
            const region = this.settings.ttsBaseUrl || 'eastus';
            
            if (!apiKey || !region) {
                console.error('Azure TTS: Missing API key or region');
                return [];
            }

            const response = await requestUrl({
                url: `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
                method: 'GET',
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey
                }
            });

            if (response.status === 200) {
                return response.json;
            } else {
                console.error('Failed to fetch Azure voices:', response.status);
                return [];
            }
        } catch (error) {
            console.error('Error fetching Azure voices:', error);
            return [];
        }
    }

    async getCacheSize(): Promise<number> {
        return 0;
    }

    async clearCache(): Promise<void> {
        console.log('Clear cache called (stub)');
    }

    async speakOpenAI(text: string): Promise<ArrayBuffer> {
        const apiKey = this.settings.ttsApiKey || this.settings.aiApiKey;
        if (!apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const model = this.settings.ttsModel || 'tts-1';
        const voice = this.settings.ttsVoice || 'alloy';
        const speed = this.settings.ttsSpeed || 1.0;

        try {
            const response = await requestUrl({
                url: 'https://api.openai.com/v1/audio/speech',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    input: text,
                    voice: voice,
                    speed: speed
                })
            });

            if (response.status === 200) {
                return response.arrayBuffer;
            } else {
                throw new Error(`OpenAI TTS failed with status ${response.status}`);
            }
        } catch (error) {
            console.error('OpenAI TTS error:', error);
            throw new Error(`OpenAI TTS error: ${error.message}`);
        }
    }

    async speakAzure(text: string): Promise<ArrayBuffer> {
        const apiKey = this.settings.ttsApiKey || this.settings.aiApiKey;
        const region = this.settings.ttsBaseUrl || 'eastus';
        const voice = this.settings.ttsVoice || 'en-US-JennyNeural';
        const outputFormat = this.settings.ttsOutputFormat || 'audio-16khz-128kbitrate-mono-mp3';

        if (!apiKey) {
            throw new Error('Azure API key not configured');
        }

        try {
            // Construct SSML
            const ssml = `<speak version='1.0' xml:lang='en-US'>
                <voice name='${voice}'>${text}</voice>
            </speak>`;

            const response = await requestUrl({
                url: `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey,
                    'Content-Type': 'application/ssml+xml',
                    'X-Microsoft-OutputFormat': outputFormat,
                    'User-Agent': 'OB-English-Learner'
                },
                body: ssml
            });

            if (response.status === 200) {
                return response.arrayBuffer;
            } else {
                throw new Error(`Azure TTS failed with status ${response.status}`);
            }
        } catch (error) {
            console.error('Azure TTS error:', error);
            throw new Error(`Azure TTS error: ${error.message}`);
        }
    }

    async speakElevenLabs(text: string): Promise<ArrayBuffer> {
        const apiKey = this.settings.ttsApiKey || this.settings.aiApiKey;
        const voiceId = this.settings.ttsVoice || '21m00Tcm4TlvDq8ikWAM'; // Default: Rachel
        const modelId = this.settings.ttsModel || 'eleven_monolingual_v1';

        if (!apiKey) {
            throw new Error('ElevenLabs API key not configured');
        }

        try {
            const response = await requestUrl({
                url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: modelId,
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (response.status === 200) {
                return response.arrayBuffer;
            } else {
                throw new Error(`ElevenLabs TTS failed with status ${response.status}`);
            }
        } catch (error) {
            console.error('ElevenLabs TTS error:', error);
            throw new Error(`ElevenLabs TTS error: ${error.message}`);
        }
    }
}
