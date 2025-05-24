import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

// Interfaces
interface Monitor {
  id: number;
  name: string;
  description: string;
  connected: boolean;
  brightness: number;
  contrast: number;
  volume: number;
  currentInput: string;
  inputs: string[];
}

interface CommandEntry {
  command: string;
  result: string;
  timestamp: string;
  success: boolean;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

// Custom Hooks
const useDebounce = (value: any, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDark));
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return [isDark, setIsDark] as const;
};

// Components
const Toast = memo(({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  }[toast.type];

  return (
    <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 animate-slide-in`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{toast.message}</span>
        <button
          onClick={() => onRemove(toast.id)}
          className="ml-3 text-white hover:text-gray-200 transition-colors"
          aria-label="Close toast"
        >
          ×
        </button>
      </div>
    </div>
  );
});

const Slider = memo(({
  value,
  onChange,
  min = 0,
  max = 100,
  label,
  icon,
  color = 'indigo',
  quickValues = []
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  icon: React.ReactNode;
  color?: 'indigo' | 'amber' | 'blue' | 'purple';
  quickValues?: number[];
}) => {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebounce(localValue, 300);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, value, onChange]);

  const colorClasses = {
    indigo: 'bg-indigo-500 text-white',
    amber: 'bg-amber-500 text-white',
    blue: 'bg-blue-500 text-white',
    purple: 'bg-purple-500 text-white'
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          {icon}
          {label}
        </span>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${colorClasses[color] || colorClasses.indigo}`}>
          {localValue}%
        </span>
      </div>

      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          value={localValue}
          onChange={(e) => setLocalValue(parseInt(e.target.value))}
          className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb transition-all duration-200"
        />
        <div
          className={`absolute top-0 h-3 rounded-lg transition-all duration-200 ${color === 'amber' ? 'bg-amber-400' : color === 'blue' ? 'bg-blue-400' : color === 'purple' ? 'bg-purple-400' : 'bg-indigo-400'}`}
          style={{ width: `${(localValue / max) * 100}%` }}
        />
      </div>

      {quickValues.length > 0 && (
        <div className="flex gap-2">
          {quickValues.map(val => (
            <button
              key={val}
              onClick={() => {
                setLocalValue(val);
                onChange(val);
              }}
              className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-all duration-200 hover:scale-105"
            >
              {val}%
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

const MonitorCard = memo(({
  monitor,
  onSliderChange,
  onInputChange,
  onApplyPreset
}: {
  monitor: Monitor;
  onSliderChange: (monitorId: number, property: string, value: number) => void;
  onInputChange: (monitorId: number, input: string) => void;
  onApplyPreset: (presetName: string, monitorId?: number) => void;
}) => {
  const handleSliderChange = useCallback((property: string, value: number) => {
    onSliderChange(monitor.id, property, value);
  }, [monitor.id, onSliderChange]);

  const handleInputChange = useCallback((input: string) => {
    onInputChange(monitor.id, input);
  }, [monitor.id, onInputChange]);

  const handlePresetApply = useCallback((presetName: string) => {
    onApplyPreset(presetName, monitor.id);
  }, [monitor.id, onApplyPreset]);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200/50 dark:border-gray-700/50">
        <div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <svg aria-hidden="true" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            {monitor.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Display #{monitor.id} • {monitor.description}
          </p>
        </div>
        <div className={`px-3 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${monitor.connected
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
          }`}>
          <div className={`h-2 w-2 rounded-full ${monitor.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`} />
          {monitor.connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-6">
        {/* Brightness */}
        <Slider
          value={monitor.brightness}
          onChange={(value) => handleSliderChange('brightness', value)}
          label="Brightness"
          color="amber"
          quickValues={[25, 50, 75, 100]}
          icon={
            <svg aria-hidden="true" className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />

        {/* Contrast */}
        <Slider
          value={monitor.contrast}
          onChange={(value) => handleSliderChange('contrast', value)}
          label="Contrast"
          color="indigo"
          icon={
            <svg aria-hidden="true" className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a4 4 0 004-4V5z" />
            </svg>
          }
        />

        {/* Volume */}
        <Slider
          value={monitor.volume}
          onChange={(value) => handleSliderChange('volume', value)}
          label="Volume"
          color="blue"
          icon={
            <svg aria-hidden="true" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          }
        />

        {/* Input Source */}
        <div>
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <div className="p-1 bg-purple-500/20 rounded">
              <svg aria-hidden="true" className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v12a4 4 0 01-4 4h4a4 4 0 004-4V5z" />
              </svg>
            </div>
            Input Source
          </div>
          <div className="grid grid-cols-3 gap-2">
            {monitor.inputs.map(input => (
              <button
                key={input}
                onClick={() => handleInputChange(input)}
                className={`py-3 px-4 text-sm font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 ${monitor.currentInput === input
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                {input.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Monitor Presets */}
        <div className="border-t border-gray-200/50 dark:border-gray-700/50 pt-4">
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <div className="p-1 bg-green-500/20 rounded">
              <svg aria-hidden="true" className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            Quick Presets
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'day', name: 'Day', icon: '☀️', gradient: 'from-yellow-400 to-orange-500' },
              { id: 'night', name: 'Night', icon: '🌙', gradient: 'from-indigo-500 to-purple-600' },
              { id: 'movie', name: 'Movie', icon: '🎬', gradient: 'from-red-500 to-pink-500' },
              { id: 'coding', name: 'Code', icon: '💻', gradient: 'from-green-500 to-teal-500' },
            ].map(preset => (
              <button
                key={preset.id}
                onClick={() => handlePresetApply(preset.id)}
                className={`py-2 px-3 bg-gradient-to-r ${preset.gradient} text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2`}
              >
                <span>{preset.icon}</span>
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>)
});

// Helper functions moved outside the App component for performance
const getPropertyCode = (property: string): string | undefined => {
  const properties: Record<string, string> = {
    brightness: 'luminance',
    contrast: 'contrast',
    volume: 'volume'
  };
  return properties[property];
};

const getInputCode = (input: string): string | undefined => {
  const inputs: Record<string, string> = {
    hdmi1: '0x11',
    hdmi2: '0x12',
    displayport: '0x0f',
    usbc: '0x1b'
  };
  return inputs[input];
};

// Main App Component
function App() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [commandOutput, setCommandOutput] = useState<CommandEntry[]>([]);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isDark, setIsDark] = useDarkMode();
  const [showCommandOutput, setShowCommandOutput] = useState(false);

  // Toast management
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Command output management
  const addCommandOutput = useCallback((entry: CommandEntry) => {
    setCommandOutput(prev => [entry, ...prev].slice(0, 50));
  }, []);

  // Detect monitors
  const detectMonitors = useCallback(async () => {
    try {
      setStatus('connecting');
      addCommandOutput({
        command: 'Detecting monitors...',
        result: 'Attempting to detect monitors with m1ddc',
        timestamp: new Date().toLocaleTimeString(),
        success: true
      });

      const displays = await invoke<string[]>('list_displays');

      const errorDisplay = displays.find(d => d.startsWith('Error:'));
      if (errorDisplay) {
        throw new Error(errorDisplay);
      }

      const detectedMonitors: Monitor[] = displays.map((display, index) => ({
        id: index + 1,
        name: `Display #${index + 1}`,
        description: display,
        connected: true,
        brightness: 50,
        contrast: 50,
        volume: 50,
        currentInput: 'hdmi1',
        inputs: ['hdmi1', 'hdmi2', 'displayport', 'usbc']
      }));

      setMonitors(detectedMonitors);
      setStatus('connected');
      addToast(`Detected ${detectedMonitors.length} monitors`, 'success');
      addCommandOutput({
        command: 'm1ddc display list',
        result: `Detected ${detectedMonitors.length} monitors`,
        timestamp: new Date().toLocaleTimeString(),
        success: true
      });
    } catch (error) {
      console.error('Failed to detect monitors:', error);
      setStatus('error');
      addToast(`Detection failed: ${error}`, 'error');
      addCommandOutput({
        command: 'm1ddc display list',
        result: `Error: ${error}`,
        timestamp: new Date().toLocaleTimeString(),
        success: false
      });
    }
  }, [addCommandOutput, addToast]);

  // Initialize app
  useEffect(() => {
    const initApp = async () => {
      try {
        await detectMonitors();
        setStatus('connected');
        addToast('Connected to m1ddc successfully', 'success');
        addCommandOutput({
          command: 'Initialize connection',
          result: 'Connected to m1ddc successfully',
          timestamp: new Date().toLocaleTimeString(),
          success: true
        });
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setStatus('error');
        addToast(`Connection failed: ${error}`, 'error');
        addCommandOutput({
          command: 'Initialize connection',
          result: `Error: ${error}`,
          timestamp: new Date().toLocaleTimeString(),
          success: false
        });
      }
    };

    initApp();
  }, [addToast, addCommandOutput, detectMonitors]);

  // Handle slider changes with optimized callbacks
  const handleSliderChange = useCallback(async (monitorId: number, property: string, value: number) => {
    setMonitors(prev => prev.map(m =>
      m.id === monitorId ? { ...m, [property]: value } : m
    ));

    const propertyCode = getPropertyCode(property);
    if (!propertyCode) return;

    const command = `m1ddc display ${monitorId} set ${propertyCode} ${value}`;
    try {
      const result = await invoke<{ success: boolean; output: string; error: string }>('execute_m1ddc_command', { command });

      addCommandOutput({
        command,
        result: result.success
          ? `Set ${property} to ${value} for Monitor #${monitorId}`
          : `Error: ${result.error}`,
        timestamp: new Date().toLocaleTimeString(),
        success: result.success
      });

      if (result.success) {
        addToast(`${property} set to ${value}%`, 'success');
      } else {
        addToast(`Failed to set ${property}`, 'error');
      }
    } catch (error) {
      console.error('Failed to execute command:', error);
      addCommandOutput({
        command,
        result: `Error: ${error}`,
        timestamp: new Date().toLocaleTimeString(),
        success: false
      });
      addToast(`Command failed: ${error}`, 'error');
    }
  }, [addCommandOutput, addToast]);

  // Handle input changes
  const handleInputChange = useCallback(async (monitorId: number, input: string) => {
    setMonitors(prev => prev.map(m =>
      m.id === monitorId ? { ...m, currentInput: input } : m
    ));

    const inputCode = getInputCode(input);
    if (!inputCode) return;

    const command = `m1ddc display ${monitorId} set input ${inputCode}`;
    try {
      const result = await invoke<{ success: boolean; output: string; error: string }>('execute_m1ddc_command', { command });

      addCommandOutput({
        command,
        result: result.success
          ? `Switched Monitor #${monitorId} to ${input.toUpperCase()}`
          : `Error: ${result.error}`,
        timestamp: new Date().toLocaleTimeString(),
        success: result.success
      });

      if (result.success) {
        addToast(`Switched to ${input.toUpperCase()}`, 'success');
      } else {
        addToast('Failed to switch input', 'error');
      }
    } catch (error) {
      console.error('Failed to execute command:', error);
      addCommandOutput({
        command,
        result: `Error: ${error}`,
        timestamp: new Date().toLocaleTimeString(),
        success: false
      });
      addToast(`Input switch failed: ${error}`, 'error');
    }
  }, [addCommandOutput, addToast]);

  // Handle preset application
  const handleApplyPreset = useCallback(async (presetName: string, monitorId?: number) => {
    const presets: Record<string, { brightness: number; contrast: number; volume?: number }> = {
      day: { brightness: 80, contrast: 75 },
      night: { brightness: 30, contrast: 60 },
      movie: { brightness: 50, contrast: 85, volume: 70 },
      coding: { brightness: 65, contrast: 70 }
    };

    const preset = presets[presetName];
    if (!preset) return;

    const targetMonitors = monitorId
      ? monitors.filter(m => m.id === monitorId)
      : monitors;

    if (targetMonitors.length === 0) return;

    // Update local state immediately for better UX
    setMonitors(prev => prev.map(m => {
      if (!monitorId || m.id === monitorId) {
        return {
          ...m,
          brightness: preset.brightness ?? m.brightness,
          contrast: preset.contrast ?? m.contrast,
          volume: preset.volume ?? m.volume
        };
      }
      return m;
    }));

    // Apply preset to monitors
    for (const monitor of targetMonitors) {
      if (preset.brightness !== undefined) {
        await handleSliderChange(monitor.id, 'brightness', preset.brightness);
      }
      if (preset.contrast !== undefined) {
        await handleSliderChange(monitor.id, 'contrast', preset.contrast);
      }
      if (preset.volume !== undefined) {
        await handleSliderChange(monitor.id, 'volume', preset.volume);
      }
    }

    const message = monitorId
      ? `Applied ${presetName} preset to Monitor #${monitorId}`
      : `Applied ${presetName} preset to all monitors`;

    addToast(message, 'success');
    addCommandOutput({
      command: `Apply ${presetName} preset`,
      result: message,
      timestamp: new Date().toLocaleTimeString(),
      success: true
    });
  }, [monitors, handleSliderChange, addToast, addCommandOutput]);

  // Memoized components for better performance
  const StatusIndicator = useMemo(() => (
    <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-sm font-medium">
      <div className={`h-3 w-3 rounded-full mr-3 ${status === 'connected'
          ? 'bg-green-500 animate-pulse'
          : status === 'connecting'
            ? 'bg-yellow-500 animate-pulse'
            : 'bg-red-500'
        }`} />
      {status === 'connected'
        ? 'Server Connected'
        : status === 'connecting'
          ? 'Connecting...'
          : 'Connection Error'}
    </div>
  ), [status]);

  const GlobalPresets = useMemo(() => (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-gray-200/50 dark:border-gray-700/50">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-3">
        <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg">
          <svg aria-hidden="true" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        Global Presets
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { id: 'day', name: 'Day Mode', icon: '☀️', gradient: 'from-yellow-400 to-orange-500' },
          { id: 'night', name: 'Night Mode', icon: '🌙', gradient: 'from-indigo-500 to-purple-600' },
          { id: 'movie', name: 'Movie Mode', icon: '🎬', gradient: 'from-red-500 to-pink-500' },
          { id: 'coding', name: 'Coding Mode', icon: '💻', gradient: 'from-green-500 to-teal-500' },
        ].map(preset => (
          <button
            key={preset.id}
            onClick={() => handleApplyPreset(preset.id)}
            className={`py-4 px-6 bg-gradient-to-r ${preset.gradient} text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center gap-3`}
          >
            <span className="text-lg">{preset.icon}</span>
            <span>{preset.name}</span>
          </button>
        ))}
      </div>
    </div>
  ), [handleApplyPreset]);

  return (
    <div className={`min-h-screen transition-all duration-500 ${isDark
        ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900'
        : 'bg-gradient-to-br from-blue-400 via-purple-500 to-purple-600'
      } p-6`}>
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
              <svg aria-hidden="true" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Monitor Controller</h1>
              <p className="text-white/80 text-lg">Control your Samsung monitors via m1ddc</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mb-6">
            {StatusIndicator}

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30 transition-all duration-200"
                title="Toggle Dark Mode"
              >
                {isDark ? (
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => setShowCommandOutput(!showCommandOutput)}
                className="p-2 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30 transition-all duration-200"
                title="Toggle Command Output"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </button>

              <button
                onClick={detectMonitors}
                className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30 transition-all duration-200 font-medium"
              >
                Refresh
              </button>
            </div>
          </div>
        </header>

        {monitors.length > 0 ? (
          <div className="space-y-8">
            {/* Monitor Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {monitors.map(monitor => (
                <MonitorCard
                  key={monitor.id}
                  monitor={monitor}
                  onSliderChange={handleSliderChange}
                  onInputChange={handleInputChange}
                  onApplyPreset={handleApplyPreset}
                />
              ))}
            </div>

            {/* Global Controls */}
            {GlobalPresets}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-12 shadow-xl border border-gray-200/50 dark:border-gray-700/50 max-w-md mx-auto">
              <div className="mb-6">
                <svg aria-hidden="true" className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">No Monitors Detected</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8">Make sure your monitors are connected and m1ddc is installed.</p>
              <button
                onClick={detectMonitors}
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                Detect Monitors
              </button>
            </div>
          </div>
        )}

        {/* Command Output Panel */}
        {showCommandOutput && (
          <div className="mt-8 bg-gray-900/95 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-gray-700/50">
            <div className="flex items-center justify-between mb-4 text-gray-300 border-b border-gray-700 pb-4">
              <div className="flex items-center gap-3">
                <svg aria-hidden="true" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="font-semibold">Command Output</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCommandOutput([])}
                  className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded text-gray-300 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowCommandOutput(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto text-sm font-mono">
              {commandOutput.length === 0 ? (
                <div className="text-gray-500 italic p-4 text-center">No commands executed yet...</div>
              ) : (
                <div className="space-y-3">
                  {commandOutput.map((entry, index) => (
                    <div key={index} className="border-l-2 border-gray-700 pl-4">
                      <div className="text-blue-400 mb-1">
                        <span className="text-gray-500">[{entry.timestamp}]</span> $ {entry.command}
                      </div>
                      <div className={`pl-4 ${entry.success ? 'text-green-400' : 'text-red-400'}`}>
                        {entry.result}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="mt-12 text-center text-white/70 text-sm">
        <p>Monitor Controller • Built with Tauri + React • Using m1ddc for macOS</p>
      </footer>
    </div>
  );
}

export default App;