/**
 * Check if current time is within Vietnam (UTC+7) working hours.
 * Working hours: Monday-Friday, 8:30 AM - 5:00 PM UTC+7.
 */
export function isWithinWorkingHours(now: Date = new Date()): boolean {
  // Convert to UTC+7 (Vietnam timezone)
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000
  const vietnamTime = new Date(utc + 7 * 3_600_000)

  const day = vietnamTime.getDay() // 0 = Sunday, 6 = Saturday
  const hours = vietnamTime.getHours()
  const minutes = vietnamTime.getMinutes()
  const totalMinutes = hours * 60 + minutes

  const isWeekday = day >= 1 && day <= 5
  const isWorkingTime = totalMinutes >= 510 && totalMinutes < 1020 // 8:30 (510min) to 17:00 (1020min)

  return isWeekday && isWorkingTime
}
