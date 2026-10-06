import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import UsageLocationField from '../src/features/requests/UsageLocationField';
import RequestSubmittedDialog from '../src/features/requests/RequestSubmittedDialog';
import '../src/index.css';
function Harness(){const [value,setValue]=useState(new URLSearchParams(location.search).get('value') || '');const [submitted,setSubmitted]=useState(false);const [view,setView]=useState(false);return <main className="p-4"><UsageLocationField value={value} options={[{label:'101 · ICT Lab'}]} onChange={setValue} label="Usage Location" loading={false}/><output>{value}</output><button onClick={()=>setSubmitted(true)}>Simulate confirmed submission</button>{submitted && <RequestSubmittedDialog id="request-123456" onClose={()=>setSubmitted(false)} onView={()=>{setSubmitted(false);setView(true)}}/>}{view && <p>My Requests opened</p>}</main>};createRoot(document.getElementById('root')!).render(<Harness/>);
