import { createRoot } from 'react-dom/client';
import BorrowingPolicy, { BorrowingPolicyLink } from '../src/components/BorrowingPolicy';
import '../src/index.css';
const admin = new URLSearchParams(location.search).has('admin');
createRoot(document.getElementById('root')!).render(<main className="p-4"><BorrowingPolicy editable={admin}/><BorrowingPolicyLink/></main>);
