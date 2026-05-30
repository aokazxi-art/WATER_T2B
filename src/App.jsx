import { useState } from 'react';
import HomePage from './pages/HomePage';
import PondDetailPage from './pages/PondDetailPage';
import { usePondData } from './hooks/usePondData';

export default function App() {
  // โหลดข้อมูลบ่อและฟังก์ชันต่างๆ จาก hook
  const { ponds, updatePond, setSensorDistance, getPondState } = usePondData();

  // เก็บ id ของบ่อที่เลือกดูรายละเอียด (null = อยู่หน้าหลัก)
  const [selectedPondId, setSelectedPondId] = useState(null);

  // ถ้าเลือกบ่อแล้ว ให้แสดงหน้ารายละเอียดบ่อนั้น
  if (selectedPondId != null) {
    return (
      <PondDetailPage
        pondId={selectedPondId}
        getPondState={getPondState}
        updatePond={updatePond}
        setSensorDistance={setSensorDistance}
        onBack={() => setSelectedPondId(null)} // กดย้อนกลับ → ล้าง selection
      />
    );
  }

  // แสดงหน้าหลัก รายการบ่อทั้งหมด
  return (
    <HomePage
      ponds={ponds}
      getPondState={getPondState}
      onSelectPond={setSelectedPondId}
    />
  );
}
