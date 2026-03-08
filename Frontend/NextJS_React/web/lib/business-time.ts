export const BUSINESS_TIME_ZONE = 'America/Lima'

interface DateParts {
  year: number
  month: number
  day: number
  hour?: number
  minute?: number
  second?: number
}

function getFormatter(
  timeZone: string,
  options: Intl.DateTimeFormatOptions
) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    ...options,
  })
}

function getDateParts(date: Date, timeZone: string): DateParts {
  const formatter = getFormatter(timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  )

  return {
    year: values.year,
    month: values.month,
    day: values.day,
  }
}

function getDateTimeParts(date: Date, timeZone: string): Required<DateParts> {
  const formatter = getFormatter(timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  )

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getDateTimeParts(date, timeZone)
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )

  return zonedAsUtc - date.getTime()
}

function zonedDateTimeToUtc(parts: Required<DateParts>, timeZone: string) {
  const utcGuess = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0
    )
  )

  const offsetMs = getTimeZoneOffsetMs(utcGuess, timeZone)
  return new Date(utcGuess.getTime() - offsetMs)
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function getBusinessDayKey(date: Date = new Date(), timeZone: string = BUSINESS_TIME_ZONE) {
  const parts = getDateParts(date, timeZone)
  const month = String(parts.month).padStart(2, '0')
  const day = String(parts.day).padStart(2, '0')
  return `${parts.year}-${month}-${day}`
}

export function getBusinessDayRange(
  dayKey: string,
  timeZone: string = BUSINESS_TIME_ZONE
) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey)
  if (!match) {
    throw new Error(`Invalid dayKey: ${dayKey}`)
  }

  const [, yearRaw, monthRaw, dayRaw] = match
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  const start = zonedDateTimeToUtc(
    {
      year,
      month,
      day,
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone
  )

  const nextDayUtc = addUtcDays(new Date(Date.UTC(year, month - 1, day)), 1)
  const endExclusive = zonedDateTimeToUtc(
    {
      year: nextDayUtc.getUTCFullYear(),
      month: nextDayUtc.getUTCMonth() + 1,
      day: nextDayUtc.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone
  )

  return {
    start,
    endExclusive,
  }
}

export function parseBusinessDateFilter(
  value: string,
  kind: 'start' | 'end',
  timeZone: string = BUSINESS_TIME_ZONE
) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const { start, endExclusive } = getBusinessDayRange(value, timeZone)

    return kind === 'start'
      ? start
      : new Date(endExclusive.getTime() - 1)
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
