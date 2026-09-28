// Web Serial API Manager for ESP32 Communication

export interface WebSerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readable: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writable: any;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
}

export interface SerialManagerCallbacks {
  onConnect?: (portInfo: { name: string; baudRate: number; vid?: number; pid?: number }) => void;
  onDisconnect?: () => void;
  onData?: (data: string) => void;
  onError?: (err: Error) => void;
}

class SerialManager {
  private port: WebSerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private isReading = false;
  private callbacks: SerialManagerCallbacks = {};

  public setCallbacks(callbacks: SerialManagerCallbacks) {
    this.callbacks = callbacks;
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public isInIframe(): boolean {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  public isConnected(): boolean {
    return this.port !== null;
  }

  public async requestAndConnect(baudRate = 115200): Promise<{ name: string; baudRate: number; vid?: number; pid?: number }> {
    if (!this.isSupported()) {
      throw new Error('Web Serial is not supported in this browser. Please use Chrome, Edge, or Opera.');
    }

    try {
      // Prompt user to select port
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serialNav = (navigator as any).serial;
      const port: WebSerialPort = await serialNav.requestPort();
      await port.open({ baudRate });

      this.port = port;
      const info = port.getInfo();

      const vid = info.usbVendorId;
      const pid = info.usbProductId;
      let portName = 'ESP32 Port';
      if (vid && pid) {
        portName = `USB (VID:0x${vid.toString(16).toUpperCase()} PID:0x${pid.toString(16).toUpperCase()})`;
      }

      this.startReading();

      const connectInfo = { name: portName, baudRate, vid, pid };
      this.callbacks.onConnect?.(connectInfo);
      return connectInfo;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.callbacks.onError?.(error);
      throw error;
    }
  }

  private async startReading() {
    if (!this.port || !this.port.readable) return;
    this.isReading = true;

    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    this.reader = reader as unknown as ReadableStreamDefaultReader<Uint8Array>;

    try {
      while (this.isReading) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          this.callbacks.onData?.(value);
        }
      }
    } catch (err: unknown) {
      if (this.isReading) {
        console.warn('Serial read error:', err);
      }
    } finally {
      try {
        reader.releaseLock();
        await readableStreamClosed.catch(() => {});
      } catch {
        // ignore stream closure cleanup errors
      }
    }
  }

  public async sendCommand(cmd: string): Promise<boolean> {
    if (!this.port || !this.port.writable) {
      return false;
    }

    try {
      const encoder = new TextEncoder();
      const writer = this.port.writable.getWriter();
      await writer.write(encoder.encode(cmd));
      writer.releaseLock();
      return true;
    } catch (err) {
      console.error('Failed to send serial command:', err);
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    this.isReading = false;
    try {
      if (this.reader) {
        await this.reader.cancel().catch(() => {});
        this.reader = null;
      }
      if (this.writer) {
        await this.writer.close().catch(() => {});
        this.writer = null;
      }
      if (this.port) {
        await this.port.close().catch(() => {});
        this.port = null;
      }
    } catch (err) {
      console.warn('Disconnect cleanup warning:', err);
    } finally {
      this.port = null;
      this.callbacks.onDisconnect?.();
    }
  }
}

export const serialManager = new SerialManager();
