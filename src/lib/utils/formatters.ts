import { DEFAULT_LAUNDRY_MACHINE, LAUNDRY_MACHINES } from "$lib/types";

export function formatCurrency(amount: number) {
  if (amount === undefined || amount === null || isNaN(amount)) {
    console.warn("formatCurrency: invalid amount");
    return "₱0.00";
  }
  return amount.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP"
  });
}

export function formatAmount(amount: number) {
  if (amount === undefined || amount === null || isNaN(amount)) {
    console.warn("formatAmount: invalid amount");
    return "0.00";
  }
  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatAccounting(amount: number) {
  if (amount === undefined || amount === null || isNaN(amount)) {
    console.warn("formatAccounting: invalid amount");
    return "0.00";
  }
  const rounded = Math.round(amount * 100) / 100;
  const abs = Math.abs(rounded);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return rounded < 0 ? `(${formatted})` : formatted;
}

export function formatDate(dateStr: string) {
  if (!dateStr) {
    return "N/A";
  }
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr;
    }
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  } catch (e) {
    return dateStr;
  }
}

export function formatTime(timeInput: number | string): string {
  if (timeInput === undefined || timeInput === null || timeInput === "") {
    return "";
  }

  let totalMinutes = 0;
  if (typeof timeInput === "number") {
    totalMinutes = Math.round(timeInput * 60);
  } else {
    const str = timeInput.trim().toUpperCase();
    const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
    if (match) {
      let h = parseInt(match[1]);
      const m = parseInt(match[2]);
      const ampm = match[3];
      if (ampm === "PM" && h < 12) {
        h += 12;
      }
      if (ampm === "AM" && h === 12) {
        h = 0;
      }
      totalMinutes = h * 60 + m;
    } else {
      const parts = str.split(":");
      const h = parseInt(parts[0]) || 0;
      const m = parseInt(parts[1]) || 0;
      totalMinutes = h * 60 + m;
    }
  }

  const h24 = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const h12 = h24 % 12 || 12;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const mStr = m.toString().padStart(2, "0");
  return `${h12}:${mStr} ${ampm}`;
}

export function formatTimeRange(timeInput: number | string, clockFormat: "12h" | "24h"): string {
  if (timeInput === undefined || timeInput === null || timeInput === "") {
    return "";
  }

  let totalMinutes = 0;
  if (typeof timeInput === "number") {
    totalMinutes = Math.round(timeInput * 60);
  } else {
    const str = timeInput.trim().toUpperCase();
    const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
    if (match) {
      let h = parseInt(match[1]);
      const m = parseInt(match[2]);
      const ampm = match[3];
      if (ampm === "PM" && h < 12) {
        h += 12;
      }
      if (ampm === "AM" && h === 12) {
        h = 0;
      }
      totalMinutes = h * 60 + m;
    } else {
      const parts = str.split(":");
      const h = parseInt(parts[0]) || 0;
      const m = parseInt(parts[1]) || 0;
      totalMinutes = h * 60 + m;
    }
  }

  const h24 = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const mStr = m.toString().padStart(2, "0");

  if (clockFormat === "24h") {
    return `${h24.toString().padStart(2, "0")}:${mStr}`;
  }
  const h12 = h24 % 12 || 12;
  const ampm = h24 >= 12 ? "PM" : "AM";
  return `${h12}:${mStr} ${ampm}`;
}

export function pluralize(count: number, singular: string, plural: string) {
  const pr = new Intl.PluralRules("en-PH");
  const type = pr.select(count);
  const word = type === "one" ? singular : plural;
  return `${count} ${word}`;
}

export function laundryMachineLabel(machine?: string | null): string {
  const value = machine || DEFAULT_LAUNDRY_MACHINE;
  const found = LAUNDRY_MACHINES.find((m) => m.value === value);
  return found?.label || value;
}
