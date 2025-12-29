import React, { useState, useEffect, useCallback } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Paper,
  Button,
  IconButton,
  TextField,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRowSelectionModel,
} from '@mui/x-data-grid';
import SettingsIcon from '@mui/icons-material/Settings';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveIcon from '@mui/icons-material/Save';
import MergeIcon from '@mui/icons-material/CallMerge';
import { RecordData, TrackData } from '../shared/types';
import MapPreview from './components/MapPreview';
import SettingsDialog from './components/SettingsDialog';

// Date formatter
const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// DataGrid columns
const columns: GridColDef[] = [
  {
    field: 'name',
    headerName: '記録名',
    flex: 1,
    minWidth: 150,
  },
  {
    field: 'startTime',
    headerName: '開始日時',
    width: 160,
    valueFormatter: (value: string) => formatDateTime(value),
  },
  {
    field: 'endTime',
    headerName: '終了日時',
    width: 160,
    valueFormatter: (value: string) => formatDateTime(value),
  },
  {
    field: 'distance',
    headerName: '航行距離',
    width: 100,
    valueFormatter: (value: number) => `${value?.toFixed(1) ?? 0} km`,
  },
  {
    field: 'pointCount',
    headerName: 'ポイント数',
    width: 100,
    type: 'number',
  },
];

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
}

