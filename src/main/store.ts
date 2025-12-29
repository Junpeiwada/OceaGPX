import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppSettings {
  defaultOutputPath: string;
  confirmOnExport: boolean;
  maxPoints: number;  // Maximum points per GPX file (0 = unlimited)
}

interface StoreData {
  lastDbPath: string;
  windowBounds: WindowBounds | null;
  settings: AppSettings;
}

const defaultData: StoreData = {
  lastDbPath: '',
  windowBounds: null,
  settings: {
    defaultOutputPath: '',
    confirmOnExport: true,
    maxPoints: 50000,
  },
};

class Store {
  private data: StoreData;
  private filePath: string;

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'config.json');
    this.data = this.load();
  }

  private load(): StoreData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const saved = JSON.parse(raw);
        // Deep merge for settings to preserve new default values
        return {
          ...defaultData,
          ...saved,
          settings: {
            ...defaultData.settings,
            ...(saved.settings || {}),
          },
        };
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load config:', err);
    }
    return { ...defaultData };
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to save config:', err);
    }
  }

  get<K extends keyof StoreData>(key: K): StoreData[K] {
    return this.data[key];
  }

  set<K extends keyof StoreData>(key: K, value: StoreData[K]): void {
    this.data[key] = value;
    this.save();
  }
}

export const store = new Store();
