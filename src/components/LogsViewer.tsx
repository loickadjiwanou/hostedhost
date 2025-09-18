import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, Download, Filter, Search, Clock, User, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LogEntry {
  timestamp: string;
  userId: string;
  level: string;
  action: string;
  details: string;
  raw: string;
}

const LogsViewer = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { token } = useAuth();

  const parseLogs = (rawLogs: string[]): LogEntry[] => {
    return rawLogs.map(log => {
      // Format: [TIMESTAMP] [USER_ID] LEVEL ACTION - DETAILS
      const match = log.match(/^\[(.*?)\] \[(.*?)\] (\w+) (.*?) - (.*)$/);
      if (match) {
        return {
          timestamp: match[1],
          userId: match[2],
          level: match[3],
          action: match[4],
          details: match[5],
          raw: log
        };
      }
      return {
        timestamp: '',
        userId: '',
        level: 'INFO',
        action: 'Unknown',
        details: log,
        raw: log
      };
    }).reverse(); // Newest first
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/hosting/logs?limit=100', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const parsedLogs = parseLogs(data.logs);
        setLogs(parsedLogs);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'errors' && log.level !== 'ERROR') return false;
    if (filter === 'warnings' && log.level !== 'WARN') return false;
    if (filter === 'deployments' && !log.action.includes('DEPLOY')) return false;
    if (search && !log.raw.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'WARN':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'INFO':
        return <Info className="w-4 h-4 text-blue-500" />;
      case 'DEBUG':
        return <CheckCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'WARN':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'INFO':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'DEBUG':
        return 'bg-gray-50 border-gray-200 text-gray-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  const downloadLogs = () => {
    const logText = filteredLogs.map(log => log.raw).join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `host-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Logs du Système</h2>
          <p className="text-gray-600 mt-1">
            Activité en temps réel de la plateforme d'hébergement
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
          <button
            onClick={downloadLogs}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Télécharger</span>
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les logs</option>
                <option value="errors">Erreurs seulement</option>
                <option value="warnings">Avertissements</option>
                <option value="deployments">Déploiements</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Rechercher dans les logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
            </div>
          </div>

          <div className="text-sm text-gray-500">
            <span className="font-medium">{filteredLogs.length}</span> entrée{filteredLogs.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-500 mb-2">Aucun log</h4>
            <p className="text-gray-400">
              {search || filter !== 'all' 
                ? 'Aucun log ne correspond aux critères de recherche'
                : 'Aucune activité récente à afficher'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLogs.map((log, index) => (
              <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 pt-1">
                    {getLevelIcon(log.level)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getLevelColor(log.level)}`}>
                        {log.level}
                      </span>
                      
                      {log.userId !== 'SYSTEM' && (
                        <span className="flex items-center space-x-1 text-sm text-gray-600">
                          <User className="w-3 h-3" />
                          <span>{log.userId}</span>
                        </span>
                      )}
                      
                      <span className="flex items-center space-x-1 text-sm text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimestamp(log.timestamp)}</span>
                      </span>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="font-medium text-gray-900 text-sm">
                        {log.action}
                      </p>
                      {log.details && (
                        <p className="text-sm text-gray-600">
                          {log.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Erreurs</p>
              <p className="text-2xl font-bold text-red-600">
                {logs.filter(l => l.level === 'ERROR').length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avertissements</p>
              <p className="text-2xl font-bold text-yellow-600">
                {logs.filter(l => l.level === 'WARN').length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Déploiements</p>
              <p className="text-2xl font-bold text-green-600">
                {logs.filter(l => l.action.includes('DEPLOY')).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogsViewer;