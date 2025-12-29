import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { store } from './store';
import { loadRecordsFromDb, loadTracksFromDb } from './database';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'OceaGPX',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('select-db-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('load-records', async (_event, dbPath: string) => {
  try {
    const records = loadRecordsFromDb(dbPath);
    return records;
  } catch (error) {
    console.error('Failed to load records:', error);
    throw error;
  }
});

ipcMain.handle('load-tracks', async (_event, dbPath: string, recordIds: number[]) => {
  try {
    const tracks = loadTracksFromDb(dbPath, recordIds);
    return tracks;
  } catch (error) {
    console.error('Failed to load tracks:', error);
    throw error;
  }
});

ipcMain.handle('get-last-db-path', () => {
  return store.get('lastDbPath') as string || null;
});

ipcMain.handle('set-last-db-path', (_event, dbPath: string) => {
  store.set('lastDbPath', dbPath);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
