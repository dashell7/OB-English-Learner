// CodeMirror 6 Text Highlighting Extension for TTS
import { Extension, StateField, StateEffect } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { EditorPosition } from 'obsidian';

// State effect to update highlight
export const setHighlight = StateEffect.define<HighlightRange | null>();

export interface HighlightRange {
    from: number;
    to: number;
}

// Theme for TTS highlighting (100% matching Aloud)
// Use EditorView.theme instead of baseTheme for higher priority
const ttsHighlightTheme = EditorView.theme({
    '.tts-highlight-current': {
        backgroundColor: 'rgba(128, 0, 128, 0.4) !important', // Aloud's exact purple for current
        color: 'rgb(128, 0, 128) !important', // Purple text color (matching Aloud)
        borderRadius: '2px',
    },
    '.tts-highlight-before': {
        backgroundColor: 'rgba(128, 0, 128, 0.2) !important', // Aloud's exact purple for played
        borderRadius: '2px',
    },
    '.tts-highlight-after': {
        backgroundColor: 'rgba(128, 0, 128, 0.2) !important', // Aloud's exact purple for upcoming
        borderRadius: '2px',
    }
});

// State field for managing highlights
const highlightField = StateField.define<DecorationSet>({
    create() {
        return Decoration.none;
    },
    
    update(decorations, tr) {
        // Map decorations through document changes
        decorations = decorations.map(tr.changes);
        
        // Apply new highlights
        for (const effect of tr.effects) {
            if (effect.is(setHighlight)) {
                if (effect.value) {
                    const { from, to } = effect.value;
                    decorations = Decoration.set([
                        Decoration.mark({
                            class: 'tts-highlight-current'
                        }).range(from, to)
                    ]);
                } else {
                    decorations = Decoration.none;
                }
            }
        }
        
        return decorations;
    },
    
    provide: f => EditorView.decorations.from(f)
});

// Create the highlighting extension
export function createTTSHighlightExtension(): Extension {
    return [
        highlightField,
        ttsHighlightTheme
    ];
}

// Helper function to apply highlight
export function highlightRange(view: EditorView, from: number, to: number) {
    console.log('[TTS Highlight] 🔆 highlightRange called, from:', from, 'to:', to);
    
    // Ensure range is not empty (from !== to)
    if (from >= to) {
        console.warn('[TTS Highlight] ❌ Invalid range:', from, to);
        return;
    }
    
    console.log('[TTS Highlight] 📤 Dispatching setHighlight effect...');
    view.dispatch({
        effects: setHighlight.of({ from, to })
    });
    console.log('[TTS Highlight] ✅ Highlight effect dispatched!');
}

// Helper function to clear highlight
export function clearHighlight(view: EditorView) {
    view.dispatch({
        effects: setHighlight.of(null)
    });
}

// Convert EditorPosition to offset
export function positionToOffset(view: EditorView, pos: EditorPosition): number {
    try {
        const doc = view.state.doc;
        // EditorPosition.line is 0-indexed, CodeMirror lines are 1-indexed
        const lineNumber = Math.max(1, Math.min(pos.line + 1, doc.lines));
        const line = doc.line(lineNumber);
        const ch = Math.max(0, Math.min(pos.ch, line.length));
        const offset = line.from + ch;
        
        console.log('[TTS Highlight] Position:', pos, '→ Offset:', offset);
        return offset;
    } catch (error) {
        console.error('[TTS Highlight] Error converting position:', pos, error);
        return 0;
    }
}
