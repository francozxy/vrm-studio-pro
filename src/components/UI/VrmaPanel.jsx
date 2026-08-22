import { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function VrmaPanel({
  vrmList = [],
  activeVrmIndex = 0,
  isPlaying = false,
  setIsPlaying,
  currentTime = 0,
  setCurrentTime,
  maxDuration = 10,
  setMaxDuration,
  onFreezeFrame,
  vrmaList = [],
  onApplyVrmaPreset
}) {
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isLooping, setIsLooping] = useState(true);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(maxDuration);
  const fileInputRef = useRef(null);

  const activeAvatar = vrmList[activeVrmIndex];

  useEffect(() => {
    setTrimEnd(maxDuration);
  }, [maxDuration]);

  // Manejo de velocidad de animación
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (activeAvatar?.mixer) {
      activeAvatar.mixer.timeScale = speed;
    }
  };

  // Alternar Bucle
  const handleLoopToggle = () => {
    const nextLoop = !isLooping;
    setIsLooping(nextLoop);
    if (activeAvatar?.mixer && activeAvatar.clip) {
      const action = activeAvatar.mixer.clipAction(activeAvatar.clip);
      action.setLoop(nextLoop ? THREE.LoopRepeat : THREE.LoopOnce);
      action.clampWhenFinished = !nextLoop;
    }
  };

  // Carga de archivo .vrma local desde el móvil
  const handleLocalVrmaUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    if (onApplyVrmaPreset) {
      onApplyVrmaPreset(objectUrl);
    }
    e.target.value = '';
  };

  // Control manual del Timeline (Scrubbing)
  const handleSeek = (e) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (activeAvatar?.mixer && activeAvatar.clip) {
      activeAvatar.mixer.setTime(targetTime);
    }
  };

  // Reproducir / Pausar
  const togglePlayPause = () => {
    const nextState = !isPlaying;
    if (setIsPlaying) setIsPlaying(nextState);
    if (activeAvatar?.mixer && activeAvatar.clip) {
      const action = activeAvatar.mixer.clipAction(activeAvatar.clip);
      if (nextState) {
        action.paused = false;
        action.play();
      } else {
        action.paused = true;
      }
    }
  };

  // Reiniciar
  const handleResetTime = () => {
    setCurrentTime(trimStart);
    if (activeAvatar?.mixer) {
      activeAvatar.mixer.setTime(trimStart);
    }
  };

  return (
    <div className="panel-content" style={{ paddingTop: '8px' }}>
      <div className="section-box">
        <div className="section-title">🎬 Reproductor y Edición VRMA</div>
        
        <div style={{ fontSize: '12px', color: '#c0caf5', marginBottom: '8px' }}>
          Avatar activo: <span style={{ color: '#7aa2f7', fontWeight: 'bold' }}>{activeAvatar?.name || 'Ninguno'}</span>
        </div>

        {/* Selector de Catálogo */}
        <label style={{ fontSize: '11px' }}>Animación / Pose del Catálogo:</label>
        <select
          style={{ width: '100%', padding: '8px', fontSize: '12px', marginBottom: '8px' }}
          onChange={(e) => {
            if (e.target.value && onApplyVrmaPreset) {
              onApplyVrmaPreset(e.target.value);
            }
          }}
          defaultValue=""
        >
          <option value="" disabled>Seleccionar animación del catálogo...</option>
          {vrmaList.map((item, idx) => (
            <option key={idx} value={item.url || item.path || item}>
              {item.name || item.title || `Animación ${idx + 1}`}
            </option>
          ))}
        </select>

        {/* Subir archivo local */}
        <input
          type="file"
          accept=".vrma,.glb,.gltf"
          ref={fileInputRef}
          onChange={handleLocalVrmaUpload}
          style={{ display: 'none' }}
        />
        <button
          className="tab-btn"
          style={{ width: '100%', background: '#2ac3de', color: '#1a1b26', fontWeight: 'bold', padding: '8px', marginBottom: '10px' }}
          onClick={() => fileInputRef.current?.click()}
        >
          📁 Subir Archivo .VRMA
        </button>

        {/* Botones de Control Principal */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <button
            className="tab-btn"
            style={{ flex: 1, background: isPlaying ? '#f7768e' : '#9ece6a', color: '#1a1b26', fontWeight: 'bold', padding: '10px' }}
            onClick={togglePlayPause}
          >
            {isPlaying ? '⏸ Pausar' : '▶ Reproducir'}
          </button>
          <button
            className="tab-btn"
            style={{ background: '#bb9af7', color: '#1a1b26', fontWeight: 'bold', padding: '10px 14px' }}
            onClick={handleResetTime}
            title="Reiniciar"
          >
            ⏮
          </button>
          <button
            className="tab-btn"
            style={{ background: isLooping ? '#7aa2f7' : '#414868', color: '#fff', fontWeight: 'bold', padding: '10px 14px' }}
            onClick={handleLoopToggle}
            title="Repetición"
          >
            🔁 {isLooping ? 'On' : 'Off'}
          </button>
        </div>

        {/* Timeline Scrubbing */}
        <div style={{ background: '#13141f', padding: '10px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #282a36' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#c0caf5', marginBottom: '4px' }}>
            <span>Tiempo: <b style={{ color: '#7dcfff' }}>{currentTime.toFixed(2)}s</b></span>
            <span>Duración: <b style={{ color: '#7dcfff' }}>{maxDuration.toFixed(2)}s</b></span>
          </div>
          <input
            type="range"
            min="0"
            max={maxDuration || 10}
            step="0.01"
            value={currentTime}
            onChange={handleSeek}
            style={{ width: '100%', accentColor: '#7aa2f7' }}
          />
        </div>

        {/* Selector de Velocidad */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', color: '#bb9af7', fontWeight: 'bold', marginBottom: '4px' }}>
            ⚡ Velocidad de Reproducción:
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[0.25, 0.5, 1.0, 1.5, 2.0].map((spd) => (
              <button
                key={spd}
                className="tab-btn"
                style={{
                  flex: 1,
                  padding: '5px 2px',
                  fontSize: '11px',
                  background: playbackSpeed === spd ? '#7aa2f7' : '#1a1b26',
                  color: playbackSpeed === spd ? '#1a1b26' : '#c0caf5',
                  fontWeight: 'bold'
                }}
                onClick={() => handleSpeedChange(spd)}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Recorte (Trim In / Out) */}
        <div style={{ background: '#13141f', padding: '8px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #282a36' }}>
          <div style={{ fontSize: '11px', color: '#e0af68', fontWeight: 'bold', marginBottom: '6px' }}>
            ✂️ Rango de Reproducción (Trim):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
            <div>
              Inicio (s):
              <input
                type="number"
                step="0.1"
                min="0"
                max={trimEnd}
                value={trimStart}
                onChange={(e) => setTrimStart(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '4px', marginTop: '2px' }}
              />
            </div>
            <div>
              Fin (s):
              <input
                type="number"
                step="0.1"
                min={trimStart}
                max={maxDuration}
                value={trimEnd}
                onChange={(e) => setTrimEnd(parseFloat(e.target.value) || maxDuration)}
                style={{ width: '100%', padding: '4px', marginTop: '2px' }}
              />
            </div>
          </div>
        </div>

        {/* Congelar fotograma */}
        <button
          className="tab-btn"
          style={{ width: '100%', background: '#7aa2f7', color: '#1a1b26', fontWeight: 'bold', padding: '10px' }}
          onClick={onFreezeFrame}
        >
          ❄️ Congelar Fotograma como Pose
        </button>
      </div>
    </div>
  );
}
