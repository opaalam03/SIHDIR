import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Calendar, Clock, BookOpen, Users, AlertTriangle, CheckCircle2, 
  Send, Copy, RefreshCw, Bell, ShieldAlert, Sparkles, Filter, Check, ExternalLink, FileText
} from "lucide-react";
import { 
  getStoredSchedules, 
  getTeacherMatchedSchedules, 
  groupSchedulesByDay, 
  calculateTeacherScheduleStats,
  getTodayTeachersScheduleStatus,
  buildWAAlarmBroadcastMessage,
  MatchedScheduleItem,
  getIndonesianDayName
} from "../utils/scheduleHelper";

interface TeacherScheduleAndWAAlarmProps {
  teacherName: string; // Profile name or username
  subject?: string;
  currentRole?: string;
  username?: string;
  additionalDuty?: string[];
  onNavigateToTab?: (tab: string) => void;
}

export function TeacherScheduleAndWAAlarm({ 
  teacherName, 
  subject, 
  currentRole,
  username,
  additionalDuty,
  onNavigateToTab 
}: TeacherScheduleAndWAAlarmProps) {
  const [selectedDayTab, setSelectedDayTab] = useState<string>("Semua");
  const [copied, setCopied] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  // Check authorization for WA Group Alarm & Pelaporan Keterlambatan
  // Only accessible to: Admin Utama, Admin TU, Kepsek, Waka Kesiswaan, Waka Kurikulum
  const isAuthorizedForWaAlarm = React.useMemo(() => {
    const role = (currentRole || "").trim().toLowerCase();
    const uname = (username || "").trim().toLowerCase();
    const duties = (additionalDuty || []).map(d => d.trim().toLowerCase());

    // 1. Admin Utama
    if (role === "admin" || uname === "admin" || uname.includes("arham")) return true;

    // 2. Admin Tata Usaha (TU)
    if (role === "tu" || uname === "tu" || duties.some(d => d.includes("tu") || d.includes("tata usaha"))) return true;

    // 3. Kepala Sekolah (Kepsek) - Removed WA Group alarm broadcast as requested by user
    if (role === "kepsek" || uname === "kepsek" || duties.some(d => d.includes("kepsek") || d.includes("kepala sekolah"))) return false;

    // 4. Waka Kesiswaan
    if (role === "kesiswaan" || uname === "kesiswaan" || duties.some(d => d.includes("kesiswaan"))) return true;

    // 5. Waka Kurikulum
    if (role === "kurikulum" || uname === "kurikulum" || duties.some(d => d.includes("kurikulum"))) return true;

    return false;
  }, [currentRole, username, additionalDuty]);

  // Load schedules matching current teacher
  const [allSchedules, setAllSchedules] = useState(() => getStoredSchedules());
  const matchedSchedules = getTeacherMatchedSchedules(teacherName, allSchedules);
  const stats = calculateTeacherScheduleStats(matchedSchedules);
  const groupedByDay = groupSchedulesByDay(matchedSchedules);

  // Today's WA Alarm Status
  const [todayStatus, setTodayStatus] = useState(() => getTodayTeachersScheduleStatus());
  const [waReport, setWaReport] = useState(() => buildWAAlarmBroadcastMessage());

  const todayDayName = getIndonesianDayName();

  // Refresh data function
  const handleRefreshData = () => {
    const updatedSchedules = getStoredSchedules();
    setAllSchedules(updatedSchedules);
    setTodayStatus(getTodayTeachersScheduleStatus());
    setWaReport(buildWAAlarmBroadcastMessage());
    setLastRefreshed(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  };

  useEffect(() => {
    handleRefreshData();
    // Listen for schedule updates from Master Data Manager
    const handleStorageUpdate = () => handleRefreshData();
    window.addEventListener("sihadir_data_updated", handleStorageUpdate);
    window.addEventListener("storage", handleStorageUpdate);
    return () => {
      window.removeEventListener("sihadir_data_updated", handleStorageUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, [teacherName]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(waReport.messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3500);
  };

  // Filtered schedule items for current day tab
  const displaySchedules: MatchedScheduleItem[] = selectedDayTab === "Semua" 
    ? matchedSchedules 
    : (groupedByDay[selectedDayTab] || []);

  return (
    <div className="space-y-6" id="teacher-schedule-wa-alarm-container">
      {/* 1. PERSONAL TEACHING SCHEDULE (JADWAL MENGAJAR TERKONEKSI DATA MASTER) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs relative overflow-hidden space-y-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/70 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        {/* Header */}
        <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-sm shrink-0">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-indigo-100 text-indigo-800 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-md border border-indigo-200">
                  Data Master Terkoneksi
                </span>
                <span className="text-slate-300 text-xs">|</span>
                <span className="text-xs font-bold text-slate-500">
                  SMKN 2 Konawe (T.A 2026/2027)
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-0.5 tracking-tight flex items-center gap-2 flex-wrap">
                <span>Jadwal Mengajar Anda</span>
                {stats.teacherCodeStr && (
                  <span className="text-xs font-black text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-md border border-indigo-200 font-mono">
                    Kode Guru: [{stats.teacherCodeStr}]
                  </span>
                )}
                <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  {matchedSchedules.length} Sesi Terdaftar
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Jadwal resmi mata pelajaran, kelas yang diajar, hari, dan alokasi jam mengajar terhubung otomatis dari Data Master Sekolah.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              type="button"
              onClick={handleRefreshData}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer border border-slate-200"
            >
              <RefreshCw className="h-3.5 w-3.5 text-indigo-600" />
              <span>Sinkronkan Jadwal</span>
            </button>
          </div>
        </div>

        {/* Schedule KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-3.5 rounded-2xl border border-indigo-100">
            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider block">Total Jam Pelajaran</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-indigo-950">{stats.totalJam}</span>
              <span className="text-xs font-bold text-indigo-700">JP / Minggu</span>
            </div>
            <span className="text-[9px] text-indigo-600 font-semibold block mt-0.5">
              Kode: {stats.teacherCodeStr ? `[${stats.teacherCodeStr}]` : "-"}
            </span>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-3.5 rounded-2xl border border-emerald-100">
            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">Total Kelas Diajar</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-950">{stats.classesCount}</span>
              <span className="text-xs font-bold text-emerald-800">Rombel</span>
            </div>
            <span className="text-[9px] text-emerald-700 font-semibold block mt-0.5 truncate" title={stats.classesList}>
              {stats.classesList || "Belum ada kelas"}
            </span>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-3.5 rounded-2xl border border-amber-100">
            <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">Mata Pelajaran Utama</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-amber-950">{stats.subjectsCount}</span>
              <span className="text-xs font-bold text-amber-800">Mapel</span>
            </div>
            <span className="text-[9px] text-amber-700 font-semibold block mt-0.5 truncate" title={stats.subjectsList}>
              {stats.subjectsList || subject || "Mapel Keahlian"}
            </span>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-3.5 rounded-2xl border border-blue-100">
            <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider block">Hari Mengajar Anda</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-blue-950">
                {Object.keys(groupedByDay).filter(d => groupedByDay[d].length > 0).length}
              </span>
              <span className="text-xs font-bold text-blue-800">Hari / Mgg</span>
            </div>
            <span className="text-[9px] text-blue-700 font-semibold block mt-0.5">
              Hari Ini: {todayDayName} ({groupedByDay[todayDayName]?.reduce((sum, item) => sum + (item.durationHours || 2), 0) || 0} JP)
            </span>
          </div>
        </div>

        {/* Day Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-100">
          <span className="text-xs font-bold text-slate-400 mr-2 shrink-0 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-indigo-500" /> Filter Hari:
          </span>
          {["Semua", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"].map((day) => {
            const countForDay = day === "Semua" ? matchedSchedules.length : (groupedByDay[day]?.length || 0);
            const isToday = day.toLowerCase() === todayDayName.toLowerCase();
            const isActive = selectedDayTab === day;

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDayTab(day)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-xs"
                    : isToday
                    ? "bg-amber-100 text-amber-900 border border-amber-300 font-extrabold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                }`}
              >
                <span>{day}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  isActive ? "bg-indigo-700 text-indigo-100" : "bg-slate-200 text-slate-700"
                }`}>
                  {countForDay}
                </span>
                {isToday && <span className="text-[9px] bg-amber-500 text-white px-1 rounded uppercase font-black">Hari Ini</span>}
              </button>
            );
          })}
        </div>

        {/* Schedule List Cards Grid */}
        {displaySchedules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displaySchedules.map((item, idx) => {
              const isTodaySchedule = item.day.trim().toLowerCase() === todayDayName.toLowerCase();

              return (
                <div 
                  key={item.id || idx}
                  className={`p-4 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between gap-3 ${
                    isTodaySchedule
                      ? "bg-gradient-to-br from-indigo-50/50 to-white border-indigo-200 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {isTodaySchedule && (
                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl-xl shadow-2xs">
                      Mengajar Hari Ini
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {item.day}
                      </span>
                      <span className="text-xs font-black text-indigo-900 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-indigo-500" />
                        {item.period}
                      </span>
                      {(item.teacherCode || item.teacherId) && (
                        <span className="text-[9.5px] font-mono font-black text-indigo-800 bg-indigo-100 border border-indigo-200 px-1.5 py-0.2 rounded">
                          [{item.teacherCode || item.teacherId.toUpperCase()}]
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-extrabold text-slate-900 line-clamp-2 leading-snug">
                      {item.subject}
                    </h4>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <span className="font-bold text-slate-600 flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-emerald-500" />
                        Kelas: <strong className="text-slate-900 font-extrabold">{item.className}</strong>
                      </span>
                      <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {item.durationHours || 2} JP
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium truncate max-w-[170px]" title={item.teacherName}>
                      Guru: <strong>{item.teacherName}</strong>
                    </span>
                    {isTodaySchedule ? (
                      <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Terkoneksi
                      </span>
                    ) : (
                      <span className="text-slate-400 font-semibold shrink-0">Terschedule</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <Calendar className="h-8 w-8 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-700">Tidak ada jadwal mengajar pada pilihan filter hari ini.</p>
            <p className="text-[11px] text-slate-400">Pilih tab "Semua" untuk melihat keseluruhan jadwal Anda.</p>
          </div>
        )}
      </div>

      {/* 2. WA GROUP ALARM & AUTOMATED REPORT NOTIFICATION (ALARM KEHADIRAN KBM KE GRUP WA) */}
      {isAuthorizedForWaAlarm && (
        <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-md relative overflow-hidden space-y-5">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header */}
        <div className="border-b border-white/10 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-emerald-500 text-slate-950 rounded-2xl shadow-sm shrink-0 font-black">
              <Bell className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-emerald-400/20 text-emerald-300 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-md border border-emerald-400/30">
                  Alarm & Notifikasi WA Guru
                </span>
                <span className="text-slate-500 text-xs">|</span>
                <span className="text-xs font-bold text-emerald-200">
                  Pemantauan KBM Hari Ini ({todayDayName})
                </span>
              </div>
              <h3 className="text-lg font-black text-white mt-0.5 tracking-tight flex items-center gap-2">
                <span>Pelaporan Keterlambatan & Presensi Guru Ke Grup WA</span>
              </h3>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Sistem otomatis mendeteksi guru yang memiliki jam mengajar hari ini namun belum absen atau terlambat masuk kelas, lalu menyiapkan format pesan alarm untuk Grup WA Guru.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              type="button"
              onClick={handleRefreshData}
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer border border-white/15"
            >
              <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
              <span>Cek Status Terbaru</span>
            </button>
          </div>
        </div>

        {/* Alarm Monitor Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Terjadwal Hari Ini ({todayDayName})</span>
              <span className="text-2xl font-black text-white mt-1 block">{todayStatus.scheduledToday.length} Jam</span>
            </div>
            <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">Sudah Absen & Masuk Kelas</span>
              <span className="text-2xl font-black text-emerald-400 mt-1 block">{todayStatus.hadirCount} Guru</span>
            </div>
            <div className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-xl">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-rose-500/20 border border-rose-500/40 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider block">Belum Absen / Terlambat</span>
              <span className="text-2xl font-black text-rose-400 mt-1 block">
                {todayStatus.scheduledToday.length - todayStatus.hadirCount} Guru
              </span>
            </div>
            <div className="p-2.5 bg-rose-500/30 text-rose-300 rounded-xl">
              <AlertTriangle className="h-5 w-5 animate-bounce" />
            </div>
          </div>
        </div>

        {/* Live List of Scheduled Teachers for Today */}
        <div className="space-y-2">
          <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="h-4 w-4 text-emerald-400" />
            Status Kehadiran Mengajar Guru Hari Ini ({todayDayName}):
          </h4>

          {todayStatus.scheduledToday.length > 0 ? (
            <div className="max-h-52 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-white/20">
              {todayStatus.scheduledToday.map((item, idx) => {
                const isHadir = item.status === "HADIR";
                const isLate = item.status === "TERLAMBAT";

                return (
                  <div 
                    key={idx}
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs transition-colors ${
                      isHadir 
                        ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-100" 
                        : isLate
                        ? "bg-rose-950/50 border-rose-500/50 text-rose-100"
                        : "bg-amber-950/40 border-amber-500/40 text-amber-100"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="font-extrabold text-sm">{item.teacherName}</strong>
                        <span className="text-[10px] px-2 py-0.2 rounded font-black bg-white/10 uppercase">
                          {item.className}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-80">
                        {item.subject} | <span className="font-bold">{item.period}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {isHadir ? (
                        <span className="bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase flex items-center gap-1">
                          <Check className="h-3 w-3" /> Sudah Absen / Mengajar
                        </span>
                      ) : isLate ? (
                        <span className="bg-rose-600 text-white px-2.5 py-1 rounded-lg font-black text-[10px] uppercase flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="h-3 w-3" /> Terlambat Masuk Kelas
                        </span>
                      ) : (
                        <span className="bg-amber-500 text-slate-950 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Belum Absen KBM
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-white/5 text-center text-xs text-slate-400">
              Tidak ada jam pelajaran KBM terjadwal untuk hari {todayDayName}.
            </div>
          )}
        </div>

        {/* WA Broadcast Message Action Box */}
        <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/10 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="text-xs font-black text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
              <Send className="h-4 w-4" />
              Format Teks Laporan Alarm Ke Grup WA Guru:
            </label>
            {copied && (
              <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                <Check className="h-3 w-3" /> Teks Berhasil Disalin!
              </span>
            )}
          </div>

          <textarea
            readOnly
            rows={6}
            value={waReport.messageText}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none scrollbar-thin"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer border border-white/15"
            >
              <Copy className="h-4 w-4 text-emerald-400" />
              <span>{copied ? "Berhasil Disalin" : "Salin Pesan WA"}</span>
            </button>

            <a
              href={waReport.waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-md transition-all hover:scale-102 cursor-pointer"
            >
              <Send className="h-4 w-4 fill-current" />
              <span>Kirim Alarm Peringatan Ke Grup WA Guru</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
