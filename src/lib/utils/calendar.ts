export function computeDaysAgo(a: Date, b: Date) {
  const diffTime = Math.abs(b.getTime() - a.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function checkIsPast(date: string, timeEnd: string) {
  if (!date || !timeEnd) {
    return false;
  }
  try {
    const [y, m, d] = date.split(/[-/]/).map(Number);
    const timeParts = timeEnd.split(/[:\s]/);
    let h = parseInt(timeParts[0]);
    const min = parseInt(timeParts[1]);

    if (timeEnd.toLowerCase().includes("pm") && h < 12) {
      h += 12;
    }
    if (timeEnd.toLowerCase().includes("am") && h === 12) {
      h = 0;
    }

    const endTime = new Date(y, m - 1, d, h, min);
    return endTime.getTime() <= new Date().getTime();
  } catch {
    return false;
  }
}

export function formatCalendarTime(resDate: string, resTime: string) {
  const dateClean = resDate.replace(/[-/]/g, "");
  const str = resTime.trim().toUpperCase();
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);

  let h = 0;
  let m = "00";

  if (match) {
    h = parseInt(match[1]);
    m = match[2];
    const ampm = match[3];
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
  } else {
    const parts = resTime.split(":");
    h = parseInt(parts[0]) || 0;
    m = parts[1]?.split(" ")[0] || "00";
  }

  const hStr = h.toString().padStart(2, "0");
  const mStr = m.padStart(2, "0");
  return dateClean + "T" + hStr + mStr + "00";
}

export function generateIcsFile(res: any, brandingShortName: string) {
  const start = formatCalendarTime(res.date, res.timeStart);
  const end = formatCalendarTime(res.date, res.timeEnd);
  const machineLabel = res.machineLabel || res.machine || "";
  const location = ["Laundry Area", machineLabel].filter(Boolean).join(" - ");

  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HAOne/NONSGML//EN",
    "BEGIN:VEVENT",
    `UID:${res.id}@haone.uplb.edu.ph`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `SUMMARY:${brandingShortName} | Laundry Reservation (${res.name})`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `DESCRIPTION:Laundry slot for ${res.name} (${machineLabel})`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `laundry-${res.date}-${res.timeStart.replace(":", "")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getGoogleCalendarUrl(res: any, brandingShortName: string) {
  const start = formatCalendarTime(res.date, res.timeStart);
  const end = formatCalendarTime(res.date, res.timeEnd);
  const machineLabel = res.machineLabel || res.machine || "";
  const location = ["Laundry Area", machineLabel].filter(Boolean).join(" - ");
  const details = `Laundry slot for ${res.name} (${machineLabel})`;
  const title = `${brandingShortName} | Laundry Reservation`;
  const timezone = "Asia/Manila";
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}&ctz=${timezone}`;
}
