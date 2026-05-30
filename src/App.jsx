import { useState } from 'react';
import HomePage from './pages/HomePage';
import PondDetailPage from './pages/PondDetailPage';
import PondSettingsPage from './pages/PondSettingsPage';
import { usePondData } from './hooks/usePondData';

// หน้าที่เป็นไปได้: 'home' | 'detail' | 'settings'
export default function App() {
  const { ponds, updatePond, setSensorDistance, getPondState } = usePondData();

  const [page, setPage] = useState('home');          // หน้าปัจจุบัน
  const [selectedPondId, setSelectedPondId] = useState(null); // บ่อที่เลือก

  // เปิดหน้ารายละเอียดบ่อ
  function openDetail(id) {
    setSelectedPondId(id);
    setPage('detail');
  }

  // เปิดหน้าตั้งค่า (จากปุ่มฟันเฟืองในหน้า detail)
  function openSettings() {
    setPage('settings');
  }

  // ย้อนกลับจากหน้าตั้งค่า → หน้า detail
  function backFromSettings() {
    setPage('detail');
  }

  // ย้อนกลับจากหน้า detail → หน้าหลัก
  function backFromDetail() {
    setSelectedPondId(null);
    setPage('home');
  }

  if (page === 'settings' && selectedPondId != null) {
    const state = getPondState(selectedPondId);
    if (!state) return null;
    return (
      <PondSettingsPage
        pond={state.pond}
        onUpdate={(updates) => updatePond(selectedPondId, updates)}
        onBack={backFromSettings}
      />
    );
  }

  if (page === 'detail' && selectedPondId != null) {
    return (
      <PondDetailPage
        pondId={selectedPondId}
        getPondState={getPondState}
        updatePond={updatePond}
        setSensorDistance={setSensorDistance}
        onBack={backFromDetail}
        onOpenSettings={openSettings}
      />
    );
  }

  // หน้าหลัก รายการบ่อทั้งหมด
  return (
    <HomePage
      ponds={ponds}
      getPondState={getPondState}
      onSelectPond={openDetail}
    />
  );
}
