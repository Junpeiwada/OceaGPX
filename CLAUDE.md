# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

OceaGPXは、OceanPlotアプリのSQLiteデータベースから航跡データを読み込み、GPXファイルとして出力するmacOS向けElectronアプリケーション。出力したGPXはLightroom Classicで写真のジオタグ付与に使用する。

## 開発コマンド

```bash
# 開発モード（ホットリロード付き）
npm run dev

# プロダクションビルド
npm run build

# ビルド後に実行
npm start

# 配布パッケージ作成
npm run dist

# コード品質チェック
npm run lint
npm run typecheck

# better-sqlite3の再ビルド（Electronバージョン変更時）
npm run rebuild
```

## アーキテクチャ

### ディレクトリ構成

```
src/
├── main/          # メインプロセス（Node.js環境）
│   ├── main.ts      # Electronエントリーポイント、IPC ハンドラ
│   ├── database.ts  # SQLiteデータベース操作（better-sqlite3）
│   ├── store.ts     # 設定永続化（electron-store）
│   └── gpx.ts       # GPXファイル生成
├── renderer/      # レンダラープロセス（React UI）
│   ├── App.tsx      # メインUIコンポーネント
│   └── components/  # UIコンポーネント
├── preload/       # プリロードスクリプト
│   └── preload.ts   # IPC API公開（contextBridge）
└── shared/        # 共有型定義
    └── types.ts     # RecordData, TrackData, AppSettings等
```

### プロセス間通信（IPC）

レンダラーからメインへの通信は`preload.ts`で公開された`window.electronAPI`経由で行う。新しいIPCチャンネルを追加する場合:

1. `main.ts`に`ipcMain.handle()`を追加
2. `preload.ts`に対応するメソッドを追加
3. `shared/types.ts`の`ElectronAPI`インターフェースを更新

### データベース

OceanPlotのSQLiteデータベースを読み取り専用で使用。スキーマ詳細は`Docs/db.dbml`を参照。

主要テーブル:
- `LCHFIL`: 記録ヘッダ（記録名、開始・終了時刻、航行距離）
- `LOCFIL`: GPS位置データ（時刻、緯度、経度、速度）

### GPX出力

**重要**: 時刻フォーマットはUTC変換してISO 8601形式（`...Z`付き）で出力。Lightroom Classicとの互換性のため。

## 技術スタック

- **フレームワーク**: Electron 28 + TypeScript
- **UI**: React 18 + MUI (Material UI) + MUI X DataGrid
- **地図**: Leaflet + React-Leaflet
- **データベース**: better-sqlite3
- **ビルド**: Webpack
- **配布**: electron-builder

## Gitコミット

コミットメッセージにCo-Authored-Byを付けない。シンプルなコミットメッセージのみ使用する。

## 実装フェーズ

実装計画の詳細は`Docs/impl.md`を参照。各フェーズ完了後にユーザー確認を行う。
