// Frontend Time Block Utilities
// Compatible with backend time block system

export interface TimeBlock {
  id: number;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
}

export interface TimeRange {
  start: string;
  end: string;
}

export interface TimeBlockConflict {
  hasConflict: boolean;
  overlappingBlocks: number[];
  conflictDuration: number; // in minutes
}

// Constants matching backend
export const TIME_BLOCK_START_HOUR = 7;
export const TIME_BLOCK_START_MINUTE = 30;
export const TIME_BLOCK_DURATION = 30; // minutes
export const TIME_BLOCK_END_HOUR = 21;
export const TIME_BLOCK_END_MINUTE = 0;

// Generate all time blocks for a day
export function generateTimeBlocks(): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  let blockId = 0;
  
  // Start at 7:30 AM
  let currentMinutes = TIME_BLOCK_START_HOUR * 60 + TIME_BLOCK_START_MINUTE;
  const endMinutes = TIME_BLOCK_END_HOUR * 60 + TIME_BLOCK_END_MINUTE;
  
  while (currentMinutes < endMinutes) {
    const startMinutes = currentMinutes;
    const blockEndMinutes = Math.min(currentMinutes + TIME_BLOCK_DURATION, endMinutes);
    
    blocks.push({
      id: blockId++,
      startTime: minutesToTimeString(startMinutes),
      endTime: minutesToTimeString(blockEndMinutes),
      startMinutes,
      endMinutes: blockEndMinutes
    });
    
    currentMinutes += TIME_BLOCK_DURATION;
  }
  
  return blocks;
}

// Convert time string to minutes since midnight
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

// Convert minutes since midnight to time string
export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Convert time string to block number
export function timeToBlock(timeStr: string): number {
  const minutes = timeToMinutes(timeStr);
  const startMinutes = TIME_BLOCK_START_HOUR * 60 + TIME_BLOCK_START_MINUTE;
  
  if (minutes < startMinutes) {
    return -1; // Before first block
  }
  
  const blockIndex = Math.floor((minutes - startMinutes) / TIME_BLOCK_DURATION);
  const maxBlockIndex = Math.floor(
    ((TIME_BLOCK_END_HOUR * 60 + TIME_BLOCK_END_MINUTE) - startMinutes) / TIME_BLOCK_DURATION
  ) - 1;
  
  return Math.min(blockIndex, maxBlockIndex);
}

// Convert block number to time range
export function blockToTimeRange(blockId: number): TimeRange | null {
  const blocks = generateTimeBlocks();
  const block = blocks.find(b => b.id === blockId);
  
  if (!block) return null;
  
  return {
    start: block.startTime,
    end: block.endTime
  };
}

// Get blocks covered by a time range
export function getBlocksForTimeRange(startTime: string, endTime: string): number[] {
  const startBlock = timeToBlock(startTime);
  const endBlock = timeToBlock(endTime);
  
  if (startBlock === -1 || endBlock === -1) {
    return [];
  }
  
  const blocks: number[] = [];
  for (let i = startBlock; i <= endBlock; i++) {
    blocks.push(i);
  }
  
  return blocks;
}

// Check if two time ranges overlap using blocks
export function hasTimeBlockOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): TimeBlockConflict {
  const blocks1 = getBlocksForTimeRange(start1, end1);
  const blocks2 = getBlocksForTimeRange(start2, end2);
  
  const overlappingBlocks = blocks1.filter(block => blocks2.includes(block));
  const hasConflict = overlappingBlocks.length > 0;
  
  // Calculate conflict duration in minutes
  let conflictDuration = 0;
  if (hasConflict) {
    conflictDuration = overlappingBlocks.length * TIME_BLOCK_DURATION;
  }
  
  return {
    hasConflict,
    overlappingBlocks,
    conflictDuration
  };
}

// Handle edge cases - exact boundaries
export function hasExactBoundaryOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  return end1 === start2 || end2 === start1;
}

// Optimized conflict detection for multiple ranges
export function findConflictsInRange(
  targetRange: TimeRange,
  existingRanges: TimeRange[]
): Array<{ range: TimeRange; conflict: TimeBlockConflict }> {
  const conflicts: Array<{ range: TimeRange; conflict: TimeBlockConflict }> = [];
  
  for (const range of existingRanges) {
    const conflict = hasTimeBlockOverlap(
      targetRange.start,
      targetRange.end,
      range.start,
      range.end
    );
    
    if (conflict.hasConflict) {
      conflicts.push({ range, conflict });
    }
  }
  
  return conflicts;
}

// Performance optimization - cache time blocks
let cachedTimeBlocks: TimeBlock[] | null = null;

export function getTimeBlocks(): TimeBlock[] {
  if (!cachedTimeBlocks) {
    cachedTimeBlocks = generateTimeBlocks();
  }
  return cachedTimeBlocks;
}

// Validate time string format
export function isValidTimeString(timeStr: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeStr);
}

// Check if time is within operational hours
export function isWithinOperationalHours(timeStr: string): boolean {
  const minutes = timeToMinutes(timeStr);
  const startMinutes = TIME_BLOCK_START_HOUR * 60 + TIME_BLOCK_START_MINUTE;
  const endMinutes = TIME_BLOCK_END_HOUR * 60 + TIME_BLOCK_END_MINUTE;
  
  return minutes >= startMinutes && minutes <= endMinutes;
}

// Get next available time slot
export function getNextAvailableTime(currentTime: string, duration: number): string | null {
  const currentMinutes = timeToMinutes(currentTime);
  const endMinutes = TIME_BLOCK_END_HOUR * 60 + TIME_BLOCK_END_MINUTE;
  
  const proposedEnd = currentMinutes + duration;
  
  if (proposedEnd > endMinutes) {
    return null; // Cannot fit before end of day
  }
  
  return minutesToTimeString(currentMinutes + duration);
}

// Calculate total duration in blocks
export function calculateDurationInBlocks(startTime: string, endTime: string): number {
  const blocks = getBlocksForTimeRange(startTime, endTime);
  return blocks.length;
}

// Format duration for display
export function formatDuration(startTime: string, endTime: string): string {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const duration = endMinutes - startMinutes;
  
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

// Get time block statistics
export function getTimeBlockStats(timeRange: TimeRange): {
  totalBlocks: number;
  duration: number;
  blocksCovered: number[];
  isPartialBlock: boolean;
} {
  const blocks = getBlocksForTimeRange(timeRange.start, timeRange.end);
  const duration = timeToMinutes(timeRange.end) - timeToMinutes(timeRange.start);
  
  // Check if this is a partial block (not aligned to 30-minute boundaries)
  const startBlock = timeToBlock(timeRange.start);
  const endBlock = timeToBlock(timeRange.end);
  const expectedDuration = (endBlock - startBlock + 1) * TIME_BLOCK_DURATION;
  const isPartialBlock = duration !== expectedDuration;
  
  return {
    totalBlocks: getTimeBlocks().length,
    duration,
    blocksCovered: blocks,
    isPartialBlock
  };
}
