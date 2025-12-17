import { App, Modal, Setting, Notice, setIcon, Plugin } from 'obsidian';
import { Credential, LinguaSyncSettings } from './types';

// Define interface to avoid circular dependency with main.ts
interface ILinguaSyncPlugin extends Plugin {
    settings: LinguaSyncSettings;
    saveSettings(): Promise<void>;
}

export class PasswordManagerModal extends Modal {
    plugin: ILinguaSyncPlugin;

    constructor(app: App, plugin: ILinguaSyncPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('ls-password-manager');

        // Header
        contentEl.createEl('h2', { text: 'Password Manager' });
        const desc = contentEl.createDiv({ cls: 'setting-item-description' });
        desc.setText('Manage login credentials for accessing content from password-protected sources like cloud storage (WebDAV, Nextcloud) and private file servers. These credentials are securely stored locally and used to stream media and files.');
        desc.style.marginBottom = '20px';

        // Toolbar
        const toolbar = contentEl.createDiv({ cls: 'ls-toolbar' });
        toolbar.style.display = 'flex';
        toolbar.style.gap = '10px';
        toolbar.style.marginBottom = '20px';

        this.createToolbarButton(toolbar, 'plus', 'Add Password', () => this.openAddModal());
        this.createToolbarButton(toolbar, 'download', 'Import', () => new Notice('Import feature coming soon'));
        this.createToolbarButton(toolbar, 'upload', 'Export', () => new Notice('Export feature coming soon'));
        this.createToolbarButton(toolbar, 'trash', 'Delete All', async () => {
            if (confirm('Are you sure you want to delete all passwords?')) {
                this.plugin.settings.credentials = [];
                await this.plugin.saveSettings();
                this.onOpen(); // Refresh
            }
        }, true);

        // Content Area
        const listContainer = contentEl.createDiv({ cls: 'ls-password-list' });
        listContainer.style.minHeight = '300px';
        listContainer.style.background = 'var(--background-secondary)';
        listContainer.style.borderRadius = '6px';
        listContainer.style.padding = '20px';
        listContainer.style.display = 'flex';
        listContainer.style.flexDirection = 'column';

        if (this.plugin.settings.credentials && this.plugin.settings.credentials.length > 0) {
            // Render List
            this.renderList(listContainer);
        } else {
            // Empty State
            this.renderEmptyState(listContainer);
        }
    }

    createToolbarButton(container: HTMLElement, icon: string, tooltip: string, onClick: () => void, isDestructive = false) {
        const btn = container.createEl('button');
        setIcon(btn, icon);
        btn.setAttribute('aria-label', tooltip);
        btn.onclick = onClick;
        if (isDestructive) {
            btn.addClass('mod-warning');
        }
    }

    renderEmptyState(container: HTMLElement) {
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        
        const iconDiv = container.createDiv();
        setIcon(iconDiv, 'lock');
        iconDiv.style.transform = 'scale(3)';
        iconDiv.style.color = 'var(--text-muted)';
        iconDiv.style.marginBottom = '20px';

        const h3 = container.createEl('h3', { text: 'No passwords saved' });
        h3.style.margin = '10px 0';

        const sub = container.createDiv({ text: 'Your saved passwords will appear here. Add your first password to get started.' });
        sub.style.color = 'var(--text-muted)';
        sub.style.textAlign = 'center';
        sub.style.maxWidth = '400px';
        
        const addBtn = container.createEl('button', { cls: 'mod-cta', text: 'Add Password' });
        addBtn.style.marginTop = '20px';
        setIcon(addBtn, 'plus');
        addBtn.onclick = () => this.openAddModal();
    }

