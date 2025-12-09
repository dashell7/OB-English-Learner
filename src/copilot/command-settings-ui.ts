import { App, Modal, Notice, Setting, TFile, normalizePath } from 'obsidian';
import { CustomCommand } from '../types';
import { CustomCommandManager } from './custom-commands';

/**
 * Modal for editing a single custom command
 */
export class CustomCommandEditModal extends Modal {
    private command: CustomCommand;
    private isNew: boolean;
    private onSave: (command: CustomCommand) => Promise<void>;
    private allCommands: CustomCommand[];
    private originalTitle: string;

    constructor(
        app: App,
        command: CustomCommand,
        isNew: boolean,
        allCommands: CustomCommand[],
        onSave: (command: CustomCommand) => Promise<void>
    ) {
        super(app);
        this.command = { ...command };
        this.isNew = isNew;
        this.allCommands = allCommands;
        this.onSave = onSave;
        this.originalTitle = command.title;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('custom-command-edit-modal');

        // Title
        this.titleEl.setText(this.isNew ? 'Add Custom Command' : 'Edit Custom Command');

        // Name field
        new Setting(contentEl)
            .setName('Name')
            .setDesc('Command name (will be used as filename)')
            .addText(text => {
                text.setPlaceholder('e.g., Explain Code')
                    .setValue(this.command.title)
                    .onChange(value => {
                        this.command.title = value;
                    });
                text.inputEl.style.width = '100%';
            });

        // Content field
        const contentSetting = new Setting(contentEl)
            .setName('Prompt')
            .setDesc('Use {{selection}} to reference selected text')
            .addTextArea(text => {
                text.setPlaceholder('Enter your prompt here...\n\nExample:\nPlease explain the following code:\n{{selection}}')
                    .setValue(this.command.content)
                    .onChange(value => {
                        this.command.content = value;
                    });
                text.inputEl.rows = 12;
                text.inputEl.style.width = '100%';
                text.inputEl.style.fontFamily = 'var(--font-monospace)';
            });

        // Help text for templating
        const helpDiv = contentEl.createDiv({ cls: 'setting-item-description' });
        helpDiv.style.marginTop = '10px';
        helpDiv.style.marginBottom = '20px';
        helpDiv.innerHTML = `
            <strong>Available variables:</strong><br>
            • <code>{{selection}}</code> - Currently selected text<br>
            If {{selection}} is not found, text will be appended at the end.
        `;

        // Show in context menu
        new Setting(contentEl)
            .setName('Show in Context Menu')
            .setDesc('Available when right-clicking in the editor')
            .addToggle(toggle => {
                toggle.setValue(this.command.showInContextMenu !== false)
                    .onChange(value => {
                        this.command.showInContextMenu = value;
                    });
            });

        // Show in slash menu
        new Setting(contentEl)
            .setName('Show in Slash Menu')
            .setDesc('Available as a slash command in chat')
            .addToggle(toggle => {
                toggle.setValue(this.command.showInSlashMenu !== false)
                    .onChange(value => {
                        this.command.showInSlashMenu = value;
                    });
            });

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.marginTop = '20px';

        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => this.close();

        const saveBtn = buttonContainer.createEl('button', { text: 'Save', cls: 'mod-cta' });
        saveBtn.onclick = async () => {
            await this.handleSave();
        };
    }

