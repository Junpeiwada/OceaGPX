import { app } from 'electron';
import fs from 'fs';
import path from 'path';

interface StoreData {
  lastDbPath: string;
}

const defaultData: StoreData = {
  lastDbPath: '',
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
        return { ...defaultData, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    }
    return { ...defaultData };
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (err) {
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
