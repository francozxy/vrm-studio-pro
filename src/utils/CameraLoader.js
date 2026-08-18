import * as THREE from 'three';

/**
 * Lee un archivo .vmd binario de cámara y adapta distancias y centro según parámetros.
 */
export function loadVmdCameraFile(file, options = {}) {
  const {
    scale = 0.1,
    offsetY = 0.0,
    offsetZ = 0.0
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const view = new DataView(buffer);
        const decoder = new TextDecoder('shift-jis');

        const headerBytes = new Uint8Array(buffer, 0, 30);
        const headerText = decoder.decode(headerBytes);
        if (!headerText.startsWith('Vocaloid Motion Data')) {
          return reject(new Error('El archivo no es un VMD válido.'));
        }

        const isVmd2 = headerText.includes('0002');
        let offset = 30 + (isVmd2 ? 20 : 10);

        const boneCount = view.getUint32(offset, true);
        offset += 4 + boneCount * 111;

        const morphCount = view.getUint32(offset, true);
        offset += 4 + morphCount * 23;

        if (offset + 4 > buffer.byteLength) {
          return reject(new Error('El VMD no contiene datos de cámara.'));
        }

        const cameraKeyframeCount = view.getUint32(offset, true);
        offset += 4;

        if (cameraKeyframeCount === 0) {
          return reject(new Error('No hay fotogramas de cámara en este archivo.'));
        }

        const times = [];
        const positions = [];
        const quaternions = [];

        for (let i = 0; i < cameraKeyframeCount; i++) {
          const frameNum = view.getUint32(offset, true);
          const distance = view.getFloat32(offset + 4, true) * scale;
          const tx = view.getFloat32(offset + 8, true) * scale;
          const ty = (view.getFloat32(offset + 12, true) * scale) + offsetY;
          const tz = (view.getFloat32(offset + 16, true) * scale) + offsetZ;
          const rx = view.getFloat32(offset + 20, true);
          const ry = view.getFloat32(offset + 24, true);
          const rz = view.getFloat32(offset + 28, true);
          offset += 61;

          const time = frameNum / 30.0;
          times.push(time);

          // Rotación de cámara
          const euler = new THREE.Euler(-rx, -ry, -rz, 'YXZ');
          const q = new THREE.Quaternion().setFromEuler(euler);
          quaternions.push(q.x, q.y, q.z, q.w);

          // Cálculo de posición en espacio local
          const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
          const px = tx + dir.x * distance;
          const py = ty + dir.y * distance;
          const pz = -tz + dir.z * distance;
          positions.push(px, py, pz);
        }

        const tracks = [
          new THREE.VectorKeyframeTrack('.position', times, positions),
          new THREE.QuaternionKeyframeTrack('.quaternion', times, quaternions)
        ];

        const clip = new THREE.AnimationClip('VMDCamera', -1, tracks);
        resolve(clip);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
