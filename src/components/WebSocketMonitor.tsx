import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Info, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { getSocket, getSocketStatus, disconnectSocket } from '../lib/socket';

interface WebSocketStatus {
  connected: boolean;
  lastConnected?: Date;
  lastDisconnected?: Date;
  connectionAttempts: number;
  ping: number;
  recovered?: boolean;
}

const WebSocketMonitor: React.FC = () => {
  const [status, setStatus] = useState<WebSocketStatus>({
    connected: false,
    connectionAttempts: 0,
    ping: 0
  });
  const [showModal, setShowModal] = useState(false);
  const [socket, setSocket] = useState<any>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      const socketStatus = getSocketStatus();
      const currentSocket = getSocket();
      setSocket(currentSocket);

      if (socketStatus) {
        setStatus(prev => ({
          ...prev,
          connected: socketStatus.connected,
          recovered: socketStatus.recovered
        }));
      }
    };

    // Atualização inicial
    updateStatus();

    const currentSocket = getSocket();
    if (currentSocket) {
      const handleConnect = () => {
        setStatus(prev => ({
          ...prev,
          connected: true,
          lastConnected: new Date(),
          recovered: true
        }));
        setIsReconnecting(false);
      };

      const handleDisconnect = () => {
        setStatus(prev => ({
          ...prev,
          connected: false,
          lastDisconnected: new Date(),
          connectionAttempts: prev.connectionAttempts + 1
        }));
      };

      const handleReconnect = () => {
        handleConnect();
      };

      const handleReconnectAttempt = () => {
        setIsReconnecting(true);
      };

      // Listeners para mudanças de status
      currentSocket.on('connect', handleConnect);
      currentSocket.on('disconnect', handleDisconnect);
      currentSocket.on('reconnect', handleReconnect);
      currentSocket.on('reconnect_attempt', handleReconnectAttempt);

      // Ping para medir latência
      const pingInterval = setInterval(() => {
        if (currentSocket.connected) {
          const start = Date.now();
          currentSocket.emit('ping', () => {
            const ping = Date.now() - start;
            setStatus(prev => ({ ...prev, ping }));
          });
        }
      }, 5000);

      return () => {
        clearInterval(pingInterval);
        currentSocket.off('connect', handleConnect);
        currentSocket.off('disconnect', handleDisconnect);
        currentSocket.off('reconnect', handleReconnect);
        currentSocket.off('reconnect_attempt', handleReconnectAttempt);
      };
    }
  }, []);

  const getStatusColor = () => {
    if (status.connected) return 'text-green-500';
    return 'text-red-500';
  };

  const getStatusBgColor = () => {
    if (status.connected) return 'bg-green-500';
    return 'bg-red-500';
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'Nunca';
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <>
      {/* Botão de Monitoramento - Canto inferior esquerdo */}
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => setShowModal(true)}
          className={`
            relative p-3 rounded-full border-2 transition-all duration-300 hover:scale-110
            ${status.connected
              ? 'bg-green-500/20 border-green-500/50 hover:bg-green-500/30'
              : 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30'
            }
            ${status.connected ? 'animate-pulse' : (isReconnecting ? 'animate-spin' : 'animate-bounce')}
          `}
          title={status.connected ? 'WebSocket Conectado' : 'WebSocket Desconectado'}
        >
          {/* Indicador de status */}
          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${getStatusBgColor()} animate-ping`} />
          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${getStatusBgColor()}`} />

          {/* Ícone */}
          {status.connected ? (
            <Wifi className="w-6 h-6 text-green-400" />
          ) : isReconnecting ? (
            <RefreshCw className="w-6 h-6 text-yellow-400 animate-spin" />
          ) : (
            <WifiOff className="w-6 h-6 text-red-400" />
          )}
        </button>
      </div>

      {/* Modal de Detalhes */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full mx-4 border border-gray-200 dark:border-slate-700">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${status.connected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    {status.connected ? (
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Status do WebSocket
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      Monitor de conexão em tempo real
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Status Cards */}
              <div className="space-y-4">
                {/* Status de Conexão */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${status.connected ? 'bg-green-500' : (isReconnecting ? 'bg-yellow-500' : 'bg-red-500')}`} />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Status</span>
                  </div>
                  <span className={`text-sm font-semibold ${getStatusColor()}`}>
                    {status.connected ? 'Conectado' : (isReconnecting ? 'Reconectando...' : 'Desconectado')}
                  </span>
                </div>

                {/* Última Conexão */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Última Conexão</span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-slate-400">
                    {formatDate(status.lastConnected)}
                  </span>
                </div>

                {/* Última Desconexão */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Última Desconexão</span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-slate-400">
                    {formatDate(status.lastDisconnected)}
                  </span>
                </div>

                {/* Status de Recuperação */}
                {status.recovered && (
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-900 dark:text-green-100">Recuperação</span>
                    </div>
                    <span className="text-sm text-green-700 dark:text-green-300">
                      Conexão recuperada
                    </span>
                  </div>
                )}

                {/* Tentativas de Conexão */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Info className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Tentativas</span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-slate-400">
                    {status.connectionAttempts}
                  </span>
                </div>

                {/* Ping */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Latência</span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-slate-400">
                    {status.ping > 0 ? `${status.ping}ms` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Server Info */}
              <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Informações do Servidor</span>
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  <div>Host: {window.location.hostname}:40001</div>
                  <div>Socket ID: {socket?.id || 'N/A'}</div>
                  <div>Transport: WebSocket</div>
                </div>
              </div>

              {/* Ações */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    if (socket && !status.connected) {
                      socket.connect();
                    }
                  }}
                  disabled={status.connected || isReconnecting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isReconnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Reconectando...
                    </>
                  ) : status.connected ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Conectado
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Reconectar
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    disconnectSocket();
                    setStatus(prev => ({ ...prev, connected: false }));
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Desconectar
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-900 dark:text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WebSocketMonitor;