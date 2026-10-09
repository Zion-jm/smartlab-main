import { useState, type ReactNode } from 'react';
import DropdownField from '../../components/shared/DropdownField';
export default function UsageLocationField({value,options,onChange,label,loading}:{value:string;options:{label:string}[];onChange:(value:string)=>void;label:ReactNode;loading:boolean}) {
  const [otherSelected,setOtherSelected]=useState(false);
  const known=options.some(option=>option.label===value);
  const other=otherSelected || Boolean(value && !known);
  return <>
    <DropdownField label={label} value={other ? '__other__' : value} options={[...options.map(option=>({value:option.label,label:option.label})),{value:'__other__',label:'Other'}]} placeholder="Select usage location" disabled={loading} onChange={next=>{setOtherSelected(next==='__other__');onChange(next==='__other__'?'':next);}} />
    {other && <label className="mt-3 block text-xs text-[#786565]">Venue / address <span aria-hidden="true">*</span><input aria-label="Venue / address" required maxLength={500} className="mt-1 min-h-11 w-full rounded-xl border border-[#d8c7c3] px-3 text-sm" value={value} onChange={event=>onChange(event.target.value)} /></label>}
    <p className="mt-2 text-xs text-[#786565]">For tracking only. This does not reserve the room.</p>
  </>;
}
