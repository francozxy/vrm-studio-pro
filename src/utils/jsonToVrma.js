import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export function convertJsonToVrma(poseJsonData, filename = 'pose_convertida.vrma') {
  return new Promise((resolve, reject) => {
    const tracks = [];
    const times = [0]; // Pose estática en el tiempo 0

    // Si viene de los offsets calibrados o músculos que calculamos
    const offsets = poseJsonData.boneOffsets || {};

    for (const [boneName, transform] of Object.entries(offsets)) {
      const rx = THREE.MathUtils.degToRad(transform.rx || 0);
      const ry = THREE.MathUtils.degToRad(transform.ry || 0);
      const rz = THREE.MathUtils.degToRad(transform.rz || 0);

      const euler = new THREE.Euler(rx, ry, rz, 'XYZ');
      const quaternion = new THREE.Quaternion().setFromEuler(euler);

      // Track de rotación por cada hueso Humanoid
      const trackName = `humanoid.${boneName}.quaternion`;
      tracks.push(new THREE.QuaternionKeyframeTrack(
        trackName,
        times,
        [quaternion.x, quaternion.y, quaternion.z, quaternion.w]
      ));
    }

    const clip = new THREE.AnimationClip(filename, 0.1, tracks);
    const rootObject = new THREE.Group();
    rootObject.name = 'VRMAnimation';

    // Exportar como GLB binario (.vrma)
    const exporter = new GLTFExporter();
    exporter.parse(
      rootObject,
      (gltfArrayBuffer) => {
        const blob = new Blob([gltfArrayBuffer], { type: 'model/gltf-binary' });
        
        // Disparar descarga directa en el navegador
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);

        resolve(blob);
      },
      (error) => reject(error),
      {
        binary: true,
        animations: [clip]
      }
    );
  });
}
