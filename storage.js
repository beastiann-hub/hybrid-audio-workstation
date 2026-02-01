// storage.js - IndexedDB storage for projects, samples, and settings
// Provides persistent storage for the audio workstation

const DB_NAME = 'HybridAudioWorkstation';
const DB_VERSION = 1;

// Store names
const STORES = {
  PROJECTS: 'projects',
  SAMPLES: 'samples',
  PATTERNS: 'patterns',
  SETTINGS: 'settings',
  MIDI_MAPPINGS: 'midiMappings'
};

let db = null;

/**
 * Initialize the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export async function initDB() {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('Failed to open database:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      db = request.result;
      console.log('Database opened successfully');
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Projects store
      if (!database.objectStoreNames.contains(STORES.PROJECTS)) {
        const projectStore = database.createObjectStore(STORES.PROJECTS, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        projectStore.createIndex('name', 'name', { unique: false });
        projectStore.createIndex('created', 'created', { unique: false });
        projectStore.createIndex('modified', 'modified', { unique: false });
      }
      
      // Samples store (for user's sample library)
      if (!database.objectStoreNames.contains(STORES.SAMPLES)) {
        const sampleStore = database.createObjectStore(STORES.SAMPLES, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        sampleStore.createIndex('name', 'name', { unique: false });
        sampleStore.createIndex('category', 'category', { unique: false });
        sampleStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      }
      
      // Patterns store (sequencer patterns)
      if (!database.objectStoreNames.contains(STORES.PATTERNS)) {
        const patternStore = database.createObjectStore(STORES.PATTERNS, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        patternStore.createIndex('name', 'name', { unique: false });
        patternStore.createIndex('projectId', 'projectId', { unique: false });
      }
      
      // Settings store
      if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
        database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
      
      // MIDI mappings store
      if (!database.objectStoreNames.contains(STORES.MIDI_MAPPINGS)) {
        const midiStore = database.createObjectStore(STORES.MIDI_MAPPINGS, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        midiStore.createIndex('name', 'name', { unique: false });
      }
      
      console.log('Database schema created/upgraded');
    };
  });
}

/**
 * Get a transaction and object store
 * @param {string} storeName - Store name
 * @param {string} mode - 'readonly' or 'readwrite'
 * @returns {IDBObjectStore}
 */
function getStore(storeName, mode = 'readonly') {
  if (!db) throw new Error('Database not initialized');
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

// ==================== PROJECTS ====================

/**
 * Save a project
 * @param {object} project - Project data
 * @returns {Promise<number>} Project ID
 */
export async function saveProject(project) {
  await initDB();
  
  const projectData = {
    ...project,
    modified: new Date().toISOString()
  };
  
  if (!projectData.created) {
    projectData.created = projectData.modified;
  }
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.PROJECTS, 'readwrite');
    const request = projectData.id ? store.put(projectData) : store.add(projectData);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load a project by ID
 * @param {number} id - Project ID
 * @returns {Promise<object>}
 */
export async function loadProject(id) {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.PROJECTS);
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all projects
 * @returns {Promise<object[]>}
 */
export async function getAllProjects() {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.PROJECTS);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a project
 * @param {number} id - Project ID
 * @returns {Promise<void>}
 */
export async function deleteProject(id) {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.PROJECTS, 'readwrite');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==================== SAMPLES ====================

/**
 * Save a sample to the library
 * @param {object} sample - Sample data with buffer as ArrayBuffer
 * @returns {Promise<number>} Sample ID
 */
export async function saveSample(sample) {
  await initDB();
  
  const sampleData = {
    ...sample,
    created: sample.created || new Date().toISOString()
  };
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.SAMPLES, 'readwrite');
    const request = sampleData.id ? store.put(sampleData) : store.add(sampleData);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load a sample by ID
 * @param {number} id - Sample ID
 * @returns {Promise<object>}
 */
export async function loadSample(id) {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.SAMPLES);
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all samples
 * @returns {Promise<object[]>}
 */
export async function getAllSamples() {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.SAMPLES);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get samples by category
 * @param {string} category - Category name
 * @returns {Promise<object[]>}
 */
export async function getSamplesByCategory(category) {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.SAMPLES);
    const index = store.index('category');
    const request = index.getAll(category);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a sample
 * @param {number} id - Sample ID
 * @returns {Promise<void>}
 */
export async function deleteSample(id) {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.SAMPLES, 'readwrite');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==================== PATTERNS ====================

/**
 * Save a sequencer pattern
 * @param {object} pattern - Pattern data
 * @returns {Promise<number>} Pattern ID
 */
export async function savePattern(pattern) {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.PATTERNS, 'readwrite');
    const request = pattern.id ? store.put(pattern) : store.add(pattern);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load patterns for a project
 * @param {number} projectId - Project ID
 * @returns {Promise<object[]>}
 */
export async function getPatternsByProject(projectId) {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.PATTERNS);
    const index = store.index('projectId');
    const request = index.getAll(projectId);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== SETTINGS ====================

/**
 * Save a setting
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 * @returns {Promise<void>}
 */
export async function saveSetting(key, value) {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.SETTINGS, 'readwrite');
    const request = store.put({ key, value });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load a setting
 * @param {string} key - Setting key
 * @param {any} defaultValue - Default value if not found
 * @returns {Promise<any>}
 */
export async function loadSetting(key, defaultValue = null) {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.SETTINGS);
    const request = store.get(key);
    
    request.onsuccess = () => {
      resolve(request.result ? request.result.value : defaultValue);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load all settings
 * @returns {Promise<object>}
 */
export async function loadAllSettings() {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.SETTINGS);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const settings = {};
      request.result.forEach(item => {
        settings[item.key] = item.value;
      });
      resolve(settings);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== MIDI MAPPINGS ====================

/**
 * Save MIDI mappings
 * @param {object} mappings - MIDI mapping configuration
 * @returns {Promise<number>} Mapping ID
 */
export async function saveMidiMappings(mappings) {
  await initDB();
  
  const data = {
    ...mappings,
    modified: new Date().toISOString()
  };
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.MIDI_MAPPINGS, 'readwrite');
    const request = data.id ? store.put(data) : store.add(data);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load all MIDI mappings
 * @returns {Promise<object[]>}
 */
export async function getAllMidiMappings() {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.MIDI_MAPPINGS);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Convert AudioBuffer to ArrayBuffer for storage
 * @param {AudioBuffer} audioBuffer - Web Audio buffer
 * @returns {ArrayBuffer}
 */
export function audioBufferToArrayBuffer(audioBuffer) {
  const length = audioBuffer.length * audioBuffer.numberOfChannels * 4; // Float32
  const arrayBuffer = new ArrayBuffer(length + 12); // Header + data
  const view = new DataView(arrayBuffer);
  
  // Write header
  view.setUint32(0, audioBuffer.numberOfChannels, true);
  view.setUint32(4, audioBuffer.length, true);
  view.setFloat32(8, audioBuffer.sampleRate, true);
  
  // Write channel data
  let offset = 12;
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      view.setFloat32(offset, channelData[i], true);
      offset += 4;
    }
  }
  
  return arrayBuffer;
}

