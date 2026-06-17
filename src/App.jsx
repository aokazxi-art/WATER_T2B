import { useState, useEffect } from 'react';
import HomePage from './pages/HomePage';
import PondDetailPage from './pages/PondDetailPage';
import PondSettingsPage from './pages/PondSettingsPage';
import ConnectionPage from './pages/ConnectionPage';
import LoginPage from './pages/LoginPage';
import DevPage from './pages/DevPage';
import { usePondData } from './hooks/usePondData';
import { loadSession, clearSession } from './auth/auth';

export default function App() {
  const { ponds, updatePond, addPond, removePond, getPondState, sensorMeta, isConnected, clearPondHistory } = usePondData();

  const [user, setUser]         = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [page, setPage] = useState('home');
  const [selectedPondId, setSelectedPondId] = useState(null);

  useEffect(() => {
    loadSession().then(u => { setUser(u); setAuthReady(true); });
  }, []);

  const isAdmin = user?.role === 'admin';

  function handleLogin(u) { setUser(u); setPage('home'); }
  function handleLogout() { clearSession(); setUser(null); setPage('home'); setSelectedPondId(null); }

  function openDetail(id)    { setSelectedPondId(id); setPage('detail'); }
  function openSettings()    { setPage('settings'); }
  function backFromSettings(){ setPage('detail'); }
  function backFromDetail()  { setSelectedPondId(null); setPage('home'); }

  if (!authReady) return null;
  if (!user) return <LoginPage onLogin={handleLogin} />;

  if (page === 'dev' && isAdmin) {
    return (
      <DevPage
        ponds={ponds}
        onBack={() => setPage('home')}
      />
    );
  }

  if (page === 'connection' && isAdmin) {
    return (
      <ConnectionPage
        ponds={ponds}
        sensorMeta={sensorMeta}
        isConnected={isConnected}
        onBack={() => setPage('home')}
        addPond={addPond}
        removePond={removePond}
        updatePond={updatePond}
        clearPondHistory={clearPondHistory}
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  if (page === 'settings' && isAdmin && selectedPondId != null) {
    const state = getPondState(selectedPondId);
    if (!state) return null;
    return (
      <PondSettingsPage
        pond={state.pond}
        onUpdate={(updates) => updatePond(selectedPondId, updates)}
        onBack={backFromSettings}
        user={user}
        onLogout={handleLogout}
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
        onOpenSettings={isAdmin ? openSettings : null}
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <HomePage
      ponds={ponds}
      getPondState={getPondState}
      isConnected={isConnected}
      onSelectPond={openDetail}
      onOpenConnection={isAdmin ? () => setPage('connection') : null}
      onOpenDev={isAdmin ? () => setPage('dev') : null}
      user={user}
      onLogout={handleLogout}
    />
  );
}
