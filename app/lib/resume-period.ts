export type ParsedResumePeriod =
  | {
      parsed: true;
      startMonth: string;
      endMonth: string;
      present: boolean;
      original: string;
    }
  | { parsed: false; original: string };

const MONTH_TOKEN = /(\d{4})\s*(?:[.\-/年])\s*(\d{1,2})\s*(?:月)?/g;
const PRESENT_PATTERN = /(?:至今|现在|present|current|now)\s*$/i;

function normalizeMonth(year: string, month: string) {
  const numericMonth = Number(month);
  if (numericMonth < 1 || numericMonth > 12) return null;
  return `${year}-${String(numericMonth).padStart(2, "0")}`;
}

export function parseResumePeriod(value: string): ParsedResumePeriod {
  const original = value;
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      parsed: true,
      startMonth: "",
      endMonth: "",
      present: false,
      original,
    };
  }

  const months = Array.from(trimmed.matchAll(MONTH_TOKEN))
    .map((match) => normalizeMonth(match[1], match[2]))
    .filter((month): month is string => Boolean(month));
  const present = PRESENT_PATTERN.test(trimmed);

  if (months.length === 1 && present) {
    return {
      parsed: true,
      startMonth: months[0],
      endMonth: "",
      present: true,
      original,
    };
  }
  if (months.length === 2 && !present) {
    return {
      parsed: true,
      startMonth: months[0],
      endMonth: months[1],
      present: false,
      original,
    };
  }
  if (
    months.length === 1 &&
    /^\d{4}\s*(?:[.\-/年])\s*\d{1,2}\s*(?:月)?$/.test(trimmed)
  ) {
    return {
      parsed: true,
      startMonth: months[0],
      endMonth: "",
      present: false,
      original,
    };
  }
  return { parsed: false, original };
}

export function validateMonthRange(
  startMonth: string,
  endMonth: string,
  present: boolean,
) {
  if (!startMonth) return "请选择开始月份";
  if (present) return "";
  if (!endMonth) return "请选择结束月份或勾选至今";
  if (endMonth < startMonth) return "结束月份不能早于开始月份";
  return "";
}

export function formatResumePeriod(
  startMonth: string,
  endMonth: string,
  present: boolean,
) {
  if (validateMonthRange(startMonth, endMonth, present)) return "";
  const display = (month: string) => month.replace("-", ".");
  return `${display(startMonth)} - ${present ? "至今" : display(endMonth)}`;
}
