import { useState, useEffect } from 'react';
import { 
  saveAvatarToDB, 
  getSavedAvatarsList, 
  deleteAvatarFromDB,
  savePoseToDB,
  getSavedPosesList,
  deletePoseFromDB
} from '../../utils/StorageDB';

const FULL_EXPRESSION_CATALOG = [
  { id: 'happy', label: '😊 Feliz (Happy)', group: 'Emociones' },
  { id: 'angry', label: '😠 Enojado (Angry)', group: 'Emociones' },
  { id: 'sad', label: '😢 Triste (Sad)', group: 'Emociones' },
  { id: 'relaxed', label: '😌 Relajado (Relaxed)', group: 'Emociones' },
  { id: 'surprised', label: '😲 Sorprendido (Surprised)', group: 'Emociones' },
  { id: 'neutral', label: '😐 Neutral', group: 'Emociones' },
  { id: 'aa', label: '🗣️ Boca: A', group: 'Boca / Habla' },
  { id: 'ih', label: '🗣️ Boca: I', group: 'Boca / Habla' },
  { id: 'ou', label: '🗣️ Boca: U', group: 'Boca / Habla' },
  { id: 'ee', label: '🗣️ Boca: E', group: 'Boca / Habla' },
  { id: 'oh', label: '🗣️ Boca: O', group: 'Boca / Habla' },
  { id: 'blink', label: '😑 Cerrar Ambos Ojos', group: 'Ojos' },
  { id: 'blinkLeft', label: '😉 Guiño Ojo Izquierdo', group: 'Ojos' },
  { id: 'blinkRight', label: '😉 Guiño Ojo Derecho', group: 'Ojos' },
  { id: 'lookUp', label: '🙄 Mirar Arriba', group: 'Ojos' },
  { id: 'lookDown', label: '😒 Mirar Abajo', group: 'Ojos' },
  { id: 'lookLeft', label: '👈 Mirar Izquierda', group: 'Ojos' },
  { id: 'lookRight', label: '👉 Mirar Derecha', group: 'Ojos' },
  { id: 'joy', label: '😆 Alegría Extrema (Joy)', group: 'Extras' },
  { id: 'sorrow', label: '😭 Llanto / Dolor (Sorrow)', group: 'Extras' },
  { id: 'fun', label: '😸 Sonrisa Pícara (Fun)', group: 'Extras' },
  { id: 'smug', label: '😏 Presumido (Smug)', group: 'Extras' },
  { id: 'thinking', label: '🤔 Pensativo', group: 'Extras' },
  { id: 'confused', label: '😵 Confundido / Mareado', group: 'Extras' }
];

