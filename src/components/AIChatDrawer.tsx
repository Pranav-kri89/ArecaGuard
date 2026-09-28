import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Bot,
  User,
  HelpCircle,
  Minimize2,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import {
  AIChatMessage,
  SensorTelemetry,
  WeatherForecastResponse,
  AppLanguage,
} from '../types';
import { translations } from '../utils/translations';

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sensorTelemetry: SensorTelemetry | null;
  weather: WeatherForecastResponse | null;
  locationName: string;
  language: AppLanguage;
  initialPrompt?: string | null;
  onClearInitialPrompt?: () => void;
}

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({
  isOpen,
  onClose,
  sensorTelemetry,
  weather,
  locationName,
  language,
  initialPrompt,
  onClearInitialPrompt,
}) => {
  const t = translations[language];
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text:
        language === 'kn'
          ? 'ನಮಸ್ಕಾರ! ನಾನು ಅಡಿಕೆ ಡ್ರೈಯರ್ ಎಐ ಕೃಷಿ ಸಲಹೆಗಾರ. ಮುಂದಿನ 6 ಗಂಟೆಗಳ ಮಳೆ ಮುನ್ಸೂಚನೆ, ಛಾವಣಿಯ ಸ್ಥಿತಿ ಅಥವಾ ಒಣಗಿಸುವಿಕೆ ಬಗ್ಗೆ ನೀವು ಯಾವುದೇ ಪ್ರಶ್ನೆ ಕೇಳಬಹುದು.'
          : 'Hello! I am your AI Agronomist & Solar Dryer Assistant. Ask me about the 6-hour weather prediction, canopy action, or sensor comparisons!',
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    language === 'kn' ? 'ಮುಂದಿನ 6 ಗಂಟೆಗಳಲ್ಲಿ ಮಳೆ ಬರುತ್ತದೆಯೇ?' : 'What is the 6-hour rain prediction?',
    language === 'kn' ? 'ಈಗ ಛಾವಣಿಯನ್ನು ತೆರೆದಿಡಬೇಕೇ?' : 'Should the canopy stay OPEN or CLOSED?',
    language === 'kn' ? 'ಸೆನ್ಸಾರ್ ಮತ್ತು ಉಪಗ್ರಹ ಡೇಟಾ ಹೋಲಿಕೆ ಮಾಡಿ' : 'Compare sensors vs satellite weather',
    language === 'kn' ? 'ಅಡಿಕೆ ಒಣಗಿಸುವ ಉತ್ತಮ ಸಲಹೆಗಳು' : 'Tips for drying arecanuts right now',
  ];

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      if (initialPrompt) {
        handleSendMessage(initialPrompt);
        onClearInitialPrompt?.();
      }
    }
  }, [messages, isOpen, initialPrompt]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    const userMessage: AIChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: messages,
          locationName,
          sensorData: sensorTelemetry,
          weatherData: weather,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMessage: AIChatMessage = {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          text: data.reply || 'Analysis completed.',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error('Chat API returned error');
      }
    } catch (err) {
      console.error('AI Chat Error:', err);
      const errorMessage: AIChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'Sorry, I could not fetch the analysis right now. Please check internet connection.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${
        isExpanded
          ? 'inset-2 sm:inset-6 max-w-4xl mx-auto h-[90vh]'
          : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-32px)] sm:w-96 max-h-[82vh] h-[560px]'
      } bg-slate-950/95 border border-slate-700/80 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden`}
    >
      {/* Header */}
      <div className="p-3.5 sm:p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 leading-tight">
              <span>{t.aiAskBtn}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                Live Context
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
              {locationName} • {sensorTelemetry?.temperature ? `${sensorTelemetry.temperature.toFixed(1)}°C` : 'Sensor Online'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            title={isExpanded ? 'Minimize' : 'Maximize'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            title="Close Chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-2.5 ${
              m.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {m.sender === 'assistant' && (
              <div className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center shrink-0 mt-0.5 text-xs">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            <div
              className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-xs'
                  : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-xs whitespace-pre-wrap'
              }`}
            >
              {m.text}
            </div>
            {m.sender === 'user' && (
              <div className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 mt-0.5 text-xs">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-indigo-400 p-2 bg-slate-900/50 rounded-xl max-w-fit">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>AI is analyzing sensors & radar...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggested Prompts */}
      <div className="px-3 py-2 bg-slate-900/40 border-t border-slate-800/60 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
        {quickPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(prompt)}
            disabled={isLoading}
            className="text-[10px] px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all shrink-0 cursor-pointer disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Field */}
      <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendMessage();
          }}
          placeholder={t.chatPlaceholder}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          disabled={isLoading}
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim() || isLoading}
          className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl transition-all cursor-pointer shadow-md disabled:cursor-not-allowed"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
