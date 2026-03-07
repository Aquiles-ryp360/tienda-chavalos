export type JsonObject = Record<string, unknown>

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function readJsonObject(request: Request): Promise<JsonObject> {
  const body = await request.json()
  return isJsonObject(body) ? body : {}
}

export function parseString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function parseNonEmptyString(value: unknown): string | undefined {
  const parsed = parseString(value)?.trim()
  return parsed ? parsed : undefined
}

export function parseBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

export function parseNumberLike(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return undefined
    }

    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

export function parseJsonObjectArray(value: unknown): JsonObject[] | undefined {
  if (!Array.isArray(value) || !value.every(isJsonObject)) {
    return undefined
  }

  return value
}

export function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message
  }

  if (!isJsonObject(error)) {
    return undefined
  }

  return typeof error.message === 'string' ? error.message : undefined
}

export function getErrorCode(error: unknown): string | undefined {
  if (!isJsonObject(error)) {
    return undefined
  }

  return typeof error.code === 'string' ? error.code : undefined
}

export function getErrorProperty<T>(error: unknown, key: string): T | undefined {
  if (!isJsonObject(error)) {
    return undefined
  }

  return error[key] as T | undefined
}
