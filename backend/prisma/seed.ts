import { departmentSeeds, programSeeds, buildingNames, roomSeedsByBuilding, noBuildingRoomSeeds, subjectSeeds, equipmentSeeds, type RoomSeed } from './catalogSeedData';
import 'dotenv/config';
import { assertDemoDatabase } from '../src/config/seedSafety';
import { PrismaClient, RequestStatus, ScheduleType, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

assertDemoDatabase(process.env);
const prisma = new PrismaClient();
const REPORT_SEED_TAG = '[seed:reports]';

const facultySeeds = [
  {
    email: 'jane.delacruz@smartlab.local',
    firstName: 'Jane',
    lastName: 'Dela Cruz',
    departmentName: 'Department of Information Technology',
  },
  {
    email: 'marco.reyes@smartlab.local',
    firstName: 'Marco',
    lastName: 'Reyes',
    departmentName: 'Department of Electronics Engineering',
  },
  {
    email: 'luisa.ramos@smartlab.local',
    firstName: 'Luisa',
    lastName: 'Ramos',
    departmentName: 'Department of Applied Sciences',
  },
];

const academicYearSeeds = [
  { year: '2026-2027', isActive: true },
];

const termSeeds = [
  { name: '1st Semester', isActive: true },
  { name: '2nd Semester', isActive: false },
  { name: 'Summer Term', isActive: false },
];

const adminSeed = {
  email: 'admin@smartlab.local',
  firstName: 'System',
  lastName: 'Administrator',
};

const studentSeeds = [
  {
    email: 'paolo.santos@smartlab.local',
    firstName: 'Paolo',
    lastName: 'Santos',
    programCode: 'BSIT',
    yearLevel: 2,
  },
  {
    email: 'mia.verano@smartlab.local',
    firstName: 'Mia',
    lastName: 'Verano',
    programCode: 'BSEE',
    yearLevel: 3,
  },
  {
    email: 'kevin.lim@smartlab.local',
    firstName: 'Kevin',
    lastName: 'Lim',
    programCode: 'BSBIO',
    yearLevel: 1,
  },
];

interface ReportRequestSeed {
  key: string;
  requester: { id: string; email: string };
  faculty: { id: string };
  program: { id: string };
  subject: { id: string };
  room: { id: string };
  date: string;
  start: string;
  end: string;
  yearLevel: number;
  status: RequestStatus;
  purpose: string;
  notes: string;
  items: ReadonlyArray<readonly [string, number]>;
}

interface ScheduleSeed {
  key: string;
  scheduleType: ScheduleType;
  room: { id: string };
  faculty: { id: string };
  program: { id: string };
  subject: { id: string };
  date: string;
  start: string;
  end: string;
  yearLevel: number;
  requestKey: string | null;
}

async function ensureBuilding(name: string) {
  return prisma.building.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

async function ensureRoom(buildingId: string | null, seed: RoomSeed) {
  // Some rooms (e.g. admin offices) have no room number in the source directory —
  // leave roomNumber null rather than substituting the name, since a room is
  // identified by whichever of number/name is available.
  const roomNumber = seed.number ?? null;
  if (!roomNumber && !seed.name) {
    throw new Error(`Room seed is missing both a number and a name (building: ${buildingId ?? 'none'})`);
  }

  const isComputerLab = seed.isComputerLab ?? Boolean(seed.name?.toLowerCase().includes('computer lab'));
  const data = { name: seed.name ?? null, isComputerLab };

  const existing = await prisma.room.findFirst({
    where: roomNumber ? { buildingId, roomNumber } : { buildingId, roomNumber: null, name: seed.name },
  });
  if (existing) {
    await prisma.room.update({ where: { id: existing.id }, data });
  } else {
    await prisma.room.create({ data: { buildingId, roomNumber, ...data } });
  }
}

async function ensureDepartment(name: string) {
  let department = await prisma.department.findFirst({ where: { name } });
  if (!department) {
    department = await prisma.department.create({ data: { name } });
  }
  return department;
}

async function ensureProgram(code: string, name: string) {
  return prisma.program.upsert({
    where: { code },
    update: { name },
    create: { code, name },
  });
}

async function ensureSubject(code: string, name: string) {
  return prisma.subject.upsert({
    where: { code },
    update: { name },
    create: { code, name },
  });
}

async function ensureEquipment(seed: { name: string; description: string; totalQuantity: number }) {
  const existing = await prisma.equipment.findFirst({ where: { name: seed.name } });
  if (existing) {
    await prisma.equipment.update({
      where: { id: existing.id },
      data: { description: seed.description },
    });
    return;
  }

  await prisma.equipment.create({
    data: {
      name: seed.name,
      description: seed.description,
      totalQuantity: seed.totalQuantity,
      availableQuantity: seed.totalQuantity,
    },
  });
}

/**
 * Report fixtures use Philippine local time for clock values, matching the
 * application's schedule storage convention. Calendar dates stay at UTC
 * midnight so the existing day-of-week and date filters remain stable.
 */
function manilaDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00+08:00`);
}

function calendarDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

async function ensureReportFixtures() {
  const [admin, paolo, mia, kevin, janeProfile, marcoProfile, luisaProfile] = await Promise.all([
    prisma.user.findUnique({ where: { email: adminSeed.email } }),
    prisma.user.findUnique({ where: { email: 'paolo.santos@smartlab.local' } }),
    prisma.user.findUnique({ where: { email: 'mia.verano@smartlab.local' } }),
    prisma.user.findUnique({ where: { email: 'kevin.lim@smartlab.local' } }),
    prisma.facultyProfile.findFirst({ where: { user: { email: 'jane.delacruz@smartlab.local' } } }),
    prisma.facultyProfile.findFirst({ where: { user: { email: 'marco.reyes@smartlab.local' } } }),
    prisma.facultyProfile.findFirst({ where: { user: { email: 'luisa.ramos@smartlab.local' } } }),
  ]);

  const [activeAcademicYear, activeTerm, bsit, bsee, bsbio, comp001, comp002, comp006, comp016] =
    await Promise.all([
      prisma.academicYear.findUnique({ where: { year: '2026-2027' } }),
      prisma.term.findUnique({ where: { name: '1st Semester' } }),
      prisma.program.findUnique({ where: { code: 'BSIT' } }),
      prisma.program.findUnique({ where: { code: 'BSEE' } }),
      prisma.program.findUnique({ where: { code: 'BSBIO' } }),
      prisma.subject.findUnique({ where: { code: 'COMP 001' } }),
      prisma.subject.findUnique({ where: { code: 'COMP 002' } }),
      prisma.subject.findUnique({ where: { code: 'COMP 006' } }),
      prisma.subject.findUnique({ where: { code: 'COMP 016' } }),
    ]);

  const [ictLab1, ictLab3, chemistryLab, foodLab] = await Promise.all([
    prisma.room.findFirst({ where: { name: 'ICT Lab 1' } }),
    prisma.room.findFirst({ where: { name: 'ICT Lab 3' } }),
    prisma.room.findFirst({ where: { roomNumber: '206' } }),
    prisma.room.findFirst({ where: { roomNumber: '105' } }),
  ]);

  const equipmentNames = [
    'LCD Projector',
    'HDMI Cable',
    'Laptop Charger (Universal)',
    'Webcam',
    'Wireless Mouse',
    'LAN Cable (Cat6)',
  ];
  const equipmentRecords = await prisma.equipment.findMany({
    where: { name: { in: equipmentNames } },
  });
  const equipmentByName = new Map(equipmentRecords.map((equipment) => [equipment.name, equipment]));

  const requiredRecords = [
    ['admin', admin],
    ['Paolo Santos', paolo],
    ['Mia Verano', mia],
    ['Kevin Lim', kevin],
    ['Jane Dela Cruz profile', janeProfile],
    ['Marco Reyes profile', marcoProfile],
    ['Luisa Ramos profile', luisaProfile],
    ['active academic year', activeAcademicYear],
    ['active term', activeTerm],
    ['BSIT', bsit],
    ['BSEE', bsee],
    ['BSBIO', bsbio],
    ['COMP 001', comp001],
    ['COMP 002', comp002],
    ['COMP 006', comp006],
    ['COMP 016', comp016],
    ['ICT Lab 1', ictLab1],
    ['ICT Lab 3', ictLab3],
    ['Chemistry Lab', chemistryLab],
    ['Food Lab', foodLab],
  ] as const;
  const missingRecord = requiredRecords.find(([, record]) => !record);
  if (missingRecord) {
    throw new Error(`Cannot create report fixtures: missing ${missingRecord[0]} seed record`);
  }

  const reportRequests: ReportRequestSeed[] = [
    {
      key: 'pending-paolo',
      requester: paolo!,
      faculty: janeProfile!,
      program: bsit!,
      subject: comp016!,
      room: ictLab1!,
      date: '2026-09-12',
      start: '08:00',
      end: '10:00',
      yearLevel: 2,
      status: RequestStatus.PENDING,
      purpose: `${REPORT_SEED_TAG} Web development presentation and hands-on lab`,
      notes: 'Pending request for the September report period.',
      items: [
        ['LCD Projector', 1],
        ['HDMI Cable', 1],
        ['Webcam', 1],
      ] as const,
    },
    {
      key: 'approved-mia',
      requester: mia!,
      faculty: marcoProfile!,
      program: bsee!,
      subject: comp002!,
      room: ictLab3!,
      date: '2026-09-10',
      start: '13:00',
      end: '15:00',
      yearLevel: 3,
      status: RequestStatus.APPROVED,
      purpose: `${REPORT_SEED_TAG} Programming laboratory equipment for class demonstration`,
      notes: 'Approved and scheduled for the current semester.',
      items: [
        ['Laptop Charger (Universal)', 3],
        ['Wireless Mouse', 3],
        ['HDMI Cable', 2],
      ] as const,
    },
    {
      key: 'borrowed-kevin',
      requester: kevin!,
      faculty: luisaProfile!,
      program: bsbio!,
      subject: comp001!,
      room: chemistryLab!,
      date: '2026-09-08',
      start: '09:30',
      end: '11:30',
      yearLevel: 1,
      status: RequestStatus.BORROWED,
      purpose: `${REPORT_SEED_TAG} Introductory science lab documentation`,
      notes: 'Equipment is currently borrowed for the active lab session.',
      items: [
        ['Webcam', 2],
        ['LAN Cable (Cat6)', 2],
        ['Wireless Mouse', 2],
      ] as const,
    },
    {
      key: 'returned-paolo',
      requester: paolo!,
      faculty: janeProfile!,
      program: bsit!,
      subject: comp006!,
      room: foodLab!,
      date: '2026-09-03',
      start: '10:00',
      end: '12:00',
      yearLevel: 2,
      status: RequestStatus.RETURNED,
      purpose: `${REPORT_SEED_TAG} Data structures recording and equipment checkout`,
      notes: 'Completed request with all equipment returned.',
      items: [
        ['LCD Projector', 1],
        ['Webcam', 1],
        ['Wireless Mouse', 2],
      ] as const,
    },
    {
      key: 'rejected-mia',
      requester: mia!,
      faculty: marcoProfile!,
      program: bsee!,
      subject: comp002!,
      room: ictLab3!,
      date: '2026-08-28',
      start: '08:00',
      end: '10:00',
      yearLevel: 3,
      status: RequestStatus.REJECTED,
      purpose: `${REPORT_SEED_TAG} Electronics lab presentation request`,
      notes: 'Rejected fixture for checking declined status styling.',
      items: [
        ['LCD Projector', 1],
        ['HDMI Cable', 1],
      ] as const,
    },
    {
      key: 'cancelled-kevin',
      requester: kevin!,
      faculty: luisaProfile!,
      program: bsbio!,
      subject: comp001!,
      room: chemistryLab!,
      date: '2026-08-25',
      start: '14:00',
      end: '16:00',
      yearLevel: 1,
      status: RequestStatus.CANCELLED,
      purpose: `${REPORT_SEED_TAG} Cancelled biology lab equipment request`,
      notes: 'Cancelled fixture for checking report filters and status counts.',
      items: [
        ['Webcam', 1],
        ['LAN Cable (Cat6)', 1],
      ] as const,
    },
  ];

  const additionalRequestStatuses = [
    RequestStatus.PENDING,
    RequestStatus.APPROVED,
    RequestStatus.BORROWED,
    RequestStatus.RETURNED,
    RequestStatus.REJECTED,
    RequestStatus.CANCELLED,
  ];
  const additionalRequestUsers = [paolo!, mia!, kevin!];
  const additionalRequestFaculty = [janeProfile!, marcoProfile!, luisaProfile!];
  const additionalRequestPrograms = [bsit!, bsee!, bsbio!];
  const additionalRequestSubjects = [comp016!, comp002!, comp001!, comp006!];
  const additionalRequestRooms = [ictLab1!, ictLab3!, chemistryLab!, foodLab!];
  const additionalRequestItems = [
    [
      ['LCD Projector', 1],
      ['HDMI Cable', 1],
    ],
    [
      ['Laptop Charger (Universal)', 2],
      ['Wireless Mouse', 2],
    ],
    [
      ['Webcam', 1],
      ['LAN Cable (Cat6)', 2],
    ],
    [
      ['LCD Projector', 1],
      ['Webcam', 1],
      ['Wireless Mouse', 1],
    ],
  ] as const;

  for (let index = 0; index < 20; index += 1) {
    const day = 11 + index;
    const startHour = 8 + (index % 4) * 2;
    const start = `${String(startHour).padStart(2, '0')}:00`;
    const end = `${String(startHour + 2).padStart(2, '0')}:00`;
    const requestNumber = String(index + 1).padStart(2, '0');
    const date = `2026-09-${String(day).padStart(2, '0')}`;
    const requester = additionalRequestUsers[index % additionalRequestUsers.length];
    const status = additionalRequestStatuses[index % additionalRequestStatuses.length];

    reportRequests.push({
      key: `bulk-request-${requestNumber}`,
      requester,
      faculty: additionalRequestFaculty[index % additionalRequestFaculty.length],
      program: additionalRequestPrograms[index % additionalRequestPrograms.length],
      subject: additionalRequestSubjects[index % additionalRequestSubjects.length],
      room: additionalRequestRooms[index % additionalRequestRooms.length],
      date,
      start,
      end,
      yearLevel: (index % 4) + 1,
      status,
      purpose: `${REPORT_SEED_TAG} Additional seeded equipment request ${requestNumber}`,
      notes: `Additional request fixture ${requestNumber} for report and dashboard coverage.`,
      items: additionalRequestItems[index % additionalRequestItems.length],
    });
  }

  const requestByKey = new Map<string, { id: string; dateNeeded: Date; timeStart: Date; timeEnd: Date }>();
  for (const fixture of reportRequests) {
    const dateNeeded = calendarDate(fixture.date);
    const timeStart = manilaDateTime(fixture.date, fixture.start);
    const timeEnd = manilaDateTime(fixture.date, fixture.end);
    const reviewedAt =
      fixture.status === RequestStatus.PENDING ? null : manilaDateTime(fixture.date, '07:30');
    const approvedAt =
      fixture.status === RequestStatus.APPROVED ||
      fixture.status === RequestStatus.BORROWED ||
      fixture.status === RequestStatus.RETURNED
        ? manilaDateTime(fixture.date, '07:45')
        : null;
    const borrowedAt =
      fixture.status === RequestStatus.BORROWED || fixture.status === RequestStatus.RETURNED
        ? manilaDateTime(fixture.date, fixture.start)
        : null;
    const returnedAt =
      fixture.status === RequestStatus.RETURNED ? manilaDateTime(fixture.date, '12:15') : null;
    const declinedAt =
      fixture.status === RequestStatus.REJECTED ? manilaDateTime(fixture.date, '07:45') : null;
    const cancelledAt =
      fixture.status === RequestStatus.CANCELLED ? manilaDateTime(fixture.date, '07:45') : null;

    const existing = await prisma.borrowRequest.findFirst({
      where: { requestedBy: fixture.requester.id, purpose: fixture.purpose },
    });
    const data = {
      requestType: 'EQUIPMENT' as const,
      usageRoomId: fixture.room.id,
      usageLocation: null,
      requestedBy: fixture.requester.id,
      facultyId: fixture.faculty.id,
      programId: fixture.program.id,
      subjectId: fixture.subject.id,
      yearLevel: fixture.yearLevel,
      dateNeeded,
      roomId: null,
      location: null,
      timeStart,
      timeEnd,
      purpose: fixture.purpose,
      contactDetails: `${fixture.requester.email} | 0917-555-${fixture.key.slice(-3)}`,
      notes: fixture.notes,
      academicYearId: activeAcademicYear!.id,
      termId: activeTerm!.id,
      status: fixture.status,
      reviewedBy: fixture.status === RequestStatus.PENDING ? null : admin!.id,
      reviewedAt,
      approvedAt,
      borrowedAt,
      returnedAt,
      cancelledAt,
      declinedAt,
    };
    const request = existing
      ? await prisma.borrowRequest.update({ where: { id: existing.id }, data })
      : await prisma.borrowRequest.create({ data });

    await prisma.borrowRequestItem.deleteMany({ where: { borrowRequestId: request.id } });
    await prisma.borrowRequestItem.createMany({
      data: fixture.items.map(([equipmentName, quantity]) => {
        const equipment = equipmentByName.get(equipmentName);
        if (!equipment) throw new Error(`Cannot create report fixture: missing ${equipmentName}`);
        return { borrowRequestId: request.id, equipmentId: equipment.id, quantity };
      }),
    });
    requestByKey.set(fixture.key, { id: request.id, dateNeeded, timeStart, timeEnd });
  }

  const schedules: ScheduleSeed[] = [
    {
      key: 'approved-mia',
      scheduleType: ScheduleType.ONE_TIME,
      room: ictLab3!,
      faculty: marcoProfile!,
      program: bsee!,
      subject: comp002!,
      date: '2026-09-10',
      start: '13:00',
      end: '15:00',
      yearLevel: 3,
      requestKey: null,
    },
    {
      key: 'borrowed-kevin',
      scheduleType: ScheduleType.ONE_TIME,
      room: chemistryLab!,
      faculty: luisaProfile!,
      program: bsbio!,
      subject: comp001!,
      date: '2026-09-08',
      start: '09:30',
      end: '11:30',
      yearLevel: 1,
      requestKey: null,
    },
    {
      key: 'returned-paolo',
      scheduleType: ScheduleType.ONE_TIME,
      room: foodLab!,
      faculty: janeProfile!,
      program: bsit!,
      subject: comp006!,
      date: '2026-09-03',
      start: '10:00',
      end: '12:00',
      yearLevel: 2,
      requestKey: null,
    },
    {
      key: 'weekly-jane',
      scheduleType: ScheduleType.WEEKLY,
      room: ictLab1!,
      faculty: janeProfile!,
      program: bsit!,
      subject: comp016!,
      date: '2026-09-07',
      start: '08:00',
      end: '10:00',
      yearLevel: 2,
      requestKey: null,
    },
    {
      key: 'weekly-marco',
      scheduleType: ScheduleType.WEEKLY,
      room: ictLab3!,
      faculty: marcoProfile!,
      program: bsee!,
      subject: comp002!,
      date: '2026-09-09',
      start: '15:00',
      end: '17:00',
      yearLevel: 3,
      requestKey: null,
    },
  ];

  const additionalScheduleRooms = [ictLab1!, ictLab3!, chemistryLab!, foodLab!];
  const additionalScheduleFaculty = [janeProfile!, marcoProfile!, luisaProfile!];
  const additionalSchedulePrograms = [bsit!, bsee!, bsbio!];
  const additionalScheduleSubjects = [comp016!, comp002!, comp001!, comp006!];

  for (let index = 0; index < 20; index += 1) {
    const day = 1 + index;
    const startHour = 8 + (index % 4) * 2;
    const scheduleType = index < 12 ? ScheduleType.ONE_TIME : ScheduleType.WEEKLY;
    const start = `${String(startHour).padStart(2, '0')}:00`;
    const end = `${String(startHour + 2).padStart(2, '0')}:00`;
    const scheduleNumber = String(index + 1).padStart(2, '0');

    schedules.push({
      key: `bulk-schedule-${scheduleNumber}`,
      scheduleType,
      room: additionalScheduleRooms[index % additionalScheduleRooms.length],
      faculty: additionalScheduleFaculty[index % additionalScheduleFaculty.length],
      program: additionalSchedulePrograms[index % additionalSchedulePrograms.length],
      subject: additionalScheduleSubjects[index % additionalScheduleSubjects.length],
      date: `2026-10-${String(day).padStart(2, '0')}`,
      start,
      end,
      yearLevel: (index % 4) + 1,
      requestKey: null,
    });
  }

  for (const fixture of schedules) {
    const request = fixture.requestKey ? requestByKey.get(fixture.requestKey) : null;
    const scheduleDate = fixture.scheduleType === ScheduleType.ONE_TIME ? calendarDate(fixture.date) : null;
    const timeStart = manilaDateTime(fixture.date, fixture.start);
    const timeEnd = manilaDateTime(fixture.date, fixture.end);
    const dayOfWeek = calendarDate(fixture.date).getUTCDay();
    const existing = await prisma.labSchedule.findFirst({
      where: {
        createdBy: admin!.id,
        borrowRequestId: request?.id ?? null,
        scheduleType: fixture.scheduleType,
        roomId: fixture.room.id,
        subjectId: fixture.subject.id,
        timeStart,
      },
    });
    const data = {
      scheduleType: fixture.scheduleType,
      roomId: fixture.room.id,
      facultyId: fixture.faculty.id,
      programId: fixture.program.id,
      subjectId: fixture.subject.id,
      dayOfWeek,
      scheduleDate,
      timeStart,
      timeEnd,
      academicYearId: activeAcademicYear!.id,
      termId: activeTerm!.id,
      yearLevel: fixture.yearLevel,
      borrowRequestId: request?.id ?? null,
      createdBy: admin!.id,
    };
    if (existing) {
      await prisma.labSchedule.update({ where: { id: existing.id }, data });
    } else {
      await prisma.labSchedule.create({ data });
    }
  }
}

async function main() {
  const defaultPassword = 'SmartLab123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const departmentMap = new Map<string, { id: string }>();
  for (const dept of departmentSeeds) {
    const record = await ensureDepartment(dept.name);
    departmentMap.set(dept.name, record);
  }

  const programMap = new Map<string, { id: string }>();
  for (const program of programSeeds) {
    const record = await ensureProgram(program.code, program.name);
    programMap.set(program.code, record);
  }

  for (const academicYear of academicYearSeeds) {
    await prisma.academicYear.upsert({
      where: { year: academicYear.year },
      update: { isActive: academicYear.isActive },
      create: { year: academicYear.year, isActive: academicYear.isActive },
    });
  }

  for (const term of termSeeds) {
    await prisma.term.upsert({
      where: { name: term.name },
      update: { isActive: term.isActive },
      create: { name: term.name, isActive: term.isActive },
    });
  }

  // Seed admin account
  await prisma.user.upsert({
    where: { email: adminSeed.email },
    update: {
      firstName: adminSeed.firstName,
      lastName: adminSeed.lastName,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      activationState: 'LEGACY',
        email: adminSeed.email,
      passwordHash,
      firstName: adminSeed.firstName,
      lastName: adminSeed.lastName,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  for (const faculty of facultySeeds) {
    const department = departmentMap.get(faculty.departmentName);
    const user = await prisma.user.upsert({
      where: { email: faculty.email },
      update: {
        firstName: faculty.firstName,
        lastName: faculty.lastName,
        status: UserStatus.ACTIVE,
      },
      create: {
        activationState: 'LEGACY',
        email: faculty.email,
        passwordHash,
        firstName: faculty.firstName,
        lastName: faculty.lastName,
        role: UserRole.FACULTY,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.facultyProfile.upsert({
      where: { userId: user.id },
      update: {
        departmentId: department?.id ?? null,
      },
      create: {
        userId: user.id,
        departmentId: department?.id ?? null,
      },
    });
  }

  for (const student of studentSeeds) {
    const program = programMap.get(student.programCode);
    const user = await prisma.user.upsert({
      where: { email: student.email },
      update: {
        firstName: student.firstName,
        lastName: student.lastName,
        status: UserStatus.ACTIVE,
      },
      create: {
        activationState: 'LEGACY',
        email: student.email,
        passwordHash,
        firstName: student.firstName,
        lastName: student.lastName,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: {
        programId: program?.id ?? null,
        yearLevel: student.yearLevel,
      },
      create: {
        userId: user.id,
        programId: program?.id ?? null,
        yearLevel: student.yearLevel,
      },
    });
  }

  for (const buildingName of buildingNames) {
    const building = await ensureBuilding(buildingName);
    const rooms = roomSeedsByBuilding[buildingName] ?? [];
    for (const room of rooms) {
      await ensureRoom(building.id, room);
    }
  }

  for (const room of noBuildingRoomSeeds) {
    await ensureRoom(null, room);
  }

  for (const subject of subjectSeeds) {
    await ensureSubject(subject.code, subject.name);
  }

  for (const equipment of equipmentSeeds) {
    await ensureEquipment(equipment);
  }

  await ensureReportFixtures();

  console.log('✅ Demo seed completed. These accounts are for disposable development/test databases only.');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
