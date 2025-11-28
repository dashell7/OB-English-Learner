import { Notice } from 'obsidian';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { fixWebmDuration } from '@fix-webm-duration/fix';

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private leftChannelData: Float32Array[] = [];
  private recordingLength: number = 0;
  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private stream: MediaStream | null = null;
  private sampleRate: number = 16000; // Azure 推荐 16kHz
  
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private format: 'wav' | 'webm' | 'mp3' = 'wav';
  private startTime: number | null = null;

  async startRecording(format: 'wav' | 'webm' | 'mp3' = 'wav') {
    this.format = format;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.startTime = Date.now();
      
      if (this.format === 'wav') {
          // WAV Recording using AudioContext (High Quality, Uncompressed)
          // @ts-ignore - window.AudioContext is standard
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: this.sampleRate });
          this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);
          
          // Buffer size must be power of 2
          this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

          this.mediaStreamSource.connect(this.processor);
          this.processor.connect(this.audioContext.destination);

          this.processor.onaudioprocess = (e) => {
            if (!this.isRecording || this.isPaused) return;
            
            const left = e.inputBuffer.getChannelData(0);
            const leftCloned = new Float32Array(left);
            this.leftChannelData.push(leftCloned);
            this.recordingLength += leftCloned.length;
          };
          
          this.leftChannelData = [];
          this.recordingLength = 0;
      } else {
          // WebM/MP3 Recording using MediaRecorder
          let mimeType = 'audio/webm';
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
             mimeType = 'audio/webm;codecs=opus';
          }
          
          this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
          this.recordedChunks = [];
          
          this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              this.recordedChunks.push(e.data);
            }
          };
          
          this.mediaRecorder.start(100); // Collect 100ms chunks
      }

      this.isRecording = true;
    } catch (error) {
      console.error(error);
      throw new Error('无法访问麦克风: ' + error.message);
    }
  }

  pauseRecording() {
    this.isPaused = true;
    if (this.format === 'wav') {
        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }
    } else {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.pause();
        }
    }
  }

  resumeRecording() {
    this.isPaused = false;
    if (this.format === 'wav') {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    } else {
        if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
            this.mediaRecorder.resume();
        }
    }
  }

  async convertWebmToMp3(webmBlob: Blob): Promise<Blob> {
    try {
      const ffmpeg = new FFmpeg();
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      
      // Load FFmpeg
      new Notice('Loading FFmpeg for conversion...');
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      // Write input WebM file
      new Notice('Converting to MP3...');
      await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));
      
      // Convert WebM to MP3
      await ffmpeg.exec(['-i', 'input.webm', '-c:a', 'libmp3lame', '-q:a', '2', 'output.mp3']);
      
      // Read the output file
      const data = await ffmpeg.readFile('output.mp3');
      
      // Create a Blob from the output data
      const mp3Blob = new Blob([data as any], { type: 'audio/mp3' });
      
      return mp3Blob;
    } catch (error) {
      console.error('Error converting WebM to MP3:', error);
      throw new Error(`Failed to convert WebM to MP3: ${error.message}`);
    }
  }

  async stopRecording(): Promise<Blob> {
    this.isRecording = false;
    this.isPaused = false;

    let blob: Blob;

    if (this.format === 'wav') {
        // Stop WAV processing
        if (this.processor) {
            this.processor.disconnect();
            this.processor.onaudioprocess = null;
        }
        if (this.mediaStreamSource) {
            this.mediaStreamSource.disconnect();
        }

        // Process WAV data
        const pcmBuffer = this.flattenAudioBuffers(this.leftChannelData, this.recordingLength);
        blob = this.encodeWAV(pcmBuffer, this.sampleRate);
    } else {
        // Stop MediaRecorder
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            const stopPromise = new Promise<void>((resolve) => {
                if (!this.mediaRecorder) return resolve();
                this.mediaRecorder.onstop = () => resolve();
                this.mediaRecorder.stop();
            });
            await stopPromise;
        }
        
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const rawBlob = new Blob(this.recordedChunks, { type: mimeType });
        
        // Fix WebM duration
        const duration = (this.startTime && Date.now() - this.startTime) || 0;
        try {
            const fixedBlob = await fixWebmDuration(rawBlob, duration, {});
            blob = new Blob([fixedBlob], { type: mimeType });
        } catch (e) {
            console.warn('Failed to fix WebM duration:', e);
            blob = rawBlob;
        }

        // Convert to MP3 if requested
        if (this.format === 'mp3') {
            try {
                blob = await this.convertWebmToMp3(blob);
            } catch (e) {
                console.error('MP3 conversion failed, fallback to WebM', e);
                new Notice('MP3 conversion failed, saved as WebM');
                // Ensure fallback blob has webm type
                if (blob.type !== mimeType) {
                     blob = new Blob([blob], { type: mimeType });
                }
            }
        }
    }

    // Cleanup
    this.cleanup();

    return blob;
  }

  private flattenAudioBuffers(buffers: Float32Array[], totalLength: number): Float32Array {
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const buffer of buffers) {
      result.set(buffer, offset);
      offset += buffer.length;
    }
    return result;
  }

  private encodeWAV(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // RIFF chunk length
    view.setUint32(4, 36 + samples.length * 2, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, 1, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, samples.length * 2, true);

    // 写入 PCM 样本
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      // 16-bit PCM
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, s, true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  cleanup() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }
    if (this.audioContext) {
        if (this.audioContext.state !== 'closed') {
            this.audioContext.close().catch(e => console.error(e));
        }
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.leftChannelData = [];
    this.recordingLength = 0;
    this.isRecording = false;
    this.isPaused = false;
  }
}
