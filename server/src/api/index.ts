import { Express } from 'express';
import { Server } from 'socket.io';
import { WorktreeService } from '../services/worktreeService.js';
import { SessionManager } from '../services/sessionManager.js';
import { RepositoryService } from '../services/repositoryService.js';
import { 
  CreateWorktreeRequest, 
  DeleteWorktreeRequest, 
  MergeWorktreeRequest,
  Worktree,
  Repository
} from '../../../shared/types.js';

export async function setupApiRoutes(app: Express, io: Server, sessionManager: SessionManager, repositoryService: RepositoryService) {
  console.log('[API] Setting up API routes...');
  console.log('[API] Using shared RepositoryService with repositories:', repositoryService.getAllRepositories().map(r => `${r.name} (${r.id})`));
  
  const worktreeService = new WorktreeService(repositoryService);
  console.log('[API] WorktreeService initialized');
  
  // Helper function to get worktrees with session info
  const getWorktreesWithSessions = (repositoryId?: string): Worktree[] => {
    const worktrees = worktreeService.getWorktrees(repositoryId);
    const sessions = sessionManager.getAllSessions();
    
    return worktrees.map(worktree => {
      const session = sessions.find(s => 
        s.worktreePath === worktree.path && 
        s.repositoryId === worktree.repositoryId
      );
      return {
        ...worktree,
        session: session || undefined,
      };
    });
  };

  // Get all repositories
  app.get('/api/repositories', (req, res) => {
    try {
      console.log('[API] GET /api/repositories called');
      const repositories = repositoryService.getAllRepositories();
      console.log('[API] Returning repositories:', repositories.map(r => `${r.name} (${r.id})`));
      res.json(repositories);
    } catch (error) {
      console.error('[API] Error in GET /api/repositories:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get repositories' 
      });
    }
  });

  // Get all worktrees
  app.get('/api/worktrees', (req, res) => {
    try {
      const repositoryId = req.query.repositoryId as string | undefined;
      console.log('[API] GET /api/worktrees called with repositoryId:', repositoryId);
      
      // Check if repository exists
      if (repositoryId && !repositoryService.isValidRepository(repositoryId)) {
        console.log('[API] Repository not found:', repositoryId);
        return res.status(400).json({ error: `Repository not found: ${repositoryId}` });
      }
      
      if (repositoryId && !worktreeService.isGitRepository(repositoryId)) {
        console.log('[API] Not a git repository:', repositoryId);
        return res.status(400).json({ error: 'Not a git repository' });
      }
      
      const worktrees = worktreeService.getWorktrees(repositoryId);
      console.log('[API] Found worktrees for repository', repositoryId, ':', worktrees.length, 'worktrees');
      res.json(worktrees);
    } catch (error) {
      console.error('[API] Error in GET /api/worktrees:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get worktrees' 
      });
    }
  });

  // Create a new worktree
  app.post('/api/worktrees', (req, res) => {
    try {
      const { path, branch, repositoryId } = req.body as CreateWorktreeRequest;
      
      if (!path || !branch) {
        return res.status(400).json({ error: 'Path and branch are required' });
      }

      // Check if repository has commits
      if (!worktreeService.hasCommits(repositoryId)) {
        return res.status(400).json({ 
          error: 'Repository has no commits. Please make at least one commit before creating worktrees.' 
        });
      }

      console.log(`Creating worktree: path="${path}", branch="${branch}", repositoryId="${repositoryId}"`);
      const result = worktreeService.createWorktree(path, branch, repositoryId);
      
      if (result.success) {
        // Emit worktree update event with session info
        const worktrees = getWorktreesWithSessions(repositoryId);
        io.emit('worktrees:updated', worktrees);
        // Also emit repository update
        io.emit('repositories:updated', repositoryService.getAllRepositories());
        res.json({ success: true });
      } else {
        console.error(`Failed to create worktree: ${result.error}`);
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create worktree' 
      });
    }
  });

  // Delete worktrees
  app.delete('/api/worktrees', (req, res) => {
    try {
      const { paths, repositoryId } = req.body as DeleteWorktreeRequest;
      
      if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return res.status(400).json({ error: 'Paths array is required' });
      }

      const errors: string[] = [];
      
      for (const path of paths) {
        const result = worktreeService.deleteWorktree(path, repositoryId);
        if (!result.success) {
          errors.push(`${path}: ${result.error}`);
        }
      }

      if (errors.length > 0) {
        res.status(400).json({ error: errors.join(', ') });
      } else {
        // Emit worktree update event with session info
        const worktrees = getWorktreesWithSessions(repositoryId);
        io.emit('worktrees:updated', worktrees);
        io.emit('repositories:updated', repositoryService.getAllRepositories());
        res.json({ success: true });
      }
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to delete worktrees' 
      });
    }
  });

  // Merge worktree
  app.post('/api/worktrees/merge', (req, res) => {
    try {
      const { 
        sourceBranch, 
        targetBranch, 
        deleteAfterMerge, 
        useRebase,
        repositoryId
      } = req.body as MergeWorktreeRequest;
      
      if (!sourceBranch || !targetBranch) {
        return res.status(400).json({ 
          error: 'Source branch and target branch are required' 
        });
      }

      const mergeResult = worktreeService.mergeWorktree(
        sourceBranch,
        targetBranch,
        useRebase,
        repositoryId
      );
      
      if (!mergeResult.success) {
        return res.status(400).json({ error: mergeResult.error });
      }

      if (deleteAfterMerge) {
        const deleteResult = worktreeService.deleteWorktreeByBranch(sourceBranch, repositoryId);
        if (!deleteResult.success) {
          return res.status(400).json({ 
            error: `Merge succeeded but failed to delete worktree: ${deleteResult.error}` 
          });
        }
      }

      // Emit worktree update event with session info
      const worktrees = getWorktreesWithSessions(repositoryId);
      console.log(`[Merge] Emitting worktrees:updated event with ${worktrees.length} worktrees`);
      io.emit('worktrees:updated', worktrees);
      io.emit('repositories:updated', repositoryService.getAllRepositories());
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to merge worktrees' 
      });
    }
  });

  // Add a new repository
  app.post('/api/repositories', async (req, res) => {
    try {
      const { name, path, description } = req.body;
      
      if (!name || !path) {
        return res.status(400).json({ error: 'Name and path are required' });
      }

      const repository = await repositoryService.addRepository(name, path, description);
      io.emit('repositories:updated', repositoryService.getAllRepositories());
      res.json(repository);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to add repository' 
      });
    }
  });

  // Update a repository
  app.put('/api/repositories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const repository = await repositoryService.updateRepository(id, updates);
      if (!repository) {
        return res.status(404).json({ error: 'Repository not found' });
      }
      
      io.emit('repositories:updated', repositoryService.getAllRepositories());
      res.json(repository);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update repository' 
      });
    }
  });

  // Delete a repository
  app.delete('/api/repositories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const deleted = await repositoryService.deleteRepository(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Repository not found' });
      }
      
      io.emit('repositories:updated', repositoryService.getAllRepositories());
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to delete repository' 
      });
    }
  });
}