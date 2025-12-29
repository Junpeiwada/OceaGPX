import { contextBridge, ipcRenderer } from 'electron';
import { RecordData, TrackData, ExportResult, AppSettings } from '../shared/types';

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

  // GPX export
  exportGpxSingle: (dbPath: string, recordIds: number[]): Promise<ExportResult[]> => {
    return ipcRenderer.invoke('export-gpx-single', dbPath, recordIds);
  },

  exportGpxMerged: (dbPath: string, recordIds: number[]): Promise<ExportResult> => {
    return ipcRenderer.invoke('export-gpx-merged', dbPath, recordIds);
  },

  // Settings
  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke('get-settings');
  },

  setSettings: (settings: AppSettings): Promise<void> => {
    return ipcRenderer.invoke('set-settings', settings);
  },

  selectOutputFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke('select-output-folder');
  },
});
