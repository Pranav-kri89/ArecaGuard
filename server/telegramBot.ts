import fs from "fs";
import path from "path";
import { Radar30kmScanResult, SingleSourceSystemState, TelegramBotStatus, TelegramBotUser } from "../src/types";

const TELEGRAM_BOT_TOKEN = "8788523999:AAHzoNzFdPpI2lOAGj7o5_rhnPFFkGOShIE";
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const SUBSCRIBERS_FILE = path.join(process.cwd(), "telegram_users.json");

export interface TelegramBotHandlers {
  onOpenRoof: (source: string) => Promise<{ success: boolean; duration: number; reason?: string }>;
  onCloseRoof: (source: string) => Promise<{ success: boolean; duration: number; reason?: string }>;
  onStopRoof?: (source: string) => Promise<{ success: boolean }>;
  onToggleHeater?: (source: string) => Promise<{ status: string; mode: string }>;
  getFarmStatus: () => {
    canopyState: string;
    physicalRoofPosition: string;
    temperature: number | null;
    humidity: number | null;
    rainDetected: boolean;
    rainVerified: boolean;
    lightPercent: number | null;
    heaterStatus: string;
    heaterDutyCycles: number;
    activeRotation: string;
  };
  getSystemState?: () => SingleSourceSystemState;
  getRadarScan: () => Promise<Radar30kmScanResult>;
  getAiAnalysis?: (question: string) => Promise<string>;
}


class TelegramBotService {
  private users: Map<number, TelegramBotUser> = new Map();
  private isPolling = false;
  private abortController: AbortController | null = null;
  private conflictCount = 0;
  private lastUpdateId = 0;
  private botUsername = "ArecaFarmDryerbot";
  private handlers: TelegramBotHandlers | null = null;
  private lastAlertTimestamp: number | null = null;
  private lastCommandReceived: string | null = null;
  private lastCommandTimestamp: number | null = null;

  constructor() {
    this.loadSubscribers();
  }

  private loadSubscribers() {
    try {
      if (fs.existsSync(SUBSCRIBERS_FILE)) {
        const raw = fs.readFileSync(SUBSCRIBERS_FILE, "utf-8");
        const list: TelegramBotUser[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((u) => {
            if (u && u.id) {
              this.users.set(u.id, u);
            }
          });
          console.log(`[Telegram Bot] Loaded ${this.users.size} permanent subscriber(s) from brain.`);
        }
      }
    } catch (err) {
      console.error("[Telegram Bot] Error reading subscribers file:", err);
    }
  }

  private saveSubscribers() {
    try {
      const list = Array.from(this.users.values());
      fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      console.error("[Telegram Bot] Error saving subscribers to brain:", err);
    }
  }

  public registerUser(id: number, username?: string, firstName?: string): TelegramBotUser {
    const existing = this.users.get(id);
    const updated: TelegramBotUser = {
      id,
      username: username || existing?.username,
      firstName: firstName || existing?.firstName || "Farmer",
      registeredAt: existing?.registeredAt || Date.now(),
      lastSeenAt: Date.now(),
    };
    this.users.set(id, updated);
    this.saveSubscribers();
    console.log(`[Telegram Bot] Added user #${id} (${updated.firstName}) permanently into brain.`);
    return updated;
  }

  public init(handlers: TelegramBotHandlers) {
    this.handlers = handlers;
    if (this.isPolling) {
      this.stopPolling();
    }
    this.startPolling();
  }

