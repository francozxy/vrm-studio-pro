import { useState, useRef, useEffect } from 'react';
import { setVrmExpression } from '../../utils/poseDecoder';

export default function DialoguePanel({ vrmList, activeVrmIndex }) {
  const [playlist, setPlaylist] = useState([]);
  const [sensitivity, setSensitivity] = useState(1.5);
  const [bgMusicVolume, setBgMusicVolume] = useState(0.5);
  const [statusMessage, setStatusMessage] = useState('Listo para reproducir');

  // Referencias de audio, analizador y avatar hablante actual
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const activeAudioRef = useRef(null);
  const bgMusicRef = useRef(null);
  const timeoutRef = useRef(null);
  const animFrameRef = useRef(null);
  const currentSpeakingAvatarRef = useRef(null);

  // Inicializar Contexto de Audio
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Cargar audios a la lista con asignación por defecto al avatar activo
  const handleAudioUpload = (e) => {
    const files = Array.from(e.target.files);
    const newItems = files.map((file, idx) => ({
      id: Date.now() + idx + Math.random(),
      name: file.name,
      file: file,
      delayAfter: 0.5,
      avatarIndex: activeVrmIndex || 0
    }));
    setPlaylist(prev => [...prev, ...newItems]);
  };

  const handleRemoveAudio = (id) => {
    setPlaylist(prev => prev.filter(item => item.id !== id));
  };

  const handleDelayChange = (id, val) => {
    setPlaylist(prev => prev.map(item => item.id === id ? { ...item, delayAfter: parseFloat(val) || 0 } : item));
  };

  // Cambiar el personaje asignado a un audio específico
  const handleAvatarChange = (id, avatarIdx) => {
    setPlaylist(prev => prev.map(item => item.id === id ? { ...item, avatarIndex: parseInt(avatarIdx) || 0 } : item));
  };

  const handleMoveAudio = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= playlist.length) return;
    const updated = [...playlist];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    setPlaylist(updated);
  };

  // Conectar analizador de audio para el avatar target asignado
  const setupAudioAnalyser = (audioElement, targetAvatar) => {
    const ctx = getAudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    const source = ctx.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(ctx.destination);

    analyserRef.current = analyser;
    currentSpeakingAvatarRef.current = targetAvatar;
    startLipSyncLoop();
  };

  // Bucle de Lip-Sync aplicado al avatar que está hablando
  const startLipSyncLoop = () => {
    const update = () => {
      const avatar = currentSpeakingAvatarRef.current;

      if (analyserRef.current && activeAudioRef.current && !activeAudioRef.current.paused) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;

        const volumeNorm = Math.min(1.0, (average / 128) * sensitivity);

        if (avatar) {
          setVrmExpression(avatar, 'aa', volumeNorm);
          setVrmExpression(avatar, 'ih', volumeNorm * 0.4);
        }
      } else if (avatar && activeAudioRef.current && activeAudioRef.current.paused) {
        setVrmExpression(avatar, 'aa', 0);
        setVrmExpression(avatar, 'ih', 0);
      }

      animFrameRef.current = requestAnimationFrame(update);
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    update();
  };

  // Reproducir un único audio
  const playSingleAudio = (item) => {
    stopSequence();
    const targetAvatar = vrmList[item.avatarIndex] || vrmList[activeVrmIndex];
    const audio = new Audio(URL.createObjectURL(item.file));
    activeAudioRef.current = audio;
    setupAudioAnalyser(audio, targetAvatar);
    audio.play();
    setStatusMessage(`Hablando: ${targetAvatar ? targetAvatar.name : 'Avatar'} - ${item.name}`);
  };

  // Reproducción en secuencia alternando personajes
  const playSequenceStep = (index) => {
    if (index >= playlist.length) {
      setStatusMessage('Secuencia finalizada');
      stopSequence();
      return;
    }

    const item = playlist[index];
    const targetAvatar = vrmList[item.avatarIndex] || vrmList[activeVrmIndex];
    
    setStatusMessage(`Diálogo ${index + 1}/${playlist.length}: [${targetAvatar ? targetAvatar.name : 'Sin Avatar'}] ${item.name}`);

    const audio = new Audio(URL.createObjectURL(item.file));
    activeAudioRef.current = audio;
    setupAudioAnalyser(audio, targetAvatar);

    audio.play();

    audio.onended = () => {
      // Cerrar la boca del personaje actual al terminar de hablar
      if (targetAvatar) {
        setVrmExpression(targetAvatar, 'aa', 0);
        setVrmExpression(targetAvatar, 'ih', 0);
      }
      setStatusMessage(`Pausa de ${item.delayAfter}s...`);
      timeoutRef.current = setTimeout(() => {
        playSequenceStep(index + 1);
      }, item.delayAfter * 1000);
    };
  };

  const handlePlayAll = () => {
    if (playlist.length === 0) return;
    if (activeAudioRef.current && activeAudioRef.current.paused) {
      activeAudioRef.current.play();
      setStatusMessage('Reanudando secuencia');
    } else {
      stopSequence();
      playSequenceStep(0);
    }
  };

  const handlePause = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      setStatusMessage('Pausado');
    }
  };

  const stopSequence = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    
    // Limpiar boca de todos los personajes cargados
    vrmList.forEach(avatar => {
      if (avatar) {
        setVrmExpression(avatar, 'aa', 0);
        setVrmExpression(avatar, 'ih', 0);
      }
    });
    currentSpeakingAvatarRef.current = null;
    setStatusMessage('Detenido');
  };

  // Música de fondo
  const handleBgMusicUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (bgMusicRef.current) bgMusicRef.current.pause();

    const music = new Audio(URL.createObjectURL(file));
    music.loop = true;
    music.volume = bgMusicVolume;
    music.play();
    bgMusicRef.current = music;
  };

  const handleMusicVolumeChange = (val) => {
    const vol = parseFloat(val) || 0;
    setBgMusicVolume(vol);
    if (bgMusicRef.current) bgMusicRef.current.volume = vol;
  };

  useEffect(() => {
    return () => stopSequence();
  }, []);

  return (
    <>
      {/* 1. SECTOR AUDIOS DE DIÁLOGO */}
      <div className="section-box">
        <div className="section-title">🎙️ Secuencia de Voces</div>
        <label>Agregar Audios (.mp3 / .wav):</label>
        <input type="file" accept="audio/*" multiple onChange={handleAudioUpload} />

        <label style={{ marginTop: '8px' }}>Sensibilidad Lip-Sync:</label>
        <input 
          type="range" 
          min="0.5" 
          max="3" 
          step="0.1" 
          value={sensitivity} 
          onChange={(e) => setSensitivity(parseFloat(e.target.value))} 
        />

        <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
          <button style={{ backgroundColor: '#9ece6a' }} onClick={handlePlayAll}>▶ Reproducir</button>
          <button style={{ backgroundColor: '#e0af68' }} onClick={handlePause}>⏸ Pausa</button>
          <button style={{ backgroundColor: '#f7768e', color: '#fff' }} onClick={stopSequence}>⏹ Detener</button>
        </div>

        <div style={{ marginTop: '6px', fontSize: '0.65rem', color: '#7dcfff', fontStyle: 'italic' }}>
          {statusMessage}
        </div>
      </div>

      {/* 2. PLAYLIST UI CON ASIGNACIÓN DE PERSONAJE */}
      <div className="section-box">
        <div className="section-title">📜 Lista de Reproducción</div>
        {playlist.length === 0 ? (
          <div style={{ fontSize: '0.65rem', color: '#565f89', textAlign: 'center', padding: '6px' }}>
            No hay audios cargados
          </div>
        ) : (
          <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {playlist.map((item, idx) => (
              <div key={item.id} style={{
                backgroundColor: '#1a1b26',
                padding: '6px',
                borderRadius: '4px',
                marginBottom: '6px',
                border: '1px solid #414868'
              }}>
                <div style={{ fontSize: '0.7rem', color: '#c0caf5', fontWeight: 'bold', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {idx + 1}. {item.name}
                </div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                  <button style={{ padding: '2px 6px', fontSize: '0.6rem' }} onClick={() => playSingleAudio(item)}>▶</button>
                  <button style={{ padding: '2px 6px', fontSize: '0.6rem' }} onClick={() => handleMoveAudio(idx, -1)}>⬆</button>
                  <button style={{ padding: '2px 6px', fontSize: '0.6rem' }} onClick={() => handleMoveAudio(idx, 1)}>⬇</button>
                  <button style={{ padding: '2px 6px', fontSize: '0.6rem', backgroundColor: '#f7768e', color: '#fff' }} onClick={() => handleRemoveAudio(item.id)}>🗑️</button>
                </div>

                {/* SELECCIÓN DEL PERSONAJE HABLANTE */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  <span style={{ fontSize: '0.6rem', color: '#7aa2f7', fontWeight: 'bold' }}>🗣️ Habla:</span>
                  <select
                    value={item.avatarIndex ?? 0}
                    onChange={(e) => handleAvatarChange(item.id, e.target.value)}
                    style={{ flex: 1, padding: '2px', fontSize: '0.65rem', marginBottom: 0 }}
                  >
                    {vrmList.length === 0 && <option value="0">-- Sin avatares --</option>}
                    {vrmList.map((av, avIdx) => (
                      <option key={avIdx} value={avIdx}>
                        {avIdx + 1}. {av.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  <span style={{ fontSize: '0.6rem', color: '#9aa5ce' }}>Pausa pos. (s):</span>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0" 
                    value={item.delayAfter} 
                    onChange={(e) => handleDelayChange(item.id, e.target.value)}
                    style={{ width: '50px', padding: '2px', fontSize: '0.65rem', marginBottom: 0 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. MÚSICA DE FONDO */}
      <div className="section-box">
        <div className="section-title">🎵 Música de Fondo</div>
        <label>Cargar Pista (.mp3):</label>
        <input type="file" accept="audio/*" onChange={handleBgMusicUpload} />

        <label style={{ marginTop: '6px' }}>Volumen:</label>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.05" 
          value={bgMusicVolume} 
          onChange={(e) => handleMusicVolumeChange(e.target.value)} 
        />
      </div>
    </>
  );
}
