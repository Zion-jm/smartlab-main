import { createContext } from 'react';
export const TableScrollContext = createContext<{root: HTMLElement | null; inset: number; setInset: (value: number) => void}>({root:null,inset:0,setInset:()=>{}});
export const TablePanelContext = createContext(true);
