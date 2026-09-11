/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Teacher } from "../types";
import { MOCK_TEACHERS } from "../mockData";
import { dbService } from "../firebase";

const TEACHERS_STORAGE_KEY = "simpati_teachers_list";
const BACKUP_TEACHERS_KEY = "sihadir_master_teachers";
const PHOTO_KEY_PREFIX = "sihadir_photo_teacher_";

/**
 * Normalizes name for matching and key generation
 */
export function cleanTeacherName(rawName: string): string {
  if (!rawName) return "";
  return rawName
    .toLowerCase()
    .replace(/\b(s\.?pd\.?gr|s\.?pd|m\.?pd|s\.?t|st|s\.?si|s\.?kom|s\.?e|se|s\.?ag|s\.?sos|m\.?m|m\.?si|drs|dra|h|hj|ir|gr)\b/gi, "")
    .replace(/,?\s*\([^)]*\)/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Normalizes NIP (removes spaces/dashes)
 */
export function cleanNip(rawNip: string): string {
  if (!rawNip) return "";
  return rawNip.replace(/[^0-9]/g, "");
}

/**
 * Retrieve any cached photo for a teacher by ID, Name, NIP, or username
 * STRICT: Never returns photos belonging to other users or global fallbacks!
 */
export function getTeacherPhoto(identifier: string): string {
  if (!identifier) return "";
  const cleanId = identifier.trim();
  if (!cleanId || cleanId.toLowerCase() === "default") return "";

  // Admin / Arham Amiruddin direct resolver
  if (cleanId.toLowerCase() === "admin" || cleanId.toLowerCase() === "arham" || cleanId.toLowerCase().includes("arham amiruddin")) {
    const arhamPhoto = localStorage.getItem(`${PHOTO_KEY_PREFIX}T06`) ||
      localStorage.getItem(`${PHOTO_KEY_PREFIX}arhamamiruddin`) ||
      localStorage.getItem(`${PHOTO_KEY_PREFIX}arham`) || "";
    if (arhamPhoto) return arhamPhoto;
  }

  const cleanKey = cleanTeacherName(cleanId);
  const cleanNipKey = cleanNip(cleanId);

  // Rusni K direct resolver
  if (cleanId.toLowerCase() === "t37" || cleanKey === "rusnik" || cleanKey === "rusni" || cleanKey === "rus" || cleanId.toLowerCase().includes("rusni")) {
    const rusniPhoto = localStorage.getItem(`${PHOTO_KEY_PREFIX}T37`) ||
      localStorage.getItem(`${PHOTO_KEY_PREFIX}rusnik`) ||
      localStorage.getItem(`${PHOTO_KEY_PREFIX}rusni k`) ||
      localStorage.getItem(`${PHOTO_KEY_PREFIX}rusni`) || "";
    if (rusniPhoto) return rusniPhoto;
  }

  // 1. Check dedicated photo keys by exact teacher ID
  const byId = localStorage.getItem(`${PHOTO_KEY_PREFIX}${cleanId}`);
  if (byId) return byId;

  // 2. Check dedicated photo keys by clean name (at least 4 chars to prevent generic collision)
  if (cleanKey && cleanKey.length >= 4) {
    const byName = localStorage.getItem(`${PHOTO_KEY_PREFIX}${cleanKey}`);
    if (byName) return byName;
  }

  // 3. Check by NIP only if valid numeric length (at least 8 digits)
  if (cleanNipKey && cleanNipKey.length >= 8) {
    const byNip = localStorage.getItem(`${PHOTO_KEY_PREFIX}${cleanNipKey}`);
    if (byNip) return byNip;
  }

  // 4. Check profile keys
  if (cleanKey && cleanKey.length >= 4) {
    const profileRaw = localStorage.getItem(`sihadir_teacher_profile_${cleanKey}`);
    if (profileRaw) {
      try {
        const parsed = JSON.parse(profileRaw);
        if (parsed?.photoUrl) return parsed.photoUrl;
      } catch (e) {}
    }
  }

  // 5. Check master teachers list in localStorage
  const saved = localStorage.getItem(TEACHERS_STORAGE_KEY) || localStorage.getItem(BACKUP_TEACHERS_KEY);
  if (saved) {
    try {
      const list: Teacher[] = JSON.parse(saved);
      if (Array.isArray(list)) {
        const found = list.find(t => {
          if (!t) return false;
          if (t.id && t.id.toLowerCase() === cleanId.toLowerCase()) return true;
          if (cleanKey && cleanKey.length >= 4 && cleanTeacherName(t.name) === cleanKey) return true;
          if (cleanNipKey && cleanNipKey.length >= 8 && cleanNip(t.nip) === cleanNipKey) return true;
          return false;
        });
        if (found?.photoUrl) return found.photoUrl;
      }
    } catch (e) {}
  }

  // ABSOLUTELY NEVER FALL BACK TO A GLOBAL KEY!
  return "";
}

/**
 * Scan all localStorage keys and remove leaked Arham photo from other teachers and students
 */
export function purgeLeakedPhotosAndFixData(): void {
  try {
    // 1. Locate Arham Amiruddin's true photo
    let arhamPhoto = localStorage.getItem(`${PHOTO_KEY_PREFIX}T06`) ||
      localStorage.getItem(`${PHOTO_KEY_PREFIX}arhamamiruddin`) ||
      localStorage.getItem(`${PHOTO_KEY_PREFIX}arham`) ||
      localStorage.getItem("sihadir_active_teacher_photo") || "";

    if (!arhamPhoto) {
      const profRaw = localStorage.getItem("sihadir_teacher_profile_admin") || localStorage.getItem("sihadir_teacher_profile_arham");
      if (profRaw) {
        try {
          const parsed = JSON.parse(profRaw);
          if (parsed?.photoUrl) arhamPhoto = parsed.photoUrl;
        } catch (e) {}
      }
    }

    // Secure Arham's true photo exclusively to his dedicated keys
    if (arhamPhoto) {
      localStorage.setItem(`${PHOTO_KEY_PREFIX}T06`, arhamPhoto);
      localStorage.setItem(`${PHOTO_KEY_PREFIX}arhamamiruddin`, arhamPhoto);
      localStorage.setItem(`${PHOTO_KEY_PREFIX}arham`, arhamPhoto);
    }

    // Destroy indiscriminate global and wildcard keys
    localStorage.removeItem("sihadir_active_teacher_photo");
    localStorage.removeItem(`${PHOTO_KEY_PREFIX}admin`);
    localStorage.removeItem(`${PHOTO_KEY_PREFIX}default`);
    localStorage.removeItem(`${PHOTO_KEY_PREFIX}`);

    // 2. Clean up teachers
    const savedTeachers = localStorage.getItem(TEACHERS_STORAGE_KEY) || localStorage.getItem(BACKUP_TEACHERS_KEY);
    if (savedTeachers && arhamPhoto) {
      try {
        const list: Teacher[] = JSON.parse(savedTeachers);
        if (Array.isArray(list)) {
          let hasTeacherChanges = false;
          const cleanedList = list.map(t => {
            const isArham = t.id === "T06" || cleanTeacherName(t.name).includes("arham");
            if (!isArham && t.photoUrl === arhamPhoto) {
              hasTeacherChanges = true;
              try {
                localStorage.removeItem(`${PHOTO_KEY_PREFIX}${t.id}`);
                const cName = cleanTeacherName(t.name);
                if (cName) localStorage.removeItem(`${PHOTO_KEY_PREFIX}${cName}`);
                const cNipKey = cleanNip(t.nip || "");
                if (cNipKey) localStorage.removeItem(`${PHOTO_KEY_PREFIX}${cNipKey}`);
              } catch (e) {}
              return { ...t, photoUrl: "" };
            }
            return t;
          });

          if (hasTeacherChanges) {
            localStorage.setItem(TEACHERS_STORAGE_KEY, JSON.stringify(cleanedList));
            localStorage.setItem(BACKUP_TEACHERS_KEY, JSON.stringify(cleanedList));
          }
        }
      } catch (e) {}
    }

    // 3. Clean up students
    const savedStudents = localStorage.getItem("simpati_students_list") || localStorage.getItem("sihadir_master_students");
    if (savedStudents && arhamPhoto) {
      try {
        const students = JSON.parse(savedStudents);
        if (Array.isArray(students)) {
          let hasStudentChanges = false;
          const cleanedStudents = students.map((s: any) => {
            if (s.photoUrl === arhamPhoto) {
              hasStudentChanges = true;
              return { ...s, photoUrl: "" };
            }
            return s;
          });
          if (hasStudentChanges) {
            localStorage.setItem("simpati_students_list", JSON.stringify(cleanedStudents));
            localStorage.setItem("sihadir_master_students", JSON.stringify(cleanedStudents));
          }
        }
      } catch (e) {}
    }
  } catch (err) {
    console.warn("purgeLeakedPhotosAndFixData error:", err);
  }
}

/**
 * Scan all localStorage keys to recover any previously uploaded teacher photos
 */
export function scanAndRecoverPhotos(currentList?: Teacher[]): Teacher[] {
  purgeLeakedPhotosAndFixData();

  let listToScan = currentList;
  if (!listToScan) {
    const saved = localStorage.getItem(TEACHERS_STORAGE_KEY) || localStorage.getItem(BACKUP_TEACHERS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          listToScan = parsed;
        }
      } catch (e) {}
    }
  }
  if (!listToScan) {
    listToScan = [...MOCK_TEACHERS];
  }

  const arhamPhoto = localStorage.getItem(`${PHOTO_KEY_PREFIX}T06`) ||
    localStorage.getItem(`${PHOTO_KEY_PREFIX}arhamamiruddin`) ||
    localStorage.getItem(`${PHOTO_KEY_PREFIX}arham`) || "";

  let hasRecoveries = false;
  const updated = listToScan.map(t => {
    const isArham = t.id === "T06" || cleanTeacherName(t.name).includes("arham");

    // Guard: purge contaminated photo from non-Arham teacher
    if (!isArham && arhamPhoto && t.photoUrl === arhamPhoto) {
      hasRecoveries = true;
      return { ...t, photoUrl: "" };
    }

    if (t.photoUrl && (t.photoUrl.startsWith("data:image") || t.photoUrl.startsWith("http") || t.photoUrl.length > 20)) {
      // Ensure dedicated key exists for this exact teacher
      try {
        localStorage.setItem(`${PHOTO_KEY_PREFIX}${t.id}`, t.photoUrl);
        const cName = cleanTeacherName(t.name);
        if (cName && cName.length >= 4) localStorage.setItem(`${PHOTO_KEY_PREFIX}${cName}`, t.photoUrl);
      } catch (e) {}
      return t;
    }

    // Try finding photo strictly belonging to this teacher
    const photo = getTeacherPhoto(t.id) || (cleanTeacherName(t.name).length >= 4 ? getTeacherPhoto(t.name) : "");
    if (photo && (photo.startsWith("data:image") || photo.startsWith("http") || photo.length > 20)) {
      if (!isArham && arhamPhoto && photo === arhamPhoto) {
        return { ...t, photoUrl: "" };
      }
      hasRecoveries = true;
      return { ...t, photoUrl: photo };
    }

    return t;
  });

  if (hasRecoveries) {
    try {
      localStorage.setItem(TEACHERS_STORAGE_KEY, JSON.stringify(updated));
      localStorage.setItem(BACKUP_TEACHERS_KEY, JSON.stringify(updated));
    } catch (e) {}
  }

  return updated;
}

