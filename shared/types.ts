export type SessionState = 'idle' | 'busy' | 'waiting_input';

export interface Repository {
  id: string;
  name: string;
  path: string;
  description?: string;
}

export interface Session {
  id: string;
  worktreePath: string;
  repositoryId: string;
  state: SessionState;
  lastActivity: Date;
}

export interface Worktree {
  path: string;
  branch: string;
  isMain: boolean;
  isCurrent: boolean;
  repositoryId: string;
  session?: Session;
}

export interface CreateWorktreeRequest {
  path: string;
  branch: string;
  repositoryId?: string;
}

export interface DeleteWorktreeRequest {
  paths: string[];
  repositoryId?: string;
}

export interface MergeWorktreeRequest {
  sourceBranch: string;
  targetBranch: string;
  deleteAfterMerge: boolean;
  useRebase: boolean;
  repositoryId?: string;
}

export interface SocketEvents {
  // Client to Server
  'session:create': (data: { worktreePath: string; repositoryId?: string }) => void;
  'session:input': (data: { sessionId: string; input: string }) => void;
  'session:resize': (data: { sessionId: string; cols: number; rows: number }) => void;
  'session:destroy': (sessionId: string) => void;

  // Server to Client
  'session:created': (session: Session) => void;
  'session:output': (data: { sessionId: string; data: string }) => void;
  'session:stateChanged': (session: Session) => void;
  'session:destroyed': (sessionId: string) => void;
  'session:restore': (data: { sessionId: string; history: string }) => void;
  'worktrees:updated': (worktrees: Worktree[]) => void;
  'repositories:updated': (repositories: Repository[]) => void;
}