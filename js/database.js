// js/database.js
const DB_NAME = "EkklesiaDB";
const STORE_NAME = "publicacoes";

const dbProvider = {
    db: null,
    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 2);
            request.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
                }
            };
            request.onsuccess = e => { this.db = e.target.result; resolve(); };
            request.onerror = e => reject(e);
        });
    },

    // Salva em lotes (batches) para performance
    async salvarLote(itens) {
        return new Promise((resolve) => {
            const tx = this.db.transaction([STORE_NAME], "readwrite");
            const store = tx.objectStore(STORE_NAME);
            itens.forEach(item => store.add(item));
            tx.oncomplete = () => resolve();
        });
    },

    async limpar() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], "readwrite");
            const req = tx.objectStore(STORE_NAME).clear();
            req.onsuccess = () => resolve();
            req.onerror = e => reject(e);
        });
    },

    async contar() {
        return new Promise(res => {
            const count = this.db.transaction(STORE_NAME).objectStore(STORE_NAME).count();
            count.onsuccess = () => res(count.result);
        });
    }
};
