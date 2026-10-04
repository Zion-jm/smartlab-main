import { TextActionButton } from '../src/components/shared/TableActionButtons';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import DataTable from '../src/components/shared/DataTable';
import { TableScrollContext } from '../src/components/shared/tableScrollContext';
import '../src/index.css';
export function Harness(){
 const [count,setCount]=useState(0),[page,setPage]=useState(1),[size,setSize]=useState(10),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(false),[selected,setSelected]=useState(''),[root,setRoot]=useState<HTMLDivElement|null>(null);
 const local=new URLSearchParams(location.search).has('local');const data=Array.from({length:count},(_,i)=>({id:String(i),name:'Record '+i}));
 const content=<><div style={{height:200}}>Content before table</div><DataTable label="Harness records" rows={data.slice((page-1)*size,page*size)} rowKey={r=>r.id} loading={loading} error={error} onRetry={()=>setError(null)} columns={[{id:'id',header:'Reference',cell:r=>r.id},{id:'name',header:'Name',cell:r=>r.name},{id:'action',header:'Actions',action:true,cell:r=><TextActionButton label={`Choose ${r.id}`} icon="view" onClick={()=>setSelected(r.id)} />}]} pagination={{currentPage:page,pageSize:size,totalItems:count,onPageChange:setPage,onPageSizeChange:n=>{setSize(n);setPage(1)}}}/><div style={{height:900}}>Content after table</div></>;
 return <><nav><button onClick={()=>setCount(45)}>Populate</button><button onClick={()=>setCount(0)}>Empty</button><button onClick={()=>setCount(3)}>Shrink</button><button onClick={()=>setError('Simulated error')}>Fail</button><button onClick={()=>setLoading(v=>!v)}>Loading</button><output aria-label="Selection">{selected}</output><output aria-label="Page">{page}</output></nav>{local?<div ref={setRoot} style={{height:500,overflowY:'auto'}} data-testid="scroll-root"><TableScrollContext.Provider value={{root,inset:0,setInset:()=>{}}}>{content}</TableScrollContext.Provider></div>:content}</>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
