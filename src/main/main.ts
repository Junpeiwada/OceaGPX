import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { store, AppSettings } from './store';
import { loadRecordsFromDb, loadTracksFromDb } from './database';
import { generateGpx, generateSingleFilename, generateMergedFilename, thinPoints } from './gpx';
import { ExportResult } from '../shared/types';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow(): void {
  const savedBounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: savedBounds?.width ?? 1400,
    height: savedBounds?.height ?? 900,
    x: savedBounds?.x,
    y: savedBounds?.y,
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

  // Save window bounds on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', bounds);
    }
  });

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

// GPX Export - Single (each record as separate file)
ipcMain.handle('export-gpx-single', async (_event, dbPath: string, recordIds: number[]): Promise<ExportResult[]> => {
  const results: ExportResult[] = [];
  const settings = store.get('settings');

  // Load all tracks first
  const tracks = loadTracksFromDb(dbPath, recordIds);

  for (const track of tracks) {
    const defaultFilename = generateSingleFilename(track);

    let filePath: string;

    // If confirmOnExport is false and defaultOutputPath is set, auto-save
    if (!settings.confirmOnExport && settings.defaultOutputPath) {
      filePath = path.join(settings.defaultOutputPath, defaultFilename);
    } else {
      const defaultPath = settings.defaultOutputPath
        ? path.join(settings.defaultOutputPath, defaultFilename)
        : defaultFilename;

      const result = await dialog.showSaveDialog({
        title: `GPXを保存 - ${track.name}`,
        defaultPath: defaultPath,
        filters: [{ name: 'GPX Files', extensions: ['gpx'] }],
      });

      if (result.canceled || !result.filePath) {
        results.push({ success: false, error: 'キャンセルされました' });
        continue;
      }
      filePath = result.filePath;
    }

    try {
      // Apply thinning if maxPoints is set
      const thinningResult = thinPoints(track.points, settings.maxPoints);
      const thinnedTrack = { ...track, points: thinningResult.points };

      const gpxContent = generateGpx([thinnedTrack]);
      fs.writeFileSync(filePath, gpxContent, 'utf-8');

      results.push({
        success: true,
        filePath: filePath,
        thinningInfo: thinningResult.originalCount !== thinningResult.exportedCount
          ? {
              originalPoints: thinningResult.originalCount,
              exportedPoints: thinningResult.exportedCount,
              intervalSeconds: thinningResult.intervalSeconds,
            }
          : undefined,
      });
    } catch (error) {
      results.push({ success: false, error: String(error) });
    }
  }

  return results;
});

// GPX Export - Merged (all records in one file)
ipcMain.handle('export-gpx-merged', async (_event, dbPath: string, recordIds: number[]): Promise<ExportResult> => {
  const settings = store.get('settings');

  // Load all tracks
  const tracks = loadTracksFromDb(dbPath, recordIds);

  if (tracks.length === 0) {
    return { success: false, error: 'エクスポートする記録がありません' };
  }

  const defaultFilename = generateMergedFilename(tracks);

  let filePath: string;

  // If confirmOnExport is false and defaultOutputPath is set, auto-save
  if (!settings.confirmOnExport && settings.defaultOutputPath) {
    filePath = path.join(settings.defaultOutputPath, defaultFilename);
  } else {
    const defaultPath = settings.defaultOutputPath
      ? path.join(settings.defaultOutputPath, defaultFilename)
      : defaultFilename;

    const result = await dialog.showSaveDialog({
      title: 'GPXを保存（結合）',
      defaultPath: defaultPath,
      filters: [{ name: 'GPX Files', extensions: ['gpx'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'キャンセルされました' };
    }
    filePath = result.filePath;
  }

  try {
    // Calculate total points and apply thinning proportionally to each track
    const totalPoints = tracks.reduce((sum, t) => sum + t.points.length, 0);
    let originalTotal = totalPoints;
    let exportedTotal = 0;
    let avgIntervalSeconds: number | undefined;

    let thinnedTracks = tracks;

    if (settings.maxPoints > 0 && totalPoints > settings.maxPoints) {
      // Calculate thinning ratio
      const ratio = settings.maxPoints / totalPoints;

      thinnedTracks = tracks.map((track) => {
        const targetPoints = Math.max(2, Math.floor(track.points.length * ratio));
        const thinningResult = thinPoints(track.points, targetPoints);
        exportedTotal += thinningResult.exportedCount;
        return { ...track, points: thinningResult.points };
      });

      // Calculate average interval
      if (thinnedTracks.length > 0) {
        let totalSeconds = 0;
        let totalIntervals = 0;
        thinnedTracks.forEach((track) => {
          if (track.points.length >= 2) {
            const first = new Date(track.points[0].time).getTime();
            const last = new Date(track.points[track.points.length - 1].time).getTime();
            totalSeconds += (last - first) / 1000;
            totalIntervals += track.points.length - 1;
          }
        });
        if (totalIntervals > 0) {
          avgIntervalSeconds = Math.round(totalSeconds / totalIntervals);
        }
      }
    } else {
      exportedTotal = totalPoints;
    }

    const gpxContent = generateGpx(thinnedTracks);
    fs.writeFileSync(filePath, gpxContent, 'utf-8');

    return {
      success: true,
      filePath: filePath,
      thinningInfo: originalTotal !== exportedTotal
        ? {
            originalPoints: originalTotal,
            exportedPoints: exportedTotal,
            intervalSeconds: avgIntervalSeconds,
          }
        : undefined,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Settings handlers
ipcMain.handle('get-settings', (): AppSettings => {
  return store.get('settings');
});

ipcMain.handle('set-settings', (_event, settings: AppSettings): void => {
  store.set('settings', settings);
});

ipcMain.handle('select-output-folder', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'デフォルト出力先フォルダを選択',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
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
