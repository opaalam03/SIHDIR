/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Navigation } from "./components/Navigation";
import { KurikulumHub } from "./components/KurikulumHub";
import { AttendanceTeacher } from "./components/AttendanceTeacher";
import { JurnalMengajarInput, PenilaianAnalisis } from "./components/JurnalPenilaian";
import { KarakterAnalisis } from "./components/KarakterDanPkl";
import { StudentAttendance } from "./components/StudentAttendance";
import { KomunikasiOrangTua } from "./components/KomunikasiOrangTua";
import { GuruChat } from "./components/AiCompanionChat";
import { SchoolChatMessenger } from "./components/SchoolChatMessenger";
import { LoginScreen } from "./components/LoginScreen";
import { MasterDataManager } from "./components/MasterDataManager";
import { QuickRoleSwitcher } from "./components/QuickRoleSwitcher";
import { LaporanNilaiSiswa } from "./components/LaporanNilaiSiswa";
import { RekapLaporan } from "./components/RekapLaporan";
import { KetuaKelasDashboard } from "./components/KetuaKelasDashboard";
import { StudentReflection } from "./components/StudentReflection";
import { TeacherDashboard } from "./components/TeacherDashboard";
import StudentProfileManager from "./components/StudentProfileManager";
import { GuruPiketDashboard, checkIsPiketDutyToday } from "./components/GuruPiketDashboard";
import { WaliKelasWorkspace } from "./components/WaliKelasWorkspace";
import { GuruWaliWorkspace } from "./components/GuruWaliWorkspace";
import { ArsipSuratDigital } from "./components/ArsipSuratDigital";
import { KelasBimbinganManager } from "./components/KelasBimbinganManager";
import { StudentViolationCreditManager } from "./components/StudentViolationCreditManager";
import { QrScannerModal } from "./components/QrScannerModal";
import { GraduationCap, Settings2, UserCheck, Shield, QrCode, Palette } from "lucide-react";
import { getStudentCaptainClass } from "./data/classCaptains";
import { MOCK_STUDENTS } from "./mockData";
import { SIHADIR_THEMES, ThemeId } from "./utils/themeConfig";
import { DraggableThemeWidget } from "./components/DraggableThemeWidget";
import { DigitalClockWidget } from "./components/DigitalClockWidget";
import { startAttendanceAutomations, stopAttendanceAutomations } from "./services/whatsappFonnteService";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("sihadir_authenticated") === "true";
  });
  const [authUsername, setAuthUsername] = useState<string>(() => {
    return localStorage.getItem("sihadir_username") || "";
  });
  const [currentRole, setCurrentRole] = useState<string>(() => {
    return localStorage.getItem("sihadir_role") || "guru";
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = localStorage.getItem("sihadir_active_tab");
    if (saved === "student-profile") return "student-attendance";
    return saved || "student-attendance";
  });
  const [isAutomotive, setIsAutomotive] = useState<boolean>(true);
  const [, setStorageTrigger] = useState<number>(0);

  const [appTheme, setAppTheme] = useState<ThemeId>(() => {
    const saved = localStorage.getItem("sihadir_bg_theme") as ThemeId;
    if (saved && SIHADIR_THEMES[saved]) return saved;
    return "blue-white";
  });

  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const [isGlobalQrScannerOpen, setIsGlobalQrScannerOpen] = useState(false);
  const [piketAlertModal, setPiketAlertModal] = useState<{ title: string; message: string } | null>(null);

  const handleOpenGlobalQrScanner = () => {
    if (currentRole === "piket") {
      const dutyStatus = checkIsPiketDutyToday(authUsername);
      if (!dutyStatus.isDutyToday) {
        setPiketAlertModal({
          title: "⛔ AKSES SCAN QR KEHADIRAN DITOLAK",
          message: `Maaf, Anda (${authUsername || 'Guru Piket'}) hanya berwenang melakukan Scan QR Kehadiran Siswa pada HARI PIKET Anda (${dutyStatus.assignedDays.join(", ")}).\n\nHari ini adalah hari ${dutyStatus.todayDay}. Di luar hari piket Anda, Kios Scanner QR Kehadiran Siswa dikunci.\n\nJika Anda bertugas menggantikan rekan guru lain hari ini, silakan sesuaikan 'Setel Hari Piket' pada menu Workspace Guru Piket.`
        });
        return;
      }
    }
    setIsGlobalQrScannerOpen(true);
  };

  // Sync state on storage dispatch (e.g. student profile photo/name edit or theme change)
  React.useEffect(() => {
    const handleStorage = () => {
      setStorageTrigger((prev) => prev + 1);
      const saved = localStorage.getItem("sihadir_bg_theme") as ThemeId;
      if (saved && SIHADIR_THEMES[saved]) {
        setAppTheme(saved);
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("sihadir_data_updated", handleStorage);
    window.addEventListener("sihadir_bg_theme_changed", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("sihadir_data_updated", handleStorage);
      window.removeEventListener("sihadir_bg_theme_changed", handleStorage);
    };
  }, []);

  // Initialize automated WhatsApp Fonnte Attendance Engine
  // (Automated period transition report for teachers & 09:00 AM report for TU)
  useEffect(() => {
    startAttendanceAutomations();
    return () => {
      stopAttendanceAutomations();
    };
  }, []);

  const handleThemeChange = (newTheme: ThemeId) => {
    setAppTheme(newTheme);
    localStorage.setItem("sihadir_bg_theme", newTheme);
    window.dispatchEvent(new Event("sihadir_bg_theme_changed"));
  };

  // Auto-switch tabs to a permitted one if we transition roles to avoid black views
  const handleRoleChange = (role: string) => {
    setCurrentRole(role);
    localStorage.setItem("sihadir_role", role);
    let defaultTab = "profil-guru";
    if (role === "siswa") {
      defaultTab = "student-attendance";
    } else if (role === "ketua_kelas") {
      defaultTab = "ketua-kelas-dashboard";
    } else if (role === "piket") {
      defaultTab = "guru-piket-dashboard";
    } else if (role === "bk") {
      defaultTab = "profil-guru";
    } else if (role === "tu") {
      defaultTab = "profil-guru";
    } else if (role === "wali") {
      defaultTab = "kerjaan-wali-kelas";
    } else if (role === "guru_wali") {
      defaultTab = "kerjaan-guru-wali";
    }
    setActiveTab(defaultTab);
    localStorage.setItem("sihadir_active_tab", defaultTab);
  };

  const handleQuickSwitch = (username: string, role: string) => {
    setAuthUsername(username);
    setCurrentRole(role);
    localStorage.setItem("sihadir_authenticated", "true");
    localStorage.setItem("sihadir_username", username);
    localStorage.setItem("sihadir_role", role);
    
    // Sync active teacher name so teacher attendance never defaults to wrong person
    const activeTeacher = (role === "admin" || username === "admin" || username.toLowerCase().includes("arham"))
      ? "ARHAM AMIRUDDIN, S.Pd.Gr"
      : username;
    localStorage.setItem("sihadir_active_teacher_name", activeTeacher);
    
    // Set appropriate default tab
    let defaultTab = "profil-guru";
    if (role === "siswa") {
      defaultTab = "student-attendance";
    } else if (role === "ketua_kelas") {
      defaultTab = "ketua-kelas-dashboard";
    } else if (role === "piket") {
      defaultTab = "guru-piket-dashboard";
    } else if (role === "bk") {
      defaultTab = "profil-guru";
    } else if (role === "tu") {
      defaultTab = "profil-guru";
    } else if (role === "wali") {
      defaultTab = "kerjaan-wali-kelas";
    } else if (role === "guru_wali") {
      defaultTab = "kerjaan-guru-wali";
    }
    setActiveTab(defaultTab);
    localStorage.setItem("sihadir_active_tab", defaultTab);
  };

  const handleLoginSuccess = (username: string, role: string) => {
    setIsAuthenticated(true);
    setAuthUsername(username);
    setCurrentRole(role);
    localStorage.setItem("sihadir_authenticated", "true");
    localStorage.setItem("sihadir_username", username);
    localStorage.setItem("sihadir_role", role);
    
    // Sync active teacher name so teacher attendance never defaults to wrong person
    const activeTeacher = (role === "admin" || username === "admin" || username.toLowerCase().includes("arham"))
      ? "ARHAM AMIRUDDIN, S.Pd.Gr"
      : username;
    localStorage.setItem("sihadir_active_teacher_name", activeTeacher);
    
    // Set default tab based on logged-in role
    let defaultTab = "profil-guru";
    if (role === "siswa") {
      defaultTab = "student-attendance";
    } else if (role === "ketua_kelas") {
      defaultTab = "ketua-kelas-dashboard";
    } else if (role === "piket") {
      defaultTab = "guru-piket-dashboard";
    } else if (role === "bk") {
      defaultTab = "profil-guru";
    } else if (role === "tu") {
      defaultTab = "profil-guru";
    } else if (role === "wali") {
      defaultTab = "kerjaan-wali-kelas";
    } else if (role === "guru_wali") {
      defaultTab = "kerjaan-guru-wali";
    }
    setActiveTab(defaultTab);
    localStorage.setItem("sihadir_active_tab", defaultTab);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthUsername("");
    setCurrentRole("guru");
    setActiveTab("profil-guru");
    localStorage.removeItem("sihadir_authenticated");
    localStorage.removeItem("sihadir_username");
    localStorage.removeItem("sihadir_role");
    localStorage.removeItem("sihadir_active_tab");
    localStorage.removeItem("sihadir_active_teacher_name");
  };

  const handleSetTab = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem("sihadir_active_tab", tab);
  };

  const renderActiveView = () => {
    switch (activeTab) {
      // Teacher Profile & Dashboard Tab
      case "profil-guru":
        return (
          <TeacherDashboard 
            username={authUsername} 
            currentRole={currentRole} 
            onNavigateToTab={handleSetTab} 
          />
        );

      // Ketua Kelas Dashboard Tab
      case "ketua-kelas-dashboard":
        return <KetuaKelasDashboard username={authUsername} />;

      // Guru Piket Dashboard Tab
      case "guru-piket-dashboard":
        return <GuruPiketDashboard username={authUsername} currentRole={currentRole} />;

      // Wali Kelas Workspace Tab
      case "kerjaan-wali-kelas":
        return <WaliKelasWorkspace username={authUsername} currentRole={currentRole} onNavigateToTab={handleSetTab} />;

      // Guru Wali Workspace Tab
      case "kerjaan-guru-wali":
        return <GuruWaliWorkspace username={authUsername} currentRole={currentRole} onNavigateToTab={handleSetTab} />;

      // Admin / Kurikulum / TU Master Data Tab
      case "master-data":
        return <MasterDataManager currentRole={currentRole} username={authUsername} />;

      // Tata Usaha / Admin / Kepsek Arsip Surat Tabs
      case "arsip-surat-masuk":
        return <ArsipSuratDigital currentRole={currentRole} username={authUsername} initialTab="masuk" />;
      case "arsip-surat-keluar":
        return <ArsipSuratDigital currentRole={currentRole} username={authUsername} initialTab="keluar" />;
      case "rekap-persuratan":
        return <ArsipSuratDigital currentRole={currentRole} username={authUsername} initialTab="rekap" />;
      case "arsip-surat":
        return <ArsipSuratDigital currentRole={currentRole} username={authUsername} initialTab="masuk" />;

      // Guru / Admin tabs
      case "kurikulum":
        return <KurikulumHub isAutomotive={isAutomotive} />;
      case "absensi-guru":
        return <AttendanceTeacher username={authUsername} currentRole={currentRole} />;
      case "jurnal-mengajar":
        return (
          <JurnalMengajarInput 
            isAutomotive={isAutomotive} 
            isAdmin={currentRole === "admin" || currentRole === "kurikulum" || currentRole === "kesiswaan"} 
            username={authUsername}
            currentRole={currentRole}
          />
        );
      case "penilaian":
        return (
          <PenilaianAnalisis 
            isAutomotive={isAutomotive} 
            username={authUsername}
            currentRole={currentRole}
          />
        );
      case "karakter":
        return <KarakterAnalisis isAutomotive={isAutomotive} />;
      case "parent-report":
        return <KomunikasiOrangTua username={authUsername} currentRole={currentRole} />;
      case "guru-chat":
        return <GuruChat isAutomotive={isAutomotive} />;
      case "chat-sekolah":
        return (
          <SchoolChatMessenger 
            currentUser={{
              id: currentRole === "siswa" ? (matchedStudentProfile?.id || authUsername) : authUsername,
              name: displayUserRealName,
              role: currentRole,
              roleTitle: displayRoleTitle,
              avatar: activeUserPhoto,
              kelas: matchedStudentProfile?.class || userCaptainClass || ""
            }}
          />
        );

      // Siswa tabs
      case "nilai-siswa":
        return (
          <LaporanNilaiSiswa 
            currentRole={currentRole} 
            username={authUsername}
            isAutomotive={isAutomotive} 
          />
        );
      case "refleksi-siswa":
        return (
          <StudentReflection 
            username={authUsername} 
          />
        );

      case "student-profile":
        return <StudentProfileManager currentRole={currentRole} username={authUsername} />;

      // Shared tab
      case "student-attendance":
        return (
          <StudentAttendance 
            isAdmin={authUsername === "admin" || authUsername === "tu" || authUsername === "kesiswaan" || currentRole === "admin" || currentRole === "kurikulum" || currentRole === "kesiswaan" || currentRole === "tu" || currentRole === "guru" || currentRole === "wali" || currentRole === "guru_wali"} 
            currentRole={currentRole}
            username={authUsername}
          />
        );

      case "rekap-laporan": {
        const isAuthorizedForRekap =
          ["admin", "tu", "kepsek", "kurikulum", "kesiswaan", "bk"].includes((currentRole || "").toLowerCase()) ||
          ["admin", "tu", "kepsek", "kurikulum", "kesiswaan", "bk"].includes((authUsername || "").toLowerCase()) ||
          (authUsername || "").toLowerCase().includes("arham") ||
          (authUsername || "").toLowerCase().includes("alam") ||
          (authUsername || "").toLowerCase().includes("manan") ||
          (authUsername || "").toLowerCase().includes("asrul") ||
          (authUsername || "").toLowerCase().includes("nyoman") ||
          (authUsername || "").toLowerCase().includes("suliawati") ||
          (authUsername || "").toLowerCase().includes("cici") ||
          (authUsername || "").toLowerCase().includes("yoga");

        if (!isAuthorizedForRekap) {
          return (
            <div className="bg-white border border-rose-200 rounded-3xl p-8 text-center max-w-lg mx-auto my-12 shadow-sm space-y-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
                🚫
              </div>
              <h3 className="text-base font-black text-slate-900">Akses Terbatas</h3>
              <p className="text-xs font-medium text-slate-600 leading-relaxed">
                Menu Rekap Laporan hanya dapat diakses oleh Admin Utama, Admin TU, Kepala Sekolah, Waka Kurikulum, Waka Kesiswaan, dan Guru BK.
              </p>
            </div>
          );
        }
        return <RekapLaporan currentRole={currentRole} username={authUsername} />;
      }

      case "kelas-bimbingan":
        return <KelasBimbinganManager username={authUsername} currentRole={currentRole} />;

      case "kredit-pelanggaran":
        return <StudentViolationCreditManager currentRole={currentRole} username={authUsername} />;

      default:
        return (
          <div className="text-center py-16 text-slate-400 text-xs">
            Model Pembelajaran belum didefinisikan untuk menu ini.
          </div>
        );
    }
  };

  const isAuthAdmin = (authUsername || "").toLowerCase() === "admin";

  // Check matched student profile from master student database
  const matchedStudentProfile = (() => {
    const savedStudents = localStorage.getItem("simpati_students_list") || localStorage.getItem("sihadir_master_students");
    let list: any[] = MOCK_STUDENTS;
    if (savedStudents) {
      try {
        const parsed = JSON.parse(savedStudents);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      } catch (e) {
        console.error(e);
      }
    }

    const rawUsername = (authUsername || "").replace(/\s*\(Ketua Kelas\)/gi, "").replace(/\s*\(Ketua Kelas [^)]+\)/gi, "").trim();
    const u = rawUsername.toLowerCase();

    // Look for exact/substring match by name, nis, nisn, or id
    let found = list.find((s: any) => {
      if (!s) return false;
      const sName = typeof s.name === "string" ? s.name.toLowerCase() : "";
      const sId = typeof s.id === "string" ? s.id.toLowerCase() : "";
      const sNis = String(s.nis || "");
      const sNisn = String(s.nisn || "");
      return (u.length > 0 && (sName === u || sName.includes(u) || u.includes(sName))) || sNis === u || sNisn === u || sId === u;
    });

    if (!found && (currentRole === "ketua_kelas" || currentRole === "siswa")) {
      const kkName = localStorage.getItem("sihadir_ketua_kelas_name");
      if (kkName) {
        const cleanKk = kkName.toLowerCase().trim();
        found = list.find((s: any) => {
          if (!s) return false;
          const sName = typeof s.name === "string" ? s.name.toLowerCase() : "";
          return sName === cleanKk || sName.includes(cleanKk) || cleanKk.includes(sName);
        });
      }
    }

    if (!found && currentRole === "siswa" && list.length > 0) {
      return list[0];
    }

    return found || null;
  })();

  const displayUserRealName = (authUsername === "admin" || authUsername.toLowerCase().includes("arham"))
    ? "ARHAM AMIRUDDIN"
    : (authUsername === "tu" || authUsername.toLowerCase().includes("sakti") || authUsername.toLowerCase().includes("saktinani"))
    ? "SAKTINANI DJUNAID"
    : authUsername.toLowerCase().includes("adelia")
    ? "ADELIA PUSPARINI"
    : authUsername === "piket"
    ? "Guru Piket"
    : authUsername === "kurikulum"
    ? "Waka Kurikulum"
    : authUsername === "kesiswaan"
    ? "Waka Kesiswaan"
    : authUsername === "ahmad"
    ? "Wali Kelas"
    : authUsername === "dian"
    ? "Guru Wali"
    : authUsername === "suci"
    ? "Guru Bimbingan Konseling (BK)"
    : authUsername === "budi"
    ? "Guru Mata Pelajaran"
    : authUsername === "kepsek"
    ? "Kepala Sekolah"
    : authUsername === "ketuakelas"
    ? `${localStorage.getItem("sihadir_ketua_kelas_name") || "Ketua Kelas"}`
    : (matchedStudentProfile?.name || authUsername.replace(/\s*\(Ketua Kelas\)/gi, "").trim());

  // Detect if user holds an additional task as Ketua Kelas
  const userCaptainClass = getStudentCaptainClass(displayUserRealName) || 
    (authUsername === "ketuakelas" || authUsername === "admin" || authUsername.toLowerCase().includes("arham")
      ? (localStorage.getItem("sihadir_ketua_kelas_class") || "XI TKR A") 
      : null);

  const isSaktiOrAdeliaUser = (() => {
    const u = (authUsername || "").toLowerCase();
    const d = (displayUserRealName || "").toLowerCase();
    return u.includes("sakti") || u.includes("adelia") || d.includes("sakti") || d.includes("adelia") || d.includes("saktinani") || d.includes("pusparini");
  })();

  const displayRoleTitle = currentRole === "admin" 
    ? "Administrator Utama" 
    : currentRole === "tu"
    ? (isSaktiOrAdeliaUser ? "Admin Tata Usaha (TU)" : "Staf Tata Usaha")
    : currentRole === "ketua_kelas"
    ? `Ketua Kelas ${userCaptainClass || "XI TKR A"} (Tugas Tambahan)`
    : currentRole === "kurikulum"
    ? "Waka Kurikulum"
    : currentRole === "kesiswaan"
    ? "Waka Kesiswaan"
    : currentRole === "piket"
    ? "Guru Piket"
    : currentRole === "wali" 
    ? "Wali Kelas" 
    : currentRole === "guru_wali" 
    ? "Guru Wali Kelas" 
    : currentRole === "guru" 
    ? "Guru Mata Pelajaran" 
    : currentRole === "bk" 
    ? "Bimbingan Konseling (BK)" 
    : currentRole === "kepsek" 
    ? "Kepala Sekolah" 
    : currentRole === "siswa"
    ? (userCaptainClass ? `Siswa (Tugas Tambahan: Ketua Kelas ${userCaptainClass})` : "Siswa Terdaftar")
    : "Guru Mata Pelajaran / Staf";

  // Protection: If currentRole is ketua_kelas but user is not a designated class captain or admin, fallback to siswa
  useEffect(() => {
    if (currentRole === "ketua_kelas" && !userCaptainClass && authUsername !== "admin" && !authUsername.toLowerCase().includes("arham")) {
      setCurrentRole("siswa");
      if (activeTab === "ketua-kelas-dashboard") {
        setActiveTab("student-attendance");
      }
    }
    if (currentRole === "tu" && activeTab === "kredit-pelanggaran") {
      setActiveTab("profil-guru");
    }
  }, [currentRole, userCaptainClass, authUsername, activeTab]);


  const activeUserPhoto = (() => {
    // 1. If student profile matched (or role is siswa), prioritize student photoUrl
    if (matchedStudentProfile?.photoUrl) {
      return matchedStudentProfile.photoUrl;
    }
    // 2. Try teacher profile by username
    if (authUsername) {
      const profileKey = `sihadir_teacher_profile_${authUsername.trim().toLowerCase() || "default"}`;
      const saved = localStorage.getItem(profileKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.photoUrl) return parsed.photoUrl;
        } catch (e) {}
      }
    }
    // 3. Try global active teacher photo
    const globalPhoto = localStorage.getItem("sihadir_active_teacher_photo");
    if (globalPhoto) return globalPhoto;

    return "";
  })();

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const activeThemeDef = SIHADIR_THEMES[appTheme] || SIHADIR_THEMES.gradient;
  const themeStyle = activeThemeDef.app;

  return (
    <div className={themeStyle.rootBg}>
      
      {/* Draggable Theme Widget for Dashboard */}
      <DraggableThemeWidget 
        currentTheme={appTheme} 
        onThemeChange={handleThemeChange} 
        className="bottom-5 right-5" 
        isOpenExternal={isThemePickerOpen}
        onCloseExternal={() => setIsThemePickerOpen(false)}
      />

      {/* Decorative Floating Blobs matching Login Screen */}
      {!themeStyle.isLight && (
        <>
          <div className={`fixed top-[-20%] left-[-15%] w-[600px] h-[600px] rounded-full blur-[130px] pointer-events-none transition-all duration-500 z-0 ${themeStyle.decorations.blob1}`} />
          <div className={`fixed bottom-[-25%] right-[-15%] w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none transition-all duration-500 z-0 ${themeStyle.decorations.blob2}`} />
          <div className={`fixed top-[35%] left-[25%] w-[380px] h-[380px] rounded-full blur-[110px] pointer-events-none transition-all duration-500 z-0 ${themeStyle.decorations.blob3}`} />
        </>
      )}

      {/* Sidebar Navigation */}
      <Navigation 
        currentRole={currentRole} 
        activeTab={activeTab} 
        setActiveTab={handleSetTab} 
        onRoleChange={handleRoleChange} 
        username={authUsername}
        onLogout={handleLogout}
      />

      {/* Main Content Area Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-0">
        
        {/* High Density Top Navigation Bar */}
        <header className={themeStyle.headerBg}>
          <div className="flex items-center gap-3.5">
            <div className="hidden">
              <img 
                src="https://i.ibb.co.com/TMkWkNY4/LOGO-SMKN-2-KONAWE-BARU.png" 
                alt="Logo SMK 2" 
                className="w-10 h-10 object-cover rounded-full"
                style={{ clipPath: "circle(50% at 50% 50%)" }}
                onError={(e) => {
                  const target = e.currentTarget;
                  const paths = [
                    "https://i.ibb.co/TMkWkNY4/LOGO-SMKN-2-KONAWE-BARU.png",
                    "https://i.ibb.co.com/TMkWkNY4/LOGO-SMKN-2-KONAWE-BARU.jpg",
                    "https://i.ibb.co/TMkWkNY4/LOGO-SMKN-2-KONAWE-BARU.jpg",
                    "https://i.ibb.co.com/TMkWkNY4/SMKN2.png",
                    "https://i.ibb.co/TMkWkNY4/SMKN2.png",
                    "https://i.ibb.co/L8N2LpL/SMKN2.png",
                    "https://i.ibb.co/6wZ2K8R/default.png"
                  ];
                  const currentAttempt = target.getAttribute("data-attempt") || "0";
                  const attemptIdx = parseInt(currentAttempt, 10);
                  if (attemptIdx < paths.length) {
                    target.setAttribute("data-attempt", (attemptIdx + 1).toString());
                    target.src = paths[attemptIdx];
                  }
                }}
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <p className={`text-[11px] uppercase tracking-wider font-bold ${themeStyle.subText}`}>
                SISTEM INFORMASI HARIAN ABSENSI DIGITAL MURID, GURU & STAF SMK NEGERI 2 KONAWE
              </p>
            </div>
          </div>

          {/* Quick Config Row - Layout Controls */}
          <div className="flex flex-wrap items-center gap-2.5 self-start xl:self-auto">
            {/* Global QR Scanner Button - Only for Ketua Kelas, Guru Piket, Guru BK, Admin TU, and Admin Utama */}
            {["ketua_kelas", "piket", "bk", "tu", "admin"].includes(currentRole) && (
              <button
                type="button"
                onClick={handleOpenGlobalQrScanner}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-emerald-300 animate-pulse shrink-0"
                title="Klik untuk membuka Kios Scanner QR Code Absensi"
              >
                <QrCode className="h-4 w-4 text-slate-950" />
                <span className="uppercase tracking-wider">BACA SCAN QR CODE</span>
              </button>
            )}

            {/* Tema Latar Indicator & Selector Button */}
            <button
              type="button"
              onClick={() => setIsThemePickerOpen(prev => !prev)}
              className={`flex items-center gap-1.5 p-1 px-2.5 rounded-xl border transition-all hover:scale-105 cursor-pointer shadow-sm ${themeStyle.controlBox} hover:border-sky-400`}
              title="Klik untuk memilih variasi tema latar belakang dan warna aplikasi"
            >
              <div className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-90 hidden sm:inline">
                  Tema:
                </span>
                <div className={`w-2.5 h-2.5 rounded-full ${activeThemeDef.previewClass} ring-1 ring-white/50 inline-block`} />
                <span className="text-[10px] font-black text-sky-300">
                  {activeThemeDef.name}
                </span>
              </div>
            </button>

            {/* Active User Badging - Foto / Avatar di sebelah kiri nama */}
            <div className={`flex items-center gap-2.5 px-2.5 py-1 rounded-xl border ${themeStyle.controlBox}`}>
              <div className="w-8.5 h-8.5 rounded-full bg-white/20 border border-white/30 overflow-hidden flex items-center justify-center text-white font-extrabold text-xs uppercase font-mono shrink-0 shadow-2xs">
                {activeUserPhoto ? (
                  <img src={activeUserPhoto} alt={displayUserRealName} className="w-full h-full object-cover" />
                ) : (
                  authUsername ? authUsername.substring(0, 2).toUpperCase() : "AF"
                )}
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className={themeStyle.userName}>{displayUserRealName}</span>
                <span className={themeStyle.userRole}>
                  {displayRoleTitle}
                </span>
              </div>
            </div>

            {/* Jam Digital Resmi Sudut Kanan Atas Setiap Akun */}
            <DigitalClockWidget 
              size="lg" 
              variant={themeStyle.isLight ? "light" : "header"} 
              className="shrink-0"
              id="header-digital-clock"
            />
          </div>
        </header>

        {/* Outer view rendering with dynamic theme wrapper */}
        <main className="p-3 md:p-5 max-w-[1600px] w-full mx-auto flex-1 flex flex-col">
          <div className={themeStyle.mainWrapper}>
            {renderActiveView()}
          </div>
        </main>

        {/* High Density Footer Status Bar */}
        <footer className={themeStyle.footerBg}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className={`text-[10px] font-bold tracking-wider ${themeStyle.footerServer}`}>SERVER ACTIVE</span>
            </div>
          </div>
          <div className="text-[10px] font-bold tracking-tighter uppercase font-mono text-white/90">
            SMK Negeri 2 Konawe 2026/2027
          </div>
        </footer>
      </div>

      {/* Floating Quick Role Switcher - Admin Only */}
      {currentRole === "admin" && (
        <QuickRoleSwitcher 
          currentRole={currentRole} 
          currentUsername={authUsername} 
          onRoleSwitch={handleQuickSwitch} 
        />
      )}

      {/* Global QR Scanner Modal */}
      <QrScannerModal
        isOpen={isGlobalQrScannerOpen}
        onClose={() => setIsGlobalQrScannerOpen(false)}
        role={
          currentRole === "ketua_kelas"
            ? "Ketua Kelas"
            : currentRole === "piket"
            ? "Guru Piket"
            : currentRole === "bk"
            ? "Guru BK"
            : currentRole === "tu"
            ? "Admin Tata Usaha"
            : "Umum"
        }
      />

      {/* Piket Day Restriction Modal Alert */}
      {piketAlertModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 border-b border-rose-100 pb-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl shrink-0">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-900 leading-snug">{piketAlertModal.title}</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SIHADIR SMK NEGERI 2 KONAWE</span>
              </div>
            </div>

            <p className="text-xs text-slate-700 font-medium whitespace-pre-line leading-relaxed">
              {piketAlertModal.message}
            </p>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPiketAlertModal(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-md transition-all"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
