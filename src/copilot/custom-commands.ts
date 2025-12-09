import { App, TFile, TFolder, Notice, normalizePath } from 'obsidian';
import { CustomCommand } from '../types';

export class CustomCommandManager {
    private commands: CustomCommand[] = [];
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Initialize from settings
     */
    fromJSON(commands: CustomCommand[]) {
        this.commands = commands || [];
    }

    /**
     * Get commands for context menu
     */
    getContextMenuCommands(): CustomCommand[] {
        return this.commands
            .filter(cmd => cmd.showInContextMenu !== false)
            .sort((a, b) => {
                // Sort by order if exists, otherwise recency or alphabetical
                if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
                return b.lastUsedMs - a.lastUsedMs;
            });
    }

    /**
     * Execute a command template
     */
    executeCommand(commandTitle: string, selection: string): string {
        const command = this.commands.find(c => c.title === commandTitle);
        if (!command) throw new Error(`Command "${commandTitle}" not found`);

        // Update last used time
        command.lastUsedMs = Date.now();

        // Replace {{selection}} placeholder
        let prompt = command.content.replace(/\{\{selection\}\}/g, selection);
        
        // Basic templating support
        if (!prompt.includes(selection) && !command.content.includes('{{selection}}')) {
            // If placeholder not found, append selection at the end
            prompt = `${command.content}\n\n${selection}`;
        }

        return prompt;
    }

    /**
     * Update commands list
     */
    setCustomCommands(commands: CustomCommand[]) {
        this.commands = commands;
    }

    /**
     * Load commands from folder
     */
    async loadCommandsFromFolder(folderPath: string): Promise<CustomCommand[]> {
        try {
            console.log('[CustomCommandManager] Looking for folder:', folderPath);
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            
            if (!folder) {
                console.warn('[CustomCommandManager] Folder not found:', folderPath);
                new Notice(`⚠️ Custom commands folder not found: ${folderPath}`);
                return [];
            }
            
            if (!(folder instanceof TFolder)) {
                console.warn('[CustomCommandManager] Path is not a folder:', folderPath);
                new Notice(`⚠️ Path is not a folder: ${folderPath}`);
                return [];
            }

            console.log('[CustomCommandManager] Found folder, scanning for .md files...');
            const commands: CustomCommand[] = [];
            const files = folder.children.filter(f => f instanceof TFile && f.extension === 'md') as TFile[];
            console.log('[CustomCommandManager] Found', files.length, '.md files:', files.map(f => f.name));

            for (const file of files) {
                try {
                    const content = await this.app.vault.read(file);
                    const command = this.parseCommandFile(file.basename, content);
                    if (command) {
                        commands.push(command);
                        console.log('[CustomCommandManager] Loaded command:', command.title);
                    } else {
                        console.warn('[CustomCommandManager] Failed to parse command file:', file.name);
                    }
                } catch (err) {
                    console.error(`[CustomCommandManager] Failed to load command from ${file.path}:`, err);
                }
            }

            this.commands = commands;
            console.log('[CustomCommandManager] Total commands loaded:', commands.length);
            return commands;
        } catch (err) {
            console.error('[CustomCommandManager] Failed to load commands:', err);
            return [];
        }
    }

    /**
     * Parse command file (Markdown with frontmatter)
     * Supports both Copilot and LinguaSync formats
     */
    private parseCommandFile(title: string, content: string): CustomCommand | null {
        try {
            // Parse frontmatter
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            let frontmatter: any = {};
            let promptContent = content;

            if (frontmatterMatch) {
                const yamlContent = frontmatterMatch[1];
                
                // Simple YAML parser for our use case
                yamlContent.split('\n').forEach(line => {
                    const match = line.match(/^([^:]+):\s*(.*)$/);
                    if (match) {
                        const key = match[1].trim();
                        const value = match[2].trim();
                        // Parse boolean
                        if (value === 'true') frontmatter[key] = true;
                        else if (value === 'false') frontmatter[key] = false;
                        // Parse number
                        else if (!isNaN(Number(value)) && value !== '') frontmatter[key] = Number(value);
                        // String
                        else frontmatter[key] = value;
                    }
                });
                
                // Extract content after frontmatter
                promptContent = content.substring(frontmatterMatch[0].length).trim();
            }

            // Support both Copilot and LinguaSync frontmatter formats
            const showInContextMenu = frontmatter.showInContextMenu ?? 
                                     frontmatter['copilot-command-context-menu-enabled'] ?? 
                                     true;
            const showInSlashMenu = frontmatter.showInSlashMenu ?? 
                                   frontmatter['copilot-command-slash-enabled'] ?? 
                                   true;
            const order = frontmatter.order ?? 
                         frontmatter['copilot-command-context-menu-order'] ?? 
                         0;
            const modelKey = frontmatter.modelKey ?? 
                            frontmatter['copilot-command-model-key'] ?? 
                            '';
            const lastUsedMs = frontmatter.lastUsedMs ?? 
                              frontmatter['copilot-command-last-used'] ?? 
                              Date.now();

            return {
                title,
                content: promptContent,
                showInContextMenu,
                showInSlashMenu,
                order,
                modelKey,
                lastUsedMs
            };
        } catch (err) {
            console.error(`[CustomCommandManager] Failed to parse command file ${title}:`, err);
            return null;
        }
    }

    /**
     * Update a command (e.g., update lastUsedMs)
     */
    async updateCommand(command: CustomCommand): Promise<void> {
        // Find and update the command in the array
        const index = this.commands.findIndex(c => c.title === command.title);
        if (index !== -1) {
            this.commands[index] = command;
        }
        // Note: We don't persist lastUsedMs to file automatically
        // It's only used for in-memory sorting during the session
    }

    /**
     * Get all commands
     */
    getAllCommands(): CustomCommand[] {
        return this.commands;
    }
}