  public stopPolling() {
    this.isPolling = false;
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {}
      this.abortController = null;
    }
    console.log(`[Telegram Bot] Stopped long polling.`);
  }

  public getStatus(): TelegramBotStatus {
    return {
      botUsername: this.botUsername,
      isLive: this.isPolling,
      registeredUsersCount: this.users.size,
      registeredUsers: Array.from(this.users.values()),
      lastConflictAlertSentAt: this.lastAlertTimestamp,
      lastCommandReceived: this.lastCommandReceived,
      lastCommandTimestamp: this.lastCommandTimestamp,
    };
  }

  // Dynamic Persistent Keyboard reflecting exact physical state & locking rules
  public getPersistentKeyboard(position?: string, isMoving?: boolean) {
    let topRow: Array<{ text: string }> = [];
    if (isMoving) {
      topRow = [{ text: "⏹️ Emergency STOP" }];
    } else if (position === "OPEN") {
      topRow = [{ text: "🔴 Close Roof" }];
    } else if (position === "CLOSED") {
      topRow = [{ text: "🟢 Open Roof" }];
    } else {
      topRow = [{ text: "🟢 Open Roof" }, { text: "🔴 Close Roof" }];
    }

    return {
      keyboard: [
        topRow,
        [{ text: "📊 Farm Status" }, { text: "🔥 12V Heater" }],
        [{ text: "🛰️ 30km Radar Scan" }, { text: "🤖 AI Advice" }],
      ],
      resize_keyboard: true,
      is_persistent: true,
    };
  }

  public async sendMessage(chatId: number, text: string, replyMarkup?: any) {
    try {
      const defaultMarkup = this.handlers
        ? (() => {
            const s = this.handlers.getFarmStatus();
            return this.getPersistentKeyboard(s.physicalRoofPosition, s.activeRotation !== "IDLE");
          })()
        : this.getPersistentKeyboard();

      const payload: any = {
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        reply_markup: replyMarkup || defaultMarkup,
      };

      const res = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.warn(`[Telegram Bot] Send message failed (${res.status}):`, errBody);
      }
    } catch (err) {
      console.error(`[Telegram Bot] Network error sending to ${chatId}:`, err);
    }
  }

  public async answerCallbackQuery(callbackQueryId: string, text: string) {
    try {
      await fetch(`${TELEGRAM_API_BASE}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
      });
    } catch (e) {
      // ignore
    }
  }

  public async broadcastAlert(title: string, message: string, inlineButtons?: Array<Array<{ text: string; callback_data: string }>>) {
    const subscriberList = Array.from(this.users.values());
    if (subscriberList.length === 0) {
      console.log("[Telegram Bot] No registered users in brain yet to receive alert.");
      return;
    }

    this.lastAlertTimestamp = Date.now();
    const formattedText = `🚨 *${title}*\n\n${message}`;

    const replyMarkup = inlineButtons
      ? { inline_keyboard: inlineButtons }
      : this.getPersistentKeyboard();

    for (const user of subscriberList) {
      await this.sendMessage(user.id, formattedText, replyMarkup);
    }
  }

  public async broadcastConflictAlert(radarResult: Radar30kmScanResult, localSensor?: any) {
    // Cooldown check: prevent spamming more than once every 3 minutes
    const now = Date.now();
    if (this.lastAlertTimestamp && now - this.lastAlertTimestamp < 180000) {
      return;
    }

    // Only broadcast conflict alert if rain has actually penetrated the 10km critical shield
    if (radarResult.is10kmPerimeterClear) {
      return;
    }

    const rainPoints = radarResult.points.filter((p) => p.isRaining || p.precipitation > 0);
    const nearestDesc = radarResult.nearestRainDistanceKm !== null
      ? `~${radarResult.nearestRainDistanceKm}km (${radarResult.nearestRainPlaceName || radarResult.nearestRainDirection})`
      : "Not pinpointed";

    const msg =
      `🛰️ *RADAR 10KM SHIELD BREACH ALERT*\n` +
      `Doppler radar has detected rain entering your *10km Critical Perimeter* (${radarResult.aggregateRainProbability}%), while bed sensor is DRY!\n\n` +
      `• *10km Critical Zone*: Rain cell active at *${radarResult.nearestRainPlaceName || 'nearby'} (~${radarResult.nearestRainDistanceKm} km)*\n` +
      `• *100km Reference Scan*: ${rainPoints.length} of ${radarResult.totalScanPoints} stations reporting precipitation\n` +
      `• *Ground Sensor Plate*: ${localSensor?.rain ? "WET" : "DRY"}\n` +
      `• *Microclimate Temp*: ${localSensor?.temperature ? `${localSensor.temperature.toFixed(1)}°C` : "N/A"}\n\n` +
      `⚡ *Action Required*: You can force CLOSE the roof canopy to protect arecanuts or keep it OPEN:`;

    const inlineKeyboard = [
      [
        { text: "🔴 Close Roof Now", callback_data: "force_close" },
        { text: "🟢 Keep Roof Open", callback_data: "force_open" },
      ],
      [
        { text: "🛰️ 100km Radar Details", callback_data: "radar_scan" },
        { text: "📊 Farm Status", callback_data: "farm_status" },
      ],
    ];

    await this.broadcastAlert("ARECA NUT FARM WEATHER ALERT", msg, inlineKeyboard);
  }

  private async handleMessage(msg: any) {
    const chatId = msg.chat?.id;
    const fromId = msg.from?.id || chatId;
    const text = (msg.text || "").trim();
    const firstName = msg.from?.first_name || "Farmer";
    const username = msg.from?.username;

    if (!chatId) return;

    this.registerUser(fromId, username, firstName);
    this.lastCommandReceived = text;
    this.lastCommandTimestamp = Date.now();

    const lower = text.toLowerCase();

    // 1. Welcome and Brain Registration (/start)
    if (lower === "/start" || lower === "start" || lower.startsWith("/start")) {
      const status = this.handlers ? this.handlers.getFarmStatus() : null;
      const welcome =
        `🌾 *Welcome to ArecaDryer AI Farm Guardian!* 🌾\n\n` +
        `Hello *${firstName}*! Your Telegram User ID (\`${fromId}\`) is now **permanently added into my brain**.\n\n` +
        `I am continuously connected to your farm server, ESP32 dual-channel motor driver, 12V dryer heater, and 30km regional weather radar.\n\n` +
        `📡 *Live System State*:\n` +
        `• Roof Canopy: *${status?.canopyState || "AUTO"}* (Pos: *${status?.physicalRoofPosition || "UNKNOWN"}*)\n` +
        `• Temperature: *${status?.temperature !== null ? `${status?.temperature}°C` : "Sensor offline"}*\n` +
        `• Rain Sensor: *${status?.rainDetected ? "WET 🌧️" : "DRY ☀️"}*\n` +
        `• 12V Heater: *${status?.heaterStatus || "STANDBY"}*\n` +
        `• 30km Radar: *Continuous Scanning*\n\n` +
        `👇 *Use the force buttons below your typing bar to open/close the roof anytime!*`;

      await this.sendMessage(chatId, welcome, this.getPersistentKeyboard());
      return;
    }

    // 2. Force OPEN Roof
    if (text === "🟢 Open Roof" || lower === "/open" || lower === "open" || lower.includes("open roof")) {
      if (this.handlers) {
        const s = this.handlers.getFarmStatus();
        if (s.activeRotation !== "IDLE") {
          await this.sendMessage(
            chatId,
            `⏳ *LOCKED*: Motor is currently in motion (*${s.activeRotation}*)!\nWait for cycle to complete or send \`/stop\`.`,
            this.getPersistentKeyboard(s.physicalRoofPosition, true)
          );
          return;
        }
        if (s.physicalRoofPosition === "OPEN") {
          await this.sendMessage(
            chatId,
            `🔒 *LOCKED*: Roof is ALREADY OPEN! You cannot click Open again.\nNext allowed action is **🔴 Close Roof**.`,
            this.getPersistentKeyboard("OPEN", false)
          );
          return;
        }

        const result = await this.handlers.onOpenRoof(`Telegram user ${firstName} (#${fromId})`);
        if (result.success) {
          await this.sendMessage(
            chatId,
            `✅ *Command Executed*: Canopy motor is now **OPENING** for solar drying!\n` +
            `• Action: Motor forward rotation (${result.duration}s)\n` +
            `• Lock Status: Close button locked until cycle finishes. Once open, only Close will be permitted.`,
            this.getPersistentKeyboard("OPENING", true)
          );
        } else {
          await this.sendMessage(
            chatId,
            `⚠️ *Command Rejected*: ${result.reason || "Motor is locked"}`,
            this.getPersistentKeyboard(s.physicalRoofPosition, false)
          );
        }
      } else {
        await this.sendMessage(chatId, "⚠️ Farm controller service is currently starting up.");
      }
      return;
    }

    // 3. Force CLOSE Roof
    if (text === "🔴 Close Roof" || lower === "/close" || lower === "close" || lower.includes("close roof")) {
      if (this.handlers) {
        const s = this.handlers.getFarmStatus();
        if (s.activeRotation !== "IDLE") {
          await this.sendMessage(
            chatId,
            `⏳ *LOCKED*: Motor is currently in motion (*${s.activeRotation}*)!\nWait for cycle to complete or send \`/stop\`.`,
            this.getPersistentKeyboard(s.physicalRoofPosition, true)
          );
          return;
        }
        if (s.physicalRoofPosition === "CLOSED") {
          await this.sendMessage(
            chatId,
            `🔒 *LOCKED*: Roof is ALREADY CLOSED! You cannot click Close again.\nNext allowed action is **🟢 Open Roof**.`,
            this.getPersistentKeyboard("CLOSED", false)
          );
          return;
        }

        const result = await this.handlers.onCloseRoof(`Telegram user ${firstName} (#${fromId})`);
        if (result.success) {
          await this.sendMessage(
            chatId,
            `🔒 *Command Executed*: Canopy motor is now **CLOSING** to protect areca nuts!\n` +
            `• Action: Motor reverse rotation (${result.duration}s)\n` +
            `• Lock Status: Open button locked until cycle finishes. Once closed, only Open will be permitted.`,
            this.getPersistentKeyboard("CLOSING", true)
          );
        } else {
          await this.sendMessage(
            chatId,
            `⚠️ *Command Rejected*: ${result.reason || "Motor is locked"}`,
            this.getPersistentKeyboard(s.physicalRoofPosition, false)
          );
        }
      } else {
        await this.sendMessage(chatId, "⚠️ Farm controller service is currently starting up.");
      }
      return;
    }

    // Emergency STOP
    if (text === "⏹️ Emergency STOP" || lower === "/stop" || lower === "stop" || lower.includes("stop")) {
      if (this.handlers?.onStopRoof) {
        await this.handlers.onStopRoof(`Telegram user ${firstName} (#${fromId})`);
        const s = this.handlers.getFarmStatus();
        await this.sendMessage(
          chatId,
          `⏹️ *EMERGENCY STOP EXECUTED*: Canopy motor halted immediately.\n` +
          `• Position: *${s.physicalRoofPosition}*\n` +
          `• Both Open and Close buttons are now unlocked for safety.`,
          this.getPersistentKeyboard(s.physicalRoofPosition, false)
        );
      } else {
        await this.sendMessage(chatId, "⚠️ Emergency stop handler unavailable.");
      }
      return;
    }

    // 4. Farm Status
    if (text === "📊 Farm Status" || lower === "/status" || lower === "status") {
      if (this.handlers) {
        if (this.handlers.getSystemState) {
          const sys = this.handlers.getSystemState();
          const statMsg =
            `📊 *Areca Nut Dryer - Unified System State*\n\n` +
            `⚙️ *System Mode*: *${sys.system_mode}*\n` +
            `• Mode Reason: _${sys.system_mode_reason}_\n\n` +
            `🏠 *Tarpaulin Canopy*: *${sys.tarpaulin.state}*\n` +
            `• Physical Position: *${sys.tarpaulin.physicalPosition}*\n` +
            `• Motor Rotation: *${sys.motor.activeRotation}*\n` +
            `• Safe Solar Drying: *${sys.tarpaulin.isSafeDryingPermitted ? "PERMITTED (Active)" : "RESTRICTED (Protected)"}*\n` +
            `• Last Decision: *${sys.tarpaulin.lastDecision}* (${sys.tarpaulin.lastDecisionReason})\n\n` +
            `🌧️ *Fused Weather Prediction*:\n` +
            `• Rain Probability: *${sys.prediction.rain_probability}%* (${sys.prediction.rain_risk} Risk)\n` +
            `• Ground Plate Rain: *${sys.prediction.actual_rain ? "WET (Direct Water Contact)" : "DRY (Plate Clear)"}*\n` +
            `• Prediction Status: *${sys.prediction.data_status}* (${sys.prediction.prediction_confidence}% Confidence)\n` +
            `• Prediction Horizon: *${sys.prediction.prediction_horizon}*\n` +
            `• Prediction Reason: _${sys.prediction.prediction_reason}_\n\n` +
            `🛰️ *30-Location Spatial Radar*:\n` +
            `• Consistency: *${sys.nearby_weather.spatialConsistency}*\n` +
            `• 30-Location Weighted Risk: *${sys.nearby_weather.distanceWeightedNearbyRisk}%*\n` +
            `• High-Risk Towns: *${sys.nearby_weather.highRiskLocationsCount} of ${sys.nearby_weather.nearbyLocationsCount}*\n` +
            `• Nearest Rain Cell: *${sys.nearby_weather.nearestRainDistanceKm !== null ? `${sys.nearby_weather.nearestRainDistanceKm}km (${sys.nearby_weather.nearestRainPlaceName || 'nearby'})` : "None within 30km"}*\n\n` +
            `🌡️ *Drying Microclimate*:\n` +
            `• Temperature: *${sys.latest_sensor?.temperature !== null && sys.latest_sensor?.temperature !== undefined ? `${sys.latest_sensor.temperature}°C` : "Sensor Offline"}* (5m trend: ${sys.prediction.derived_features.tempTrend5m >= 0 ? `+${sys.prediction.derived_features.tempTrend5m}` : sys.prediction.derived_features.tempTrend5m}°C)\n` +
            `• Humidity: *${sys.latest_sensor?.humidity !== null && sys.latest_sensor?.humidity !== undefined ? `${sys.latest_sensor.humidity}%` : "Sensor Offline"}* (5m trend: ${sys.prediction.derived_features.humidityTrend5m >= 0 ? `+${sys.prediction.derived_features.humidityTrend5m}` : sys.prediction.derived_features.humidityTrend5m}%)\n` +
            `• Sensor Health: *${sys.sensor_status.allCriticalSensorsValid ? "VALID & HEALTHY" : `DEGRADED (${sys.sensor_status.validationWarnings.join(", ")})`}*\n\n` +
            `🔥 *12V Auxiliary Heater*:\n` +
            `• State: *${sys.heater.status}* (${sys.heater.mode})\n` +
            `• Active Runtime: *${sys.heater.activeSeconds}s*\n\n` +
            `📡 *Connectivity*:\n` +
            `• ESP32 MQTT: *${sys.connectivity.esp32MqttOnline ? "ONLINE" : "OFFLINE"}*\n` +
            `• Weather API: *${sys.connectivity.internetWeatherOnline ? "ONLINE" : "OFFLINE"}*`;

          await this.sendMessage(chatId, statMsg);
        } else {
          const s = this.handlers.getFarmStatus();
          const statMsg =
            `📊 *Areca Farm Dryer - Live Telemetry*\n\n` +
            `🏠 *Canopy Roof*: *${s.canopyState}*\n` +
            `• Physical Position: *${s.physicalRoofPosition}*\n` +
            `• Motor Actuation: *${s.activeRotation}*\n\n` +
            `🌡️ *Microclimate Sensors*:\n` +
            `• DHT22 Temp: *${s.temperature !== null ? `${s.temperature}°C` : "Offline"}*\n` +
            `• Relative Humidity: *${s.humidity !== null ? `${s.humidity}%` : "Offline"}*\n` +
            `• Rain Plate: *${s.rainDetected ? "WET" : "DRY"}*\n` +
            `• Rain Verified: *${s.rainVerified ? "YES" : "NO"}*\n` +
            `• Sunlight Index: *${s.lightPercent !== null ? `${s.lightPercent}%` : "N/A"}*\n\n` +
            `🔥 *12V Auxiliary Heater & Dryer*:\n` +
            `• Status: *${s.heaterStatus}*\n` +
            `• Cycles Completed: *${s.heaterDutyCycles}*`;

          await this.sendMessage(chatId, statMsg);
        }
      }
      return;
    }


    // 5. 12V Heater Control
    if (text === "🔥 12V Heater" || lower === "/heater" || lower.includes("heater")) {
      if (this.handlers && this.handlers.onToggleHeater) {
        const hRes = await this.handlers.onToggleHeater(`Telegram user ${firstName}`);
        await this.sendMessage(
          chatId,
          `🔥 *12V Heater Dryer Updated*:\n` +
          `• Current State: *${hRes.status}*\n` +
          `• Mode: *${hRes.mode}*\n` +
          `• Target: Maintains arecanuts at optimal drying temperature when cold/wet.`
        );
      } else {
        await this.sendMessage(chatId, `🔥 *12V Auxiliary Heater* is operating in automated temperature regulation mode.`);
      }
      return;
    }

    // 6. 100km Regional Radar Scan (with 10km critical shield)
    if (text === "🛰️ 100km Radar Scan" || text === "🛰️ 30km Radar Scan" || lower === "/radar" || lower.includes("radar")) {
      if (this.handlers) {
        await this.sendMessage(chatId, `🛰️ *Scanning 100km Regional Doppler Radar Grid* across farm perimeter...`);
        const radar = await this.handlers.getRadarScan();
        const rainPoints = radar.points.filter((p) => p.isRaining || p.precipitation > 0);
        const is10kmClear = radar.is10kmPerimeterClear ?? (radar.rainIn10kmCount === 0);

        const radarMsg =
          `🛰️ *100km Regional Doppler Radar & 10km Shield*\n\n` +
          `• *10km Critical Shield*: *${is10kmClear ? "🟢 ALL CLEAR (Drying Safe)" : `🔴 RAIN IN 10KM (${radar.rainIn10kmCount} cell detected)`}*\n` +
          `• *100km Reference Coverage*: *${radar.totalScanPoints} stations scanned*\n` +
          `• *Aggregate Rain Risk*: *${radar.aggregateRainProbability}%*\n` +
          `• *Active Rain Stations*: *${rainPoints.length} of ${radar.totalScanPoints} stations*\n` +
          `• *Nearest Rain Front*: *${radar.nearestRainDistanceKm !== null ? `~${radar.nearestRainDistanceKm}km (${radar.nearestRainPlaceName || radar.nearestRainDirection})` : "None detected in 100km"}*\n` +
          `• *Canopy Protection*: *${is10kmClear ? "OPEN (Solar Drying)" : "CLOSED (Crop Sealed)"}*\n\n` +
          `🤖 *AI Ag-Verdict*: ${radar.aiRecommendationText}`;

        await this.sendMessage(chatId, radarMsg);
      }
      return;
    }

    // 7. AI Agronomist Chat Fallback
    if (this.handlers?.getAiAnalysis) {
      await this.sendMessage(chatId, `🤔 *Analyzing farm conditions with Gemini AI agronomist...*`);
      const answer = await this.handlers.getAiAnalysis(text);
      await this.sendMessage(chatId, answer);
      return;
    }

    await this.sendMessage(
      chatId,
      `🌾 *Areca Farm Dryer Bot*\nReceived: "${text}"\nUse the quick buttons below to control the roof canopy!`,
      this.getPersistentKeyboard()
    );
  }

  private async handleCallbackQuery(cq: any) {
    const cqId = cq.id;
    const data = cq.data;
    const chatId = cq.message?.chat?.id;
    const fromName = cq.from?.first_name || "User";

    if (!data) return;

    if (data === "force_close") {
      if (this.handlers) {
        const s = this.handlers.getFarmStatus();
        if (s.activeRotation !== "IDLE") {
          await this.answerCallbackQuery(cqId, "Motor is already moving! Please wait.");
          return;
        }
        if (s.physicalRoofPosition === "CLOSED") {
          await this.answerCallbackQuery(cqId, "Roof is ALREADY CLOSED! Next action: OPEN.");
          return;
        }

        await this.answerCallbackQuery(cqId, "Closing Canopy...");
        const res = await this.handlers.onCloseRoof(`Telegram button clicked by ${fromName}`);
        if (chatId) {
          if (res.success) {
            await this.sendMessage(chatId, `🔒 *Canopy Closure Confirmed*: Motor is closing (${res.duration}s). Arecanuts secured!`);
          } else {
            await this.sendMessage(chatId, `⚠️ *Command Rejected*: ${res.reason || "Motor is locked"}`);
          }
        }
      }
      return;
    }

    if (data === "force_open") {
      if (this.handlers) {
        const s = this.handlers.getFarmStatus();
        if (s.activeRotation !== "IDLE") {
          await this.answerCallbackQuery(cqId, "Motor is already moving! Please wait.");
          return;
        }
        if (s.physicalRoofPosition === "OPEN") {
          await this.answerCallbackQuery(cqId, "Roof is ALREADY OPEN! Next action: CLOSE.");
          return;
        }

        await this.answerCallbackQuery(cqId, "Opening Canopy...");
        const res = await this.handlers.onOpenRoof(`Telegram button clicked by ${fromName}`);
        if (chatId) {
          if (res.success) {
            await this.sendMessage(chatId, `🟢 *Canopy Opening Confirmed*: Motor is opening (${res.duration}s). Solar drying resumed!`);
          } else {
            await this.sendMessage(chatId, `⚠️ *Command Rejected*: ${res.reason || "Motor is locked"}`);
          }
        }
      }
      return;
    }

    if (data === "radar_scan") {
      await this.answerCallbackQuery(cqId, "Scanning 30km Radar...");
      if (this.handlers && chatId) {
        const radar = await this.handlers.getRadarScan();
        await this.sendMessage(
          chatId,
          `🛰️ *30km Radar Quick Report*:\n` +
          `• Aggregate Rain Risk: *${radar.aggregateRainProbability}%*\n` +
          `• Storm Cells Detected: *${radar.rainCellsDetected}*\n` +
          `• Verdict: *${radar.aiRecommendationText}*`
        );
      }
      return;
    }

    if (data === "farm_status") {
      await this.answerCallbackQuery(cqId, "Fetching status...");
      if (this.handlers && chatId) {
        const s = this.handlers.getFarmStatus();
        await this.sendMessage(
          chatId,
          `📊 *Quick Status*: Canopy: *${s.canopyState}* | Temp: *${s.temperature ?? "--"}°C* | Rain: *${s.rainDetected ? "WET" : "DRY"}*`
        );
      }
      return;
    }

    await this.answerCallbackQuery(cqId, "OK");
  }

  private async startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    console.log(`[Telegram Bot] Starting long polling for @${this.botUsername}...`);

    // Reset webhook and clear any pending locks before beginning polling
    try {
      await fetch(`${TELEGRAM_API_BASE}/deleteWebhook?drop_pending_updates=false`);
    } catch {
      // Ignore initial network errors
    }

    while (this.isPolling) {
      try {
        this.abortController = new AbortController();
        const url = `${TELEGRAM_API_BASE}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=5`;
        const res = await fetch(url, { signal: this.abortController.signal });

        if (res.ok) {
          if (this.conflictCount > 0) {
            console.log(`[Telegram Bot] Polling recovered and healthy.`);
            this.conflictCount = 0;
          }
          const data: any = await res.json();
          if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);

              if (update.message) {
                await this.handleMessage(update.message);
              } else if (update.callback_query) {
                await this.handleCallbackQuery(update.callback_query);
              }
            }
          }
        } else if (res.status === 409) {
          // HTTP 409 Conflict: Another instance or previous socket has an open getUpdates call.
          // Handle gracefully with backoff without emitting error warnings that trigger alerts.
          this.conflictCount++;
          const waitTimeSec = Math.min(15, 4 + this.conflictCount * 2);
          if (this.conflictCount === 1 || this.conflictCount % 5 === 0) {
            console.log(`[Telegram Bot] Waiting for active instance / previous socket to clear (${waitTimeSec}s backoff)...`);
          }
          await new Promise((r) => setTimeout(r, waitTimeSec * 1000));
        } else {
          const errText = await res.text();
          console.warn(`[Telegram Bot] Polling HTTP ${res.status}:`, errText);
          await new Promise((r) => setTimeout(r, 4000));
        }
      } catch (err: any) {
        if (err?.name === "AbortError" || !this.isPolling) {
          break;
        }
        console.error("[Telegram Bot] Polling connection error:", err?.message || err);
        await new Promise((r) => setTimeout(r, 4000));
      } finally {
        this.abortController = null;
      }
    }
  }
}

export const telegramBot = new TelegramBotService();
