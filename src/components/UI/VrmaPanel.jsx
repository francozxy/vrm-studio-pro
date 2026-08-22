export default function VrmaPanel({
  vrmList = [],
  activeVrmIndex = 0,
  isPlaying,
  setIsPlaying,
  currentTime,
  setCurrentTime,
  maxDuration,
  setMaxDuration,
  onFreezeFrame,
  vrmaList = [],
  onApplyVrmaPreset
}) {
  const currentAvatar = vrmList[activeVrmIndex];

  const handleCustomVrmaUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    if (onApplyVrmaPreset) {
      onApplyVrmaPreset(blobUrl);
    }
  };

  const handleTimelineSeek = (time) => {
    const newTime = parseFloat(time);
    setCurrentTime(newTime);
    if (currentAvatar?.mixer) {
      currentAvatar.mixer.setTime(newTime);
    }
  };

  const handleResetPose = () => {
    if (currentAvatar?.vrm?.humanoid) {
      currentAvatar.vrm.humanoid.resetNormalizedPose();
      if (currentAvatar.offsets) {
        Object.keys(currentAvatar.offsets).forEach((k) => delete currentAvatar.offsets[k]);
      }
    }
    if (currentAvatar?.mixer) {
      currentAvatar.mixer.stopAllAction();
      currentAvatar.mixer.setTime(0);
    }
    setCurrentTime(0);
    setIsPlaying(false);
  };

  return (
    <div className="panel-container">
      <div className="section-card">
        <h3 style={{color: 'green' }}>🎬 Reproductor y Edición VRMA</h3>

        <p style={{ fontSize: '12px', color: '#a9b1d6', margin: '0 0 12px 0' }}>
          Avatar activo: <strong>{currentAvatar?.name || 'Ninguno'}</strong>
        </p>

        {/* 1. SELECCIÓN O CARGA DE ANIMACIÓN */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', color: '#a9b1d6', display: 'block', marginBottom: '6px' }}>
            Animación / Pose VRMA:
          </label>
          
          <select
            onChange={(e) => {
              if (e.target.value && onApplyVrmaPreset) {
                onApplyVrmaPreset(e.target.value);
              }
            }}
            defaultValue=""
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '13px',
              background: '#1a1b26',
              color: '#c0caf5',
              border: '1px solid #414868',
              borderRadius: '6px',
              marginBottom: '8px'
            }}
          >
            <option value="" disabled>Seleccionar animación del catálogo...</option>
            {vrmaList.map((item, idx) => (
              <option key={idx} value={item.url || item.path || item}>
                {item.name || `Animación ${idx + 1}`}
              </option>
            ))}
          </select>

          <label
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#2ac3de',
              color: '#1a1b26',
              fontWeight: 'bold',
              borderRadius: '6px',
              padding: '8px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            📂 Subir Archivo .VRMA
            <input
              type="file"
              accept=".vrma,.glb,.gltf"
              onChange={handleCustomVrmaUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {/* 2. CONTROLES DE REPRODUCCIÓN */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              flex: 1,
              background: isPlaying ? '#e0af68' : '#9ece6a',
              color: '#1a1b26',
              border: 'none',
              borderRadius: '6px',
              padding: '10px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {isPlaying ? '⏸️ Pausar' : '▶️ Reproducir'}
          </button>

          <button
            onClick={handleResetPose}
            style={{
              background: '#414868',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 14px',
              cursor: 'pointer'
            }}
            title="Resetear Pose y Tiempo"
          >
            ⏮️
          </button>
        </div>

        {/* 3. LÍNEA DE TIEMPO INTERACTIVA */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#c0caf5', marginBottom: '4px' }}>
            <span>Tiempo: {currentTime.toFixed(2)}s</span>
            <span>Duración: {maxDuration.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min="0"
            max={maxDuration || 1}
            step="0.01"
            value={currentTime}
            onChange={(e) => handleTimelineSeek(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        {/* 4. CONFIGURACIÓN DE DURACIÓN MÁXIMA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', color: '#a9b1d6' }}>Max Duración:</span>
          <input
            type="number"
            min="1"
            max="300"
            value={maxDuration}
            onChange={(e) => setMaxDuration(Math.max(1, parseFloat(e.target.value) || 1))}
            style={{
              width: '60px',
              padding: '4px',
              borderRadius: '4px',
              border: '1px solid #414868',
              background: '#1a1b26',
              color: '#fff'
            }}
          />
          <span style={{ fontSize: '12px', color: '#a9b1d6' }}>seg</span>
        </div>

        {/* 5. CONGELAR FOTOGRAMA */}
        <button
          onClick={onFreezeFrame}
          style={{
            background: '#7aa2f7',
            color: '#1a1b26',
            fontWeight: 'bold',
            padding: '12px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            boxShadow: '0 2px 8px rgba(122, 162, 247, 0.3)'
          }}
        >
          ❄️ Congelar Fotograma como Pose
        </button>
      </div>
    </div>
  );
}
