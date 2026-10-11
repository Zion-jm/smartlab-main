import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import StudentAcademicRecords from '../components/admin/StudentAcademicRecords';
import { academicPeriodApi } from '../services/api';

type AcademicYear = { id:string; year:string; isActive:boolean };

export default function AdminStudentRecords() {
  const [years,setYears]=useState<AcademicYear[]>([]);
  const [loading,setLoading]=useState(true);
  const [initialized,setInitialized]=useState(false);
  const [lastUpdated,setLastUpdated]=useState<Date|null>(null);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);setError('');try{const {data}=await academicPeriodApi.get();setYears(data?.academicYears??[]);setLastUpdated(new Date());}catch{setError('Unable to load academic years. Please try again.');}finally{setLoading(false);setInitialized(true);}},[]);
  useEffect(()=>{void load();},[load]);
  return <AdminLayout><main className="mx-auto responsive-workspace space-y-4 p-2 lg:p-3">
    {error&&<section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</section>}
    {!initialized&&loading?<section className="rounded-2xl border border-[#ead7d3] bg-white p-8 text-center text-sm text-[#786565]">Loading student records…</section>:<StudentAcademicRecords years={years} onRefresh={load} refreshing={loading} lastUpdated={lastUpdated}/>} 
  </main></AdminLayout>;
}
