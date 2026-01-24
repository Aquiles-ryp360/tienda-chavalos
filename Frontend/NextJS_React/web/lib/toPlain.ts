// web/lib/toPlain.ts
import { Prisma } from "@prisma/client";

export function toPlain<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) => {
      // Prisma Decimal -> number
      if (value instanceof Prisma.Decimal) return value.toNumber();

      // Date -> ISO string (opcional pero recomendado)
      if (value instanceof Date) return value.toISOString();

      return value;
    })
  ) as T;
}
