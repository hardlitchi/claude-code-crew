-- セッション永続化のためのスキーマ定義

-- セッションメタデータテーブル
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    persistent_id TEXT NOT NULL UNIQUE,
    repository_id TEXT NOT NULL,
    worktree_path TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'idle',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT DEFAULT '{}', -- JSON形式のメタデータ
    is_active INTEGER DEFAULT 1,
    UNIQUE(repository_id, worktree_path)
);

-- セッション履歴テーブル（出力履歴を保存）
CREATE TABLE IF NOT EXISTS session_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    output_data BLOB NOT NULL, -- バイナリデータとして保存
    sequence_number INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- セッション環境変数テーブル
CREATE TABLE IF NOT EXISTS session_env (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    UNIQUE(session_id, key)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_sessions_persistent_id ON sessions(persistent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_repo_worktree ON sessions(repository_id, worktree_path);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_session_history_session_id ON session_history(session_id);
CREATE INDEX IF NOT EXISTS idx_session_history_sequence ON session_history(session_id, sequence_number);