/**
 * Load all teachers safely merging MOCK_TEACHERS with persistent data
 * NEVER drops user changes, custom teachers, or photos!
 */
export function getAllTeachers(): Teacher[] {
  let list: Teacher[] = [];
  const saved = localStorage.getItem(TEACHERS_STORAGE_KEY) || localStorage.getItem(BACKUP_TEACHERS_KEY);

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        list = parsed;
      }
    } catch (e) {
      console.error("Error reading teachers from localStorage:", e);
    }
  }

  if (list.length === 0) {
    list = [...MOCK_TEACHERS];
  } else {
    // Merge any missing official mock teachers without overwriting existing data
    const existingIds = new Set(list.map(t => t.id));
    const existingNames = new Set(list.map(t => cleanTeacherName(t.name)));

    MOCK_TEACHERS.forEach(mock => {
      const cName = cleanTeacherName(mock.name);
      if (!existingIds.has(mock.id) && !existingNames.has(cName)) {
        list.push(mock);
      } else {
        // Enforce QR Code and baseline official data if missing on existing item
        const existingIdx = list.findIndex(t => t.id === mock.id || cleanTeacherName(t.name) === cName);
        if (existingIdx > -1) {
          const item = list[existingIdx];
          let changed = false;
          const mergedItem = { ...item };
          if (!mergedItem.qrCode && mock.qrCode) {
            mergedItem.qrCode = mock.qrCode;
            changed = true;
          }
          if (!mergedItem.nip && mock.nip) {
            mergedItem.nip = mock.nip;
            changed = true;
          }
          if (changed) {
            list[existingIdx] = mergedItem;
          }
        }
      }
    });
  }

  // Recover any photos
  list = scanAndRecoverPhotos(list);

  try {
    localStorage.setItem(TEACHERS_STORAGE_KEY, JSON.stringify(list));
    localStorage.setItem(BACKUP_TEACHERS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("Could not save merged teachers list to localStorage:", e);
  }

  return list;
}

/**
 * Save / Update a single teacher record across both localStorage & Firebase Firestore
 * Guarantees that teacher data is never lost or overwritten by another record
 */
export async function saveTeacherRecord(teacher: Teacher): Promise<boolean> {
  if (!teacher || !teacher.name) return false;

  const teacherId = teacher.id || `T${Date.now()}`;
  const cName = cleanTeacherName(teacher.name);
  const cNipKey = cleanNip(teacher.nip || "");

  const preparedTeacher: Teacher = {
    ...teacher,
    id: teacherId,
    name: teacher.name.trim()
  };

  // 1. Photo persistence or removal
  if (preparedTeacher.photoUrl && (preparedTeacher.photoUrl.startsWith("data:image") || preparedTeacher.photoUrl.startsWith("http"))) {
    try {
      localStorage.setItem(`${PHOTO_KEY_PREFIX}${teacherId}`, preparedTeacher.photoUrl);
      if (cName && cName.length >= 4) {
        localStorage.setItem(`${PHOTO_KEY_PREFIX}${cName}`, preparedTeacher.photoUrl);
        const existingProfRaw = localStorage.getItem(`sihadir_teacher_profile_${cName}`);
        let profObj: any = {};
        if (existingProfRaw) {
          try { profObj = JSON.parse(existingProfRaw); } catch (e) {}
        }
        profObj.photoUrl = preparedTeacher.photoUrl;
        profObj.fullName = preparedTeacher.name;
        profObj.nip = preparedTeacher.nip || profObj.nip;
        profObj.subject = preparedTeacher.subject || profObj.subject;
        localStorage.setItem(`sihadir_teacher_profile_${cName}`, JSON.stringify(profObj));
      }
    } catch (e) {
      console.warn("Could not cache photo to dedicated key:", e);
    }
  } else if (preparedTeacher.photoUrl === "") {
    // Explicitly removed photo: delete dedicated keys so it is never restored
    try {
      localStorage.removeItem(`${PHOTO_KEY_PREFIX}${teacherId}`);
      if (cName) localStorage.removeItem(`${PHOTO_KEY_PREFIX}${cName}`);
      if (cNipKey) localStorage.removeItem(`${PHOTO_KEY_PREFIX}${cNipKey}`);
    } catch (e) {}
  }

  // 2. Update local master list safely without accidental overwriting
  const currentTeachers = getAllTeachers();
  
  // MATCHING RULES:
  // Primary: exact ID match
  let index = currentTeachers.findIndex(t => t.id === teacherId);
  
  // Secondary: if ID not found, match by exact clean name (min 4 chars)
  if (index === -1 && cName && cName.length >= 4) {
    index = currentTeachers.findIndex(t => cleanTeacherName(t.name) === cName);
  }
  
  // Tertiary: only if NIP is valid (min 8 numeric digits)
  if (index === -1 && cNipKey && cNipKey.length >= 8) {
    index = currentTeachers.findIndex(t => cleanNip(t.nip) === cNipKey);
  }

  let updatedList: Teacher[];
  if (index > -1) {
    // Preserve existing photo ONLY if incoming photoUrl is undefined (not explicitly passed)
    let finalPhoto = preparedTeacher.photoUrl;
    if (finalPhoto === undefined) {
      finalPhoto = currentTeachers[index].photoUrl || "";
    }
    
    updatedList = [...currentTeachers];
    updatedList[index] = {
      ...currentTeachers[index],
      ...preparedTeacher,
      photoUrl: finalPhoto
    };
  } else {
    updatedList = [...currentTeachers, preparedTeacher];
  }

  try {
    localStorage.setItem(TEACHERS_STORAGE_KEY, JSON.stringify(updatedList));
    localStorage.setItem(BACKUP_TEACHERS_KEY, JSON.stringify(updatedList));
  } catch (e) {
    console.error("Failed to write teachers list to localStorage:", e);
  }

  // 3. Persist to Firebase Firestore for Cloud Synchronization
  try {
    await dbService.saveRecord("master_teachers", teacherId, preparedTeacher);
    // Also save in teacher_profiles collection for direct multi-device profile sync
    await dbService.saveRecord("teacher_profiles", teacherId, {
      id: teacherId,
      name: preparedTeacher.name,
      fullName: preparedTeacher.name,
      nip: preparedTeacher.nip || "",
      subject: preparedTeacher.subject || "",
      classesTaught: Array.isArray(preparedTeacher.classes) ? preparedTeacher.classes.join(", ") : (preparedTeacher.classes || ""),
      whatsapp: preparedTeacher.whatsApp || "",
      birthInfo: preparedTeacher.birthInfo || (preparedTeacher.birthPlace ? `${preparedTeacher.birthPlace}, ${preparedTeacher.birthDate || ""}` : ""),
      address: preparedTeacher.address || "",
      additionalDuty: preparedTeacher.additionalDuty || [],
      photoUrl: preparedTeacher.photoUrl || "",
      updatedAt: new Date().toISOString()
    });
  } catch (cloudErr) {
    console.warn("Firebase saveRecord for master_teachers error (falling back to local):", cloudErr);
  }

  window.dispatchEvent(new Event("storage"));
  window.dispatchEvent(new CustomEvent("sihadir_data_updated"));

  return true;
}

/**
 * Save teacher profile from TeacherDashboard (updates both profile & master teachers list)
 */
export async function syncTeacherProfileUpdate(
  username: string, 
  profile: {
    fullName: string;
    nip: string;
    subject: string;
    photoUrl?: string;
    classesTaught?: string;
    whatsapp?: string;
    address?: string;
    birthInfo?: string;
    additionalDuty?: string[];
  }
): Promise<void> {
  const cleanU = (username || "").trim().toLowerCase();
  const cUser = cleanTeacherName(username);
  const isArhamUser = cleanU === "arham" || cleanU === "admin" || cleanU.includes("arham");
  const isRusniUser = cleanU.includes("rusni") || cUser.includes("rusni") || cleanU === "rus" || cleanU === "t37" || (profile.fullName && cleanTeacherName(profile.fullName).includes("rusni"));
  const profileKey = `sihadir_teacher_profile_${cleanU || "default"}`;
  
  // 1. Save profile key locally
  try {
    localStorage.setItem(profileKey, JSON.stringify(profile));
    if (cleanU) {
      localStorage.setItem(`sihadir_teacher_profile_${cleanU}`, JSON.stringify(profile));
    }
    if (cUser) {
      localStorage.setItem(`sihadir_teacher_profile_${cUser}`, JSON.stringify(profile));
    }
    if (isRusniUser) {
      localStorage.setItem("sihadir_teacher_profile_t37", JSON.stringify(profile));
      localStorage.setItem("sihadir_teacher_profile_rusni k", JSON.stringify(profile));
      localStorage.setItem("sihadir_teacher_profile_rusnik", JSON.stringify(profile));
    }
  } catch (e) {}

  // 2. Photo management: NEVER use global sihadir_active_teacher_photo
  if (profile.photoUrl) {
    try {
      if (isArhamUser) {
        localStorage.setItem(`${PHOTO_KEY_PREFIX}T06`, profile.photoUrl);
        localStorage.setItem(`${PHOTO_KEY_PREFIX}arhamamiruddin`, profile.photoUrl);
        localStorage.setItem(`${PHOTO_KEY_PREFIX}arham`, profile.photoUrl);
      } else if (isRusniUser) {
        localStorage.setItem(`${PHOTO_KEY_PREFIX}T37`, profile.photoUrl);
        localStorage.setItem(`${PHOTO_KEY_PREFIX}rusnik`, profile.photoUrl);
        localStorage.setItem(`${PHOTO_KEY_PREFIX}rusni k`, profile.photoUrl);
        localStorage.setItem(`${PHOTO_KEY_PREFIX}rusni`, profile.photoUrl);
      } else {
        if (cleanU) localStorage.setItem(`${PHOTO_KEY_PREFIX}${cleanU}`, profile.photoUrl);
        const cName = cleanTeacherName(profile.fullName);
        if (cName && cName.length >= 4) localStorage.setItem(`${PHOTO_KEY_PREFIX}${cName}`, profile.photoUrl);
      }
    } catch (e) {}
  } else if (profile.photoUrl === "") {
    // Explicitly removed photo
    try {
      if (isArhamUser) {
        localStorage.removeItem(`${PHOTO_KEY_PREFIX}T06`);
        localStorage.removeItem(`${PHOTO_KEY_PREFIX}arhamamiruddin`);
        localStorage.removeItem(`${PHOTO_KEY_PREFIX}arham`);
      } else if (isRusniUser) {
        localStorage.removeItem(`${PHOTO_KEY_PREFIX}T37`);
        localStorage.removeItem(`${PHOTO_KEY_PREFIX}rusnik`);
        localStorage.removeItem(`${PHOTO_KEY_PREFIX}rusni k`);
        localStorage.removeItem(`${PHOTO_KEY_PREFIX}rusni`);
      } else {
        if (cleanU) localStorage.removeItem(`${PHOTO_KEY_PREFIX}${cleanU}`);
        const cName = cleanTeacherName(profile.fullName);
        if (cName) localStorage.removeItem(`${PHOTO_KEY_PREFIX}${cName}`);
      }
    } catch (e) {}
  }

  // 3. Find and update in master teachers
  const currentTeachers = getAllTeachers();
  const cProfName = cleanTeacherName(profile.fullName);
  const cNip = cleanNip(profile.nip);

  const matched = currentTeachers.find(t => {
    if (isArhamUser && (t.id === "T06" || cleanTeacherName(t.name).includes("arham"))) {
      return true;
    }
    if (isRusniUser && (t.id === "T37" || cleanTeacherName(t.name).includes("rusni"))) {
      return true;
    }
    if (cleanU && cleanU !== "admin" && (cleanTeacherName(t.name) === cUser || cleanTeacherName(t.name) === cleanU || t.id.toLowerCase() === cleanU)) {
      return true;
    }
    if (cProfName && cProfName.length >= 4 && cleanTeacherName(t.name) === cProfName) {
      return true;
    }
    if (cNip && cNip.length >= 8 && cleanNip(t.nip) === cNip) {
      return true;
    }
    return false;
  });

  if (matched) {
    const updatedTeacher: Teacher = {
      ...matched,
      name: profile.fullName || matched.name,
      nip: profile.nip !== undefined ? profile.nip : matched.nip,
      subject: profile.subject || matched.subject,
      classes: profile.classesTaught ? profile.classesTaught.split(",").map(c => c.trim()).filter(Boolean) : matched.classes,
      photoUrl: profile.photoUrl !== undefined ? profile.photoUrl : (matched.photoUrl || ""),
      whatsApp: profile.whatsapp || matched.whatsApp,
      birthInfo: profile.birthInfo || matched.birthInfo,
      address: profile.address || (matched as any).address,
      additionalDuty: profile.additionalDuty || matched.additionalDuty
    };
    await saveTeacherRecord(updatedTeacher);
  } else {
    // Create new teacher record if not exists
    const targetId = isArhamUser ? "T06" : (isRusniUser ? "T37" : `T${Date.now()}`);
    const newTeacher: Teacher = {
      id: targetId,
      name: profile.fullName || username,
      nip: profile.nip || "",
      nuptk: "",
      subject: profile.subject || "Guru Mata Pelajaran",
      classes: profile.classesTaught ? profile.classesTaught.split(",").map(c => c.trim()).filter(Boolean) : ["XI TKR A"],
      role: profile.additionalDuty?.[0] || "Guru",
      whatsApp: profile.whatsapp || "",
      email: "",
      photoUrl: profile.photoUrl || "",
      birthInfo: profile.birthInfo,
      address: profile.address,
      additionalDuty: profile.additionalDuty
    };
    await saveTeacherRecord(newTeacher);
  }
}

