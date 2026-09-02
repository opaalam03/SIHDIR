/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, query, where, orderBy } from "firebase/firestore";
import defaultFirebaseConfig from "../firebase-applet-config.json";

// Helper to load Firebase configuration dynamically from env, config file, or localStorage
export const getFirebaseConfig = () => {
  const metaEnv = (import.meta as any).env || {};
  const envConfig = {
    apiKey: metaEnv.VITE_FIREBASE_API_KEY,
    authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: metaEnv.VITE_FIREBASE_PROJECT_ID,
    storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: metaEnv.VITE_FIREBASE_APP_ID,
    firestoreDatabaseId: metaEnv.VITE_FIREBASE_DATABASE_ID,
  };

  // 1. Check if env variables are present
  if (envConfig.apiKey && envConfig.projectId) {
    return envConfig;
  }

  // 2. Check if defaultFirebaseConfig from setup tool exists and has apiKey
  if (defaultFirebaseConfig && defaultFirebaseConfig.apiKey && defaultFirebaseConfig.projectId) {
    return defaultFirebaseConfig;
  }

  // 3. Fallback to manual configuration stored in localStorage by school admins
  try {
    const savedConfigRaw = localStorage.getItem("simpati_firebase_custom_config");
    if (savedConfigRaw) {
      const parsed = JSON.parse(savedConfigRaw);
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to parse custom Firebase config from localStorage", e);
  }

  return null;
};

// Check if Firebase is enabled/configured
export const isFirebaseConfigured = (): boolean => {
  return getFirebaseConfig() !== null;
};

// Initialize Firebase App gracefully
const config = getFirebaseConfig();
const app = config ? (getApps().length === 0 ? initializeApp(config) : getApp()) : null;

// Initialize Firestore (supporting custom database ID if specified)
const dbInstance = () => {
  if (!app) return null;
  const dbId = config?.firestoreDatabaseId || (config as any)?.databaseId;
  if (dbId && dbId !== "(default)") {
    return getFirestore(app, dbId);
  }
  return getFirestore(app);
};

// Exports
export const auth = app ? getAuth(app) : null;
export const db = dbInstance();

/**
 * FIREBASE FIRESTORE SYNC & CRUDE HELPER
 * Generic database functions that fall back to localStorage if Firebase is not connected.
 */
export const dbService = {
  /**
   * Save a record to a collection
   */
  async saveRecord(collectionName: string, id: string, data: any) {
    if (db) {
      try {
        const docRef = doc(db, collectionName, id);
        await setDoc(docRef, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
        console.log(`[Firebase] Document ${id} saved successfully in ${collectionName}.`);
        return true;
      } catch (error) {
        console.error(`[Firebase Error] Failed to save to ${collectionName}:`, error);
      }
    }
    
    // Local fallback
    try {
      const localKey = `simpati_${collectionName}`;
      const existingRaw = localStorage.getItem(localKey);
      let list: any[] = existingRaw ? JSON.parse(existingRaw) : [];
      
      // Update or insert
      const idx = list.findIndex((item: any) => item.id === id);
      const payload = { ...data, id, updatedAt: new Date().toISOString() };
      if (idx > -1) {
        list[idx] = payload;
      } else {
        list.push(payload);
      }
      localStorage.setItem(localKey, JSON.stringify(list));
      return true;
    } catch (e) {
      console.error(`[Local Storage Error] Failed to save fallback data for ${collectionName}:`, e);
      return false;
    }
  },

  /**
   * Get all records from a collection
   */
  async getRecords(collectionName: string, defaultFallback: any[] = []): Promise<any[]> {
    if (db) {
      try {
        const colRef = collection(db, collectionName);
        const snapshot = await getDocs(colRef);
        const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (records.length > 0) {
          return records;
        }
      } catch (error) {
        console.error(`[Firebase Error] Failed to fetch from ${collectionName}, falling back to local:`, error);
      }
    }

    // Local fallback
    try {
      const localKey = `simpati_${collectionName}`;
      const existingRaw = localStorage.getItem(localKey);
      if (existingRaw) {
        return JSON.parse(existingRaw);
      }
    } catch (e) {
      console.error(`[Local Storage Error] Failed to read fallback data for ${collectionName}:`, e);
    }

    return defaultFallback;
  },

  /**
   * Delete a record from a collection
   */
  async deleteRecord(collectionName: string, id: string) {
    if (db) {
      try {
        const docRef = doc(db, collectionName, id);
        await deleteDoc(docRef);
        console.log(`[Firebase] Document ${id} deleted successfully from ${collectionName}.`);
        return true;
      } catch (error) {
        console.error(`[Firebase Error] Failed to delete from ${collectionName}:`, error);
      }
    }

    // Local fallback
    try {
      const localKey = `simpati_${collectionName}`;
      const existingRaw = localStorage.getItem(localKey);
      if (existingRaw) {
        let list: any[] = JSON.parse(existingRaw);
        const updated = list.filter((item: any) => item.id !== id);
        localStorage.setItem(localKey, JSON.stringify(updated));
        return true;
      }
    } catch (e) {
      console.error(`[Local Storage Error] Failed to delete fallback data for ${collectionName}:`, e);
    }
    return false;
  },

  /**
   * Sync all local data of a collection to Firebase (Migration Helper)
   */
  async uploadLocalToFirebase(collectionName: string) {
    if (!db) return { status: false, message: "Firebase is not initialized." };
    
    try {
      const localKey = `simpati_${collectionName}`;
      const existingRaw = localStorage.getItem(localKey);
      if (!existingRaw) return { status: true, message: "No local records to sync." };

      const list: any[] = JSON.parse(existingRaw);
      let successCount = 0;

      for (const item of list) {
        if (item.id) {
          const docRef = doc(db, collectionName, item.id);
          await setDoc(docRef, { ...item, syncedAt: new Date().toISOString() }, { merge: true });
          successCount++;
        }
      }

      return {
        status: true,
        message: `Berhasil mengunggah ${successCount} data dari penyimpanan lokal ke Firebase Cloud Firestore!`
      };
    } catch (error: any) {
      console.error(`[Firebase Sync Error] Migration failed for ${collectionName}:`, error);
      return { status: false, message: error.message || "Gagal melakukan sinkronisasi data." };
    }
  }
};
