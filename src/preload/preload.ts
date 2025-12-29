import { contextBridge, ipcRenderer } from 'electron';
import { RecordData, TrackData } from '../shared/types';

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // DB operations
  selectDbFile: (): Promise<string | null> => {
    return ipcRenderer.invoke('select-db-file');
  },

  loadRecords: (dbPath: string): Promise<RecordData[]> => {
    return ipcRenderer.invoke('load-records', dbPath);
  },

  loadTracks: (dbPath: string, recordIds: number[]): Promise<TrackData[]> => {
    return ipcRenderer.invoke('load-tracks', dbPath, recordIds);
  },

  getLastDbPath: (): Promise<string | null> => {
    return ipcRenderer.invoke('get-last-db-path');
  },

  setLastDbPath: (path: string): Promise<void> => {
    return ipcRenderer.invoke('set-last-db-path', path);
  },
});
