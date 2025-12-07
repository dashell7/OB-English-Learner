// Aloud-style TTS Toolbar (100% replica)
import { EditorView, ViewPlugin } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { setIcon } from 'obsidian';
import { TTSManager, PlaybackState } from './tts-manager';
import { LinguaSyncSettings } from '../types';
import { createTTSHighlightExtension, highlightRange, clearHighlight, positionToOffset } from './tts-highlight';

class TTSToolbarView {
    ttsManager: TTSManager;
    toolbarEl: HTMLElement | null = null;
    view: EditorView;
    currentState: PlaybackState = 'idle';
    currentChunk: number = 0;
    totalChunks: number = 0;

    constructor(view: EditorView, ttsManager: TTSManager) {
        this.view = view;
        this.ttsManager = ttsManager;
        
        console.log('[TTS Toolbar] Initializing Aloud-style toolbar');
        
        // Create toolbar immediately
        this.createToolbar();
        
        // Listen to state changes
        this.ttsManager.onStateChange((state) => {
            this.currentState = state;
            this.updateUI();
        });
        
        this.ttsManager.onChunkChange((index, total) => {
            this.currentChunk = index;
            this.totalChunks = total;
            this.updateUI();
            this.highlightCurrentChunk();
        });
    }

    createToolbar() {
        // Find the editor container
        const editorContainer = this.view.dom.closest('.cm-editor');
        if (!editorContainer) {
            console.error('[TTS Toolbar] Could not find editor container');
            return;
        }

        // Create toolbar container (Aloud style - exact replica)
        this.toolbarEl = document.createElement('div');
        this.toolbarEl.addClass('tts-toolbar');
        
        const playerDiv = this.toolbarEl.createDiv('tts-toolbar-player');
        
        // Button Group 1: Play selection (单独一组，对齐 Aloud)
        const group1 = playerDiv.createDiv('tts-toolbar-player-button-group');
        
        const playBtn = this.createButton(group1, 'play', 'Play selection', 'play');
        playBtn.addEventListener('click', () => this.handlePlay());
        
        // Button Group 2: Playback controls (对齐 Aloud: Previous, Pause/Resume, Next)
        const group2 = playerDiv.createDiv('tts-toolbar-player-button-group');
        
        const skipBackBtn = this.createButton(group2, 'skip-back', 'Previous', 'skip-back');
        skipBackBtn.addEventListener('click', () => {
            console.log('[TTS Toolbar] Previous clicked');
            this.ttsManager.previous();
        });
        
        // Pause/Resume button (动态切换)
        const pauseResumeBtn = this.createButton(group2, 'pause', 'Pause', 'pause');
        pauseResumeBtn.addEventListener('click', () => {
            console.log('[TTS Toolbar] Pause/Resume clicked');
            this.handlePauseResume();
        });
        
        const skipForwardBtn = this.createButton(group2, 'skip-forward', 'Next', 'skip-forward');
        skipForwardBtn.addEventListener('click', () => {
            console.log('[TTS Toolbar] Next clicked');
            this.ttsManager.next();
        });
        
        // Button Group 3: View controls (Eye, Speed)
        const group3 = playerDiv.createDiv('tts-toolbar-player-button-group');
        
        const eyeBtn = this.createButton(group3, 'eye', 'Toggle auto-scroll', 'eye');
        eyeBtn.addEventListener('click', () => this.toggleAutoscroll());
        // Update icon and state based on setting
        this.updateAutoscrollButton();
        
        const speedBtn = this.createButton(group3, 'speed', 'Cycle playback speed', undefined);
        const currentSpeed = this.ttsManager.settings.ttsSpeed || 1.0;
        speedBtn.setText(`${currentSpeed}x`);
        speedBtn.addEventListener('click', () => this.cycleSpeed(speedBtn));
        
        // Button Group 4: Status container (对齐 Aloud)
        const statusContainer = playerDiv.createDiv('tts-audio-status-container');
        
        // Loading indicator
        const loadingDiv = statusContainer.createDiv('tts-audio-status-loading');
        loadingDiv.style.display = 'none';
        loadingDiv.innerHTML = `
            <svg class="tts-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4" />
            </svg>
        `;
        
        // Audio visualizer (8 bars)
        const visualizerDiv = statusContainer.createDiv('tts-audio-visualizer');
        visualizerDiv.style.display = 'none';
        for (let i = 0; i < 8; i++) {
            const bar = visualizerDiv.createDiv('tts-audio-visualizer-bar');
            bar.style.animationDelay = `${i * 0.1}s`;
        }
        
        // Progress text (e.g., "1/5")
        const progressDiv = statusContainer.createDiv('tts-progress-text');
        progressDiv.style.display = 'none';
        progressDiv.setText('');
        
        // Button Group 5: Close button (对齐 Aloud)
        const group5 = playerDiv.createDiv('tts-toolbar-player-button-group');
        
        const closeBtn = this.createButton(group5, 'x', 'Cancel playback', 'x');
        closeBtn.addEventListener('click', () => {
            console.log('[TTS Toolbar] Close clicked');
            this.ttsManager.stop();
        });
        // Close button only visible when playing
        closeBtn.style.display = 'none';
        
        // Progress bar
        const progressBarContainer = playerDiv.createDiv('tts-progress-bar-container');
        const progressBarFill = progressBarContainer.createDiv('tts-progress-bar-fill');
        progressBarContainer.style.display = 'none';
        
        // Insert at the top of editor
        editorContainer.insertBefore(this.toolbarEl, editorContainer.firstChild);
        
        console.log('[TTS Toolbar] Aloud-style toolbar created with button groups');
    }

