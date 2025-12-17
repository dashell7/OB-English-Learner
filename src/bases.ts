import { App, normalizePath } from 'obsidian';

export class BasesIntegration {
    constructor(private app: App) { }

    /**
     * Initialize the Knowledge Base structure
     * Creates folders and a dashboard note
     */
    async initializeKnowledgeBase(baseFolder: string): Promise<void> {
        // Create folder structure
        const folders = [
            `${baseFolder}`,
            `${baseFolder}/Videos`,
            `${baseFolder}/Vocab`,
            `${baseFolder}/Assets`
        ];

        for (const folder of folders) {
            const path = normalizePath(folder);
            if (!await this.app.vault.adapter.exists(path)) {
                try {
                    await this.app.vault.createFolder(path);
                } catch (err) {
                    // Ignore error if folder already exists
                    if (!err.message || !err.message.includes('Folder already exists')) {
                        throw err;
                    }
                }
            }
        }

        // Create dashboard note
        await this.createDashboard(baseFolder);
    }

    /**
     * Create a dashboard note with Bases views
     */
    private async createDashboard(baseFolder: string): Promise<void> {
        const dashboardPath = normalizePath(`${baseFolder}/Dashboard.md`);

        // Check if dashboard already exists
        if (await this.app.vault.adapter.exists(dashboardPath)) {
            console.log('Dashboard already exists');
            return;
        }

        const content = `# Language Learning Dashboard

Welcome to your language learning hub! This dashboard provides an overview of your video library and vocabulary.

## 📚 Video Library

\`\`\`dataview
TABLE 
  status as Status,
  channel as Channel,
  duration as Duration,
  created_at as "Added"
FROM "${baseFolder}/Videos"
WHERE type = "video-note"
SORT created_at DESC
\`\`\`

## 📥 Inbox (New Videos)

\`\`\`dataview
TABLE 
  title as Title,
  channel as Channel,
  duration as Duration
FROM "${baseFolder}/Videos"
WHERE type = "video-note" AND status = "inbox"
SORT created_at DESC
\`\`\`

## 🏃 Currently Learning

\`\`\`dataview
TABLE 
  title as Title,
  channel as Channel
FROM "${baseFolder}/Videos"
WHERE type = "video-note" AND status = "learning"
\`\`\`

## 📝 Vocabulary

\`\`\`dataview
TABLE 
  meaning as Meaning,
  file.link as "Source"
FROM "${baseFolder}/Vocab"
WHERE contains(tags, "vocab")
LIMIT 20
\`\`\`

---

*This dashboard uses Dataview queries. Install the Dataview plugin to see the tables above.*
*For a more visual experience, consider using the Obsidian Bases plugin.*
`;

        await this.app.vault.create(dashboardPath, content);
    }

    /**
     * Create a sample Bases configuration
     * This would be adapted based on how Bases plugin actually works
     */
    async createBasesConfig(baseFolder: string): Promise<void> {
        // This is a placeholder - actual implementation would depend on
        // the Bases plugin's configuration format
        const configPath = normalizePath(`${baseFolder}/.bases-config.json`);

        const config = {
            databases: [
                {
                    name: "Video Library",
                    source: `${baseFolder}/Videos`,
                    filter: { type: "video-note" },
                    columns: [
                        { name: "File", type: "file" },
                        { name: "Status", type: "select", options: ["inbox", "learning", "archived"] },
                        { name: "Channel", type: "text" },
                        { name: "Duration", type: "text" },
                        { name: "Created", type: "date", property: "created_at" }
                    ],
                    views: [
                        { type: "table", name: "All Videos" },
                        { type: "board", name: "By Status", groupBy: "status" }
                    ]
                },
                {
                    name: "Vocabulary",
                    source: `${baseFolder}/Vocab`,
                    filter: { tags: ["vocab"] },
                    columns: [
                        { name: "Word", type: "text" },
                        { name: "Meaning", type: "text" },
                        { name: "Source", type: "link" },
                        { name: "Next Review", type: "date" }
                    ]
                }
            ]
        };

        await this.app.vault.create(configPath, JSON.stringify(config, null, 2));
    }
}
