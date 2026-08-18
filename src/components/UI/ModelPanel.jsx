import { useState, useEffect } from 'react';
import { saveAvatarToDB, getSavedAvatarsList, deleteAvatarFromDB } from '../../utils/StorageDB';

export default function ModelPanel({
  onLoadVrmFile, // Función que recibe el archivo/blob y lo carga en Three.js
  currentModelName
}) {
  const [savedAvatars, setSavedAvatars] = useState([]);
  const [lastUploadedFile, setLastUploadedFile] = useState(null);

  // Cargar lista de avatares guardados al iniciar
  useEffect(() => {
    loadList();
  }, []);

  const loadList = async () => {
    try {
      const list = await getSavedAvatarsList();
      setSavedAvatars(list);
    } catch (e) {
      console.error('Error al leer base de datos:', e);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLastUploadedFile(file);
    if (onLoadVrmFile) onLoadVrmFile(file);
  };

  const handleSaveCurrent = async () => {
    if (!lastUploadedFile) return;
    try {
      await saveAvatarToDB(lastUploadedFile);
      await loadList();
      alert(`Guardado "${lastUploadedFile.name}" en Favoritos.`);
    } catch (e) {
      alert('Error al guardar en memoria local.');
    }
  };

  const handleQuickLoad = (item) => {
    if (onLoadVrmFile) {
      onLoadVrmFile(item.blob);
    }
  };

  const handleDelete = async (name, e) => {
    e.stopPropagation();
    if (confirm(`¿Eliminar "${name}" de favoritos?`)) {
      await deleteAvatarFromDB(name);
      await loadList();
    }
  };

  return (
    <div className="section-box">
      <div className="section-title">👤 Avatar / Personaje VRM</div>

      <label>Subir Avatar (.vrm):</label>
      <input type="file" accept=".vrm" onChange={handleFileInput} />

      {lastUploadedFile && (
        <button
          className="tab-btn"
          style={{ width: '100%', marginTop: '8px', background: '#e0af68', color: '#1a1b26', fontWeight: 'bold' }}
          onClick={handleSaveCurrent}
        >
          ⭐ Guardar este Avatar en Favoritos
        </button>
      )}

      {/* Lista de Avatares Guardados (Acceso Rápido) */}
      <div style={{ marginTop: '14px', borderTop: '1px solid #2f354a', paddingTop: '10px' }}>
        <div style={{ fontSize: '12px', color: '#7aa2f7', fontWeight: 'bold', marginBottom: '8px' }}>
          ⚡ Biblioteca Rápida (Carga en 1 clic):
        </div>

        {savedAvatars.length === 0 ? (
          <div style={{ fontSize: '11px', color: '#565f89' }}>No hay avatares guardados aún.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {savedAvatars.map((item) => (
              <div
                key={item.name}
                onClick={() => handleQuickLoad(item)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: currentModelName === item.name ? '#24283b' : '#16161e',
                  border: currentModelName === item.name ? '1px solid #7aa2f7' : '1px solid #24283b',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', color: '#c0caf5', fontWeight: 'bold' }}>👤 {item.name}</span>
                  <span style={{ fontSize: '10px', color: '#565f89' }}>{item.size}</span>
                </div>
                <button
                  onClick={(e) => handleDelete(item.name, e)}
                  style={{ background: 'transparent', border: 'none', color: '#f7768e', fontSize: '14px', cursor: 'pointer', padding: '4px' }}
                >
                  ❌
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
