export type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown> | undefined;

const SENSITIVE_KEY_PATTERN =
  /(authorization|password|sessiontoken|token|secret|bindpassword|ldap_bind_password)/i;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function createLogger(level: LogLevel) {
  function shouldLog(targetLevel: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[targetLevel] >= LOG_LEVEL_PRIORITY[level];
  }

  function write(targetLevel: LogLevel, message: string, context?: LogContext): void {
    if (!shouldLog(targetLevel)) {
      return;
    }

    const payload = {
      level: targetLevel,
      message,
      timestamp: new Date().toISOString(),
      ...(context ? { context: sanitizeLogValue(context) } : {}),
    };

    const serialized = JSON.stringify(payload);
    if (targetLevel === "error") {
      console.error(serialized);
      return;
    }

    if (targetLevel === "warn") {
      console.warn(serialized);
      return;
    }

    console.log(serialized);
  }

  return {
    debug(message: string, context?: LogContext) {
      write("debug", message, context);
    },
    info(message: string, context?: LogContext) {
      write("info", message, context);
    },
    warn(message: string, context?: LogContext) {
      write("warn", message, context);
    },
    error(message: string, context?: LogContext) {
      write("error", message, context);
    },
  };
}

function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (depth > 4) {
    return "[MaxDepth]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, depth + 1));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitizeLogValue(nestedValue, depth + 1),
    ]),
  );
}

export type Logger = ReturnType<typeof createLogger>;
