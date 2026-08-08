export const BETA_ACTIVE_WINDOW_DAYS = 30;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function latestDate(dates: Array<Date | null | undefined>) {
  return dates.reduce<Date | null>((latest, date) => {
    if (!date || (latest && latest.getTime() >= date.getTime())) {
      return latest;
    }

    return date;
  }, null);
}

export function isBetaTesterActive(
  latestActivity: Date | null,
  now = new Date(),
) {
  if (!latestActivity) {
    return false;
  }

  const activeSince =
    now.getTime() - BETA_ACTIVE_WINDOW_DAYS * DAY_IN_MILLISECONDS;

  return latestActivity.getTime() >= activeSince;
}
