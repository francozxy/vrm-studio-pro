import { useState } from 'react';

export default function ScenePanel({
  lightIntensity,
  setLightIntensity,
  dirX,
  setDirX,
  dirY,
  setDirY,
  showGrid,
  setShowGrid,
  disableFrustumCulling,
  setDisableFrustumCulling,
  bgVideoSrc,
  setBgVideoSrc,
  videoScale,
  setVideoScale,
  skyboxSrc,
  setSkyboxSrc,
  stageList = [],
  handleStageUpload,
  handleDeleteStage,
  propList = [],
  handlePropUpload,
  handleDeleteProp,
  handlePropTransformChange,
  selectedPropIndex = null,
  setSelectedPropIndex,
  propGizmoMode = 'translate',
  setPropGizmoMode,
  // --- Estados de viento globales que vienen de App.jsx ---
  windEnabled = false,
  setWindEnabled,
  windStrength = 1.0,
  setWindStrength,
  windFrequency = 4.5,
  setWindFrequency,
  windDirX = 0.4,
  setWindDirX,
  windDirZ = 0.0,
  setWindDirZ,
  windLift = 0.5,
  setWindLift
}) {
  // Estados de Partículas Estilo MMD
  const [particleType, setParticleType] = useState('none');
  const [particleDensity, setParticleDensity] = useState(150);

  const updateWindGlobals = (enabled, strength, x, z, freq, lift) => {
    window.__windEnabled = enabled;
    window.__windStrength = strength;
    window.__windDirX = x;
    window.__windDirZ = z;
    window.__windSpeed = freq;
    window.__windLift = lift;
  };

  const handleWindToggle = (checked) => {
    if (setWindEnabled) setWindEnabled(checked);
    updateWindGlobals(checked, windStrength, windDirX, windDirZ, windFrequency, windLift);
  };

  const handleParticleTypeChange = (type) => {
    setParticleType(type);
    window.__particleType = type;
    window.__particleDensity = particleDensity;
    if (window.__triggerParticleUpdate) window.__triggerParticleUpdate();
  };

  const handleParticleDensityChange = (density) => {
    setParticleDensity(density);
    window.__particleDensity = density;
    if (window.__triggerParticleUpdate) window.__triggerParticleUpdate();
  };

  const handleVideoFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setBgVideoSrc(url);
    }
  };

  return (
    <div className="panel-content">
      {/* ✨ Partículas de Ambiente (MMD) */}
      <div className="section-box">
        <div className="section-title">✨ Partículas de Ambiente (MMD)</div>
        
        <label style={{ fontSize: '12px' }}>Efecto Atmosférico:</label>
        <select
          value={particleType}
          onChange={(e) => handleParticleTypeChange(e.target.value)}
          style={{ width: '100%', padding: '8px', fontSize: '13px', marginBottom: '8px' }}
        >
          <option value="none">-- Sin Partículas --</option>
          <option value="sakura">🌸 Pétalos de Sakura (Cerezo)</option>
          <option value="autumn">🍁 Hojas de Otoño</option>
          <option value="snow">❄️ Nieve Suave</option>
          <option value="rain">🌧️ Lluvia Anime</option>
          <option value="sparks">✨ Destellos de Luz / Polvo</option>
        </select>

        {particleType !== 'none' && (
          <div style={{ marginTop: '6px', background: '#13141f', padding: '10px', borderRadius: '8px', border: '1px solid #282a36' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#c0caf5', marginBottom: '4px' }}>
              <span>Cantidad de Partículas:</span>
              <span style={{ color: '#7aa2f7', fontWeight: 'bold' }}>{particleDensity}</span>
            </div>
            <div style={{ width: '50%', margin: '0 auto' }}>
              <input
                type="range"
                min="30"
                max="400"
                step="10"
                value={particleDensity}
                onChange={(e) => handleParticleDensityChange(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#7aa2f7', cursor: 'pointer' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 🌬️ Física de Viento (Persistente al ocultar menú) */}
      <div className="section-box">
        <div className="section-title">🌬️ Viento y Física</div>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={windEnabled}
            onChange={(e) => handleWindToggle(e.target.checked)}
          />
          💨 Activar Viento (Pelo y Ropa)
        </label>

        {windEnabled && (
          <div style={{ marginTop: '10px', background: '#13141f', padding: '10px', borderRadius: '8px', border: '1px solid #282a36' }}>
            <label style={{ fontSize: '12px' }}>Fuerza del Viento: ({windStrength.toFixed(2)})</label>
            <div style={{ width: '50%', margin: '4px 0 10px 0' }}>
              <input
                type="range"
                min="0.0"
                max="10.0"
                step="0.05"
                value={windStrength}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (setWindStrength) setWindStrength(val);
                  updateWindGlobals(true, val, windDirX, windDirZ, windFrequency, windLift);
                }}
                style={{ width: '100%', accentColor: '#7aa2f7' }}
              />
            </div>

            <label style={{ fontSize: '12px' }}>Viento Vertical / Elevación: ({(windLift || 0).toFixed(2)})</label>
            <div style={{ width: '50%', margin: '4px 0 10px 0' }}>
              <input
                type="range"
                min="0.0"
                max="3.0"
                step="0.05"
                value={windLift}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (setWindLift) setWindLift(val);
                  updateWindGlobals(true, windStrength, windDirX, windDirZ, windFrequency, val);
                }}
                style={{ width: '100%', accentColor: '#7aa2f7' }}
              />
            </div>

            <label style={{ fontSize: '12px' }}>Frecuencia / Ráfaga: ({windFrequency.toFixed(1)}x)</label>
            <div style={{ width: '50%', margin: '4px 0 10px 0' }}>
              <input
                type="range"
                min="0.5"
                max="6.0"
                step="0.5"
                value={windFrequency}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (setWindFrequency) setWindFrequency(val);
                  updateWindGlobals(true, windStrength, windDirX, windDirZ, val, windLift);
                }}
                style={{ width: '100%', accentColor: '#7aa2f7' }}
              />
            </div>

            <label style={{ fontSize: '12px' }}>Dirección X (Lateral): ({windDirX.toFixed(1)})</label>
            <div style={{ width: '50%', margin: '4px 0 10px 0' }}>
              <input
                type="range"
                min="-1.0"
                max="1.0"
                step="0.1"
                value={windDirX}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (setWindDirX) setWindDirX(val);
                  updateWindGlobals(true, windStrength, val, windDirZ, windFrequency, windLift);
                }}
                style={{ width: '100%', accentColor: '#7aa2f7' }}
              />
            </div>

            <label style={{ fontSize: '12px' }}>Dirección Z (Frente/Atrás): ({windDirZ.toFixed(1)})</label>
            <div style={{ width: '50%', margin: '4px 0 0 0' }}>
              <input
                type="range"
                min="-1.0"
                max="1.0"
                step="0.1"
                value={windDirZ}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (setWindDirZ) setWindDirZ(val);
                  updateWindGlobals(true, windStrength, windDirX, val, windFrequency, windLift);
                }}
                style={{ width: '100%', accentColor: '#7aa2f7' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 🌌 Cielo / Skybox 360° */}
      <div className="section-box">
        <div className="section-title">🌌 Cielo 360° (Skybox)</div>
        <label style={{ fontSize: '11px' }}>Cargar Imagen Panorámica (.jpg, .png):</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && setSkyboxSrc) setSkyboxSrc(URL.createObjectURL(file));
          }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '8px' }}>
          <button 
            className="tab-btn" 
            style={{ fontSize: '11px' }}
            onClick={() => setSkyboxSrc && setSkyboxSrc('day')}
          >
            ☀️ Día Anime
          </button>
          <button 
            className="tab-btn" 
            style={{ fontSize: '11px' }}
            onClick={() => setSkyboxSrc && setSkyboxSrc('sunset')}
          >
            🌅 Atardecer
          </button>
          <button 
            className="tab-btn" 
            style={{ fontSize: '11px' }}
            onClick={() => setSkyboxSrc && setSkyboxSrc('night')}
          >
            🌙 Noche Estrellada
          </button>
          <button 
            className="tab-btn" 
            style={{ fontSize: '11px', backgroundColor: '#f7768e', color: '#fff' }}
            onClick={() => setSkyboxSrc && setSkyboxSrc(null)}
          >
            🚫 Sin Cielo
          </button>
        </div>
      </div>

      {/* 🎞️ Video de Fondo */}
      <div className="section-box">
        <div className="section-title">🎞️ Video de Fondo</div>
        <input type="file" accept="video/mp4,video/webm" onChange={handleVideoFile} />
        {bgVideoSrc && (
          <div style={{ marginTop: '8px' }}>
            <label style={{ fontSize: '12px' }}>Escala del Video: ({videoScale}%)</label>
            <div style={{ width: '50%', margin: '4px 0' }}>
              <input
                type="range"
                min="30"
                max="200"
                step="5"
                value={videoScale}
                onChange={(e) => setVideoScale(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#7aa2f7' }}
              />
            </div>
            <button
              onClick={() => setBgVideoSrc(null)}
              style={{ marginTop: '6px', background: '#f7768e', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
            >
              🗑️ Quitar Video
            </button>
          </div>
        )}
      </div>

      {/* 💡 Iluminación y Visualización */}
      <div className="section-box">
        <div className="section-title">💡 Iluminación y Visualización</div>
        
        <label>Intensidad Luz:</label>
        <div style={{ width: '50%', margin: '4px 0 10px 0' }}>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={lightIntensity}
            onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '6px' }}>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />
          📐 Mostrar Cuadrícula (Piso)
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px' }}>
          <input
            type="checkbox"
            checked={disableFrustumCulling}
            onChange={(e) => setDisableFrustumCulling(e.target.checked)}
          />
          👁️ Desactivar Oclusión (Evitar que desaparezca al alejarlo)
        </label>
      </div>

      {/* 🏞️ Escenarios y Props Multiformato */}
      <div className="section-box">
        <div className="section-title">🏞️ Escenario / Props (.glb, .obj, .fbx, .pmx, .zip)</div>
        
        <label>Cargar Escenario (.glb, .obj, .fbx, .pmx, .zip):</label>
        <input
          type="file"
          accept=".glb,.gltf,.obj,.fbx,.pmx,.zip"
          onChange={handleStageUpload}
        />

        {stageList.length > 0 && (
          <div style={{ marginTop: '8px', marginBottom: '12px' }}>
            {stageList.map((stg, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1b26', padding: '6px 8px', borderRadius: '4px', marginBottom: '4px', border: '1px solid #2f354a' }}>
                <span style={{ fontSize: '12px', color: '#c0caf5' }}>🏛️ {stg.name}</span>
                <button onClick={() => handleDeleteStage(idx)} style={{ background: 'transparent', border: 'none', color: '#f7768e', cursor: 'pointer' }}>❌</button>
              </div>
            ))}
          </div>
        )}

        <label style={{ marginTop: '10px' }}>Cargar Accesorio / Prop (.glb, .obj, .fbx, .pmx, .zip):</label>
        <input
          type="file"
          accept=".glb,.gltf,.obj,.fbx,.pmx,.zip"
          onChange={handlePropUpload}
        />

        {/* 🕹️ Barra de herramientas del Gizmo para Prop */}
        {selectedPropIndex !== null && propList[selectedPropIndex] && (
          <div style={{ marginTop: '10px', background: '#13141f', padding: '8px', borderRadius: '6px', border: '1px solid #414868' }}>
            <div style={{ fontSize: '11px', color: '#bb9af7', fontWeight: 'bold', marginBottom: '6px' }}>
              🕹️ Modo Transformar: <span style={{ color: '#7dcfff' }}>{propList[selectedPropIndex].name}</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
              <button
                className="tab-btn"
                style={{ flex: 1, padding: '4px', fontSize: '11px', background: propGizmoMode === 'translate' ? '#7aa2f7' : '#1a1b26', color: propGizmoMode === 'translate' ? '#1a1b26' : '#c0caf5', fontWeight: 'bold' }}
                onClick={() => setPropGizmoMode && setPropGizmoMode('translate')}
              >
                Mover
              </button>
              <button
                className="tab-btn"
                style={{ flex: 1, padding: '4px', fontSize: '11px', background: propGizmoMode === 'rotate' ? '#7aa2f7' : '#1a1b26', color: propGizmoMode === 'rotate' ? '#1a1b26' : '#c0caf5', fontWeight: 'bold' }}
                onClick={() => setPropGizmoMode && setPropGizmoMode('rotate')}
              >
                Rotar
              </button>
              <button
                className="tab-btn"
                style={{ flex: 1, padding: '4px', fontSize: '11px', background: propGizmoMode === 'scale' ? '#7aa2f7' : '#1a1b26', color: propGizmoMode === 'scale' ? '#1a1b26' : '#c0caf5', fontWeight: 'bold' }}
                onClick={() => setPropGizmoMode && setPropGizmoMode('scale')}
              >
                Escalar
              </button>
            </div>
            <button
              style={{ width: '100%', padding: '4px', fontSize: '10px', background: '#2f354a', color: '#a9b1d6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              onClick={() => setSelectedPropIndex && setSelectedPropIndex(null)}
            >
              Soltar Selección (Desactivar Gizmo)
            </button>
          </div>
        )}

        {/* 📦 Lista de Props */}
        <div style={{ maxHeight: '180px', overflowY: 'auto', marginTop: '8px' }}>
          {propList.map((prop, idx) => (
            <div
              key={idx}
              style={{
                background: selectedPropIndex === idx ? '#24283b' : '#13141f',
                border: selectedPropIndex === idx ? '1px solid #7aa2f7' : '1px solid #282a36',
                padding: '8px',
                borderRadius: '6px',
                marginTop: '6px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span
                  style={{ fontSize: '12px', color: selectedPropIndex === idx ? '#7dcfff' : '#7aa2f7', fontWeight: 'bold', cursor: 'pointer' }}
                  onClick={() => setSelectedPropIndex && setSelectedPropIndex(selectedPropIndex === idx ? null : idx)}
                >
                  {selectedPropIndex === idx ? '🎯' : '📦'} {prop.name}
                </span>
                <button
                  onClick={() => {
                    if (selectedPropIndex === idx && setSelectedPropIndex) setSelectedPropIndex(null);
                    handleDeleteProp(idx);
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#f7768e', cursor: 'pointer' }}
                >
                  ❌
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px', fontSize: '11px' }}>
                <div>
                  X: <input type="number" step="0.1" value={prop.px} onChange={(e) => handlePropTransformChange(idx, 'px', e.target.value)} style={{ width: '100%', padding: '2px', fontSize: '10px' }} />
                </div>
                <div>
                  Y: <input type="number" step="0.1" value={prop.py} onChange={(e) => handlePropTransformChange(idx, 'py', e.target.value)} style={{ width: '100%', padding: '2px', fontSize: '10px' }} />
                </div>
                <div>
                  Z: <input type="number" step="0.1" value={prop.pz} onChange={(e) => handlePropTransformChange(idx, 'pz', e.target.value)} style={{ width: '100%', padding: '2px', fontSize: '10px' }} />
                </div>
                <div>
                  Escala: <input type="number" step="0.1" value={prop.scale} onChange={(e) => handlePropTransformChange(idx, 'scale', e.target.value)} style={{ width: '100%', padding: '2px', fontSize: '10px' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
