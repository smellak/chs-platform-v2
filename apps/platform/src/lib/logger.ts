type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

interface Logger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
}

function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}`;
  if (entry.data && Object.keys(entry.data).length > 0) {
    return `${base} ${JSON.stringify(entry.data)}`;
  }
  return base;
}

function log(level: LogLevel, module: string, message: string, data?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    module,
    message,
    timestamp: new Date().toISOString(),
    data,
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case "debug":
      if (process.env["NODE_ENV"] !== "production") {
        // eslint-disable-next-line no-console
        console.debug(formatted);
      }
      break;
    case "info":
      // eslint-disable-next-line no-console
      console.info(formatted);
      break;
    case "warn":
      // eslint-disable-next-line no-console
      console.warn(formatted);
      break;
    case "error":
      // eslint-disable-next-line no-console
      console.error(formatted);
      break;
  }
}

export function createLogger(module: string): Logger {
  return {
    debug: (message: string, data?: Record<string, unknown>) => log("debug", module, message, data),
    info: (message: string, data?: Record<string, unknown>) => log("info", module, message, data),
    warn: (message: string, data?: Record<string, unknown>) => log("warn", module, message, data),
    error: (message: string, data?: Record<string, unknown>) => log("error", module, message, data),
  };
}
