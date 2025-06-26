import { Repository } from '../../../shared/types.js';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class RepositoryService {
  private repositories: Map<string, Repository> = new Map();
  private configPath: string;
  private singleRepoMode: boolean = false;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), '.claude-code-crew', 'repositories.json');
  }

  async initialize(): Promise<void> {
    const envRepos = process.env.CC_REPOSITORIES;
    const workDir = process.env.WORK_DIR || process.cwd();

    if (envRepos) {
      // Multi-repository mode from environment
      try {
        const repos = JSON.parse(envRepos);
        repos.forEach((repo: Repository) => {
          this.repositories.set(repo.id, repo);
        });
      } catch (error) {
        console.error('Failed to parse CC_REPOSITORIES:', error);
      }
    } else {
      // Try to load from config file
      try {
        await this.loadFromConfig();
      } catch (error) {
        // Single repository mode (backward compatibility)
        this.singleRepoMode = true;
        const defaultRepo: Repository = {
          id: 'default',
          name: path.basename(workDir),
          path: workDir,
          description: 'Default repository'
        };
        this.repositories.set(defaultRepo.id, defaultRepo);
      }
    }
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
      description
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
}