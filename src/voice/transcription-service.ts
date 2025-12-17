import { requestUrl, Notice } from 'obsidian';
import type { LinguaSyncSettings } from '../types';

export class TranscriptionService {
  private settings: LinguaSyncSettings;

  constructor(settings: LinguaSyncSettings) {
    this.settings = settings;
  }

  updateSettings(settings: LinguaSyncSettings) {
    this.settings = settings;
  }

  async transcribe(audioBlob: Blob, extension?: string): Promise<string> {
    const provider = this.settings.sttProvider || 'openai';

    if (provider === 'azure') {
      return this.transcribeAzure(audioBlob);
    } else if (provider === 'assemblyai') {
      return this.transcribeAssemblyAI(audioBlob);
    } else {
      return this.transcribeOpenAI(audioBlob, extension);
    }
  }

  async transcribeAssemblyAI(audioBlob: Blob): Promise<string> {
    if (!this.settings.sttApiKey) {
      throw new Error('Please configure API Key for Voice to Text');
    }

    const apiKey = this.settings.sttApiKey;
    
    try {
      // 1. Upload Audio
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uploadResponse = await requestUrl({
        url: 'https://api.assemblyai.com/v2/upload',
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/octet-stream'
        },
        body: arrayBuffer
      });

      if (uploadResponse.status !== 200) {
        throw new Error(`AssemblyAI Upload Error: ${uploadResponse.status}`);
      }
      const uploadUrl = uploadResponse.json.upload_url;

      // 2. Submit Transcription Job
      const submitBody: any = {
        audio_url: uploadUrl
      };
      
      if (this.settings.sttLanguage) {
        submitBody.language_code = this.settings.sttLanguage;
      } else {
        submitBody.language_detection = true;
      }

      const transcriptResponse = await requestUrl({
        url: 'https://api.assemblyai.com/v2/transcript',
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitBody)
      });

      if (transcriptResponse.status !== 200) {
        const errorMsg = transcriptResponse.json?.error || transcriptResponse.status;
        throw new Error(`AssemblyAI Submit Error: ${errorMsg}`);
      }
      const transcriptId = transcriptResponse.json.id;

      // 3. Poll for Completion
      let status = 'queued';
      let attempts = 0;
      const maxAttempts = 180; // 3 minutes timeout

