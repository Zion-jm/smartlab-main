export type ScheduleType = 'ONE_TIME' | 'WEEKLY';

export interface ApiLabSchedule {
  _meta?: LabSchedule['_meta'];
  id: string;
  scheduleType: ScheduleType;
  scheduleDate: string | null;
  timeStart: string;
  timeEnd: string;
  dayOfWeek: number | null;
  yearLevel?: number | null;
  room?: {
    id: string;
    name?: string | null;
    roomNumber?: string | null;
    buildingId?: string | null;
    isComputerLab?: boolean | null;
  } | null;
  faculty?: {
    id: string;
    user?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
  program?: {
    id: string;
    name?: string | null;
    code?: string | null;
  } | null;
  subject?: {
    id: string;
    name?: string | null;
    code?: string | null;
  } | null;
  academicYear?: {
    id: string;
    year?: string;
    isActive?: boolean;
  } | null;
  term?: {
    id: string;
    name?: string;
    isActive?: boolean;
  } | null;
}

export interface LabSchedule {
  id: string;
  scheduleType: ScheduleType;
  date: string | null;
  startTime: string;
  endTime: string;
  displayDate: string;
  displayDay: string;
  dayOfWeekIndex: number | null;
  timeRange: string;
  roomLabel: string;
  isComputerLab: boolean;
  facultyName: string;
  subjectLabel: string;
  programLabel: string;
  yearLevel: number | null;
  academicYearLabel: string | null;
  termLabel: string | null;
  // Extra fields for source detection
  borrowRequest?: {
    id: string;
  };
  _meta?: {
    canChangeScheduleType: boolean;
    isRequestDerived: boolean;
    lockReason: string | null;
  };
}

export type LabScheduleResourceOption = {
  value: string;
  label: string;
  isActive?: boolean;
  isComputerLab?: boolean;
};

export interface LabScheduleResources {
  rooms: LabScheduleResourceOption[];
  programs: LabScheduleResourceOption[];
  subjects: LabScheduleResourceOption[];
  faculty: (LabScheduleResourceOption & { profileId: string })[];
}

export interface AcademicContextSelection {
  academicYearId: string;
  academicYearLabel: string;
  termId: string;
  termLabel: string;
}
