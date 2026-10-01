import { ValidationError } from '../services/domainError';
import { manilaMinutes } from './manilaTime';
// ====================================================
// TIME BLOCK CALCULATION UTILITIES
// ====================================================

export const MINUTES_PER_HOUR = 60;
export const START_TIME_MINUTES = 7 * 60 + 30; // 7:30 AM = 450 minutes

/**
 * Convert time string (HH:MM) to minutes from midnight
 * @param timeString - Time in "HH:MM" format
 * @returns Minutes from midnight (0-1439)
 */
export const timeToMinutes = (timeString: string): number => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
};

/**
 * Convert minutes from midnight to time string (HH:MM)
 * @param minutes - Minutes from midnight
 * @returns Time string in "HH:MM" format
 */
export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const mins = minutes % MINUTES_PER_HOUR;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Convert time range to 30-minute time blocks
 * @param timeStart - Start time in "HH:MM" format
 * @param timeEnd - End time in "HH:MM" format
 * @returns Array of block numbers (0-based from 7:30 AM)
 */
export const getTimeBlocks = (timeStart: string, timeEnd: string): number[] => {
  const startMinutes = timeToMinutes(timeStart);
  const endMinutes = timeToMinutes(timeEnd);

  // Validate time range
  if (startMinutes >= endMinutes) {
    throw new ValidationError('Start time must be before end time');
  }

  // Convert to 30-minute blocks (7:30 AM = block 0)
  const startBlock = Math.floor((startMinutes - START_TIME_MINUTES) / 30);
  const endBlock = Math.ceil((endMinutes - START_TIME_MINUTES) / 30);

  const blocks = [];
  for (let block = startBlock;block < endBlock;block++) {
    if (block >= 0) blocks.push(block); // Only valid blocks
  }

  return blocks;
};

/**
 * Check if two time ranges overlap using 30-minute blocks
 * @param blocksA - Time blocks for first range
 * @param blocksB - Time blocks for second range
 * @returns True if ranges overlap
 */
export const hasTimeConflict = (blocksA: number[], blocksB: number[]): boolean => {
  return blocksA.some(block => blocksB.includes(block));
};

// PUP Lopez Campus operates on Philippine time (Asia/Manila, UTC+8, no DST).
// Stored timestamps are real UTC instants, so a request spanning e.g.
// 7:30 AM-10:00 AM Manila time is persisted as 23:30 (previous UTC day)
// to 02:00 (UTC), crossing a UTC midnight boundary. Extracting the clock
// time via the server's local/UTC time (as `toTimeString()` does) would
// read that as "23:30" to "02:00" - an end time before the start time -
// and crash `getTimeBlocks`. Converting to Manila time first keeps both
// ends on the same conceptual business day.


/**
 * Convert Date object to time string (HH:MM format), expressed in
 * Philippine local time (Asia/Manila, UTC+8) regardless of server timezone.
 * @param date - Date object (an absolute instant, e.g. from Prisma)
 * @returns Time string in "HH:MM" format
 */
export const dateToTimeString = (date: Date): string => {
  return minutesToTime(manilaMinutes(date));
};

/**
 * Convert Date objects to time blocks
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Array of block numbers
 */
export const getDateBlocks = (startDate: Date, endDate: Date): number[] => {
  const startTime = dateToTimeString(startDate);
  const endTime = dateToTimeString(endDate);
  return getTimeBlocks(startTime, endTime);
};

/**
 * Check if two date ranges overlap
 * @param start1 - First range start
 * @param end1 - First range end
 * @param start2 - Second range start
 * @param end2 - Second range end
 * @returns True if ranges overlap
 */
export const hasDateOverlap = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
  return start1 < end2 && end1 > start2;
};

/**
 * Validate time string format
 * @param timeString - Time string to validate
 * @returns True if valid HH:MM format
 */
export const isValidTimeString = (timeString: string): boolean => {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeString);
};

/**
 * Get block start time for a given block number
 * @param block - Block number (0 = 7:30 AM)
 * @returns Time string for block start
 */
export const getBlockStartTime = (block: number): string => {
  const minutes = START_TIME_MINUTES + (block * 30);
  return minutesToTime(minutes);
};

/**
 * Get block end time for a given block number
 * @param block - Block number (0 = 7:30 AM)
 * @returns Time string for block end
 */
export const getBlockEndTime = (block: number): string => {
  const minutes = START_TIME_MINUTES + ((block + 1) * 30);
  return minutesToTime(minutes);
};

/**
 * Get block time range for a given block number
 * @param block - Block number
 * @returns Object with start and end times
 */
export const getBlockTimeRange = (block: number) => {
  return {
    start: getBlockStartTime(block),
    end: getBlockEndTime(block),
    block
  };
};

/**
 * Calculate total minutes for a set of time blocks
 * @param blocks - Array of block numbers
 * @returns Total minutes covered by blocks
 */
export const getBlockDuration = (blocks: number[]): number => {
  return blocks.length * 30; // Each block is 30 minutes
};

/**
 * Check if a time is within business hours (7:30 AM - 9:00 PM)
 * @param timeString - Time in HH:MM format
 * @returns True if within business hours
 */
export const isWithinBusinessHours = (timeString: string): boolean => {
  const minutes = timeToMinutes(timeString);
  return minutes >= START_TIME_MINUTES && minutes <= (21 * 60); // 9:00 PM = 1260 minutes
};

/**
 * Get all blocks for a complete day (7:30 AM - 9:00 PM)
 * @returns Array of all block numbers for the day
 */
export const getDailyBlocks = (): number[] => {
  const blocks = [];
  const totalBlocks = Math.floor((21 * 60 - START_TIME_MINUTES) / 30); // Until 9:00 PM

  for (let block = 0;block < totalBlocks;block++) {
    blocks.push(block);
  }

  return blocks;
};

/**
 * Format block range for display
 * @param blocks - Array of block numbers
 * @returns Formatted string representation
 */
export const formatBlockRange = (blocks: number[]): string => {
  if (blocks.length === 0) return 'No blocks';

  const sortedBlocks = [...blocks].sort((a, b) => a - b);
  const ranges = [];
  let start = sortedBlocks[0];
  let end = start;

  for (let i = 1;i < sortedBlocks.length;i++) {
    if (sortedBlocks[i] === end + 1) {
      end = sortedBlocks[i];
    } else {
      ranges.push({ start, end });
      start = sortedBlocks[i];
      end = start;
    }
  }
  ranges.push({ start, end });

  const formattedRanges = ranges.map(range => {
    if (range.start === range.end) {
      return getBlockStartTime(range.start);
    }
    return `${getBlockStartTime(range.start)} - ${getBlockEndTime(range.end)}`;
  });

  return formattedRanges.join(', ');
};

/**
 * Performance optimization: Cache frequently used calculations
 */
export class TimeBlockCache {
  private cache = new Map<string, number[]>();

  /**
   * Get cached time blocks or calculate and cache them
   * @param timeStart - Start time
   * @param timeEnd - End time
   * @returns Array of block numbers
   */
  getBlocks(timeStart: string, timeEnd: string): number[] {
    const key = `${timeStart}-${timeEnd}`;

    if (!this.cache.has(key)) {
      this.cache.set(key, getTimeBlocks(timeStart, timeEnd));
    }

    return this.cache.get(key)!;
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns Cache size and hit rate info
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton cache instance
export const timeBlockCache = new TimeBlockCache();
