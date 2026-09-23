import cron from 'node-cron';
import { sweepExpiredTokens } from './qrTokenService.js';

let sweeperJob = null;

/**
 * Initializes and starts the background QR token expiration sweeper.
 * Runs once every 60 seconds to bulk-transition UNUSED expired tokens to EXPIRED.
 */
export function startTokenSweeper() {
  if (sweeperJob) {
    console.log('[Sweeper] Token sweeper already active.');
    return;
  }

  // Run every minute (every 60 seconds)
  sweeperJob = cron.schedule('* * * * *', async () => {
    try {
      const count = await sweepExpiredTokens();
      if (count > 0) {
        console.log(`[Sweeper] Cleaned up ${count} expired QR token(s) at ${new Date().toISOString()}`);
      }
    } catch (err) {
      console.error('[Sweeper] Error sweeping expired QR tokens:', err);
    }
  });

  console.log('⏰ QR Token background sweeper scheduled (every 60 seconds)');
}

/**
 * Stops the background sweeper if running (useful during tests or shutdown).
 */
export function stopTokenSweeper() {
  if (sweeperJob) {
    sweeperJob.stop();
    sweeperJob = null;
    console.log('[Sweeper] Token sweeper stopped.');
  }
}