const App: React.FC = () => {
  const [dbPath, setDbPath] = useState<string>('');
  const [records, setRecords] = useState<RecordData[]>([]);
  const [selectedIds, setSelectedIds] = useState<GridRowSelectionModel>({ type: 'include', ids: new Set() });
  const [filterText, setFilterText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [loadingTracks, setLoadingTracks] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'info' });
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  // Show snackbar message
  const showMessage = (message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // Load database
  const loadDatabase = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const data = await window.electronAPI.loadRecords(path);
      setRecords(data);
      setDbPath(path);
      await window.electronAPI.setLastDbPath(path);
      setSelectedIds({ type: 'include', ids: new Set() });
      setTracks([]);
    } catch (err) {
      showMessage(`データベースの読み込みに失敗しました: ${err}`, 'error');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load last DB path on mount
  useEffect(() => {
    const loadLastPath = async () => {
      const lastPath = await window.electronAPI.getLastDbPath();
      if (lastPath) {
        await loadDatabase(lastPath);
      }
    };
    loadLastPath();
  }, [loadDatabase]);

  // Load tracks when selection changes
  useEffect(() => {
    const loadTracks = async () => {
      const selectedIdArray = Array.from(selectedIds.ids) as number[];

      if (selectedIdArray.length === 0 || !dbPath) {
        setTracks([]);
        return;
      }

      setLoadingTracks(true);
      try {
        const trackData = await window.electronAPI.loadTracks(dbPath, selectedIdArray);
        setTracks(trackData);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to load tracks:', err);
        setTracks([]);
      } finally {
        setLoadingTracks(false);
      }
    };

    loadTracks();
  }, [selectedIds, dbPath]);

  // Handle file selection
  const handleSelectFile = async () => {
    const path = await window.electronAPI.selectDbFile();
    if (path) {
      await loadDatabase(path);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.db') || file.name.endsWith('.sqlite') || file.name.endsWith('.sqlite3')) {
        await loadDatabase(file.path);
      } else {
        showMessage('DBファイル（.db, .sqlite, .sqlite3）のみ対応しています', 'error');
      }
    }
  };

  // Handle select all / deselect all
  const handleSelectAll = () => {
    const filteredIds = filteredRecords.map((r) => r.id);
    setSelectedIds({ type: 'include', ids: new Set(filteredIds) });
  };

  const handleDeselectAll = () => {
    setSelectedIds({ type: 'include', ids: new Set() });
  };

  // Format thinning info message
  const formatThinningInfo = (info: { originalPoints: number; exportedPoints: number; intervalSeconds?: number }) => {
    const intervalText = info.intervalSeconds
      ? `（約${info.intervalSeconds}秒間隔）`
      : '';
    return `${info.originalPoints.toLocaleString()} → ${info.exportedPoints.toLocaleString()}ポイントに間引き${intervalText}`;
  };

  // Handle GPX export - single files
  const handleExportSingle = async () => {
    const selectedIdArray = Array.from(selectedIds.ids) as number[];
    if (selectedIdArray.length === 0 || !dbPath) return;

    setExporting(true);
    try {
      const results = await window.electronAPI.exportGpxSingle(dbPath, selectedIdArray);
      const successCount = results.filter(r => r.success).length;
      const cancelCount = results.filter(r => !r.success && r.error === 'キャンセルされました').length;
      const thinnedResults = results.filter(r => r.success && r.thinningInfo);

      if (successCount > 0) {
        let message = `${successCount}件のGPXファイルを出力しました`;
        if (thinnedResults.length > 0) {
          const info = thinnedResults[0].thinningInfo!;
          message += `\n${formatThinningInfo(info)}`;
        }
        showMessage(message, 'success');
      } else if (cancelCount === results.length) {
        showMessage('エクスポートがキャンセルされました', 'info');
      } else {
        showMessage('エクスポートに失敗しました', 'error');
      }
    } catch (err) {
      showMessage(`エクスポートに失敗しました: ${err}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  // Handle GPX export - merged file
  const handleExportMerged = async () => {
    const selectedIdArray = Array.from(selectedIds.ids) as number[];
    if (selectedIdArray.length === 0 || !dbPath) return;

    setExporting(true);
    try {
      const result = await window.electronAPI.exportGpxMerged(dbPath, selectedIdArray);
      if (result.success) {
        let message = `GPXファイルを出力しました`;
        if (result.thinningInfo) {
          message += `\n${formatThinningInfo(result.thinningInfo)}`;
        }
        showMessage(message, 'success');
      } else if (result.error === 'キャンセルされました') {
        showMessage('エクスポートがキャンセルされました', 'info');
      } else {
        showMessage(`エクスポートに失敗しました: ${result.error}`, 'error');
      }
    } catch (err) {
      showMessage(`エクスポートに失敗しました: ${err}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  // Filter records
  const filteredRecords = records.filter((r) =>
    r.name.toLowerCase().includes(filterText.toLowerCase())
  );

  const selectedCount = selectedIds.ids.size;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        ...(isDragOver && {
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            border: '3px dashed #1976d2',
            pointerEvents: 'none',
            zIndex: 9999,
          },
        }),
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            OceaGPX
          </Typography>
          <IconButton color="inherit" aria-label="settings" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2, overflow: 'hidden' }}>
        {/* DB File Selection */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1" sx={{ minWidth: 80 }}>
              DBファイル:
            </Typography>
            <Box
              sx={{
                flexGrow: 1,
                p: 1,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                backgroundColor: 'grey.50',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <Typography variant="body2" color={dbPath ? 'text.primary' : 'text.secondary'}>
                {dbPath || 'ファイルを選択またはドラッグ&ドロップしてください'}
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<FolderOpenIcon />}
              onClick={handleSelectFile}
            >
              選択...
            </Button>
          </Box>
        </Paper>

        {/* Content Area */}
        <Box sx={{ flexGrow: 1, display: 'flex', gap: 2, overflow: 'hidden' }}>
          {/* Record List */}
          <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Filter */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <TextField
                size="small"
                placeholder="記録名でフィルタ..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                fullWidth
              />
            </Box>

            {/* DataGrid */}
            <Box sx={{ flexGrow: 1, height: 0, minHeight: 200 }}>
              <DataGrid
                rows={filteredRecords}
                columns={columns}
                checkboxSelection
                disableRowSelectionOnClick
                rowSelectionModel={selectedIds}
                onRowSelectionModelChange={(newSelection) => setSelectedIds(newSelection)}
                loading={loading}
                initialState={{
                  sorting: {
                    sortModel: [{ field: 'startTime', sort: 'desc' }],
                  },
                }}
                sx={{
                  border: 'none',
                  '& .MuiDataGrid-cell': {
                    fontSize: '0.875rem',
                  },
                }}
              />
            </Box>
          </Paper>

          {/* Map Preview */}
          <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6">
                地図プレビュー
              </Typography>
              {loadingTracks && <CircularProgress size={20} />}
            </Box>
            <Box sx={{ flexGrow: 1, position: 'relative' }}>
              {selectedCount > 0 ? (
                <MapPreview tracks={tracks} />
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'grey.100',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    記録を選択すると航跡が表示されます
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Box>

        {/* Action Buttons */}
        <Paper sx={{ p: 2, mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" onClick={handleSelectAll} disabled={records.length === 0}>
                全選択
              </Button>
              <Button variant="outlined" onClick={handleDeselectAll} disabled={selectedCount === 0}>
                全解除
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2, alignSelf: 'center' }}>
                {selectedCount} / {filteredRecords.length} 件選択
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={exporting ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                onClick={handleExportSingle}
                disabled={selectedCount === 0 || exporting}
              >
                単一出力
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={exporting ? <CircularProgress size={20} color="inherit" /> : <MergeIcon />}
                onClick={handleExportMerged}
                disabled={selectedCount === 0 || exporting}
              >
                結合出力
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Box>
  );
};

export default App;
