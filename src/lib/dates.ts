const TZ = "Europe/Dublin";

const dateFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("fa-IR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const gregorianFmt = new Intl.DateTimeFormat("fa-IR-u-ca-gregory", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** e.g. "۹ آبان ۱۴۰۵، ساعت ۱۴:۳۰" (Dublin time) */
export function formatFaDateTime(iso: string): string {
  const d = new Date(iso);
  return `${dateFmt.format(d)}، ساعت ${timeFmt.format(d)}`;
}

export function formatFaDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** e.g. "۳۱ اکتبر ۲۰۲۶" — useful next to the Persian date because Irish deadlines use Gregorian dates. */
export function formatGregorianFa(iso: string): string {
  return gregorianFmt.format(new Date(iso));
}

const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });

export function relativeFa(iso: string, now: Date = new Date()): string {
  const diffSec = (new Date(iso).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diffSec);
  if (abs < 60) return "همین حالا";
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), "day");
  return formatFaDate(iso);
}