      while (status !== 'completed' && status !== 'error') {
        attempts++;
        if (attempts > maxAttempts) throw new Error('AssemblyAI Timeout (3 mins)');

        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s

        const pollResponse = await requestUrl({
          url: `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
          method: 'GET',
          headers: {
            'Authorization': apiKey
          }
        });

        if (pollResponse.status !== 200) {
          throw new Error(`AssemblyAI Poll Error: ${pollResponse.status}`);
        }

        status = pollResponse.json.status;
        if (status === 'error') {
          throw new Error(`AssemblyAI Processing Error: ${pollResponse.json.error}`);
        }
        
        if (status === 'completed') {
            return pollResponse.json.text;
        }
      }
      
      throw new Error('AssemblyAI Unknown Error');

    } catch (error) {
      console.error('AssemblyAI Transcription Error', error);
      throw new Error('AssemblyAI Failed: ' + error.message);
    }
  }

  async transcribeAzure(audioBlob: Blob): Promise<string> {
    // Azure requires Region which we might not have in simple settings
    // For now, we assume the user puts region in BaseUrl or we might need to parse it or add a field?
    // Let's assume sttBaseUrl is used for Region if provider is Azure?
    // Or simpler: warn user Azure is not fully supported in this simplified integration yet
    // But let's try to use sttBaseUrl as Region if user knows.
    
    if (!this.settings.sttApiKey) {
       throw new Error('Please configure API Key');
    }
    
    // Hack: Use sttBaseUrl to store region if it looks like a region string (e.g. "eastus")
    // or if it is empty, default to 'eastus'? No, that's bad.
    // Let's try to extract region from sttBaseUrl if it's a full URL, otherwise treat it as region string.
    let region = 'eastus';
    if (this.settings.sttBaseUrl && !this.settings.sttBaseUrl.startsWith('http')) {
        region = this.settings.sttBaseUrl;
    } else if (!this.settings.sttBaseUrl) {
        throw new Error('For Azure, please put your Region in the "Base URL" field (e.g., eastus)');
    }

    const language = this.settings.sttLanguage || 'zh-CN';
    const endpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}`;

    // Azure REST API requires WAV
    const arrayBuffer = await audioBlob.arrayBuffer();

    try {
      const response = await requestUrl({
        url: endpoint,
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.settings.sttApiKey,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', 
          'Accept': 'application/json'
        },
        body: arrayBuffer
      });

      if (response.status !== 200) {
        throw new Error(`Azure Error: ${response.status}`);
      }

      const data = response.json;
      if (data.RecognitionStatus === 'Success') {
        return data.DisplayText;
      } else {
        throw new Error(`Azure Failed: ${data.RecognitionStatus}`);
      }
    } catch (error) {
      console.error('Azure Transcription Error', error);
      if (error.message.includes('400') || error.message.includes('415')) {
         throw new Error('Azure requires WAV PCM 16kHz format.');
      }
      throw new Error('Azure Failed: ' + error.message);
    }
  }

  async transcribeOpenAI(audioBlob: Blob, extensionOverride?: string): Promise<string> {
    // This handles OpenAI and Custom providers (that follow OpenAI API)
    const apiKey = this.settings.sttApiKey || this.settings.aiApiKey; // Fallback to main AI key
    
    if (!apiKey) {
      throw new Error('Please configure API Key in settings');
    }

    console.log('[LinguaSync] Transcribing with OpenAI...');
    console.log(`[LinguaSync] Audio Blob: type=${audioBlob.type}, size=${audioBlob.size}`);

    const formData = new FormData();
    
    // Determine correct extension based on blob type or override
    let extension = extensionOverride || 'wav'; // Default to override (settings) or wav
    
    // If blob has explicit type, trust it (unless override is mp3 and type is webm... mismatch handled below)
    if (audioBlob.type.includes('webm')) {
        extension = 'webm';
    } else if (audioBlob.type.includes('mp3')) {
        extension = 'mp3';
    } else if (audioBlob.type.includes('mp4') || audioBlob.type.includes('m4a')) {
        extension = 'm4a'; 
    }
    
    const filename = `audio.${extension}`;
    console.log(`[LinguaSync] Using filename: ${filename}`);

    formData.append('file', audioBlob, filename);
    formData.append('model', this.settings.sttModel || 'whisper-1');
    
    if (this.settings.sttLanguage) {
      formData.append('language', this.settings.sttLanguage);
    }
    formData.append('response_format', 'json');
    formData.append('temperature', '0');

    let baseUrl = this.settings.sttBaseUrl;
    if (!baseUrl || baseUrl.trim() === '') {
        baseUrl = 'https://api.openai.com/v1/audio/transcriptions';
    }
    
    try {
      // Use fetch because requestUrl has issues with FormData
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[LinguaSync] Transcription API Error:', response.status, errText);
        throw new Error(`Transcription failed: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      console.log('[LinguaSync] Transcription success:', data);
      return data.text;
    } catch (error) {
      console.error('[LinguaSync] Transcription Exception:', error);
      throw new Error('Transcription failed: ' + error.message);
    }
  }

  async speakOpenAI(text: string): Promise<ArrayBuffer> {
    const apiKey = this.settings.sttApiKey || this.settings.aiApiKey;
    if (!apiKey) {
        throw new Error('Please configure API Key in settings');
    }

    // Determine Base URL for TTS
    // If sttBaseUrl is configured (e.g. custom proxy), try to use it but ensure endpoint is correct.
    // Standard OpenAI: https://api.openai.com/v1/audio/transcriptions -> https://api.openai.com/v1/audio/speech
    // If user provided a full custom URL like "https://my-proxy.com/v1/audio/transcriptions", we might need to replace the last part.
    // Or we can trust that if sttProvider is 'openai', we use standard URL.
    // If 'custom', we try to infer.

    let url = 'https://api.openai.com/v1/audio/speech';
    
    if (this.settings.sttProvider === 'custom' && this.settings.sttBaseUrl) {
        let baseUrl = this.settings.sttBaseUrl.trim();
        // Remove trailing slash
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        
        // If it ends with 'transcriptions', replace with 'speech'
        if (baseUrl.endsWith('transcriptions')) {
            url = baseUrl.replace('transcriptions', 'speech');
        } else {
            // If it's just a base like 'https://api.openai.com/v1', append '/audio/speech'
            // But sttBaseUrl is usually the FULL endpoint for transcription.
            // So replacing 'transcriptions' is the safest bet for consistency.
            // Fallback: just try to append /audio/speech if it doesn't look like a full endpoint?
            // Let's assume standard openai-like path structure for custom providers.
            url = baseUrl.replace(/transcriptions$/, 'speech');
        }
    }

    console.log('[LinguaSync] TTS Request to:', url);

    const body = {
        model: this.settings.ttsModel || 'tts-1',
        input: text,
        voice: this.settings.ttsVoice || 'alloy'
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`TTS failed: ${response.status} - ${errText}`);
    }

    return await response.arrayBuffer();
  }
}
