import { useState, useEffect } from 'react';
import './App.css';
import CanvasViewer from './components/3D/CanvasViewer';
import PosingPanel from './components/UI/PosingPanel';
import DialoguePanel from './components/UI/DialoguePanel';
import ScenePanel from './components/UI/ScenePanel';
import VrmaPanel from './components/UI/VrmaPanel';
import StylePanel from './components/UI/StylePanel';
import CameraPanel from './components/UI/CameraPanel';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import { unzipSync } from 'fflate';
import DonateButton from './components/DonateButton';
import FullscreenButton from './components/FullscreenButton';

const getMMDLoaderClass = async () => {
  if (window.MMDLoader) return window.MMDLoader;
  const mod = await import(/* @vite-ignore */ 'https://esm.sh/three@0.160.0/examples/jsm/loaders/MMDLoader.js');
  return mod.MMDLoader;
};

const loadModelFile = async (file) => {
  const ext = file.name.split('.').pop().toLowerCase();

  // 1. GLB / GLTF
  if (ext === 'glb' || ext === 'gltf') {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(URL.createObjectURL(file), (gltf) => resolve(gltf.scene), undefined, reject);
    });
  }

  // 2. OBJ Directo
  if (ext === 'obj') {
    const loader = new OBJLoader();
    return new Promise((resolve, reject) => {
      loader.load(URL.createObjectURL(file), (obj) => resolve(obj), undefined, reject);
    });
  }

  // 3. FBX Directo
  if (ext === 'fbx') {
    const loader = new FBXLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        URL.createObjectURL(file),
        (fbx) => {
          fbx.scale.setScalar(0.01);
          resolve(fbx);
        },
        undefined,
        reject
      );
    });
  }

  // 4. PMX MMD Directo
  if (ext === 'pmx') {
    const MMDLoader = await getMMDLoaderClass();
    const loader = new MMDLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        URL.createObjectURL(file),
        (mesh) => {
          mesh.scale.setScalar(0.08);
          mesh.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach((m) => {
                  m.side = THREE.DoubleSide;
                  m.needsUpdate = true;
                });
              }
            }
          });
          resolve(mesh);
        },
        undefined,
        reject
      );
    });
  }

  // 5. ZIP (Detecta FBX, OBJ+MTL o PMX con todas sus texturas)
  if (ext === 'zip') {
    const buffer = await file.arrayBuffer();
    const unzipped = unzipSync(new Uint8Array(buffer));

    let mainFile = null;
    let mainType = null;
    let mtlFile = null;
    const blobUrls = new Map();

    for (const [filepath, fileData] of Object.entries(unzipped)) {
      const lower = filepath.toLowerCase();
      if (lower.endsWith('.pmx') && !mainFile) {
        mainFile = { path: filepath, data: fileData };
        mainType = 'pmx';
      } else if (lower.endsWith('.fbx') && !mainFile) {
        mainFile = { path: filepath, data: fileData };
        mainType = 'fbx';
      } else if (lower.endsWith('.obj') && !mainFile) {
        mainFile = { path: filepath, data: fileData };
        mainType = 'obj';
      } else if (lower.endsWith('.mtl')) {
        mtlFile = { path: filepath, data: fileData };
      }

      let mime = 'application/octet-stream';
      if (lower.endsWith('.png')) mime = 'image/png';
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
      else if (lower.endsWith('.tga')) mime = 'image/x-tga';
      else if (lower.endsWith('.bmp')) mime = 'image/bmp';
      else if (lower.endsWith('.sph') || lower.endsWith('.spa')) mime = 'image/png';

      const blob = new Blob([fileData], { type: mime });
      const url = URL.createObjectURL(blob);

      blobUrls.set(filepath, url);
      blobUrls.set(filepath.split('/').pop(), url);
      blobUrls.set(filepath.toLowerCase(), url);
      blobUrls.set(filepath.split('/').pop().toLowerCase(), url);
    }

    if (!mainFile) {
      throw new Error('No se encontró ningún modelo compatible (.pmx, .fbx, .obj) en el ZIP.');
    }

    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      const cleanName = decodeURIComponent(url.split('/').pop());
      const lowerClean = cleanName.toLowerCase();
      return blobUrls.get(cleanName) || blobUrls.get(lowerClean) || url;
    });

    // ZIP FBX
    if (mainType === 'fbx') {
      const loader = new FBXLoader(manager);
      const blobUrl = URL.createObjectURL(new Blob([mainFile.data]));
      return new Promise((resolve, reject) => {
        loader.load(
          blobUrl,
          (fbx) => {
            fbx.scale.setScalar(0.01);
            resolve(fbx);
          },
          undefined,
          reject
        );
      });
    }

    // ZIP OBJ + MTL
    if (mainType === 'obj') {
      const objBlobUrl = URL.createObjectURL(new Blob([mainFile.data]));
      if (mtlFile) {
        const mtlLoader = new MTLLoader(manager);
        const mtlBlobUrl = URL.createObjectURL(new Blob([mtlFile.data]));
        return new Promise((resolve, reject) => {
          mtlLoader.load(
            mtlBlobUrl,
            (materials) => {
              materials.preload();
              const objLoader = new OBJLoader(manager);
              objLoader.setMaterials(materials);
              objLoader.load(objBlobUrl, (obj) => resolve(obj), undefined, reject);
            },
            undefined,
            reject
          );
        });
      } else {
        const objLoader = new OBJLoader(manager);
        return new Promise((resolve, reject) => {
          objLoader.load(objBlobUrl, (obj) => resolve(obj), undefined, reject);
        });
      }
    }

    // ZIP PMX
    if (mainType === 'pmx') {
      const MMDLoader = await getMMDLoaderClass();
      const loader = new MMDLoader(manager);
      const pmxBlob = new Blob([mainFile.data], { type: 'application/octet-stream' });
      const pmxObjectUrl = URL.createObjectURL(pmxBlob);

      return new Promise((resolve, reject) => {
        loader.load(
          pmxObjectUrl,
          (mesh) => {
            mesh.scale.setScalar(0.08);
            mesh.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                  const mats = Array.isArray(child.material) ? child.material : [child.material];
                  mats.forEach((m) => {
                    m.side = THREE.DoubleSide;
                    m.needsUpdate = true;
                  });
                }
              }
            });
            resolve(mesh);
          },
          undefined,
          reject
        );
      });
    }
  }

  throw new Error('Formato de archivo no compatible');
};

