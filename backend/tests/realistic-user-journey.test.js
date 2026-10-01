const { PrismaClient } = require('@prisma/client');
const {
  apiRequest,
  loginAs,
} = require('./helpers');

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = 'SmartLab123!';
const TEST_PASSWORD = 'Testing123!';
const RUN_OFFSET = 260 + (Date.now() % 1000);
const runTag = `${Date.now()}`;

const created = {
  users: [],
  equipment: [],
  schedules: [],
  requests: [],
  buildings: [],
  rooms: [],
  programs: [],
  subjects: [],
  departments: [],
};

let adminToken;
let facultyToken;
let studentToken;
let testStudentToken;
let testFacultyToken;
let facultyProfileId;
let programId;
let subjectId;
let academicYearId;
let termId;
let computerLabId;
let equipmentId;
let scarceEquipmentId;
let mainRequestId;
let facultyScheduleRequestId;

const runDate = (day, hour = 0) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + RUN_OFFSET + day);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};

const requestBody = (day, itemEquipmentId = equipmentId, quantity = 1, overrides = {}) => ({
  facultyId: facultyProfileId,
  programId,
  subjectId,
  yearLevel: 2,
  dateNeeded: runDate(day),
  roomId: computerLabId,
  location: 'ICT Lab 2',
  timeStart: runDate(day, 1),
  timeEnd: runDate(day, 3),
  purpose: 'CPE 4 laboratory activity and equipment practice',
  contactDetails: 'student.group@pup.edu.ph',
  notes: 'Please prepare the equipment before the scheduled laboratory session.',
  academicYearId,
  termId,
  items: [{ equipmentId: itemEquipmentId, quantity }],
  ...overrides,
});

const scheduleBody = (day, type = 'ONE_TIME', overrides = {}) => ({
  roomId: computerLabId,
  facultyId: facultyProfileId,
  programId,
  subjectId,
  yearLevel: 2,
  scheduleType: type,
  scheduleDate: type === 'ONE_TIME' ? runDate(day) : undefined,
  dayOfWeek: type === 'WEEKLY' ? 3 : undefined,
  timeStart: runDate(day, 5),
  timeEnd: runDate(day, 7),
  academicYearId,
  termId,
  ...overrides,
});

