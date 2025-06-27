export type SessionState = 'idle' | 'busy' | 'waiting_input';

export interface Session {
  id: string;
  persistentId?: string; // 永続化用のID
  worktreePath: string;
  repositoryId: string;
  state: SessionState;
  lastActivity: Date;
  createdAt?: Date; // 作成日時
  updatedAt?: Date; // 更新日時
  metadata?: Record<string, any>; // カスタムメタデータ
}

export interface Worktree {
  path: string;
  branch: string;
  commit: string;
  isCurrentWorktree: boolean;
  isMainWorktree: boolean;
  repositoryId: string;
  session?: Session;
  sessionId?: string;
}

export interface Repository {
  id: string;
  name: string;
  path: string;
  description?: string;
  worktrees: Worktree[];
}

export interface CreateWorktreeRequest {
  path: string;
  branch: string;
  repositoryId: string;
}

export interface CreateWorktreeResponse {
  success: boolean;
  worktreePath?: string;
  message?: string;
}

export interface DeleteWorktreeRequest {
  paths: string[];
  repositoryId: string;
  force?: boolean;
}

export interface DeleteWorktreeResponse {
  success: boolean;
  message?: string;
}

export interface MergeWorktreeRequest {
  sourceBranch: string;
  targetBranch: string;
  deleteAfterMerge?: boolean;
  useRebase?: boolean;
  repositoryId: string;
}

export interface MergeWorktreeResponse {
  success: boolean;
  mergedBranch?: string;
  message?: string;
}

export interface SessionPersistenceData {
  persistentId: string;
  repositoryId: string;
  worktreePath: string;
  state: string;
  metadata: Record<string, any>;
  outputHistory?: string[]; // Base64エンコードされた出力履歴
  environment?: Record<string, string>; // 環境変数
}