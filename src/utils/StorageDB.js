const DB_NAME = 'VRMA_Studio_DB';
const DB_VERSION = 2;
const AVATAR_STORE = 'avatars';
const POSE_STORE = 'saved_poses';

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(AVATAR_STORE)) {
        db.createObjectStore(AVATAR_STORE, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(POSE_STORE)) {
        db.createObjectStore(POSE_STORE, { keyPath: 'name' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn('Base de datos bloqueada temporalmente');
    };
  });
};

// --- GESTIÓN DE AVATARES ---
export const saveAvatarToDB = async (file) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AVATAR_STORE, 'readwrite');
    const store = tx.objectStore(AVATAR_STORE);
    const item = {
      name: file.name,
      blob: file,
      size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
      date: Date.now()
    };
    const req = store.put(item);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
};

export const getSavedAvatarsList = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AVATAR_STORE, 'readonly');
      const store = tx.objectStore(AVATAR_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
};

export const deleteAvatarFromDB = async (name) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AVATAR_STORE, 'readwrite');
    const store = tx.objectStore(AVATAR_STORE);
    const req = store.delete(name);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
};

// --- GESTIÓN DE POSES FAVORITAS ---
export const savePoseToDB = async (name, poseData) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(POSE_STORE, 'readwrite');
    const store = tx.objectStore(POSE_STORE);
    const item = {
      name: name,
      data: poseData,
      boneCount: Object.keys(poseData).length,
      date: Date.now()
    };
    const req = store.put(item);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
};

export const getSavedPosesList = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(POSE_STORE, 'readonly');
      const store = tx.objectStore(POSE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
};

export const deletePoseFromDB = async (name) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(POSE_STORE, 'readwrite');
    const store = tx.objectStore(POSE_STORE);
    const req = store.delete(name);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
};