export default function PosingPanel({
  vrmList = [],
  activeVrmIndex = 0,
  setActiveVrmIndex,
  handleAvatarUpload,
  handleDeleteAvatar,
  selectedBone = '',
  setSelectedBone,
  showBoneNodes,
  setShowBoneNodes,
  gizmoEnabled,
  setGizmoEnabled,
  gizmoMode,
  setGizmoMode,
  onBoneOffsetChange,
  ikEnabled,
  setIkEnabled,
  autoBlink,
  setAutoBlink,
  lookAtCamera,
  setLookAtCamera,
  onCopyPoseState,
  onDownloadPoseJson,
  onPoseJsonUpload,
  onApplyDirectPoseData,
  getCurrentPose,
  vrmaList = [],
  onApplyVrmaPreset
}) {
  const [savedAvatars, setSavedAvatars] = useState([]);
  const [savedPoses, setSavedPoses] = useState([]);
  const [lastUploadedFile, setLastUploadedFile] = useState(null);
  const [selectedExpId, setSelectedExpId] = useState('happy');
  const [expressionValues, setExpressionValues] = useState({});
  const [availableList, setAvailableList] = useState(FULL_EXPRESSION_CATALOG);

  useEffect(() => {
    loadSavedList();
    loadSavedPoses();
  }, []);

  useEffect(() => {
    if (selectedBone !== 'hips' && gizmoMode !== 'rotate' && setGizmoMode) {
      setGizmoMode('rotate');
    }
  }, [selectedBone, gizmoMode, setGizmoMode]);

  useEffect(() => {
    const currentVrm = vrmList[activeVrmIndex]?.vrm;
    if (currentVrm) {
      const vrmExpNames = currentVrm.expressionManager?.expressions?.map(e => e.expressionName) || [];
      if (vrmExpNames.length > 0) {
        const unified = FULL_EXPRESSION_CATALOG.map(cat => ({ ...cat }));
        vrmExpNames.forEach(rawName => {
          if (!unified.some(u => u.id.toLowerCase() === rawName.toLowerCase())) {
            unified.push({ id: rawName, label: `✨ ${rawName}`, group: 'Avatar Custom' });
          }
        });
        setAvailableList(unified);
      }
    }
  }, [vrmList, activeVrmIndex]);

  const loadSavedList = async () => {
    try {
      const list = await getSavedAvatarsList();
      setSavedAvatars(list);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSavedPoses = async () => {
    try {
      const list = await getSavedPosesList();
      setSavedPoses(list);
    } catch (e) {
      console.error(e);
    }
  };

  const onFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLastUploadedFile(file);
    handleAvatarUpload(file);
  };

  const handleSaveAvatarFavorites = async () => {
    if (!lastUploadedFile) return;
    try {
      await saveAvatarToDB(lastUploadedFile);
      await loadSavedList();
      alert(`"${lastUploadedFile.name}" guardado en Favoritos.`);
    } catch (err) {
      alert('Error al guardar en memoria local.');
    }
  };

  const handleSavePoseFavorites = async () => {
    const currentPose = getCurrentPose ? getCurrentPose() : null;
    if (!currentPose) {
      alert('No hay una pose activa para guardar.');
      return;
    }
    const poseName = prompt('Nombre para esta pose:', `Pose ${savedPoses.length + 1}`);
    if (!poseName) return;

    try {
      await savePoseToDB(poseName, currentPose);
      await loadSavedPoses();
      alert(`Pose "${poseName}" guardada en Favoritos.`);
    } catch (err) {
      alert('Error al guardar la pose.');
    }
  };

  const handleDeleteSavedPose = async (name, e) => {
    e.stopPropagation();
    if (confirm(`¿Eliminar pose "${name}"?`)) {
      await deletePoseFromDB(name);
      await loadSavedPoses();
    }
  };

  const applyExpressionValue = (expId, rawVal) => {
    const val = Math.max(0, Math.min(1, parseFloat(rawVal) || 0));
    setExpressionValues(prev => ({ ...prev, [expId]: val }));

    const currentVrm = vrmList[activeVrmIndex]?.vrm;
    if (currentVrm) {
      if (currentVrm.expressionManager) {
        currentVrm.expressionManager.setValue(expId, val);
      } else if (currentVrm.blendShapeProxy) {
        currentVrm.blendShapeProxy.setValue(expId, val);
      }
    }
  };

  const handleResetAllExpressions = () => {
    const currentVrm = vrmList[activeVrmIndex]?.vrm;
    if (currentVrm) {
      availableList.forEach(exp => {
        if (currentVrm.expressionManager) {
          currentVrm.expressionManager.setValue(exp.id, 0);
        } else if (currentVrm.blendShapeProxy) {
          currentVrm.blendShapeProxy.setValue(exp.id, 0);
        }
      });
    }
    setExpressionValues({});
  };

  const currentAvatar = vrmList[activeVrmIndex];
  const activeOffset = (currentAvatar?.offsets && selectedBone)
    ? (currentAvatar.offsets[selectedBone] || { rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0 })
    : { rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0 };

  const handleRotationInput = (axis, value) => {
    if (!selectedBone || !onBoneOffsetChange) return;
    const num = parseFloat(value) || 0;
    onBoneOffsetChange(selectedBone, {
      ...activeOffset,
      [axis]: num
    });
  };

  const activeExpData = availableList.find(e => e.id === selectedExpId) || availableList[0];
  const currentExpVal = expressionValues[selectedExpId] ?? 0;

  return (
    <div>
      {/* 👥 Personajes VRM */}
      <div className="section-box">
        <div className="section-title">👥 Personajes VRM</div>
        <label>Añadir Avatar (.vrm):</label>
        <input type="file" accept=".vrm" onChange={onFileInputChange} />

        {lastUploadedFile && (
          <button
            className="tab-btn"
            style={{ width: '100%', marginTop: '8px', background: '#e0af68', color: '#1a1b26', fontWeight: 'bold' }}
            onClick={handleSaveAvatarFavorites}
          >
            ⭐ Guardar este Avatar en Favoritos
          </button>
        )}

        {savedAvatars.length > 0 && (
          <div style={{ marginTop: '12px', borderTop: '1px solid #2f354a', paddingTop: '8px' }}>
            <div style={{ fontSize: '11px', color: '#7aa2f7', fontWeight: 'bold', marginBottom: '6px' }}>
              ⚡ Avatares Guardados (Carga rápida):
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {savedAvatars.map((item) => (
                <div
                  key={item.name}
                  onClick={() => handleAvatarUpload(item.blob, item.name)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#1a1b26',
                    border: '1px solid #24283b',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: '12px', color: '#c0caf5' }}>👤 {item.name} ({item.size})</span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`¿Eliminar "${item.name}"?`)) {
                        await deleteAvatarFromDB(item.name);
                        await loadSavedList();
                      }
                    }}
                    style={{ background: 'transparent', border: '1px solid red', color: '#f7768e', cursor: 'pointer', fontSize: '15px',width:'50px' }}
                  >
                    ❌
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {vrmList.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            <label style={{ fontSize: '12px' }}>Avatar Activo:</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={activeVrmIndex}
                onChange={(e) => setActiveVrmIndex(parseInt(e.target.value))}
                style={{ flex: 1, minWidth: '0', padding: '8px', fontSize: '13px' }}
              >
                {vrmList.map((v, idx) => (
                  <option key={idx} value={idx}>{idx + 1}. {v.name || 'Avatar'}</option>
                ))}
              </select>
              <button
                onClick={() => handleDeleteAvatar(activeVrmIndex)}
                style={{
                  width: '38px',
                  height: '38px',
                  minWidth: '38px',
                  background: '#f7768e',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px'
                }}
                title="Eliminar avatar de la escena"
              >
                🗑️
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 💃 Poses Predefinidas y Archivos */}
      <div className="section-box">
        <div className="section-title">💃 Poses Predefinidas y Archivos</div>
        
        <select id="vrma-preset-select" style={{ width: '100%', marginBottom: '8px' }}>
          <option value="">-- Seleccionar Pose VRMA --</option>
          {vrmaList.map((p, idx) => (
            <option key={idx} value={p.url || p.name}>{p.name}</option>
          ))}
        </select>
        
        <button
          className="tab-btn"
          style={{ width: '100%', background: '#7aa2f7', color: '#1a1b26', fontWeight: 'bold', marginBottom: '8px' }}
          onClick={() => {
            const select = document.getElementById('vrma-preset-select');
            if (select && select.value && onApplyVrmaPreset) {
              onApplyVrmaPreset(select.value);
            }
          }}
        >
          Aplicar Pose VRMA
        </button>

        {/* Botones de Gestión de JSON */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
          <button
            className="tab-btn"
            style={{ background: '#9ece6a', color: '#1a1b26', fontWeight: 'bold' }}
            onClick={onCopyPoseState}
          >
            📋 Copiar JSON
          </button>

          <button
            className="tab-btn"
            style={{ background: '#e0af68', color: '#1a1b26', fontWeight: 'bold' }}
            onClick={onDownloadPoseJson}
          >
            💾 Descargar JSON
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <input
            id="hidden-pose-json-input"
            type="file"
            accept=".json,application/json,text/plain,*/*"
            onChange={onPoseJsonUpload}
            style={{ display: 'none' }}
          />

          <button
            className="tab-btn"
            style={{ background: '#2ac3de', color: '#1a1b26', fontWeight: 'bold' }}
            onClick={() => {
              const fileInput = document.getElementById('hidden-pose-json-input');
              if (fileInput) fileInput.click();
            }}
          >
            📂 Subir JSON
          </button>

          <button
            className="tab-btn"
            style={{ background: '#bb9af7', color: '#1a1b26', fontWeight: 'bold' }}
            onClick={handleSavePoseFavorites}
          >
            ⭐ Guardar en App
          </button>
        </div>

        {/* Lista de Poses Guardadas en la App (Carga Rápida) */}
        {savedPoses.length > 0 && (
          <div style={{ marginTop: '12px', borderTop: '1px solid #2f354a', paddingTop: '8px' }}>
            <div style={{ fontSize: '11px', color: '#7aa2f7', fontWeight: 'bold', marginBottom: '6px' }}>
              ⚡ Poses Guardadas en Memoria:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
              {savedPoses.map((pose) => (
                <div
                  key={pose.name}
                  onClick={() => onApplyDirectPoseData(pose.data)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#1a1b26',
                    border: '1px solid #24283b',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: '12px', color: '#c0caf5' }}>💃 {pose.name} ({pose.boneCount} huesos)</span>
                  <button
                    onClick={(e) => handleDeleteSavedPose(pose.name, e)}
                    style={{ background: 'transparent', border: 'solid red 2px', color: '#f7768e', cursor: 'pointer', fontSize: '14px', width: '20px' }}
                  >
                    ❌
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 🦴 Ajuste Físico, Números y Gizmo 3D */}
      <div className="section-box">
        <div className="section-title">🦴 Ajuste Físico y Gizmo 3D</div>
        <label>Seleccionar Hueso:</label>
        <select value={selectedBone} onChange={(e) => setSelectedBone(e.target.value)} style={{ width: '100%', marginBottom: '8px' }}>
          <option value="">-- Ningún hueso seleccionado --</option>
          <option value="hips">Caderas (Hips - Mover Personaje)</option>
          <option value="spine">Columna (Spine)</option>
          <option value="chest">Pecho (Chest)</option>
          <option value="upperChest">Pecho Superior (Upper Chest)</option>
          <option value="neck">Cuello (Neck)</option>
          <option value="head">Cabeza (Head)</option>
          <option value="leftShoulder">Hombro Izquierdo</option>
          <option value="leftUpperArm">Brazo Izquierdo</option>
          <option value="leftLowerArm">Antebrazo Izquierdo</option>
          <option value="leftHand">Mano Izquierda</option>
          <option value="rightShoulder">Hombro Derecho</option>
          <option value="rightUpperArm">Brazo Derecho</option>
          <option value="rightLowerArm">Antebrazo Derecho</option>
          <option value="rightHand">Mano Derecha</option>
          <option value="leftUpperLeg">Muslo Izquierdo</option>
          <option value="leftLowerLeg">Pierna Izquierda</option>
          <option value="leftFoot">Pie Izquierdo</option>
          <option value="rightUpperLeg">Muslo Derecho</option>
          <option value="rightLowerLeg">Pierna Derecha</option>
          <option value="rightFoot">Pie Derecho</option>
        </select>

        {selectedBone && (
          <div style={{ background: '#13141f', padding: '8px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #282a36' }}>
            <div style={{ fontSize: '11px', color: '#7aa2f7', marginBottom: '6px', fontWeight: 'bold' }}>
              📐 Rotación de {selectedBone} (°):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#f7768e' }}>Rot X:</span>
                <input
                  type="number"
                  step="1"
                  value={Math.round(activeOffset.rx || 0)}
                  onChange={(e) => handleRotationInput('rx', e.target.value)}
                  style={{ width: '100%', padding: '4px', fontSize: '12px' }}
                />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#9ece6a' }}>Rot Y:</span>
                <input
                  type="number"
                  step="1"
                  value={Math.round(activeOffset.ry || 0)}
                  onChange={(e) => handleRotationInput('ry', e.target.value)}
                  style={{ width: '100%', padding: '4px', fontSize: '12px' }}
                />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#7aa2f7' }}>Rot Z:</span>
                <input
                  type="number"
                  step="1"
                  value={Math.round(activeOffset.rz || 0)}
                  onChange={(e) => handleRotationInput('rz', e.target.value)}
                  style={{ width: '100%', padding: '4px', fontSize: '12px' }}
                />
              </div>
            </div>
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '6px' }}>
          <input type="checkbox" checked={showBoneNodes} onChange={(e) => setShowBoneNodes(e.target.checked)} />
          🟢 Ver Esferas de Huesos (Tocar para aislar)
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '6px' }}>
          <input type="checkbox" checked={gizmoEnabled} onChange={(e) => setGizmoEnabled(e.target.checked)} />
          Activar Gizmo 3D
        </label>

        {gizmoEnabled && selectedBone === 'hips' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
            <button
              className="tab-btn"
              style={{
                background: gizmoMode === 'rotate' ? '#7aa2f7' : '#1f2335',
                color: gizmoMode === 'rotate' ? '#1a1b26' : '#c0caf5',
                fontWeight: 'bold',
                padding: '6px'
              }}
              onClick={() => setGizmoMode('rotate')}
            >
              🔄 Rotar
            </button>
            <button
              className="tab-btn"
              style={{
                background: gizmoMode === 'translate' ? '#7aa2f7' : '#1f2335',
                color: gizmoMode === 'translate' ? '#1a1b26' : '#c0caf5',
                fontWeight: 'bold',
                padding: '6px'
              }}
              onClick={() => setGizmoMode('translate')}
            >
              ↔️ Mover (Flechas)
            </button>
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
          <input type="checkbox" checked={ikEnabled} onChange={(e) => setIkEnabled(e.target.checked)} />
          🎯 Activar IK (Esferas Azules en Manos y Pies)
        </label>
      </div>

      {/* 🎭 Expresiones Faciales */}
      <div className="section-box">
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🎭 Expresiones Faciales</span>
          <button
            onClick={handleResetAllExpressions}
            style={{
              background: '#24283b',
              border: '1px solid #414868',
              color: '#f7768e',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Limpiar
          </button>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', cursor: 'pointer' }}>
          <input type="checkbox" checked={autoBlink} onChange={(e) => setAutoBlink(e.target.checked)} />
          ✨ Parpadeo Automático (Blink)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', marginBottom: '14px', cursor: 'pointer' }}>
          <input type="checkbox" checked={lookAtCamera} onChange={(e) => setLookAtCamera(e.target.checked)} />
          👀 Mirar a la Cámara (LookAt)
        </label>

        <label style={{ fontSize: '12px' }}>Seleccionar Expresión:</label>
        <select
          value={selectedExpId}
          onChange={(e) => setSelectedExpId(e.target.value)}
          style={{ width: '100%', padding: '8px', fontSize: '13px', marginBottom: '10px' }}
        >
          {['Emociones', 'Boca / Habla', 'Ojos', 'Extras', 'Avatar Custom'].map(grp => {
            const items = availableList.filter(e => e.group === grp);
            if (items.length === 0) return null;
            return (
              <optgroup key={grp} label={grp}>
                {items.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.label} {expressionValues[e.id] > 0 ? `(${(expressionValues[e.id] * 100).toFixed(0)}%)` : ''}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>

        <div style={{ background: '#13141f', padding: '10px', borderRadius: '8px', border: '1px solid #282a36' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#c0caf5', marginBottom: '8px' }}>
            <span>{activeExpData.label}</span>
            <span style={{ color: '#7aa2f7', fontWeight: 'bold' }}>{Math.round(currentExpVal * 100)}%</span>
          </div>

          <div style={{ width: '50%', margin: '0 auto' }}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={currentExpVal}
              onChange={(e) => applyExpressionValue(selectedExpId, e.target.value)}
              style={{ width: '100%', height: '8px', accentColor: '#7aa2f7', cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
