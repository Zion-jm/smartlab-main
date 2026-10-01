import type { ReactNode } from 'react';
import type { LabSchedule, ScheduleType } from '../../types/labSchedule';
import DataTable, { type DataTableColumn } from '../shared/DataTable';
import type { TablePaginationProps } from '../shared/TablePagination';
const scheduleTypeLabel:Record<ScheduleType,string>={WEEKLY:'Weekly',ONE_TIME:'One Time'};
const scheduleTypeBadge=(type:ScheduleType)=>type==='WEEKLY'?'bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]':'bg-[#fef3f2] text-[#b91c1c] border border-[#fecaca]';
const scheduleColumns:DataTableColumn<LabSchedule>[]=[{id:'0',header:'Date & Time',cell:schedule=><>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${scheduleTypeBadge(schedule.scheduleType)}`}>
                    {scheduleTypeLabel[schedule.scheduleType]}
                  </span>
                  <span className="text-[#d1d5db]">|</span>
                  <span className="text-[13px] font-semibold text-[#374151]">{schedule.displayDay}</span>
                </div>
                <p className="font-medium text-[#111827] mt-1">{schedule.displayDate}</p>
                <div className="text-xs text-[#6b7280]">{schedule.timeRange}</div>
              </>},
{id:'1',header:'Room',cell:schedule=><>{schedule.roomLabel}</>},
{id:'2',header:'Subject',cell:schedule=><>{schedule.subjectLabel}</>},
{id:'3',header:'Program',cell:schedule=><>{schedule.programLabel}</>},
{id:'4',header:'Faculty',cell:schedule=><>{schedule.facultyName}</>},
{id:'5',header:'Academic Context',cell:schedule=><>
                <div>{schedule.academicYearLabel ?? '—'}</div>
                <div className="text-[11px] text-[#6b7280]">{schedule.termLabel ?? '—'}</div>
              </>}];
export default function ScheduleDataTable({schedules,actions,source,pagination}: {schedules:LabSchedule[];actions?:(schedule:LabSchedule)=>ReactNode;source?:(schedule:LabSchedule)=>ReactNode;pagination?:TablePaginationProps}) {
 const columns=[...(source?[{id:'source',header:'Source',cell:source}]:[]),...scheduleColumns,...(actions?[{id:'actions',header:'Actions',action:true,cell:actions}]:[])];
 return <DataTable label="Lab schedules" rows={schedules} rowKey={s=>s.id} columns={columns} pagination={pagination} minWidth={900}/>;
}
