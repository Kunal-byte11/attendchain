export type LogLevel = "info" | "warn" | "error";

export interface LogContext {
  eventCode: string;
  chainId?: number;
  sessionId?: string | number;
  txHash?: string;
  correlationId?: string;
  [key: string]: unknown;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  eventCode: string;
  message: string;
  chainId?: number;
  sessionId?: string | number;
  txHash?: string;
  correlationId?: string;
  context?: Record<string, unknown>;
}

const REDACTED_KEY_PATTERN =
  /private|secret|mnemonic|cookie|authorization|password|token|salt|roll|student_name|studentname|synthetic_name|syntheticname|email|phone/i;

export const REDACTED_PLACEHOLDER = "[REDACTED]";

export function redactSensitiveData(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item));
  }

  if (typeof value === "object") {
    const inputRecord = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(inputRecord)) {
      if (REDACTED_KEY_PATTERN.test(key)) {
        sanitized[key] = REDACTED_PLACEHOLDER;
      } else {
        sanitized[key] = redactSensitiveData(nestedValue);
      }
    }

    return sanitized;
  }

  return value;
}

export function createStructuredLogEntry(
  level: LogLevel,
  message: string,
  context: LogContext
): StructuredLogEntry {
  const {
    eventCode,
    chainId,
    sessionId,
    txHash,
    correlationId,
    ...additionalContext
  } = context;

  const redactedAdditional = redactSensitiveData(additionalContext) as Record<
    string,
    unknown
  >;

  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    eventCode,
    message,
  };

  if (chainId !== undefined) entry.chainId = chainId;
  if (sessionId !== undefined) entry.sessionId = sessionId;
  if (txHash !== undefined) entry.txHash = txHash;
  if (correlationId !== undefined) entry.correlationId = correlationId;
  if (Object.keys(redactedAdditional).length > 0) {
    entry.context = redactedAdditional;
  }

  return entry;
}

export const logger = {
  info(message: string, context: LogContext): StructuredLogEntry {
    const entry = createStructuredLogEntry("info", message, context);
    if (process.env.NODE_ENV !== "test") {
      console.info(JSON.stringify(entry));
    }
    return entry;
  },

  warn(message: string, context: LogContext): StructuredLogEntry {
    const entry = createStructuredLogEntry("warn", message, context);
    if (process.env.NODE_ENV !== "test") {
      console.warn(JSON.stringify(entry));
    }
    return entry;
  },

  error(message: string, context: LogContext): StructuredLogEntry {
    const entry = createStructuredLogEntry("error", message, context);
    if (process.env.NODE_ENV !== "test") {
      console.error(JSON.stringify(entry));
    }
    return entry;
  },
};
