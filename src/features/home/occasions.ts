// Occasion detection for the home greeting — the traveler's birthday plus US
// holidays. Pure + deterministic (date passed in, never read here) so it's
// unit-testable and react-compiler-safe.

export interface Occasion {
  key: string;
  emoji: string;
  /** Festive greeting, e.g. "Happy Birthday" or "Happy Fourth of July". */
  greeting: string;
}

const FIXED: Record<string, Occasion> = {
  '1-1': { key: 'newyear', emoji: '🎉', greeting: 'Happy New Year' },
  '2-14': { key: 'valentines', emoji: '💝', greeting: "Happy Valentine's Day" },
  '3-17': { key: 'stpatricks', emoji: '☘️', greeting: "Happy St. Patrick's Day" },
  '6-19': { key: 'juneteenth', emoji: '🕊️', greeting: 'Happy Juneteenth' },
  '7-4': { key: 'independence', emoji: '🎆', greeting: 'Happy Fourth of July' },
  '10-31': { key: 'halloween', emoji: '🎃', greeting: 'Happy Halloween' },
  '11-11': { key: 'veterans', emoji: '🎖️', greeting: 'Happy Veterans Day' },
  '12-24': { key: 'christmaseve', emoji: '🎄', greeting: 'Merry Christmas Eve' },
  '12-25': { key: 'christmas', emoji: '🎄', greeting: 'Merry Christmas' },
  '12-31': { key: 'nye', emoji: '🥂', greeting: "Happy New Year's Eve" },
};

/** Nth weekday of a month (weekday 0=Sun). n=-1 → last weekday of the month. */
function nthWeekday(year: number, month1: number, weekday: number, n: number): number {
  if (n === -1) {
    const last = new Date(year, month1, 0).getDate(); // last day of month1
    for (let d = last; d >= 1; d--) {
      if (new Date(year, month1 - 1, d).getDay() === weekday) return d;
    }
    return 1;
  }
  let count = 0;
  const days = new Date(year, month1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    if (new Date(year, month1 - 1, d).getDay() === weekday) {
      count += 1;
      if (count === n) return d;
    }
  }
  return 1;
}

/** Computed (floating) US holidays for a given year → "M-D" key. */
function computedHolidays(year: number): Record<string, Occasion> {
  const mlk = nthWeekday(year, 1, 1, 3); // 3rd Mon Jan
  const memorial = nthWeekday(year, 5, 1, -1); // last Mon May
  const labor = nthWeekday(year, 9, 1, 1); // 1st Mon Sep
  const thanksgiving = nthWeekday(year, 11, 4, 4); // 4th Thu Nov
  return {
    [`1-${mlk}`]: { key: 'mlk', emoji: '🕊️', greeting: 'Honoring Dr. King today' },
    [`5-${memorial}`]: { key: 'memorial', emoji: '🇺🇸', greeting: 'Memorial Day' },
    [`9-${labor}`]: { key: 'labor', emoji: '🛠️', greeting: 'Happy Labor Day' },
    [`11-${thanksgiving}`]: { key: 'thanksgiving', emoji: '🦃', greeting: 'Happy Thanksgiving' },
  };
}

/** Extract "M-D" from a birthday string ("MM-DD" or "YYYY-MM-DD"). */
function birthdayMD(birthday: string): string | null {
  const m = birthday.trim().match(/^(?:\d{4}-)?(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  return `${Number(m[1])}-${Number(m[2])}`;
}

/**
 * The occasion to celebrate on `date`, if any. Birthday wins over a holiday on a
 * shared day. `birthday` is optional ("MM-DD" or "YYYY-MM-DD").
 */
export function occasionFor(date: Date, birthday?: string | null): Occasion | null {
  const md = `${date.getMonth() + 1}-${date.getDate()}`;
  if (birthday) {
    const bmd = birthdayMD(birthday);
    if (bmd && bmd === md) return { key: 'birthday', emoji: '🎂', greeting: 'Happy Birthday' };
  }
  return FIXED[md] ?? computedHolidays(date.getFullYear())[md] ?? null;
}
