export default function StylePanel({
  lightIntensity,
  setLightIntensity,
  dirX,
  setDirX,
  dirY,
  setDirY,
  dirZ,
  setDirZ,
  shadowStrength,
  setShadowStrength,
  toonIntensity,
  setToonIntensity,
  shadeColor,
  setShadeColor,
  outlineEnabled,
  setOutlineEnabled,
  outlineWidth,
  setOutlineWidth,
  outlineColor,
  setOutlineColor,
  rimIntensity,
  setRimIntensity
}) {
  return (
    <>
      {/* 1. ILUMINACIÓN Y SOMBRAS PROYECTADAS */}
      <div className="section-box">
        <div className="section-title">💡 Luz y Sombras Reales</div>
        
        <label>Intensity (Intensidad Luz): ({lightIntensity})</label>
        <input 
          type="range" 
          min="0" 
          max="4" 
          step="0.1" 
          value={lightIntensity} 
          onChange={(e) => setLightIntensity(parseFloat(e.target.value))} 
        />

        <label style={{ marginTop: '6px' }}>Direction X: ({dirX})</label>
        <input 
          type="range" 
          min="-10" 
          max="10" 
          step="0.5" 
          value={dirX} 
          onChange={(e) => setDirX(parseFloat(e.target.value))} 
        />

        <label style={{ marginTop: '6px' }}>Direction Y: ({dirY})</label>
        <input 
          type="range" 
          min="1" 
          max="20" 
          step="0.5" 
          value={dirY} 
          onChange={(e) => setDirY(parseFloat(e.target.value))} 
        />

        <label style={{ marginTop: '6px' }}>Direction Z (Profundidad): ({dirZ})</label>
        <input 
          type="range" 
          min="-10" 
          max="10" 
          step="0.5" 
          value={dirZ} 
          onChange={(e) => setDirZ(parseFloat(e.target.value))} 
        />

        <label style={{ marginTop: '6px' }}>Shadow Strength (Fuerza Sombra): ({shadowStrength})</label>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.05" 
          value={shadowStrength} 
          onChange={(e) => setShadowStrength(parseFloat(e.target.value))} 
        />
      </div>

      {/* 2. MATERIAL ANIMÉ / TOON */}
      <div className="section-box">
        <div className="section-title">🎨 Material MToon</div>
        
        <label>Toony (Corte Sombra): ({toonIntensity})</label>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.05" 
          value={toonIntensity} 
          onChange={(e) => setToonIntensity(parseFloat(e.target.value))} 
        />

        <label style={{ marginTop: '6px' }}>Color Sombra Toon:</label>
        <input 
          type="color" 
          value={shadeColor} 
          onChange={(e) => setShadeColor(e.target.value)}
          style={{ width: '100%', height: '32px', padding: '2px', cursor: 'pointer', marginBottom: '8px' }}
        />

        <label>Rim Light (Resplandor Borde): ({rimIntensity})</label>
        <input 
          type="range" 
          min="0" 
          max="2" 
          step="0.1" 
          value={rimIntensity} 
          onChange={(e) => setRimIntensity(parseFloat(e.target.value))} 
        />
      </div>

      {/* 3. OUTLINE */}
      <div className="section-box">
        <div className="section-title">✏️ Contorno / Outline</div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <input 
            type="checkbox" 
            id="toggle-outline"
            checked={outlineEnabled} 
            onChange={(e) => setOutlineEnabled(e.target.checked)} 
            style={{ width: 'auto', marginBottom: 0 }}
          />
          <label htmlFor="toggle-outline" style={{ marginTop: 0, cursor: 'pointer' }}>
            Activar Borde
          </label>
        </div>

        {outlineEnabled && (
          <>
            <label>Grosor Borde: ({outlineWidth})</label>
            <input 
              type="range" 
              min="0.0005" 
              max="0.01" 
              step="0.0005" 
              value={outlineWidth} 
              onChange={(e) => setOutlineWidth(parseFloat(e.target.value))} 
            />

            <label style={{ marginTop: '6px' }}>Color Borde:</label>
            <input 
              type="color" 
              value={outlineColor} 
              onChange={(e) => setOutlineColor(e.target.value)}
              style={{ width: '100%', height: '32px', padding: '2px', cursor: 'pointer' }}
            />
          </>
        )}
      </div>
    </>
  );
}