    createButton(parent: HTMLElement, className: string, tooltip: string, iconName?: string): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.className = `clickable-icon tts-toolbar-button ${className}`;
        btn.setAttribute('aria-label', tooltip);
        
        if (iconName) {
            setIcon(btn, iconName);
        }
        
        parent.appendChild(btn);
        return btn;
    }

    updateUI() {
        if (!this.toolbarEl) return;
        
        console.log('[TTS Toolbar] updateUI called, state:', this.currentState);
        
        const playBtn = this.toolbarEl.querySelector('.tts-toolbar-button.play') as HTMLButtonElement;
        const pauseBtn = this.toolbarEl.querySelector('.tts-toolbar-button.pause') as HTMLButtonElement;
        const skipBackBtn = this.toolbarEl.querySelector('.tts-toolbar-button.skip-back') as HTMLButtonElement;
        const skipForwardBtn = this.toolbarEl.querySelector('.tts-toolbar-button.skip-forward') as HTMLButtonElement;
        const loadingDiv = this.toolbarEl.querySelector('.tts-audio-status-loading') as HTMLElement;
        const visualizerDiv = this.toolbarEl.querySelector('.tts-audio-visualizer') as HTMLElement;
        const progressDiv = this.toolbarEl.querySelector('.tts-progress-text') as HTMLElement;
        const progressBarContainer = this.toolbarEl.querySelector('.tts-progress-bar-container') as HTMLElement;
        const progressBarFill = this.toolbarEl.querySelector('.tts-progress-bar-fill') as HTMLElement;
        
        // Update button states based on playback state
        if (this.currentState === 'idle') {
            // Idle: only play button active
            playBtn?.classList.add('tts-toolbar-button-active');
            pauseBtn?.classList.remove('tts-toolbar-button-active');
            skipBackBtn?.classList.remove('tts-toolbar-button-active');
            skipForwardBtn?.classList.remove('tts-toolbar-button-active');
            
            // Update tooltip for Play button (Aloud-style)
            if (playBtn) {
                playBtn.setAttribute('aria-label', 'Play selection');
            }
            
            // Disable navigation buttons in idle state
            if (skipBackBtn) skipBackBtn.disabled = true;
            if (skipForwardBtn) skipForwardBtn.disabled = true;
            if (pauseBtn) pauseBtn.disabled = true;
            if (playBtn) playBtn.disabled = false;
        } else if (this.currentState === 'playing') {
            // Playing: show pause button, enable navigation
            playBtn?.classList.remove('tts-toolbar-button-active');
            skipBackBtn?.classList.add('tts-toolbar-button-active');
            skipForwardBtn?.classList.add('tts-toolbar-button-active');
            
            // Update pause/resume button to show PAUSE icon
            if (pauseBtn) {
                pauseBtn.empty();
                setIcon(pauseBtn, 'pause');
                pauseBtn.setAttribute('aria-label', 'Pause');
                pauseBtn.disabled = false;
                pauseBtn.classList.add('tts-toolbar-button-active');
            }
            
            // Enable all buttons except play
            if (skipBackBtn) {
                skipBackBtn.disabled = false;
                console.log('[TTS Toolbar] Skip Back disabled:', skipBackBtn.disabled);
            }
            if (skipForwardBtn) {
                skipForwardBtn.disabled = false;
                console.log('[TTS Toolbar] Skip Forward disabled:', skipForwardBtn.disabled);
            }
            if (pauseBtn) {
                pauseBtn.disabled = false;
                console.log('[TTS Toolbar] Pause disabled:', pauseBtn.disabled);
            }
            if (playBtn) playBtn.disabled = true;
        } else if (this.currentState === 'paused') {
            // Paused: show resume button (step-forward icon), enable navigation
            playBtn?.classList.remove('tts-toolbar-button-active');
            skipBackBtn?.classList.add('tts-toolbar-button-active');
            skipForwardBtn?.classList.add('tts-toolbar-button-active');
            
            // Update pause/resume button to show RESUME icon (step-forward, like Aloud)
            if (pauseBtn) {
                pauseBtn.empty();
                setIcon(pauseBtn, 'step-forward');
                pauseBtn.setAttribute('aria-label', 'Resume');
                pauseBtn.disabled = false;
                pauseBtn.classList.add('tts-toolbar-button-active');
            }
            
            // Enable navigation
            if (skipBackBtn) skipBackBtn.disabled = false;
            if (skipForwardBtn) skipForwardBtn.disabled = false;
            if (playBtn) playBtn.disabled = true;
        } else if (this.currentState === 'loading') {
            // Loading: disable all playback buttons
            if (playBtn) playBtn.disabled = true;
            if (pauseBtn) pauseBtn.disabled = true;
            if (skipBackBtn) skipBackBtn.disabled = true;
            if (skipForwardBtn) skipForwardBtn.disabled = true;
        }
        
        // Show/hide loading, visualizer, and progress
        if (loadingDiv) {
            loadingDiv.style.display = this.currentState === 'loading' ? 'flex' : 'none';
        }
        
        if (visualizerDiv) {
            // Show visualizer when playing
            visualizerDiv.style.display = this.currentState === 'playing' ? 'flex' : 'none';
        }
        
        if (progressDiv) {
            // Show progress text when paused
            if (this.currentState === 'paused' && this.totalChunks > 0) {
                progressDiv.setText(`${this.currentChunk + 1}/${this.totalChunks}`);
                progressDiv.style.display = 'block';
            } else {
                progressDiv.style.display = 'none';
            }
        }
        
        // Update progress bar
        if (progressBarContainer && progressBarFill) {
            if (this.totalChunks > 0 && (this.currentState === 'playing' || this.currentState === 'paused')) {
                const progress = ((this.currentChunk + 1) / this.totalChunks) * 100;
                progressBarFill.style.width = `${progress}%`;
                progressBarContainer.style.display = 'block';
                console.log(`[TTS Toolbar] Progress: ${progress.toFixed(1)}% (${this.currentChunk + 1}/${this.totalChunks})`);
            } else {
                progressBarContainer.style.display = 'none';
            }
        }
        
        // Show/hide close button (only visible when playing or paused, like Aloud)
        const closeBtn = this.toolbarEl?.querySelector('.tts-toolbar-button.x') as HTMLElement;
        if (closeBtn) {
            closeBtn.style.display = (this.currentState === 'playing' || this.currentState === 'paused') ? 'flex' : 'none';
        }
    }

    handlePlay() {
        if (this.currentState === 'paused') {
            // Resume from pause
            this.ttsManager.resume();
        } else if (this.currentState === 'idle') {
            // Start new playback
            const state = this.view.state;
            const selection = state.selection.main;
            
            let text: string;
            let from: any;
            let to: any;
            
            if (selection.empty) {
                // Play whole document
                text = state.doc.toString();
                from = { line: 0, ch: 0 };
                to = { line: state.doc.lines - 1, ch: state.doc.line(state.doc.lines).length };
            } else {
                // Play selection
                text = state.sliceDoc(selection.from, selection.to);
                const fromLine = state.doc.lineAt(selection.from);
                const toLine = state.doc.lineAt(selection.to);
                from = { line: fromLine.number - 1, ch: selection.from - fromLine.from };
                to = { line: toLine.number - 1, ch: selection.to - toLine.from };
            }
            
            // Get Obsidian editor (hack)
            const editor = (this.view as any).editor || this.createDummyEditor();
            
            this.ttsManager.playSelection(text, editor, from, to);
        }
    }

    handlePauseResume() {
        if (this.currentState === 'playing') {
            this.ttsManager.pause();
        } else if (this.currentState === 'paused') {
            this.ttsManager.resume();
        }
    }

    updateAutoscrollButton() {
        const eyeBtn = this.toolbarEl?.querySelector('.tts-toolbar-button.eye') as HTMLElement;
        if (!eyeBtn) return;
        
        const enabled = this.ttsManager.settings.ttsAutoscroll;
        
        // Update icon (eye vs eye-off)
        eyeBtn.empty();
        const iconName = enabled ? 'eye' : 'eye-off';
        setIcon(eyeBtn, iconName);
        
        // Update active state
        if (enabled) {
            eyeBtn.classList.add('tts-toolbar-button-active');
            eyeBtn.setAttribute('aria-label', 'Autoscroll enabled (click to disable)');
        } else {
            eyeBtn.classList.remove('tts-toolbar-button-active');
            eyeBtn.setAttribute('aria-label', 'Autoscroll disabled (click to enable)');
        }
        
        console.log('[TTS Toolbar] Auto-scroll button updated:', enabled ? 'eye' : 'eye-off');
    }
    
    toggleAutoscroll() {
        // Toggle autoscroll setting
        this.ttsManager.settings.ttsAutoscroll = !this.ttsManager.settings.ttsAutoscroll;
        
        // Update button visual state
        this.updateAutoscrollButton();
        
        console.log('[TTS Toolbar] Auto-scroll:', this.ttsManager.settings.ttsAutoscroll ? 'enabled' : 'disabled');
    }

    cycleSpeed(btn: HTMLElement) {
        // Cycle through speeds: 0.75x → 1x → 1.25x → 1.5x → 2x
        const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
        const currentSpeed = this.ttsManager.settings.ttsSpeed || 1.0;
        const currentIndex = speeds.indexOf(currentSpeed);
        const nextIndex = (currentIndex + 1) % speeds.length;
        const newSpeed = speeds[nextIndex];
        
        this.ttsManager.settings.ttsSpeed = newSpeed;
        btn.setText(`${newSpeed}x`);
        
        // Apply speed to currently playing audio
        this.ttsManager.setPlaybackSpeed(newSpeed);
        
        console.log('[TTS Toolbar] Speed changed to:', newSpeed);
    }

    highlightCurrentChunk() {
        console.log('[TTS Toolbar] 🎯 highlightCurrentChunk called, currentChunk:', this.currentChunk);
        console.log('[TTS Toolbar] 🔍 View object:', this.view ? 'exists' : 'NULL');
        console.log('[TTS Toolbar] 🔍 View.state:', this.view?.state ? 'exists' : 'NULL');
        console.log('[TTS Toolbar] 🔍 Doc length:', this.view?.state?.doc?.length);
        
        // Get current chunk from TTSManager
        const chunks = this.ttsManager.chunks;
        if (!chunks || chunks.length === 0 || this.currentChunk < 0 || this.currentChunk >= chunks.length) {
            console.log('[TTS Toolbar] ❌ Cannot highlight - invalid state');
            clearHighlight(this.view);
            return;
        }
        
        const chunk = chunks[this.currentChunk];
        if (!chunk) {
            console.warn('[TTS Toolbar] Invalid chunk:', chunk);
            return;
        }
        
        // Chunks now have direct number offsets (Aloud style)
        const fromOffset = chunk.start;
        const toOffset = chunk.end;
        
        console.log('[TTS Toolbar] 📍 Highlight offsets:', fromOffset, '-', toOffset, 'text:', chunk.text.substring(0, 30));
        console.log('[TTS Toolbar] 📍 Chunk object:', JSON.stringify(chunk, null, 2));
        
        // Validate offsets
        if (fromOffset >= toOffset) {
            console.warn('[TTS Toolbar] Invalid offsets:', fromOffset, toOffset, 'for chunk:', chunk);
            return;
        }
        
        // Validate against document length
        const docLength = this.view.state.doc.length;
        if (fromOffset < 0 || toOffset > docLength) {
            console.warn('[TTS Toolbar] Offsets out of range. Document length:', docLength, 'offsets:', fromOffset, toOffset);
            return;
        }
        
        try {
            // Apply highlight using CodeMirror decorations
            console.log('[TTS Toolbar] ✨ Applying highlight...');
            highlightRange(this.view, fromOffset, toOffset);
            
            // Autoscroll logic (matching Aloud's behavior)
            // Only scroll when:
            // 1. Autoscroll is enabled
            // 2. Actually playing (not loading, not paused)
            // 3. Audio element exists and is playing
            const shouldScroll = this.ttsManager.settings.ttsAutoscroll 
                && this.currentState === 'playing'
                && this.ttsManager.audioElement 
                && !this.ttsManager.audioElement.paused;
            
            if (shouldScroll) {
                console.log('[TTS Toolbar] 📜 Auto-scrolling to chunk (playing confirmed)...');
                
                // Use a small delay to ensure the state is stable
                setTimeout(() => {
                    // Double-check we're still playing
                    if (this.currentState === 'playing') {
                        this.view.dispatch({
                            effects: EditorView.scrollIntoView(fromOffset, {
                                y: 'center',
                                yMargin: 100
                            })
                        });
                    }
                }, 50);
            } else {
                console.log('[TTS Toolbar] ⏸ Skipping scroll:', {
                    autoscroll: this.ttsManager.settings.ttsAutoscroll,
                    state: this.currentState,
                    hasAudio: !!this.ttsManager.audioElement,
                    paused: this.ttsManager.audioElement?.paused
                });
            }
            
            console.log('[TTS Toolbar] ✅ Successfully highlighted chunk:', this.currentChunk + 1, '/', chunks.length, `(${fromOffset}-${toOffset})`);
        } catch (error) {
            console.error('[TTS Toolbar] ❌ Error highlighting chunk:', error);
        }
    }

    clearAllHighlights() {
        clearHighlight(this.view);
    }

    createDummyEditor(): any {
        return {
            getCursor: () => ({ line: 0, ch: 0 }),
            posToOffset: (pos: any) => 0,
            offsetToPos: (offset: number) => ({ line: 0, ch: 0 }),
            scrollIntoView: () => {}
        };
    }

    destroy() {
        if (this.toolbarEl) {
            this.toolbarEl.remove();
            this.toolbarEl = null;
        }
    }
}

export function ttsPanelExtension(ttsManager: TTSManager): Extension {
    const toolbarPlugin = ViewPlugin.define((view) => new TTSToolbarView(view, ttsManager));
    const highlightExtension = createTTSHighlightExtension();
    
    return [
        toolbarPlugin,
        highlightExtension
    ];
}
