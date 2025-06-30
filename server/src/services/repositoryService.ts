import { Repository } from '../../../shared/types.js';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import os from 'os';

export class RepositoryService {
  private repositories: Map<string, Repository> = new Map();
  private configPath: string;
  private singleRepoMode: boolean = false;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), '.claude-code-crew', 'repositories.json');
  }

  async initialize(): Promise<void> {
    console.log('[RepositoryService] Starting initialization...');
    
    const envRepos = process.env.CC_REPOSITORIES;
    const workDir = process.env.WORK_DIR || process.cwd();
    
    console.log('[RepositoryService] Environment repos:', envRepos ? 'found' : 'not found');
    console.log('[RepositoryService] Work directory:', workDir);

    if (envRepos && envRepos.trim()) {
      // Multi-repository mode from environment
      try {
        console.log('[RepositoryService] Parsing environment repositories...');
        const repos = JSON.parse(envRepos);
        console.log('[RepositoryService] Parsed repositories:', Array.isArray(repos) ? repos.length : 0);
        
        if (Array.isArray(repos) && repos.length > 0) {
          repos.forEach((repo: Repository) => {
            this.repositories.set(repo.id, repo);
            console.log('[RepositoryService] Adding repository:', repo.name, repo.path);
          });
          console.log('[RepositoryService] Total repositories loaded:', this.repositories.size);
        } else {
          console.log('[RepositoryService] Empty repository array, creating default');
          this.createDefaultRepository(workDir);
        }
      } catch (error) {
        console.error('[RepositoryService] Failed to parse CC_REPOSITORIES:', error);
        this.createDefaultRepository(workDir);
      }
    } else {
      // Try to load from config file
      try {
        await this.loadFromConfig();
        if (this.repositories.size === 0) {
          this.createDefaultRepository(workDir);
        }
      } catch (error) {
        // Single repository mode (backward compatibility)
        this.createDefaultRepository(workDir);
      }
    }
    
    // Ensure we have at least one repository
    if (this.repositories.size === 0) {
      this.createDefaultRepository(workDir);
    }
    
    console.log('[RepositoryService] Initialization completed successfully');
  }

  private createDefaultRepository(workDir: string): void {
    this.singleRepoMode = true;
    const defaultRepo: Repository = {
      id: 'default',
      name: path.basename(workDir),
      path: workDir,
      description: 'Default repository',
      worktrees: []
    };
    this.repositories.set(defaultRepo.id, defaultRepo);
    console.log('[RepositoryService] Created default repository:', defaultRepo.name, 'at', defaultRepo.path);
  }

  private async loadFromConfig(): Promise<void> {
    const data = await fs.readFile(this.configPath, 'utf-8');
    const repos: Repository[] = JSON.parse(data);
    repos.forEach(repo => {
      this.repositories.set(repo.id, repo);
    });
  }

  private async saveToConfig(): Promise<void> {
    if (this.singleRepoMode) return; // Don't save in single repo mode
    
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.configPath,
      JSON.stringify(Array.from(this.repositories.values()), null, 2)
    );
  }

  async addRepository(name: string, repoPath: string, description?: string): Promise<Repository> {
    const id = uuidv4();
    const repository: Repository = {
      id,
      name,
      path: repoPath,
      description,
      worktrees: []
    };
    
    this.repositories.set(id, repository);
    await this.saveToConfig();
    
    return repository;
  }

  async updateRepository(id: string, updates: Partial<Repository>): Promise<Repository | null> {
    const repository = this.repositories.get(id);
    if (!repository) return null;
    
    const updated = { ...repository, ...updates, id }; // Ensure ID can't be changed
    this.repositories.set(id, updated);
    await this.saveToConfig();
    
    return updated;
  }

  async deleteRepository(id: string): Promise<boolean> {
    if (this.singleRepoMode && id === 'default') {
      throw new Error('Cannot delete default repository in single-repo mode');
    }
    
    const deleted = this.repositories.delete(id);
    if (deleted) {
      await this.saveToConfig();
    }
    return deleted;
  }

  getRepository(id: string): Repository | undefined {
    return this.repositories.get(id);
  }

  getAllRepositories(): Repository[] {
    return Array.from(this.repositories.values());
  }

  isValidRepository(id: string): boolean {
    return this.repositories.has(id);
  }

  getDefaultRepositoryId(): string | undefined {
    if (this.singleRepoMode) return 'default';
    return this.repositories.size > 0 ? this.repositories.keys().next().value : undefined;
  }

  async cloneRepository(url: string, name?: string, description?: string, targetPath?: string): Promise<Repository> {
    // URLからリポジトリ名を抽出
    const repoNameMatch = url.match(/\/([^\/]+?)(\.git)?$/);
    const defaultRepoName = repoNameMatch ? repoNameMatch[1] : 'cloned-repo';
    const finalName = name || defaultRepoName;

    // クローン先のパスを決定
    const defaultClonePath = path.join(os.homedir(), '.claude-code-crew', 'repositories');
    const cloneBasePath = targetPath || defaultClonePath;
    const clonePath = path.join(cloneBasePath, finalName);

    try {
      // クローン先ディレクトリを作成
      await fs.mkdir(cloneBasePath, { recursive: true });

      // 既に同じパスが存在する場合はエラー
      try {
        await fs.access(clonePath);
        throw new Error(`ディレクトリが既に存在します: ${clonePath}`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // Git クローンを実行
      console.log(`[RepositoryService] Cloning repository from ${url} to ${clonePath}`);
      execSync(`git clone "${url}" "${clonePath}"`, {
        stdio: 'pipe',
        encoding: 'utf-8'
      });

      // リポジトリを追加
      const repository = await this.addRepository(
        finalName,
        clonePath,
        description || `Cloned from ${url}`
      );

      console.log(`[RepositoryService] Successfully cloned repository: ${finalName}`);
      return repository;
    } catch (error: any) {
      // クローンに失敗した場合、作成されたディレクトリを削除
      try {
        await fs.rm(clonePath, { recursive: true, force: true });
      } catch (cleanupError) {
        // クリーンアップエラーは無視
      }

      console.error(`[RepositoryService] Failed to clone repository:`, error);
      throw new Error(`リポジトリのクローンに失敗しました: ${error.message}`);
    }
  }

  validateGitUrl(url: string): boolean {
    // GitHub/GitLab SSH URLパターン（組織名やユーザー名に使用可能な文字を拡張）
    const sshPattern = /^git@(github\.com|gitlab\.com):([\w.-]+)\/([\w.-]+)\.git$/;
    
    // GitHub/GitLab HTTPS URLパターン
    const httpsPattern = /^https?:\/\/(github\.com|gitlab\.com)\/([\w.-]+)\/([\w.-]+)(?:\.git)?$/;
    
    return sshPattern.test(url) || httpsPattern.test(url);
  }
}