export default function App() {

const [skyboxSrc, setSkyboxSrc] = useState(null);

  const [dialoguePlaylist, setDialoguePlaylist] = useState([]);
  const [activeTab, setActiveTab] = useState('posing');
  const [vrmList, setVrmList] = useState([]);
  const [activeVrmIndex, setActiveVrmIndex] = useState(0);
  const [vrmaList, setVrmaList] = useState([]);

  const [isUiVisible, setIsUiVisible] = useState(true);

  const [selectedBone, setSelectedBone] = useState('');
  const [gizmoEnabled, setGizmoEnabled] = useState(false);
  const [gizmoMode, setGizmoMode] = useState('rotate');
  const [showBoneNodes, setShowBoneNodes] = useState(false);
  const [ikEnabled, setIkEnabled] = useState(false);
  const [autoBlink, setAutoBlink] = useState(true);
  const [lookAtCamera, setLookAtCamera] = useState(true);

  const [stageList, setStageList] = useState([]);
  const [propList, setPropList] = useState([]);
  const [selectedPropIndex, setSelectedPropIndex] = useState(null);
  const [propGizmoMode, setPropGizmoMode] = useState('translate');

  const [fov, setFov] = useState(45);
  const [cameraTargetPreset, setCameraTargetPreset] = useState(null);
  const [lightIntensity, setLightIntensity] = useState(2.0);
  const [dirX, setDirX] = useState(3);
  const [dirY, setDirY] = useState(10);
  const [dirZ, setDirZ] = useState(-4);
  const [shadowStrength, setShadowStrength] = useState(0.8);
  const [showGrid, setShowGrid] = useState(true);
  const [disableFrustumCulling, setDisableFrustumCulling] = useState(true);
  const [bgVideoSrc, setBgVideoSrc] = useState(null);
  const [videoScale, setVideoScale] = useState(100);

  const [particleEffect, setParticleEffect] = useState('none');

  const [windEnabled, setWindEnabled] = useState(false);
  const [windStrength, setWindStrength] = useState(1.0);
  const [windFrequency, setWindFrequency] = useState(4.5);
  const [windDirX, setWindDirX] = useState(0.4);
  const [windDirZ, setWindDirZ] = useState(0.0);

  const [windLift, setWindLift] = useState(0.5);

  const [cameraClip, setCameraClip] = useState(null);
  const [isCameraLockedToTrack, setIsCameraLockedToTrack] = useState(false);
  const [cameraFile, setCameraFile] = useState(null);
  const [cameraFileName, setCameraFileName] = useState('');
  const [camScale, setCamScale] = useState(0.1);
  const [offsetY, setOffsetY] = useState(0.0);
  const [offsetZ, setOffsetZ] = useState(0.0);
  const [isPlayingCamera, setIsPlayingCamera] = useState(true);

  const [toonIntensity, setToonIntensity] = useState(0.9);
  const [shadeColor, setShadeColor] = useState('#5c5075');
  const [outlineEnabled, setOutlineEnabled] = useState(true);
  const [outlineWidth, setOutlineWidth] = useState(0.003);
  const [outlineColor, setOutlineColor] = useState('#000000');
  const [rimIntensity, setRimIntensity] = useState(0.5);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxDuration, setMaxDuration] = useState(10);

  useEffect(() => {
    fetch('/poses/index.json')
      .then((res) => res.json())
      .then((data) => setVrmaList(data))
      .catch(() => {
        fetch('/poses/vrma/index.json')
          .then((res) => res.json())
          .then((data) => setVrmaList(data))
          .catch((err) => console.error('No se pudo cargar index.json', err));
      });
  }, []);

  const handleAvatarUpload = (fileOrEvent, customName) => {
    let file = fileOrEvent;
    if (fileOrEvent && fileOrEvent.target && fileOrEvent.target.files) {
      file = fileOrEvent.target.files[0];
    }
    if (!file) return;

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const objectUrl = URL.createObjectURL(file);
    const fileName = customName || file.name || 'Avatar';

    loader.load(
      objectUrl,
      (gltf) => {
        const vrm = gltf.userData.vrm;
        if (!vrm) return;

        vrm.scene.rotation.y = Math.PI;
        vrm.scene.userData.isVRMScene = true;

        const vrmData = {
          vrm: vrm,
          name: fileName.replace('.vrm', '').replace('.glb', ''),
          offsets: {},
          defaultRotations: {},
          defaultPositions: {}
        };

        const boneNames = [
          'hips', 'head', 'neck', 'spine', 'chest', 'upperChest',
          'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
          'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
          'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
          'rightUpperLeg', 'rightLowerLeg', 'rightFoot'
        ];

        boneNames.forEach((bName) => {
          const bNode = vrm.humanoid?.getNormalizedBoneNode(bName);
          if (bNode) {
            vrmData.defaultRotations[bName] = bNode.rotation.clone();
            vrmData.defaultPositions[bName] = bNode.position.clone();
          }
        });

        setVrmList((prev) => {
          const updated = [...prev, vrmData];
          setActiveVrmIndex(updated.length - 1);
          return updated;
        });
      },
      undefined,
      (err) => console.error('Error al cargar VRM:', err)
    );
  };

  const extractCurrentAvatarPose = () => {
    const active = vrmList[activeVrmIndex];
    if (!active || !active.vrm || !active.vrm.humanoid) return null;

    const boneNames = [
      'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
      'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
      'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
      'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
      'rightUpperLeg', 'rightLowerLeg', 'rightFoot'
    ];

    const currentPoseData = {};
    boneNames.forEach((bName) => {
      const boneNode = active.vrm.humanoid.getNormalizedBoneNode(bName);
      if (boneNode) {
        const euler = new THREE.Euler().setFromQuaternion(boneNode.quaternion, 'YXZ');
        currentPoseData[bName] = {
          rx: THREE.MathUtils.radToDeg(euler.x),
          ry: THREE.MathUtils.radToDeg(euler.y),
          rz: THREE.MathUtils.radToDeg(euler.z),
          px: 0,
          py: 0,
          pz: 0
        };
      }
    });
    return currentPoseData;
  };

  const handleApplyDirectPoseData = (poseData) => {
    if (!poseData) return;
    setVrmList((prev) =>
      prev.map((vData, idx) => {
        if (idx === activeVrmIndex) {
          return {
            ...vData,
            offsets: poseData
          };
        }
        return vData;
      })
    );
  };

  const handleCopyPoseState = () => {
    const currentPoseData = extractCurrentAvatarPose();
    if (!currentPoseData) {
      alert('No hay un avatar activo seleccionado.');
      return;
    }
    handleApplyDirectPoseData(currentPoseData);
    navigator.clipboard.writeText(JSON.stringify(currentPoseData, null, 2));
    alert('📋 ¡Pose copiada al portapapeles!');
  };

  const handleDownloadPoseJson = () => {
    const currentPoseData = extractCurrentAvatarPose();
    if (!currentPoseData) {
      alert('No hay un avatar activo seleccionado.');
      return;
    }

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(currentPoseData, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `pose_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePoseJsonUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const rawData = JSON.parse(text);
        const poseData = rawData.offsets || rawData.pose || rawData;

        const cleanedOffsets = {};
        Object.keys(poseData).forEach((bone) => {
          const b = poseData[bone];
          if (b && typeof b === 'object') {
            cleanedOffsets[bone] = {
              rx: parseFloat(b.rx) || 0,
              ry: parseFloat(b.ry) || 0,
              rz: parseFloat(b.rz) || 0,
              px: parseFloat(b.px) || 0,
              py: parseFloat(b.py) || 0,
              pz: parseFloat(b.pz) || 0
            };
          }
        });

        handleApplyDirectPoseData(cleanedOffsets);
        alert(`✅ Pose cargada: "${file.name}"\nHuesos procesados: ${Object.keys(cleanedOffsets).length}`);
      } catch (err) {
        alert('❌ Error: El archivo no contiene una estructura JSON válida.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleApplyVrmaPoseSample = (vrmaUrl, targetTime = 1.0) => {
    const currentAvatar = vrmList[activeVrmIndex];
    if (!currentAvatar || !currentAvatar.vrm) {
      alert('Carga o selecciona un avatar activo primero.');
      return;
    }

    const loader = new GLTFLoader();
    loader.load(
      vrmaUrl,
      (gltf) => {
        const animations = gltf.animations;
        if (!animations || animations.length === 0) return;

        const clip = animations[0];
        const newOffsets = {};

        const boneNames = [
          'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
          'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
          'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
          'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
          'rightUpperLeg', 'rightLowerLeg', 'rightFoot'
        ];

        boneNames.forEach((b) => {
          newOffsets[b] = { rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0 };
        });

        clip.tracks.forEach((track) => {
          const rawName = track.name;
          const matchedBone =
            boneNames.find((b) => {
              const lowerTrack = rawName.toLowerCase();
              const lowerBone = b.toLowerCase();
              return (
                lowerTrack.startsWith(lowerBone + '.') ||
                lowerTrack.includes('_' + lowerBone + '.') ||
                lowerTrack.includes('.' + lowerBone + '.')
              );
            }) || boneNames.find((b) => rawName.toLowerCase().includes(b.toLowerCase()));

          if (!matchedBone) return;

          const interpolant = track.createInterpolant();
          const evalTime = THREE.MathUtils.clamp(targetTime, 0, clip.duration || targetTime);
          const sampledValues = interpolant.evaluate(evalTime);

          if (rawName.endsWith('.quaternion') && sampledValues.length >= 4) {
            const trackQuat = new THREE.Quaternion(
              sampledValues[0],
              sampledValues[1],
              sampledValues[2],
              sampledValues[3]
            );
            const euler = new THREE.Euler().setFromQuaternion(trackQuat, 'YXZ');
            newOffsets[matchedBone].rx = THREE.MathUtils.radToDeg(euler.x);
            newOffsets[matchedBone].ry = THREE.MathUtils.radToDeg(euler.y);
            newOffsets[matchedBone].rz = THREE.MathUtils.radToDeg(euler.z);
          }
        });

        handleApplyDirectPoseData(newOffsets);
      },
      undefined,
      (err) => console.error('Error al aplicar pose VRMA:', err)
    );
  };

  const handlePlayVrmaAnimation = (vrmaUrl) => {
    const currentAvatar = vrmList[activeVrmIndex];
    if (!currentAvatar || !currentAvatar.vrm) {
      alert('Carga o selecciona un avatar activo primero.');
      return;
    }

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    loader.load(
      vrmaUrl,
      (gltf) => {
        const vrmAnimation = gltf.userData.vrmAnimations?.[0];
        let clip = null;

        if (vrmAnimation) {
          clip = createVRMAnimationClip(vrmAnimation, currentAvatar.vrm);
        } else if (gltf.animations && gltf.animations.length > 0) {
          clip = gltf.animations[0];
        }

        if (!clip) {
          alert('El archivo no contiene pistas de animación VRMA válidas.');
          return;
        }

        currentAvatar.vrm.humanoid.resetNormalizedPose();
        currentAvatar.offsets = {};

        if (!currentAvatar.mixer) {
          currentAvatar.mixer = new THREE.AnimationMixer(currentAvatar.vrm.scene);
        }

        currentAvatar.mixer.stopAllAction();
        currentAvatar.clip = clip;

        const action = currentAvatar.mixer.clipAction(clip);
        action.reset();
        action.setLoop(THREE.LoopRepeat);
        action.play();

        setMaxDuration(clip.duration || 10);
        setCurrentTime(0);
        setIsPlaying(true);
      },
      undefined,
      (err) => {
        console.error('Error cargando VRMA con Pixiv Plugin:', err);
        alert('Error al procesar la animación VRMA.');
      }
    );
  };

  const handleBoneOffsetChange = (boneName, newOffset) => {
    setVrmList((prev) =>
      prev.map((vData, idx) => {
        if (idx === activeVrmIndex) {
          return {
            ...vData,
            offsets: {
              ...(vData.offsets || {}),
              [boneName]: newOffset
            }
          };
        }
        return vData;
      })
    );
  };

  const handleFreezeCurrentFrame = () => {
    const currentPose = extractCurrentAvatarPose();
    if (currentPose) {
      handleApplyDirectPoseData(currentPose);
      setIsPlaying(false);
      setActiveTab('posing');
    }
  };

  const handleStageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const sceneMesh = await loadModelFile(file);
      setStageList((prev) => [...prev, { name: file.name, scene: sceneMesh }]);
    } catch (err) {
      alert('No se pudo cargar el escenario: ' + err.message);
    }
  };

  const handleDeleteStage = (idx) => {
    setStageList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePropUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const sceneMesh = await loadModelFile(file);
      setPropList((prev) => [
        ...prev,
        { name: file.name, scene: sceneMesh, px: 0, py: 0, pz: 0, scale: 1 }
      ]);
    } catch (err) {
      alert('No se pudo cargar el prop: ' + err.message);
    }
  };

  const handleDeleteProp = (idx) => {
    setPropList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePropTransformChange = (idx, field, val) => {
    setPropList((prev) =>
      prev.map((p, i) => {
        if (i === idx) {
          const updated = { ...p, [field]: parseFloat(val) || 0 };
          updated.scene.position.set(updated.px, updated.py, updated.pz);
          updated.scene.scale.setScalar(updated.scale);
          return updated;
        }
        return p;
      })
    );
  };

  const handleDeleteActiveAvatar = (idxToDelete) => {
    const targetIdx = idxToDelete !== undefined ? idxToDelete : activeVrmIndex;
    if (vrmList.length === 0 || !vrmList[targetIdx]) return;

    const avatarToRemove = vrmList[targetIdx];

    if (avatarToRemove?.vrm?.scene?.parent) {
      avatarToRemove.vrm.scene.parent.remove(avatarToRemove.vrm.scene);
    }

    if (avatarToRemove?.vrm?.scene) {
      avatarToRemove.vrm.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }

    const updatedList = vrmList.filter((_, idx) => idx !== targetIdx);
    setVrmList(updatedList);
    setActiveVrmIndex(Math.max(0, targetIdx - 1));
  };

  const handleApplyCameraPreset = (type) => {
    setCameraTargetPreset({ type, id: Date.now() });
  };

  return (
    <div id="app-container" style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <FullscreenButton />

      <button
        onClick={() => setIsUiVisible(!isUiVisible)}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 1000,
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
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(6px)'
        }}
        title={isUiVisible ? 'Ocultar Menú' : 'Mostrar Menú'}
      >
        {isUiVisible ? '👁️' : '📐'}
      </button>

      {isUiVisible && (
        <div id="sidebar">
          <h1>VRMA Studio Pro</h1>

          <div className="tab-nav">
            <button className={`tab-btn ${activeTab === 'posing' ? 'active' : ''}`} onClick={() => setActiveTab('posing')}>💃 Posing</button>
            <button className={`tab-btn ${activeTab === 'dialogue' ? 'active' : ''}`} onClick={() => setActiveTab('dialogue')}>🎙️ Diálogos</button>
            <button className={`tab-btn ${activeTab === 'camera' ? 'active' : ''}`} onClick={() => setActiveTab('camera')}>🎥 Cámara</button>
            <button className={`tab-btn ${activeTab === 'anim' ? 'active' : ''}`} onClick={() => setActiveTab('anim')}>🎬 Escena</button>
            <button className={`tab-btn ${activeTab === 'style' ? 'active' : ''}`} onClick={() => setActiveTab('style')}>🎨 Toon</button>
            <button className={`tab-btn ${activeTab === 'edit' ? 'active' : ''}`} onClick={() => setActiveTab('edit')}>✏️ VRMA</button>
          </div>

          <div className="top-bar-buttons">
            <button>Guardar en App</button>
            <DonateButton />
          </div>

          {activeTab === 'posing' && (
            <PosingPanel
              vrmList={vrmList}
              activeVrmIndex={activeVrmIndex}
              setActiveVrmIndex={setActiveVrmIndex}
              handleAvatarUpload={handleAvatarUpload}
              handleDeleteAvatar={handleDeleteActiveAvatar}
              vrmaList={vrmaList}
              onApplyVrmaPreset={handleApplyVrmaPoseSample}
              selectedBone={selectedBone}
              setSelectedBone={setSelectedBone}
              gizmoEnabled={gizmoEnabled}
              setGizmoEnabled={setGizmoEnabled}
              gizmoMode={gizmoMode}
              setGizmoMode={setGizmoMode}
              showBoneNodes={showBoneNodes}
              setShowBoneNodes={setShowBoneNodes}
              onBoneOffsetChange={handleBoneOffsetChange}
              onCopyPoseState={handleCopyPoseState}
              onDownloadPoseJson={handleDownloadPoseJson}
              onPoseJsonUpload={handlePoseJsonUpload}
              onApplyDirectPoseData={handleApplyDirectPoseData}
              getCurrentPose={extractCurrentAvatarPose}
              ikEnabled={ikEnabled}
              setIkEnabled={setIkEnabled}
              autoBlink={autoBlink}
              setAutoBlink={setAutoBlink}
              lookAtCamera={lookAtCamera}
              setLookAtCamera={setLookAtCamera}
            />
          )}

          {activeTab === 'camera' && (
            <CameraPanel
              fov={fov} setFov={setFov} onApplyCameraPreset={handleApplyCameraPreset}
              isCameraLockedToTrack={isCameraLockedToTrack} setIsCameraLockedToTrack={setIsCameraLockedToTrack}
              setCameraClip={setCameraClip} cameraFile={cameraFile} setCameraFile={setCameraFile}
              cameraFileName={cameraFileName} setCameraFileName={setCameraFileName}
              camScale={camScale} setCamScale={setCamScale} offsetY={offsetY} setOffsetY={setOffsetY}
              offsetZ={offsetZ} setOffsetZ={setOffsetZ} isPlayingCamera={isPlayingCamera} setIsPlayingCamera={setIsPlayingCamera}
            />
          )}

          {activeTab === 'dialogue' && (
            <DialoguePanel
              vrmList={vrmList}
              activeVrmIndex={activeVrmIndex}
              playlist={dialoguePlaylist}
              setPlaylist={setDialoguePlaylist}
              onSpeakerChange={(speakerIdx) => {
                setActiveVrmIndex(speakerIdx);
                setCameraTargetPreset({ type: 'face', targetIndex: speakerIdx, id: Date.now() });
              }}
            />
          )}

          {activeTab === 'anim' && (
            <ScenePanel
              particleEffect={particleEffect} setParticleEffect={setParticleEffect}
              windEnabled={windEnabled} setWindEnabled={setWindEnabled}
              windStrength={windStrength} setWindStrength={setWindStrength}
              windFrequency={windFrequency} setWindFrequency={setWindFrequency}
              windDirX={windDirX} setWindDirX={setWindDirX}
              windDirZ={windDirZ} setWindDirZ={setWindDirZ}
              windLift={windLift} setWindLift={setWindLift}
              
              lightIntensity={lightIntensity} setLightIntensity={setLightIntensity}
              dirX={dirX} setDirX={setDirX} dirY={dirY} setDirY={setDirY}
              showGrid={showGrid} setShowGrid={setShowGrid}
              disableFrustumCulling={disableFrustumCulling} setDisableFrustumCulling={setDisableFrustumCulling}
              bgVideoSrc={bgVideoSrc} setBgVideoSrc={setBgVideoSrc}
              videoScale={videoScale} setVideoScale={setVideoScale}
              stageList={stageList} handleStageUpload={handleStageUpload} handleDeleteStage={handleDeleteStage}
              propList={propList} handlePropUpload={handlePropUpload} handleDeleteProp={handleDeleteProp} handlePropTransformChange={handlePropTransformChange}
              selectedPropIndex={selectedPropIndex} setSelectedPropIndex={setSelectedPropIndex}
              propGizmoMode={propGizmoMode} setPropGizmoMode={setPropGizmoMode}
           skyboxSrc={skyboxSrc}
           setSkyboxSrc={setSkyboxSrc}       />
          )}

          {activeTab === 'style' && (
            <StylePanel
              lightIntensity={lightIntensity} setLightIntensity={setLightIntensity}
              dirX={dirX} setDirX={setDirX} dirY={dirY} setDirY={setDirY}
              dirZ={dirZ} setDirZ={setDirZ} shadowStrength={shadowStrength} setShadowStrength={setShadowStrength}
              toonIntensity={toonIntensity} setToonIntensity={setToonIntensity}
              shadeColor={shadeColor} setShadeColor={setShadeColor}
              outlineEnabled={outlineEnabled} setOutlineEnabled={setOutlineEnabled}
              outlineWidth={outlineWidth} setOutlineWidth={setOutlineWidth}
              outlineColor={outlineColor} setOutlineColor={setOutlineColor}
              rimIntensity={rimIntensity} setRimIntensity={setRimIntensity}
            />
          )}

          {activeTab === 'edit' && (
            <VrmaPanel
              vrmList={vrmList} activeVrmIndex={activeVrmIndex} isPlaying={isPlaying}
              setIsPlaying={setIsPlaying} currentTime={currentTime} setCurrentTime={setCurrentTime}
              maxDuration={maxDuration} setMaxDuration={setMaxDuration}
              onFreezeFrame={handleFreezeCurrentFrame} vrmaList={vrmaList} onApplyVrmaPreset={handlePlayVrmaAnimation}
            />
          )}
        </div>
      )}

      <CanvasViewer
        vrmList={vrmList} activeVrmIndex={activeVrmIndex} isEditFocusMode={activeTab === 'edit'}
        lightIntensity={lightIntensity} dirX={dirX} dirY={dirY} dirZ={dirZ} shadowStrength={shadowStrength} showGrid={showGrid}
        disableFrustumCulling={disableFrustumCulling}
        bgVideoSrc={bgVideoSrc} videoScale={videoScale} isPlaying={isPlaying}
        onTimeUpdate={(time) => setCurrentTime(time)} fov={fov} cameraTargetPreset={cameraTargetPreset}
        stageList={stageList} propList={propList}
        selectedPropIndex={selectedPropIndex} setSelectedPropIndex={setSelectedPropIndex} propGizmoMode={propGizmoMode}
        toonIntensity={toonIntensity} shadeColor={shadeColor} outlineEnabled={outlineEnabled}
        outlineWidth={outlineWidth} outlineColor={outlineColor} rimIntensity={rimIntensity}
        selectedBone={selectedBone} setSelectedBone={setSelectedBone} gizmoEnabled={gizmoEnabled} gizmoMode={gizmoMode}
        showBoneNodes={showBoneNodes} onBoneOffsetChange={handleBoneOffsetChange}
        ikEnabled={ikEnabled} autoBlink={autoBlink} lookAtCamera={lookAtCamera}
        cameraClip={cameraClip} isCameraLockedToTrack={isCameraLockedToTrack}
        windEnabled={windEnabled} windStrength={windStrength} windFrequency={windFrequency}
        windDirX={windDirX} windDirZ={windDirZ}
        windLift={windLift}
        
        particleEffect={particleEffect}
        skyboxSrc={skyboxSrc}
      />
    </div>
  );
}
