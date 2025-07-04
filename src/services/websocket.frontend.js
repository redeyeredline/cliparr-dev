// Frontend WebSocket client for real-time communication with backend server.
// Provides connection management, automatic reconnection, and event listener system.
import { logger } from './logger.frontend.js';

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    this.isConnecting = false;
    this.lastConnectionState = null;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket('ws://localhost:8485/ws');

      this.ws.onopen = () => {
        // logger.info('WebSocket connected');
        // console.log('[WebSocketClient] Connected to ws://localhost:8485/ws');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        if (this.lastConnectionState !== 'connected') {
          this.lastConnectionState = 'connected';
          this.notifyListeners('connection', { status: 'connected' });
        }
      };

      this.ws.onmessage = (event) => {
        // console.log('[WebSocketClient] Raw message:', event.data);
        try {
          const data = JSON.parse(event.data);
          // console.log('[WebSocketClient] Parsed message:', data);

          // Log specific message types for debugging
          if (data.type === 'job_update' || data.dbJobId) {
            // console.log('[WebSocketClient] Job update received:', {...});
          }

          this.notifyListeners('message', data);
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error);
          // console.error('[WebSocketClient] Failed to parse message:', event.data, error);
        }
      };

      this.ws.onerror = (error) => {
        logger.error('WebSocket error:', error);
        // console.error('[WebSocketClient] WebSocket error:', error);
        this.notifyListeners('error', error);
      };

      this.ws.onclose = () => {
        // logger.info('WebSocket disconnected');
        // console.log('[WebSocketClient] Disconnected from ws://localhost:8485/ws');
        this.isConnecting = false;
        if (this.lastConnectionState !== 'disconnected') {
          this.lastConnectionState = 'disconnected';
          this.notifyListeners('connection', { status: 'disconnected' });
        }

        // Attempt to reconnect if not at max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), this.reconnectDelay);
        }
      };
    } catch (error) {
      logger.error('Failed to create WebSocket connection:', error);
      // console.error('[WebSocketClient] Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.notifyListeners('error', error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnecting = false;
      this.lastConnectionState = null;
    }
  }

  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  removeEventListener(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => callback(data));
    }
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // console.log('[WebSocketClient] Sending message:', data);
      this.ws.send(JSON.stringify(data));
    } else {
      logger.warn('WebSocket not connected, cannot send message');
      // console.warn('[WebSocketClient] Cannot send message, not connected:', data);
    }
  }
}

// Create a singleton instance
const wsClient = new WebSocketClient();

export { wsClient };
