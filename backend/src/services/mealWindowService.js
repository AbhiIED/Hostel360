import prisma from '../prisma.js';

/**
 * 7.1 Meal window resolver service
 * Resolves the currently active meal window and next scheduled window for a mess.
 * @param {string} messId
 * @param {Date} [now]
 * @returns {Promise<{ active: object|null, next: object|null, currentTime: string, allWindows: object[] }>}
 */
export async function resolveMealWindow(messId, now = new Date()) {
  if (!messId) {
    return { active: null, next: null, currentTime: '', allWindows: [] };
  }

  // Format current time as HH:MM in Asia/Kolkata (or configured timezone)
  const timeFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: process.env.TIMEZONE || 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const currentTime = timeFormatter.format(now); // e.g. "13:15"

  const windows = await prisma.mealWindow.findMany({
    where: {
      mess_id: messId,
      is_active: true,
    },
    orderBy: { start_time: 'asc' },
  });

  let activeWindow = null;
  let nextWindow = null;

  for (const win of windows) {
    if (currentTime >= win.start_time && currentTime <= win.end_time) {
      activeWindow = win;
      break;
    }
  }

  if (!activeWindow && windows.length > 0) {
    // Find next upcoming meal today
    for (const win of windows) {
      if (win.start_time > currentTime) {
        nextWindow = win;
        break;
      }
    }
    // If all meals today have passed (late night), next is the first meal tomorrow
    if (!nextWindow) {
      nextWindow = windows[0];
    }
  }

  return {
    active: activeWindow,
    next: nextWindow,
    currentTime,
    allWindows: windows,
  };
}
