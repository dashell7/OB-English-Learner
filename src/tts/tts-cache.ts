// IndexedDB-based TTS cache implementation
export class TTSCache {
    private dbName = 'lingua-sync-tts-cache';
    private storeName = 'audio-cache';
    private dbVersion = 2; // 增加版本号以触发 onupgradeneeded
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;

    async init(): Promise<void> {
        if (this.db) {
            console.log('[TTSCache] Database already initialized');
            return;
        }
        if (this.initPromise) {
            console.log('[TTSCache] Database initialization in progress');
            return this.initPromise;
        }

        console.log('[TTSCache] Starting database initialization...');
        
        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('[TTSCache] Failed to open database:', request.error);
                this.initPromise = null;
                reject(request.error);
            };
            
            request.onupgradeneeded = (event: any) => {
                console.log('[TTSCache] Database upgrade needed');
                const db = event.target.result;
                
                // Delete old store if exists
                if (db.objectStoreNames.contains(this.storeName)) {
                    console.log('[TTSCache] Deleting old object store');
                    db.deleteObjectStore(this.storeName);
                }
                
                // Create new store
                console.log('[TTSCache] Creating object store');
                const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                console.log('[TTSCache] Object store created successfully');
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('[TTSCache] Database opened successfully');
                
                // Verify object store exists
                if (!this.db.objectStoreNames.contains(this.storeName)) {
                    console.error('[TTSCache] Object store not found after initialization!');
                    this.db.close();
                    this.db = null;
                    this.initPromise = null;
                    reject(new Error('Object store not created'));
                    return;
                }
                
                console.log('[TTSCache] Database initialization complete');
                resolve();
            };
        });

        return this.initPromise;
    }

    async reset(): Promise<void> {
        console.log('[TTSCache] Resetting database...');
        
        // Close existing connection
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        
        this.initPromise = null;
        
        // Delete the database
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(this.dbName);
            
            request.onsuccess = () => {
                console.log('[TTSCache] Database deleted successfully');
                resolve();
            };
            
            request.onerror = () => {
                console.error('[TTSCache] Failed to delete database:', request.error);
                reject(request.error);
            };
            
            request.onblocked = () => {
                console.warn('[TTSCache] Database deletion blocked');
            };
        });
    }

    generateKey(text: string, provider: string, voice: string, speed: number, model: string): string {
        const data = `${provider}:${model}:${voice}:${speed}:${text}`;
        return this.simpleHash(data);
    }

    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    async get(key: string): Promise<ArrayBuffer | null> {
        try {
            if (!this.db) await this.init();
            if (!this.db) return null;

            return new Promise((resolve, reject) => {
                const transaction = this.db!.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(key);

                request.onsuccess = () => {
                    const result = request.result;
                    if (result && result.data) {
                        resolve(result.data);
                    } else {
                        resolve(null);
                    }
                };

                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[TTSCache] get failed:', err);
            return null;
        }
    }

    async set(key: string, data: ArrayBuffer): Promise<void> {
        try {
            if (!this.db) await this.init();
            if (!this.db) return;

            return new Promise((resolve, reject) => {
                const transaction = this.db!.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const record = {
                    key: key,
                    data: data,
                    timestamp: Date.now()
                };

                const request = store.put(record);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[TTSCache] set failed:', err);
        }
    }

    async getSize(): Promise<number> {
        try {
            if (!this.db) {
                await this.init();
            }
            
            if (!this.db) {
                console.warn('[TTSCache] Database not initialized, returning 0 size');
                return 0;
            }

            return new Promise((resolve, reject) => {
                try {
                    const transaction = this.db!.transaction([this.storeName], 'readonly');
                    const store = transaction.objectStore(this.storeName);
                    const request = store.getAll();

                    request.onsuccess = () => {
                        const records = request.result;
                        let totalSize = 0;
                        for (const record of records) {
                            if (record.data) {
                                totalSize += record.data.byteLength;
                            }
                        }
                        resolve(totalSize);
                    };

                    request.onerror = () => {
                        console.error('[TTSCache] Error getting size:', request.error);
                        reject(request.error);
                    };
                } catch (err) {
                    console.error('[TTSCache] Transaction error:', err);
                    reject(err);
                }
            });
        } catch (err) {
            console.error('[TTSCache] getSize failed:', err);
            return 0;
        }
    }

    async clear(): Promise<void> {
        try {
            if (!this.db) await this.init();
            if (!this.db) return;

            return new Promise((resolve, reject) => {
                const transaction = this.db!.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[TTSCache] clear failed:', err);
        }
    }

    async cleanOldEntries(maxAgeHours: number): Promise<void> {
        try {
            if (!this.db) await this.init();
            if (!this.db) return;

            const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);

            return new Promise((resolve, reject) => {
                const transaction = this.db!.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const index = store.index('timestamp');
                const request = index.openCursor();

                request.onsuccess = (event: any) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        if (cursor.value.timestamp < cutoffTime) {
                            cursor.delete();
                        }
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };

                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[TTSCache] cleanOldEntries failed:', err);
        }
    }
}
