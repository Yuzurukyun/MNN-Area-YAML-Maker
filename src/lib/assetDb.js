// Native zero-dependency IndexedDB wrapper for caching media assets (images & audio).
// Persists large binary files across browser sessions without localStorage quota limits.
import { sanitizeToRootFolder } from './bgSchema.js';

const DB_NAME = 'area_maker_assets_db';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

let dbPromise = null;

function getDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('name', 'name', { unique: false });
            store.createIndex('relPath', 'relPath', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn('IndexedDB unavailable or blocked; falling back to in-memory asset pool.');
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB initialization error:', err);
        resolve(null);
      }
    });
  }
  return dbPromise;
}

/**
 * Saves a single asset record to IndexedDB.
 */
export async function dbSaveAsset(asset) {
  const db = await getDb();
  if (!db || !asset) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        id: asset.id,
        name: asset.name,
        relPath: asset.relPath,
        fullRelPath: asset.fullRelPath || asset.relPath,
        fromFolder: asset.fromFolder ? sanitizeToRootFolder(asset.fromFolder) : (asset.fullRelPath && asset.fullRelPath.includes('/') ? sanitizeToRootFolder(asset.fullRelPath.slice(0, asset.fullRelPath.lastIndexOf('/'))) : ''),
        type: asset.type,
        size: asset.size,
        lastModified: asset.lastModified || Date.now(),
        data: asset.file,
      };
      store.put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Saves multiple asset records to IndexedDB in a single transaction.
 */
export async function dbSaveAssets(assets) {
  const db = await getDb();
  if (!db || !assets || !assets.length) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const asset of assets) {
        store.put({
          id: asset.id,
          name: asset.name,
          relPath: asset.relPath,
          fullRelPath: asset.fullRelPath || asset.relPath,
          fromFolder: asset.fromFolder ? sanitizeToRootFolder(asset.fromFolder) : (asset.fullRelPath && asset.fullRelPath.includes('/') ? sanitizeToRootFolder(asset.fullRelPath.slice(0, asset.fullRelPath.lastIndexOf('/'))) : ''),
          type: asset.type,
          size: asset.size,
          lastModified: asset.lastModified || Date.now(),
          data: asset.file,
        });
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Loads all cached asset records from IndexedDB.
 */
export async function dbLoadAllAssets() {
  const db = await getDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Deletes a single asset from IndexedDB by id.
 */
export async function dbDeleteAsset(id) {
  const db = await getDb();
  if (!db || !id) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Deletes multiple assets from IndexedDB by an array of ids.
 */
export async function dbDeleteAssets(ids) {
  const db = await getDb();
  if (!db || !ids || !ids.length) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const id of ids) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Clears all cached assets from IndexedDB.
 */
export async function dbClearAssets() {
  const db = await getDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
