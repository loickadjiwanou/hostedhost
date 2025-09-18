import React from 'react';
import { Globe, Server, Database, Activity, TrendingUp, Clock, HardDrive, Zap } from 'lucide-react';
import { useProjects } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { projects, stats, loading } = useProjects();
  const { user } = useAuth();

  const recentProjects = projects.slice(0, 5);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'deployed':
        return 'bg-blue-100 text-blue-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Bienvenue, {user?.username} ! 👋
        </h1>
        <p className="text-blue-100 mb-4">
          Gérez vos sites web hébergés depuis cette interface intuitive
        </p>
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>Membre depuis {new Date(user?.createdAt || '').toLocaleDateString()}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span>Plateforme active</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Projets</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.totalProjects || 0}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Limite: {stats?.maxProjects || 0}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sites Statiques</p>
              <p className="text-3xl font-bold text-green-600">
                {stats?.staticSites || 0}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Globe className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-green-600 mt-2 flex items-center">
            <TrendingUp className="w-3 h-3 mr-1" />
            HTML/CSS/JS
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sites Dynamiques</p>
              <p className="text-3xl font-bold text-purple-600">
                {stats?.dynamicSites || 0}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Server className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-purple-600 mt-2 flex items-center">
            <Database className="w-3 h-3 mr-1" />
            Full-stack
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stockage</p>
              <p className="text-3xl font-bold text-orange-600">
                {formatSize(stats?.storageUsed || 0)}
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <HardDrive className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            / {formatSize(stats?.maxStorage || 1000)}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Zap className="w-5 h-5 mr-2 text-yellow-500" />
          Actions Rapides
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 group-hover:bg-blue-200 p-2 rounded-lg transition-colors">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Déployer Site Statique</h4>
                <p className="text-sm text-gray-500">HTML, CSS, JS, React...</p>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer group">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 group-hover:bg-purple-200 p-2 rounded-lg transition-colors">
                <Server className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Déployer Site Dynamique</h4>
                <p className="text-sm text-gray-500">Frontend + Backend</p>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 hover:border-green-300 hover:shadow-md transition-all cursor-pointer group">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 group-hover:bg-green-200 p-2 rounded-lg transition-colors">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Voir les Logs</h4>
                <p className="text-sm text-gray-500">Activité en temps réel</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Projets Récents</h3>
        {recentProjects.length === 0 ? (
          <div className="text-center py-12">
            <Server className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-500 mb-2">Aucun projet</h4>
            <p className="text-gray-400 mb-4">
              Commencez par déployer votre premier site web
            </p>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Déployer maintenant
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {recentProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-lg ${
                    project.type === 'static' 
                      ? 'bg-green-100' 
                      : 'bg-purple-100'
                  }`}>
                    {project.type === 'static' ? (
                      <Globe className={`w-5 h-5 ${
                        project.type === 'static' 
                          ? 'text-green-600' 
                          : 'text-purple-600'
                      }`} />
                    ) : (
                      <Server className="w-5 h-5 text-purple-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{project.name}</h4>
                    <p className="text-sm text-gray-500">
                      {project.description || 'Aucune description'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatSize(project.size)}
                  </span>
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Voir →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;