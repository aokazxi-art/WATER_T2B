import { useState } from 'react';
import HomePage from './pages/HomePage';
import PondDetailPage from './pages/PondDetailPage';
import { usePondData } from './hooks/usePondData';

export default function App() {
  const { ponds, updatePond, setSensorDistance, getPondState } = usePondData();
  const [selectedPondId, setSelectedPondId] = useState(null);

  if (selectedPondId != null) {
    return (
      <PondDetailPage
        pondId={selectedPondId}
        getPondState={getPondState}
        updatePond={updatePond}
        setSensorDistance={setSensorDistance}
        onBack={() => setSelectedPondId(null)}
      />
    );
  }

  return (
    <HomePage
      ponds={ponds}
      getPondState={getPondState}
      onSelectPond={setSelectedPondId}
    />
  );
}
