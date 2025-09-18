import React, { useState } from 'react';
import { 
  Globe, 
  Server, 
  Database, 
  ExternalLink, 
  Trash2, 
  Clock, 
  HardDrive,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { useProjects } from '../contexts/ProjectContext';
import toast from 'react-hot-toast';

const ProjectManager = () => {
  const { projects, loading, deleteProject } = useProjects();
  const [deletingProject, setDeletingProject] = useState<string | null>(null);

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le projet "${projectName}" ?`)) {
      return;
    }

    setDeletingProject(projectId);
    try {
      await deleteProject(projectId);
      toast.success('Projet supprimé avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    } finally {
      setDeletingProject(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'deployed':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'deployed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatSize = (size: number) => {
    return `${size} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Mes Projets</h2>
          <p className="text-gray-600 mt-1">
            Gérez tous vos sites web hébergés
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            <span className="font-medium">{projects.length}</span> projet{projects.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100">
          <div className="text-center">
            <Server className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-2">
              Aucun projet
            </h3>
            <p className="text-gray-400 mb-6">
              Commencez par déployer votre premier site web
            </p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Déployer un projet
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all"
            >
              {/* Project Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${
                    project.type === 'static' 
                      ? 'bg-green-100' 
                      : 'bg-purple-100'
                  }`}>
                    {project.type === 'static' ? (
                      <Globe className="w-6 h-6 text-green-600" />
                    ) : (
                      <Server className="w-6 h-6 text-purple-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg mb-1">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {project.description || 'Aucune description'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(project.status)}`}>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(project.status)}
                      <span>{project.status}</span>
                    </div>
                  </span>
                </div>
              </div>

              {/* Project Details */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Type:</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {project.type === 'static' ? 'Site statique' : 'Site dynamique'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Taille:</span>
                  <span className="font-medium text-gray-900 flex items-center">
                    <HardDrive className="w-4 h-4 mr-1" />
                    {formatSize(project.size)}
                  </span>
                </div>

                {project.port && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Port:</span>
                    <span className="font-medium text-gray-900">
                      {project.port}
                    </span>
                  </div>
                )}

                {project.usesMongoDB && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Base de données:</span>
                    <span className="font-medium text-gray-900 flex items-center">
                      <Database className="w-4 h-4 mr-1 text-green-600" />
                      MongoDB
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Créé:</span>
                  <span className="font-medium text-gray-900 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatDate(project.createdAt)}
                  </span>
                </div>
              </div>

              {/* Warning for static sites without index.html */}
              {project.type === 'static' && project.hasIndexHtml === false && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-yellow-800 font-medium">Attention</p>
                      <p className="text-yellow-700">
                        Aucun fichier index.html détecté. Le site pourrait ne pas s'afficher correctement.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Voir le site</span>
                </a>

                <button
                  onClick={() => handleDeleteProject(project.id, project.name)}
                  disabled={deletingProject === project.id}
                  className="flex items-center space-x-2 text-red-600 hover:text-red-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingProject === project.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Suppression...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Supprimer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectManager;