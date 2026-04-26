export interface TrainerAvailability {
  standard: {
    [day: string]: { isOpen: boolean; slots: { start: string; end: string }[] };
  };
  overrides?: {
    [date: string]: { isOpen: boolean; slots: { start: string; end: string }[] };
  };
}

export interface Trainer {
  id?: string;
  fullName: string;
  initials: string;
  pin: string;
  isOwner?: boolean;
  availability?: TrainerAvailability;
  mindbody_ical_url?: string;
  legacy_filemaker_id?: string;
  createdAt?: any;
  order?: number;
}

export interface Client {
  id?: string;
  firstName: string;
  lastName: string;
  gender: 'Male' | 'Female' | 'Other';
  height: string; // e.g., "5'10\""
  weight?: string;
  age?: number;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  isActive: boolean;
  medicalHistory?: string;
  occupation?: string;
  globalNotes?: string;
  isRoutineBActive?: boolean;
  remainingSessions: number;
  legacy_filemaker_id?: string;
  mindbody_name?: string;
  createdAt?: any;
}

export interface Machine {
  id?: string;
  name: string;
  fullName?: string;
  settings?: string; // Repurposed as "Standard Setup Tips"
  settingOptions?: string[]; // e.g. ["Seat", "Pads", "Backrest"]
  order: number;
  imageUrl?: string;
  targetMuscles?: string; // Muscle group names or short desc
  muscleImageUrl?: string; // Image showing targeted muscles
  formVideoUrl?: string;
  cueingTips?: string; // Peer-to-peer trainer tips
  deepDiveNotes?: string;
}

export interface MachineSettingChange {
  id?: string;
  machineId: string;
  clientId: string;
  trainerId: string;
  previousSettings: Record<string, string>;
  newSettings: Record<string, string>;
  reason?: string;
  createdAt: any;
}

export interface Routine {
  id?: string;
  clientId: string;
  name: string;
  machineIds: string[];
  machineNotes?: Record<string, string>; // Machine ID -> Routine-specific Note
  createdAt?: any;
}

export interface RoutineAdjustment {
  id?: string;
  routineId: string;
  clientId: string;
  previousMachineIds: string[];
  newMachineIds: string[];
  trainerId: string;
  notes?: string;
  createdAt: any;
}

export type SessionType = 'Standard' | 'Onboarding' | 'Reset';

export interface WorkoutSession {
  id?: string;
  clientId?: string;
  routineId?: string;
  sessionType: SessionType;
  sessionNumber: number;
  date: string;
  trainerInitials: string;
  notes?: string; // Original notes field (deprecated in favor of sub-collection)
  startTime?: any;
  endTime?: any;
  status: 'In-Progress' | 'Completed';
  legacy_filemaker_id?: string;
  legacy_notes?: string;
  createdAt?: any;
}

export interface SessionNote {
  id?: string;
  sessionId: string;
  clientId?: string;
  trainerId?: string;
  trainerInitials: string;
  content: string;
  createdAt: any;
}

export interface ExerciseLog {
  id?: string;
  sessionId: string;
  clientId?: string;
  machineId: string;
  suggestedOrder?: number;
  weight?: string;
  reps?: string;
  seconds?: string;
  targetWeight?: string;
  isStaticHold?: boolean;
  repQuality?: number;
  notes?: string;
  machineSettings?: Record<string, string>; // Settings used for this specific set
  createdAt?: any;
  updatedAt?: any;
}

export interface MachineNote {
  id?: string;
  content: string;
  authorId?: string;
  authorName: string;
  timestamp: any;
  isImportant: boolean;
}

export interface SettingsHistoryEntry {
  settings: Record<string, string>;
  updatedBy: string;
  updatedAt: any;
  reason?: string;
}

export interface ClientMachineSetting {
  id?: string;
  clientId: string;
  machineId: string;
  settings: Record<string, string>;
  updatedBy: string;
  updatedAt: any;
  notes?: string;
  machineNotes?: MachineNote[];
  settingsHistory?: SettingsHistoryEntry[];
}

export interface ScheduleEntry {
  id?: string;
  clientId?: string;
  clientName: string;
  trainerId?: string;
  trainerName: string;
  startTime: any;
  endTime: any;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'No-Show';
  serviceName: string;
  source: 'MindBody' | 'Manual' | 'Subscription';
  importId?: string;
  ical_uid?: string;
  createdAt: any;
}

export interface ProgressReport {
  id?: string;
  clientId: string;
  trainerId: string;
  trainerName: string;
  date: string;
  isManual?: boolean;
  status: 'Draft' | 'Finalized';
  
  // Step 1: Attendance & Consistency
  attendance: {
    score: number; // 0-100
    totalSessions: number;
    avgDuration: number;
    punctuality: string; // e.g., "Generally early"
    narrative: string; // "Great job showing up..."
  };

  // Step 2: Highlighted Movements (Measurable Progress)
  highlights: {
    machineId?: string;
    label: string; // e.g., "Leg Press"
    startValue: string; // e.g., "120 lbs"
    currentValue: string; // e.g., "185 lbs"
    featuredMetric: 'weight' | 'percentile' | 'subjective';
    agePercentile?: number; // 0-100
    subjectiveImprovement?: {
      p: 'Posture' | 'Pace' | 'Path' | 'Purpose';
      note: string;
    };
  }[];

  // Step 3: The Four P's
  performanceMatrix: {
    posture: { 
      score: number; 
      note: string; 
      talkingPoints: { id: string; text: string; status: 'red' | 'black' | 'green' }[];
    };
    pace: { 
      score: number; 
      note: string; 
      talkingPoints: { id: string; text: string; status: 'red' | 'black' | 'green' }[];
    };
    path: { 
      score: number; 
      note: string; 
      talkingPoints: { id: string; text: string; status: 'red' | 'black' | 'green' }[];
    };
    purpose: { 
      score: number; 
      note: string; 
      talkingPoints: { id: string; text: string; status: 'red' | 'black' | 'green' }[];
    };
  };

  // Step 4: The Past (Milestones)
  milestones: {
    originalWhy: string;
    smartGoal: string; // "Skiing trip ready by [Date]"
  };

  // Step 5: The Future
  strategy: {
    primaryPlan: string; // "Routine Mastery"
    focusAreas: string; // "Immediate machine focus..."
  };

  createdAt: any;
}

export type FocusCategory = 'Path' | 'Pace' | 'Posture' | 'Purpose';

export interface TrainerFocus {
  id?: string;
  clientId: string;
  trainerId: string;
  trainerName: string;
  category: FocusCategory;
  notes: string;
  updatedAt: any;
}

export type View = 'trainers' | 'clients' | 'machines' | 'workouts' | 'history' | 'calendar' | 'trainer-hub' | 'dashboard' | 'profile' | 'chart' | 'trainer-profile' | 'progress-report';
