import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 1. Aplicar pose cargada desde URL (/poses/vrma/poseXXX.vrma)
export async function applyPoseFromUrl(url, currentAvatar) {
  if (!currentAvatar) {
    console.error("❌ No hay avatar activo.");
    return;
  }

  const vrmObj = currentAvatar.vrm || currentAvatar;

  let targetUrl = url;
  if (targetUrl.endsWith('.json')) targetUrl = targetUrl.replace(/\.json$/, '.vrma');
  if (!targetUrl.startsWith('/') && !targetUrl.startsWith('http')) targetUrl = `/poses/vrma/${targetUrl}`;
  if (!targetUrl.endsWith('.vrma')) targetUrl += '.vrma';

  console.log("📍 Solicitando pose en la ruta:", targetUrl);

  try {
    const res = await fetch(targetUrl);
    if (!res.ok) {
      console.error(`❌ Error HTTP ${res.status} al buscar la pose.`);
      return;
    }

    const arrayBuffer = await res.arrayBuffer();

    const textPreview = new TextDecoder('utf-8').decode(arrayBuffer.slice(0, 100));
    if (textPreview.trim().startsWith('<')) {
      console.error(`❌ La ruta devolvió HTML 404. Archivo no encontrado: ${targetUrl}`);
      return;
    }

    const loader = new GLTFLoader();
    loader.parse(arrayBuffer, '', (gltf) => {
      
      // CASO A: Animaciones por Tracks (VRMA oficial binario)
      if (gltf.animations && gltf.animations.length > 0) {
        const clip = gltf.animations[0];
        let bonesMoved = 0;

        clip.tracks.forEach((track) => {
          const trackName = track.name.split('.')[0];
          const property = track.name.split('.')[1];

          let boneNode = vrmObj.humanoid?.getNormalizedBoneNode(trackName);
          if (!boneNode && vrmObj.scene) {
            boneNode = vrmObj.scene.getObjectByName(trackName);
          }

          if (boneNode && track.values.length > 0) {
            if (property === 'quaternion' && track.values.length >= 4) {
              boneNode.quaternion.fromArray(track.values, 0);
              bonesMoved++;
            } else if (property === 'position' && track.values.length >= 3 && trackName === 'hips') {
              // Solo la cadera puede aplicar traslación
              boneNode.position.fromArray(track.values, 0);
            }
          }
        });

        if (bonesMoved > 0) {
          console.log(`✅ Pose VRMA oficial aplicada. Huesos movidos: ${bonesMoved}`);
          return;
        }
      }

      // CASO B: Fallback para archivos JSON planos (Legacy)
      try {
        const fullText = new TextDecoder('utf-8').decode(arrayBuffer);
        const data = JSON.parse(fullText);
        if (data && (data.bones || !data.asset)) {
          processPoseData(data, currentAvatar);
          console.log("✅ Pose aplicada desde JSON Legacy.");
        } else {
          console.warn("⚠️ El archivo es un VRMA/GLTF pero no contiene animaciones válidas.");
        }
      } catch (e) {
        console.error("❌ El archivo no pudo ser leído como animación ni como JSON.");
      }

    }, (err) => {
      console.error("❌ Error parseando GLTF/VRMA:", err);
    });

  } catch (err) {
    console.error("❌ Error de red al cargar la pose:", err);
  }
}

// 2. Procesar datos raw de pose (JSON Legacy)
export function processPoseData(poseData, currentAvatar) {
  if (!poseData || !currentAvatar) return;
  const vrmObj = currentAvatar.vrm || currentAvatar;
  if (!vrmObj || !vrmObj.humanoid) return;

  const targetBones = poseData.bones || poseData;

  for (const [boneName, transform] of Object.entries(targetBones)) {
    const boneNode = vrmObj.humanoid.getNormalizedBoneNode(boneName);
    if (boneNode) {
      if (transform.quaternion) {
        boneNode.quaternion.fromArray(transform.quaternion);
      } else if (transform.rx !== undefined) {
        const rx = THREE.MathUtils.degToRad(transform.rx || 0);
        const ry = THREE.MathUtils.degToRad(transform.ry || 0);
        const rz = THREE.MathUtils.degToRad(transform.rz || 0);
        boneNode.rotation.set(rx, ry, rz, 'XYZ');
      }

      // Solo 'hips' puede aplicar posición
      if (boneName === 'hips') {
        if (transform.position) {
          boneNode.position.fromArray(transform.position);
        } else if (transform.px !== undefined) {
          boneNode.position.set(transform.px || 0, transform.py || 0, transform.pz || 0);
        }
      }
    }
  }
}

