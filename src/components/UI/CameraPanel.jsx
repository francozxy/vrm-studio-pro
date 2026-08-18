import { useEffect, useState } from 'react';
import { loadVmdCameraFile } from '../../utils/CameraLoader';

export default function CameraPanel({
  fov,
  setFov,
  onApplyCameraPreset,
  isCameraLockedToTrack,
  setIsCameraLockedToTrack,
  setCameraClip,
  cameraFile,
  setCameraFile,
  cameraFileName,
  setCameraFileName,
  camScale,
  setCamScale,
  offsetY,
  setOffsetY,
  offsetZ,
  setOffsetZ,
  isPlayingCamera,
  setIsPlayingCamera
}) {
  const [telemetry, setTelemetry] = useState({ x: 0, y: 1.2, z: 2.5 });

  useEffect(() => {
    const timer = setInterval(() => {
      if (window.__cameraTelemetry) {
        setTelemetry({
          x: window.__cameraTelemetry.x || 0,
          y: window.__cameraTelemetry.y || 0,
          z: window.__cameraTelemetry.z || 0
        });
      }
    }, 50);
    return () => clearInterval(timer);
  }, []);

  const processVmd = async (file, scaleVal, yVal, zVal) => {
    if (!file) return;
    try {
      const clip = await loadVmdCameraFile(file, {
        scale: scaleVal,
        offsetY: yVal,
        offsetZ: zVal
      });
      setCameraClip(clip);
      setCameraFileName(file.name);
      setIsCameraLockedToTrack(true);
      window.__isCameraLockedToTrack = true;
      window.__isPlayingCamera = true;
      setIsPlayingCamera(true);
    } catch (err) {
      console.error('Error al procesar cámara VMD:', err);
      alert('Error al leer el archivo VMD de cámara.');
    }
  };

  const handleVmdCameraUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraFile(file);
    processVmd(file, camScale, offsetY, offsetZ);
  };

  const handleScaleChange = (val) => {
    setCamScale(val);
    if (cameraFile) processVmd(cameraFile, val, offsetY, offsetZ);
  };

  const handleOffsetYChange = (val) => {
    setOffsetY(val);
    if (cameraFile) processVmd(cameraFile, camScale, val, offsetZ);
  };

  const handleOffsetZChange = (val) => {
    setOffsetZ(val);
    if (cameraFile) processVmd(cameraFile, camScale, offsetY, val);
  };

  const togglePlay = () => {
    const nextState = !isPlayingCamera;
    setIsPlayingCamera(nextState);
    window.__isPlayingCamera = nextState;
  };

  return (
    <div className="section-box">
      <div className="section-title">🎥 Cinemática y Cámara</div>

      {/* Monitor XYZ */}
      <div style={{ background: '#13141f', padding: '10px', borderRadius: '8px', marginBottom: '14px', border: '1px solid #282a36' }}>
        <div style={{ fontSize: '11px', color: '#7dcfff', fontWeight: 'bold', marginBottom: '6px' }}>
          📡 Posición de Cámara (En vivo):
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold' }}>
          <div style={{ background: '#1a1b26', padding: '4px', borderRadius: '4px', textAlign: 'center' }}>
            <span style={{ color: '#f7768e' }}>X:</span> {Number(telemetry.x).toFixed(2)}m
          </div>
          <div style={{ background: '#1a1b26', padding: '4px', borderRadius: '4px', textAlign: 'center' }}>
            <span style={{ color: '#9ece6a' }}>Y:</span> {Number(telemetry.y).toFixed(2)}m
          </div>
          <div style={{ background: '#1a1b26', padding: '4px', borderRadius: '4px', textAlign: 'center' }}>
            <span style={{ color: '#7aa2f7' }}>Z:</span> {Number(telemetry.z).toFixed(2)}m
          </div>
        </div>
      </div>

      <label>Campo de Visión (FOV): {fov}°</label>
      <input
        type="range"
        min="20"
        max="90"
        step="1"
        value={fov}
        onChange={(e) => setFov(parseInt(e.target.value))}
        disabled={isCameraLockedToTrack}
      />

      <div style={{ marginTop: '10px', fontSize: '13px', color: '#a9b1d6' }}>Encuadres Rápidos:</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
        <button className="tab-btn" onClick={() => onApplyCameraPreset && onApplyCameraPreset('face')}>👤 Rostro</button>
        <button className="tab-btn" onClick={() => onApplyCameraPreset && onApplyCameraPreset('body')}>🧍 Cuerpo</button>
        <button className="tab-btn" onClick={() => onApplyCameraPreset && onApplyCameraPreset('top')}>📐 Cenital</button>
        <button className="tab-btn" onClick={() => onApplyCameraPreset && onApplyCameraPreset('reset')}>🔄 Reset</button>
      </div>

      <hr style={{ borderColor: '#2f354a', margin: '14px 0' }} />

      <label>📁 Importar Cámara MMD (.vmd):</label>
      <input
        type="file"
        accept=".vmd"
        onChange={handleVmdCameraUpload}
        style={{ fontSize: '12px' }}
      />

      {cameraFileName && (
        <div style={{ marginTop: '12px', background: '#1a1b26', padding: '10px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#7aa2f7', marginBottom: '8px', wordBreak: 'break-all' }}>
            🎬 Pista: <b>{cameraFileName}</b>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button
              className="tab-btn"
              style={{
                flex: 1,
                background: isPlayingCamera ? '#f7768e' : '#9ece6a',
                color: '#1a1b26',
                fontWeight: 'bold',
                padding: '8px'
              }}
              onClick={togglePlay}
            >
              {isPlayingCamera ? '⏸ Pausar Cámara' : '▶ Reproducir Cámara'}
            </button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '10px' }}>
            <input
              type="checkbox"
              checked={isCameraLockedToTrack}
              onChange={(e) => {
                setIsCameraLockedToTrack(e.target.checked);
                window.__isCameraLockedToTrack = e.target.checked;
              }}
            />
            Bloquear al recorrido VMD
          </label>

          {/* Calibración de Escala y Altura persistente */}
          <div style={{ borderTop: '1px solid #2f354a', paddingTop: '8px', marginTop: '6px' }}>
            <div style={{ fontSize: '11px', color: '#e0af68', fontWeight: 'bold', marginBottom: '6px' }}>🎯 Calibración de Encuadre:</div>
            
            <label style={{ fontSize: '12px' }}>Escala de Distancia: ({camScale.toFixed(2)})</label>
            <input type="range" min="0.01" max="0.3" step="0.01" value={camScale} onChange={(e) => handleScaleChange(parseFloat(e.target.value))} />

            <label style={{ fontSize: '12px' }}>Ajuste de Altura Y: ({offsetY.toFixed(2)}m)</label>
            <input type="range" min="-2.0" max="2.0" step="0.05" value={offsetY} onChange={(e) => handleOffsetYChange(parseFloat(e.target.value))} />

            <label style={{ fontSize: '12px' }}>Ajuste de Profundidad Z: ({offsetZ.toFixed(2)}m)</label>
            <input type="range" min="-3.0" max="3.0" step="0.05" value={offsetZ} onChange={(e) => handleOffsetZChange(parseFloat(e.target.value))} />
          </div>
        </div>
      )}
    </div>
  );
}