    renderList(container: HTMLElement) {
        container.style.alignItems = 'stretch';
        container.style.justifyContent = 'flex-start';

        this.plugin.settings.credentials.forEach((cred, index) => {
            const item = container.createDiv({ cls: 'ls-credential-item' });
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.padding = '10px';
            item.style.borderBottom = '1px solid var(--background-modifier-border)';
            
            const info = item.createDiv();
            const headerDiv = info.createDiv();
            headerDiv.style.display = 'flex';
            headerDiv.style.alignItems = 'center';
            headerDiv.style.gap = '8px';

            // Icon based on type
            const iconSpan = headerDiv.createSpan();
            const iconName = cred.type === 'baiduyun' ? 'cloud' : 
                             cred.type === 'nextcloud' ? 'cloud-rain' : 
                             cred.type === 'webdav' ? 'hard-drive' : 'key';
            setIcon(iconSpan, iconName);
            
            const nameDiv = headerDiv.createSpan({ text: cred.name });
            nameDiv.style.fontWeight = 'bold';

            const detailDiv = info.createDiv({ text: `${cred.username} @ ${cred.url}` });
            detailDiv.style.fontSize = '0.8em';
            detailDiv.style.color = 'var(--text-muted)';
            detailDiv.style.marginLeft = '24px'; // Align with text above

            const actions = item.createDiv();
            actions.style.display = 'flex';
            actions.style.gap = '5px';
            
            const editBtn = actions.createEl('button', { cls: 'clickable-icon' });
            setIcon(editBtn, 'pencil');
            editBtn.onclick = () => this.openAddModal(cred, index);

            const delBtn = actions.createEl('button', { cls: 'clickable-icon mod-warning' });
            setIcon(delBtn, 'trash');
            delBtn.onclick = async () => {
                if (confirm(`Delete credential "${cred.name}"?`)) {
                    this.plugin.settings.credentials.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.onOpen();
                }
            };
        });
    }

    openAddModal(existingCred?: Credential, index?: number) {
        new CredentialEditModal(this.app, this.plugin, existingCred, (newCred) => {
            if (existingCred && index !== undefined) {
                this.plugin.settings.credentials[index] = newCred;
            } else {
                if (!this.plugin.settings.credentials) this.plugin.settings.credentials = [];
                this.plugin.settings.credentials.push(newCred);
            }
            this.plugin.saveSettings();
            this.onOpen(); // Refresh parent
        }).open();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class CredentialEditModal extends Modal {
    plugin: ILinguaSyncPlugin;
    credential: Credential;
    onSubmit: (cred: Credential) => void;

    constructor(app: App, plugin: ILinguaSyncPlugin, existing: Credential | undefined, onSubmit: (cred: Credential) => void) {
        super(app);
        this.plugin = plugin;
        this.onSubmit = onSubmit;
        this.credential = existing ? { ...existing } : {
            id: Date.now().toString(),
            type: 'webdav',
            name: '',
            url: '',
            username: '',
            password: ''
        };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: this.credential.name ? 'Edit Password' : 'Add Password' });

        new Setting(contentEl)
            .setName('Type')
            .setDesc('Service type')
            .addDropdown(dropdown => dropdown
                .addOption('webdav', 'WebDAV')
                .addOption('nextcloud', 'Nextcloud')
                .addOption('baiduyun', 'Baidu Netdisk (via Alist)')
                .addOption('other', 'Other')
                .setValue(this.credential.type || 'webdav')
                .onChange((value: any) => this.credential.type = value));

        new Setting(contentEl)
            .setName('Name')
            .setDesc('Friendly name for this connection')
            .addText(text => text
                .setValue(this.credential.name)
                .onChange(value => this.credential.name = value));

        new Setting(contentEl)
            .setName('URL / Host')
            .setDesc('Server address (e.g. https://dav.example.com)')
            .addText(text => text
                .setValue(this.credential.url)
                .onChange(value => this.credential.url = value));

        new Setting(contentEl)
            .setName('Username')
            .addText(text => text
                .setValue(this.credential.username)
                .onChange(value => this.credential.username = value));

        new Setting(contentEl)
            .setName('Password')
            .addText(text => {
                text.inputEl.type = 'password';
                text
                    .setValue(this.credential.password)
                    .onChange((value: string) => this.credential.password = value)
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Save')
                .setCta()
                .onClick(() => {
                    if (!this.credential.name || !this.credential.username) {
                        new Notice('Name and Username are required');
                        return;
                    }
                    this.onSubmit(this.credential);
                    this.close();
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}
