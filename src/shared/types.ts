// Record data from LCHFIL table
export interface RecordData {
  id: number;           // LCHレコードID
  name: string;         // LCH記録名
  startTime: string;    // LCH開始時刻
  endTime: string;      // LCH終了時刻
  distance: number;     // LCH航行距離
  displayFlag: number;  // LCH表示F
  pointCount: number;   // LOCFILのポイント数
}

// Track point data from LOCFIL table
export interface TrackPoint {
  lat: number;          // LOC緯度
  lon: number;          // LOC経度
  time: string;         // LOC時刻
  speed: number;        // LOC速度
}

// Track data for a record
export interface TrackData {
  recordId: number;
  name: string;
  points: TrackPoint[];
}

// App settings
export interface AppSettings {
  defaultOutputPath: string;
  confirmOnExport: boolean;
  maxPoints: number;  // Maximum points per GPX file (0 = unlimited)
}

// Export result with thinning info
export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
  thinningInfo?: {
    originalPoints: number;
    exportedPoints: number;
    intervalSeconds?: number;  // Approximate interval in seconds
  };
}

// Electron API types exposed via preload
export interface ElectronAPI {
  platform: NodeJS.Platform;

  // DB operations
  selectDbFile: () => Promise<string | null>;
  loadRecords: (dbPath: string) => Promise<RecordData[]>;
  loadTracks: (dbPath: string, recordIds: number[]) => Promise<TrackData[]>;
  getLastDbPath: () => Promise<string | null>;
  setLastDbPath: (path: string) => Promise<void>;

  // GPX export
  exportGpxSingle: (dbPath: string, recordIds: number[]) => Promise<ExportResult[]>;
  exportGpxMerged: (dbPath: string, recordIds: number[]) => Promise<ExportResult>;

  // Settings
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: AppSettings) => Promise<void>;
  selectOutputFolder: () => Promise<string | null>;
}

// Extend Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
