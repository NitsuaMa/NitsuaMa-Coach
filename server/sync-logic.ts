import { initializeApp as initializeClientApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import ical from 'node-ical';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Load config for database ID and project ID
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Client SDK
const clientApp = initializeClientApp(config);
const db = getFirestore(clientApp, config.firestoreDatabaseId);

const SYNC_SECRET = 'STABLE_MASTER_SYNC_TOKEN_2026';

const normalizeName = (name: string): string => {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

const extractClientName = (summary: string, description: string) => {
  const patterns = [
    /Client:\s*([^(\r\n]+)/i,
    /\(([^)]+)\)/,
    /^([^(:|\n]+)[:|-]/,
    /for\s+([^(\r\n]+)/i,
  ];
  const fullText = `${summary}\n${description}`;
  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length > 2 && !name.toLowerCase().includes('training') && !name.toLowerCase().includes('workout')) {
        return name;
      }
    }
  }
  return summary.replace(/Personal Training|Workout|Session/gi, '').trim();
};

export async function masterSync(targetTrainerId?: string, hardReset: boolean = false) {
  const syncId = Math.random().toString(36).substring(7);
  console.log(`[Sync-${syncId}] Starting Master Schedule Sync using Client SDK...`);

  try {
    console.log(`[Sync-${syncId}] Fetching trainers...`);
    const trainersSnap = await getDocs(collection(db, 'trainers'));
    let trainers = trainersSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(t => t.mindbody_ical_url);

    if (targetTrainerId) {
      trainers = trainers.filter(t => t.id === targetTrainerId);
    }

    if (trainers.length === 0) {
      console.log(`[Sync-${syncId}] No trainers found with iCal URLs.`);
      return;
    }

    if (hardReset) {
      console.log(`[Sync-${syncId}] Performing hard reset (purging all scheduled entries)...`);
      const allScheduled = await getDocs(query(collection(db, 'schedules'), where('status', '==', 'Scheduled')));
      const deletePromises = allScheduled.docs.map(d => deleteDoc(doc(db, 'schedules', d.id)));
      await Promise.all(deletePromises);
    }

    console.log(`[Sync-${syncId}] Found ${trainers.length} trainers with MindBody feeds.`);

    console.log(`[Sync-${syncId}] Loading client mapping...`);
    const clientsSnap = await getDocs(collection(db, 'clients'));
    const clientMap: Record<string, string> = {};
    clientsSnap.forEach(d => {
      const data = d.data();
      clientMap[normalizeName(`${data.firstName} ${data.lastName}`)] = d.id;
    });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const trainer of trainers) {
      console.log(`[Sync-${syncId}] Syncing trainer: ${trainer.fullName}`);
      try {
        const response = await axios.get(trainer.mindbody_ical_url);
        const icalData = ical.parseICS(response.data);
        
        const sessionUidsInFetch = new Set<string>();
        const vevents = Object.values(icalData).filter(ev => ev.type === 'VEVENT');

        // QUOTA OPTIMIZATION: Fetch all existing schedules for this trainer in one go
        console.log(`[Sync-${syncId}] Fetching existing records for ${trainer.fullName}...`);
        const qWindow = query(
          collection(db, 'schedules'),
          where('trainerId', '==', trainer.id),
          where('startTime', '>=', Timestamp.fromDate(thirtyDaysAgo)),
          where('startTime', '<=', Timestamp.fromDate(thirtyDaysAhead))
        );
        const windowSnap = await getDocs(qWindow);
        
        // Build a map of existing schedules by UID for O(1) lookup
        const existingSchedulesMap: Record<string, { id: string, data: any }> = {};
        windowSnap.forEach(d => {
          const data = d.data();
          if (data.ical_uid) {
            existingSchedulesMap[data.ical_uid] = { id: d.id, data };
          }
        });

        for (const ev of vevents as any[]) {
          const uid = ev.uid;
          if (!uid || !ev.start || !ev.end) continue;
          sessionUidsInFetch.add(uid);

          const summary = typeof ev.summary === 'object' ? (ev.summary as any).val : (ev.summary || '');
          const description = typeof ev.description === 'object' ? (ev.description as any).val : (ev.description || '');
          const clientName = extractClientName(summary, description);
          const clientId = clientMap[normalizeName(clientName)] || null;
          const serviceName = summary.includes('(') ? summary.split('(')[0].trim() : (ev.location || 'Training Session');

          try {
            const existingRecord = existingSchedulesMap[uid];

            const docData = {
              clientName,
              clientId,
              trainerName: trainer.fullName,
              trainerId: trainer.id,
              startTime: Timestamp.fromDate(new Date(ev.start)),
              endTime: Timestamp.fromDate(new Date(ev.end)),
              status: 'Scheduled' as const,
              serviceName,
              source: 'Subscription' as const,
              ical_uid: uid,
              updatedAt: serverTimestamp(),
              sync_secret: SYNC_SECRET
            };

            if (!existingRecord) {
              await addDoc(collection(db, 'schedules'), {
                ...docData,
                createdAt: serverTimestamp()
              });
            } else {
              const currentStatus = existingRecord.data.status;
              if (currentStatus === 'Scheduled') {
                await updateDoc(doc(db, 'schedules', existingRecord.id), docData);
              }
            }
          } catch (itemErr: any) {
             console.error(`[Sync-${syncId}] Item error (${uid}): ${itemErr.message}`);
          }
        }

        // Cleanup Logic using the map we already built
        for (const uid in existingSchedulesMap) {
          if (!sessionUidsInFetch.has(uid)) {
            const record = existingSchedulesMap[uid];
            if (record.data.status === 'Scheduled') {
              await updateDoc(doc(db, 'schedules', record.id), {
                status: 'Cancelled',
                updatedAt: serverTimestamp(),
                cancellationReason: 'Session removed from MindBody feed',
                sync_secret: SYNC_SECRET
              });
            }
          }
        }
      } catch (innerErr: any) {
        console.error(`[Sync-${syncId}] Error processing ${trainer.fullName}:`, innerErr.message);
      }
    }
    console.log(`[Sync-${syncId}] Finalized.`);
  } catch (err: any) {
    console.error(`[Sync-${syncId}] Sync operation FAILED:`, err.message);
    throw err;
  }
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  masterSync();
}