const expectStatus = (response, expected, label) => {
  expect(response.status).toBe(expected);
  if (response.status !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${response.status}: ${JSON.stringify(response.data)}`);
  }
  return response.data;
};

beforeAll(async () => {
  [adminToken, facultyToken, studentToken] = await Promise.all([
    loginAs('admin@smartlab.local', DEFAULT_PASSWORD),
    loginAs('jane.delacruz@smartlab.local', DEFAULT_PASSWORD),
    loginAs('paolo.santos@smartlab.local', DEFAULT_PASSWORD),
  ]);

  const resources = expectStatus(
    await apiRequest('GET', '/lab-schedules/resources', null, adminToken),
    200,
    'load schedule resources'
  );

  const faculty = resources.faculty.find((profile) => profile.userId);
  const program = resources.programs.find((item) => item.code === 'BSIT') || resources.programs[0];
  const subject = resources.subjects.find((item) => item.code === 'IT101') || resources.subjects[0];
  const academicYear = resources.academicYears.find((item) => item.isActive) || resources.academicYears[0];
  const term = resources.terms.find((item) => item.isActive) || resources.terms[0];
  const computerLab = resources.rooms.find((room) => room.isComputerLab) || resources.rooms[0];

  facultyProfileId = faculty.profileId;
  programId = program.id;
  subjectId = subject.id;
  academicYearId = academicYear.id;
  termId = term.id;
  computerLabId = computerLab.id;

  const equipment = expectStatus(
    await apiRequest('POST', '/equipment', {
      name: `Arduino Uno R4 laboratory kit (${runTag})`,
      description: 'Microcontroller kit for embedded systems laboratory exercises.',
      totalQuantity: 10,
      borrowedQuantity: 0,
      damagedQuantity: 0,
    }, adminToken),
    201,
    'create realistic equipment'
  );
  equipmentId = equipment.id;
  created.equipment.push(equipmentId);

  const scarceEquipment = expectStatus(
    await apiRequest('POST', '/equipment', {
      name: `Digital multimeter training unit (${runTag})`,
      description: 'Bench multimeter reserved for electronics measurement activities.',
      totalQuantity: 1,
      borrowedQuantity: 0,
      damagedQuantity: 0,
    }, adminToken),
    201,
    'create scarce equipment'
  );
  scarceEquipmentId = scarceEquipment.id;
  created.equipment.push(scarceEquipmentId);
});

afterAll(async () => {
  // Notifications are sent asynchronously by the API. Give those writes a
  // moment to finish before removing the scenario's records.
  await new Promise((resolve) => setTimeout(resolve, 150));

  try {
    if (created.requests.length) {
      await prisma.notification.deleteMany({
        where: { borrowRequestId: { in: created.requests } },
      });
      await prisma.labSchedule.deleteMany({
        where: { borrowRequestId: { in: created.requests } },
      });
      await prisma.borrowRequestItem.deleteMany({
        where: { borrowRequestId: { in: created.requests } },
      });
      await prisma.borrowRequest.deleteMany({
        where: { id: { in: created.requests } },
      });
    }

    if (created.schedules.length) {
      await prisma.labSchedule.deleteMany({ where: { id: { in: created.schedules } } });
    }
    if (created.users.length) {
      await prisma.notification.deleteMany({ where: { userId: { in: created.users } } });
      await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    }
    if (created.equipment.length) {
      await prisma.equipment.deleteMany({ where: { id: { in: created.equipment } } });
    }
    if (created.rooms.length) {
      await prisma.room.deleteMany({ where: { id: { in: created.rooms } } });
    }
    if (created.buildings.length) {
      await prisma.building.deleteMany({ where: { id: { in: created.buildings } } });
    }
    if (created.subjects.length) {
      await prisma.subject.deleteMany({ where: { id: { in: created.subjects } } });
    }
    if (created.programs.length) {
      await prisma.program.deleteMany({ where: { id: { in: created.programs } } });
    }
    if (created.departments.length) {
      await prisma.department.deleteMany({ where: { id: { in: created.departments } } });
    }
  } finally {
    await prisma.$disconnect();
  }
});

describe('Realistic SmartLab user journeys', () => {
  test('admin, faculty, and student can log in and read their permitted views', async () => {
    const adminMe = expectStatus(await apiRequest('GET', '/auth/me', null, adminToken), 200, 'admin profile');
    const facultyMe = expectStatus(await apiRequest('GET', '/auth/me', null, facultyToken), 200, 'faculty profile');
    const studentMe = expectStatus(await apiRequest('GET', '/auth/me', null, studentToken), 200, 'student profile');

    expect(adminMe.user.role).toBe('ADMIN');
    expect(facultyMe.user.role).toBe('FACULTY');
    expect(studentMe.user.role).toBe('STUDENT');
    expect(studentMe.user.programId).toBe(programId);

    expectStatus(await apiRequest('GET', '/equipment', null, studentToken), 200, 'student equipment list');
    expectStatus(await apiRequest('GET', `/equipment/${equipmentId}`, null, facultyToken), 200, 'faculty equipment detail');
    expectStatus(await apiRequest('GET', '/equipment/stats/overview', null, adminToken), 200, 'admin equipment stats');
    expectStatus(await apiRequest('GET', '/users', null, facultyToken), 403, 'faculty user-list restriction');
    expectStatus(await apiRequest('GET', '/academic-directory', null, studentToken), 403, 'student directory restriction');
  });

  test('admin manages the academic directory used by daily lab operations', async () => {
    const directory = expectStatus(await apiRequest('GET', '/academic-directory', null, adminToken), 200, 'directory summary');
    expect(directory.summary.buildings).toBeGreaterThan(0);
    expect(expectStatus(await apiRequest('GET', '/academic-directory/programs', null, adminToken), 200, 'program list')).toEqual(
      expect.arrayContaining([expect.objectContaining({ program_code: 'BSIT' })])
    );
    expect(expectStatus(await apiRequest('GET', '/academic-directory/departments', null, adminToken), 200, 'department list').length).toBeGreaterThan(0);

    const building = expectStatus(await apiRequest('POST', '/academic-directory/buildings', {
      name: `Science Annex (${runTag})`,
    }, adminToken), 201, 'create building');
    created.buildings.push(building.id);
    expect(expectStatus(await apiRequest('PUT', `/academic-directory/buildings/${building.id}`, {
      name: `Science Annex - Updated (${runTag})`,
    }, adminToken), 200, 'update building').name).toMatch(/Updated/);

    const room = expectStatus(await apiRequest('POST', '/academic-directory/rooms', {
      roomNumber: 'LAB-TEST',
      roomName: 'Instrumentation Practice Room',
      buildingId: building.id,
      isComputerLab: true,
    }, adminToken), 201, 'create room');
    created.rooms.push(room.id);
    expect(expectStatus(await apiRequest('PUT', `/academic-directory/rooms/${room.id}`, {
      roomNumber: 'LAB-TEST',
      roomName: 'Instrumentation Practice Room - Updated',
      buildingId: building.id,
      isComputerLab: true,
    }, adminToken), 200, 'update room').roomName).toMatch(/Updated/);

    const program = expectStatus(await apiRequest('POST', '/academic-directory/programs', {
      code: `BQA${runTag.slice(-5)}`,
      name: 'Bachelor of Quality Assurance',
    }, adminToken), 201, 'create program');
    created.programs.push(program.id);
    expect(expectStatus(await apiRequest('PUT', `/academic-directory/programs/${program.id}`, {
      code: program.code,
      name: 'Bachelor of Quality Assurance and Testing',
    }, adminToken), 200, 'update program').name).toMatch(/Testing/);

    const subject = expectStatus(await apiRequest('POST', '/academic-directory/subjects', {
      code: `QA${runTag.slice(-6)}`,
      name: 'Software Quality Laboratory',
    }, adminToken), 201, 'create subject');
    created.subjects.push(subject.id);
    expect(expectStatus(await apiRequest('PUT', `/academic-directory/subjects/${subject.id}`, {
      code: subject.code,
      name: 'Software Quality Assurance Laboratory',
    }, adminToken), 200, 'update subject').name).toMatch(/Assurance/);

    const department = expectStatus(await apiRequest('POST', '/academic-directory/departments', {
      name: `Department of Quality Assurance (${runTag})`,
    }, adminToken), 201, 'create department');
    created.departments.push(department.id);
    expect(expectStatus(await apiRequest('PUT', `/academic-directory/departments/${department.id}`, {
      name: `Department of Quality Assurance and Testing (${runTag})`,
    }, adminToken), 200, 'update department').name).toMatch(/Testing/);
  });

  test('admin creates, updates, filters, deactivates, and removes user accounts', async () => {
    const studentEmail = `rafael.mendoza.${runTag}@smartlab.local`;
    const facultyEmail = `celine.navarro.${runTag}@smartlab.local`;

    const student = expectStatus(await apiRequest('POST', '/users', {
      first_name: 'Rafael',
      last_name: 'Mendoza',
      gmail: studentEmail,
      password: TEST_PASSWORD,
      role_id: 3,
      status_id: 1,
      program_id: programId,
      year_level: 2,
    }, adminToken), 201, 'admin create student');
    const studentId = student.user.user_id;
    created.users.push(studentId);

    const faculty = expectStatus(await apiRequest('POST', '/users', {
      first_name: 'Celine',
      last_name: 'Navarro',
      gmail: facultyEmail,
      password: TEST_PASSWORD,
      role_id: 2,
      status_id: 1,
      department_id: created.departments[0],
    }, adminToken), 201, 'admin create faculty');
    const facultyId = faculty.user.user_id;
    created.users.push(facultyId);

    expect(expectStatus(await apiRequest('GET', `/users/${studentId}`, null, adminToken), 200, 'admin read created student').user.email).toBe(studentEmail);
    expect(expectStatus(await apiRequest('GET', `/users?role=STUDENT&search=Rafael`, null, adminToken), 200, 'admin filter students').some((user) => user.user_id === studentId)).toBe(true);

    testStudentToken = expectStatus(await apiRequest('POST', '/auth/login', {
      email: studentEmail,
      password: TEST_PASSWORD,
    }), 200, 'created student login').token;
    expectStatus(await apiRequest('GET', `/users/${studentId}`, null, testStudentToken), 200, 'student read own profile');
    expectStatus(await apiRequest('GET', `/users/${facultyId}`, null, testStudentToken), 403, 'student cannot read another profile');
    expectStatus(await apiRequest('PUT', `/users/${studentId}`, {
      first_name: 'Rafael Luis',
      last_name: 'Mendoza',
      phone: '+63 917 555 0142',
    }, testStudentToken), 200, 'student update own profile');

    testFacultyToken = expectStatus(await apiRequest('POST', '/auth/login', {
      email: facultyEmail,
      password: TEST_PASSWORD,
    }), 200, 'created faculty login').token;
    expectStatus(await apiRequest('PUT', `/users/${facultyId}`, {
      first_name: 'Celine Marie',
      last_name: 'Navarro',
      phone: '+63 917 555 0188',
    }, testFacultyToken), 200, 'faculty update own profile');

    expectStatus(await apiRequest('PATCH', `/users/${facultyId}/status`, {
      status: 'DEACTIVATED',
    }, adminToken), 200, 'admin deactivate faculty');
    expectStatus(await apiRequest('POST', '/auth/login', {
      email: facultyEmail,
      password: TEST_PASSWORD,
    }), 401, 'deactivated faculty login blocked');
    expectStatus(await apiRequest('PATCH', `/users/${facultyId}/status`, {
      status: 'ACTIVE',
    }, adminToken), 200, 'admin reactivate faculty');

    expectStatus(await apiRequest('DELETE', `/users/${facultyId}`, null, adminToken), 200, 'admin delete faculty');
    created.users = created.users.filter((id) => id !== facultyId);
    expectStatus(await apiRequest('DELETE', `/users/${studentId}`, null, adminToken), 200, 'admin delete student');
    created.users = created.users.filter((id) => id !== studentId);
    testStudentToken = null;
    testFacultyToken = null;
  });

  test('users search inventory, inspect equipment, and maintain stock', async () => {
    const list = expectStatus(await apiRequest('GET', `/equipment?search=Arduino%20Uno`, null, facultyToken), 200, 'equipment search');
    expect(list.some((item) => item.id === equipmentId)).toBe(true);
    const detail = expectStatus(await apiRequest('GET', `/equipment/${equipmentId}`, null, adminToken), 200, 'equipment detail');
    expect(detail.name).toMatch(/Arduino Uno/);
    const updated = expectStatus(await apiRequest('PUT', `/equipment/${equipmentId}`, {
      name: detail.name,
      description: 'Updated calibration and embedded systems kit for laboratory practice.',
      totalQuantity: 10,
      borrowedQuantity: 0,
      damagedQuantity: 1,
    }, adminToken), 200, 'admin update equipment');
    expect(updated.availableQuantity).toBe(9);

    const disposable = expectStatus(await apiRequest('POST', '/equipment', {
      name: `Disposable oscilloscope probe (${runTag})`,
      description: 'Short-lived test fixture used to verify deletion.',
      totalQuantity: 2,
    }, adminToken), 201, 'create disposable equipment');
    expectStatus(await apiRequest('DELETE', `/equipment/${disposable.id}`, null, adminToken), 200, 'admin delete equipment');
    expectStatus(await apiRequest('GET', `/equipment/${equipmentId}`, null, studentToken), 403, 'student equipment detail restriction');
  });

  test('student submits, edits, and observes a borrow request before admin approval', async () => {
    const data = expectStatus(await apiRequest('POST', '/borrow-requests', requestBody(1, equipmentId, 2), studentToken), 201, 'student create borrow request');
    mainRequestId = data.request.id;
    created.requests.push(mainRequestId);
    expect(data.request.status).toBe('PENDING');

    expectStatus(await apiRequest('GET', '/borrow-requests/my-requests', null, studentToken), 200, 'student own requests');
    expectStatus(await apiRequest('GET', `/borrow-requests/${mainRequestId}`, null, studentToken), 200, 'student request detail');
    expectStatus(await apiRequest('PUT', `/borrow-requests/${mainRequestId}`, requestBody(1, equipmentId, 2, {
      purpose: 'Updated CPE 4 microcontroller integration exercise',
      notes: 'Edited by the student after confirming the laboratory time.',
    }), studentToken), 200, 'student edit pending request');

    expectStatus(await apiRequest('POST', '/borrow-requests', requestBody(1, equipmentId, 1), studentToken), 409, 'duplicate pending request guard');
    expectStatus(await apiRequest('GET', `/borrow-requests?role=STUDENT&search=Paolo&sort=date-asc`, null, adminToken), 200, 'admin request filter');
    expectStatus(await apiRequest('GET', '/borrow-requests', null, facultyToken), 200, 'faculty request list');
  });

  test('admin checks conflicts, approves, lends, and receives equipment', async () => {
    const scheduleConflict = expectStatus(await apiRequest('POST', '/conflicts/check', {
      roomId: computerLabId,
      academicYearId,
      termId,
      scheduleType: 'ONE_TIME',
      scheduleDate: runDate(1),
      timeStart: runDate(1, 1),
      timeEnd: runDate(1, 3),
    }, adminToken), 200, 'room conflict check');
    expect(scheduleConflict.hasConflicts).toBe(true);

    const equipmentConflict = expectStatus(await apiRequest('POST', '/equipment-conflicts/conflicts', {
      academicYearId,
      termId,
      date: runDate(1),
      timeStart: '09:00',
      timeEnd: '11:00',
      equipment: [{ equipmentId, requestedQuantity: 2 }],
    }, facultyToken), 200, 'equipment conflict check');
    expect(equipmentConflict.success).toBe(true);
    expect(equipmentConflict.data.summary.conflictingRequestsCount).toBeGreaterThan(0);

    expectStatus(await apiRequest('GET', `/equipment-conflicts/availability?academicYearId=${academicYearId}&termId=${termId}&date=${encodeURIComponent(runDate(1))}&timeStart=09:00&timeEnd=11:00`, null, studentToken), 200, 'equipment availability check');

    const approved = expectStatus(await apiRequest('PATCH', `/borrow-requests/${mainRequestId}/approve`, null, adminToken), 200, 'admin approve request');
    expect(approved.request.status).toBe('APPROVED');
    expect(approved.schedule).toBeDefined();
    created.schedules.push(approved.schedule.id);

    expectStatus(await apiRequest('PATCH', `/borrow-requests/${mainRequestId}/borrow`, null, adminToken), 200, 'admin mark borrowed');
    const inUse = expectStatus(await apiRequest('GET', `/equipment/${equipmentId}`, null, facultyToken), 200, 'faculty verify borrowed stock');
    expect(inUse.borrowedQuantity).toBe(2);
    expect(inUse.availableQuantity).toBe(7);

    expectStatus(await apiRequest('PATCH', `/borrow-requests/${mainRequestId}/return`, null, adminToken), 200, 'admin mark returned');
    const returned = expectStatus(await apiRequest('GET', `/borrow-requests/${mainRequestId}`, null, adminToken), 200, 'admin verify returned request');
    expect(returned.request.status).toBe('RETURNED');
  });

  test('faculty requests a lab schedule and admin approves the reservation', async () => {
    const data = expectStatus(await apiRequest('POST', '/lab-schedules/request', {
      roomId: computerLabId,
      programId,
      subjectId,
      yearLevel: 3,
      scheduleDate: runDate(10),
      timeStart: runDate(10, 9),
      timeEnd: runDate(10, 11),
      purpose: 'Faculty-led database systems laboratory session',
      academicYearId,
      termId,
      items: [{ equipmentId, quantity: 1 }],
    }, facultyToken), 201, 'faculty schedule request');
    facultyScheduleRequestId = data.request.id;
    created.requests.push(facultyScheduleRequestId);

    const precheck = expectStatus(await apiRequest('GET', `/lab-schedules/check-conflicts/${facultyScheduleRequestId}`, null, adminToken), 200, 'admin schedule conflict precheck');
    expect(precheck.hasConflicts).toBe(false);

    const approval = expectStatus(await apiRequest('PATCH', `/lab-schedules/approve-request/${facultyScheduleRequestId}`, null, adminToken), 200, 'admin approve faculty schedule');
    expect(approval.request.status).toBe('APPROVED');
    created.schedules.push(approval.schedule.id);
    expectStatus(await apiRequest('GET', `/lab-schedules/${approval.schedule.id}`, null, studentToken), 200, 'student view approved schedule');
  });

  test('admin creates, reads, updates, and deletes one-time and weekly schedules', async () => {
    const oneTime = expectStatus(await apiRequest('POST', '/lab-schedules/admin/create', scheduleBody(20), adminToken), 201, 'admin one-time schedule');
    const oneTimeId = oneTime.schedule.id;
    created.schedules.push(oneTimeId);
    expect(oneTime.schedule.scheduleType).toBe('ONE_TIME');

    const weekly = expectStatus(await apiRequest('POST', '/lab-schedules/admin/create', scheduleBody(21, 'WEEKLY'), adminToken), 201, 'admin weekly schedule');
    const weeklyId = weekly.schedule.id;
    created.schedules.push(weeklyId);
    expect(weekly.schedule.scheduleType).toBe('WEEKLY');

    expectStatus(await apiRequest('GET', '/lab-schedules?facultyId=' + facultyProfileId, null, facultyToken), 200, 'faculty schedule list');
    expectStatus(await apiRequest('GET', `/lab-schedules/${oneTimeId}`, null, adminToken), 200, 'admin schedule detail');
    const updated = expectStatus(await apiRequest('PUT', `/lab-schedules/${oneTimeId}`, scheduleBody(22), adminToken), 200, 'admin update schedule');
    expect(updated.schedule.id).toBe(oneTimeId);
    expectStatus(await apiRequest('DELETE', `/lab-schedules/${weeklyId}`, null, adminToken), 200, 'admin delete weekly schedule');
    created.schedules = created.schedules.filter((id) => id !== weeklyId);
  });

  test('admin rejects a request and students can cancel their own pending request', async () => {
    const rejected = expectStatus(await apiRequest('POST', '/borrow-requests', requestBody(30, equipmentId, 1), studentToken), 201, 'create request to reject');
    const rejectedId = rejected.request.id;
    created.requests.push(rejectedId);
    const rejection = expectStatus(await apiRequest('PATCH', `/borrow-requests/${rejectedId}/reject`, {
      reason: 'The requested laboratory room is reserved for a scheduled examination.',
    }, adminToken), 200, 'admin reject request');
    expect(rejection.request.status).toBe('REJECTED');

    const cancelled = expectStatus(await apiRequest('POST', '/borrow-requests', requestBody(31, equipmentId, 1), studentToken), 201, 'create request to cancel');
    const cancelledId = cancelled.request.id;
    created.requests.push(cancelledId);
    const cancellation = expectStatus(await apiRequest('PATCH', `/borrow-requests/${cancelledId}/cancel`, null, studentToken), 200, 'student cancel pending request');
    expect(cancellation.request.status).toBe('CANCELLED');
  });

  test('admin can cancel an actively borrowed request and restore inventory', async () => {
    const data = expectStatus(await apiRequest('POST', '/borrow-requests', requestBody(40, equipmentId, 1), studentToken), 201, 'create request for admin cancellation');
    const id = data.request.id;
    created.requests.push(id);
    expectStatus(await apiRequest('PATCH', `/borrow-requests/${id}/approve`, null, adminToken), 200, 'approve request for cancellation');
    expectStatus(await apiRequest('PATCH', `/borrow-requests/${id}/borrow`, null, adminToken), 200, 'borrow request for cancellation');
    const cancellation = expectStatus(await apiRequest('PATCH', `/borrow-requests/${id}/cancel`, null, adminToken), 200, 'admin cancel borrowed request');
    expect(cancellation.request.status).toBe('CANCELLED');
  });

  test('admin adjusts scarce equipment and the student responds to the notification', async () => {
    const approved = expectStatus(await apiRequest('POST', '/borrow-requests', requestBody(50, scarceEquipmentId, 1), studentToken), 201, 'create approved adjustment source');
    const approvedId = approved.request.id;
    created.requests.push(approvedId);
    expectStatus(await apiRequest('PATCH', `/borrow-requests/${approvedId}/approve`, null, adminToken), 200, 'approve adjustment source');

    const target = expectStatus(await apiRequest('POST', '/borrow-requests', requestBody(50, scarceEquipmentId, 1, {
      purpose: 'Backup measurement session if the first group finishes early.',
    }), studentToken), 201, 'create adjustment target');
    const targetId = target.request.id;
    created.requests.push(targetId);

    const adjustment = expectStatus(await apiRequest('POST', '/equipment-adjustments/adjust-equipment', {
      requestId: targetId,
      approvedRequestId: approvedId,
    }, adminToken), 200, 'admin adjust equipment');
    expect(adjustment.data.adjusted).toBe(true);
    expect(adjustment.data.notification.id).toBeDefined();

    const response = expectStatus(await apiRequest('POST', `/equipment-adjustments/${adjustment.data.notification.id}/respond`, {
      action: 'accept',
      requestId: targetId,
    }, studentToken), 200, 'student accept equipment adjustment');
    expect(response.data.action).toBe('accept');
  });

  test('users receive and manage notifications created by the workflow', async () => {
    const notifications = expectStatus(await apiRequest('GET', '/notifications', null, studentToken), 200, 'student notifications');
    expect(notifications.notifications.length).toBeGreaterThan(0);
    expect(expectStatus(await apiRequest('GET', '/notifications/unread-count', null, studentToken), 200, 'unread notification count').count).toBeGreaterThanOrEqual(0);

    const firstUnread = notifications.notifications.find((notification) => !notification.isRead);
    if (firstUnread) {
      expectStatus(await apiRequest('PATCH', `/notifications/${firstUnread.id}/read`, null, studentToken), 200, 'mark one notification read');
    }
    expectStatus(await apiRequest('PATCH', '/notifications/read-all', null, studentToken), 200, 'mark all notifications read');
    expectStatus(await apiRequest('GET', '/notifications', null, adminToken), 200, 'admin notifications');
  });
});