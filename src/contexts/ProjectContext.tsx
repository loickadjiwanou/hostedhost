import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface Project {
  id: string;
  name: string;
  description: string;
  type: 'static' | 'dynamic';
  status: string;
  createdAt: string;
  updatedAt: string;
  size: number;
  url: string;
  port?: number;
  usesMongoDB?: boolean;
  hasIndexHtml?: boolean;
}

interface ProjectStats {
  totalProjects: number;
  staticSites: number;
  dynamicSites: number;
  totalSize: number;
  maxProjects: number;
  storageUsed: number;
  maxStorage: number;
}

interface ProjectContextType {
  projects: Project[];
  stats: ProjectStats | null;
  loading: boolean;
  refreshProjects: () => Promise<void>;
  refreshStats: () => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};

interface ProjectProviderProps {
  children: ReactNode;
}

const API_URL = 'http://localhost:5000/api';

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  const refreshProjects = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${API_URL}/projects`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const refreshStats = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${API_URL}/projects/stats/overview`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!token) return;
    
    const response = await fetch(`${API_URL}/projects/${projectId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Erreur lors de la suppression');
    }

    // Refresh projects after deletion
    await refreshProjects();
    await refreshStats();
  };

  useEffect(() => {
    if (token) {
      const loadData = async () => {
        setLoading(true);
        await Promise.all([refreshProjects(), refreshStats()]);
        setLoading(false);
      };
      loadData();
    } else {
      setProjects([]);
      setStats(null);
      setLoading(false);
    }
  }, [token]);

  const value = {
    projects,
    stats,
    loading,
    refreshProjects,
    refreshStats,
    deleteProject,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};