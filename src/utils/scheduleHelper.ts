import { TeachingSchedule, TeacherAttendance, JurnalMengajar } from "../types";
import { OFFICIAL_SMKN2_SCHEDULES } from "../data/translatedSchedules";

export interface MatchedScheduleItem extends TeachingSchedule {
  timeRange?: string; // e.g. "07:55 - 09:55"
  durationHours?: number; // e.g. 2
  statusToday?: "HADIR" | "BELUM_ABSEN" | "TERLAMBAT";
}

export interface TeacherDailyStatus {
  teacherName: string;
  className: string;
  subject: string;
  day: string;
  period: string;
  timeRange: string;
  status: "HADIR" | "BELUM_ABSEN" | "TERLAMBAT";
  clockInTime?: string;
}

// Convert OFFICIAL_SMKN2_SCHEDULES to TeachingSchedule array
export function getDefaultMasterSchedules(): TeachingSchedule[] {
  return OFFICIAL_SMKN2_SCHEDULES.map((item, idx) => ({
    id: `sch-master-${idx + 1}`,
    teacherId: item.teacherCode.toLowerCase(),
    teacherCode: item.teacherCode,
    teacherName: item.teacherName,
    subject: item.subjectName,
    className: item.className,
    day: item.day,
    period: `${item.period} (${item.time})`,
    semester: "Ganjil 2026/2027"
  }));
}

