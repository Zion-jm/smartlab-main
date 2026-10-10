import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import StudentAcademicRecords from '../components/admin/StudentAcademicRecords';
import { academicPeriodApi } from '../services/api';

type AcademicYear = { id:string; year:string; isActive:boolean };

export default function AdminStudentRecords() {
  const [years,setYears]=useState<AcademicYear[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);setError('');try{const {data}=await academicPeriodApi.get();setYears(data?.academicYears??[]);}catch{setError('Unable to load academic years. Please try again.');}finally{setLoading(false);}},[]);
  useEffect(()=>{void academicPeriodApi.get().then(({data})=>setYears(data?.academicYears??[])).catch(()=>setError('Unable to load academic years. Please try again.')).finally(()=>setLoading(false));},[]);
  return <AdminLayout><main className="mx-auto responsive-workspace space-y-4 p-2 lg:p-3">
    <section className="flex flex-col gap-3 rounded-xl border border-[#ead7d3] bg-[#fffaf8] px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#800000]">Page controls</p><h1 className="mt-0.5 text-sm font-semibold text-[#321d1d]">Student academic records</h1><p className="mt-0.5 text-xs text-[#786565]">Enrollment, promotion, graduation, and account archiving</p></div>
      <button type="button" onClick={()=>void load()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#ead7d3] bg-white px-4 text-xs font-semibold text-[#514343] transition hover:bg-[#faf7f5] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Refresh</button>
    </section>
    {error?<section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</section>:loading?<section className="rounded-2xl border border-[#ead7d3] bg-white p-8 text-center text-sm text-[#786565]">Loading student records…</section>:<StudentAcademicRecords years={years}/>} 
  </main></AdminLayout>;
}
