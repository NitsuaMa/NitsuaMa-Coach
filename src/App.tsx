/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  AlertCircle,
  LogOut,
  UserCircle,
  ShieldCheck,
  Dumbbell,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  StickyNote,
  Save,
  Settings,
  Trash2,
  GripVertical,
  Timer,
  History,
  Layout,
  Search,
  Play,
  Star,
  Clock,
  Calendar,
  Lock,
  Edit3,
  TrendingUp,
  PlusCircle,
  PlayCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Mic,
  Check,
  X
} from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { Stopwatch } from './components/Stopwatch';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  getDocFromServer,
  where,
  setDoc,
  getDocs,
  limit,
  Timestamp
} from 'firebase/firestore';
import { 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser,
  signInWithPopup
} from 'firebase/auth';

import { db, auth } from './firebase';
import { Trainer, TrainerAvailability, Client, View, Machine, WorkoutSession, ExerciseLog, Routine, ClientMachineSetting, SessionType, SessionNote, TrainerFocus } from './types';
import { OperationType, handleFirestoreError } from './lib/firestore-errors';
import { hashPin } from './lib/auth-utils';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TrainerControlHubView } from './components/TrainerControlHubView';
import { OwnerDashboardView } from './components/OwnerDashboardView';
import { ClientProfileView } from './components/ClientProfileView';
import { CalendarView } from './components/CalendarView';
import { PinLoginView } from './components/PinLoginView';
import { ProfilesView } from './components/ProfilesView';
import { TrainerProfileView } from './components/TrainerProfileView';
import { PreSessionOverview } from './components/PreSessionOverview';
import { ClientProgressReportView } from './components/ClientProgressReportView';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

const DEFAULT_MACHINES: Machine[] = [
  { id: "m-neck", name: "CX (4 way neck)", order: 1, settingOptions: ["Gap", "Back Pad", "Seat"] },
  { id: "m-hip-add", name: "Hip Adduction", order: 2, settingOptions: ["Gap", "Back Pad"] },
  { id: "m-hip-abd", name: "Hip Abduction", order: 3, settingOptions: ["Gap", "Back Pad", "Thigh Pads"] },
  { id: "m-leg-curl", name: "Leg Curl", order: 4, settingOptions: ["Gap", "Back Pad", "Ankle Pad"] },
  { id: "m-leg-ext", name: "Leg Extension", order: 5, settingOptions: ["Gap", "Back Pad"] },
  { id: "m-leg-press", name: "Leg Press", order: 6, settingOptions: ["Gap", "Seat Angle", "Shoulder Pads", "Seat Distance"] },
  { id: "m-pulldown", name: "Pulldown", order: 7, settingOptions: ["Gap", "Back Pad", "Seat", "Handles"] },
  { id: "m-chest-press", name: "Chest Press", order: 8, settingOptions: ["Gap", "Back Pad", "Seat"] },
  { id: "m-compound-row", name: "Compound Row", order: 9, settingOptions: ["Gap", "Chest Pad", "Handles"] },
  { id: "m-simple-row", name: "Simple Row", order: 10, settingOptions: ["Gap", "Chest Pad", "Seat Pad"] },
  { id: "m-overhead-press", name: "Overhead Press", order: 11, settingOptions: ["Gap", "Seat"] },
  { id: "m-pullover", name: "Seated Pullover", order: 12, settingOptions: ["Gap", "Seat", "Handles"] },
  { id: "m-dip", name: "Seated Dip", order: 13, settingOptions: ["Gap", "Back Pad Height", "Back Pad Angle", "Seat", "Handles"] },
  { id: "m-tricep-ext", name: "Tricep Extension", order: 14, settingOptions: ["Gap", "Seat"] },
  { id: "m-bicep", name: "Bicep", order: 15, settingOptions: ["Gap", "Seat"] },
  { id: "m-chest-fly", name: "Chest/Pec Fly", order: 16, settingOptions: ["Gap", "Back Pad", "Seat"] },
  { id: "m-lateral-raise", name: "Lateral Raise", order: 17, settingOptions: ["Gap", "Seat", "Handles"] },
  { id: "m-lumbar", name: "Lumbar", order: 18, settingOptions: ["Gap", "Seat"] },
  { id: "m-abs", name: "Seated Abdominals", order: 19, settingOptions: ["Gap", "Seat"] },
  { id: "m-torso-rotation", name: "Torso Rotation", order: 20, settingOptions: ["Gap", "Arms", "Seat"] },
];

