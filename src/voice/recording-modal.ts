import { Modal, App } from 'obsidian';

class AudioVisualizer {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;
  private animationId: number | null = null;
  private isPaused: boolean = false;

  constructor(private canvas: HTMLCanvasElement) {
    // @ts-ignore
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  connectStream(stream: MediaStream) {
    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);
    this.startVisualization();
  }

  private startVisualization() {
    const draw = () => {
      if (this.isPaused) {
        this.animationId = requestAnimationFrame(draw);
        return;
      }

      this.analyser.getByteFrequencyData(this.dataArray);
      const width = this.canvas.width;
      const height = this.canvas.height;
      const ctx = this.canvas.getContext('2d');

      if (!ctx) return;

      // Clear
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, width, height);

      // Draw waveform
      const barWidth = width / this.dataArray.length;
      let x = 0;

      ctx.fillStyle = '#4CAF50';
      for (let i = 0; i < this.dataArray.length; i++) {
        const barHeight = (this.dataArray[i] / 255) * height;
        // Gradient
        const gradient = ctx.createLinearGradient(x, height, x, height - barHeight);
        gradient.addColorStop(0, '#4CAF50');
        gradient.addColorStop(1, '#81C784');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth;
      }

      this.animationId = requestAnimationFrame(draw);
    };

    draw();
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  stop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(err => console.error('Error closing AudioContext:', err));
    }
  }
}

export class RecordingModal extends Modal {
  private timer: number = 0;
  private timerInterval: number | null = null;
  private isPaused: boolean = false;
  private visualizer: AudioVisualizer;
  private transcribingContainer: HTMLElement | null = null;

  constructor(
    app: App,
    private onRecordingClose: (cancelled: boolean) => void,
    private onPause: () => void,
    private onResume: () => void,
    private stream: MediaStream
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();

    // Apply refined class
    modalEl.addClass('recording-modal');
    
    // Position at bottom-left corner
    modalEl.style.position = 'absolute';
    modalEl.style.left = '20px';
    modalEl.style.bottom = '60px'; // Higher to clear status bar/settings icons
    modalEl.style.top = 'auto';
    modalEl.style.margin = '0';
    
    // Make background transparent and allow clicking through (Modeless behavior)
    this.containerEl.addClass('voice2text-modeless-container');
    const bg = this.containerEl.querySelector('.modal-bg') as HTMLElement;
    if (bg) {
      bg.style.backgroundColor = 'transparent';
      bg.style.pointerEvents = 'none';
    }
    // Ensure the modal wrapper itself doesn't block clicks in empty areas if it takes full screen
    this.containerEl.style.pointerEvents = 'none';
    modalEl.style.pointerEvents = 'auto'; // Re-enable events on the modal itself
    
    // Make the entire modal draggable
    this.makeDraggable(modalEl);

    const container = contentEl.createDiv('voice2text-modal-container');
    
    // Waveform
    const waveformContainer = container.createDiv('voice2text-waveform-container');
    const canvas = document.createElement('canvas');
    // Match CSS dimensions for canvas resolution
    canvas.width = 280; 
    canvas.height = 60;
    canvas.className = 'voice2text-waveform';
    waveformContainer.appendChild(canvas);

    // Timer
    const timerDisplay = container.createDiv('voice2text-timer');
    timerDisplay.setText('00:00');

    // Controls
    const controlsContainer = container.createDiv('voice2text-controls');
    
    // Cancel
    const cancelButton = controlsContainer.createEl('button', { cls: 'voice2text-button' });
    cancelButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    cancelButton.setAttribute('aria-label', 'Cancel');
    cancelButton.style.backgroundColor = '#e91e63'; // Red
    cancelButton.addEventListener('click', () => {
      this.stopRecording(true);
      this.close();
    });

    // Pause/Resume
    const pauseButton = controlsContainer.createEl('button', { cls: 'voice2text-button' });
    const pauseIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    const playIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    
    pauseButton.innerHTML = pauseIcon;
    pauseButton.setAttribute('aria-label', 'Pause');
    pauseButton.style.backgroundColor = '#ff9800'; // Orange
    pauseButton.addEventListener('click', () => {
      if (this.isPaused) {
        this.resumeRecording();
        pauseButton.innerHTML = pauseIcon;
      } else {
        this.pauseRecording();
        pauseButton.innerHTML = playIcon;
      }
    });

    // Save/Complete
    const saveButton = controlsContainer.createEl('button', { cls: 'voice2text-button' });
    saveButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>';
    saveButton.setAttribute('aria-label', 'Save & Transcribe');
    saveButton.style.backgroundColor = '#4caf50'; // Green
    saveButton.addEventListener('click', () => {
      this.stopRecording(false);
      this.close();
    });

    // Transcription Text (Hidden initially)
    const transcriptionContainer = container.createDiv('voice2text-transcription');
    transcriptionContainer.style.display = 'none';

    // Transcribing State (Hidden initially)
    this.transcribingContainer = container.createDiv('voice2text-transcribing');
    this.transcribingContainer.style.display = 'none';
    this.transcribingContainer.innerHTML = '<span class="voice2text-transcribing-text">AI Transcribing</span><span class="voice2text-transcribing-dots"><span>.</span><span>.</span><span>.</span></span>';

    // Init Visualizer
    this.visualizer = new AudioVisualizer(canvas);
    this.visualizer.connectStream(this.stream);

    // Start Timer
    this.startTimer();
  }

  private makeDraggable(modalEl: HTMLElement) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialTranslateX = 0;
    let initialTranslateY = 0;

    modalEl.addEventListener('mousedown', (e) => {
      // Ignore clicks on buttons or interactive elements
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        return;
      }

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      // Get current transform
      const style = window.getComputedStyle(modalEl);
      const matrix = new WebKitCSSMatrix(style.transform);
      initialTranslateX = matrix.m41;
      initialTranslateY = matrix.m42;
      
      modalEl.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none'; // Prevent text selection
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      modalEl.style.transform = `translate(${initialTranslateX + dx}px, ${initialTranslateY + dy}px)`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        modalEl.style.cursor = 'default';
        document.body.style.userSelect = '';
      }
    });
  }

  private startTimer() {
    this.timerInterval = window.setInterval(() => {
      if (!this.isPaused) {
        this.timer++;
        const minutes = Math.floor(this.timer / 60);
        const seconds = this.timer % 60;
        const timerDisplay = this.contentEl.querySelector('.voice2text-timer');
        if (timerDisplay) {
          timerDisplay.setText(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      }
    }, 1000);
  }

  private pauseRecording() {
    this.isPaused = true;
    this.onPause();
    this.visualizer.pause();
  }

  private resumeRecording() {
    this.isPaused = false;
    this.onResume();
    this.visualizer.resume();
  }

  private stopRecording(cancelled: boolean) {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.visualizer.stop();
    this.onRecordingClose(cancelled);
  }

  onClose() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.visualizer.stop();
    // Ensure we clean up if user clicked X or Esc
    // We can't easily know if it was "cancelled" or "saved" here unless we tracked it
    // But onRecordingClose logic usually handles the "cleanup" part.
    // If stopRecording wasn't called yet, it's a cancel.
  }
}
