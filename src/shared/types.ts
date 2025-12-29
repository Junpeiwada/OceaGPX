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

// Electron API types exposed via preload
export interface ElectronAPI {
  platform: NodeJS.Platform;

  // DB operations
  selectDbFile: () => Promise<string | null>;
  loadRecords: (dbPath: string) => Promise<RecordData[]>;
  loadTracks: (dbPath: string, recordIds: number[]) => Promise<TrackData[]>;
  getLastDbPath: () => Promise<string | null>;
  setLastDbPath: (path: string) => Promise<void>;
}

// Extend Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
