const relativeTimePattern = /\b(last night|yesterday|today)\s+at\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i;

export function resolveMealCreatedAt(proposed: string, sourceText?: string, messageSentAt?: string): Date {
  const match = sourceText?.match(relativeTimePattern);
  const anchor = messageSentAt ? new Date(messageSentAt) : undefined;

  if (match && anchor && Number.isFinite(anchor.getTime())) {
    let hour = Number(match[2]);
    const minute = Number(match[3] ?? 0);
    const meridiem = match[4]?.toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;

    if (hour <= 23 && minute <= 59) {
      const resolved = new Date(anchor);
      if (match[1]!.toLowerCase() !== "today") resolved.setUTCDate(resolved.getUTCDate() - 1);
      resolved.setUTCHours(hour, minute, 0, 0);
      return resolved;
    }
  }

  return new Date(proposed);
}
