import React, { useState, useEffect } from 'react';
import { Server, Cpu, HardDrive, Wifi, Clock, Database, RefreshCw, AlertCircle, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SystemInfo {
  usedPorts: number[];
  availablePorts: string;
  uptime: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  nodeVersion: string;
}

const SystemInfo = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  const fetchSystemInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/hosting/system/info', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSystemInfo(data.system);
      }
    } catch (error) {
      console.error('Failed to fetch system info:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemInfo();
    const interval = setInterval(fetchSystemInfo, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [token]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}j ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMemoryUsagePercentage = () => {
    if (!systemInfo) return 0;
    return ((systemInfo.memoryUsage.heapUsed / systemInfo.memoryUsage.heapTotal) * 100).toFixed(1);
  };

  const getSystemStatus = () => {
    if (!systemInfo) return 'unknown';
    const memoryPercent = parseFloat(getMemoryUsagePercentage());
    if (memoryPercent > 80) return 'warning';
    if (systemInfo.usedPorts.length > 5) return 'busy';
    return 'healthy';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'busy':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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
          <h2 className="text-2xl font-bold text-gray-900">Informations Système</h2>
          <p className="text-gray-600 mt-1">
            État et performance de la plateforme d'hébergement
          </p>
        </div>
        <button
          onClick={fetchSystemInfo}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">État du Système</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(getSystemStatus())}`}>
            {getSystemStatus() === 'healthy' && 'Système opérationnel'}
            {getSystemStatus() === 'warning' && 'Attention requise'}
            {getSystemStatus() === 'busy' && 'Système chargé'}
            {getSystemStatus() === 'unknown' && 'État inconnu'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-3 mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <h4 className="font-medium text-gray-900">Temps de fonctionnement</h4>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {systemInfo ? formatUptime(systemInfo.uptime) : 'N/A'}
            </p>
            <p className="text-sm text-gray-600 mt-1">Depuis le dernier redémarrage</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-3 mb-2">
              <Server className="w-5 h-5 text-green-600" />
              <h4 className="font-medium text-gray-900">Version Node.js</h4>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {systemInfo?.nodeVersion || 'N/A'}
            </p>
            <p className="text-sm text-gray-600 mt-1">Runtime JavaScript</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-3 mb-2">
              <Wifi className="w-5 h-5 text-purple-600" />
              <h4 className="font-medium text-gray-900">Ports utilisés</h4>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {systemInfo?.usedPorts.length || 0}
            </p>
            <p className="text-sm text-gray-600 mt-1">Sites dynamiques actifs</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-3 mb-2">
              <Activity className="w-5 h-5 text-orange-600" />
              <h4 className="font-medium text-gray-900">Utilisation mémoire</h4>
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {getMemoryUsagePercentage()}%
            </p>
            <p className="text-sm text-gray-600 mt-1">Heap JavaScript utilisé</p>
          </div>
        </div>
      </div>

      {/* Memory Details */}
      {systemInfo && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <HardDrive className="w-5 h-5 mr-2" />
            Détails Mémoire
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-1">RSS (Resident Set Size)</h4>
              <p className="text-lg font-bold text-blue-900">
                {formatBytes(systemInfo.memoryUsage.rss)}
              </p>
              <p className="text-xs text-blue-600 mt-1">Mémoire physique totale</p>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-800 mb-1">Heap Total</h4>
              <p className="text-lg font-bold text-green-900">
                {formatBytes(systemInfo.memoryUsage.heapTotal)}
              </p>
              <p className="text-xs text-green-600 mt-1">Heap JavaScript alloué</p>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-800 mb-1">Heap Utilisé</h4>
              <p className="text-lg font-bold text-yellow-900">
                {formatBytes(systemInfo.memoryUsage.heapUsed)}
              </p>
              <p className="text-xs text-yellow-600 mt-1">Heap JavaScript actif</p>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-purple-800 mb-1">Externe</h4>
              <p className="text-lg font-bold text-purple-900">
                {formatBytes(systemInfo.memoryUsage.external)}
              </p>
              <p className="text-xs text-purple-600 mt-1">Objets C++ liés</p>
            </div>
          </div>

          {/* Memory Usage Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Utilisation du Heap</span>
              <span className="text-sm text-gray-600">
                {formatBytes(systemInfo.memoryUsage.heapUsed)} / {formatBytes(systemInfo.memoryUsage.heapTotal)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${getMemoryUsagePercentage()}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Port Management */}
      {systemInfo && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Wifi className="w-5 h-5 mr-2" />
            Gestion des Ports
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Ports Utilisés</h4>
              {systemInfo.usedPorts.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucun port utilisé actuellement</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {systemInfo.usedPorts.map(port => (
                    <div
                      key={port}
                      className="bg-red-100 text-red-800 text-center py-2 px-3 rounded-lg text-sm font-medium"
                    >
                      {port}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">Plage Disponible</h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <Database className="w-6 h-6 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">{systemInfo.availablePorts}</p>
                    <p className="text-sm text-gray-600">Ports disponibles pour les sites dynamiques</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {systemInfo.usedPorts.length > 5 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">Charge Élevée</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    De nombreux ports sont utilisés. Considérez arrêter les sites non utilisés pour libérer des ressources.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemInfo;