import mqtt, { MqttClient } from 'mqtt';

export interface CloudCallbacks {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onStatusChange?: (status: 'ON' | 'OFF' | 'ONLINE') => void;
  onError?: (err: Error) => void;
}

class CloudMqttManager {
  private client: MqttClient | null = null;
  private currentDeviceId: string = '';
  private callbacks: CloudCallbacks = {};

  public setCallbacks(callbacks: CloudCallbacks) {
    this.callbacks = callbacks;
  }

  public isConnected(): boolean {
    return this.client !== null && this.client.connected;
  }

  public connect(deviceId: string) {
    if (this.client) {
      try {
        this.client.end(true);
      } catch {
        // ignore
      }
    }

    this.currentDeviceId = deviceId;

    // Connect to HiveMQ Public MQTT broker over Secure WebSockets (port 8884 wss)
    // HiveMQ Public Broker allows free, unauthenticated WSS MQTT connections
    const brokerUrl = 'wss://broker.hivemq.com:8884/mqtt';
    const clientId = `web-client-${Math.random().toString(16).substring(2, 10)}`;

    try {
      this.client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 4000,
      });

      this.client.on('connect', () => {
        this.callbacks.onConnect?.();
        // Subscribe to status updates from ESP32
        const statusTopic = `esp32/${this.currentDeviceId}/status`;
        this.client?.subscribe(statusTopic, (err) => {
          if (err) {
            console.error('Failed to subscribe to status topic:', err);
          }
        });
      });

      this.client.on('message', (topic, payload) => {
        const msg = payload.toString().trim().toUpperCase();
        if (msg === 'ON') {
          this.callbacks.onStatusChange?.('ON');
        } else if (msg === 'OFF') {
          this.callbacks.onStatusChange?.('OFF');
        } else if (msg === 'ONLINE') {
          this.callbacks.onStatusChange?.('ONLINE');
        }
      });

      this.client.on('error', (err) => {
        this.callbacks.onError?.(err);
      });

      this.client.on('close', () => {
        this.callbacks.onDisconnect?.();
      });
    } catch (err) {
      console.error('MQTT connection error:', err);
      this.callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  public sendCommand(cmd: '1' | '0' | 'BLINK' | 'SHUTDOWN') {
    if (!this.client || !this.client.connected) {
      return false;
    }
    const topic = `esp32/${this.currentDeviceId}/command`;
    this.client.publish(topic, cmd, { qos: 0 });
    return true;
  }

  public disconnect() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
    this.callbacks.onDisconnect?.();
  }
}

export const cloudMqtt = new CloudMqttManager();
