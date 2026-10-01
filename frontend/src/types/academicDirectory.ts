export interface DirectorySummary {
  buildings: number;
  rooms: number;
  programs: number;
  subjects: number;
  departments: number;
}

export interface DirectoryBuilding {
  id: string;
  name: string;
  roomCount: number;
}

export interface DirectoryRoom {
  id: string;
  roomNumber: string | null;
  roomName: string | null;
  buildingId: string | null;
  buildingName: string | null;
  isComputerLab: boolean;
}

export interface DirectoryProgram {
  id: string;
  code: string;
  name: string;
}

export interface DirectorySubject {
  id: string;
  code: string;
  name: string;
}

export interface DirectoryDepartment {
  id: string;
  name: string;
}

export interface DirectoryPayload {
  summary: DirectorySummary;
  buildings: DirectoryBuilding[];
  rooms: DirectoryRoom[];
  programs: DirectoryProgram[];
  subjects: DirectorySubject[];
  departments: DirectoryDepartment[];
}
