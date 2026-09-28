// Web Serial Manager for Direct ESP32 USB Connection (COM Port)

export interface SerialTelemetryData {
  temperature: number | null;
  humidity: number | null;
  dht_connected: boolean;
  rain_analog: number | null;
  rain_digital: number | null;
  rain: boolean;
  rain_connected: boolean;
  rain_verified?: boolean;
  verification_state?: 'CONFIRMED_RAIN' | 'CONFIRMED_DRY' | 'VERIFYING_RAIN' | 'VERIFYING_DRY' | 'DISCONNECTED';
  verification_count?: number;
  light: number | null;
  light_connected: boolean;
  wifi_rssi: number;
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export class WebSerialConnection {
  private port: any = null;
  private reader: any = null;
  private writer: any = null;
  private isReading = false;
  private outputDone: any = null;
  private inputDone: any = null;
  private inputStream: any = null;
  private outputStream: any = null;
  
  public isConnected = false;
  private onDataCallback: ((data: SerialTelemetryData) => void) | null = null;
  private onErrorCallback: ((err: string) => void) | null = null;
  private onStatusCallback: ((connected: boolean) => void) | null = null;

  // Continuous Verification Multi-Sample Debounce Engine
  private consecutiveRainChecks = 0;
  private consecutiveDryChecks = 0;
  private isRainVerified = false;

  // Staging buffer for line aggregation
  private currentRecord: Partial<SerialTelemetryData> = {
    dht_connected: false,
    rain_connected: false,
    light_connected: false,
    wifi_rssi: -55,
  };

  constructor(
    onData: (data: SerialTelemetryData) => void,
    onStatus: (connected: boolean) => void,
    onError: (err: string) => void
  ) {
    this.onDataCallback = onData;
    this.onStatusCallback = onStatus;
    this.onErrorCallback = onError;
  }

  public async connect(): Promise<boolean> {
    if (!isWebSerialSupported()) {
      this.onErrorCallback?.('Web Serial API is not supported in this browser. Use Chrome or Edge.');
      return false;
    }

    try {
      // Request user to select COM port (e.g. COM4)
      // @ts-expect-error - navigator.serial is standard in Chromium
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });

      this.isConnected = true;
      this.onStatusCallback?.(true);

      // Set up writer for sending Web UI ACK to ESP32
      const textEncoder = new TextEncoderStream();
      this.outputDone = textEncoder.readable.pipeTo(this.port.writable);
      this.outputStream = textEncoder.writable;
      this.writer = this.outputStream.getWriter();

      // Immediately send handshake ACK so ESP32 knows Web UI is live!
      await this.sendWebUiAck();

      // Set up reader
      const textDecoder = new TextDecoderStream();
      this.inputDone = this.port.readable.pipeTo(textDecoder.writable);
      this.inputStream = textDecoder.readable;
      this.reader = this.inputStream.getReader();

      this.startReading();
      return true;
    } catch (err: any) {
      console.warn('Web Serial connection error:', err);
      this.isConnected = false;
      this.onStatusCallback?.(false);
      
      if (err.name === 'SecurityError') {
        this.onErrorCallback?.(
          'Browser permissions blocked USB Serial in this embedded preview frame. Please click the "Open in new tab" icon (↗) in the top-right header to connect directly to COM4!'
        );
      } else if (err.name === 'NotFoundError') {
        this.onErrorCallback?.('No COM port selected. Please select your ESP32 COM port (e.g. COM4).');
      } else {
        this.onErrorCallback?.(err.message || 'Failed to open serial port.');
      }
      return false;
    }
  }

  public async sendWebUiAck() {
    if (this.writer) {
      try {
        await this.writer.write('WEB_UI_CONNECTED\n');
      } catch (e) {
        console.warn('Error sending Serial ACK:', e);
      }
    }
  }

  public async sendCommand(command: string): Promise<boolean> {
    if (this.writer) {
      try {
        const payload = command.endsWith('\n') ? command : `${command}\n`;
        await this.writer.write(payload);
        return true;
      } catch (e) {
        console.warn('Error sending Serial command:', e);
        return false;
      }
    }
    return false;
  }

  private async startReading() {
    this.isReading = true;
    let lineBuffer = '';

    try {
      while (this.isReading && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }
        if (value) {
          lineBuffer += value;
          const lines = lineBuffer.split('\n');
          // Keep the incomplete last line in buffer
          lineBuffer = lines.pop() || '';

          for (const rawLine of lines) {
            this.parseSerialLine(rawLine.trim());
          }
        }
      }
    } catch (err: any) {
      if (this.isReading) {
        console.warn('Serial read loop error:', err);
        this.onErrorCallback?.(err.message || 'Serial disconnected');
      }
    } finally {
      this.disconnect();
    }
  }

  private parseSerialLine(line: string) {
    if (!line) return;

    // 1. Direct JSON Packet: {"dht_connected":true,...} or [JSON_DATA] {...}
    if (line.includes('{') && line.includes('}')) {
      try {
        const jsonStart = line.indexOf('{');
        const jsonEnd = line.lastIndexOf('}');
        const jsonStr = line.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonStr);

        const dhtConn = Boolean(parsed.dht_connected);
        const rainConn = Boolean(parsed.rain_connected);
        const lightConn = Boolean(parsed.light_connected);
        const rainMomentary = rainConn ? Boolean(parsed.rain) : false;

        // Continuous verification debouncing
        if (!rainConn) {
          this.consecutiveRainChecks = 0;
          this.consecutiveDryChecks = 0;
          this.isRainVerified = false;
        } else if (rainMomentary) {
          this.consecutiveRainChecks++;
          this.consecutiveDryChecks = 0;
          if (this.consecutiveRainChecks >= 3) {
            this.isRainVerified = true;
          }
        } else {
          this.consecutiveDryChecks++;
          this.consecutiveRainChecks = 0;
          if (this.consecutiveDryChecks >= 4) {
            this.isRainVerified = false;
          }
        }

        const vState: 'CONFIRMED_RAIN' | 'CONFIRMED_DRY' | 'VERIFYING_RAIN' | 'VERIFYING_DRY' | 'DISCONNECTED' =
          !rainConn
            ? 'DISCONNECTED'
            : this.isRainVerified
            ? 'CONFIRMED_RAIN'
            : rainMomentary
            ? 'VERIFYING_RAIN'
            : 'CONFIRMED_DRY';

        const data: SerialTelemetryData = {
          temperature: dhtConn ? (parsed.temperature ?? null) : null,
          humidity: dhtConn ? (parsed.humidity ?? null) : null,
          dht_connected: dhtConn,
          rain_analog: rainConn ? (parsed.rain_analog ?? null) : null,
          rain_digital: rainConn ? (parsed.rain_digital ?? null) : null,
          rain: rainMomentary,
          rain_connected: rainConn,
          rain_verified: parsed.rain_verified !== undefined ? Boolean(parsed.rain_verified) : this.isRainVerified,
          verification_state: parsed.verification_state || vState,
          verification_count: this.consecutiveRainChecks,
          light: lightConn ? (parsed.light ?? null) : null,
          light_connected: lightConn,
          wifi_rssi: parsed.wifi_rssi ?? -55,
        };

        this.onDataCallback?.(data);
        this.sendWebUiAck();
        return;
      } catch {
        // Fallback to text matching
      }
    }

    // 2. Parse Human Readable Diagnostic Strings from ESP32:
    // "DHT22: CONNECTED | Temp: 29.8 C | Humidity: 85.7 %"
    if (line.includes('DHT22:')) {
      if (line.includes('CONNECTED') && !line.includes('NOT CONNECTED')) {
        const tempMatch = line.match(/Temp:\s*([0-9.]+)/i);
        const humMatch = line.match(/Humidity:\s*([0-9.]+)/i);
        if (tempMatch && humMatch) {
          this.currentRecord.dht_connected = true;
          this.currentRecord.temperature = parseFloat(tempMatch[1]);
          this.currentRecord.humidity = parseFloat(humMatch[1]);
        }
      } else {
        this.currentRecord.dht_connected = false;
        this.currentRecord.temperature = null;
        this.currentRecord.humidity = null;
      }
    }

    // "Rain Plate: OK | AO: 4095 | DO: 1 (DRY)" or "Rain Plate: NOT CONNECTED"
    if (line.includes('Rain Plate:')) {
      const isOk = line.includes('OK') && !line.includes('NOT CONNECTED');
      this.currentRecord.rain_connected = isOk;
      if (isOk) {
        const aoMatch = line.match(/AO:\s*([0-9]+)/i);
        const doMatch = line.match(/DO:\s*([0-9]+)/i);
        if (aoMatch) this.currentRecord.rain_analog = parseInt(aoMatch[1], 10);
        if (doMatch) this.currentRecord.rain_digital = parseInt(doMatch[1], 10);
        this.currentRecord.rain = line.includes('RAIN DETECTED');
      } else {
        this.currentRecord.rain_analog = null;
        this.currentRecord.rain_digital = null;
        this.currentRecord.rain = false;
      }
    }

    // "LDR Light: OK | ADC: 4095 | Wi-Fi RSSI: -55 dBm" or "LDR Light: NOT CONNECTED"
    if (line.includes('LDR Light:')) {
      const isOk = line.includes('OK') && !line.includes('NOT CONNECTED');
      this.currentRecord.light_connected = isOk;
      if (isOk) {
        const adcMatch = line.match(/ADC:\s*([0-9]+)/i);
        if (adcMatch) this.currentRecord.light = parseInt(adcMatch[1], 10);
      } else {
        this.currentRecord.light = null;
      }
      const rssiMatch = line.match(/RSSI:\s*(-?[0-9]+)/i);
      if (rssiMatch) this.currentRecord.wifi_rssi = parseInt(rssiMatch[1], 10);

      // We reached the end of the 3-sensor telemetry block, emit record!
      this.emitCurrentRecord();
      this.sendWebUiAck();
    }
  }

  private emitCurrentRecord() {
    const rainConn = Boolean(this.currentRecord.rain_connected);
    const rainMomentary = rainConn && Boolean(this.currentRecord.rain);

    if (!rainConn) {
      this.consecutiveRainChecks = 0;
      this.consecutiveDryChecks = 0;
      this.isRainVerified = false;
    } else if (rainMomentary) {
      this.consecutiveRainChecks++;
      this.consecutiveDryChecks = 0;
      if (this.consecutiveRainChecks >= 3) {
        this.isRainVerified = true;
      }
    } else {
      this.consecutiveDryChecks++;
      this.consecutiveRainChecks = 0;
      if (this.consecutiveDryChecks >= 4) {
        this.isRainVerified = false;
      }
    }

    const vState: 'CONFIRMED_RAIN' | 'CONFIRMED_DRY' | 'VERIFYING_RAIN' | 'VERIFYING_DRY' | 'DISCONNECTED' =
      !rainConn
        ? 'DISCONNECTED'
        : this.isRainVerified
        ? 'CONFIRMED_RAIN'
        : rainMomentary
        ? 'VERIFYING_RAIN'
        : 'CONFIRMED_DRY';

    const data: SerialTelemetryData = {
      temperature: this.currentRecord.temperature ?? null,
      humidity: this.currentRecord.humidity ?? null,
      dht_connected: Boolean(this.currentRecord.dht_connected),
      rain_analog: this.currentRecord.rain_analog ?? null,
      rain_digital: this.currentRecord.rain_digital ?? null,
      rain: rainMomentary,
      rain_connected: rainConn,
      rain_verified: this.isRainVerified,
      verification_state: vState,
      verification_count: this.consecutiveRainChecks,
      light: this.currentRecord.light ?? null,
      light_connected: Boolean(this.currentRecord.light_connected),
      wifi_rssi: this.currentRecord.wifi_rssi ?? -55,
    };
    this.onDataCallback?.(data);
  }

  public async disconnect() {
    this.isReading = false;
    try {
      if (this.reader) {
        await this.reader.cancel();
        await this.inputDone?.catch(() => {});
        this.reader = null;
      }
      if (this.writer) {
        await this.writer.close();
        await this.outputDone?.catch(() => {});
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (e) {
      console.warn('Error during serial close:', e);
    }
    this.isConnected = false;
    this.onStatusCallback?.(false);
  }
}
