import { useState, useEffect, useCallback } from "react";
import { X, Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface LogEntry {
  timestamp: string;
  type: "log" | "error" | "warn" | "info";
  message: string;
}

// Global log storage
const logs: LogEntry[] = [];
const listeners: Set<() => void> = new Set();

function addLog(type: LogEntry["type"], message: string) {
  const timestamp = new Date().toLocaleTimeString();
  logs.push({ timestamp, type, message });
  // Keep only last 100 logs
  if (logs.length > 100) {
    logs.shift();
  }
  listeners.forEach((listener) => listener());
}

// Intercept console methods
if (typeof window !== "undefined") {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  console.log = (...args) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
      )
      .join(" ");
    // Only capture [Push] and [SW] logs
    if (message.includes("[Push]") || message.includes("[SW]") || message.includes("[PushPrompt]")) {
      addLog("log", message);
    }
    originalLog.apply(console, args);
  };

  console.error = (...args) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
      )
      .join(" ");
    if (message.includes("[Push]") || message.includes("[SW]") || message.includes("[PushPrompt]")) {
      addLog("error", message);
    }
    originalError.apply(console, args);
  };

  console.warn = (...args) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
      )
      .join(" ");
    if (message.includes("[Push]") || message.includes("[SW]") || message.includes("[PushPrompt]")) {
      addLog("warn", message);
    }
    originalWarn.apply(console, args);
  };

  console.info = (...args) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
      )
      .join(" ");
    if (message.includes("[Push]") || message.includes("[SW]") || message.includes("[PushPrompt]")) {
      addLog("info", message);
    }
    originalInfo.apply(console, args);
  };
}

export function DebugConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const clearLogs = useCallback(() => {
    logs.length = 0;
    forceUpdate((n) => n + 1);
  }, []);

  // Only show in development or when explicitly enabled
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    // Check URL param or localStorage or iOS PWA
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const debugParam = urlParams.get("debug");
      const stored = localStorage.getItem("debug-console");

      // Auto-enable for iOS PWA for easier debugging
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
                          (window.navigator as any).standalone === true;
      const isIOSPWA = isIOS && isStandalone;

      // If URL has debug=push, save to localStorage for PWA
      if (debugParam === "push") {
        localStorage.setItem("debug-console", "true");
        setShowDebug(true);
      } else if (stored === "true" || isIOSPWA) {
        // Show for iOS PWA or if stored
        setShowDebug(true);
      }
    }
  }, []);

  if (!showDebug) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 left-4 z-[9999] bg-gray-900 text-white px-3 py-2 rounded-lg text-xs shadow-lg"
      >
        Debug ({logs.length})
      </button>
    );
  }

  return (
    <div
      className={`fixed left-2 right-2 z-[9999] bg-gray-900 text-white rounded-lg shadow-2xl overflow-hidden ${
        isMinimized ? "bottom-20" : "bottom-20 max-h-[60vh]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs font-semibold">Push Debug Console</span>
        <div className="flex items-center gap-2">
          <button
            onClick={clearLogs}
            className="p-1 hover:bg-gray-700 rounded"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-gray-700 rounded"
          >
            {isMinimized ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logs */}
      {!isMinimized && (
        <div className="overflow-y-auto max-h-[50vh] p-2 text-xs font-mono">
          {logs.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No push logs yet. Try enabling notifications.
            </p>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={`py-1 px-2 rounded mb-1 ${
                  log.type === "error"
                    ? "bg-red-900/50 text-red-300"
                    : log.type === "warn"
                    ? "bg-yellow-900/50 text-yellow-300"
                    : "bg-gray-800 text-gray-300"
                }`}
              >
                <span className="text-gray-500">{log.timestamp}</span>{" "}
                <span className="whitespace-pre-wrap break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Quick Info */}
      {!isMinimized && (
        <div className="px-3 py-2 bg-gray-800 border-t border-gray-700 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">SW in navigator:</span>{" "}
              <span className={typeof navigator !== "undefined" && "serviceWorker" in navigator ? "text-green-400" : "text-red-400"}>
                {typeof navigator !== "undefined" && "serviceWorker" in navigator ? "Yes" : "No"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Standalone:</span>{" "}
              <span className={typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) ? "text-green-400" : "text-red-400"}>
                {typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) ? "Yes" : "No"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">PushManager:</span>{" "}
              <span className={typeof window !== "undefined" && "PushManager" in window ? "text-green-400" : "text-red-400"}>
                {typeof window !== "undefined" && "PushManager" in window ? "Yes" : "No"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Notification:</span>{" "}
              <span className={typeof window !== "undefined" && "Notification" in window ? "text-green-400" : "text-red-400"}>
                {typeof window !== "undefined" && "Notification" in window ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
