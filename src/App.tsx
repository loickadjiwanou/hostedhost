import React, { useState, useEffect } from 'react';
import { User, LogOut, Server, Globe, Database, Settings, Activity, Upload, FolderOpen, BarChart3 } from 'lucide-react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProjectManager from './components/ProjectManager';
import DeploymentPanel from './components/DeploymentPanel';
import LogsViewer from './components/LogsViewer';
import SystemInfo from './components/SystemInfo';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProjectProvider } from './contexts/ProjectContext';
import toast, { Toaster } from 'react-hot-toast';

const AppContent = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
    { id: 'deploy', label: 'Déploiement', icon: Upload },
    { id: 'projects', label: 'Mes projets', icon: FolderOpen },
    { id: 'logs', label: 'Logs', icon: Activity },
    { id: 'system', label: 'Système', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    toast.success('Déconnexion réussie');
  };

  if (!user) {
    return <Login />;
  }

  return (
    <ProjectProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Server className="w-8 h-8 text-blue-600" />
                  <h1 className="text-xl font-bold text-gray-900">Mini-Hébergeur</h1>
                </div>
                <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
                  <Globe className="w-4 h-4" />
                  <span>Plateforme d'hébergement web</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-gray-700">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{user.username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Déconnexion</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-3 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'deploy' && <DeploymentPanel />}
          {activeTab === 'projects' && <ProjectManager />}
          {activeTab === 'logs' && <LogsViewer />}
          {activeTab === 'system' && <SystemInfo />}
        </main>

        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#4ade80',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </div>
    </ProjectProvider>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;