/**
 * Convert ArrayBuffer back to AudioBuffer
 * @param {AudioContext} context - Web Audio context
 * @param {ArrayBuffer} arrayBuffer - Stored buffer
 * @returns {AudioBuffer}
 */
export function arrayBufferToAudioBuffer(context, arrayBuffer) {
  const view = new DataView(arrayBuffer);
  
  // Read header
  const numberOfChannels = view.getUint32(0, true);
  const length = view.getUint32(4, true);
  const sampleRate = view.getFloat32(8, true);
  
  // Create buffer
  const audioBuffer = context.createBuffer(numberOfChannels, length, sampleRate);
  
  // Read channel data
  let offset = 12;
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = view.getFloat32(offset, true);
      offset += 4;
    }
  }
  
  return audioBuffer;
}

/**
 * Export project as JSON file
 * @param {number} projectId - Project ID
 */
export async function exportProjectAsFile(projectId) {
  const project = await loadProject(projectId);
  if (!project) {
    console.error('Project not found');
    return;
  }
  
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name || 'project'}.haw.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import project from JSON file
 * @param {File} file - JSON file
 * @returns {Promise<number>} New project ID
 */
export async function importProjectFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const project = JSON.parse(e.target.result);
        delete project.id; // Remove ID to create new project
        project.name = project.name + ' (Imported)';
        const id = await saveProject(project);
        resolve(id);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Get storage usage statistics
 * @returns {Promise<object>}
 */
export async function getStorageStats() {
  await initDB();
  
  const stats = {
    projects: 0,
    samples: 0,
    patterns: 0,
    settings: 0,
    midiMappings: 0
  };
  
  const stores = Object.values(STORES);
  
  for (const storeName of stores) {
    const count = await new Promise((resolve, reject) => {
      const store = getStore(storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    const key = Object.keys(STORES).find(k => STORES[k] === storeName);
    if (key) {
      stats[key.toLowerCase()] = count;
    }
  }
  
  return stats;
}

// Initialize on load
initDB().catch(console.error);

// Export for global access
if (typeof window !== 'undefined') {
  window.hawStorage = {
    initDB,
    saveProject,
    loadProject,
    getAllProjects,
    deleteProject,
    saveSample,
    loadSample,
    getAllSamples,
    deleteSample,
    savePattern,
    getPatternsByProject,
    saveSetting,
    loadSetting,
    loadAllSettings,
    saveMidiMappings,
    getAllMidiMappings,
    audioBufferToArrayBuffer,
    arrayBufferToAudioBuffer,
    exportProjectAsFile,
    importProjectFromFile,
    getStorageStats
  };
}
