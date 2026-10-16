import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import EquipmentReturnModal from '../src/components/admin/EquipmentReturnModal';
import ReturnHistory from '../src/components/shared/ReturnHistory';
import '../src/index.css';
export function Harness(){const [open,setOpen]=useState(true);return <main><button onClick={()=>setOpen(true)}>Open return</button><ReturnHistory items={[{id:'i',quantity:4,returnedGood:2,returnedDamaged:1}]} events={[{id:'event',actorName:'Test Admin',createdAt:'2026-10-16T06:30:00Z',notes:'Broken keys. Remaining unit due tomorrow.',lines:[{itemId:'i',equipmentId:'e',equipmentName:'Keyboard',good:2,damaged:1,outstandingAfter:1}]}]}/>{open&&<EquipmentReturnModal request={{id:'r',updatedAt:'2026-10-16T00:00:00Z',items:[{id:'i',equipmentName:'Keyboard',quantity:4,returnedGood:0,returnedDamaged:0}]}} onClose={()=>setOpen(false)} onSaved={()=>setOpen(false)}/>}</main>;}createRoot(document.getElementById('root')!).render(<Harness/>);
