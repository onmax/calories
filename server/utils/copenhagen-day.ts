import { fromDate } from "@internationalized/date";

export function copenhagenDayRange(date: Date): [Date, Date] {
  const start = fromDate(date, "Europe/Copenhagen").set({
    hour: 0,
    millisecond: 0,
    minute: 0,
    second: 0,
  });
  return [start.toDate(), start.add({ days: 1 }).toDate()];
}
