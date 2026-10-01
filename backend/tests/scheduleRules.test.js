const {checkScheduleConflicts,hasTimeOverlap,sameDay,calendarWeekday,normalizeDayOfWeek}=require('../dist/services/labScheduleService');
test('Manila morning overlap crosses UTC midnight safely',()=>{
  expect(hasTimeOverlap(new Date('2035-06-11T23:30:00Z'),new Date('2035-06-12T02:00:00Z'),new Date('2035-06-12T00:00:00Z'),new Date('2035-06-12T01:00:00Z'))).toBe(true);
});
test('calendar dates encoded at Manila midnight or UTC midnight agree',()=>{
  const local=new Date('2035-06-12T00:00:00+08:00'),utc=new Date('2035-06-12T00:00:00Z');
  expect(sameDay(local,utc)).toBe(true);expect(calendarWeekday(local)).toBe(utc.getUTCDay());
});
test('fractional weekdays are rejected',()=>expect(()=>normalizeDayOfWeek(1.5)).toThrow());
test('database failure is not converted to conflict-free success',async()=>{
  const failure=new Error('test database unavailable');
  await expect(checkScheduleConflicts({roomId:'test',scheduleType:'WEEKLY',dayOfWeek:2,timeStart:new Date(),timeEnd:new Date()}, {labSchedule:{findMany:jest.fn().mockRejectedValue(failure)}})).rejects.toBe(failure);
});
