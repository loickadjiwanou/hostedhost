import React, { useState } from 'react';
import { Server, User, Mail, Lock, LogIn, UserPlus, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });

  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        toast.success('Connexion réussie !');
      } else {
        await register(formData.username, formData.email, formData.password);
        toast.success('Compte créé avec succès !');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Server className="w-12 h-12 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Mini-Hébergeur</h1>
          </div>
          <p className="text-gray-600 flex items-center justify-center space-x-2">
            <Globe className="w-4 h-4" />
            <span>Plateforme d'hébergement web personnelle</span>
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  isLogin 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>Connexion</span>
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  !isLogin 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Inscription</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom d'utilisateur
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Votre nom d'utilisateur"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="votre@email.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="••••••••"
                />
              </div>
              {!isLogin && (
                <p className="mt-1 text-sm text-gray-500">
                  Au moins 6 caractères
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Traitement...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  <span>{isLogin ? 'Se connecter' : 'Créer un compte'}</span>
                </div>
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">💡 Compte de démonstration</h4>
            <p className="text-xs text-gray-600 mb-2">
              Email: <span className="font-mono bg-white px-2 py-1 rounded">demo@example.com</span>
            </p>
            <p className="text-xs text-gray-600">
              Mot de passe: <span className="font-mono bg-white px-2 py-1 rounded">demo123</span>
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 text-center">
          <div className="grid grid-cols-3 gap-4 text-xs text-gray-500">
            <div className="flex flex-col items-center space-y-1">
              <Globe className="w-8 h-8 text-blue-400" />
              <span>Sites statiques</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <Server className="w-8 h-8 text-green-400" />
              <span>Sites dynamiques</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <div className="w-8 h-8 bg-orange-400 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <span>Déploiement auto</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;