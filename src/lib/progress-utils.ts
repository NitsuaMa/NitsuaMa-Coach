import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { ExerciseLog, WorkoutSession } from '../types';

/**
 * Calculates the delta for highlighted movements.
 * Takes 3 machine IDs and finds the first and last recorded weights.
 */
export async function calculateHighlightedMovements(clientId: string, machineIds: string[]) {
  const highlightedMovements = [];

  for (const machineId of machineIds) {
    // Get Machine Info
    const machineSnapshot = await getDocs(query(collection(db, 'machines'), where('__name__', '==', machineId)));
    const machineData = machineSnapshot.docs[0]?.data();
    const machineName = machineData?.fullName || machineData?.name || 'Unknown Machine';

    // Get First Log
    const firstLogQuery = query(
      collection(db, 'exerciseLogs'),
      where('clientId', '==', clientId),
      where('machineId', '==', machineId),
      orderBy('createdAt', 'asc'),
      limit(1)
    );
    const firstLogSnap = await getDocs(firstLogQuery);
    const firstWeight = parseFloat(firstLogSnap.docs[0]?.data()?.weight || '0');

    // Get Recent Log
    const recentLogQuery = query(
      collection(db, 'exerciseLogs'),
      where('clientId', '==', clientId),
      where('machineId', '==', machineId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const recentLogSnap = await getDocs(recentLogQuery);
    const recentData = recentLogSnap.docs[0]?.data();
    const currentWeight = parseFloat(recentData?.weight || '0');
    const isStaticHold = recentData?.isStaticHold;
    const currentReps = isStaticHold ? parseFloat(recentData?.seconds || '0') : parseFloat(recentData?.reps || '0');
    const currentQuality = recentData?.quality || 'N/A';

    highlightedMovements.push({
      machineId,
      machineName,
      startingWeight: firstWeight,
      currentWeight: currentWeight,
      currentReps: currentReps,
      isStaticHold: isStaticHold,
      currentQuality: currentQuality,
      change: currentWeight - firstWeight
    });
  }

  return highlightedMovements;
}

/**
 * Calculates detailed attendance stats.
 * Target: 24 sessions (standard) or 12 sessions.
 * Punctuality: Relative to :00 and :30 marks.
 * Duration: Average session length.
 */
export async function calculateAttendanceStats(clientId: string) {
  const sessionsQuery = query(
    collection(db, 'sessions'),
    where('clientId', '==', clientId),
    where('status', '==', 'Completed'),
    orderBy('startTime', 'desc')
  );
  
  const sessionsSnap = await getDocs(sessionsQuery);
  const totalCompleted = sessionsSnap.size;

  let totalDuration = 0;
  let durationCount = 0;
  let punctualityOffsets: number[] = []; // minutes from nearest 30-min mark

  sessionsSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.startTime && data.endTime) {
      const start = data.startTime.toDate();
      const end = data.endTime.toDate();
      const duration = (end.getTime() - start.getTime()) / (1000 * 60);
      if (duration > 5 && duration < 120) {
        totalDuration += duration;
        durationCount++;
      }

      // Punctuality logic
      const mins = start.getMinutes();
      const secs = start.getSeconds();
      const totalMins = mins + secs / 60;
      
      // Nearest 30-min mark is 0, 30, or 60
      let offset = 0;
      if (totalMins <= 15) offset = totalMins; // from 0
      else if (totalMins <= 45) offset = totalMins - 30; // from 30
      else offset = totalMins - 60; // from 60

      punctualityOffsets.push(offset);
    }
  });

  const avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;
  
  // Calculate Punctuality Narrative
  let lateCount = 0;
  let earlyCount = 0;
  punctualityOffsets.forEach(off => {
    if (off > 2) lateCount++;
    else if (off < -2) earlyCount++;
  });

  let punctualityNarrative = "Always exactly on time.";
  if (lateCount > sessionsSnap.size * 0.3) punctualityNarrative = "Frequently arriving a few minutes late.";
  else if (earlyCount > sessionsSnap.size * 0.3) punctualityNarrative = "Consistency arriving early and starting ahead of schedule.";
  else if (lateCount > 0 || earlyCount > 0) punctualityNarrative = "Generally punctual with minor variations.";

  // Attendance Score (relative to 24 sessions)
  const attendanceScore = Math.min(100, Math.round((totalCompleted / 24) * 100));

  return {
    totalSessionsCompleted: totalCompleted,
    attendanceScore,
    avgDuration,
    punctualityNarrative,
    lateCount,
    earlyCount
  };
}
