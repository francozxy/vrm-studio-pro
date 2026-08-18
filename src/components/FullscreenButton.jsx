// FullscreenButton.jsx
export default function FullscreenButton() {
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        alert(`Error al intentar modo pantalla completa: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <button 
      onClick={toggleFullScreen}

style={{
  position: 'absolute',
  top: '12px',
  right: '65px',
  zIndex: 1001,
  background: 'rgba(26, 27, 38, 0.85)',
  color: '#fff',
  border: '1px solid #414868',
  borderRadius: '50%',
  width: '42px',
  height: '42px',
  fontSize: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  backdropFilter: 'blur(6px)'
}}

      
    >
      ⛶ Fullscreen
    </button>
  );
}