/**
 * Subscribe to realtime teacher updates across Firestore and localStorage
 */
export function subscribeTeacherRecords(onUpdate: (teachers: Teacher[]) => void): () => void {
  // 1. Provide current list immediately
  const initial = getAllTeachers();
  onUpdate(initial);

  // 2. Realtime listener for Firestore "master_teachers"
  const unsubFirestore = dbService.subscribeRecords("master_teachers", (cloudRecords) => {
    if (cloudRecords && cloudRecords.length > 0) {
      const localList = getAllTeachers();
      const localMap = new Map(localList.map(t => [t.id, t]));
      const arhamPhoto = localStorage.getItem(`${PHOTO_KEY_PREFIX}T06`) || "";

      // Merge cloud records without erasing local photos or cross-contaminating
      cloudRecords.forEach((cr: any) => {
        const local = localMap.get(cr.id);
        const isArham = cr.id === "T06" || cleanTeacherName(cr.name || "").includes("arham");
        
        let safeCloudPhoto = cr.photoUrl || "";
        if (!isArham && arhamPhoto && safeCloudPhoto === arhamPhoto) {
          safeCloudPhoto = "";
        }

        let safeLocalPhoto = local?.photoUrl || "";
        if (!isArham && arhamPhoto && safeLocalPhoto === arhamPhoto) {
          safeLocalPhoto = "";
        }

        const resolvedPhoto = safeCloudPhoto || safeLocalPhoto || getTeacherPhoto(cr.id) || "";
        const merged: Teacher = {
          ...cr,
          photoUrl: resolvedPhoto
        };
        localMap.set(cr.id, merged);

        // Also cache dedicated photo key if available from cloud
        if (resolvedPhoto && cr.id) {
          try {
            localStorage.setItem(`${PHOTO_KEY_PREFIX}${cr.id}`, resolvedPhoto);
            const cName = cleanTeacherName(cr.name || "");
            if (cName && cName.length >= 4) {
              localStorage.setItem(`${PHOTO_KEY_PREFIX}${cName}`, resolvedPhoto);
            }
          } catch (e) {}
        }
      });

      const mergedList = Array.from(localMap.values());
      try {
        localStorage.setItem(TEACHERS_STORAGE_KEY, JSON.stringify(mergedList));
        localStorage.setItem(BACKUP_TEACHERS_KEY, JSON.stringify(mergedList));
      } catch (e) {}

      onUpdate(mergedList);
    }
  });

  // 3. Realtime listener for Firestore "teacher_profiles"
  const unsubProfiles = dbService.subscribeRecords("teacher_profiles", (cloudProfiles) => {
    if (cloudProfiles && cloudProfiles.length > 0) {
      cloudProfiles.forEach((prof: any) => {
        if (!prof || !prof.id) return;
        const profId = prof.id;
        const cName = cleanTeacherName(prof.fullName || prof.name || "");
        
        // Save to dedicated localStorage keys
        try {
          localStorage.setItem(`sihadir_teacher_profile_${profId.toLowerCase()}`, JSON.stringify(prof));
          if (cName && cName.length >= 4) {
            localStorage.setItem(`sihadir_teacher_profile_${cName}`, JSON.stringify(prof));
          }
          if (prof.photoUrl) {
            localStorage.setItem(`${PHOTO_KEY_PREFIX}${profId}`, prof.photoUrl);
            if (cName && cName.length >= 4) {
              localStorage.setItem(`${PHOTO_KEY_PREFIX}${cName}`, prof.photoUrl);
            }
          }
        } catch (e) {}
      });

      // Refresh list to pick up any updated photos
      const refreshed = getAllTeachers();
      onUpdate(refreshed);
    }
  });

  // 4. Local storage listener
  const handleLocalChange = () => {
    const fresh = getAllTeachers();
    onUpdate(fresh);
  };

  window.addEventListener("storage", handleLocalChange);
  window.addEventListener("sihadir_data_updated", handleLocalChange);

  return () => {
    unsubFirestore();
    unsubProfiles();
    window.removeEventListener("storage", handleLocalChange);
    window.removeEventListener("sihadir_data_updated", handleLocalChange);
  };
}
