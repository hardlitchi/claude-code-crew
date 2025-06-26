import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { Worktree, Repository } from '../../../shared/types.js';
import { RepositoryService } from './repositoryService.js';

export class WorktreeService {
  private repositoryService: RepositoryService;

  constructor(repositoryService: RepositoryService) {
    this.repositoryService = repositoryService;
  }

  private getRepositoryPath(repositoryId?: string): string {
    if (!repositoryId) {
      const defaultId = this.repositoryService.getDefaultRepositoryId();
      if (!defaultId) {
        throw new Error('No repositories configured');
      }
      repositoryId = defaultId;
    }

    const repository = this.repositoryService.getRepository(repositoryId);
    if (!repository) {
      throw new Error(`Repository ${repositoryId} not found`);
    }

    return repository.path;
  }

  getWorktrees(repositoryId?: string): Worktree[] {
    try {
      const rootPath = this.getRepositoryPath(repositoryId);
      const output = execSync('git worktree list --porcelain', {
        cwd: rootPath,
        encoding: 'utf8',
      });

      const worktrees: Worktree[] = [];
      const lines = output.trim().split('\n');

      let currentWorktree: Partial<Worktree> = {};

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          if (currentWorktree.path) {
            worktrees.push(currentWorktree as Worktree);
          }
          currentWorktree = {
            path: line.substring(9),
            isMain: false,
            isCurrent: false,
          };
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line.substring(7);
        } else if (line === 'bare') {
          currentWorktree.isMain = true;
        }
      }

      if (currentWorktree.path) {
        worktrees.push(currentWorktree as Worktree);
      }

      // Mark the first worktree as main if none are marked
      if (worktrees.length > 0 && !worktrees.some(w => w.isMain)) {
        worktrees[0]!.isMain = true;
      }

      // Mark current worktree
      const currentPath = rootPath;
      worktrees.forEach(w => {
        w.isCurrent = w.path === currentPath;
        w.repositoryId = repositoryId || this.repositoryService.getDefaultRepositoryId() || '';
      });

      return worktrees;
    } catch (_error) {
      // If git worktree command fails, assume we're in a regular git repo
      const rootPath = this.getRepositoryPath(repositoryId);
      return [
        {
          path: rootPath,
          branch: this.getCurrentBranch(repositoryId),
          isMain: true,
          isCurrent: true,
          repositoryId: repositoryId || this.repositoryService.getDefaultRepositoryId() || '',
        },
      ];
    }
  }

  private getCurrentBranch(repositoryId?: string): string {
    try {
      const rootPath = this.getRepositoryPath(repositoryId);
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: rootPath,
        encoding: 'utf8',
      }).trim();
      return branch;
    } catch {
      return 'unknown';
    }
  }

  isGitRepository(repositoryId?: string): boolean {
    const rootPath = this.getRepositoryPath(repositoryId);
    return existsSync(path.join(rootPath, '.git'));
  }

  hasCommits(repositoryId?: string): boolean {
    try {
      const rootPath = this.getRepositoryPath(repositoryId);
      execSync('git rev-parse HEAD', {
        cwd: rootPath,
        encoding: 'utf8',
        stdio: 'pipe',
      });
      return true;
    } catch {
      return false;
    }
  }

  createWorktree(
    worktreePath: string,
    branch: string,
    repositoryId?: string,
  ): { success: boolean; error?: string } {
    try {
      const rootPath = this.getRepositoryPath(repositoryId);
      // Convert relative path to absolute path
      const absolutePath = path.isAbsolute(worktreePath)
        ? worktreePath
        : path.join(rootPath, worktreePath);

      // Check if path already exists
      if (existsSync(absolutePath)) {
        return {
          success: false,
          error: 'Path already exists',
        };
      }

      // Check if branch exists
      let branchExists = false;
      try {
        execSync(`git rev-parse --verify "${branch}"`, {
          cwd: rootPath,
          encoding: 'utf8',
          stdio: 'pipe', // Suppress error output
        });
        branchExists = true;
      } catch {
        // Branch doesn't exist
      }

      // Create the worktree
      const command = branchExists
        ? `git worktree add "${absolutePath}" "${branch}"`
        : `git worktree add -b "${branch}" "${absolutePath}"`;

      execSync(command, {
        cwd: rootPath,
        encoding: 'utf8',
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create worktree',
      };
    }
  }

  deleteWorktree(worktreePath: string, repositoryId?: string): { success: boolean; error?: string } {
    try {
      const worktrees = this.getWorktrees(repositoryId);
      const rootPath = this.getRepositoryPath(repositoryId);
      const worktree = worktrees.find(wt => wt.path === worktreePath);

      if (!worktree) {
        return {
          success: false,
          error: 'Worktree not found',
        };
      }

      if (worktree.isMain) {
        return {
          success: false,
          error: 'Cannot delete the main worktree',
        };
      }

      // Remove the worktree
      execSync(`git worktree remove "${worktreePath}" --force`, {
        cwd: rootPath,
        encoding: 'utf8',
      });

      // Delete the branch if it exists
      const branchName = worktree.branch.replace('refs/heads/', '');
      try {
        execSync(`git branch -D "${branchName}"`, {
          cwd: rootPath,
          encoding: 'utf8',
        });
      } catch {
        // Branch might not exist or might be checked out elsewhere
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete worktree',
      };
    }
  }

  mergeWorktree(
    sourceBranch: string,
    targetBranch: string,
    useRebase: boolean = false,
    repositoryId?: string,
  ): { success: boolean; error?: string } {
    try {
      const worktrees = this.getWorktrees(repositoryId);
      const targetWorktree = worktrees.find(
        wt => wt.branch.replace('refs/heads/', '') === targetBranch,
      );

      if (!targetWorktree) {
        return {
          success: false,
          error: 'Target branch worktree not found',
        };
      }

      if (useRebase) {
        const sourceWorktree = worktrees.find(
          wt => wt.branch.replace('refs/heads/', '') === sourceBranch,
        );

        if (!sourceWorktree) {
          return {
            success: false,
            error: 'Source branch worktree not found',
          };
        }

        execSync(`git rebase "${targetBranch}"`, {
          cwd: sourceWorktree.path,
          encoding: 'utf8',
        });
      } else {
        execSync(`git merge --no-ff "${sourceBranch}"`, {
          cwd: targetWorktree.path,
          encoding: 'utf8',
        });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : useRebase
              ? 'Failed to rebase branches'
              : 'Failed to merge branches',
      };
    }
  }

  deleteWorktreeByBranch(branch: string, repositoryId?: string): { success: boolean; error?: string } {
    try {
      const worktrees = this.getWorktrees(repositoryId);
      const worktree = worktrees.find(
        wt => wt.branch.replace('refs/heads/', '') === branch,
      );

      if (!worktree) {
        return {
          success: false,
          error: 'Worktree not found for branch',
        };
      }

      return this.deleteWorktree(worktree.path, repositoryId);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete worktree by branch',
      };
    }
  }
}