import cron from 'node-cron';
import prisma from '../prisma.js';
import { isDayMatching, triggerCurfewSweep } from './curfewService.js';

let curfewCronJob = null;

/**
 * Initializes and starts the background Curfew Scheduler.
 * Runs once every minute (* * * * *) to evaluate whether any active curfew windows
 * have reached their start_time and triggers Job A (curfew-start sweep).
 * @param {object} io Socket.IO server instance
 */
export function startCurfewScheduler(io) {
  if (curfewCronJob) {
    console.log('[CurfewScheduler] Curfew scheduler already active.');
    return;
  }

  curfewCronJob = cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const currentH = String(now.getHours()).padStart(2, '0');
      const currentM = String(now.getMinutes()).padStart(2, '0');
      const currentHHMM = `${currentH}:${currentM}`;

      // Fetch all active curfew windows
      const activeWindows = await prisma.curfewWindow.findMany({
        where: { is_active: true },
      });

      if (activeWindows.length === 0) return;

      // Group active windows by hostel (or campus default)
      const hostelSpecificWindows = activeWindows.filter((w) => w.hostel_id !== null);
      const campusDefaultWindows = activeWindows.filter((w) => w.hostel_id === null);

      const hostelsWithSpecificWindows = new Set(
        hostelSpecificWindows.map((w) => w.hostel_id)
      );

      // Check hostel-specific windows
      for (const win of hostelSpecificWindows) {
        const winStart = win.start_time.slice(0, 5);
        if (winStart === currentHHMM && isDayMatching(win.day_type, now)) {
          console.log(`[CurfewScheduler] Triggering curfew sweep for hostel ${win.hostel_id} at ${currentHHMM}`);
          await triggerCurfewSweep({
            hostelId: win.hostel_id,
            window: win,
            io,
            skipDelay: false,
          });
        }
      }

      // Check campus-default windows for hostels without specific windows
      if (campusDefaultWindows.length > 0) {
        for (const defaultWin of campusDefaultWindows) {
          const winStart = defaultWin.start_time.slice(0, 5);
          if (winStart === currentHHMM && isDayMatching(defaultWin.day_type, now)) {
            // Find all hostels without specific windows
            const allHostels = await prisma.hostel.findMany({
              select: { id: true, name: true },
            });
            const fallbackHostels = allHostels.filter(
              (h) => !hostelsWithSpecificWindows.has(h.id)
            );

            for (const h of fallbackHostels) {
              console.log(`[CurfewScheduler] Triggering campus-default curfew sweep for hostel ${h.name} (${h.id}) at ${currentHHMM}`);
              await triggerCurfewSweep({
                hostelId: h.id,
                window: defaultWin,
                io,
                skipDelay: false,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[CurfewScheduler] Error in curfew scheduler tick:', err);
    }
  });

  console.log('🌙 Continuous Curfew Scheduler initialized (runs every 60s)');
}

/**
 * Stops the curfew scheduler if running.
 */
export function stopCurfewScheduler() {
  if (curfewCronJob) {
    curfewCronJob.stop();
    curfewCronJob = null;
    console.log('[CurfewScheduler] Curfew scheduler stopped.');
  }
}
