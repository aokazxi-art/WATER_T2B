import { useState } from 'react';
import HomePage from './pages/HomePage';
import PondDetailPage from './pages/PondDetailPage';
import PondSettingsPage from './pages/PondSettingsPage';
import ConnectionPage from './pages/ConnectionPage';
import { usePondData } from './hooks/usePondData';

// หน้าที่เป็นไปได้: 'home' | 'detail' | 'settings' | 'connection'
export default function App() {
  const { ponds, updatePond, addPond, removePond, getPondState, sensorMeta, isConnected } = usePondData();

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

  if (page === 'connection') {
    return (
      <ConnectionPage
        ponds={ponds}
        sensorMeta={sensorMeta}
        isConnected={isConnected}
        onBack={() => setPage('home')}
        addPond={addPond}
        removePond={removePond}
        updatePond={updatePond}
      />
    );
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
      isConnected={isConnected}
      onSelectPond={openDetail}
      onOpenConnection={() => setPage('connection')}
    />
  );
}