// 3. Offsets y Sliders de huesos
export function applyBoneOffsetsToAvatar(avatar, offsets) {
  if (!avatar) return;
  const vrmObj = avatar.vrm || avatar;
  if (!vrmObj || !vrmObj.humanoid) return;

  const targetOffsets = offsets || avatar.offsets || {};

  for (const [boneName, transform] of Object.entries(targetOffsets)) {
    const boneNode = vrmObj.humanoid.getNormalizedBoneNode(boneName);
    if (boneNode) {
      // Rotación libre para todos los huesos
      if (transform.rx !== undefined || transform.ry !== undefined || transform.rz !== undefined) {
        const rx = THREE.MathUtils.degToRad(transform.rx || 0);
        const ry = THREE.MathUtils.degToRad(transform.ry || 0);
        const rz = THREE.MathUtils.degToRad(transform.rz || 0);
        boneNode.rotation.set(rx, ry, rz, 'XYZ');
      }
      
      // Bloqueo de posición XYZ exclusivo para cadera (hips)
      if (boneName === 'hips') {
        const defaultPos = avatar.defaultPositions?.['hips'] || new THREE.Vector3(0, 0, 0);
        boneNode.position.set(
          defaultPos.x + (transform.px || 0),
          defaultPos.y + (transform.py || 0),
          defaultPos.z + (transform.pz || 0)
        );
      }
    }
  }
}

// 4. Cargar archivo local subido por el usuario (.json o .vrma)
export function applyExternalPoseFile(file, currentAvatar) {
  if (!file || !currentAvatar) return;
  const vrmObj = currentAvatar.vrm || currentAvatar;

  const reader = new FileReader();
  reader.onload = (event) => {
    const arrayBuffer = event.target.result;
    const text = new TextDecoder('utf-8').decode(arrayBuffer);

    try {
      const data = JSON.parse(text);
      processPoseData(data, currentAvatar);
      console.log("✅ Pose externa JSON aplicada correctamente.");
    } catch (e) {
      const loader = new GLTFLoader();
      loader.parse(arrayBuffer, '', (gltf) => {
        if (gltf.animations && gltf.animations.length > 0) {
          const clip = gltf.animations[0];
          clip.tracks.forEach((track) => {
            const trackName = track.name.split('.')[0];
            const property = track.name.split('.')[1];
            let boneNode = vrmObj.humanoid?.getNormalizedBoneNode(trackName);
            if (!boneNode && vrmObj.scene) {
              boneNode = vrmObj.scene.getObjectByName(trackName);
            }
            if (boneNode && track.values.length > 0) {
              if (property === 'quaternion' && track.values.length >= 4) {
                boneNode.quaternion.fromArray(track.values, 0);
              } else if (property === 'position' && track.values.length >= 3 && trackName === 'hips') {
                boneNode.position.fromArray(track.values, 0);
              }
            }
          });
          console.log("✅ Pose externa VRMA binaria aplicada correctamente.");
        }
      }, (err) => {
        console.error("Error leyendo archivo de pose externo:", err);
        alert("El archivo de pose no tiene un formato válido.");
      });
    }
  };
  reader.readAsArrayBuffer(file);
}

// 5. Expresiones faciales del VRM
export function setVrmExpression(currentAvatar, expName, weight) {
  if (!currentAvatar) return;
  const vrmObj = currentAvatar.vrm || currentAvatar;
  if (!vrmObj || !vrmObj.expressionManager) return;

  try {
    vrmObj.expressionManager.setValue(expName, weight);
  } catch (err) {
    console.warn(`No se pudo aplicar expresión ${expName}:`, err);
  }
}
