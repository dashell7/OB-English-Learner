/**
 * Modern Glass-morphism Toast Notification
 * 现代玻璃态半透明条状通知
 */
export class ProgressNotice {
    private container: HTMLElement;
    private progressBar: HTMLElement;
    private messageEl: HTMLElement;
    private percentageEl: HTMLElement;
    private totalSteps: number;
    private currentStep: number = 0;
    private hideTimeout?: number;

    constructor(totalSteps: number) {
        this.totalSteps = totalSteps;
        this.createToast();
        this.show();
    }

    /**
     * Create the toast notification element
     */
    private createToast() {
        // Container with glass-morphism effect
        this.container = document.body.createDiv('linguasync-toast');
        
        // Get computed background color for glass effect
        const bgColor = getComputedStyle(document.body).getPropertyValue('--background-primary') || '#ffffff';
        const isDark = document.body.classList.contains('theme-dark');
        
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            min-width: 360px;
            max-width: 480px;
            padding: 10px 18px;
            
            /* Glass-morphism with fallback */
            background: ${isDark ? 'rgba(30, 30, 40, 0.92)' : 'rgba(255, 255, 255, 0.92)'};
            backdrop-filter: blur(16px) saturate(180%);
            -webkit-backdrop-filter: blur(16px) saturate(180%);
            
            /* Border & Shadow */
            border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'};
            border-radius: 10px;
            box-shadow: ${isDark 
                ? '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)' 
                : '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.06)'
            };
            
            /* Typography */
            font-family: var(--font-ui);
            color: var(--text-normal);
            
            /* Animation */
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            z-index: 9999;
            pointer-events: auto;
        `;

        // Content wrapper
        const content = this.container.createDiv();
        content.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
        `;

        // Icon
        const icon = content.createSpan();
        icon.textContent = '🎬';
        icon.style.cssText = `
            font-size: 18px;
            flex-shrink: 0;
        `;

        // Message section
        const messageSection = content.createDiv();
        messageSection.style.cssText = `
            flex: 1;
            min-width: 0;
        `;

        // Message text
        this.messageEl = messageSection.createDiv();
        this.messageEl.style.cssText = `
            font-size: 13px;
            font-weight: 500;
            color: var(--text-normal);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 6px;
        `;

        // Progress bar container
        const progressContainer = messageSection.createDiv();
        progressContainer.style.cssText = `
            width: 100%;
            height: 2.5px;
            background: ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'};
            border-radius: 10px;
            overflow: hidden;
        `;

        // Progress bar fill
        this.progressBar = progressContainer.createDiv();
        this.progressBar.style.cssText = `
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, 
                var(--interactive-accent) 0%, 
                var(--interactive-accent-hover) 100%);
            border-radius: 10px;
            transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 0 6px ${isDark ? 'rgba(120, 160, 255, 0.4)' : 'rgba(100, 140, 255, 0.3)'};
        `;

        // Percentage
        this.percentageEl = content.createDiv();
        this.percentageEl.style.cssText = `
            font-size: 12px;
            font-weight: 600;
            color: var(--text-muted);
            font-variant-numeric: tabular-nums;
            min-width: 38px;
            text-align: right;
            flex-shrink: 0;
        `;
    }

    /**
     * Show the toast with animation
     */
    private show() {
        requestAnimationFrame(() => {
            this.container.style.opacity = '1';
            this.container.style.transform = 'translateX(-50%) translateY(0)';
        });
    }

    /**
     * Update to next step
     */
    nextStep(message: string) {
        this.currentStep++;
        this.updateDisplay(message);
    }

    /**
     * Update current step message without incrementing
     */
    updateMessage(message: string) {
        this.updateDisplay(message);
    }

    /**
     * Update the display
     */
    private updateDisplay(message: string) {
        const percentage = Math.round((this.currentStep / this.totalSteps) * 100);
        
        this.messageEl.textContent = message;
        this.percentageEl.textContent = `${percentage}%`;
        this.progressBar.style.width = `${percentage}%`;
    }

    /**
     * Show success message and hide after delay
     */
    success(message: string) {
        this.currentStep = this.totalSteps;
        
        // Update to success state
        this.messageEl.textContent = `✓ ${message}`;
        this.messageEl.style.color = 'var(--text-success)';
        this.percentageEl.textContent = '100%';
        this.progressBar.style.width = '100%';
        this.progressBar.style.background = 'var(--text-success)';
        
        // Auto hide after 2.5 seconds
        this.hideTimeout = window.setTimeout(() => {
            this.hide();
        }, 2500);
    }

    /**
     * Show error message
     */
    error(message: string) {
        this.messageEl.textContent = `✗ ${message}`;
        this.messageEl.style.color = 'var(--text-error)';
        this.progressBar.style.background = 'var(--text-error)';
        
        // Auto hide after 4 seconds
        this.hideTimeout = window.setTimeout(() => {
            this.hide();
        }, 4000);
    }

    /**
     * Hide the toast with animation
     */
    hide() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        
        this.container.style.opacity = '0';
        this.container.style.transform = 'translateX(-50%) translateY(-20px)';
        
        setTimeout(() => {
            this.container.remove();
        }, 400);
    }
}
