import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Globe, 
  Server, 
  FileArchive, 
  AlertCircle, 
  CheckCircle, 
  Info,
  Database,
  Folder,
  Code
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectContext';
import toast from 'react-hot-toast';

const DeploymentPanel = () => {
  const [deploymentType, setDeploymentType] = useState<'static' | 'dynamic'>('static');
  const [formData, setFormData] = useState({
    projectName: '',
    description: '',
  });
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { token } = useAuth();
  const { refreshProjects, refreshStats } = useProjects();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleFileSelect = (file: File) => {
    if (file.type !== 'application/zip' && !file.name.endsWith('.zip')) {
      toast.error('Seuls les fichiers ZIP sont acceptés');
      return;
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB
      toast.error('Le fichier ne peut pas dépasser 100MB');
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast.error('Veuillez sélectionner un fichier ZIP');
      return;
    }

    if (!formData.projectName.trim()) {
      toast.error('Veuillez entrer un nom de projet');
      return;
    }

    setUploading(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('zipFile', selectedFile);
      uploadFormData.append('projectName', formData.projectName.trim());
      uploadFormData.append('description', formData.description.trim());

      const endpoint = deploymentType === 'static' 
        ? '/api/hosting/deploy/static' 
        : '/api/hosting/deploy/dynamic';

      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: uploadFormData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors du déploiement');
      }

      toast.success(data.message);

      // Show deployment notes for dynamic sites
      if (deploymentType === 'dynamic' && data.notes) {
        setTimeout(() => {
          data.notes.forEach((note: string) => {
            toast.success(note, { duration: 6000 });
          });
        }, 1000);
      }

      // Reset form
      setFormData({ projectName: '', description: '' });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh projects
      await refreshProjects();
      await refreshStats();

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Déployer un Projet</h2>
        <p className="text-gray-600 mt-1">
          Uploadez votre projet sous forme de fichier ZIP pour le déployer automatiquement
        </p>
      </div>

      {/* Deployment Type Selection */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Type de déploiement</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => setDeploymentType('static')}
            className={`cursor-pointer border-2 rounded-xl p-6 transition-all ${
              deploymentType === 'static'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className={`p-2 rounded-lg ${
                deploymentType === 'static' ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                <Globe className={`w-6 h-6 ${
                  deploymentType === 'static' ? 'text-blue-600' : 'text-gray-600'
                }`} />
              </div>
              <h4 className="font-semibold text-gray-900">Site Statique</h4>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Pour les sites HTML/CSS/JS, React, Vue, Angular (sans backend)
            </p>
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>Déploiement instantané</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>Hébergement de fichiers statiques</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>SSL automatique</span>
              </div>
            </div>
          </div>

          <div
            onClick={() => setDeploymentType('dynamic')}
            className={`cursor-pointer border-2 rounded-xl p-6 transition-all ${
              deploymentType === 'dynamic'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className={`p-2 rounded-lg ${
                deploymentType === 'dynamic' ? 'bg-purple-100' : 'bg-gray-100'
              }`}>
                <Server className={`w-6 h-6 ${
                  deploymentType === 'dynamic' ? 'text-purple-600' : 'text-gray-600'
                }`} />
              </div>
              <h4 className="font-semibold text-gray-900">Site Dynamique</h4>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Applications complètes avec frontend et backend séparés
            </p>
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>Installation automatique des dépendances</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>Allocation de port automatique</span>
              </div>
              <div className="flex items-center space-x-2">
                <Database className="w-3 h-3 text-blue-500" />
                <span>Support MongoDB automatique</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Site Requirements */}
      {deploymentType === 'dynamic' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <Info className="w-6 h-6 text-amber-600 mt-1" />
            <div>
              <h4 className="font-semibold text-amber-800 mb-2">
                Structure requise pour les sites dynamiques
              </h4>
              <div className="space-y-3 text-sm text-amber-700">
                <p>Votre fichier ZIP doit contenir <strong>exactement</strong> cette structure :</p>
                <div className="bg-white border border-amber-200 rounded-lg p-4 font-mono text-xs">
                  <div className="flex items-center space-x-2 text-amber-800">
                    <FileArchive className="w-4 h-4" />
                    <span>votre-projet.zip</span>
                  </div>
                  <div className="ml-6 mt-2 space-y-1">
                    <div className="flex items-center space-x-2">
                      <Folder className="w-4 h-4 text-blue-600" />
                      <span>frontend/</span>
                    </div>
                    <div className="ml-6 flex items-center space-x-2 text-gray-600">
                      <Code className="w-3 h-3" />
                      <span>package.json (obligatoire)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Folder className="w-4 h-4 text-purple-600" />
                      <span>backend/</span>
                    </div>
                    <div className="ml-6 flex items-center space-x-2 text-gray-600">
                      <Code className="w-3 h-3" />
                      <span>package.json (obligatoire)</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <p><strong>Frontend :</strong> Doit contenir un fichier <code className="bg-amber-100 px-1 rounded">.env</code> avec <code>BACKEND_ADRESSE</code> (sera configuré automatiquement si absent)</p>
                  <p><strong>Backend :</strong> Si MongoDB est utilisé, il sera démarré automatiquement</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Form */}
      <form onSubmit={handleDeploy} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">Informations du projet</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-2">
              Nom du projet *
            </label>
            <input
              type="text"
              id="projectName"
              name="projectName"
              value={formData.projectName}
              onChange={handleInputChange}
              required
              placeholder="mon-super-site"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Utilisé pour l'URL et l'identification
            </p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description (optionnel)
            </label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Description de votre projet"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* File Upload Zone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fichier du projet *
          </label>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragOver
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {selectedFile ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-3">
                  <FileArchive className="w-8 h-8 text-blue-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Supprimer le fichier
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    Glissez votre fichier ZIP ici
                  </p>
                  <p className="text-gray-600 mb-4">
                    ou cliquez pour sélectionner un fichier
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Choisir un fichier
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Taille maximale: 100MB • Format: ZIP uniquement
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Deploy Button */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            {deploymentType === 'static' ? (
              <>
                <Globe className="w-4 h-4" />
                <span>Déploiement statique</span>
              </>
            ) : (
              <>
                <Server className="w-4 h-4" />
                <span>Déploiement dynamique</span>
              </>
            )}
          </div>
          
          <button
            type="submit"
            disabled={uploading || !selectedFile || !formData.projectName.trim()}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
          >
            {uploading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Déploiement en cours...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Upload className="w-4 h-4" />
                <span>Déployer le projet</span>
              </div>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DeploymentPanel;