    private async handleSave() {
        // Validate
        if (!this.command.title.trim()) {
            new Notice('❌ Command name is required');
            return;
        }

        if (!this.command.content.trim()) {
            new Notice('❌ Prompt content is required');
            return;
        }

        // Check for duplicate names (except when editing the same command)
        if (this.command.title !== this.originalTitle) {
            const duplicate = this.allCommands.find(
                c => c.title.toLowerCase() === this.command.title.toLowerCase()
            );
            if (duplicate) {
                new Notice('❌ A command with this name already exists');
                return;
            }
        }

        // Validate filename (remove invalid characters)
        const sanitizedTitle = this.command.title.replace(/[\\/:*?"<>|]/g, '-');
        if (sanitizedTitle !== this.command.title) {
            new Notice('⚠️ Invalid characters removed from filename');
            this.command.title = sanitizedTitle;
        }

        try {
            await this.onSave(this.command);
            this.close();
        } catch (err) {
            new Notice('❌ Failed to save command: ' + err.message);
            console.error('Save command error:', err);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Settings UI component for managing custom commands
 * Replicates Copilot's Commands settings interface using native Obsidian API
 */
export class CustomCommandSettingsUI {
    private containerEl: HTMLElement;
    private app: App;
    private commands: CustomCommand[];
    private onUpdate: () => Promise<void>;
    private customCommandManager: CustomCommandManager;
    private customCommandsFolder: string;

    constructor(
        containerEl: HTMLElement,
        app: App,
        commands: CustomCommand[],
        customCommandManager: CustomCommandManager,
        customCommandsFolder: string,
        onUpdate: () => Promise<void>
    ) {
        this.containerEl = containerEl;
        this.app = app;
        this.commands = commands;
        this.onUpdate = onUpdate;
        this.customCommandManager = customCommandManager;
        this.customCommandsFolder = customCommandsFolder;
    }

    render() {
        this.containerEl.empty();

        // Section description
        const descDiv = this.containerEl.createDiv({ cls: 'setting-item-description' });
        descDiv.style.marginBottom = '20px';
        descDiv.innerHTML = `
            Custom commands are preset prompts that you can trigger in the editor by right-clicking 
            and selecting them from the context menu or by using a <code>/</code> command in chat.
        `;

        // Folder info
        const infoDiv = this.containerEl.createDiv({ cls: 'ls-info-box' });
        infoDiv.style.marginBottom = '20px';
        infoDiv.innerHTML = `
            <div style="display: flex; gap: 10px; align-items: start;">
                <span style="font-size: 20px;">💡</span>
                <div>
                    Commands are automatically loaded from .md files in your custom prompts folder 
                    <strong>${this.customCommandsFolder}</strong>. 
                    Modifying the files will also update the command settings.
                </div>
            </div>
        `;

        // Action buttons
        const actionsContainer = this.containerEl.createDiv({ cls: 'custom-commands-actions' });
        actionsContainer.style.display = 'flex';
        actionsContainer.style.justifyContent = 'space-between';
        actionsContainer.style.marginBottom = '15px';
        actionsContainer.style.gap = '10px';

        // Generate defaults button
        const defaultBtn = actionsContainer.createEl('button', { text: 'Generate Default' });
        defaultBtn.onclick = async () => {
            // Create confirmation modal
            const modal = new Modal(this.app);
            modal.titleEl.setText('Generate Default Commands / 生成默认命令');
            
            const contentDiv = modal.contentEl.createDiv();
            contentDiv.style.padding = '20px 0';
            contentDiv.innerHTML = `
                <p style="margin-bottom: 15px;">
                    This will add default commands to your custom prompts folder. Continue?<br>
                    <span style="color: var(--text-muted); font-size: 0.9em;">
                        这将向您的自定义命令文件夹添加默认命令。是否继续？
                    </span>
                </p>
                <p style="color: var(--text-muted); font-size: 0.9em; margin-top: 10px;">
                    📁 Folder / 文件夹: <strong>${this.customCommandsFolder}</strong>
                </p>
            `;
            
            const buttonDiv = modal.contentEl.createDiv();
            buttonDiv.style.display = 'flex';
            buttonDiv.style.justifyContent = 'flex-end';
            buttonDiv.style.gap = '10px';
            buttonDiv.style.marginTop = '20px';
            
            const cancelBtn = buttonDiv.createEl('button', { text: 'Cancel / 取消' });
            cancelBtn.onclick = () => modal.close();
            
            const confirmBtn = buttonDiv.createEl('button', { text: 'Continue / 继续', cls: 'mod-cta' });
            confirmBtn.onclick = async () => {
                modal.close();
                await this.generateDefaultCommands();
            };
            
            modal.open();
        };

        // Add command button
        const addBtn = actionsContainer.createEl('button', { text: '+ Add Cmd', cls: 'mod-cta' });
        addBtn.onclick = () => this.openCommandModal();

        // Commands table
        this.renderCommandsTable();
    }

    private renderCommandsTable() {
        const tableContainer = this.containerEl.createDiv({ cls: 'custom-commands-table-container' });

        if (this.commands.length === 0) {
            const emptyMsg = tableContainer.createDiv({ cls: 'custom-commands-empty' });
            emptyMsg.style.textAlign = 'center';
            emptyMsg.style.padding = '40px';
            emptyMsg.style.color = 'var(--text-muted)';
            emptyMsg.setText('No custom commands found. Click "Add Command" to create one.');
            return;
        }

        // Create table
        const table = tableContainer.createEl('table', { cls: 'custom-commands-table' });
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';

        // Table header
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        
        // Empty header for drag handle
        const dragHeader = headerRow.createEl('th');
        dragHeader.style.width = '30px';
        dragHeader.style.padding = '12px 8px';
        dragHeader.style.borderBottom = '2px solid var(--background-modifier-border)';
        
        // Name header
        const nameHeader = headerRow.createEl('th');
        nameHeader.setText('Name');
        nameHeader.style.textAlign = 'left';
        nameHeader.style.padding = '12px 8px';
        nameHeader.style.borderBottom = '2px solid var(--background-modifier-border)';
        nameHeader.style.fontWeight = '600';
        
        // In Menu header with tooltip
        const menuHeader = headerRow.createEl('th');
        const menuHeaderContent = menuHeader.createDiv();
        menuHeaderContent.style.display = 'flex';
        menuHeaderContent.style.alignItems = 'center';
        menuHeaderContent.style.justifyContent = 'center';
        menuHeaderContent.style.gap = '4px';
        menuHeaderContent.createSpan({ text: 'In Menu' });
        const menuTooltip = menuHeaderContent.createSpan({ text: '?', cls: 'tooltip-icon' });
        menuTooltip.style.fontSize = '0.8em';
        menuTooltip.style.color = 'var(--text-muted)';
        menuTooltip.style.cursor = 'help';
        menuTooltip.title = 'Show in right-click context menu';
        menuHeader.style.textAlign = 'center';
        menuHeader.style.padding = '12px 8px';
        menuHeader.style.borderBottom = '2px solid var(--background-modifier-border)';
        menuHeader.style.fontWeight = '600';
        
        // Slash Cmd header with tooltip
        const slashHeader = headerRow.createEl('th');
        const slashHeaderContent = slashHeader.createDiv();
        slashHeaderContent.style.display = 'flex';
        slashHeaderContent.style.alignItems = 'center';
        slashHeaderContent.style.justifyContent = 'center';
        slashHeaderContent.style.gap = '4px';
        slashHeaderContent.createSpan({ text: 'Slash Cmd' });
        const slashTooltip = slashHeaderContent.createSpan({ text: '?', cls: 'tooltip-icon' });
        slashTooltip.style.fontSize = '0.8em';
        slashTooltip.style.color = 'var(--text-muted)';
        slashTooltip.style.cursor = 'help';
        slashTooltip.title = 'Show in slash command menu';
        slashHeader.style.textAlign = 'center';
        slashHeader.style.padding = '12px 8px';
        slashHeader.style.borderBottom = '2px solid var(--background-modifier-border)';
        slashHeader.style.fontWeight = '600';
        
        // Actions header
        const actionsHeader = headerRow.createEl('th');
        actionsHeader.setText('Actions');
        actionsHeader.style.textAlign = 'center';
        actionsHeader.style.padding = '12px 8px';
        actionsHeader.style.borderBottom = '2px solid var(--background-modifier-border)';
        actionsHeader.style.fontWeight = '600';

        // Table body
        const tbody = table.createEl('tbody');
        
        // Sort commands by order
        const sortedCommands = [...this.commands].sort((a, b) => {
            if (a.order !== undefined && b.order !== undefined) {
                return a.order - b.order;
            }
            return b.lastUsedMs - a.lastUsedMs;
        });

        sortedCommands.forEach((command, index) => {
            const row = tbody.createEl('tr');
            row.style.borderBottom = '1px solid var(--background-modifier-border)';

            // Drag handle cell
            const dragCell = row.createEl('td');
            dragCell.style.padding = '12px 8px';
            dragCell.style.textAlign = 'center';
            dragCell.style.cursor = 'grab';
            dragCell.style.color = 'var(--text-muted)';
            dragCell.innerHTML = '⋮⋮';
            dragCell.setAttribute('aria-label', 'Drag to reorder');

            // Name cell
            const nameCell = row.createEl('td');
            nameCell.style.padding = '12px 8px';
            nameCell.setText(command.title);

            // In Menu checkbox
            const menuCell = row.createEl('td');
            menuCell.style.textAlign = 'center';
            menuCell.style.padding = '12px 8px';
            const menuCheckbox = menuCell.createEl('input', { type: 'checkbox' });
            menuCheckbox.checked = command.showInContextMenu !== false;
            menuCheckbox.onclick = async (e) => {
                e.stopPropagation();
                command.showInContextMenu = menuCheckbox.checked;
                await this.saveCommand(command, command.title);
            };

            // In Slash checkbox
            const slashCell = row.createEl('td');
            slashCell.style.textAlign = 'center';
            slashCell.style.padding = '12px 8px';
            const slashCheckbox = slashCell.createEl('input', { type: 'checkbox' });
            slashCheckbox.checked = command.showInSlashMenu !== false;
            slashCheckbox.onclick = async (e) => {
                e.stopPropagation();
                command.showInSlashMenu = slashCheckbox.checked;
                await this.saveCommand(command, command.title);
            };

            // Actions cell
            const actionsCell = row.createEl('td');
            actionsCell.style.textAlign = 'center';
            actionsCell.style.padding = '12px 8px';
            actionsCell.style.display = 'flex';
            actionsCell.style.gap = '5px';
            actionsCell.style.justifyContent = 'center';

            // Edit button
            const editBtn = actionsCell.createEl('button', { text: '✏️', attr: { 'aria-label': 'Edit' } });
            editBtn.style.padding = '4px 8px';
            editBtn.onclick = () => this.openCommandModal(command);

            // Copy button
            const copyBtn = actionsCell.createEl('button', { text: '📋', attr: { 'aria-label': 'Copy' } });
            copyBtn.style.padding = '4px 8px';
            copyBtn.onclick = async () => await this.copyCommand(command);

            // Delete button
            const deleteBtn = actionsCell.createEl('button', { text: '🗑️', attr: { 'aria-label': 'Delete' } });
            deleteBtn.style.padding = '4px 8px';
            deleteBtn.onclick = async () => {
                // Create confirmation modal
                const modal = new Modal(this.app);
                modal.titleEl.setText('Delete Command / 删除命令');
                
                const contentDiv = modal.contentEl.createDiv();
                contentDiv.style.padding = '20px 0';
                contentDiv.innerHTML = `
                    <p style="margin-bottom: 15px;">
                        Delete command "<strong>${command.title}</strong>"? This will permanently remove the command file.<br>
                        <span style="color: var(--text-muted); font-size: 0.9em;">
                            确定要删除命令 "<strong>${command.title}</strong>" 吗？这将永久删除命令文件。
                        </span>
                    </p>
                `;
                
                const buttonDiv = modal.contentEl.createDiv();
                buttonDiv.style.display = 'flex';
                buttonDiv.style.justifyContent = 'flex-end';
                buttonDiv.style.gap = '10px';
                buttonDiv.style.marginTop = '20px';
                
                const cancelBtn = buttonDiv.createEl('button', { text: 'Cancel / 取消' });
                cancelBtn.onclick = () => modal.close();
                
                const deleteBtn2 = buttonDiv.createEl('button', { text: 'Delete / 删除', cls: 'mod-warning' });
                deleteBtn2.onclick = async () => {
                    modal.close();
                    await this.deleteCommand(command);
                };
                
                modal.open();
            };
        });
    }

    private openCommandModal(command?: CustomCommand) {
        const isNew = !command;
        const editCommand = command || {
            title: '',
            content: '',
            showInContextMenu: true,
            showInSlashMenu: true,
            order: this.commands.length,
            modelKey: '',
            lastUsedMs: Date.now()
        };

        const modal = new CustomCommandEditModal(
            this.app,
            editCommand,
            isNew,
            this.commands,
            async (updatedCommand) => {
                if (isNew) {
                    await this.createCommand(updatedCommand);
                } else {
                    await this.saveCommand(updatedCommand, command!.title);
                }
            }
        );
        modal.open();
    }

    private async createCommand(command: CustomCommand) {
        try {
            // Create file in custom commands folder
            const folderPath = this.customCommandsFolder;
            const fileName = `${command.title}.md`;
            const filePath = normalizePath(`${folderPath}/${fileName}`);

            // Check if folder exists, create if not
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }

            // Check if file already exists
            const existingFile = this.app.vault.getAbstractFileByPath(filePath);
            if (existingFile) {
                new Notice('❌ A command file with this name already exists');
                return;
            }

            // Create frontmatter
            const frontmatter = this.buildFrontmatter(command);
            const content = `${frontmatter}\n${command.content}`;

            // Create file
            await this.app.vault.create(filePath, content);

            new Notice(`✅ Command "${command.title}" created!`);
            
            // Reload commands from manager
            await this.onUpdate();
            
            // Update local commands array reference
            const updatedCommands = this.customCommandManager.getAllCommands();
            this.commands = updatedCommands;
            
            // Re-render UI
            this.render();
        } catch (err) {
            new Notice('❌ Failed to create command: ' + err.message);
            console.error('Create command error:', err);
        }
    }

    private async saveCommand(command: CustomCommand, originalTitle: string) {
        try {
            const folderPath = this.customCommandsFolder;
            const oldFilePath = normalizePath(`${folderPath}/${originalTitle}.md`);
            const newFilePath = normalizePath(`${folderPath}/${command.title}.md`);

            const file = this.app.vault.getAbstractFileByPath(oldFilePath);
            if (!(file instanceof TFile)) {
                new Notice('❌ Command file not found');
                return;
            }

            // Build content
            const frontmatter = this.buildFrontmatter(command);
            const content = `${frontmatter}\n${command.content}`;

            // Update file
            await this.app.vault.modify(file, content);

            // Rename if title changed
            if (originalTitle !== command.title) {
                await this.app.vault.rename(file, newFilePath);
            }

            new Notice(`✅ Command "${command.title}" updated!`);
            
            // Reload commands from manager
            await this.onUpdate();
            
            // Update local commands array reference
            const updatedCommands = this.customCommandManager.getAllCommands();
            this.commands = updatedCommands;
            
            // Re-render UI
            this.render();
        } catch (err) {
            new Notice('❌ Failed to save command: ' + err.message);
            console.error('Save command error:', err);
        }
    }

    private async copyCommand(command: CustomCommand) {
        try {
            // Generate unique name
            let copyNumber = 1;
            let newTitle = `${command.title} (Copy)`;
            while (this.commands.find(c => c.title === newTitle)) {
                copyNumber++;
                newTitle = `${command.title} (Copy ${copyNumber})`;
            }

            const copiedCommand: CustomCommand = {
                ...command,
                title: newTitle,
                lastUsedMs: Date.now()
            };

            await this.createCommand(copiedCommand);
        } catch (err) {
            new Notice('❌ Failed to copy command: ' + err.message);
            console.error('Copy command error:', err);
        }
    }

    private async deleteCommand(command: CustomCommand) {
        try {
            const folderPath = this.customCommandsFolder;
            const filePath = normalizePath(`${folderPath}/${command.title}.md`);

            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                await this.app.vault.delete(file);
                new Notice(`✅ Command "${command.title}" deleted`);
                
                // Reload commands from manager
                await this.onUpdate();
                
                // Update local commands array reference
                const updatedCommands = this.customCommandManager.getAllCommands();
                this.commands = updatedCommands;
                
                // Re-render UI
                this.render();
            } else {
                new Notice('❌ Command file not found');
            }
        } catch (err) {
            new Notice('❌ Failed to delete command: ' + err.message);
            console.error('Delete command error:', err);
        }
    }

    private buildFrontmatter(command: CustomCommand): string {
        const parts = ['---'];
        if (command.showInContextMenu !== undefined) {
            parts.push(`showInContextMenu: ${command.showInContextMenu}`);
        }
        if (command.showInSlashMenu !== undefined) {
            parts.push(`showInSlashMenu: ${command.showInSlashMenu}`);
        }
        if (command.order !== undefined) {
            parts.push(`order: ${command.order}`);
        }
        if (command.modelKey) {
            parts.push(`modelKey: ${command.modelKey}`);
        }
        parts.push('---');
        return parts.join('\n');
    }

    private async generateDefaultCommands() {
        try {
            const folderPath = this.customCommandsFolder;

            // Check if folder exists, create if not
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }

            const defaultCommands: CustomCommand[] = [
                {
                    title: '口语纠正专家',
                    content: `You are a spoken English correction expert. Please analyze the following text and:
1. Identify any grammar mistakes, unnatural expressions, or word choice issues
2. Provide corrected versions with explanations
3. Suggest more native-like alternatives
4. Point out any cultural or contextual improvements

Text to analyze:
{{selection}}

Please format your response as:
**Original Issues:**
- [list problems]

**Corrected Version:**
[corrected text]

**Suggestions:**
- [improvement suggestions]`,
                    showInContextMenu: true,
                    showInSlashMenu: true,
                    order: 0,
                    modelKey: '',
                    lastUsedMs: Date.now()
                },
                {
                    title: 'Explain Idioms',
                    content: `Please explain any idioms, phrasal verbs, or colloquial expressions in the following text. For each expression, provide:
1. Literal meaning
2. Actual meaning
3. Example sentences
4. Chinese translation

Text:
{{selection}}`,
                    showInContextMenu: true,
                    showInSlashMenu: true,
                    order: 1,
                    modelKey: '',
                    lastUsedMs: Date.now()
                },
                {
                    title: 'Translate to Chinese',
                    content: 'Please translate the following English text to Chinese, keeping the translation natural and accurate:\n\n{{selection}}',
                    showInContextMenu: true,
                    showInSlashMenu: true,
                    order: 2,
                    modelKey: '',
                    lastUsedMs: Date.now()
                },
                {
                    title: 'Simplify',
                    content: `Please rewrite the following text using simpler English suitable for intermediate learners:
- Use common vocabulary (B1-B2 level)
- Keep sentences clear and shorter
- Maintain the original meaning
- Add explanations for any difficult terms that must be kept

Original text:
{{selection}}`,
                    showInContextMenu: true,
                    showInSlashMenu: true,
                    order: 3,
                    modelKey: '',
                    lastUsedMs: Date.now()
                },
                {
                    title: 'Practice Questions',
                    content: `Based on the following text, generate 5 comprehension questions and 5 vocabulary questions to help test understanding:

Text:
{{selection}}

Please format as:
**Comprehension Questions:**
1. [question]

**Vocabulary Questions:**
1. [question about word usage]`,
                    showInContextMenu: true,
                    showInSlashMenu: true,
                    order: 4,
                    modelKey: '',
                    lastUsedMs: Date.now()
                }
            ];

            let created = 0;
            for (const command of defaultCommands) {
                const filePath = normalizePath(`${folderPath}/${command.title}.md`);
                const existingFile = this.app.vault.getAbstractFileByPath(filePath);
                
                if (!existingFile) {
                    const frontmatter = this.buildFrontmatter(command);
                    const content = `${frontmatter}\n${command.content}`;
                    await this.app.vault.create(filePath, content);
                    created++;
                }
            }

            if (created > 0) {
                new Notice(`✅ Generated ${created} default commands`);
                
                // Reload commands from manager
                await this.onUpdate();
                
                // Update local commands array reference
                const updatedCommands = this.customCommandManager.getAllCommands();
                this.commands = updatedCommands;
                
                // Re-render UI
                this.render();
            } else {
                new Notice('ℹ️ All default commands already exist');
            }
        } catch (err) {
            new Notice('❌ Failed to generate defaults: ' + err.message);
            console.error('Generate defaults error:', err);
        }
    }
}