// Get all schedules from localStorage or fallback
export function getStoredSchedules(): TeachingSchedule[] {
  const defaults = getDefaultMasterSchedules();
  try {
    const saved = localStorage.getItem("simpati_teaching_schedules");
    if (saved) {
      const parsed = JSON.parse(saved);
      // If stored array is valid and has at least as many items as current master matrix
      if (Array.isArray(parsed) && parsed.length >= OFFICIAL_SMKN2_SCHEDULES.length) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error reading simpati_teaching_schedules:", e);
  }
  
  try {
    localStorage.setItem("simpati_teaching_schedules", JSON.stringify(defaults));
  } catch (e) {
    console.warn("Could not seed simpati_teaching_schedules:", e);
  }
  return defaults;
}

// Clean and normalize strings for robust teacher name matching
export function normalizeName(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/s\.pd\.|m\.pd\.|s\.ag|st|se\.|s\.si|s\.kom|drs\.|dr\.|b\.|\,/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Match teacher schedules by full name, username, or teacher code
export function getTeacherMatchedSchedules(
  teacherNameOrUsername: string,
  allSchedules?: TeachingSchedule[]
): MatchedScheduleItem[] {
  const schedules = allSchedules || getStoredSchedules();
  const inputNorm = normalizeName(teacherNameOrUsername);

  if (!inputNorm) return [];

  // Alias checks for special role usernames
  let aliasTokens: string[] = [];
  if (inputNorm.includes("kesiswaan") || inputNorm.includes("nyoman") || inputNorm.includes("suliawati")) {
    aliasTokens = ["nyoman", "suliawati", "nym"];
  } else if (inputNorm.includes("kurikulum") || inputNorm.includes("asrul")) {
    aliasTokens = ["asrul", "aau"];
  } else if (inputNorm.includes("muslimin")) {
    aliasTokens = ["muslimin", "mus"];
  } else if (inputNorm.includes("haerul")) {
    aliasTokens = ["haerul", "hrl"];
  } else if (inputNorm.includes("isnawati")) {
    aliasTokens = ["isnawati", "isn"];
  } else if (inputNorm.includes("juniyasa") || inputNorm.includes("putu")) {
    aliasTokens = ["juniyasa", "jys"];
  } else if (inputNorm.includes("askin")) {
    aliasTokens = ["askin", "akn"];
  } else if (inputNorm.includes("triana")) {
    aliasTokens = ["triana", "trd"];
  } else if (inputNorm.includes("khotijah") || inputNorm.includes("sitti")) {
    aliasTokens = ["khotijah", "skh"];
  } else if (inputNorm.includes("salmah")) {
    aliasTokens = ["salmah", "slm"];
  } else if (inputNorm.includes("evasyahtriana") || inputNorm.includes("eva")) {
    aliasTokens = ["evasyahtriana", "eva"];
  } else if (inputNorm.includes("saiman")) {
    aliasTokens = ["saiman", "smn"];
  } else if (inputNorm.includes("arham")) {
    aliasTokens = ["arham", "arh"];
  } else if (inputNorm.includes("hiswan")) {
    aliasTokens = ["hiswan", "his"];
  } else if (inputNorm.includes("syamsul")) {
    aliasTokens = ["syamsul", "ssr"];
  } else if (inputNorm.includes("elis")) {
    aliasTokens = ["elis", "els"];
  } else if (inputNorm.includes("munatar")) {
    aliasTokens = ["munatar", "mut"];
  } else if (inputNorm.includes("himawan") || inputNorm.includes("gusti")) {
    aliasTokens = ["himawan", "ghk"];
  } else if (inputNorm.includes("izzat")) {
    aliasTokens = ["izzat", "iwz"];
  } else {
    // Break input into key name tokens (excluding 1-2 char words if longer words exist)
    aliasTokens = inputNorm.split(" ").filter(t => t.length > 2);
  }

  const matched = schedules.filter(sch => {
    const schNameNorm = normalizeName(sch.teacherName);
    const schIdNorm = normalizeName(sch.teacherId);

    // Direct string match
    if (schNameNorm.includes(inputNorm) || inputNorm.includes(schNameNorm)) {
      return true;
    }

    // Token match
    return aliasTokens.some(token => schNameNorm.includes(token) || schIdNorm === token);
  });

  // Calculate duration in hours & parse time range
  return matched.map(sch => {
    let durationHours = 2; // default 2 jam pelajaran

    // Parse Jam range e.g. "Jam 1-4", "Jam 2-4", "Jam 5-8", "Jam 7-9"
    const jamRangeMatch = sch.period.match(/Jam\s*(\d+)-(\d+)/i);
    if (jamRangeMatch) {
      const startJam = parseInt(jamRangeMatch[1], 10);
      const endJam = parseInt(jamRangeMatch[2], 10);
      durationHours = Math.max(1, endJam - startJam + 1);
    }

    // Extract time inside parentheses or match standard formats
    const timeMatch = sch.period.match(/\((.*?)\)/);
    const timeRange = (timeMatch && timeMatch[1]) ? timeMatch[1].trim() : sch.period;

    // Preserve teacher code e.g. "MUS", "ISN"
    const teacherCode = sch.teacherCode || sch.teacherId?.toUpperCase() || "";

    return {
      ...sch,
      teacherCode,
      timeRange,
      durationHours
    };
  });
}

import { getWaliKelasPerwalianClass } from "../data/waliKelasData";

// Get the primary perwalian / homeroom class for a teacher by name or username
export function getTeacherPerwalianClass(teacherNameOrUsername: string): string | null {
  if (!teacherNameOrUsername) return null;

  // Check official Wali Kelas assignment list first
  const waliKelasMatch = getWaliKelasPerwalianClass(teacherNameOrUsername);
  if (waliKelasMatch) return waliKelasMatch;

  // Check matched teaching schedules fallback
  const matchedSchedules = getTeacherMatchedSchedules(teacherNameOrUsername);
  if (matchedSchedules.length > 0) {
    const classes = Array.from(new Set(matchedSchedules.map(s => s.className.trim()))).filter(Boolean);
    if (classes.length > 0) {
      return classes[0];
    }
  }

  return null;
}

// Get current day name in Indonesian
export function getIndonesianDayName(dateObj: Date = new Date()): string {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[dateObj.getDay()] || "Senin";
}

// Group schedules by day order
export function groupSchedulesByDay(schedules: MatchedScheduleItem[]): Record<string, MatchedScheduleItem[]> {
  const dayOrder = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const grouped: Record<string, MatchedScheduleItem[]> = {};

  dayOrder.forEach(day => {
    grouped[day] = schedules.filter(s => s.day.trim().toLowerCase() === day.toLowerCase());
  });

  return grouped;
}

// Calculate schedule statistics
export function calculateTeacherScheduleStats(schedules: MatchedScheduleItem[]) {
  const totalJam = schedules.reduce((acc, curr) => acc + (curr.durationHours || 2), 0);
  const classes = Array.from(new Set(schedules.map(s => s.className.trim()))).filter(Boolean);
  const subjects = Array.from(new Set(schedules.map(s => s.subject.trim()))).filter(Boolean);
  const codes = Array.from(new Set(schedules.map(s => s.teacherCode || s.teacherId?.toUpperCase()).filter(Boolean)));

  return {
    totalJam,
    totalJadwal: schedules.length,
    classesCount: classes.length,
    classesList: classes.join(", "),
    subjectsCount: subjects.length,
    subjectsList: subjects.join(", "),
    teacherCodeStr: codes.join(", ")
  };
}

// Check attendance status for all teachers scheduled TODAY
export function getTodayTeachersScheduleStatus(targetDay?: string): {
  todayDay: string;
  scheduledToday: TeacherDailyStatus[];
  belumAbsenCount: number;
  hadirCount: number;
  terlambatCount: number;
} {
  const todayDay = targetDay || getIndonesianDayName();
  const allSchedules = getStoredSchedules();
  const todaySchedules = allSchedules.filter(s => s.day.trim().toLowerCase() === todayDay.toLowerCase());

  // Load teacher attendance logs from localStorage
  let attendanceLogs: TeacherAttendance[] = [];
  try {
    const savedAtt = localStorage.getItem("simpati_teacher_attendance_logs");
    if (savedAtt) {
      attendanceLogs = JSON.parse(savedAtt);
    }
  } catch (e) {
    console.error("Error reading attendance logs:", e);
  }

  // Load journals logs
  let journalLogs: JurnalMengajar[] = [];
  try {
    const savedJurnal = localStorage.getItem("simpati_jurnal_mengajar_logs");
    if (savedJurnal) {
      journalLogs = JSON.parse(savedJurnal);
    }
  } catch (e) {
    console.error("Error reading journal logs:", e);
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const scheduledToday: TeacherDailyStatus[] = todaySchedules.map(sch => {
    const schNameNorm = normalizeName(sch.teacherName);

    // Check if teacher logged attendance today
    const attLog = attendanceLogs.find(log => {
      const logNameNorm = normalizeName(log.teacherName);
      return (logNameNorm.includes(schNameNorm) || schNameNorm.includes(logNameNorm)) &&
             (log.date === todayStr || log.date === new Date().toLocaleDateString("id-ID"));
    });

    // Check if teacher submitted a teaching journal today
    const journalLog = journalLogs.find(j => {
      return j.className.trim().toLowerCase() === sch.className.trim().toLowerCase() &&
             j.subject.trim().toLowerCase() === sch.subject.trim().toLowerCase();
    });

    let status: "HADIR" | "BELUM_ABSEN" | "TERLAMBAT" = "BELUM_ABSEN";
    let clockInTime = attLog ? attLog.clockIn : undefined;

    if (attLog || journalLog) {
      status = "HADIR";
    } else {
      // Check if schedule time has passed 07:30 WITA
      if (currentHour > 8 || (currentHour === 8 && currentMinute > 0)) {
        status = "TERLAMBAT";
      } else {
        status = "BELUM_ABSEN";
      }
    }

    return {
      teacherName: sch.teacherName,
      className: sch.className,
      subject: sch.subject,
      day: sch.day,
      period: sch.period,
      timeRange: sch.period,
      status,
      clockInTime
    };
  });

  const belumAbsenCount = scheduledToday.filter(s => s.status === "BELUM_ABSEN").length;
  const hadirCount = scheduledToday.filter(s => s.status === "HADIR").length;
  const terlambatCount = scheduledToday.filter(s => s.status === "TERLAMBAT").length;

  return {
    todayDay,
    scheduledToday,
    belumAbsenCount,
    hadirCount,
    terlambatCount
  };
}

// Build WhatsApp broadcast text and WhatsApp share link
export function buildWAAlarmBroadcastMessage(): { messageText: string; waLink: string } {
  const statusInfo = getTodayTeachersScheduleStatus();
  const todayFormatted = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const belumAbsenOrLate = statusInfo.scheduledToday.filter(s => s.status !== "HADIR");
  const hadirList = statusInfo.scheduledToday.filter(s => s.status === "HADIR");

  let msg = `*📢 ALARM & REKAP KBM GURU SMKN 2 KONAWE*\n`;
  msg += `📅 *Hari/Tanggal:* ${todayFormatted}\n`;
  msg += `⏰ *Sistem Waktu:* Presensi Harian & Jam Mengajar KBM\n\n`;

  msg += `📊 *RINGKASAN KEHADIRAN KBM HARI INI:*\n`;
  msg += `• Total Terjadwal: ${statusInfo.scheduledToday.length} Jam Pelajaran\n`;
  msg += `• Sudah Hadir/Mengisi Presensi: ${statusInfo.hadirCount} Guru\n`;
  msg += `• Belum Absen / Terlambat Masuk Kelas: ${belumAbsenOrLate.length} Guru\n\n`;

  if (belumAbsenOrLate.length > 0) {
    msg += `*🚨 DAFTAR GURU BELUM ABSEN / TERLAMBAT MASUK KELAS:*\n`;
    belumAbsenOrLate.forEach((item, idx) => {
      const statusIcon = item.status === "TERLAMBAT" ? "⚠️ [TERLAMBAT MASUK KELAS]" : "❌ [BELUM ABSEN]";
      msg += `${idx + 1}. *${item.teacherName}*\n`;
      msg += `   📚 Mapel: ${item.subject}\n`;
      msg += `   🏫 Kelas: ${item.className} | ⏱️ ${item.period}\n`;
      msg += `   Status: ${statusIcon}\n\n`;
    });
  } else {
    msg += `✨ *Luar Biasa! Semua Guru Terjadwal Hari Ini Sudah Masuk Kelas & Mengisi Presensi Tepat Waktu.* 🎉\n\n`;
  }

  if (hadirList.length > 0) {
    msg += `*✅ DAFTAR GURU SUDAH ABSEN & HADIR DI KELAS:*\n`;
    hadirList.slice(0, 10).forEach((item, idx) => {
      msg += `${idx + 1}. ${item.teacherName} - Kelas ${item.className} (${item.subject})\n`;
    });
    if (hadirList.length > 10) {
      msg += `...dan ${hadirList.length - 10} guru lainnya.\n`;
    }
    msg += `\n`;
  }

  msg += `*Himbauan:* Mohon Bapak/Ibu Guru yang bertugas segera melakukan presensi lokasi dan mengisi Jurnal KBM. Terima Kasih 🙏\n\n`;
  msg += `_Laporan Otomatis Aplikasi SiHadir SMKN 2 Konawe_`;

  const encodedMsg = encodeURIComponent(msg);
  const waLink = `https://api.whatsapp.com/send?text=${encodedMsg}`;

  return {
    messageText: msg,
    waLink
  };
}
