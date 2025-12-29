import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { AppSettings } from '../../shared/types';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
  const [settings, setSettings] = useState<AppSettings>({
    defaultOutputPath: '',
    confirmOnExport: true,
    maxPoints: 50000,
  });
  const [loading, setLoading] = useState(false);

  // Load settings when dialog opens
  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const loaded = await window.electronAPI.getSettings();
      setSettings(loaded);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    const path = await window.electronAPI.selectOutputFolder();
    if (path) {
      setSettings({ ...settings, defaultOutputPath: path });
    }
  };

  const handleSave = async () => {
    try {
      await window.electronAPI.setSettings(settings);
      onClose();
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>設定</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          {/* Default Output Path */}
          <Typography variant="subtitle2" gutterBottom>
            デフォルト出力先フォルダ
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
            <TextField
              size="small"
              fullWidth
              value={settings.defaultOutputPath}
              placeholder="未設定（毎回選択）"
              InputProps={{ readOnly: true }}
              disabled={loading}
            />
            <IconButton onClick={handleSelectFolder} disabled={loading}>
              <FolderOpenIcon />
            </IconButton>
          </Box>

          {/* Confirm on Export */}
          <FormControlLabel
            control={
              <Checkbox
                checked={settings.confirmOnExport}
                onChange={(e) =>
                  setSettings({ ...settings, confirmOnExport: e.target.checked })
                }
                disabled={loading}
              />
            }
            label="出力時に毎回保存先を確認する"
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4, mb: 3 }}>
            オフにすると、デフォルト出力先に自動で保存されます
          </Typography>

          {/* Max Points */}
          <Typography variant="subtitle2" gutterBottom>
            最大ポイント数（GPXファイルあたり）
          </Typography>
          <TextField
            size="small"
            type="number"
            value={settings.maxPoints}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              setSettings({ ...settings, maxPoints: isNaN(value) ? 0 : value });
            }}
            inputProps={{ min: 0 }}
            sx={{ width: 150 }}
            disabled={loading}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Lightroom Classicは50,000ポイントまで対応。0で無制限。
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsDialog;
