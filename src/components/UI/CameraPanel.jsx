import { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
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
  setIsPlayingCamera,
  // --- Secuencia global persistente ---
  cameraSequence = [],
  setCameraSequence
}) {
  const [telemetry, setTelemetry] = useState({ x: 0, y: 1.2, z: 2.5 });

  // Grabador
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordIntervalRef = useRef(null);
  const recordedFramesRef = useRef([]);
  const recordStartTimeRef = useRef(0);

  // Estados de reproducción de secuencia
  const [activeTrackIndex, setActiveTrackIndex] = useState(null);
  const [isSequencePlaying, setIsSequencePlaying] = useState(false);
  const [statusText, setStatusText] = useState('');

  const playlist = cameraSequence || [];
  const setPlaylist = setCameraSequence;

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

  const createClipFromFrames = (frames, clipName) => {
    const times = [];
    const positions = [];
    const quaternions = [];

    frames.forEach((f) => {
      times.push(f.time);
      positions.push(...f.pos);
      quaternions.push(...f.rot);
    });

    const posTrack = new THREE.VectorKeyframeTrack('.position', times, positions);
    const rotTrack = new THREE.QuaternionKeyframeTrack('.quaternion', times, quaternions);
    const duration = times[times.length - 1] || 1;

    return {
      clip: new THREE.AnimationClip(clipName, duration, [posTrack, rotTrack]),
      duration
    };
  };

  // --- VMD LOADER ---
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

  // --- GRABACIÓN MANUAL ---
  const startRecordingCamera = () => {
    stopSequence();
    setIsCameraLockedToTrack(false);
    window.__isCameraLockedToTrack = false;

    recordedFramesRef.current = [];
    recordStartTimeRef.current = performance.now();
    setIsRecording(true);
    setRecordDuration(0);

    recordIntervalRef.current = setInterval(() => {
      const t = (performance.now() - recordStartTimeRef.current) / 1000;
      const cam = window.__currentCamera;

      if (cam) {
        recordedFramesRef.current.push({
          time: t,
          pos: [cam.position.x, cam.position.y, cam.position.z],
          rot: [cam.quaternion.x, cam.quaternion.y, cam.quaternion.z, cam.quaternion.w]
        });
      }
      setRecordDuration(t.toFixed(1));
    }, 33);
  };

  const stopRecordingCamera = () => {
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    setIsRecording(false);

    const frames = recordedFramesRef.current;
    if (frames.length < 2) {
      alert('La grabación fue demasiado corta.');
      return;
    }

    const name = `Toma_${playlist.length + 1}`;
    const { clip, duration } = createClipFromFrames(frames, name);

    if (setPlaylist) {
      setPlaylist((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          name,
          duration,
          transitionTime: 1.0,
          frames,
          clip
        }
      ]);
    }
  };

  // --- PLAYLIST & INTERPOLACIÓN ---
  const handleTransitionChange = (id, val) => {
    if (setPlaylist) {
      setPlaylist((prev) =>
        prev.map((item) => (item.id === id ? { ...item, transitionTime: Math.max(0, parseFloat(val) || 0) } : item))
      );
    }
  };

  const handleRemoveTrack = (id) => {
    if (setPlaylist) {
      setPlaylist((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleMoveTrack = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= playlist.length) return;
    const updated = [...playlist];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    if (setPlaylist) setPlaylist(updated);
  };

  const interpolateCameraTransition = (targetFrame, transitionSec, onComplete) => {
    const cam = window.__currentCamera;
    if (!cam || transitionSec <= 0) {
      if (cam && targetFrame) {
        cam.position.set(...targetFrame.pos);
        cam.quaternion.set(...targetFrame.rot);
      }
      onComplete();
      return;
    }

    setIsCameraLockedToTrack(false);
    window.__isCameraLockedToTrack = false;

    const startPos = cam.position.clone();
    const startRot = cam.quaternion.clone();
    const endPos = new THREE.Vector3(...targetFrame.pos);
    const endRot = new THREE.Quaternion(...targetFrame.rot);

    const startTime = performance.now();
    const durationMs = transitionSec * 1000;

    const step = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);

      const ease = progress * progress * (3 - 2 * progress);

      cam.position.lerpVectors(startPos, endPos, ease);
      cam.quaternion.slerpQuaternions(startRot, endRot, ease);

      if (progress < 1.0) {
        window.__transitionAnim = requestAnimationFrame(step);
      } else {
        onComplete();
      }
    };

    if (window.__transitionAnim) cancelAnimationFrame(window.__transitionAnim);
    window.__transitionAnim = requestAnimationFrame(step);
  };

  const playCameraSequenceStep = (index) => {
    if (index >= playlist.length) {
      stopSequence();
      setStatusText('Secuencia completada');
      return;
    }

    const item = playlist[index];
    setActiveTrackIndex(index);

    const firstFrame = item.frames[0];
    const transition = index === 0 ? 0 : (item.transitionTime ?? 1.0);

    if (transition > 0) {
      setStatusText(`Transición hacia Toma ${index + 1} (${transition}s)...`);
    } else {
      setStatusText(`Reproduciendo Toma ${index + 1}: ${item.name}`);
    }

    interpolateCameraTransition(firstFrame, transition, () => {
      setStatusText(`Reproduciendo Toma ${index + 1}: ${item.name}`);
      setCameraClip(item.clip);
      setCameraFileName(item.name);
      setIsCameraLockedToTrack(true);
      window.__isCameraLockedToTrack = true;
      setIsPlayingCamera(true);
      window.__isPlayingCamera = true;

      if (window.__sequenceTimeout) clearTimeout(window.__sequenceTimeout);
      window.__sequenceTimeout = setTimeout(() => {
        playCameraSequenceStep(index + 1);
      }, item.duration * 1000);
    });
  };

  const handlePlaySequence = () => {
    if (playlist.length === 0) return;
    stopSequence();
    setIsSequencePlaying(true);
    playCameraSequenceStep(0);
  };

  const stopSequence = () => {
    if (window.__sequenceTimeout) clearTimeout(window.__sequenceTimeout);
    if (window.__transitionAnim) cancelAnimationFrame(window.__transitionAnim);
    setIsSequencePlaying(false);
    setActiveTrackIndex(null);
    setStatusText('');
  };

  // --- EXPORTAR / IMPORTAR TODO ---
  const handleExportFullSequence = () => {
    if (playlist.length === 0) return;

    const exportData = playlist.map((item) => ({
      name: item.name,
      transitionTime: item.transitionTime ?? 1.0,
      frames: item.frames
    }));

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `cinematic_sequence_${Date.now()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const handleImportFullSequence = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const raw = JSON.parse(evt.target.result);
        const list = Array.isArray(raw) ? raw : [raw];

        const reconstructed = list.map((item, idx) => {
          const frames = item.frames || item;
          const { clip, duration } = createClipFromFrames(frames, item.name || `Toma_${idx + 1}`);
          return {
            id: Date.now() + idx + Math.random(),
            name: item.name || `Toma_${idx + 1}`,
            duration,
            transitionTime: item.transitionTime !== undefined ? item.transitionTime : 1.0,
            frames,
            clip
          };
        });

        if (setPlaylist) {
          setPlaylist((prev) => [...prev, ...reconstructed]);
        }
      } catch (err) {
        alert('❌ Error al importar archivo de secuencia.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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

      {/* GRABADOR MANUAL */}
      <div style={{ background: '#1a1b26', padding: '10px', borderRadius: '6px', marginBottom: '14px', border: '1px solid #414868' }}>
        <div style={{ fontSize: '12px', color: '#bb9af7', fontWeight: 'bold', marginBottom: '6px' }}>
          🎬 Grabador de Tomas:
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {!isRecording ? (
            <button
              className="tab-btn"
              style={{ flex: 1, backgroundColor: '#f7768e', color: '#fff', fontWeight: 'bold', padding: '8px' }}
              onClick={startRecordingCamera}
            >
              ⏺ Grabar Toma
            </button>
          ) : (
            <button
              className="tab-btn"
              style={{ flex: 1, backgroundColor: '#e0af68', color: '#1a1b26', fontWeight: 'bold', padding: '8px' }}
              onClick={stopRecordingCamera}
            >
              ⏹ Guardar Toma ({recordDuration}s)
            </button>
          )}
        </div>
      </div>

      {/* SECUENCIA CINEMÁTICA CON INTERPOLACIÓN */}
      <div style={{ background: '#1a1b26', padding: '10px', borderRadius: '6px', marginBottom: '14px', border: '1px solid #414868' }}>
        <div style={{ fontSize: '12px', color: '#7aa2f7', fontWeight: 'bold', marginBottom: '6px' }}>
          🎞️ Secuencia de Película / Cinemática
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <button
            className="tab-btn"
            style={{ flex: 1, backgroundColor: '#9ece6a', color: '#1a1b26', fontWeight: 'bold', padding: '6px' }}
            onClick={handlePlaySequence}
            disabled={playlist.length === 0}
          >
            ▶ Reproducir Secuencia
          </button>
          <button
            className="tab-btn"
            style={{ backgroundColor: '#f7768e', color: '#fff', padding: '6px' }}
            onClick={stopSequence}
            disabled={!isSequencePlaying}
          >
            ⏹ Detener
          </button>
        </div>

        {statusText && (
          <div style={{ fontSize: '10px', color: '#7dcfff', fontStyle: 'italic', marginBottom: '8px' }}>
            {statusText}
          </div>
        )}

        {playlist.length === 0 ? (
          <div style={{ fontSize: '11px', color: '#565f89', textAlign: 'center', padding: '6px' }}>
            No hay planos grabados ni cargados
          </div>
        ) : (
          <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '8px' }}>
            {playlist.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  background: activeTrackIndex === idx ? '#24283b' : '#13141f',
                  border: activeTrackIndex === idx ? '1px solid #7aa2f7' : '1px solid #2f354a',
                  padding: '6px',
                  borderRadius: '4px',
                  marginBottom: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#c0caf5', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold' }}>{idx + 1}. {item.name}</span>
                  <span style={{ color: '#7dcfff' }}>{item.duration.toFixed(1)}s</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#bb9af7' }}>Transición ant. (s):</span>
                  <input
                    type="number"
                    step="0.2"
                    min="0"
                    value={item.transitionTime ?? 1.0}
                    onChange={(e) => handleTransitionChange(item.id, e.target.value)}
                    style={{ width: '50px', padding: '2px', fontSize: '10px', marginBottom: 0 }}
                  />
                  <span style={{ fontSize: '9px', color: '#565f89' }}>(0 = corte)</span>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => {
                    stopSequence();
                    interpolateCameraTransition(item.frames[0], 0, () => {
                      setCameraClip(item.clip);
                      setCameraFileName(item.name);
                      setIsCameraLockedToTrack(true);
                      window.__isCameraLockedToTrack = true;
                      setIsPlayingCamera(true);
                    });
                  }}>▶</button>
                  <button style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => handleMoveTrack(idx, -1)}>⬆</button>
                  <button style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => handleMoveTrack(idx, 1)}>⬇</button>
                  <button style={{ padding: '2px 6px', fontSize: '10px', backgroundColor: '#f7768e', color: '#fff' }} onClick={() => handleRemoveTrack(item.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* BOTONES EXPORTAR / IMPORTAR TODO */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="tab-btn"
            style={{ flex: 1, fontSize: '10px', backgroundColor: '#7aa2f7', padding: '6px' }}
            onClick={handleExportFullSequence}
            disabled={playlist.length === 0}
          >
            💾 Guardar Todo (.json)
          </button>
          <label
            className="tab-btn"
            style={{ flex: 1, fontSize: '10px', backgroundColor: '#414868', textAlign: 'center', padding: '6px', cursor: 'pointer', margin: 0 }}
          >
            📂 Cargar Todo (.json)
            <input type="file" accept=".json" onChange={handleImportFullSequence} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      <hr style={{ borderColor: '#2f354a', margin: '14px 0' }} />

      {/* IMPORTACIÓN MMD VMD */}
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
            🎬 Pista Activa: <b>{cameraFileName}</b>
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
            Bloquear al recorrido
          </label>

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