type RoutineType = 'A' | 'B' | 'Free';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authTrainer, setAuthTrainer] = useState<Trainer | null>(null);
  const [currentView, setCurrentView] = useState<View>('clients');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [machines, setMachines] = useState<Machine[]>(DEFAULT_MACHINES);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [trainerFocuses, setTrainerFocuses] = useState<TrainerFocus[]>([]);
  const [isAddingTrainer, setIsAddingTrainer] = useState(false);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [showNewClientsDialog, setShowNewClientsDialog] = useState(false);
  const [isReorderingTrainers, setIsReorderingTrainers] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const newClientsThisMonth = useMemo(() => {
    return clients.filter(c => {
      if (!c.createdAt) return false;
      const createdAt = c.createdAt?.toDate?.() || new Date(c.createdAt);
      const now = new Date();
      return createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
    });
  }, [clients]);

  const sortedTrainers = useMemo(() => {
    return [...trainers].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [trainers]);
  const [hasQuotaError, setHasQuotaError] = useState(false);
  const [clientFormData, setClientFormData] = useState({ 
    firstName: '', 
    lastName: '', 
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    heightFeet: '', 
    heightInches: '',
    weight: '',
    age: '',
    occupation: '',
    phone: '',
    email: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    isActive: true, 
    isRoutineBActive: false,
    medicalHistory: '',
    globalNotes: '', 
    remainingSessions: 10,
    mindbody_name: '' 
  });

  const startEditClient = (client: Client) => {
    setEditingClient(client);
    
    // Parse height string (e.g., "5' 10\"")
    let ft = '';
    let inc = '';
    if (client.height) {
      if (client.height.includes("'")) {
        const parts = client.height.split("'");
        ft = parts[0].trim();
        if (parts[1]) {
          inc = parts[1].replace('"', '').trim();
        }
      } else {
        // Fallback for old numeric data (assuming inches if > 15)
        const totalInches = parseInt(client.height);
        if (!isNaN(totalInches) && totalInches > 15) {
          ft = Math.floor(totalInches / 12).toString();
          inc = (totalInches % 12).toString();
        } else {
          ft = client.height;
        }
      }
    }

    setClientFormData({
      firstName: client.firstName,
      lastName: client.lastName,
      gender: client.gender,
      heightFeet: ft,
      heightInches: inc,
      height: client.height, // Keep for legacy if needed momentarily
      weight: client.weight || '',
      age: client.age?.toString() || '',
      occupation: client.occupation || '',
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      emergencyContactName: client.emergencyContactName || '',
      emergencyContactPhone: client.emergencyContactPhone || '',
      isActive: client.isActive,
      isRoutineBActive: client.isRoutineBActive || false,
      remainingSessions: client.remainingSessions,
      medicalHistory: client.medicalHistory || '',
      globalNotes: client.globalNotes || ''
    });
    setIsAddingClient(true);
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formattedHeight = `${clientFormData.heightFeet || '0'}' ${clientFormData.heightInches || '0'}"`;
      const submissionData = {
        ...clientFormData,
        height: formattedHeight
      };
      
      // Clean up internal height helper fields if any
      const { heightFeet, heightInches, ...finalData } = submissionData as any;

      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id!), {
          ...finalData,
          updatedAt: serverTimestamp()
        });
        setEditingClient(null);
      } else {
        await addDoc(collection(db, 'clients'), {
          ...finalData,
          createdAt: serverTimestamp()
        });
      }
      setClientFormData({ 
        firstName: '', 
        lastName: '', 
        gender: 'Male',
        heightFeet: '',
        heightInches: '',
        height: '',
        weight: '',
        age: '',
        occupation: '',
        phone: '',
        email: '',
        address: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        isActive: true, 
        isRoutineBActive: false,
        medicalHistory: '',
        globalNotes: '', 
        remainingSessions: 10,
        mindbody_name: ''
      });
      setIsAddingClient(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'clients');
    }
  };

  const updateClientSessions = async (clientId: string, current: number, delta: number) => {
    try {
      const newVal = Math.max(0, current + delta);
      await updateDoc(doc(db, 'clients', clientId), {
        remainingSessions: newVal
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clients/${clientId}`);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      await deleteDoc(doc(db, 'clients', clientId));
      setSelectedClientId(null);
      setCurrentView('clients');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `clients/${clientId}`);
    }
  };

  const [showClientPicker, setShowClientPicker] = useState(false);
  const [infoMachineId, setInfoMachineId] = useState<string | null>(null);
  const [isEditingMachineInfo, setIsEditingMachineInfo] = useState(false);
  const [machineInfoDraft, setMachineInfoDraft] = useState<Partial<Machine>>({});

  const infoMachine = machines.find(m => m.id === infoMachineId);

  useEffect(() => {
    if (infoMachine) {
      setMachineInfoDraft(infoMachine);
    }
  }, [infoMachine]);

  // Trainer Session Persistence
  useEffect(() => {
    // Check for view override in URL (for emergency admin access)
    const urlParams = new URLSearchParams(window.location.search);
    const viewOverride = urlParams.get('view');
    
    if (viewOverride === 'trainer-hub' && user?.email === "jurgensaj@gmail.com") {
      if (trainers.length > 0) {
        const ownerTrainer = trainers.find(t => t.isOwner) || trainers[0];
        setAuthTrainer(ownerTrainer);
      } else {
        // Mock a trainer if none exist for bypass
        setAuthTrainer({ id: 'owner-temp', fullName: 'Owner Tim', initials: 'TD', pin: '0000', isOwner: true } as any);
      }
      setCurrentView('trainer-hub');
      return;
    }

    if (trainers.length > 0 && !authTrainer) {
      const savedId = localStorage.getItem('max_strength_trainer_id');
      if (savedId) {
        const matching = trainers.find(t => t.id === savedId);
        if (matching) setAuthTrainer(matching);
      }
    }
  }, [trainers, authTrainer]);

  const handleTrainerLogin = (trainer: Trainer) => {
    setAuthTrainer(trainer);
    localStorage.setItem('max_strength_trainer_id', trainer.id!);
  };

  const handleTrainerLock = () => {
    setAuthTrainer(null);
    localStorage.removeItem('max_strength_trainer_id');
  };

  const handleAppCleanse = async () => {
    const confirmation = confirm("CRITICAL ACTION: This will delete ALL data (Clients, Trainers, Logs, Sessions, Routines) and re-initialize the 20 standard machines. This cannot be undone. Proceed?");
    if (!confirmation) return;

    try {
      const collectionsToWipe = [
        'machines', 
        'clients', 
        'trainers', 
        'sessions', 
        'exerciseLogs', 
        'clientMachineSettings', 
        'routines', 
        'routineAdjustments', 
        'schedules',
        'notes',
        'sessionNotes',
        'machineSettingChanges'
      ];

      console.log("Starting full app cleanse...");
      for (const colName of collectionsToWipe) {
        const snap = await getDocs(collection(db, colName));
        console.log(`Clearing ${colName} (${snap.size} docs)...`);
        const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
      }

      console.log("Wipe complete. Re-initializing machines...");
      const machinePromises = DEFAULT_MACHINES.map((machine) => 
        setDoc(doc(db, 'machines', machine.id!), {
          ...machine
        }, { merge: true })
      );
      
      await Promise.all(machinePromises);

      // Clear local state
      setAuthTrainer(null);
      localStorage.removeItem('max_strength_trainer_id');
      setSelectedClientId(null);
      setCurrentView('clients');
      
      alert("Application cleansed and reset to 20 machines. The app will now reload.");
      window.location.href = window.location.origin + window.location.pathname; 
    } catch (error: any) {
      console.error("Cleanse failed:", error);
      alert(`Cleanse failed: ${error.message || 'Unknown error'}. Please check your connection or permissions.`);
    }
  };

  const handleSeedDemoClient = async () => {
    try {
      const trainerId = authTrainer?.id || auth.currentUser?.uid || "demo-trainer";
      const trainerInitials = authTrainer?.initials || "JD";
      
      // 1. Create the Client with a unique-ish ID to avoid collisions
      const demoClientRef = doc(collection(db, 'clients'));
      await setDoc(demoClientRef, {
        firstName: "John",
        lastName: "Demo",
        gender: "Male",
        height: "5' 10\"",
        weight: "185",
        age: 35,
        isActive: true,
        isRoutineBActive: true,
        remainingSessions: 12,
        email: `john.demo.${Date.now()}@example.com`,
        createdAt: serverTimestamp()
      });

      const demoClientId = demoClientRef.id;

      // 2. Define and Create Routines
      const routineAIds = ["m-hip-add", "m-hip-abd", "m-leg-press", "m-compound-row", "m-dip", "m-lumbar"];
      const routineBIds = ["m-leg-curl", "m-leg-ext", "m-pulldown", "m-overhead-press", "m-abs"];

      await addDoc(collection(db, 'routines'), {
        clientId: demoClientId,
        name: "A",
        machineIds: routineAIds,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'routines'), {
        clientId: demoClientId,
        name: "B",
        machineIds: routineBIds,
        createdAt: serverTimestamp()
      });

      // 3. Generate 2 months of history (16 sessions)
      const now = new Date();
      
      for (let i = 0; i < 16; i++) {
        const sessionDate = new Date(now);
        sessionDate.setDate(now.getDate() - (15 - i) * 3.5); 
        const dateStr = sessionDate.toISOString().split('T')[0];
        const isRoutineA = i % 2 === 0;
        const routineName = isRoutineA ? "A" : "B";
        const machineIds = isRoutineA ? routineAIds : routineBIds;

        const ts = Timestamp.fromDate(sessionDate);
        const sessionRef = await addDoc(collection(db, 'sessions'), {
          clientId: demoClientId,
          trainerId: trainerId,
          trainerInitials: trainerInitials,
          date: dateStr,
          routineName: routineName,
          sessionType: 'Standard',
          sessionNumber: i + 1,
          status: 'Completed',
          createdAt: ts,
          startTime: ts,
          endTime: ts,
        });

        // Add logs with progressive weights
        const logPromises = machineIds.map((mId, mIdx) => {
          const baseWeight = 50 + (mIdx * 20);
          const weightValue = baseWeight + (i * 5); 
          
          return addDoc(collection(db, 'exerciseLogs'), {
            sessionId: sessionRef.id,
            clientId: demoClientId,
            machineId: mId,
            weight: weightValue.toString(),
            reps: (8 + (i % 4)).toString(),
            createdAt: ts
          });
        });
        await Promise.all(logPromises);
      }

      alert("Demo Client 'John Demo' generated with 2 months of history!");
    } catch (err: any) {
      console.error("Demo seeding failed:", err);
      alert(`Demo seeding failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleRestoreMachines = async () => {
    try {
      const promises = DEFAULT_MACHINES.map((machine) => 
        setDoc(doc(db, 'machines', machine.id!), {
          ...machine,
          updatedAt: serverTimestamp()
        }, { merge: true })
      );
      
      await Promise.all(promises);
      alert(`Standard units enforced successfully.`);
    } catch (error: any) {
      console.error("Restore failed:", error);
      alert(`Restore failed: ${error.message || 'Unknown error'}`);
    }
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Seed Machines and Trainers if empty
  useEffect(() => {
    if (!isAuthReady || !user || hasQuotaError) return;

    const seedData = async () => {
      try {
        const trainersSnap = await getDocs(collection(db, 'trainers'));
        if (trainersSnap.empty) {
          console.log("Seeding standardized trainers...");
          const team = [
            { fullName: "Marina Borden", initials: "MB" },
            { fullName: "Giovanni Lupia", initials: "GL" },
            { fullName: "Christian Lupia", initials: "CL" },
            { fullName: "Austin Jurgens", initials: "AJ" },
            { fullName: "Arielle Sweeney", initials: "AS" },
            { fullName: "Tim Dardis", initials: "TD", isOwner: true }
          ];
          
          for (const member of team) {
            await addDoc(collection(db, 'trainers'), {
              ...member,
              pin: "0000", 
              createdAt: serverTimestamp(),
              order: team.indexOf(member)
            });
          }
        }

        // Check if machines exist before seeding to save quota
        const machinesSnap = await getDocs(collection(db, 'machines'));
        if (machinesSnap.size < DEFAULT_MACHINES.length) {
          console.log("Ensuring standard equipment is synced...");
          const machinePromises = DEFAULT_MACHINES.map((machine) => 
            setDoc(doc(db, 'machines', machine.id!), {
              ...machine
            }, { merge: true })
          );
          await Promise.all(machinePromises);
        }

      } catch (error: any) {
        if (error.message?.includes('Quota limit exceeded')) setHasQuotaError(true);
        console.error("Failed to seed:", error);
      }
    };
    
    seedData();
  }, [isAuthReady, user, hasQuotaError]);

  // Cleanup old unassigned sessions (once daily per user session)
  useEffect(() => {
    if (!isAuthReady || !user || hasQuotaError) return;

    const cleanup = async () => {
      const todayString = new Date().toISOString().split('T')[0];
      const lastCleanup = localStorage.getItem('last_unassigned_cleanup');
      if (lastCleanup === todayString) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      try {
        const q = query(
          collection(db, 'sessions'),
          where('isUnassigned', '==', true)
        );
        
        const snap = await getDocs(q);
        const deletePromises = snap.docs
          .filter(docRef => {
            const data = docRef.data();
            const created = data.createdAt?.toDate() || new Date(data.date);
            return created < today;
          })
          .map(async (docRef) => {
            try {
              // Delete associated logs first
              const logsQ = query(collection(db, 'exerciseLogs'), where('sessionId', '==', docRef.id));
              const logsSnap = await getDocs(logsQ);
              for (const logDoc of logsSnap.docs) {
                await deleteDoc(logDoc.ref);
              }
              // Delete associated notes
              const notesQ = query(collection(db, 'sessionNotes'), where('sessionId', '==', docRef.id));
              const notesSnap = await getDocs(notesQ);
              for (const noteDoc of notesSnap.docs) {
                await deleteDoc(noteDoc.ref);
              }
              // Delete session
              await deleteDoc(docRef.ref);
            } catch (err: any) {
               if (err.message?.includes('Quota limit exceeded')) setHasQuotaError(true);
            }
          });
          
        await Promise.all(deletePromises);
        localStorage.setItem('last_unassigned_cleanup', todayString);
      } catch (error: any) {
        if (error.message?.includes('Quota limit exceeded')) setHasQuotaError(true);
        console.error("Error cleaning up sessions:", error);
      }
    };
    cleanup();
  }, [isAuthReady, user, hasQuotaError]);

  // Data Listeners
  useEffect(() => {
    if (!isAuthReady || !user || hasQuotaError) return;

    const trainersQuery = query(collection(db, 'trainers'), orderBy('order', 'asc'));
    const unsubscribeTrainers = onSnapshot(trainersQuery, (snapshot) => {
      const trainersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trainer));
      setTrainers(trainersData);
    }, (error) => {
      if (error.message.includes('Quota limit exceeded')) setHasQuotaError(true);
      handleFirestoreError(error, OperationType.GET, 'trainers');
    });

    const clientsQuery = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
    const unsubscribeClients = onSnapshot(clientsQuery, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(clientsData);
    }, (error) => {
      if (error.message.includes('Quota limit exceeded')) setHasQuotaError(true);
      handleFirestoreError(error, OperationType.GET, 'clients');
    });

    const machinesQuery = query(collection(db, 'machines'), orderBy('order', 'asc'));
    const unsubscribeMachines = onSnapshot(machinesQuery, (snapshot) => {
      const machinesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine));
      
      // Merge Remote data into DEFAULT_MACHINES to ensure all 20 units are always available
      // even if something was deleted in Firestore, and to provide hardcoded defaults
      const mergedMachines = DEFAULT_MACHINES.map(dm => {
        const remote = machinesData.find(r => r.id === dm.id);
        return remote ? { ...dm, ...remote } : dm;
      });

      // Also include any custom machines added later (if any)
      const customMachines = machinesData.filter(r => !DEFAULT_MACHINES.find(dm => dm.id === r.id));
      
      setMachines([...mergedMachines, ...customMachines].sort((a, b) => a.order - b.order));
    }, (error) => {
      if (error.message.includes('Quota limit exceeded')) setHasQuotaError(true);
      handleFirestoreError(error, OperationType.GET, 'machines');
    });

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const schedulesQuery = query(
      collection(db, 'schedules'), 
      where('startTime', '>=', Timestamp.fromDate(twentyFourHoursAgo)),
      where('startTime', '<=', Timestamp.fromDate(thirtyDaysAhead)),
      orderBy('startTime', 'asc')
    );
    const unsubscribeSchedules = onSnapshot(schedulesQuery, (snapshot) => {
      const schedulesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(schedulesData);
    }, (error) => {
      if (error.message.includes('Quota limit exceeded')) setHasQuotaError(true);
      handleFirestoreError(error, OperationType.GET, 'schedules');
    });

    const sessionsQuery = query(
      collection(db, 'sessions'), 
      where('createdAt', '>=', Timestamp.fromDate(twentyFourHoursAgo)),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutSession));
      setSessions(sessionsData);
    }, (error) => {
      if (error.message.includes('Quota limit exceeded')) setHasQuotaError(true);
      handleFirestoreError(error, OperationType.GET, 'sessions');
    });

    const unsubscribeTrainerFocuses = onSnapshot(collection(db, 'trainerFocuses'), (snapshot) => {
      const focusData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainerFocus));
      setTrainerFocuses(focusData);
    }, (error) => {
      if (error.message.includes('Quota limit exceeded')) setHasQuotaError(true);
      handleFirestoreError(error, OperationType.GET, 'trainerFocuses');
    });

    return () => {
      unsubscribeTrainers();
      unsubscribeClients();
      unsubscribeMachines();
      unsubscribeSchedules();
      unsubscribeSessions();
      unsubscribeTrainerFocuses();
    };
  }, [isAuthReady, user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (hasQuotaError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-6">
        <Card className="w-full max-w-md border-none shadow-2xl bg-card/50 backdrop-blur-xl rounded-[40px] overflow-hidden text-center">
          <CardHeader className="p-8 pb-4">
            <div className="mx-auto w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-6">
              <AlertCircle className="w-10 h-10 text-amber-500" />
            </div>
            <CardTitle className="text-3xl font-black uppercase italic tracking-tighter">Capacity Reached</CardTitle>
            <CardDescription className="text-xs font-bold uppercase tracking-widest leading-relaxed mt-2 text-muted-foreground/60">
              The daily data limit for the free tier has been reached. 
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-4 space-y-6">
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
              To keep costs at $0, we use Google's free tier. The system will automatically reset and become available again in a few hours (at midnight).
            </p>
            <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estimate Reset Time</p>
              <p className="text-lg font-black italic uppercase tracking-tight text-primary mt-1">~12:00 AM Pacific</p>
            </div>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline" 
              className="w-full h-14 rounded-2xl font-black uppercase tracking-widest border-2"
            >
              Check Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium">Loading Max Strength...</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-6">
        <Card className="w-full max-w-md border-none shadow-2xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-2">
              <ShieldCheck className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">Max Strength Facility</CardTitle>
            <CardDescription className="text-base">
              Authorized personnel only. Please sign in to activate this station.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleLogin} 
              className="w-full h-14 text-lg font-semibold shadow-lg hover:shadow-primary/20 transition-all"
            >
              Sign in with Google
            </Button>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-xs text-muted-foreground">Master/Admin login required</p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Trainer PIN Access Screen
  if (!authTrainer) {
    return (
      <PinLoginView 
        trainers={trainers} 
        user={user}
        onLogin={handleTrainerLogin} 
      />
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col min-h-screen bg-background text-foreground font-sans overflow-x-hidden w-full max-w-full">
        {/* Header */}
        {currentView !== 'workouts' && (
          <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="font-bold text-xl tracking-tight hidden sm:block">Max Strength</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-2 py-1.5 bg-[#115E8D]/5 border border-[#115E8D]/10 rounded-full cursor-pointer hover:bg-[#115E8D]/10 transition-colors">
                <div className="w-8 h-8 rounded-full bg-[#115E8D] text-white flex items-center justify-center shadow-inner">
                  <span className="font-black text-xs uppercase tracking-wider">{authTrainer.initials}</span>
                </div>
                <div className="flex flex-col pr-3">
                  <span className="text-[9px] font-black uppercase text-[#68717A] tracking-widest leading-none mb-0.5">Trainer Profile</span>
                  <span className="text-xs font-black uppercase tracking-tight text-[#115E8D]">{authTrainer.fullName}</span>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  try {
                    await axios.post('/api/trigger-master-sync', { hardReset: false });
                  } catch (err) {
                    console.error('Sync failed:', err);
                  }
                }}
                className="rounded-full opacity-60 hover:opacity-100 hover:text-primary transition-all group"
                title="Resync All Calendars"
              >
                <RefreshCw className="w-5 h-5 group-active:rotate-180 transition-transform duration-500" />
              </Button>

              <div className="w-px h-8 bg-border/50 mx-1" />

              <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full" title="Logout Facility Account">
                <LogOut className="w-5 h-5 opacity-40 hover:opacity-100" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCurrentView('trainer-hub')} 
                className={`rounded-full ${currentView === 'trainer-hub' ? 'text-primary bg-primary/10' : ''}`}
                title="Trainer Control Hub"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </header>
        )}

        {/* Main Content */}
        <main className={`flex-1 overflow-y-auto p-6 pb-24 max-w-full mx-auto w-full ${currentView === 'workouts' ? 'p-2 pb-24' : ''}`}>
          <AnimatePresence mode="wait">
            {currentView === 'trainers' && (
              <ProfilesView 
                trainers={trainers} 
                clients={clients}
                sessions={sessions}
                schedules={schedules}
                onSelectClient={(id) => {
                  setSelectedClientId(id);
                }}
                setSelectedClientId={setSelectedClientId}
                setView={setCurrentView}
                authTrainer={authTrainer}
                isAdmin={user.email === "jurgensaj@gmail.com"}
              />
            )}
            {currentView === 'clients' && (
              <ClientsView 
                clients={clients} 
                trainers={trainers}
                sortedTrainers={sortedTrainers}
                isAdmin={user?.email === "jurgensaj@gmail.com"}
                isAdding={isAddingClient} 
                setIsAdding={setIsAddingClient} 
                onSelectClient={(id) => {
                  setSelectedClientId(id);
                  setCurrentView('workouts');
                }}
                setView={setCurrentView}
                schedules={schedules}
                sessions={sessions}
                editingClient={editingClient}
                setEditingClient={setEditingClient}
                formData={clientFormData}
                setFormData={setClientFormData}
                onSubmit={handleClientSubmit}
                startEdit={startEditClient}
                updateSessions={updateClientSessions}
                setSelectedSessionId={setSelectedSessionId}
              />
            )}
            {currentView === 'machines' && (
              <MachinesView 
                machines={machines} 
                clients={clients} 
                onOpenInfo={(m) => {
                  setInfoMachineId(m.id!);
                  setIsEditingMachineInfo(false);
                }}
              />
            )}
            {currentView === 'workouts' && (
              <WorkoutTrackerView 
                clientId={selectedClientId} 
                clients={clients}
                machines={machines}
                trainers={trainers}
                user={user}
                setView={setCurrentView}
                setSelectedClientId={setSelectedClientId}
                showClientPicker={showClientPicker}
                setShowClientPicker={setShowClientPicker}
                setIsAddingClient={setIsAddingClient}
                setClientFormData={setClientFormData}
                onOpenInfo={(m) => {
                  setInfoMachineId(m.id!);
                  setIsEditingMachineInfo(false);
                }}
                authTrainer={authTrainer}
                trainerFocuses={trainerFocuses}
              />
            )}
            {currentView === 'history' && (
              <ClientHistoryView 
                clientId={selectedClientId} 
                clients={clients}
                machines={machines}
                trainers={trainers}
                setView={setCurrentView}
                selectedSessionId={selectedSessionId}
              />
            )}
            {currentView === 'profile' && (
              <ClientProfileView 
                clientId={selectedClientId}
                clients={clients}
                machines={machines}
                authTrainer={authTrainer}
                onDelete={handleDeleteClient}
                onSelectReport={(reportId) => {
                  setSelectedReportId(reportId);
                  setCurrentView('progress-report');
                }}
                setView={setCurrentView}
              />
            )}
            {currentView === 'progress-report' && selectedClientId && authTrainer && (
              <ClientProgressReportView
                client={clients.find(c => c.id === selectedClientId)!}
                trainer={authTrainer}
                machines={machines}
                existingReportId={selectedReportId || undefined}
                onBack={() => {
                  setSelectedReportId(null);
                  setCurrentView('profile');
                }}
              />
            )}
            {currentView === 'trainer-profile' && authTrainer && (
              <TrainerProfileView 
                trainer={authTrainer}
                schedules={schedules}
                sessions={sessions}
                clients={clients}
                onSelectClient={setSelectedClientId}
                setView={setCurrentView}
              />
            )}
            {currentView === 'trainer-hub' && (
              <TrainerControlHubView 
                trainers={trainers} 
                machines={machines}
                clients={clients}
                authTrainer={authTrainer} 
                isAdmin={authTrainer?.isOwner || user.email === "jurgensaj@gmail.com"} 
                onAppCleanse={handleAppCleanse}
                onSeedDemoClient={handleSeedDemoClient}
                onRestoreMachines={handleRestoreMachines}
                onLogout={handleLogout}
                onReorderTrainers={() => setIsReorderingTrainers(true)}
              />
            )}
            {currentView === 'dashboard' && (
              <OwnerDashboardView 
                clients={clients} 
                trainers={trainers} 
                machines={machines} 
                sessions={sessions}
                newClientsCount={newClientsThisMonth.length}
                onShowNewClients={() => setShowNewClientsDialog(true)}
              />
            )}
            {currentView === 'calendar' && (
              <CalendarView 
                schedules={schedules} 
                trainers={trainers} 
                authTrainer={authTrainer}
                isAdmin={user.email === "jurgensaj@gmail.com"}
                onSelectClient={setSelectedClientId}
                setView={setCurrentView}
                clients={clients}
              />
            )}
          </AnimatePresence>
        </main>

        {/* Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 border-t bg-background/90 backdrop-blur-lg px-6 h-20 flex items-center justify-around z-50">
          <NavButton 
            active={currentView === 'clients'} 
            onClick={() => setCurrentView('clients')}
            icon={<Users className="w-6 h-6" />}
            label="Clients"
          />
          <NavButton 
            active={currentView === 'machines'} 
            onClick={() => setCurrentView('machines')}
            icon={<Dumbbell className="w-6 h-6" />}
            label="Machines"
          />
          <NavButton 
            active={currentView === 'workouts'} 
            onClick={() => {
              setCurrentView('workouts');
            }}
            icon={<ClipboardList className="w-6 h-6" />}
            label="Workout"
          />
          <NavButton 
            active={currentView === 'calendar'} 
            onClick={() => setCurrentView('calendar')}
            icon={<Calendar className="w-6 h-6" />}
            label="Calendar"
          />
          <NavButton 
            active={currentView === 'trainer-profile'} 
            onClick={() => setCurrentView('trainer-profile')}
            icon={<UserCircle className="w-6 h-6" />}
            label="My Schedule"
          />
          {(authTrainer?.isOwner || user?.email === "jurgensaj@gmail.com") && (
            <NavButton 
              active={currentView === 'dashboard'} 
              onClick={() => setCurrentView('dashboard')}
              icon={<TrendingUp className="w-6 h-6" />}
              label="Insights"
            />
          )}
        </nav>
      </div>

      {/* Machine Information Deep Dive Dialog */}
      <Dialog open={!!infoMachineId} onOpenChange={(open) => !open && setInfoMachineId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-[32px] p-0 border-none shadow-2xl">
          {infoMachine && (
            <>
              <DialogHeader className="p-8 bg-muted/30 border-b relative">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-xl text-primary shadow-sm">
                    {infoMachine.order}
                  </div>
                  <div>
                    <DialogTitle className="text-3xl font-black uppercase italic tracking-tighter">
                      {infoMachine.fullName || infoMachine.name}
                    </DialogTitle>
                    <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Deep Dive & Operational Guidelines
                    </DialogDescription>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-6 right-6 h-10 w-10 rounded-xl"
                  onClick={() => setIsEditingMachineInfo(!isEditingMachineInfo)}
                >
                  <Edit3 className="w-5 h-5" />
                </Button>
              </DialogHeader>

              <div className="p-8 space-y-8">
                {isEditingMachineInfo ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Muscles</Label>
                        <Input 
                          value={machineInfoDraft.targetMuscles || ''} 
                          onChange={e => setMachineInfoDraft({...machineInfoDraft, targetMuscles: e.target.value})}
                          placeholder="e.g. Chest, Triceps"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Form Video URL</Label>
                        <Input 
                          value={machineInfoDraft.formVideoUrl || ''} 
                          onChange={e => setMachineInfoDraft({...machineInfoDraft, formVideoUrl: e.target.value})}
                          placeholder="Youtube/Vimeo Link"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Standard Machine Settings (Tips)</Label>
                      <Textarea 
                         value={machineInfoDraft.settings || ''} 
                         onChange={e => setMachineInfoDraft({...machineInfoDraft, settings: e.target.value})}
                         placeholder="Recommended starting points for different heights/sizes..."
                         className="min-h-[80px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cueing Tips (Trainer to Trainer)</Label>
                      <Textarea 
                         value={machineInfoDraft.cueingTips || ''} 
                         onChange={e => setMachineInfoDraft({...machineInfoDraft, cueingTips: e.target.value})}
                         placeholder="Pointers for better client form..."
                         className="min-h-[100px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Deep Dive Notes</Label>
                      <Textarea 
                         value={machineInfoDraft.deepDiveNotes || ''} 
                         onChange={e => setMachineInfoDraft({...machineInfoDraft, deepDiveNotes: e.target.value})}
                         placeholder="History, benefits, or complex cues..."
                         className="min-h-[150px]"
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button 
                        className="flex-1 h-12 rounded-xl font-black uppercase italic italic tracking-widest"
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'machines', infoMachine.id!), {
                              ...machineInfoDraft,
                              updatedAt: serverTimestamp()
                            });
                            setIsEditingMachineInfo(false);
                          } catch (err) {
                            handleFirestoreError(err, OperationType.UPDATE, 'machines');
                          }
                        }}
                      >
                        Save Information
                      </Button>
                      <Button variant="outline" className="h-12 px-6 rounded-xl" onClick={() => setIsEditingMachineInfo(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-8">
                    {/* Visual & Core Info Header */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="aspect-video bg-muted rounded-2xl overflow-hidden relative flex items-center justify-center border border-border">
                        {infoMachine.imageUrl ? (
                           <img src={infoMachine.imageUrl} className="w-full h-full object-cover opacity-90" referrerPolicy="no-referrer" />
                        ) : (
                           // Unsplash default photo mechanism for robust mockups
                           <img src={`https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80`} className="w-full h-full object-cover opacity-90" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[#F06C22] mb-1">Targeted Muscles</p>
                              <div className="flex flex-wrap gap-1.5">
                                {infoMachine.targetMuscles?.split(',').map(m => (
                                  <Badge key={m} className="bg-primary/90 text-primary-foreground border-none font-medium uppercase text-[9px] px-2 py-0.5">{m.trim()}</Badge>
                                )) || <Badge className="bg-primary/90 text-primary-foreground border-none font-medium uppercase text-[9px] px-2 py-0.5">Primary Target Area</Badge>}
                              </div>
                            </div>
                        </div>
                      </div>

                      <div className="space-y-4 flex flex-col justify-center">
                        <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10">
                            <h3 className="text-sm font-bold uppercase tracking-tight text-primary mb-2">Resource Actions</h3>
                            <div className="space-y-3">
                                <Button className="w-full justify-start h-12 rounded-xl bg-background border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all">
                                  <Play className="w-4 h-4 mr-3" />
                                  <span className="font-bold text-[10px] uppercase tracking-widest">View Form Guide Video</span>
                                </Button>
                                <Button variant="outline" className="w-full justify-start h-12 rounded-xl font-bold text-[10px] uppercase tracking-widest text-secondary hover:bg-secondary hover:text-secondary-foreground transition-all">
                                  <MessageSquare className="w-4 h-4 mr-3" />
                                  Send Resource to Client
                                </Button>
                            </div>
                        </div>
                      </div>
                    </div>

                    {/* Machine Insights Section (Orange Application) */}
                    <div className="bg-action/5 border border-action/20 rounded-2xl p-6 md:p-8">
                       <h3 className="text-xl font-bold uppercase tracking-tight text-action mb-6 flex items-center gap-2">
                         <TrendingUp className="w-6 h-6" />
                         Machine Insights & Demographics
                       </h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         {/* Demographic 1 */}
                         <div className="space-y-4">
                            <div className="flex justify-between items-end">
                              <div>
                                <p className="text-[12px] font-bold text-secondary">Age 20-30</p>
                                <p className="text-[10px] font-medium text-secondary/60 uppercase tracking-widest">Female | Beginner</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                               <div>
                                 <div className="flex justify-between text-[10px] font-bold text-secondary mb-1">
                                   <span>Average Weight (45 lbs)</span>
                                   <span className="text-action">SD ±5</span>
                                 </div>
                                 <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-action w-[45%]" />
                                 </div>
                               </div>
                               <div>
                                 <div className="flex justify-between text-[10px] font-bold text-secondary mb-1">
                                   <span>Average Reps (12)</span>
                                   <span className="text-action">SD ±2</span>
                                 </div>
                                 <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-action/60 w-[60%]" />
                                 </div>
                               </div>
                            </div>
                         </div>
                         {/* Demographic 2 */}
                         <div className="space-y-4">
                            <div className="flex justify-between items-end">
                              <div>
                                <p className="text-[12px] font-bold text-secondary">Age 30-40</p>
                                <p className="text-[10px] font-medium text-secondary/60 uppercase tracking-widest">Male | Advanced</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                               <div>
                                 <div className="flex justify-between text-[10px] font-bold text-secondary mb-1">
                                   <span>Average Weight (120 lbs)</span>
                                   <span className="text-primary">SD ±15</span>
                                 </div>
                                 <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary w-[85%]" />
                                 </div>
                               </div>
                               <div>
                                 <div className="flex justify-between text-[10px] font-bold text-secondary mb-1">
                                   <span>Average Reps (8)</span>
                                   <span className="text-primary">SD ±1.5</span>
                                 </div>
                                 <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary/60 w-[40%]" />
                                 </div>
                               </div>
                            </div>
                         </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Trainer Cues and Tips */}
                      <div className="space-y-4">
                        <h4 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-primary mb-4">
                          <Users className="w-4 h-4" />
                          Trainer Cues & Tips
                        </h4>
                        
                        <div className="space-y-3">
                          {/* Simulated Collapsible Cards */}
                          <div className="border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                             <div className="flex justify-between items-center">
                               <p className="text-[12px] font-bold text-secondary">Marina's Cue</p>
                               <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                             </div>
                             <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">"Keep your chest proud and drive through the mid-foot rather than the toes."</p>
                          </div>
                          <div className="border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                             <div className="flex justify-between items-center">
                               <p className="text-[12px] font-bold text-secondary">Christian's Cue</p>
                               <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                             </div>
                             <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">"Imagine retracting your shoulder blades completely before pulling the weight down."</p>
                          </div>
                          <div className="border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                             <div className="flex justify-between items-center">
                               <p className="text-[12px] font-bold text-secondary">Austin's Cue</p>
                               <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                             </div>
                             <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">"Focus on the eccentric phase; count to three as you release the tension."</p>
                          </div>
                        </div>
                      </div>

                      {/* Common Mistakes & Setup */}
                      <div className="space-y-4">
                        <h4 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-secondary mb-4">
                          <AlertCircle className="w-4 h-4" />
                          Critical Setup Deviations
                        </h4>
                        <div className="bg-muted/30 rounded-2xl p-6 border border-border">
                          <ul className="space-y-4">
                            <li className="space-y-2">
                               <div className="flex justify-between">
                                 <p className="text-[11px] font-bold text-secondary">Seat Too High</p>
                                 <span className="text-[9px] font-bold text-action">High Risk</span>
                               </div>
                               <div className="h-1.5 bg-background rounded-full overflow-hidden">
                                  <div className="h-full bg-action w-[75%]" />
                               </div>
                               <p className="text-[10px] text-muted-foreground">Places extreme stress on the lower back during extension.</p>
                            </li>
                            <li className="space-y-2">
                               <div className="flex justify-between">
                                 <p className="text-[11px] font-bold text-secondary">Incomplete Range of Motion</p>
                                 <span className="text-[9px] font-bold text-amber-500">Medium Risk</span>
                               </div>
                               <div className="h-1.5 bg-background rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-500 w-[45%]" />
                               </div>
                               <p className="text-[10px] text-muted-foreground">Failing to fully lock out or fully stretch at the bottom.</p>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Deep Dive Notes */}
                    <div className="space-y-4">
                        <h4 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-secondary mb-2">
                          <StickyNote className="w-4 h-4" />
                          Deep Dive Notes
                        </h4>
                        <div className="p-4 bg-background border border-border rounded-xl min-h-[100px]">
                           <p className="text-[11px] leading-relaxed text-muted-foreground">
                             {infoMachine.deepDiveNotes || "Enter detailed clinical observations and biomechanical notes here..."}
                           </p>
                        </div>
                    </div>
                    
                    {/* Log Session Action */}
                    <div className="pt-4 border-t border-border flex justify-end">
                       <Button className="bg-action hover:bg-action/90 text-action-foreground font-bold uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl shadow-lg shadow-action/20">
                          <Plus className="w-4 h-4 mr-2" />
                          Log Session / Add Data Points
                       </Button>
                    </div>

                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Clients Dialog */}
      <Dialog open={showNewClientsDialog} onOpenChange={setShowNewClientsDialog}>
        <DialogContent className="max-w-2xl rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-8 bg-primary/5 border-b border-primary/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">New Clients Dashboard</DialogTitle>
                <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-primary/60">Registered in {new Date().toLocaleDateString([], { month: 'long', year: 'numeric' })}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {newClientsThisMonth.length > 0 ? (
              <div className="grid gap-3">
                {newClientsThisMonth.map(client => (
                  <div 
                    key={client.id}
                    onClick={() => {
                      setSelectedClientId(client.id!);
                      setCurrentView('profile');
                      setShowNewClientsDialog(false);
                    }}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-transparent hover:border-primary/20 hover:bg-muted/50 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center font-black text-primary border shadow-sm group-hover:scale-110 transition-transform">
                        {client.firstName[0]}{client.lastName[0]}
                      </div>
                      <div>
                        <p className="font-black uppercase tracking-tight text-sm">{client.firstName} {client.lastName}</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{client.occupation || 'No occupation listed'}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-xs font-black uppercase text-muted-foreground">No new clients registered this month.</p>
              </div>
            )}
          </div>
          <DialogFooter className="p-6 bg-muted/20 border-t">
            <Button onClick={() => setShowNewClientsDialog(false)} className="rounded-xl font-bold uppercase tracking-widest w-full h-12">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trainer Reordering Dialog */}
      <Dialog open={isReorderingTrainers} onOpenChange={setIsReorderingTrainers}>
        <DialogContent className="max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl min-h-[400px]">
          <DialogHeader className="p-8 bg-muted/50 border-b">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <GripVertical className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Team Presence Sorting</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase">Organize how trainers appear in the hub grid.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-3 flex-1 overflow-y-auto">
            {sortedTrainers.map((trainer, idx) => (
              <div 
                key={trainer.id}
                className="flex items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-border/50 group"
              >
                <div className="w-8 h-8 rounded-lg bg-background border flex items-center justify-center font-black text-xs text-muted-foreground">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="font-black uppercase tracking-tighter text-sm">{trainer.fullName}</p>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase italic">{trainer.initials}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={idx === 0}
                    className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary disabled:opacity-20"
                    onClick={async () => {
                      const newSorted = [...sortedTrainers];
                      [newSorted[idx], newSorted[idx - 1]] = [newSorted[idx - 1], newSorted[idx]];
                      for (let i = 0; i < newSorted.length; i++) {
                        if (newSorted[i].id) {
                          await updateDoc(doc(db, 'trainers', newSorted[i].id!), { order: i });
                        }
                      }
                    }}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={idx === sortedTrainers.length - 1}
                    className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary disabled:opacity-20"
                    onClick={async () => {
                      const newSorted = [...sortedTrainers];
                      [newSorted[idx], newSorted[idx + 1]] = [newSorted[idx + 1], newSorted[idx]];
                      for (let i = 0; i < newSorted.length; i++) {
                        if (newSorted[i].id) {
                          await updateDoc(doc(db, 'trainers', newSorted[i].id!), { order: i });
                        }
                      }
                    }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="p-6 border-t bg-muted/20">
            <Button onClick={() => setIsReorderingTrainers(false)} className="rounded-xl font-bold uppercase tracking-widest w-full h-12">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 transition-all duration-300 relative ${active ? 'text-primary scale-105' : 'text-muted-foreground hover:text-foreground'}`}
    >
      <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-primary/10' : 'bg-transparent'}`}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
      {active && (
        <motion.div 
          layoutId="nav-indicator"
          className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full"
        />
      )}
    </button>
  );
}

const DEFAULT_AVAILABILITY: TrainerAvailability = {
  standard: {
    'Monday': { isOpen: true, slots: [{ start: '07:00', end: '12:30' }, { start: '15:00', end: '18:30' }] },
    'Tuesday': { isOpen: true, slots: [{ start: '07:00', end: '12:30' }, { start: '15:00', end: '18:30' }] },
    'Wednesday': { isOpen: true, slots: [{ start: '07:00', end: '12:30' }] },
    'Thursday': { isOpen: true, slots: [{ start: '07:00', end: '12:30' }, { start: '15:00', end: '18:30' }] },
    'Friday': { isOpen: true, slots: [{ start: '07:00', end: '12:30' }] },
    'Saturday': { isOpen: true, slots: [{ start: '07:00', end: '12:30' }] },
    'Sunday': { isOpen: false, slots: [] }
  }
};

function TrainersView({ 
  trainers, 
  isAdding, 
  setIsAdding, 
  schedules, 
  sessions, 
  clients,
  onSelectClient,
  setSelectedSessionId,
  setView 
}: { 
  trainers: Trainer[], 
  isAdding: boolean, 
  setIsAdding: (v: boolean) => void, 
  schedules: any[], 
  sessions: WorkoutSession[], 
  clients: Client[],
  onSelectClient: (id: string) => void,
  setSelectedSessionId: (id: string | null) => void,
  setView: (v: View) => void
}) {
  const [formData, setFormData] = useState({ 
    fullName: '', 
    initials: '', 
    pin: '',
    mindbody_ical_url: '',
    legacy_filemaker_id: ''
  });
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);
  const selectedTrainer = trainers.find(t => t.id === selectedTrainerId);

  const [isEditingAvailability, setIsEditingAvailability] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const securePin = await hashPin(formData.pin);
      await addDoc(collection(db, 'trainers'), {
        ...formData,
        pin: securePin,
        availability: DEFAULT_AVAILABILITY,
        createdAt: serverTimestamp()
      });
      setFormData({ 
        fullName: '', 
        initials: '', 
        pin: '',
        mindbody_ical_url: '',
        legacy_filemaker_id: ''
      });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'trainers');
    }
  };

  const handlePickUpSession = async (session: any, trainer: Trainer) => {
    // Conflict check
    const sessionTime = session.startTime.toDate();
    const hasConflict = schedules.some(s => 
      s.trainerName === trainer.fullName && 
      s.startTime.toDate().getTime() === sessionTime.getTime() &&
      s.id !== session.id
    );

    if (hasConflict) {
      alert(`Conflict detected! You already have a session at ${sessionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on ${sessionTime.toLocaleDateString()}.`);
      return;
    }

    try {
      await updateDoc(doc(db, 'schedules', session.id), {
        trainerId: trainer.id,
        trainerName: trainer.fullName,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `schedules/${session.id}`);
    }
  };

  const unassignedSessions = schedules.filter(s => 
    (!s.trainerName || s.trainerName.toLowerCase().includes('select') || s.trainerName === '') &&
    s.startTime.toDate() > new Date()
  ).sort((a, b) => a.startTime.toDate().getTime() - b.startTime.toDate().getTime());

  return (
    <motion.div 
      key="trainers"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Trainers</h2>
          <p className="text-muted-foreground">Manage your team of professionals.</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} size="lg" className="rounded-full h-14 px-6 shadow-lg">
          {isAdding ? <Plus className="w-6 h-6 rotate-45" /> : <Plus className="w-6 h-6" />}
          <span className="ml-2 font-bold uppercase tracking-wider">Add Trainer</span>
        </Button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-2 border-primary/20 shadow-xl">
              <CardHeader>
                <CardTitle>New Trainer Profile</CardTitle>
                <CardDescription>Create a profile for quick session sign-offs.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-3">
                      <Label htmlFor="fullName" className="text-base font-bold">Full Name</Label>
                      <Input 
                        id="fullName" 
                        placeholder="e.g. John Smith" 
                        value={formData.fullName}
                        onChange={e => setFormData({...formData, fullName: e.target.value})}
                        required
                        className="h-14 text-lg"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="initials" className="text-base font-bold">Initials</Label>
                      <Input 
                        id="initials" 
                        placeholder="JS" 
                        maxLength={4}
                        value={formData.initials}
                        onChange={e => setFormData({...formData, initials: e.target.value.toUpperCase()})}
                        required
                        className="h-14 text-lg uppercase"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="pin" className="text-base font-bold">Security PIN (4-6 digits)</Label>
                    <Input 
                      id="pin" 
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="••••" 
                      value={formData.pin}
                      onChange={e => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})}
                      required
                      className="h-14 text-2xl tracking-[1em] text-center"
                    />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-3">
                      <Label htmlFor="mindbody_url" className="text-base font-bold">MindBody iCal URL</Label>
                      <Input 
                        id="mindbody_url" 
                        placeholder="https://mindbody.com/feed/..." 
                        value={formData.mindbody_ical_url}
                        onChange={e => setFormData({...formData, mindbody_ical_url: e.target.value})}
                        className="h-14 text-sm"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="legacy_id_t" className="text-base font-bold">Legacy FileMaker ID</Label>
                      <Input 
                        id="legacy_id_t" 
                        placeholder="Fm-XXXXX" 
                        value={formData.legacy_filemaker_id}
                        onChange={e => setFormData({...formData, legacy_filemaker_id: e.target.value})}
                        className="h-14 text-sm uppercase"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-4">
                  <Button type="submit" className="flex-1 h-14 text-lg font-bold uppercase tracking-widest bg-action text-action-foreground hover:bg-action/90 shadow-action/20 shadow-lg">Save Trainer</Button>
                  <Button type="button" variant="outline" onClick={() => setIsAdding(false)} className="h-14 px-8">Cancel</Button>
                </CardFooter>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-8">
        {/* Unassigned Sessions Banner */}
        {unassignedSessions.length > 0 && (
          <section className="bg-red-50 dark:bg-red-950/20 border-2 border-red-500/20 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500 rounded-xl">
                <AlertCircle className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-red-600">Action Required: Unassigned Sessions</h3>
                <p className="text-xs font-bold text-red-500/70 uppercase">Clients are scheduled but no trainer is assigned.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {unassignedSessions.slice(0, 6).map(sc => (
                <Card key={sc.id} className="border-red-200 shadow-sm overflow-hidden">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-sm font-black uppercase">{sc.clientName}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          {sc.startTime.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' })} @ {sc.startTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    {trainers.length > 0 && (
                      <div className="flex gap-2">
                        <select 
                          className="flex-1 bg-muted px-3 py-2 rounded-xl text-[10px] font-black uppercase outline-none"
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              const trainer = trainers.find(t => t.id === val);
                              if (trainer) handlePickUpSession(sc, trainer);
                            }
                          }}
                        >
                          <option value="">Assign Trainer...</option>
                          {trainers.map(t => (
                            <option key={t.id} value={t.id}>{t.fullName}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trainers.map((trainer) => {
            // Calculate stats for this trainer
            const trainerSessions = sessions.filter(s => s.trainerInitials === trainer.initials);
            const uniqueClients = new Set(trainerSessions.map(s => s.clientId)).size;
            
            // Find most trained client
            const clientCounts: Record<string, number> = {};
            trainerSessions.forEach(s => {
              clientCounts[s.clientId] = (clientCounts[s.clientId] || 0) + 1;
            });
            const mostTrainedClientId = Object.entries(clientCounts).sort(([,a], [,b]) => b - a)[0]?.[0];
            const mostTrainedClient = clients.find(c => c.id === mostTrainedClientId);
            
            // Get sessions relative to now
            const now = new Date();
            const upcomingSchedule = schedules.filter(s => {
              const sDate = s.startTime.toDate();
              return (s.trainerId === trainer.id || s.trainerName.toLowerCase().includes(trainer.fullName.toLowerCase())) && 
                     sDate >= now && s.status !== 'Cancelled';
            }).sort((a, b) => a.startTime.toDate().getTime() - b.startTime.toDate().getTime());

            const isSelected = selectedTrainerId === trainer.id;

            return (
              <motion.div key={trainer.id} layout>
                <Card 
                  className={`group hover:border-primary/50 transition-all cursor-pointer overflow-hidden ${isSelected ? 'border-primary ring-2 ring-primary/10' : ''}`}
                  onClick={() => setSelectedTrainerId(isSelected ? null : trainer.id!)}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary text-xl">
                      {trainer.initials}
                    </div>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {upcomingSchedule.length} UPCOMING SESSIONS
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="text-xl font-bold truncate uppercase italic tracking-tighter">{trainer.fullName}</h3>
                      <div className="flex gap-4 mt-2">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-black text-muted-foreground uppercase">Total Sessions</p>
                          <p className="text-sm font-black">{trainerSessions.length}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-black text-muted-foreground uppercase">Unique Clients</p>
                          <p className="text-sm font-black">{uniqueClients}</p>
                        </div>
                        {mostTrainedClient && (
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Top Client</p>
                            <p className="text-sm font-black truncate max-w-[80px]">{mostTrainedClient.firstName}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="pt-4 border-t space-y-4"
                        >
                          <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                              <Calendar className="w-3 h-3" /> Upcoming Schedule
                            </p>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                              {upcomingSchedule.length > 0 ? (
                                upcomingSchedule.slice(0, 10).map((s, i) => (
                                  <div key={i} className="bg-primary/5 p-2.5 rounded-xl border border-primary/20 flex items-center justify-between group/session">
                                    <div className="min-w-0">
                                      <p className="text-xs font-black uppercase truncate">{s.clientName}</p>
                                      <p className="text-[9px] text-muted-foreground font-bold">
                                        {s.startTime.toDate().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[10px] font-black">
                                        {s.startTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-[10px] text-muted-foreground italic font-medium">No upcoming sessions scheduled</p>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                              <History className="w-3 h-3" /> Recent Activity
                            </p>
                            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                              {trainerSessions.length > 0 ? (
                                trainerSessions
                                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                  .slice(0, 5)
                                  .map((s, i) => {
                                    const client = clients.find(c => c.id === s.clientId);
                                    return (
                                      <div 
                                        key={i} 
                                        className="bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/10 flex items-center justify-between cursor-pointer hover:bg-emerald-500/10 transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (s.clientId) {
                                            onSelectClient(s.clientId);
                                            setSelectedSessionId(s.id || null);
                                            setView('history');
                                          }
                                        }}
                                      >
                                        <div className="min-w-0">
                                          <p className="text-xs font-black uppercase truncate">{client ? `${client.firstName} ${client.lastName}` : 'Unknown Client'}</p>
                                          <p className="text-[9px] text-muted-foreground font-bold">
                                            {new Date(s.date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[8px] h-4 py-0 uppercase">DONE</Badge>
                                        </div>
                                      </div>
                                    );
                                  })
                              ) : (
                                <p className="text-[10px] text-muted-foreground italic font-medium">No recent sessions recorded</p>
                              )}
                            </div>
                          </div>

                          <div className="pt-4 border-t">
                            <Button 
                              variant="outline" 
                              className="w-full h-11 rounded-xl text-[10px] font-black uppercase italic tracking-widest border-2 hover:bg-primary/5 hover:text-primary transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsEditingAvailability(true);
                              }}
                            >
                              Manage Availability
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                  <div className={`h-1 w-full transition-colors ${isSelected ? 'bg-primary' : 'bg-primary/5 group-hover:bg-primary'}`} />
                </Card>
              </motion.div>
            );
          })}
          {trainers.length === 0 && !isAdding && (
            <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl bg-muted/20 opacity-40">
              <UserCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">No trainers registered</p>
            </div>
          )}
        </div>
      </div>
      {isEditingAvailability && selectedTrainer && (
        <AvailabilityEditor 
          trainer={selectedTrainer} 
          onClose={() => setIsEditingAvailability(false)} 
        />
      )}
    </motion.div>
  );
}

function AvailabilityEditor({ trainer, onClose }: { trainer: Trainer, onClose: () => void }) {
  const [availability, setAvailability] = useState<TrainerAvailability>(trainer.availability || DEFAULT_AVAILABILITY);
  const [activeTab, setActiveTab] = useState<'standard' | 'overrides'>('standard');
  const [newOverrideDate, setNewOverrideDate] = useState('');

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleSave = async () => {
    try {
      await updateDoc(doc(db, 'trainers', trainer.id!), {
        availability,
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trainers/${trainer.id}`);
    }
  };

  const updateStandardDay = (day: string, updates: any) => {
    setAvailability({
      ...availability,
      standard: {
        ...availability.standard,
        [day]: { ...availability.standard[day], ...updates }
      }
    });
  };

  const addOverride = () => {
    if (!newOverrideDate) return;
    setAvailability({
      ...availability,
      overrides: {
        ...(availability.overrides || {}),
        [newOverrideDate]: { isOpen: true, slots: [{ start: '07:00', end: '12:30' }] }
      }
    });
    setNewOverrideDate('');
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-black uppercase italic">Availability: {trainer.fullName}</DialogTitle>
          <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">Configure working hours and specific date overrides.</DialogDescription>
        </DialogHeader>

        <div className="px-6 flex gap-2 border-b">
          <button 
            onClick={() => setActiveTab('standard')}
            className={`pb-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'standard' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >
            Weekly Standard
          </button>
          <button 
            onClick={() => setActiveTab('overrides')}
            className={`pb-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'overrides' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >
            Date Overrides
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'standard' ? (
            <div className="space-y-4">
              {days.map(day => {
                const config = (availability.standard[day] || { isOpen: false, slots: [] }) as { isOpen: boolean; slots: { start: string; end: string }[] };
                return (
                  <div key={day} className="p-4 rounded-2xl bg-muted/30 border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black uppercase italic tracking-tight">{day}</span>
                      <Switch 
                        checked={config.isOpen}
                        onCheckedChange={(val) => updateStandardDay(day, { isOpen: val })}
                      />
                    </div>
                    {config.isOpen && (
                      <div className="space-y-2">
                        {config.slots.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Input 
                              type="time" 
                              value={slot.start} 
                              className="h-9 text-xs font-bold"
                              onChange={(e) => {
                                const newSlots = [...config.slots];
                                newSlots[idx].start = e.target.value;
                                updateStandardDay(day, { slots: newSlots });
                              }}
                            />
                            <span className="text-xs font-bold">to</span>
                            <Input 
                              type="time" 
                              value={slot.end} 
                              className="h-9 text-xs font-bold"
                              onChange={(e) => {
                                const newSlots = [...config.slots];
                                newSlots[idx].end = e.target.value;
                                updateStandardDay(day, { slots: newSlots });
                              }}
                            />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                const newSlots = config.slots.filter((_, i) => i !== idx);
                                updateStandardDay(day, { slots: newSlots });
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full text-[10px] font-black uppercase"
                          onClick={() => {
                            updateStandardDay(day, { 
                              slots: [...config.slots, { start: '07:00', end: '12:30' }] 
                            });
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add Slot
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  type="date" 
                  value={newOverrideDate} 
                  onChange={(e) => setNewOverrideDate(e.target.value)}
                  className="rounded-xl font-bold"
                />
                <Button variant="outline" className="rounded-xl uppercase font-black text-xs" onClick={addOverride}>Add</Button>
              </div>
              
              <div className="space-y-3">
                {Object.entries(availability.overrides || {}).sort().map(([date, rawConfig]) => {
                  const config = rawConfig as { isOpen: boolean; slots: { start: string; end: string }[] };
                  return (
                    <div key={date} className="p-4 bg-primary/5 border border-primary/10 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black uppercase italic">{new Date(date + 'T00:00:00').toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            const newOverrides = { ...availability.overrides };
                            delete newOverrides[date];
                            setAvailability({ ...availability, overrides: newOverrides });
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase opacity-60">Status</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase">{config.isOpen ? 'Open' : 'Closed'}</span>
                          <Switch 
                            checked={config.isOpen}
                            onCheckedChange={(val) => {
                              const newOverrides = { ...availability.overrides };
                              newOverrides[date] = { ...config, isOpen: val };
                              setAvailability({
                                ...availability,
                                overrides: newOverrides
                              });
                            }}
                          />
                        </div>
                      </div>
                      {config.isOpen && (
                        <div className="space-y-2">
                          {config.slots.map((slot, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input 
                                  type="time" 
                                  value={slot.start} 
                                  className="h-8 text-[10px] font-bold" 
                                  onChange={(e) => {
                                      const newOverrides = { ...availability.overrides };
                                      newOverrides[date].slots[idx].start = e.target.value;
                                      setAvailability({ ...availability, overrides: newOverrides });
                                  }}
                              />
                              <Input 
                                  type="time" 
                                  value={slot.end} 
                                  className="h-8 text-[10px] font-bold" 
                                  onChange={(e) => {
                                      const newOverrides = { ...availability.overrides };
                                      newOverrides[date].slots[idx].end = e.target.value;
                                      setAvailability({ ...availability, overrides: newOverrides });
                                  }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-muted/50">
          <Button variant="outline" onClick={onClose} className="rounded-xl uppercase font-black text-xs">Discard</Button>
          <Button onClick={handleSave} className="rounded-xl uppercase font-black text-xs bg-action text-action-foreground hover:bg-action/90 shadow-action/20 shadow-lg">Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientsView({ 
  clients, 
  trainers,
  sortedTrainers,
  isAdmin,
  isAdding, 
  setIsAdding, 
  onSelectClient, 
  setView, 
  schedules, 
  sessions,
  editingClient,
  setEditingClient,
  formData,
  setFormData,
  onSubmit,
  startEdit,
  updateSessions,
  setSelectedSessionId
}: { 
  clients: Client[], 
  trainers: Trainer[],
  sortedTrainers: Trainer[],
  isAdmin: boolean,
  isAdding: boolean, 
  setIsAdding: (v: boolean) => void, 
  onSelectClient: (id: string) => void, 
  setView: (v: View) => void, 
  schedules: any[], 
  sessions: WorkoutSession[],
  editingClient: Client | null,
  setEditingClient: (c: Client | null) => void,
  formData: any,
  setFormData: (f: any) => void,
  onSubmit: (e: React.FormEvent) => void,
  startEdit: (c: Client) => void,
  updateSessions: (id: string, current: number, delta: number) => void,
  setSelectedSessionId: (id: string | null) => void
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [trainerFilter, setTrainerFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'morning' | 'afternoon'>('morning');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [linkingSession, setLinkingSession] = useState<any | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [searchTermLink, setSearchTermLink] = useState('');

  const filteredClients = clients.filter(c => 
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const now = new Date();
  
  // Get sessions for selected day
  const dateStart = new Date(selectedDate);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(selectedDate);
  dateEnd.setHours(23, 59, 59, 999);

  const todaysSchedules = schedules
    .filter(s => {
      const date = s.startTime.toDate();
      return date >= dateStart && date <= dateEnd && s.status !== 'Cancelled';
    })
    .sort((a, b) => a.startTime.toDate().getTime() - b.startTime.toDate().getTime());

  // Generate 6 days starting from today or Monday (skipping Sundays)
  const getUpcomingDays = () => {
    const days = [];
    let temp = new Date();
    // Start from today, but if today is Sunday, start tomorrow
    if (temp.getDay() === 0) temp.setDate(temp.getDate() + 1);
    
    let count = 0;
    let curr = new Date(temp);
    while (count < 6) {
      if (curr.getDay() !== 0) {
        days.push(new Date(curr));
        count++;
      }
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  };
  const weekDays = getUpcomingDays();

  // Helper for time slots
  const generateSlots = (startHour: number, endHour: number) => {
    const slots = [];
    for (let h = startHour; h <= endHour; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
      if (h !== endHour) {
        slots.push(`${h.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  };

  const AM_SLOTS = [...generateSlots(7, 12), '12:30'];
  const PM_SLOTS = [...generateSlots(15, 18), '18:30'];

  const currentSlots = activeTab === 'morning' ? AM_SLOTS : PM_SLOTS;

  // Active trainers for column display - only those with sessions or all if we want comparison

  const allTrainerNames = sortedTrainers.map(t => t.fullName);

  // Find if a slot has any sessions for any trainer
  const getSlotSessions = (slot: string) => {
    return todaysSchedules.filter(s => {
      const date = s.startTime.toDate();
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}` === slot;
    });
  };

  const findClientForSession = (session: any) => {
    if (!session) return null;
    return clients.find(c => 
      c.id === session.clientId || 
      c.mindbody_name?.toLowerCase() === session.clientName.toLowerCase() ||
      `${c.firstName} ${c.lastName}`.toLowerCase() === session.clientName.toLowerCase()
    );
  };

  const hasUnassignedAnywhereInGrid = todaysSchedules.some(s => 
    !s.trainerName || 
    s.trainerName.toLowerCase().includes('select') || 
    s.trainerName === ''
  ) || sessions.some(s => s.status === 'In-Progress' && (s as any).isUnassigned); // check for active unassigned sessions

  // Recent clients (edited or created)
  const recentClients = [...clients]
    .sort((a, b) => {
      const timeA = (a as any).updatedAt?.toDate()?.getTime() || a.createdAt?.toDate()?.getTime() || 0;
      const timeB = (b as any).updatedAt?.toDate()?.getTime() || b.createdAt?.toDate()?.getTime() || 0;
      return timeB - timeA;
    })
    .slice(0, 5);

  const getClientSessions = (client: Client) => {
    const clientName = `${client.firstName} ${client.lastName}`;
    const next = schedules
      .filter(s => (s.clientId === client.id || s.clientName.toLowerCase() === clientName.toLowerCase()) && s.startTime.toDate() > now && s.status !== 'Cancelled')
      .sort((a, b) => a.startTime.toDate().getTime() - b.startTime.toDate().getTime())[0];
    const last = sessions
      .filter(s => s.clientId === client.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    return { next, last };
  };

  return (
    <motion.div 
      key="clients"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col gap-6 sticky top-0 bg-background/95 backdrop-blur-md pt-2 pb-4 z-30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight uppercase text-secondary">Dashboard</h2>
            <p className="text-xs text-secondary/80 font-medium uppercase tracking-widest">Active Session Management</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Search clients..." 
              className="pl-12 h-14 rounded-2xl bg-muted/50 border-none font-bold text-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            onClick={() => setIsAdding(!isAdding)} 
            size="lg" 
            className="rounded-xl h-14 px-8 shadow-md bg-primary text-primary-foreground font-bold w-full sm:w-auto"
          >
            {isAdding ? <Plus className="w-5 h-5 rotate-45 mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
            ADD NEW CLIENT
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {/* Registration form remains same as before but wrapped for consistency */}
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-8"
          >
            <Card className="border-2 border-primary/20 shadow-2xl rounded-3xl overflow-hidden">
              <CardHeader>
                <CardTitle>{editingClient ? 'Edit Client Profile' : 'New Client Registration'}</CardTitle>
                <CardDescription>
                  {editingClient ? `Updating information for ${editingClient.firstName}` : 'Set up a new client profile for tracking.'}
                </CardDescription>
              </CardHeader>
              <form onSubmit={onSubmit}>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-3">
                      <Label htmlFor="firstName" className="text-base font-bold">First Name</Label>
                      <Input 
                        id="firstName" 
                        placeholder="First Name" 
                        value={formData.firstName}
                        onChange={e => setFormData({...formData, firstName: e.target.value})}
                        required
                        className="h-14 text-lg"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="lastName" className="text-base font-bold">Last Name</Label>
                      <Input 
                        id="lastName" 
                        placeholder="Last Name" 
                        value={formData.lastName}
                        onChange={e => setFormData({...formData, lastName: e.target.value})}
                        required
                        className="h-14 text-lg"
                      />
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-3">
                      <Label htmlFor="gender" className="text-base font-bold">Gender</Label>
                      <div className="flex gap-2">
                        {['Male', 'Female', 'Other'].map((g) => (
                          <Button
                            key={g}
                            type="button"
                            variant={formData.gender === g ? 'default' : 'outline'}
                            className="flex-1 h-12 font-bold"
                            onClick={() => setFormData({...formData, gender: g as any})}
                          >
                            {g}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-base font-bold">Height</Label>
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <Input 
                            id="heightFeet" 
                            type="number"
                            placeholder="Ft" 
                            value={formData.heightFeet}
                            onChange={e => setFormData({...formData, heightFeet: e.target.value})}
                            required
                            className="h-14 text-lg pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">ft</span>
                        </div>
                        <div className="relative flex-1">
                          <Input 
                            id="heightInches" 
                            type="number"
                            placeholder="In" 
                            value={formData.heightInches}
                            onChange={e => setFormData({...formData, heightInches: e.target.value})}
                            required
                            className="h-14 text-lg pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">in</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="weight" className="text-base font-bold">Weight (lbs)</Label>
                      <Input 
                        id="weight" 
                        type="number"
                        placeholder="e.g. 185" 
                        value={formData.weight}
                        onChange={e => setFormData({...formData, weight: e.target.value})}
                        className="h-14 text-lg"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="age" className="text-base font-bold">Age</Label>
                      <Input 
                        id="age" 
                        type="number"
                        placeholder="Years" 
                        value={formData.age}
                        onChange={e => setFormData({...formData, age: e.target.value})}
                        className="h-14 text-lg"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="occupation" className="text-base font-bold">Occupation</Label>
                      <Input 
                        id="occupation" 
                        placeholder="e.g. Software Engineer" 
                        value={formData.occupation}
                        onChange={e => setFormData({...formData, occupation: e.target.value})}
                        className="h-14 text-lg"
                      />
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-3">
                      <Label htmlFor="phone" className="text-base font-bold">Phone Number</Label>
                      <Input 
                        id="phone" 
                        placeholder="(555) 000-0000" 
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        className="h-14 text-lg"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="email" className="text-base font-bold">Email Address</Label>
                      <Input 
                        id="email" 
                        type="email"
                        placeholder="client@example.com" 
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="h-14 text-lg"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="address" className="text-base font-bold">Address</Label>
                    <Input 
                      id="address" 
                      placeholder="123 Main St, City, State, Zip" 
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                      className="h-14 text-lg"
                    />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-3">
                      <Label htmlFor="emergencyName" className="text-base font-bold">Emergency Contact Name</Label>
                      <Input 
                        id="emergencyName" 
                        placeholder="Full Name" 
                        value={formData.emergencyContactName}
                        onChange={e => setFormData({...formData, emergencyContactName: e.target.value})}
                        className="h-14 text-lg"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="emergencyPhone" className="text-base font-bold">Emergency Contact Phone</Label>
                      <Input 
                        id="emergencyPhone" 
                        placeholder="(555) 000-0000" 
                        value={formData.emergencyContactPhone}
                        onChange={e => setFormData({...formData, emergencyContactPhone: e.target.value})}
                        className="h-14 text-lg"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="legacy_id_c" className="text-base font-bold text-amber-600">Legacy FileMaker ID</Label>
                    <Input 
                      id="legacy_id_c" 
                      placeholder="Fm-XXXXX" 
                      value={formData.legacy_filemaker_id}
                      onChange={e => setFormData({...formData, legacy_filemaker_id: e.target.value})}
                      className="h-14 text-lg border-amber-500/30 bg-amber-500/5 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted rounded-2xl">
                    <div className="space-y-0.5">
                      <Label className="text-base font-bold">Active Status</Label>
                      <p className="text-sm text-muted-foreground">Is this client currently training?</p>
                    </div>
                    <Switch 
                      checked={formData.isActive}
                      onCheckedChange={v => setFormData({...formData, isActive: v})}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="medicalHistory" className="text-base font-bold">Medical History / Injuries</Label>
                    <Textarea 
                      id="medicalHistory" 
                      placeholder="List any medical history, injuries, or contraindications..." 
                      value={formData.medicalHistory}
                      onChange={e => setFormData({...formData, medicalHistory: e.target.value})}
                      className="min-h-[100px] text-lg p-4"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="notes" className="text-base font-bold">Session Preferences / Notes</Label>
                    <Textarea 
                      id="notes" 
                      placeholder="Trainer notes about preferences, motivations, etc." 
                      value={formData.globalNotes}
                      onChange={e => setFormData({...formData, globalNotes: e.target.value})}
                      className="min-h-[100px] text-lg p-4"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex gap-4">
                  <Button type="submit" className="flex-1 h-14 text-lg font-bold uppercase tracking-widest">
                    {editingClient ? 'Update Profile' : 'Register Client'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => {
                    setIsAdding(false);
                    setEditingClient(null);
                  }} className="h-14 px-8">Cancel</Button>
                </CardFooter>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-8">
        {!searchTerm ? (
          <>
            {/* Daily Hub Schedule Section */}
            <section className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold uppercase tracking-tight text-secondary">Daily Operations Hub</h3>
                    <p className="text-[10px] font-medium text-secondary/80 uppercase tracking-widest leading-none">Team Schedule & Availability</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {/* Day Selector */}
                  <div className="flex p-1 bg-muted rounded-2xl border border-border/50">
                    {weekDays.map((date) => {
                      const isSelected = date.toDateString() === selectedDate.toDateString();
                      const isToday = date.toDateString() === new Date().toDateString();
                      return (
                        <button
                          key={date.toISOString()}
                          onClick={() => setSelectedDate(date)}
                          className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            isSelected ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:bg-background/20'
                          }`}
                        >
                          <span className="flex flex-col items-center">
                            {date.toLocaleDateString([], { weekday: 'short' })}
                            <span className={`text-[7px] ${isSelected ? 'text-primary/70' : 'opacity-40'}`}>
                              {isToday ? 'Today' : date.toLocaleDateString([], { day: 'numeric' })}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* AM/PM Shift Selector */}
                  <div className="flex p-1 bg-muted rounded-xl border border-border/50">
                    <button 
                      onClick={() => setActiveTab('morning')}
                      className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'morning' ? 'bg-primary shadow-sm text-primary-foreground' : 'text-secondary hover:bg-background/50'}`}
                    >
                      AM
                    </button>
                    <button 
                      onClick={() => setActiveTab('afternoon')}
                      className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'afternoon' ? 'bg-primary shadow-sm text-primary-foreground' : 'text-secondary hover:bg-background/50'}`}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>

              {/* Team Comparison Grid */}
              <div className="bg-card border-2 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed min-w-[600px]">
                    <thead>
                      <tr className="bg-muted/30 border-b">
                        <th className="p-1.5 pl-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground w-16">Time</th>
                        {hasUnassignedAnywhereInGrid && (
                          <th className="p-1.5 text-[9px] font-black uppercase tracking-widest text-center w-36 border-l border-red-500/10 bg-red-500/5 text-red-600">
                            Unassigned
                          </th>
                        )}
                        {allTrainerNames.map(name => (
                          <th key={name} className="p-1.5 text-[9px] font-black uppercase tracking-widest text-center w-36 border-l border-border/10">
                            {name.split(' ')[0]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {currentSlots.map((slot) => {
                        const slotSessions = getSlotSessions(slot);
                        const isNow = slot === now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                        
                        const unassigned = slotSessions.filter(s => 
                          !s.trainerName || 
                          s.trainerName.toLowerCase().includes('select') || 
                          s.trainerName === ''
                        );

                        return (
                          <tr key={slot} className={`group ${isNow ? 'bg-primary/5' : ''}`}>
                            <td className="p-1.5 pl-4 border-r border-border/10">
                              <span className={`text-[10px] font-black italic tracking-tighter ${isNow ? 'text-primary animate-pulse' : 'text-muted-foreground'}`}>
                                {slot}
                              </span>
                            </td>
                            
                            {hasUnassignedAnywhereInGrid && (
                              <td className="p-1 border-l border-red-500/5 bg-red-500/[0.01]">
                                <div className="space-y-0.5">
                                  {unassigned.map(session => {
                                    const client = findClientForSession(session);
                                    return (
                                      <motion.div
                                        key={session.id}
                                        whileHover={{ scale: 1.01 }}
                                        onClick={() => {
                                          if (client) {
                                            onSelectClient(client.id!);
                                            setView('profile');
                                          } else {
                                            setLinkingSession(session);
                                            setIsLinking(true);
                                          }
                                        }}
                                        className={`p-1 rounded-lg border flex flex-col justify-center cursor-pointer transition-all ${
                                          client ? 'bg-red-500/5 border-red-500/20' : 'bg-red-500/10 border-red-500/40 shadow-sm'
                                        }`}
                                      >
                                        <p className="text-[10px] font-semibold text-secondary truncate leading-tight">{session.clientName}</p>
                                        {!client && <p className="text-[7px] font-bold text-red-600 uppercase">UNLINKED</p>}
                                      </motion.div>
                                    );
                                  })}
                                  {unassigned.length === 0 && <div className="h-4" />}
                                </div>
                              </td>
                            )}

                            {allTrainerNames.map(trainerName => {
                              const session = slotSessions.find(s => 
                                s.trainerName === trainerName && 
                                s.trainerName && 
                                !s.trainerName.toLowerCase().includes('select')
                              );
                              const isCompleted = session?.status === 'Completed' || (session && session.startTime.toDate() < now);
                              const isConsultation = session?.serviceName?.toLowerCase().includes('consult') || session?.serviceName?.toLowerCase().includes('first');
                              const client = findClientForSession(session);

                              return (
                                <td key={trainerName} className="p-1 border-l border-border/5">
                                  {session ? (
                                    <motion.div
                                      whileHover={{ y: -0.5 }}
                                      onClick={() => {
                                        if (client) {
                                          onSelectClient(client.id!);
                                          setView('profile');
                                        } else {
                                          setLinkingSession(session);
                                          setIsLinking(true);
                                        }
                                      }}
                                      className={`p-1 px-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-center min-h-[32px] ${
                                        isCompleted 
                                          ? 'bg-muted/20 border-transparent grayscale opacity-40' 
                                          : isConsultation
                                            ? 'bg-amber-500/20 border-amber-500/40'
                                            : client 
                                              ? 'bg-primary/5 border-primary/10 hover:border-primary/30'
                                              : 'bg-amber-100/50 border-amber-400/50 shadow-sm animate-pulse'
                                      }`}
                                    >
                                      <div className="flex justify-between items-center gap-1">
                                        <span className={`text-[10px] font-semibold truncate leading-tight ${!client ? 'text-amber-700' : 'text-secondary'}`}>
                                          {session.clientName}
                                        </span>
                                        {!client && <AlertCircle className="w-2.5 h-2.5 text-amber-600 shrink-0" />}
                                        {isConsultation && client && <Sparkles className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                                      </div>
                                      {!client && <p className="text-[6px] font-black text-amber-600 uppercase tracking-widest leading-none">Not Profiled</p>}
                                    </motion.div>
                                  ) : (
                                    <div className="h-6 rounded-lg opacity-10 group-hover:opacity-20 transition-opacity" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Recent Clients Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <h3 className="text-lg font-bold uppercase tracking-tight text-secondary">Recently Profiled</h3>
              </div>
              <div className="grid gap-2">
                {recentClients.map(client => (
                  <div 
                    key={client.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-muted/10 border border-transparent hover:border-muted-foreground/20 hover:bg-muted/20 cursor-pointer transition-all group"
                    onClick={() => {
                      onSelectClient(client.id!);
                      setView('profile');
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-black text-[10px] text-muted-foreground">
                        {client.firstName[0]}{client.lastName[0]}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{client.firstName} {client.lastName}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          /* Search Results Section */
          <div className="grid gap-4">
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold uppercase tracking-tight text-secondary">Search Results ({filteredClients.length})</h3>
            </div>
            {filteredClients.map((client) => {
              const { next, last } = getClientSessions(client);
              const clientName = `${client.firstName} ${client.lastName}`;
              
              return (
                <motion.div key={client.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="group hover:border-primary/50 transition-all cursor-pointer overflow-hidden rounded-3xl">
                    <CardContent className="p-0">
                      <div className="flex flex-col lg:flex-row p-6 gap-6">
                        <div 
                          className="flex flex-col gap-2 cursor-pointer grow min-w-[200px]" 
                          onClick={() => {
                            onSelectClient(client.id!);
                            setView('profile');
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <h3 className="text-2xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">{clientName}</h3>
                            {client.isActive ? (
                              <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-none font-black text-[9px] uppercase">Active</Badge>
                            ) : (
                              <Badge variant="secondary" className="font-black text-[9px] uppercase">Inactive</Badge>
                            )}
                          </div>
                          <div className="flex gap-4 text-[10px] font-bold text-muted-foreground uppercase">
                            <span>{client.height}</span>
                            <span>•</span>
                            <span>{client.weight || '--'} LBS</span>
                            <span>•</span>
                            <span className="text-primary">{client.remainingSessions} SESSIONS</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 grow-[2]">
                          {/* Last Session Info */}
                          <div className="bg-muted/30 p-4 rounded-2xl border border-border/50 flex flex-col justify-between">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Previous Session</p>
                            {last ? (
                              <div className="space-y-1">
                                <p className="text-sm font-black">{new Date(last.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase italic">TR: {last.trainerInitials}</p>
                              </div>
                            ) : (
                              <p className="text-xs font-bold text-muted-foreground/30 uppercase italic">No history</p>
                            )}
                          </div>

                          {/* Next Session Info */}
                          <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex flex-col justify-between">
                            <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Next Scheduled</p>
                            {next ? (
                              <div className="space-y-1">
                                <p className="text-sm font-black text-primary">
                                  {next.startTime.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' })} @ {next.startTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <p className="text-[10px] font-black text-primary/70 uppercase italic">TR: {next.trainerName}</p>
                              </div>
                            ) : (
                              <p className="text-xs font-bold text-muted-foreground/30 uppercase italic">Not scheduled</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button 
                            variant="outline"
                            className="h-20 w-20 rounded-2xl font-black flex flex-col gap-1 border-2 shadow-sm uppercase group-hover:border-primary/20"
                            onClick={() => {
                              setSelectedSessionId(null);
                              onSelectClient(client.id!);
                              setView('history');
                            }}
                          >
                            <History className="w-6 h-6" />
                            <span className="text-[9px]">History</span>
                          </Button>
                          <Button 
                            className="h-20 w-20 rounded-2xl font-black flex flex-col gap-1 shadow-lg shadow-primary/20 uppercase"
                            onClick={() => {
                              onSelectClient(client.id!);
                              setView('workouts');
                            }}
                          >
                            <Play className="w-6 h-6 fill-current" />
                            <span className="text-[9px]">Start</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
            {filteredClients.length === 0 && (
              <div className="py-20 text-center border-2 border-dashed rounded-3xl bg-muted/10 opacity-50">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-xs font-black uppercase">No client matches "{searchTerm}"</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Link Client Dialog */}
      <Dialog open={isLinking} onOpenChange={setIsLinking}>
        <DialogContent className="rounded-[32px] border-2 max-w-md bg-background shadow-2xl">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-amber-500" />
            </div>
            <DialogTitle className="text-xl font-black">Link Schedule Profile</DialogTitle>
            <DialogDescription className="font-medium">
              The external schedule found "{linkingSession?.clientName}", but no matching profile exists in the app.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Recommended</Label>
              <Button 
                className="w-full h-14 rounded-2xl font-black justify-between px-6 bg-primary/10 text-primary hover:bg-primary/20 border-none"
                onClick={() => {
                  const names = (linkingSession?.clientName || '').split(' ');
                  setFormData({
                    ...formData,
                    firstName: names[0] || '',
                    lastName: names.slice(1).join(' ') || '',
                    mindbody_name: linkingSession?.clientName || ''
                  });
                  setIsAdding(true);
                  setIsLinking(false);
                }}
              >
                Create Hub Profile for "{linkingSession?.clientName}"
                <Plus className="w-5 h-5" />
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground font-bold">Or Link to Existing</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search existing clients..." 
                  className="pl-10 h-12 rounded-xl border-2"
                  value={searchTermLink}
                  onChange={(e) => setSearchTermLink(e.target.value)}
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                {clients
                  .filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTermLink.toLowerCase()))
                  .slice(0, 10)
                  .map(client => (
                    <Button
                      key={client.id}
                      variant="ghost"
                      className="w-full h-10 rounded-lg justify-start font-bold text-xs hover:bg-primary/5 hover:text-primary transition-all border border-transparent hover:border-primary/10"
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'clients', client.id!), {
                            mindbody_name: linkingSession.clientName
                          });
                          setIsLinking(false);
                          setSearchTermLink('');
                        } catch (err) {
                          console.error("Link failed:", err);
                        }
                      }}
                    >
                      {client.firstName} {client.lastName}
                    </Button>
                  ))}
                {clients.length > 0 && clients.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTermLink.toLowerCase())).length === 0 && (
                  <p className="text-[10px] text-center py-4 text-muted-foreground italic font-medium">No clients match your search</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function ClientHistoryView({ 
  clientId, 
  clients, 
  machines, 
  trainers,
  setView,
  selectedSessionId 
}: { 
  clientId: string | null, 
  clients: Client[], 
  machines: Machine[], 
  trainers: Trainer[],
  setView: (v: View) => void,
  selectedSessionId?: string | null
}) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [logs, setLogs] = useState<Record<string, ExerciseLog>>({});
  const [sessionNotes, setSessionNotes] = useState<Record<string, SessionNote[]>>({});
  const [activeNotesSession, setActiveNotesSession] = useState<WorkoutSession | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const client = clients.find(c => c.id === clientId);
  const [trainerStats, setTrainerStats] = useState<Record<string, number>>({});
  const [trainerFilter, setTrainerFilter] = useState<string | null>(null);

  const [historyLimit, setHistoryLimit] = useState(12);

  useEffect(() => {
    if (!clientId) return;

    // Fetch Routines for filtering
    const routinesQuery = query(collection(db, 'routines'), where('clientId', '==', clientId));
    const unsubscribeRoutines = onSnapshot(routinesQuery, (snapshot) => {
      setRoutines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Routine)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'routines');
    });

    const sessionsQuery = query(
      collection(db, 'sessions'),
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc'),
      limit(historyLimit)
    );

    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutSession));
      
      // Calculate trainer stats
      const stats: Record<string, number> = {};
      sessionsData.forEach(s => {
        stats[s.trainerInitials] = (stats[s.trainerInitials] || 0) + 1;
      });
      setTrainerStats(stats);
      
      // Show more sessions for the grid view (12 by default if possible)
      let displayData = sessionsData;
      if (selectedSessionId) {
        const targetIndex = sessionsData.findIndex(s => s.id === selectedSessionId);
        if (targetIndex !== -1) {
          let start = Math.max(0, targetIndex - 5);
          let end = Math.min(sessionsData.length, start + 12);
          if (end - start < 12) start = Math.max(0, end - 12);
          displayData = sessionsData.slice(start, end);
        } else {
          displayData = sessionsData.slice(0, 12);
        }
      } else {
        displayData = sessionsData.slice(0, 12);
      }
      
      setSessions(displayData.reverse());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sessions');
    });

    // Fetch Session Notes for client
    const notesQuery = query(
      collection(db, 'sessionNotes'),
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeNotes = onSnapshot(notesQuery, (snapshot) => {
      const notesMap: Record<string, SessionNote[]> = {};
      snapshot.docs.forEach(doc => {
        const note = { id: doc.id, ...doc.data() } as SessionNote;
        if (!notesMap[note.sessionId]) notesMap[note.sessionId] = [];
        notesMap[note.sessionId].push(note);
      });
      setSessionNotes(notesMap);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sessionNotes');
    });

    return () => {
      unsubscribeSessions();
      unsubscribeNotes();
      unsubscribeRoutines();
    };
  }, [clientId, selectedSessionId]);

  useEffect(() => {
    if (sessions.length === 0) return;

    const sessionIds = sessions.map(s => s.id).filter(Boolean) as string[];
    const logsQuery = query(
      collection(db, 'exerciseLogs'),
      where('sessionId', 'in', sessionIds)
    );

    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const logsData: Record<string, ExerciseLog> = {};
      snapshot.docs.forEach(doc => {
        const log = { id: doc.id, ...doc.data() } as ExerciseLog;
        logsData[`${log.sessionId}_${log.machineId}`] = log;
      });
      setLogs(prev => ({ ...prev, ...logsData }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'exerciseLogs');
    });

    return () => unsubscribeLogs();
  }, [sessions]);

  const updateSessionNote = async (sessionId: string, currentNote: string) => {
    // Deprecated in favor of SessionNotesDetailDialog
  };

  const filteredSessions = trainerFilter 
    ? sessions.filter(s => s.trainerInitials === trainerFilter)
    : sessions;

  const displaySessions = filteredSessions.slice(-12); // Show up to 12 sessions in the grid

  const visibleMachines = selectedRoutineId 
    ? machines.filter(m => routines.find(r => r.id === selectedRoutineId)?.machineIds.includes(m.id!))
    : machines.sort((a, b) => a.order - b.order);

  if (!client) return <div className="p-20 text-center">Client not found.</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 h-[calc(100vh-160px)] overflow-hidden">
      <div className="flex items-center justify-between bg-card p-4 border rounded-2xl shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setView('clients')} className="rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-black">{client.firstName} {client.lastName}</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Session History & Trends</p>
          </div>
        </div>
        <Badge className="bg-primary/10 text-primary border-none px-4 py-1 rounded-full font-black">
          {sessions.length} Sessions Tracked
        </Badge>
      </div>

      {/* Trainer Stats & Client Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <Card className="md:col-span-2 rounded-2xl border-2 border-primary/5">
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Client Vitals</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Height/Weight</p>
              <p className="text-xs font-black">{client.height} / {client.weight || '--'} lbs</p>
              {client.occupation && <p className="text-[8px] font-bold text-primary/70 uppercase">Job: {client.occupation}</p>}
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Phone</p>
              <p className="text-xs font-black">{client.phone || '--'}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Emergency</p>
              <p className="text-xs font-black truncate">{client.emergencyContactName || '--'}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Injuries/History</p>
              <p className="text-xs font-black truncate">{client.medicalHistory || 'None'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-2 border-primary/5">
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Routine Filter</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex flex-wrap gap-1.5">
              <Button 
                variant={selectedRoutineId === null ? 'default' : 'outline'}
                size="sm"
                className="h-6 px-2 text-[8px] font-black uppercase rounded-md"
                onClick={() => setSelectedRoutineId(null)}
              >
                View All
              </Button>
              {routines.map(r => (
                <Button 
                  key={r.id}
                  variant={selectedRoutineId === r.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 px-2 text-[8px] font-black uppercase rounded-md"
                  onClick={() => setSelectedRoutineId(selectedRoutineId === r.id ? null : r.id!)}
                >
                  {r.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-2 border-primary/5">
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Top Trainers</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex flex-wrap gap-1">
              <Button 
                variant={trainerFilter === null ? 'default' : 'outline'}
                size="sm"
                className="h-6 px-2 text-[8px] font-black uppercase rounded-md"
                onClick={() => setTrainerFilter(null)}
              >
                All
              </Button>
              {Object.entries(trainerStats)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([initials, count]) => (
                  <Button 
                    key={initials}
                    variant={trainerFilter === initials ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 px-1.5 text-[8px] font-black uppercase rounded-md flex gap-1"
                    onClick={() => setTrainerFilter(trainerFilter === initials ? null : initials)}
                  >
                    <span>{initials}</span>
                    <Badge variant="secondary" className={`text-[7px] h-3 px-1 font-black border-none ${trainerFilter === initials ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                      {count}
                    </Badge>
                  </Button>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 overflow-hidden border rounded-xl bg-card shadow-lg flex flex-col">
        <div className="overflow-auto flex-1 h-full scrollbar-thin scrollbar-thumb-muted-foreground/20">
          <table className="w-full border-collapse border-separate border-spacing-0 table-fixed">
            <thead className="sticky top-0 z-30">
              <tr>
                <th 
                  className="p-1 px-3 text-left font-black uppercase tracking-tighter border-b border-r min-w-[120px] w-[120px] bg-muted/90 backdrop-blur-md sticky left-0 z-40 text-[9px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]"
                >
                  Exercise
                </th>
                {displaySessions.map((s) => (
                  <th 
                    key={s.id} 
                    className={`p-1.5 text-center border-b border-r min-w-[70px] w-[70px] transition-all bg-muted/50 backdrop-blur-sm ${s.id === selectedSessionId ? 'bg-primary/10 ring-1 ring-inset ring-primary' : ''}`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] font-black leading-tight italic tracking-tighter">#{s.sessionNumber}</span>
                      <span className="text-[7px] text-muted-foreground font-black uppercase tracking-widest">{s.date.split('-').slice(1).join('/')}</span>
                      <span className="text-[8px] font-black text-primary/70">{s.trainerInitials}</span>
                    </div>
                  </th>
                ))}
                <th className="p-1 text-center font-black uppercase text-[8px] border-b bg-muted/50 sticky right-0 z-20 min-w-[50px] w-[50px]">+/-</th>
              </tr>
            </thead>
            <tbody>
              {visibleMachines.map((machine, mIdx) => {
                const machineLogs = displaySessions.map(s => logs[`${s.id}_${machine.id}`]);
                const rowColor = mIdx % 2 === 0 ? 'bg-card' : 'bg-muted/5';

                return (
                  <tr key={machine.id} className={`${rowColor} group hover:bg-primary/5 transition-colors h-14`}>
                    <td className={`p-1.5 px-3 border-r font-bold sticky left-0 z-20 ${rowColor} group-hover:bg-primary/5 shadow-[2px_0_5px_rgba(0,0,0,0.02)]`}>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-black tracking-tight leading-none truncate">{machine.name}</span>
                        <div className="flex flex-wrap gap-0.5 mt-1 opacity-60">
                          {machine.settingOptions?.map(opt => (
                            <span key={opt} className="text-[7px] font-bold bg-muted px-1 rounded uppercase">{opt.slice(0, 4)}</span>
                          ))}
                        </div>
                      </div>
                    </td>
                    {displaySessions.map((s, idx) => {
                      const log = logs[`${s.id}_${machine.id}`];
                      const prevLog = idx > 0 ? logs[`${displaySessions[idx-1].id}_${machine.id}`] : null;
                      
                      const isUnusual = prevLog && log && parseFloat(log.weight || '0') < parseFloat(prevLog.weight || '0') * 0.85;
                      const isImprovement = prevLog && log && parseFloat(log.weight || '0') > parseFloat(prevLog.weight || '0');

                      return (
                         <td key={s.id} className={`p-1 border-r text-center align-middle relative ${isUnusual ? 'bg-red-50/30' : ''}`}>
                          {log ? (
                            <div className="flex flex-col gap-0.5">
                              <div className={`text-[12px] font-black leading-none tracking-tighter ${isImprovement ? 'text-emerald-600' : isUnusual ? 'text-red-500' : 'text-foreground'}`}>
                                {log.weight}
                              </div>
                              <div className="text-[9px] font-bold text-muted-foreground leading-none">
                                {log.isStaticHold ? (log.seconds || '--') : (log.reps || '--')}<span className="text-[7px] ml-0.5 uppercase">{log.isStaticHold ? 's' : 'r'}</span>
                              </div>
                              <div className="flex flex-wrap justify-center gap-0.5 mt-0.5 overflow-hidden max-h-[16px]">
                                {Object.entries(log.machineSettings || {}).map(([key, val]) => (
                                  <span key={key} className="text-[6px] font-black px-0.5 h-2.5 flex items-center bg-primary/10 text-primary rounded-[2px] border border-primary/20">
                                    {val}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center opacity-5">
                              <div className="w-4 h-[1px] bg-foreground rotate-45" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-1 text-center bg-muted/5 sticky right-0 z-10 border-l shadow-[-2px_0_5px_rgba(0,0,0,0.02)]">
                      {(() => {
                        const validLogs = machineLogs.filter(Boolean);
                        if (validLogs.length < 2) return null;
                        const latest = validLogs[validLogs.length - 1];
                        const prev = validLogs[validLogs.length - 2];
                        const diff = parseFloat(latest.weight || '0') - parseFloat(prev.weight || '0');
                        
                        if (diff > 0) return <span className="text-emerald-500 text-[8px] font-black tracking-tighter leading-none">+{diff}</span>;
                        if (diff < 0) return <span className="text-red-500 text-[8px] font-black tracking-tighter leading-none">{diff}</span>;
                        return <span className="text-muted-foreground/30 text-[7px] font-black">--</span>;
                      })()}
                    </td>
                  </tr>
                );
              })}
              {/* Session Notes History Row */}
              <tr className="bg-primary/5 hover:bg-primary/10 transition-colors h-12">
                <td className="p-2 px-3 border-r font-black uppercase text-[9px] text-primary sticky left-0 z-20 bg-primary/5 group-hover:bg-primary/10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">Session Notes</td>
                {displaySessions.map((s) => {
                  const sessionNotesList = sessionNotes[s.id!] || [];
                  const latestNote = sessionNotesList[0];
                  
                  return (
                    <td key={s.id} className="p-1 border-r text-center group/note relative cursor-pointer"
                        onClick={() => setActiveNotesSession(s)}
                    >
                      <div className="flex flex-col items-center justify-center h-full">
                        <MessageSquare className={`w-3.5 h-3.5 transition-transform group-hover/note:scale-110 ${latestNote ? 'text-primary' : 'text-muted-foreground/10'}`} />
                        {latestNote && (
                          <div className="flex flex-col items-center mt-0.5 leading-none">
                            <span className="text-[7px] font-black text-primary uppercase">{latestNote.trainerInitials}</span>
                            <span className="text-[6px] text-muted-foreground line-clamp-1 max-w-[50px] font-bold italic">
                              {latestNote.content}
                            </span>
                          </div>
                        )}
                        {sessionNotesList.length > 1 && (
                          <Badge variant="secondary" className="absolute top-1 right-1 h-3 px-1 text-[6px] font-black bg-primary text-white border-white border shrink-0">
                            {sessionNotesList.length}
                          </Badge>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="bg-primary/5 sticky right-0 z-10 border-l shadow-[-2px_0_5px_rgba(0,0,0,0.02)]"></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex justify-center p-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-full px-8 font-black uppercase text-[10px] tracking-widest border-2 hover:bg-primary/5 hover:text-primary transition-all"
            onClick={() => setHistoryLimit(prev => prev + 12)}
          >
            Load Older Sessions
          </Button>
        </div>
      </div>

      {activeNotesSession && (
        <SessionNotesDetailDialog
          session={activeNotesSession}
          userTrainers={trainers}
          onClose={() => setActiveNotesSession(null)}
        />
      )}

      {/* Summary Legend */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 rounded-2xl shrink-0">
        <div className="flex gap-6 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Improvement</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Unusual Drop</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3 h-3" />
            <span>Trainer Discussion</span>
          </div>
        </div>
        <div className="text-[10px] font-black text-primary animate-pulse">
          TAP NOTES TO DISCUSS PERFORMANCE
        </div>
      </div>
    </motion.div>
  );
}

function ClientSelectionDialog({ 
  clients, 
  onSelect, 
  onClose,
  open = true,
  title = "Select Client",
  description = "Choose a client to start their current training session."
}: { 
  clients: Client[], 
  onSelect: (id: string) => void, 
  onClose: () => void,
  open?: boolean,
  title?: string,
  description?: string
}) {
  const [search, setSearch] = useState('');
  const filtered = clients.filter(c => 
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[450px] rounded-3xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-black uppercase italic tracking-tight">{title}</DialogTitle>
          <DialogDescription className="font-bold text-xs">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Find client..." 
              className="pl-10 h-11 rounded-xl bg-muted/50 border-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 pb-6 pt-2 space-y-2">
          {filtered.length > 0 ? (
            filtered.map(client => (
              <button
                key={client.id}
                onClick={() => onSelect(client.id!)}
                className="w-full text-left p-4 rounded-2xl border-2 border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all flex items-center justify-between group"
              >
                <div>
                  <p className="font-black text-lg leading-tight uppercase">
                    {client.firstName} {client.lastName}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">
                    {client.height} • {client.weight || '--'} lbs
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))
          ) : (
            <div className="py-12 text-center opacity-40">
              <Users className="w-12 h-12 mx-auto mb-2" />
              <p className="text-xs font-black uppercase">No clients found</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MachineSettingsDialog({ 
  machine, 
  client, 
  currentSettings, 
  onClose, 
  onSave 
}: { 
  machine: Machine, 
  client: Client, 
  currentSettings?: ClientMachineSetting, 
  onClose: () => void, 
  onSave: (settings: Record<string, string>, reason: string) => void 
}) {
  const [settings, setSettings] = useState<Record<string, string>>(currentSettings?.settings || {});
  const [reason, setReason] = useState('');

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">Machine Settings</DialogTitle>
          <DialogDescription>
            Configure {machine.name} for {client.firstName} ({client.height}, {client.gender}).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {machine.settings && (
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Standard Benchmarks (Reference)</p>
              <p className="text-xs font-bold italic leading-relaxed text-primary/80">{machine.settings}</p>
            </div>
          )}
          <div className="space-y-4">
            {machine.settingOptions?.map((option) => (
              <div key={option} className="space-y-2">
                <Label className="text-sm font-bold">{option}</Label>
                <Input 
                  placeholder={`Enter ${option} setting`}
                  value={settings[option] || ''}
                  onChange={(e) => setSettings({ ...settings, [option]: e.target.value })}
                  className="h-12 rounded-xl font-bold"
                />
              </div>
            ))}
            {(!machine.settingOptions || machine.settingOptions.length === 0) && (
              <div className="space-y-2">
                <Label className="text-sm font-bold">General Setting</Label>
                <Input 
                  placeholder="Enter setting"
                  value={settings['General'] || ''}
                  onChange={(e) => setSettings({ ...settings, ['General']: e.target.value })}
                  className="h-12 rounded-xl font-bold"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-bold">Reason for Change (Optional)</Label>
            <Textarea 
              placeholder="e.g. Better alignment, client discomfort..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-xl min-h-[80px]"
            />
          </div>

          <Button 
            className="h-14 rounded-2xl font-black text-lg shadow-lg bg-action text-action-foreground hover:bg-action/90 shadow-action/20"
            onClick={() => onSave(settings, reason)}
          >
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PerformanceEntryDialog({
  machine,
  currentWeight,
  currentNextWeight,
  currentReps,
  isStaticHold,
  onSave,
  onClose
}: {
  machine: Machine;
  currentWeight: string;
  currentNextWeight: string;
  currentReps: string;
  isStaticHold?: boolean;
  onSave: (weight: string, target: string, reps: string) => void;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(parseFloat(currentWeight) || 0);
  const [next, setNext] = useState(parseFloat(currentNextWeight) || current);
  const [reps, setReps] = useState(parseFloat(currentReps) || 0);

  const roundUpTo2 = (val: number) => Math.ceil(val / 2) * 2;

  const adjustCurrent = (amount: number) => setCurrent(roundUpTo2(current + amount));
  const adjustNext = (amount: number) => setNext(roundUpTo2(next + amount));
  const adjustReps = (amount: number) => setReps(Math.max(0, reps + amount));

  const applyPercentAdjust = (deltaPct: number) => {
    if (current === 0) return;
    const currentActualPct = ((next - current) / current) * 100;
    // Snap to nearest 5% increment before adding delta to ensure "taps" are additive
    const snappedPct = Math.round(currentActualPct / 5) * 5;
    const newPct = snappedPct + deltaPct;
    setNext(roundUpTo2(current * (1 + newPct / 100)));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px] rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-primary p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
            <Zap className="w-24 h-24" />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-sm">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black italic uppercase tracking-tight leading-none">{machine.name}</h2>
              <p className="text-[10px] uppercase font-bold text-white/60 tracking-wider mt-1">Direct Performance Input</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Reps/Seconds Section */}
              <section className="space-y-3 bg-muted/30 p-4 rounded-3xl border border-border/50">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center block">
                  {isStaticHold ? 'Seconds' : 'Reps'}
                </Label>
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 w-full justify-center">
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-2 bg-card shadow-sm" onClick={() => adjustReps(-1)}>-</Button>
                    <Input 
                      type="number"
                      inputMode="numeric"
                      className="h-14 w-20 text-center font-black text-2xl rounded-2xl border-2 bg-background focus:border-primary transition-all p-0"
                      value={reps || ''}
                      onChange={e => setReps(parseFloat(e.target.value) || 0)}
                    />
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-2 bg-card shadow-sm" onClick={() => adjustReps(1)}>+</Button>
                  </div>
                </div>
              </section>

              {/* Current Weight Section */}
              <section className="space-y-3 bg-muted/30 p-4 rounded-3xl border border-border/50">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center block">
                  Weight (lbs)
                </Label>
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 w-full justify-center">
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-2 bg-card shadow-sm" onClick={() => adjustCurrent(-2)}>-</Button>
                    <Input 
                      type="number"
                      inputMode="decimal"
                      className="h-14 w-24 text-center font-black text-2xl rounded-2xl border-2 bg-background focus:border-emerald-500 transition-all p-0 text-emerald-600"
                      value={current}
                      onChange={e => setCurrent(parseFloat(e.target.value) || 0)}
                    />
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-2 bg-card shadow-sm" onClick={() => adjustCurrent(2)}>+</Button>
                  </div>
                </div>
              </section>
            </div>

            {/* Next Weight Section */}
            <section className="space-y-3 bg-primary/5 p-4 rounded-3xl border border-primary/10">
              <div className="flex items-center justify-between px-2">
                <Label className="text-[10px] font-black uppercase text-primary/60 tracking-widest">
                  Next Session Target
                </Label>
                <Badge variant="outline" className="text-[9px] font-black bg-primary/10 text-primary border-primary/20">Automatic Increment</Badge>
              </div>
              <div className="flex items-center gap-4 justify-center">
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-2 bg-card shadow-sm text-primary" onClick={() => adjustNext(-2)}>-</Button>
                <div className="flex items-end gap-1">
                  <Input 
                    type="number"
                    inputMode="decimal"
                    className="h-14 w-24 text-center font-black text-3xl rounded-none border-none bg-transparent p-0 text-primary focus:ring-0 focus:border-transparent no-arrows"
                    value={next}
                    onChange={e => setNext(parseFloat(e.target.value) || 0)}
                  />
                  <span className="font-black text-primary/30 mb-2 italic">LBS</span>
                </div>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-2 bg-card shadow-sm text-primary" onClick={() => adjustNext(2)}>+</Button>
              </div>
              <div className="flex justify-center gap-4">
                <Button 
                  variant="ghost" 
                  className="h-10 px-6 rounded-xl text-[11px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 border-2 border-orange-500/20"
                  onClick={() => applyPercentAdjust(-5)}
                >
                  -5% DECREASE
                </Button>
                <Button 
                  variant="ghost" 
                  className="h-10 px-6 rounded-xl text-[11px] font-black uppercase tracking-widest text-primary hover:text-primary hover:bg-primary/10 border-2 border-primary/20"
                  onClick={() => applyPercentAdjust(5)}
                >
                  +5% INCREASE
                </Button>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="h-14 rounded-2xl font-black uppercase italic tracking-widest border-2" onClick={onClose}>
              Cancel
            </Button>
            <Button className="h-14 rounded-2xl font-black uppercase italic tracking-widest bg-action text-action-foreground hover:bg-action/90 shadow-xl shadow-action/20" onClick={() => onSave(current.toString(), next.toString(), reps.toString())}>
              Commit Data
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function MachinesView({ machines, clients, onOpenInfo }: { machines: Machine[], clients: Client[], onOpenInfo: (machine: Machine) => void }) {
  const [allLogs, setAllLogs] = useState<ExerciseLog[]>([]);

  useEffect(() => {
    // OPTIMIZATION: Use getDocs instead of onSnapshot for dashboard stats to save quota.
    // Fetch once on mount. Real-time updates aren't critical for global averages.
    const fetchData = async () => {
      try {
        const qLogs = query(collection(db, 'exerciseLogs'), orderBy('createdAt', 'desc'), limit(500));
        const logsSnap = await getDocs(qLogs);
        setAllLogs(logsSnap.docs.map(doc => doc.data() as ExerciseLog));
      } catch (err) {
        console.error("Dashboard data fetch failed:", err);
      }
    };
    fetchData();
  }, []);

  const calculateStats = (machineId: string) => {
    const machineLogs = allLogs.filter(log => log.machineId === machineId);
    
    if (machineLogs.length === 0) return null;

    const weights = machineLogs.map(log => parseFloat(log.weight || '0')).filter(w => w > 0);
    const reps = machineLogs.map(log => parseFloat(log.reps || '0')).filter(r => r > 0);

    return {
      avgWeight: weights.length ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length) : 0,
      avgReps: reps.length ? (reps.reduce((a, b) => a + b, 0) / reps.length).toFixed(1) : 0,
      maxWeight: weights.length ? Math.max(...weights) : 0,
    };
  };

  return (
    <motion.div 
      key="machines"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4 w-full max-w-full overflow-x-hidden pb-20"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight uppercase text-secondary">Equipment & Analytics Index</h2>
          <p className="text-secondary/80 text-[10px] font-medium uppercase tracking-widest">Global usage statistics & form guidance.</p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {machines.map((machine) => {
          const stats = calculateStats(machine.id!);
          // Using deterministically selected robust Unsplash images for fitness equipment 
          const imgId = [
            "1534438327276-14e5300c3a48", "1540497077202-7c8a3999166f", "1574680096145-d05b474e2155",
            "1518611012118-696072aa579a", "1581009146145-b5ef050c2e1e", "1534438327276-14e5300c3a48"
          ][(machine.order || 0) % 6];

          return (
            <Card key={machine.id} className="rounded-2xl overflow-hidden border border-border/80 hover:border-primary/50 transition-all shadow-sm bg-card flex flex-col">
              {/* Thumbnail Header Area */}
              <div className="relative h-28 bg-muted">
                <img src={`https://images.unsplash.com/photo-${imgId}?auto=format&fit=crop&w=400&q=80`} alt={machine.name} className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute top-2 left-2 w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-md">
                  {machine.order}
                </div>
                <div className="absolute bottom-2 left-3 pr-3">
                  <h3 className="text-sm font-bold uppercase tracking-tight text-white leading-tight">{machine.name}</h3>
                  <p className="text-[8px] font-medium uppercase tracking-widest text-action">{machine.fullName || "Targeted Muscles"}</p>
                </div>
              </div>
              
              <CardContent className="p-3 flex-1 flex flex-col justify-between space-y-3">
                {/* Global Benchmark Compact */}
                <div className="bg-muted/30 rounded-lg p-2 border border-border/40">
                  <p className="text-[7px] font-bold uppercase tracking-widest text-secondary mb-1.5 opacity-60">Global Benchmark</p>
                  <div className="flex justify-between items-center">
                    <div className="text-left">
                      <p className="text-[12px] font-bold text-secondary leading-none">{stats?.avgWeight || '--'} <span className="text-[8px] font-medium opacity-60">lbs</span></p>
                      <p className="text-[8px] font-medium text-secondary/60 uppercase mt-0.5">Avg Wgt</p>
                    </div>
                    <div className="w-[1px] h-6 bg-border" />
                    <div className="text-center">
                      <p className="text-[12px] font-bold text-secondary leading-none">{stats?.avgReps || '--'}</p>
                      <p className="text-[8px] font-medium text-secondary/60 uppercase mt-0.5">Avg Reps</p>
                    </div>
                    <div className="w-[1px] h-6 bg-border" />
                    <div className="text-right">
                      <p className="text-[12px] font-bold text-primary leading-none">{stats?.maxWeight || '--'} <span className="text-[8px] font-medium text-primary/60">lbs</span></p>
                      <p className="text-[8px] font-medium text-primary/60 uppercase mt-0.5">Max</p>
                    </div>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full h-8 rounded-lg font-bold uppercase tracking-widest gap-1.5 bg-background border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors text-[8px] sm:text-[9px]"
                  onClick={() => onOpenInfo(machine)}
                >
                  <AlertCircle className="w-3 h-3" />
                  Info & Guidelines
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );
}

function ExerciseHistoryDialog({
  clientId,
  machine,
  onClose
}: {
  clientId: string;
  machine: Machine;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'exerciseLogs'),
      where('clientId', '==', clientId),
      where('machineId', '==', machine.id!),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExerciseLog));
      setHistory(logs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clientId, machine.id]);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] h-[80vh] flex flex-col rounded-3xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-black uppercase italic tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            {machine.name} History
          </DialogTitle>
          <DialogDescription className="font-bold text-xs">
            Performance tracking from origin to present.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-20 opacity-50 space-y-2">
              <ClipboardList className="w-12 h-12 mx-auto" />
              <p className="font-bold uppercase text-xs">No historical data found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((log, idx) => {
                const isOrigin = idx === history.length - 1;
                return (
                  <div 
                    key={log.id} 
                    className={`p-4 rounded-2xl border transition-all ${isOrigin ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/10' : 'bg-card'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-muted-foreground uppercase">
                          {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleDateString() : 'Recent'}
                        </span>
                        {isOrigin && (
                          <Badge className="bg-primary text-white text-[8px] font-black rounded px-1.5 h-4 border-none uppercase">Origin</Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {log.isStaticHold && <Badge variant="outline" className="text-[8px] border-primary text-primary h-4">Static</Badge>}
                        {log.notes && <MessageSquare className="w-3 h-3 text-primary/40" />}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-black text-muted-foreground uppercase">Weight</p>
                        <p className="text-xl font-black">{log.weight} <span className="text-[10px] font-normal italic">lbs</span></p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-black text-muted-foreground uppercase">{log.isStaticHold ? 'Seconds' : 'Reps'}</p>
                        <p className={`text-xl font-black ${
                          log.repQuality === 3 ? 'text-emerald-500' : 
                          log.repQuality === 2 ? 'text-amber-500' : 
                          log.repQuality === 1 ? 'text-red-500' : 
                          ''
                        }`}>{log.isStaticHold ? (log.seconds || '0') : (log.reps || '0')}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-black text-muted-foreground uppercase">Quality</p>
                        <div className={`w-fit px-2 py-0.5 rounded-full text-[10px] font-black text-white ${
                          log.repQuality === 3 ? 'bg-emerald-500' : 
                          log.repQuality === 2 ? 'bg-amber-500' : 
                          log.repQuality === 1 ? 'bg-red-500' : 
                          'bg-muted text-muted-foreground'
                        }`}>
                          {log.repQuality === 3 ? 'ELITE' : log.repQuality === 2 ? 'GOOD' : log.repQuality === 1 ? 'POOR' : 'NONE'}
                        </div>
                      </div>
                    </div>

                    {log.notes && (
                      <div className="mt-3 text-[10px] bg-muted/50 p-2 rounded-lg font-medium text-muted-foreground border-l-2 border-primary/30 italic">
                        "{log.notes}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SessionNotesDetailDialog({ 
  session, 
  onClose,
  userTrainers
}: { 
  session: WorkoutSession, 
  onClose: () => void,
  userTrainers: Trainer[]
}) {
  const [noteContent, setNoteContent] = useState('');
  const [history, setHistory] = useState<SessionNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Identify current trainer
  const currentUser = auth.currentUser;
  const currentTrainer = userTrainers.find(t => t.pin === localStorage.getItem('trainer_pin') || t.fullName === currentUser?.displayName);
  const trainerInitials = currentTrainer?.initials || '??';

  useEffect(() => {
    const q = query(
      collection(db, 'sessionNotes'),
      where('sessionId', '==', session.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SessionNote));
      setHistory(notes);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [session.id]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    try {
      await addDoc(collection(db, 'sessionNotes'), {
        sessionId: session.id,
        clientId: session.clientId,
        trainerId: currentTrainer?.id || currentUser?.uid,
        trainerInitials: trainerInitials,
        content: noteContent.trim(),
        createdAt: serverTimestamp()
      });
      setNoteContent('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sessionNotes');
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" /> Session #{session.sessionNumber} Notes
          </DialogTitle>
          <DialogDescription className="font-bold flex items-center gap-2">
            {new Date(session.date + 'T00:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            <Badge variant="outline" className="text-[10px] py-0 h-4">{session.trainerInitials}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2 custom-scrollbar">
          {history.length > 0 ? (
            history.map((note) => (
              <div key={note.id} className="bg-muted/30 p-4 rounded-2xl border border-border/50 space-y-2">
                <div className="flex justify-between items-start">
                  <Badge variant="secondary" className="font-black text-[9px] uppercase tracking-widest bg-primary/10 text-primary border-none">
                    {note.trainerInitials}
                  </Badge>
                  <span className="text-[9px] font-bold text-muted-foreground">
                    {note.createdAt?.toDate?.() ? note.createdAt.toDate().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Now'}
                  </span>
                </div>
                <p className="text-sm font-medium leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {note.content}
                </p>
              </div>
            ))
          ) : (
            <div className="py-8 text-center bg-muted/20 rounded-2xl border border-dashed border-muted-foreground/20">
              <StickyNote className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase">No session-specific notes yet.</p>
            </div>
          )}
        </div>

        <form onSubmit={handleAddNote} className="pt-4 border-t space-y-3">
          <Textarea 
            placeholder="Add context (injury, performance tweak, mood)..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            className="min-h-[100px] rounded-2xl border-2 focus-visible:ring-primary/20 transition-all resize-none"
          />
          <div className="flex justify-between items-center">
            <p className="text-[9px] font-bold text-muted-foreground uppercase italic px-2">
              Signed as: <span className="text-primary">{trainerInitials}</span>
            </p>
            <Button type="submit" className="rounded-xl px-6 font-black uppercase tracking-widest gap-2 bg-action text-action-foreground hover:bg-action/90 shadow-lg shadow-action/20">
              <Save className="w-4 h-4" /> Save Note
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WorkoutTrackerView({ 
  clientId, 
  clients, 
  machines, 
  trainers, 
  user, 
  setView, 
  setSelectedClientId, 
  showClientPicker, 
  setShowClientPicker,
  setIsAddingClient,
  setClientFormData,
  onOpenInfo,
  authTrainer,
  trainerFocuses
}: { 
  clientId: string | null, 
  clients: Client[], 
  machines: Machine[], 
  trainers: Trainer[], 
  user: FirebaseUser, 
  setView: (v: View) => void, 
  setSelectedClientId: (id: string | null) => void, 
  showClientPicker: boolean, 
  setShowClientPicker: (v: boolean) => void,
  setIsAddingClient: (v: boolean) => void,
  setClientFormData: (v: any) => void,
  onOpenInfo: (m: Machine) => void,
  authTrainer: Trainer | null,
  trainerFocuses: TrainerFocus[]
}) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [logs, setLogs] = useState<Record<string, ExerciseLog>>({});
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [currentSession, setCurrentSession] = useState<WorkoutSession | null>(null);
  const [activeMachineIds, setActiveMachineIds] = useState<string[]>([]);
  const [clientMachineSettings, setClientMachineSettings] = useState<Record<string, ClientMachineSetting>>({});
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([]);
  const [isEditingRoutine, setIsEditingRoutine] = useState(false);
  const [showRoutinePicker, setShowRoutinePicker] = useState(false);
  const [editingSettingsMachineId, setEditingSettingsMachineId] = useState<string | null>(null);
  const [editingWeightMachineId, setEditingWeightMachineId] = useState<string | null>(null);
  const [historyMachineId, setHistoryMachineId] = useState<string | null>(null);
  const [isSettingUpRoutine, setIsSettingUpRoutine] = useState(false);
  const [showAllMachines, setShowAllMachines] = useState(true);
  const [routineMachines, setRoutineMachines] = useState<string[]>([]);
  const [lastRoutineLogs, setLastRoutineLogs] = useState<Record<string, ExerciseLog>>({});
  const [isPreSessionMode, setIsPreSessionMode] = useState(false);
  const [isAdjustingProtocol, setIsAdjustingProtocol] = useState(false);
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [adjustmentScope, setAdjustmentScope] = useState<'once' | 'permanent'>('once');
  const [adjustedMachineIds, setAdjustedMachineIds] = useState<string[]>([]);
  const [preSessionSelectedRoutine, setPreSessionSelectedRoutine] = useState<RoutineType>('A');
  const [targetRoutine, setTargetRoutine] = useState<Routine | null>(null);
  const [historicalLifts, setHistoricalLifts] = useState<Record<string, { last: ExerciseLog; previous: ExerciseLog | null }>>({});

  // Fetch all exercise logs for analysis (limited to last 1000 for performance)
  const [isShowingSessionNotes, setIsShowingSessionNotes] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const [pendingAssignSession, setPendingAssignSession] = useState<WorkoutSession | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Special listener for unassigned sessions when no client is selected
  useEffect(() => {
    if (!clientId) {
      const unassignedQuery = query(
        collection(db, 'sessions'),
        where('isUnassigned', '==', true),
        where('status', '==', 'In-Progress'),
        limit(1)
      );

      const unsubscribe = onSnapshot(unassignedQuery, (snapshot) => {
        if (!snapshot.empty) {
          const session = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as WorkoutSession;
          setCurrentSession(session);
          setSessions([session]);
        } else {
          setCurrentSession(null);
          setSessions([]);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'sessions');
      });

      return () => unsubscribe();
    }
  }, [clientId]);

  useEffect(() => {
    if (clientId) {
      const client = clients.find(c => c.id === clientId);
      setSelectedClient(client || null);

      // Fetch Client Machine Settings
      const settingsQuery = query(collection(db, 'clientMachineSettings'), where('clientId', '==', clientId));
      const unsubscribeSettings = onSnapshot(settingsQuery, (snapshot) => {
        const settingsMap: Record<string, ClientMachineSetting> = {};
        snapshot.docs.forEach(doc => {
          const data = { id: doc.id, ...doc.data() } as ClientMachineSetting;
          settingsMap[data.machineId] = data;
        });
        setClientMachineSettings(settingsMap);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'clientMachineSettings');
      });

      // Fetch Routines
      const routinesQuery = query(collection(db, 'routines'), where('clientId', '==', clientId));
      const unsubscribeRoutines = onSnapshot(routinesQuery, (snapshot) => {
        const routinesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Routine));
        // Sort routines alphabetically so Routine A is default/first
        setRoutines(routinesData.sort((a, b) => a.name.localeCompare(b.name)));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'routines');
      });

    // Fetch Sessions
      const sessionsQuery = query(
        collection(db, 'sessions'), 
        where('clientId', '==', clientId),
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      const notesQuery = query(
        collection(db, 'sessionNotes'),
        where('clientId', '==', clientId),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const unsubscribeSessions = onSnapshot(sessionsQuery, async (snapshot) => {
        const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutSession));
        setSessions(sessionsData);
        
        // Auto-select In-Progress session if it exists
        const inProgress = sessionsData.find(s => s.status === 'In-Progress');
        if (inProgress) {
          setCurrentSession(inProgress);
          setShowRoutinePicker(false);
          setIsPreSessionMode(false);
        } else {
          setCurrentSession(null);
          setIsPreSessionMode(true);

          // Alternation Logic
          const completed = sessionsData.filter(s => s.status === 'Completed');
          const lastSess = completed[0];
          
          // Wait for routines to be loaded
          // Using a small delay or reacting to routines change might be better, 
          // but for now we'll handle it when routines state updates too
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'sessions');
      });

      const unsubscribeNotes = onSnapshot(notesQuery, (snapshot) => {
        const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SessionNote));
        setSessionNotes(notesData);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'sessionNotes');
      });

      return () => {
        unsubscribeSettings();
        unsubscribeRoutines();
        unsubscribeSessions();
        unsubscribeNotes();
      };
    }
  }, [clientId, clients, machines]);

  useEffect(() => {
    if (sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id!);
      const logsQuery = query(collection(db, 'exerciseLogs'), where('sessionId', 'in', sessionIds));
      const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
        const logsMap: Record<string, ExerciseLog> = {};
        snapshot.docs.forEach(doc => {
          const data = { id: doc.id, ...doc.data() } as ExerciseLog;
          logsMap[`${data.sessionId}_${data.machineId}`] = data;
        });
        setLogs(logsMap);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'exerciseLogs');
      });
      return () => unsubscribeLogs();
    }
  }, [sessions]);

  // Routine Alternation Logic & Historical Lifts Fetching
  useEffect(() => {
    if (clientId && !currentSession && isPreSessionMode) {
      const determineAndFetch = async () => {
        const completed = sessions.filter(s => s.status === 'Completed');
        const lastSess = completed[0];
        
        // Find Routine A and B specifically
        const routineA = routines.find(r => r.name === 'Routine A');
        const routineB = routines.find(r => r.name === 'Routine B');
        const isRoutineBActive = selectedClient?.isRoutineBActive || false;
        
        let target: Routine | null = null;

        // Sequence Selection Logic
        if (routines.length === 0) {
          // New Client: Default to Routine A Setup
          target = { name: 'Routine A', machineIds: [], clientId } as Routine;
        } else if (routineA && routineB && isRoutineBActive) {
          // Strict Alternation Logic
          const lastRoutine = routines.find(r => r.id === lastSess?.routineId);
          if (lastRoutine?.name === 'Routine A') {
            target = routineB;
          } else {
            target = routineA;
          }
        } else {
          // Fallback to Routine A or whatever exists
          target = routineA || routines[0];
        }

        setTargetRoutine(target);

        if (target) {
          // Fetch historical lifts for ALL machines for the audit overview
          setHistoricalLifts({}); // Reset before fetch
          
          const fetchAllLifts = async () => {
            try {
              const logsQ = query(
                collection(db, 'exerciseLogs'),
                where('clientId', '==', clientId),
                orderBy('createdAt', 'desc'),
                limit(100)
              );
              
              const snap = await getDocs(logsQ);
              const allRecentLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExerciseLog));
              
              const historical: Record<string, { last: ExerciseLog; previous: ExerciseLog | null }> = {};
              
              machines.forEach(m => {
                const machineLogs = allRecentLogs.filter(l => l.machineId === m.id);
                if (machineLogs.length > 0) {
                  historical[m.id!] = { 
                    last: machineLogs[0], 
                    previous: machineLogs.length > 1 ? machineLogs[1] : null 
                  };
                }
              });
              
              setHistoricalLifts(historical);
            } catch (err: any) {
              console.error("Error fetching historical lifts:", err);
            }
          };
          fetchAllLifts();
        }
      };
      determineAndFetch();
    }
  }, [clientId, routines, currentSession, isPreSessionMode, sessions, selectedClient?.isRoutineBActive]);

  useEffect(() => {
    if (currentSession) {
      const routine = routines.find(r => r.id === currentSession.routineId);
      if (routine) {
        setActiveMachineIds(routine.machineIds);
        setRoutineMachines(routine.machineIds);
      } else {
        setActiveMachineIds(machines.map(m => m.id!));
        setRoutineMachines([]);
      }
    }
  }, [currentSession, routines, machines]);

  const updateRoutineNote = async (machineId: string, note: string) => {
    if (!currentSession?.routineId) return;
    const routine = routines.find(r => r.id === currentSession.routineId);
    if (!routine) return;

    try {
      const notes = { ...(routine.machineNotes || {}), [machineId]: note };
      await updateDoc(doc(db, 'routines', routine.id!), { machineNotes: notes });
    } catch (error) {
      console.error("Error updating routine note:", error);
    }
  };

  const moveMachine = async (machineId: string, direction: 'up' | 'down') => {
    if (!currentSession?.routineId) return;
    const routine = routines.find(r => r.id === currentSession.routineId);
    if (!routine) return;

    const ids = [...routine.machineIds];
    const idx = ids.indexOf(machineId);
    if (idx === -1) return;

    if (direction === 'up' && idx > 0) {
      [ids[idx], ids[idx - 1]] = [ids[idx - 1], ids[idx]];
    } else if (direction === 'down' && idx < ids.length - 1) {
      [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    }

    try {
      await updateDoc(doc(db, 'routines', routine.id!), { machineIds: ids });
    } catch (error) {
      console.error("Error moving machine:", error);
    }
  };

  const startNewSession = async (routineType: 'A' | 'B' | 'Free', sessionType: SessionType = 'Standard', customMachines?: string[], adjustmentNote?: string, permanentSave?: boolean) => {
    if (!clientId) return;
    const nextNum = sessions.length > 0 ? Math.max(...sessions.map(s => s.sessionNumber)) + 1 : 1;
    
    // Auto-populate trainer and date
    const trainer = trainers[0]?.initials || '??';
    const date = new Date().toISOString().split('T')[0];
    
    try {
      let routineId: string | undefined = undefined;
      
      if (routineType !== 'Free') {
        const routineName = `Routine ${routineType}`;
        let routine = routines.find(r => r.name === routineName);
        
        if (!routine) {
          // Create the routine if it doesn't exist
          const newRoutineRef = await addDoc(collection(db, 'routines'), {
            clientId,
            name: routineName,
            machineIds: customMachines || [],
            createdAt: serverTimestamp()
          });
          routineId = newRoutineRef.id;

          if (routineType === 'B') {
            await updateDoc(doc(db, 'clients', clientId), { isRoutineBActive: true });
          }
        } else {
          routineId = routine.id;
          // If permanent save requested, update existing routine
          if (permanentSave && customMachines) {
            await updateDoc(doc(db, 'routines', routine.id), {
              machineIds: customMachines
            });
          }
        }
      }

      // 1. Create the session
      const docRef = await addDoc(collection(db, 'sessions'), {
        clientId,
        routineId: routineId || null,
        sessionType,
        sessionNumber: nextNum,
        date,
        trainerInitials: trainer,
        status: 'In-Progress',
        startTime: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      if (adjustmentNote) {
        await addDoc(collection(db, 'sessionNotes'), {
          sessionId: docRef.id,
          clientId,
          trainerId: authTrainer?.id || '',
          date: new Date().toLocaleDateString(),
          note: `[Protocol Adjustment]: ${adjustmentNote}`,
          createdAt: serverTimestamp()
        });
      }

      // 2. Fetch last logs to pre-fill weights
      const lastLogsQuery = query(
        collection(db, 'exerciseLogs'),
        where('clientId', '==', clientId),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const lastLogsSnap = await getDocs(lastLogsQuery);
      const machineLastWeights: Record<string, string> = {};
      lastLogsSnap.forEach(l => {
        const data = l.data() as ExerciseLog;
        if (!machineLastWeights[data.machineId]) {
          machineLastWeights[data.machineId] = data.targetWeight || data.weight || '0';
        }
      });

      // 3. Auto-populate logs for routine machines
      let activeMachineIds = customMachines;
      if (!activeMachineIds) {
        const routine = routineId ? routines.find(r => r.id === routineId) : null;
        activeMachineIds = routine ? routine.machineIds : [];
      }

      if (activeMachineIds && activeMachineIds.length > 0) {
        const currentSettings = clientMachineSettings;
        for (const mId of activeMachineIds) {
          const prefilledWeight = machineLastWeights[mId];
          if (prefilledWeight) {
            await addDoc(collection(db, 'exerciseLogs'), {
              sessionId: docRef.id,
              clientId,
              machineId: mId,
              weight: prefilledWeight,
              machineSettings: currentSettings[mId]?.settings || {},
              createdAt: serverTimestamp()
            });
          }
        }
      }
      
      const newSession = { 
        id: docRef.id, 
        clientId, 
        routineId: routineId || null,
        sessionType,
        sessionNumber: nextNum, 
        date, 
        trainerInitials: trainer,
        status: 'In-Progress'
      };
      setCurrentSession(newSession as WorkoutSession);
      setShowRoutinePicker(false);
      setIsPreSessionMode(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sessions');
    }
  };

  const startUnassignedSession = async () => {
    if (!authTrainer) return;
    
    // Default machines as requested
    const defaultMachineNames = ["Hip Abduction", "Hip Adduction", "Leg Press", "Compound Row", "Chest Press", "Lumbar"];
    const activeMachines = defaultMachineNames.map(name => 
      machines.find(m => m.name === name || m.fullName === name)?.id
    ).filter(Boolean) as string[];

    const date = new Date().toISOString().split('T')[0];

    try {
      const docRef = await addDoc(collection(db, 'sessions'), {
        isUnassigned: true,
        sessionType: 'Standard',
        sessionNumber: 0,
        date,
        trainerInitials: authTrainer.initials,
        status: 'In-Progress',
        startTime: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // Populate logs
      for (const mid of activeMachines) {
        await addDoc(collection(db, 'exerciseLogs'), {
          sessionId: docRef.id,
          machineId: mid,
          weight: '0',
          reps: '',
          repQuality: 0,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error starting unassigned session:", error);
    }
  };

  const assignSessionToClient = async (targetClientId: string) => {
    const sessionToAssign = pendingAssignSession || currentSession;
    if (!sessionToAssign?.id) return;
    try {
      // 1. Update session
      await updateDoc(doc(db, 'sessions', sessionToAssign.id), {
        clientId: targetClientId,
        isUnassigned: false,
        status: 'Completed',
        endTime: serverTimestamp()
      });

      // 2. Update all logs
      const logsQ = query(collection(db, 'exerciseLogs'), where('sessionId', '==', sessionToAssign.id));
      const snap = await getDocs(logsQ);
      for (const d of snap.docs) {
        await updateDoc(doc(db, 'exerciseLogs', d.id), { clientId: targetClientId });
      }

      // Update local state if it was the current session
      if (currentSession?.id === sessionToAssign.id) {
        setCurrentSession(null);
      }
      
      setSelectedClientId(targetClientId);
      setShowAssignDialog(false);
      setPendingAssignSession(null);
      setView('profile'); // Take them to profile to see the work
    } catch (error) {
      console.error("Error assigning session:", error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      // Delete associated logs first
      const logsQ = query(collection(db, 'exerciseLogs'), where('sessionId', '==', sessionId));
      const logsSnap = await getDocs(logsQ);
      for (const logDoc of logsSnap.docs) {
        await deleteDoc(logDoc.ref);
      }
      // Delete associated notes
      const notesQ = query(collection(db, 'sessionNotes'), where('sessionId', '==', sessionId));
      const notesSnap = await getDocs(notesQ);
      for (const noteDoc of notesSnap.docs) {
        await deleteDoc(noteDoc.ref);
      }
      // Delete session
      await deleteDoc(doc(db, 'sessions', sessionId));
      
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }
      setShowEndConfirmation(false);
      setPendingAssignSession(null);
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const handleEndSessionPress = () => {
    setShowEndConfirmation(true);
  };

  const finalizeEndSession = async () => {
    if (!currentSession?.id) return;
    
    // If it's a regular session, just end it
    if (!currentSession.isUnassigned) {
      try {
        await updateDoc(doc(db, 'sessions', currentSession.id), {
          status: 'Completed',
          endTime: serverTimestamp()
        });
        setCurrentSession(null);
        setShowEndConfirmation(false);
        setView('profile');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'sessions');
      }
    } else {
      // It's unassigned, keep confirmation open but we'll transition to the specific unassigned end flow
      // which is handled in the UI of the confirmation dialog
    }
  };

  const [selectedSessionType, setSelectedSessionType] = useState<SessionType>('Standard');

  const updateLog = async (sessionId: string, machineId: string, field: keyof ExerciseLog, value: any) => {
    const key = `${sessionId}_${machineId}`;
    const existing = logs[key];
    const currentSettings = clientMachineSettings[machineId]?.settings || {};

    try {
      if (existing) {
        await updateDoc(doc(db, 'exerciseLogs', existing.id!), { 
          [field]: value,
          machineSettings: currentSettings,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'exerciseLogs'), { 
          sessionId, 
          clientId,
          machineId, 
          [field]: value,
          machineSettings: currentSettings,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'exerciseLogs');
    }
  };

  const saveMachineSettings = async (machineId: string, newSettings: Record<string, string>, reason: string) => {
    if (!clientId || !user) return;
    const current = clientMachineSettings[machineId];
    const trainerId = user.uid;

    try {
      // Update or Create Client Machine Settings
      const settingsRef = current?.id 
        ? doc(db, 'clientMachineSettings', current.id)
        : doc(collection(db, 'clientMachineSettings'));
      
      await setDoc(settingsRef, {
        clientId,
        machineId,
        settings: newSettings,
        updatedBy: trainerId,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Record Change Audit
      await addDoc(collection(db, 'machineSettingChanges'), {
        machineId,
        clientId,
        trainerId,
        previousSettings: current?.settings || {},
        newSettings,
        reason,
        createdAt: serverTimestamp()
      });

      setEditingSettingsMachineId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'clientMachineSettings');
    }
  };

  const toggleMachine = async (machineId: string) => {
    const newActiveIds = activeMachineIds.includes(machineId) 
      ? activeMachineIds.filter(id => id !== machineId) 
      : [...activeMachineIds, machineId];
    
    setActiveMachineIds(newActiveIds);

    // Auto-save to routine if a session is active
    if (currentSession?.routineId) {
      try {
        await updateDoc(doc(db, 'routines', currentSession.routineId), {
          machineIds: newActiveIds,
          updatedBy: user.uid,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error("Error auto-saving routine:", error);
      }
    }
  };

  const cancelActiveSession = async () => {
    if (!currentSession) {
      setSelectedClientId(null);
      return;
    }

    if (window.confirm("Are you sure you want to scrap this session? All progress for this session will be lost.")) {
      try {
        if (currentSession.id) {
          await deleteDoc(doc(db, 'sessions', currentSession.id));
        }
        setCurrentSession(null);
        setSelectedClientId(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'sessions');
      }
    }
  };

  const getSuggestedWeight = (machine: Machine, client: Client) => {
    // Basic safety baseline: 20% of body weight as safe start if no history exists
    if (client.weight) {
      const bw = parseFloat(client.weight);
      if (!isNaN(bw)) {
        return Math.round(bw * 0.2).toString();
      }
    }

    return '0';
  };

  if (!selectedClient && !currentSession) {
    const filteredClients = clients
      .filter(c => c.isActive && (`${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())))
      .sort((a,b) => a.lastName.localeCompare(b.lastName));

    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background p-6 max-w-xl mx-auto w-full pb-24">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }}
          className="w-full space-y-8"
        >
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-primary/10 rounded-[32px] flex items-center justify-center mx-auto mb-4 border-2 border-primary/20">
              <Search className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none">Client Focus</h2>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] opacity-60">Idle State • Search to begin session</p>
          </div>

          <Card className="rounded-[40px] border-2 shadow-2xl overflow-hidden p-2 bg-card/50 backdrop-blur-sm">
            <div className="p-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-40" />
                <Input 
                  placeholder="Type client name..." 
                  className="pl-14 h-16 rounded-[28px] border-2 border-muted hover:border-primary/30 focus:border-primary transition-all font-black uppercase italic tracking-tight"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="grid gap-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredClients.length > 0 ? (
                  filteredClients.slice(0, 10).map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClientId(c.id!)}
                      className="flex justify-between items-center p-5 rounded-[24px] bg-muted/30 hover:bg-primary hover:text-white border-2 border-transparent transition-all group"
                    >
                      <div className="text-left">
                        <p className="font-black uppercase italic tracking-tighter text-lg leading-none group-hover:translate-x-1 transition-transform">{c.firstName} {c.lastName}</p>
                        <p className="text-[9px] font-bold uppercase opacity-60 mt-1 tracking-widest group-hover:text-white/70">
                          {sessions.find(s => s.clientId === c.id)?.date ? `Last Session: ${sessions.find(s => s.clientId === c.id)?.date}` : 'Ready for Initial Intake'}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 opacity-30 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                    </button>
                  ))
                ) : (
                  <div className="text-center p-12 bg-muted/10 rounded-[32px] border-2 border-dashed border-muted/50">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">No active matches found</p>
                  </div>
                )}
              </div>

              <Button 
                variant="ghost"
                className="w-full h-14 rounded-[24px] font-black uppercase italic tracking-widest text-[10px] text-muted-foreground hover:text-primary transition-all"
                onClick={() => setView('clients')}
              >
                Go to Full Client Directory
              </Button>
            </div>
          </Card>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-dashed" /></div>
            <div className="relative flex justify-center text-[10px] uppercase font-black"><span className="bg-background px-6 text-muted-foreground/30 font-bold tracking-widest leading-none">Station Workflow</span></div>
          </div>

          <div className="space-y-4">
            <Button 
              size="lg" 
              className="w-full h-20 rounded-[32px] text-xl font-black italic uppercase tracking-widest shadow-2xl shadow-primary/20 transition-all active:scale-95 bg-primary hover:bg-primary/90 flex items-center justify-center gap-4 group"
              onClick={startUnassignedSession}
            >
              <PlayCircle className="w-8 h-8 fill-white" />
              <span>Open Session</span>
            </Button>
            <p className="text-[9px] text-center font-bold text-muted-foreground/50 uppercase tracking-widest px-8 leading-relaxed">
              Start ad-hoc tracking immediately<br/>(Can assign to client at checkout)
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (clientId && isPreSessionMode && selectedClient && !currentSession) {
    return (
      <PreSessionOverview 
        client={selectedClient}
        targetRoutine={targetRoutine}
        lastSession={sessions.filter(s => s.status === 'Completed')[0] || null}
        historicalLifts={historicalLifts}
        onStart={(routineType, customMachines, note) => startNewSession(routineType, undefined, customMachines, note)}
        onCancel={() => setSelectedClientId(null)}
        machines={machines}
        routines={routines}
        trainerFocuses={trainerFocuses.filter(f => f.clientId === clientId)}
        sessionNotes={sessionNotes}
      />
    );
  }

  const clientNameDisplay = selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : "Open Session";
  const lastSession = sessions.length > 0 ? sessions[0] : null;
  const previousSession = sessions.length > 1 ? sessions[1] : null;

  // Suggested routine from targetRoutine state
  const getSuggestedType = (rt: Routine | null): 'A' | 'B' | 'Free' => {
    if (!rt) return 'A';
    if (rt.name.includes('Routine A')) return 'A';
    if (rt.name.includes('Routine B')) return 'B';
    return 'Free';
  };
  const suggestedRoutineType = (() => {
    if (routines.length === 0) return 'A';
    if (routines.length === 1) return (routines[0].name.includes('B') ? 'B' : 'A') as RoutineType;
    
    // If we have both, alternate based on last session
    if (!lastSession || !lastSession.routineId) return 'A';
    
    const lastR = routines.find(r => r.id === lastSession.routineId);
    if (!lastR) return 'A';
    
    if (lastR.name.includes('Routine A')) return 'B';
    return 'A';
  })();
  const isRoutineBActive = selectedClient?.isRoutineBActive || false;

  // Check for rest days (3 days recommended)
  const daysSinceLastSession = lastSession?.date 
    ? Math.floor((new Date().getTime() - new Date(lastSession.date).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const needsRest = daysSinceLastSession !== null && daysSinceLastSession < 3;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[calc(100vh-80px)] flex flex-col gap-1 overflow-hidden">
      {/* Persistent Active Client Header */}
      {selectedClient && (
        <div className="bg-card border-b px-4 py-2 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shadow-lg ${currentSession?.routineId ? 'bg-primary' : 'bg-muted-foreground/50'}`}>
              <UserCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Active Client</p>
              <h3 className="text-sm font-black uppercase italic tracking-tight text-primary">
                {selectedClient.firstName} {selectedClient.lastName}
              </h3>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!currentSession && (
              <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-2 py-0.5 px-2 text-muted-foreground">
                Awaiting Start
              </Badge>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 rounded-xl font-black uppercase text-[9px] border-2 group hover:text-red-600 hover:border-red-200"
              onClick={cancelActiveSession}
            >
              <Trash2 className="w-3 h-3 mr-1.5 group-hover:animate-pulse" /> {currentSession ? 'Cancel Session' : 'Change Client'}
            </Button>
          </div>
        </div>
      )}
      {/* Machine Performance Entry Dialog */}
      {editingWeightMachineId && currentSession && (
        <PerformanceEntryDialog 
          machine={machines.find(m => m.id === editingWeightMachineId)!}
          currentWeight={logs[`${currentSession.id}_${editingWeightMachineId}`]?.weight || '0'}
          currentNextWeight={logs[`${currentSession.id}_${editingWeightMachineId}`]?.targetWeight || ''}
          currentReps={logs[`${currentSession.id}_${editingWeightMachineId}`]?.isStaticHold ? (logs[`${currentSession.id}_${editingWeightMachineId}`]?.seconds || '0') : (logs[`${currentSession.id}_${editingWeightMachineId}`]?.reps || '0')}
          isStaticHold={logs[`${currentSession.id}_${editingWeightMachineId}`]?.isStaticHold}
          onClose={() => setEditingWeightMachineId(null)}
          onSave={async (weight, target, repsOrSeconds) => {
            const isHold = logs[`${currentSession.id}_${editingWeightMachineId}`]?.isStaticHold;
            await updateLog(currentSession.id!, editingWeightMachineId, 'weight', weight);
            await updateLog(currentSession.id!, editingWeightMachineId, 'targetWeight', target);
            if (isHold) {
              await updateLog(currentSession.id!, editingWeightMachineId, 'seconds', repsOrSeconds);
              await updateLog(currentSession.id!, editingWeightMachineId, 'reps', '0');
            } else {
              await updateLog(currentSession.id!, editingWeightMachineId, 'reps', repsOrSeconds);
              await updateLog(currentSession.id!, editingWeightMachineId, 'seconds', '0');
            }
            setEditingWeightMachineId(null);
          }}
        />
      )}

      {/* Machine Settings Dialog */}
      {editingSettingsMachineId && (
        <MachineSettingsDialog 
          machine={machines.find(m => m.id === editingSettingsMachineId)!}
          client={selectedClient}
          currentSettings={clientMachineSettings[editingSettingsMachineId]}
          onClose={() => setEditingSettingsMachineId(null)}
          onSave={(settings, reason) => saveMachineSettings(editingSettingsMachineId, settings, reason)}
        />
      )}

      {/* Exercise History Dialog */}
      {historyMachineId && clientId && (
        <ExerciseHistoryDialog
          clientId={clientId}
          machine={machines.find(m => m.id === historyMachineId)!}
          onClose={() => setHistoryMachineId(null)}
        />
      )}

      {/* Machine Details Modal */}
      {showClientPicker && (
        <ClientSelectionDialog 
          clients={clients}
          onSelect={(id) => {
            setSelectedClientId(id);
            setShowClientPicker(false);
            setView('workouts');
          }}
          onClose={() => setShowClientPicker(false)}
        />
      )}

      {/* Client Selection Dialog (for assigning) */}
      <ClientSelectionDialog 
        open={showAssignDialog}
        clients={clients}
        onSelect={assignSessionToClient}
        onClose={() => {
          setShowAssignDialog(false);
          setCurrentSession(null);
        }}
        title="Assign Completed Session"
        description="Choose which client's profile should receive this session's data."
      />

      {/* End Session Confirmation Dialog */}
      <Dialog open={showEndConfirmation} onOpenChange={setShowEndConfirmation}>
        <DialogContent className="sm:max-w-[400px] rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-8 text-white space-y-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-2">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-black italic uppercase tracking-tight">End Session?</h3>
            <p className="text-primary-foreground/90 font-medium text-sm leading-relaxed">
              Are you sure you want to conclude this {currentSession?.sessionType.toLowerCase()} workout session?
            </p>
          </div>
          
          <div className="p-6 space-y-4">
            {currentSession?.isUnassigned ? (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 mb-2">Unassigned Session Actions</p>
                <Button 
                  className="w-full h-14 rounded-2xl font-black italic uppercase tracking-widest text-sm shadow-lg shadow-primary/20"
                  onClick={() => {
                    setShowEndConfirmation(false);
                    setShowAssignDialog(true);
                  }}
                >
                  <Users className="w-4 h-4 mr-3" /> Assign to Client
                </Button>
                <Button 
                  variant="outline"
                  className="w-full h-14 rounded-2xl font-black italic uppercase tracking-widest text-sm border-2"
                  onClick={() => {
                    setShowEndConfirmation(false);
                    setClientFormData({ 
                      firstName: '', lastName: '', gender: 'Male', height: '', weight: '', occupation: '',
                      phone: '', email: '', address: '', emergencyContactName: '', emergencyContactPhone: '',
                      isActive: true, medicalHistory: '', globalNotes: '', remainingSessions: 10, mindbody_name: ''
                    });
                    setPendingAssignSession(currentSession);
                    setIsAddingClient(true);
                    setView('clients');
                  }}
                >
                  <PlusCircle className="w-4 h-4 mr-3" /> Create New Client
                </Button>
                <div className="py-2 flex items-center gap-4">
                  <div className="h-px bg-border flex-1" />
                  <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Danger Zone</span>
                  <div className="h-px bg-border flex-1" />
                </div>
                <Button 
                  variant="ghost"
                  className="w-full h-14 rounded-2xl font-black italic uppercase tracking-widest text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => deleteSession(currentSession!.id!)}
                >
                  <Trash2 className="w-4 h-4 mr-3" /> Delete Session
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="h-14 rounded-2xl font-black uppercase tracking-widest text-xs border-2"
                  onClick={() => setShowEndConfirmation(false)}
                >
                  Keep Training
                </Button>
                <Button 
                  className="h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20"
                  onClick={finalizeEndSession}
                >
                  Confirm End
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Compact Header */}
      <div className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-xl shadow-sm shrink-0 h-[48px]">
        <div className="flex items-center gap-3 pl-2">
          <div 
            className="flex items-baseline gap-2 cursor-pointer hover:opacity-70 transition-opacity group/tracker-name"
            onClick={() => selectedClient && setView('profile')}
          >
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none">ACTIVE CLIENT:</span>
            <h2 className="text-lg sm:text-xl font-black leading-none group-hover/tracker-name:text-[#115E8D] transition-colors uppercase tracking-tighter text-slate-800">
              {clientNameDisplay}
            </h2>
          </div>
          <div className="flex items-baseline gap-2 cursor-pointer hover:opacity-70 transition-opacity pl-2 sm:pl-4 border-l border-slate-200 group/trainer-name">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none">TRAINER:</span>
            <h2 className="text-lg sm:text-xl font-black leading-none group-hover/trainer-name:text-[#115E8D] transition-colors uppercase tracking-tighter text-slate-800">
              {authTrainer?.fullName || currentSession?.trainerInitials || 'SELECT'}
            </h2>
          </div>
          {currentSession?.isUnassigned && (
            <Badge variant="outline" className="text-[8px] font-black py-0 h-4 bg-red-500/10 text-red-600 border-red-500/20 leading-none">OPEN</Badge>
          )}
          {selectedClient?.globalNotes && !currentSession?.isUnassigned && (
             <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[8px] font-black py-0 h-4 animate-pulse leading-none">CAUTION</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {currentSession ? (
            <Button 
              size="sm" 
              className="h-7 px-4 font-black bg-[#F06C22] hover:bg-[#F06C22]/90 text-white rounded-lg uppercase tracking-widest shadow-sm text-[9px]"
              onClick={handleEndSessionPress}
            >
              End Session
            </Button>
          ) : (
             <Button 
               size="sm" 
               className="h-7 px-4 font-black bg-[#F06C22] hover:bg-[#F06C22]/90 text-white rounded-lg uppercase tracking-widest shadow-sm text-[9px]"
               onClick={() => {
                 setIsPreSessionMode(true);
               }}
             >
               Start Session
             </Button>
          )}
          
          <Button 
            size="sm" 
            variant={showAllMachines ? "outline" : "default"} 
            onClick={() => setShowAllMachines(!showAllMachines)} 
            className="h-7 px-3 font-bold text-[9px] rounded-lg uppercase tracking-wider text-slate-600 border-slate-200"
          >
            {!showAllMachines ? "View Full Floor" : "Focus Routine"}
          </Button>
          {currentSession && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setIsShowingSessionNotes(true)} 
              className="h-7 px-3 gap-1.5 font-bold text-[9px] rounded-lg uppercase tracking-wider bg-[#115E8D]/5 border-[#115E8D]/20 text-[#115E8D]"
            >
              <MessageSquare className="w-3 h-3" />
              Notes
            </Button>
          )}
        </div>
      </div>

      {/* Workout Table Scroll Area */}
      <div className="flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
        <div className="w-full h-full overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse table-fixed select-none min-w-[600px] h-full flex flex-col">
            <thead className="flex w-full shrink-0">
              <tr className="bg-[#115E8D] text-white uppercase text-[9px] font-black tracking-widest leading-none h-[28px] w-full flex">
                <th className="p-1.5 text-center w-[40px] shrink-0 border-r border-[#115E8D]/20">#</th>
                <th className="p-1.5 pl-3 flex-1 border-r border-[#115E8D]/20 truncate">Exercise & Settings</th>
                <th className="p-1.5 text-center w-[50px] shrink-0 border-r border-[#115E8D]/20">Prev</th>
                <th className="p-1.5 text-center w-[60px] shrink-0 border-r border-[#115E8D]/20">Weight</th>
                <th className="p-1.5 text-center w-[60px] shrink-0 border-r border-[#115E8D]/20">Reps</th>
                <th className="p-1.5 text-center w-[60px] shrink-0">Quality</th>
              </tr>
            </thead>

            <tbody className="flex-1 overflow-y-auto block w-full text-[#115E8D]">
              {(() => {
                let activeFocusMachineId: string | null = null;
                if (currentSession) {
                  for (const mId of activeMachineIds) {
                    const log = logs[`${currentSession.id}_${mId}`];
                    // We consider it incomplete if weight is empty OR (reps and seconds are both empty) OR quality rating is missing
                    if (!log || !log.weight || (!log.reps && !log.seconds) || !log.repQuality) {
                      activeFocusMachineId = mId;
                      break;
                    }
                  }
                }

                return (
                  <>
                    {currentSession?.routineId && activeMachineIds.length === 0 && (
                      <tr className="flex">
                         <td colSpan={6} className="p-4 text-center w-full">
                           <p className="text-[10px] text-slate-400 font-bold uppercase">Routine blank. Start selecting machines.</p>
                         </td>
                      </tr>
                    )}
                    {machines
                      .sort((a, b) => {
                        if (!showAllMachines) {
                          const routine = routines.find(r => r.id === currentSession?.routineId);
                          if (routine) {
                            const idxA = activeMachineIds.indexOf(a.id!);
                            const idxB = activeMachineIds.indexOf(b.id!);
                            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                            if (idxA !== -1) return -1;
                            if (idxB !== -1) return 1;
                          }
                        }
                        return a.order - b.order;
                      })
                      .map((machine, index) => {
                        const currentLog = currentSession ? logs[`${currentSession.id}_${machine.id}`] || {} : {};
                        const isActive = activeMachineIds.includes(machine.id!);
                        const seqPosition = isActive ? activeMachineIds.indexOf(machine.id!) + 1 : null;
                        const historySessions = currentSession ? sessions.slice(1, 2) : sessions.slice(0, 1);
                        const prevSession = historySessions[0];
                        const prevLog = prevSession ? logs[`${prevSession.id}_${machine.id}`] : null;
                        const isFocusMachine = activeFocusMachineId === machine.id;

                        // Parse Settings
                        const settingsStr = clientMachineSettings[machine.id!]?.settings;
                        let settingsDisplay;
                        if (!settingsStr || Object.keys(settingsStr).length === 0) {
                          settingsDisplay = <span className="text-[#68717A]/60 italic font-medium">NO SETTINGS</span>;
                        } else {
                          const orderedKeys = ['gap', 'seat', 'back', 'back pad', 'handles', 'handle'];
                          const sortedEntries = Object.entries(settingsStr).sort(([ka], [kb]) => {
                            const a = ka.toLowerCase();
                            const b = kb.toLowerCase();
                            const indexA = orderedKeys.findIndex(k => a.includes(k));
                            const indexB = orderedKeys.findIndex(k => b.includes(k));
                            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                            if (indexA !== -1) return -1;
                            if (indexB !== -1) return 1;
                            return a.localeCompare(b);
                          });
                          
                          settingsDisplay = (
                            <div className="flex gap-1.5 items-center">
                              {sortedEntries.map(([k, v], i) => (
                                <span key={k} className="flex gap-0.5 items-baseline">
                                  <span className="text-[#68717A] text-[7.5px] font-medium">{k}:</span>
                                  <span className="font-black text-slate-800 text-[8.5px]">{v}</span>
                                  {i < sortedEntries.length - 1 && <span className="text-slate-300 ml-0.5 text-[7px]">•</span>}
                                </span>
                              ))}
                            </div>
                          );
                        }

                        return (
                          <tr 
                            key={machine.id} 
                            className={`flex w-full group transition-colors h-[34px] sm:h-[36px] items-center border-b border-slate-100 last:border-b-0 border-l-[3px]
                              ${(!isActive && !showAllMachines) ? 'opacity-30 grayscale hover:grayscale-0' : ''}
                              ${isFocusMachine ? 'bg-[#F06C22]/[0.05] border-l-[#F06C22]' : isActive ? 'bg-[#115E8D]/[0.02] border-l-transparent' : 'even:bg-slate-50 odd:bg-white border-l-transparent'} 
                              hover:bg-[#115E8D]/5`}
                          >
                            <td className="w-[40px] shrink-0 flex items-center justify-center p-0 border-r border-slate-200/60 h-full">
                              <button
                                className={`flex items-center justify-center transition-all rounded-full ${isFocusMachine ? 'w-5 h-5 bg-[#F06C22] text-white shadow-sm' : isActive ? 'w-5 h-5 bg-[#115E8D] text-white shadow-sm opacity-80' : 'w-4 h-4 border border-slate-300 text-slate-300 hover:text-[#115E8D] hover:border-[#115E8D]'}`}
                                onClick={() => toggleMachine(machine.id!)}
                              >
                                {isActive ? (
                                  <span className="font-black text-[9px] leading-none text-white">{seqPosition}</span>
                                ) : (
                                  <Plus className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </td>
                            
                            <td className="flex-1 p-1 pl-3 border-r border-slate-200/60 h-full flex flex-col justify-center min-w-0 truncate">
                              <div className="flex items-center">
                                <span className={`font-bold text-[11px] ${isFocusMachine ? 'text-[#115E8D]' : 'text-[#115E8D]'} leading-none truncate`}>{machine.name}</span>
                              </div>
                              <div 
                                onClick={() => setEditingSettingsMachineId(machine.id!)}
                                className="tracking-widest leading-none uppercase truncate mt-[2px] cursor-pointer hover:opacity-80"
                              >
                                {settingsDisplay}
                              </div>
                            </td>

                            <td className="w-[50px] shrink-0 flex flex-col items-center justify-center p-0 border-r border-slate-200/60 h-full">
                              {prevLog && prevLog.weight ? (
                                 <div className="flex flex-col items-center leading-none">
                                    <span className="font-black text-[11px] text-slate-800">{prevLog.weight}</span>
                                    <span className="font-extrabold text-[8px] text-slate-500 mt-[1px]">
                                      {prevLog.isStaticHold ? `${prevLog.seconds}s` : `${prevLog.reps}R`}
                                    </span>
                                 </div>
                              ) : (
                                 <span className="text-[9px] text-slate-300 font-medium">--</span>
                              )}
                            </td>

                            <td className={`w-[60px] shrink-0 cursor-pointer group/weight p-0 border-r border-slate-200/60 h-full flex items-center justify-center transition-colors ${isFocusMachine ? 'bg-white shadow-[inset_0px_2px_4px_rgba(0,0,0,0.04)] ring-1 ring-inset ring-slate-200/50' : 'bg-slate-50/50 hover:bg-[#115E8D]/10'}`} onClick={() => setEditingWeightMachineId(machine.id!)}>
                              {currentLog.weight ? (
                                <span className="font-black text-[13px] text-[#115E8D]">{currentLog.weight}</span>
                              ) : (
                                <span className={`font-black text-[11px] ${isFocusMachine ? 'text-slate-400' : 'text-slate-300 group-hover/weight:text-[#115E8D]/50'}`}>--</span>
                              )}
                            </td>

                            <td className={`w-[60px] shrink-0 cursor-pointer group/reps p-0 border-r border-slate-200/60 h-full flex items-center justify-center transition-colors relative ${isFocusMachine ? 'bg-white shadow-[inset_0px_2px_4px_rgba(0,0,0,0.04)] ring-1 ring-inset ring-slate-200/50' : 'bg-slate-50/50 hover:bg-[#115E8D]/10'}`} onClick={() => setEditingWeightMachineId(machine.id!)}>
                              {currentLog.isStaticHold || currentLog.reps ? (
                                 <span className="font-black text-[13px] text-[#115E8D]">{currentLog.isStaticHold ? currentLog.seconds : currentLog.reps}</span>
                              ) : (
                                 <span className={`font-black text-[11px] ${isFocusMachine ? 'text-slate-400' : 'text-slate-300 group-hover/reps:text-[#115E8D]/50'}`}>--</span>
                              )}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (currentSession?.id) {
                                    updateLog(currentSession.id, machine.id!, 'isStaticHold', !currentLog.isStaticHold);
                                  }
                                }}
                                className={`absolute bottom-[2px] right-[2px] p-[2px] rounded transition-colors ${currentLog.isStaticHold ? 'text-[#F06C22]' : 'text-slate-300 hover:text-slate-400'}`}
                              >
                                <Timer className="w-[8px] h-[8px]" />
                              </button>
                            </td>

                            <td className={`w-[60px] shrink-0 px-1 flex items-center justify-center h-full transition-colors ${isFocusMachine ? 'bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]' : 'group-hover:bg-[#115E8D]/5'}`}>
                              <div className={`flex rounded-full p-[2px] gap-[2px] ${isFocusMachine ? 'bg-slate-100/80 border border-slate-200' : 'bg-slate-200/50'}`}>
                                {[1, 2, 3].map((v) => {
                                   const isSelected = currentLog.repQuality === v;
                                   let bgClass = isFocusMachine ? 'bg-slate-300 hover:bg-[#115E8D]/20' : 'bg-slate-300/50 hover:bg-slate-400';
                                   if (isSelected) {
                                     if (v === 1) bgClass = 'bg-red-500 shadow-sm';
                                     else if (v === 2) bgClass = 'bg-amber-500 shadow-sm';
                                     else if (v === 3) bgClass = 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]';
                                   }
                                   return (
                                     <button
                                       key={v}
                                       onClick={() => {
                                         if (currentSession?.id) {
                                           updateLog(currentSession.id, machine.id!, 'repQuality', v);
                                         }
                                       }}
                                       className={`w-[14px] h-[14px] rounded-full transition-all ${bgClass}`}
                                     />
                                   );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {isShowingSessionNotes && currentSession && (
        <SessionNotesDetailDialog 
          session={currentSession}
          userTrainers={trainers}
          onClose={() => setIsShowingSessionNotes(false)}
        />
      )}

      {/* Footer Info */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 rounded-xl shrink-0">
        <div className="flex gap-4 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
          <div className="flex items-center gap-1">
            <UserCircle className="w-3 h-3" />
            <span>Trainer: {currentSession?.trainerInitials}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Started: {currentSession?.date}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-black text-primary">
          <ShieldCheck className="w-3 h-3" />
          <span>Session Logged for Attendance</span>
        </div>
      </div>
    </motion.div>
  );
}
