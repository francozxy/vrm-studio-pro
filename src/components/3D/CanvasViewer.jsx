import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export default function CanvasViewer({
  vrmList = [],
  activeVrmIndex = 0,
  isEditFocusMode = false,
  lightIntensity = 2.0,
  dirX = 3,
  dirY = 10,
  dirZ = -4,
  shadowStrength = 0.8,
  showGrid = true,
  disableFrustumCulling = true,
  bgVideoSrc = null,
  videoScale = 100,
  isPlaying = false,
  onTimeUpdate,
  fov = 45,
  cameraTargetPreset = null,
  stageList = [],
  propList = [],
  toonIntensity = 0.9,
  shadeColor = '#5c5075',
  outlineEnabled = true,
  outlineWidth = 0.003,
  outlineColor = '#000000',
  rimIntensity = 0.5,
  selectedBone = '',
  setSelectedBone,
  gizmoEnabled = false,
  gizmoMode = 'rotate',
  showBoneNodes = true,
  onBoneOffsetChange,
  ikEnabled = false,
  autoBlink = true,
  lookAtCamera = true,
  cameraClip = null,
  isCameraLockedToTrack = false,
  windEnabled = false,
  windStrength = 1.0,
  windFrequency = 4.5,
  windDirX = 0.4,
  windDirZ = 0.0,
  particleEffect = 'none'
}) {
  const mountRef = useRef(null);
  const cameraMixerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const transformControlsRef = useRef(null);
  const dirLightRef = useRef(null);
  const hemiLightRef = useRef(null);
  const gridRef = useRef(null);
  const videoRef = useRef(null);

  const boneMarkerGroupRef = useRef(new THREE.Group());
  const ikMarkerGroupRef = useRef(new THREE.Group());
  const particlesGroupRef = useRef(new THREE.Group());

  const boneList = [
    'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
    'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
    'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
    'rightUpperLeg', 'rightLowerLeg', 'rightFoot'
  ];

  const ikChains = [
    {
      name: 'leftHand',
      poleName: 'leftElbowPole',
      root: 'leftUpperArm',
      mid: 'leftLowerArm',
      end: 'leftHand',
      defaultPoleOffset: new THREE.Vector3(-0.15, 0, 0.3)
    },
    {
      name: 'rightHand',
      poleName: 'rightElbowPole',
      root: 'rightUpperArm',
      mid: 'rightLowerArm',
      end: 'rightHand',
      defaultPoleOffset: new THREE.Vector3(0.15, 0, 0.3)
    },
    {
      name: 'leftFoot',
      poleName: 'leftKneePole',
      root: 'leftUpperLeg',
      mid: 'leftLowerLeg',
      end: 'leftFoot',
      defaultPoleOffset: new THREE.Vector3(0, 0, -0.35)
    },
    {
      name: 'rightFoot',
      poleName: 'rightKneePole',
      root: 'rightUpperLeg',
      mid: 'rightLowerLeg',
      end: 'rightFoot',
      defaultPoleOffset: new THREE.Vector3(0, 0, -0.35)
    }
  ];

  const applyDirectOffsets = (vData) => {
    if (!vData || !vData.vrm || !vData.vrm.humanoid || !vData.offsets) return;
    const humanoid = vData.vrm.humanoid;

    Object.entries(vData.offsets).forEach(([bName, offset]) => {
      const boneNode = humanoid.getNormalizedBoneNode(bName);
      if (boneNode && offset) {
        const rx = THREE.MathUtils.degToRad(offset.rx || 0);
        const ry = THREE.MathUtils.degToRad(offset.ry || 0);
        const rz = THREE.MathUtils.degToRad(offset.rz || 0);

        const euler = new THREE.Euler(rx, ry, rz, 'YXZ');
        boneNode.quaternion.setFromEuler(euler);

        if (bName === 'hips') {
          const defPos = vData.defaultPositions?.hips || new THREE.Vector3(0, 0, 0);
          boneNode.position.set(
            defPos.x + (offset.px || 0),
            defPos.y + (offset.py || 0),
            defPos.z + (offset.pz || 0)
          );
        }
      }
    });
  };

  const solveTwoBoneIK = (rootBone, midBone, endBone, targetWorldPos, poleWorldPos) => {
    if (!rootBone || !midBone) return;

    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    rootBone.getWorldPosition(a);
    midBone.getWorldPosition(b);
    if (endBone) {
      endBone.getWorldPosition(c);
    } else {
      c.copy(b).add(b.clone().sub(a));
    }

    const l1 = a.distanceTo(b);
    const l2 = endBone ? b.distanceTo(c) : l1 * 0.95;
    if (l1 < 0.001 || l2 < 0.001) return;

    const at = targetWorldPos.clone().sub(a);
    const d = THREE.MathUtils.clamp(at.length(), 0.01, (l1 + l2) * 0.999);

    const cosAlpha = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const alpha = Math.acos(THREE.MathUtils.clamp(cosAlpha, -1, 1));

    const targetDir = at.clone().normalize();
    const poleDir = poleWorldPos.clone().sub(a).normalize();

    let bendNormal = new THREE.Vector3().crossVectors(targetDir, poleDir).normalize();
    if (bendNormal.lengthSq() < 0.001) {
      bendNormal = new THREE.Vector3(1, 0, 0);
    }

    const midDir = targetDir.clone().applyAxisAngle(bendNormal, alpha);
    const newMidPos = a.clone().add(midDir.multiplyScalar(l1));

    const currentRootVec = b.clone().sub(a).normalize();
    const desiredRootVec = newMidPos.clone().sub(a).normalize();
    const rootRotDelta = new THREE.Quaternion().setFromUnitVectors(currentRootVec, desiredRootVec);

    const parentWorldQuat = rootBone.parent ? rootBone.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
    const currentWorldQuat = rootBone.getWorldQuaternion(new THREE.Quaternion());
    const newWorldQuat = rootRotDelta.multiply(currentWorldQuat);
    rootBone.quaternion.copy(parentWorldQuat.clone().invert().multiply(newWorldQuat));

    midBone.updateWorldMatrix(true, false);
    const midWorldPos = new THREE.Vector3();
    midBone.getWorldPosition(midWorldPos);

    const currentMidVec = c.clone().sub(midWorldPos).normalize();
    const desiredMidVec = targetWorldPos.clone().sub(midWorldPos).normalize();
    const midRotDelta = new THREE.Quaternion().setFromUnitVectors(currentMidVec, desiredMidVec);

    const midParentQuat = midBone.parent.getWorldQuaternion(new THREE.Quaternion());
    const currentMidWorld = midBone.getWorldQuaternion(new THREE.Quaternion());
    midBone.quaternion.copy(midParentQuat.clone().invert().multiply(midRotDelta.multiply(currentMidWorld)));
  };

  const createParticles = () => {
    const pGroup = particlesGroupRef.current;
    if (!pGroup) return;
    pGroup.clear();

    const eff = (window.__particleType || particleEffect || 'none').toLowerCase();
    const count = window.__particleDensity || 150;

    if (eff === 'none') return;

    let geo, mat;

    if (eff.includes('sakura') || eff.includes('petal')) {
      geo = new THREE.PlaneGeometry(0.045, 0.065);
      geo.rotateZ(Math.PI / 4);
      mat = new THREE.MeshStandardMaterial({
        color: 0xffb7c5,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        roughness: 0.3
      });
    } else if (eff.includes('autumn')) {
      geo = new THREE.PlaneGeometry(0.05, 0.07);
      mat = new THREE.MeshStandardMaterial({
        color: 0xd9682a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });
    } else if (eff.includes('snow') || eff.includes('nieve')) {
      geo = new THREE.SphereGeometry(0.02, 6, 6);
      mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    } else if (eff.includes('rain') || eff.includes('lluvia')) {
      geo = new THREE.CylinderGeometry(0.003, 0.003, 0.25, 4);
      mat = new THREE.MeshBasicMaterial({ color: 0xa4c2f4, transparent: true, opacity: 0.7 });
    } else if (eff.includes('sparks') || eff.includes('destellos')) {
      geo = new THREE.OctahedronGeometry(0.025, 0);
      mat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95 });
    }

    if (!geo || !mat) return;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 8,
        Math.random() * 5,
        (Math.random() - 0.5) * 8
      );
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      mesh.userData = {
        fallSpeed: eff.includes('rain') || eff.includes('lluvia') ? 0.08 : (eff.includes('snow') || eff.includes('nieve') ? 0.006 : 0.012 + Math.random() * 0.01),
        swaySpeed: 1.2 + Math.random() * 2.0,
        phase: Math.random() * Math.PI * 2,
        rotX: (Math.random() - 0.5) * 0.04,
        rotY: (Math.random() - 0.5) * 0.04,
        rotZ: (Math.random() - 0.5) * 0.04
      };
      pGroup.add(mesh);
    }
  };

  useEffect(() => {
    window.__triggerParticleUpdate = createParticles;
    createParticles();
  }, [particleEffect]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(fov, container.clientWidth / container.clientHeight, 0.05, 3000);
    camera.position.set(0, 1.2, 2.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '2';
    renderer.domElement.style.pointerEvents = 'auto';

    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.0, 0);
    controls.maxDistance = 2000;
    controls.update();
    controlsRef.current = controls;

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControlsRef.current = transformControls;

    transformControls.addEventListener('dragging-changed', (event) => {
      window.__isGizmoDragging = event.value;
      if (controlsRef.current) {
        controlsRef.current.enabled = !event.value && !window.__isCameraLockedToTrack;
      }
    });

    scene.add(transformControls.getHelper());
    scene.add(boneMarkerGroupRef.current);
    scene.add(ikMarkerGroupRef.current);
    scene.add(particlesGroupRef.current);

    cameraMixerRef.current = new THREE.AnimationMixer(camera);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    const dirLight = new THREE.DirectionalLight(0xffffff, lightIntensity);
    dirLight.position.set(dirX, dirY, dirZ);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.camera.left = -10;
    dirLight.shadow.camera.right = 10;
    dirLight.shadow.camera.top = 10;
    dirLight.shadow.camera.bottom = -10;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    const gridHelper = new THREE.GridHelper(10, 10, 0x7aa2f7, 0x414868);
    scene.add(gridHelper);
    gridRef.current = gridHelper;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let isPointerDown = false;

    const handlePointerDown = (event) => {
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;
      pointerDownPos = { x: clientX, y: clientY };
      isPointerDown = true;
    };

    const handlePointerUp = (event) => {
      if (!isPointerDown) return;
      isPointerDown = false;

      const clientX = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
      const clientY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;

      const dist = Math.hypot(clientX - pointerDownPos.x, clientY - pointerDownPos.y);
      if (dist > 6) return;

      if (transformControlsRef.current && transformControlsRef.current.dragging) return;
      if (!setSelectedBone) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      if (window.__ikEnabled) {
        const ikIntersects = raycaster.intersectObjects(ikMarkerGroupRef.current.children, true);
        if (ikIntersects.length > 0) {
          const hitIk = ikIntersects[0].object;
          transformControlsRef.current.setMode('translate');
          transformControlsRef.current.attach(hitIk);
          transformControlsRef.current.enabled = true;
          return;
        }
      }

      const intersects = raycaster.intersectObjects(boneMarkerGroupRef.current.children, true);

      if (intersects.length > 0) {
        const hitMarker = intersects[0].object;
        if (hitMarker.userData && hitMarker.userData.boneName) {
          setSelectedBone(hitMarker.userData.boneName);
        }
      } else {
        setSelectedBone('');
        if (transformControlsRef.current) {
          transformControlsRef.current.detach();
        }
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', handlePointerDown);
    domElem.addEventListener('pointerup', handlePointerUp);

    const clock = new THREE.Clock();
    let animationFrameId;
    let blinkTimer = 0;
    let nextBlinkTime = 2.5;
    let isBlinking = false;
    let blinkProgress = 0;
    let windTime = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      windTime += delta;

      if (cameraMixerRef.current && window.__isCameraLockedToTrack && window.__isPlayingCamera !== false) {
        cameraMixerRef.current.update(delta);
      }

      if (controlsRef.current) {
        controlsRef.current.enabled = !window.__isCameraLockedToTrack && !window.__isGizmoDragging;
        if (controlsRef.current.enabled) {
          controlsRef.current.update();
        }
      }

      // Animación activa de partículas (caída y balanceo)
      if (particlesGroupRef.current && particlesGroupRef.current.children.length > 0) {
        const pList = particlesGroupRef.current.children;
        const windX = window.__windEnabled ? (window.__windDirX || 0.4) * (window.__windStrength || 1.0) : 0.1;
        const windZ = window.__windEnabled ? (window.__windDirZ || 0.0) * (window.__windStrength || 1.0) : 0.05;

        for (let i = 0; i < pList.length; i++) {
          const p = pList[i];
          const u = p.userData;

          p.position.y -= u.fallSpeed * delta * 60;
          p.position.x += Math.sin(windTime * u.swaySpeed + u.phase) * 0.008 + windX * delta * 0.8;
          p.position.z += Math.cos(windTime * u.swaySpeed + u.phase) * 0.006 + windZ * delta * 0.8;

          p.rotation.x += u.rotX;
          p.rotation.y += u.rotY;
          p.rotation.z += u.rotZ;

          if (p.position.y < -0.2) {
            p.position.y = 4.0 + Math.random() * 1.5;
            p.position.x = (Math.random() - 0.5) * 8;
            p.position.z = (Math.random() - 0.5) * 8;
          }
        }
      }

      if (window.__vrmList && Array.isArray(window.__vrmList)) {
        window.__vrmList.forEach((vData, idx) => {
          if (vData && vData.vrm) {
            if (vData.vrm.springBoneManager) {
              const spManager = vData.vrm.springBoneManager;
              const isWindOn = !!window.__windEnabled;

              if (isWindOn) {
                const freq = (window.__windSpeed || 2.0) * 2.2;
                const strength = window.__windStrength !== undefined ? window.__windStrength : 0.5;
                const dirXVal = window.__windDirX !== undefined ? window.__windDirX : 1.0;
                const dirZVal = window.__windDirZ !== undefined ? window.__windDirZ : 0.0;

                const t = windTime * freq;
                const gust = Math.sin(t) * Math.cos(t * 0.6) + Math.sin(t * 1.8) * 0.3;
                const forceX = dirXVal * strength * (1.2 + gust);
                const forceZ = (dirZVal + 0.3) * strength * (1.0 + Math.cos(t * 1.2) * 0.5);
                const forceY = -0.3 * strength + Math.sin(t * 2.0) * 0.1 * strength;

                const windVec = new THREE.Vector3(forceX * 2.5, forceY, forceZ * 2.5);

                if (spManager.joints) {
                  spManager.joints.forEach((joint) => {
                    if (joint.settings) {
                      joint.settings.gravityDir = windVec.clone().normalize();
                      joint.settings.gravityPower = windVec.length();
                    }
                  });
                }

                if (spManager.springBones) {
                  spManager.springBones.forEach((spring) => {
                    if (spring.gravityDir) {
                      spring.gravityDir.copy(windVec).normalize();
                      spring.gravityPower = windVec.length();
                    }
                  });
                }
              } else {
                const defaultGravity = new THREE.Vector3(0, -1, 0);

                if (spManager.joints) {
                  spManager.joints.forEach((joint) => {
                    if (joint.settings && joint.settings.gravityPower !== 0) {
                      joint.settings.gravityDir = defaultGravity;
                      joint.settings.gravityPower = 0;
                    }
                  });
                }

                if (spManager.springBones) {
                  spManager.springBones.forEach((spring) => {
                    if (spring.gravityDir && spring.gravityPower !== 0) {
                      spring.gravityDir.copy(defaultGravity);
                      spring.gravityPower = 0;
                    }
                  });
                }
              }
            }

            if (vData.mixer && window.__isPlaying) {
              vData.mixer.update(delta);
              if (idx === window.__activeVrmIndex && window.__onTimeUpdate && vData.clip) {
                const curTime = vData.mixer.time % vData.clip.duration;
                window.__onTimeUpdate(curTime);
              }
            }

            vData.vrm.update(delta);
            applyDirectOffsets(vData);

            if (window.__isEditFocusMode) {
              vData.vrm.scene.visible = (idx === window.__activeVrmIndex);
            } else {
              vData.vrm.scene.visible = true;
            }
          }
        });
      }

      const activeAvatar = window.__vrmList ? window.__vrmList[window.__activeVrmIndex] : null;

      if (activeAvatar && activeAvatar.vrm && activeAvatar.vrm.lookAt) {
        if (window.__lookAtCamera && cameraRef.current) {
          activeAvatar.vrm.lookAt.target = cameraRef.current;
          activeAvatar.vrm.lookAt.autoUpdate = true;
        } else {
          activeAvatar.vrm.lookAt.target = null;
          activeAvatar.vrm.lookAt.autoUpdate = false;
        }
      }

      if (window.__autoBlink && activeAvatar && activeAvatar.vrm && activeAvatar.vrm.expressionManager) {
        blinkTimer += delta;
        if (!isBlinking && blinkTimer >= nextBlinkTime) {
          isBlinking = true;
          blinkProgress = 0;
        }

        if (isBlinking) {
          blinkProgress += delta * 14.0;
          const blinkWeight = Math.sin(Math.min(Math.PI, blinkProgress));
          activeAvatar.vrm.expressionManager.setValue('blink', Math.max(0, blinkWeight));

          if (blinkProgress >= Math.PI) {
            isBlinking = false;
            blinkTimer = 0;
            nextBlinkTime = 2.0 + Math.random() * 3.5;
            activeAvatar.vrm.expressionManager.setValue('blink', 0);
          }
        }
      }

      if (activeAvatar && activeAvatar.vrm && boneMarkerGroupRef.current) {
        const isBonesToggled = window.__showBoneNodes;
        const activeBone = window.__selectedBone;

        boneMarkerGroupRef.current.children.forEach(marker => {
          const bName = marker.userData.boneName;
          const boneNode = activeAvatar.vrm.humanoid.getNormalizedBoneNode(bName);
          if (boneNode) {
            const worldPos = new THREE.Vector3();
            boneNode.getWorldPosition(worldPos);
            marker.position.copy(worldPos);

            if (!isBonesToggled || window.__ikEnabled) {
              marker.visible = false;
            } else if (activeBone) {
              if (bName === activeBone) {
                marker.visible = true;
                marker.material.color.setHex(0xe0af68);
                marker.scale.setScalar(1.3);
              } else {
                marker.visible = false;
              }
            } else {
              marker.visible = true;
              marker.material.color.setHex(0x9ece6a);
              marker.scale.setScalar(1.0);
            }
          }
        });
      }

      if (window.__ikEnabled && activeAvatar && activeAvatar.vrm) {
        ikMarkerGroupRef.current.children.forEach(m => (m.visible = true));

        ikChains.forEach(chain => {
          const targetMesh = ikMarkerGroupRef.current.children.find(m => m.userData.chainName === chain.name);
          const poleMesh = ikMarkerGroupRef.current.children.find(m => m.userData.poleName === chain.poleName);

          if (targetMesh && poleMesh) {
            const rootNode = activeAvatar.vrm.humanoid.getNormalizedBoneNode(chain.root);
            const midNode = activeAvatar.vrm.humanoid.getNormalizedBoneNode(chain.mid);
            const endNode = activeAvatar.vrm.humanoid.getNormalizedBoneNode(chain.end);

            if (rootNode && midNode) {
              solveTwoBoneIK(rootNode, midNode, endNode, targetMesh.position, poleMesh.position);
            }
          }
        });
      } else {
        ikMarkerGroupRef.current.children.forEach(m => (m.visible = false));
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      domElem.removeEventListener('pointerdown', handlePointerDown);
      domElem.removeEventListener('pointerup', handlePointerUp);
      resizeObserver.disconnect();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const isCulled = !disableFrustumCulling;

    vrmList.forEach(vData => {
      if (vData?.vrm?.scene) {
        vData.vrm.scene.traverse((obj) => {
          if (obj.isMesh) {
            obj.frustumCulled = isCulled;
          }
        });
      }
    });

    stageList.forEach(stg => {
      if (stg?.scene) {
        stg.scene.traverse((obj) => {
          if (obj.isMesh) {
            obj.frustumCulled = isCulled;
          }
        });
      }
    });

    propList.forEach(prp => {
      if (prp?.scene) {
        prp.scene.traverse((obj) => {
          if (obj.isMesh) {
            obj.frustumCulled = isCulled;
          }
        });
      }
    });
  }, [disableFrustumCulling, vrmList, stageList, propList]);

  useEffect(() => {
    if (cameraClip && cameraMixerRef.current) {
      cameraMixerRef.current.stopAllAction();
      const action = cameraMixerRef.current.clipAction(cameraClip);
      action.reset();
      action.setLoop(THREE.LoopRepeat);
      action.play();
    }
  }, [cameraClip]);

  useEffect(() => {
    const markerGroup = boneMarkerGroupRef.current;
    markerGroup.clear();

    const sphereGeo = new THREE.SphereGeometry(0.035, 12, 12);

    boneList.forEach(bName => {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x9ece6a,
        depthTest: false,
        transparent: true,
        opacity: 0.85
      });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.renderOrder = 999;
      mesh.userData = { boneName: bName };
      markerGroup.add(mesh);
    });
  }, []);

  useEffect(() => {
    const ikGroup = ikMarkerGroupRef.current;
    ikGroup.clear();

    const targetGeo = new THREE.SphereGeometry(0.045, 16, 16);
    const poleGeo = new THREE.SphereGeometry(0.035, 16, 16);

    ikChains.forEach(chain => {
      const targetMat = new THREE.MeshBasicMaterial({
        color: 0x7aa2f7,
        depthTest: false,
        transparent: true,
        opacity: 0.9
      });
      const targetMesh = new THREE.Mesh(targetGeo, targetMat);
      targetMesh.renderOrder = 1000;
      targetMesh.userData = { isIkTarget: true, chainName: chain.name };
      targetMesh.visible = false;
      ikGroup.add(targetMesh);

      const poleMat = new THREE.MeshBasicMaterial({
        color: 0xbb9af7,
        depthTest: false,
        transparent: true,
        opacity: 0.9
      });
      const poleMesh = new THREE.Mesh(poleGeo, poleMat);
      poleMesh.renderOrder = 1000;
      poleMesh.userData = { isPoleTarget: true, poleName: chain.poleName };
      poleMesh.visible = false;
      ikGroup.add(poleMesh);
    });
  }, []);

  useEffect(() => {
    if (ikEnabled && vrmList[activeVrmIndex]?.vrm) {
      const vrm = vrmList[activeVrmIndex].vrm;
      vrm.scene.updateMatrixWorld(true);

      ikMarkerGroupRef.current.children.forEach(mesh => {
        if (mesh.userData.isIkTarget) {
          const boneNode = vrm.humanoid.getNormalizedBoneNode(mesh.userData.chainName);
          if (boneNode) {
            boneNode.updateWorldMatrix(true, false);
            boneNode.getWorldPosition(mesh.position);
          }
        } else if (mesh.userData.isPoleTarget) {
          const chain = ikChains.find(c => c.poleName === mesh.userData.poleName);
          if (chain) {
            const midNode = vrm.humanoid.getNormalizedBoneNode(chain.mid);
            if (midNode) {
              midNode.updateWorldMatrix(true, false);
              const midPos = new THREE.Vector3();
              midNode.getWorldPosition(midPos);
              mesh.position.copy(midPos).add(chain.defaultPoleOffset);
            }
          }
        }
      });
    }
  }, [ikEnabled, activeVrmIndex, vrmList]);

  useEffect(() => {
    if (!transformControlsRef.current) return;
    const tc = transformControlsRef.current;

    if (ikEnabled) return;

    const currentAvatar = vrmList[activeVrmIndex];
    if (gizmoEnabled && selectedBone && currentAvatar && currentAvatar.vrm && currentAvatar.vrm.humanoid) {
      const boneNode = currentAvatar.vrm.humanoid.getNormalizedBoneNode(selectedBone);
      if (boneNode) {
        tc.setMode(gizmoMode);
        tc.attach(boneNode);
        tc.enabled = true;

        const handleGizmoChange = () => {
          if (!tc.object || !onBoneOffsetChange) return;

          const euler = new THREE.Euler().setFromQuaternion(tc.object.quaternion, 'YXZ');
          const objPos = tc.object.position;
          const defPos = currentAvatar.defaultPositions?.[selectedBone] || new THREE.Vector3(0, 0, 0);

          onBoneOffsetChange(selectedBone, {
            rx: THREE.MathUtils.radToDeg(euler.x),
            ry: THREE.MathUtils.radToDeg(euler.y),
            rz: THREE.MathUtils.radToDeg(euler.z),
            px: selectedBone === 'hips' ? objPos.x - defPos.x : 0,
            py: selectedBone === 'hips' ? objPos.y - defPos.y : 0,
            pz: selectedBone === 'hips' ? objPos.z - defPos.z : 0
          });
        };

        tc.addEventListener('change', handleGizmoChange);
        return () => tc.removeEventListener('change', handleGizmoChange);
      }
    }

    tc.detach();
    tc.enabled = false;
  }, [gizmoEnabled, gizmoMode, selectedBone, activeVrmIndex, vrmList, onBoneOffsetChange, ikEnabled]);

  useEffect(() => {
    if (cameraRef.current && !isCameraLockedToTrack) {
      cameraRef.current.fov = fov;
      cameraRef.current.updateProjectionMatrix();
    }
  }, [fov, isCameraLockedToTrack]);

  useEffect(() => {
    if (!cameraTargetPreset || !cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    switch (cameraTargetPreset.type) {
      case 'face':
        camera.position.set(0, 1.45, 0.8);
        controls.target.set(0, 1.4, 0);
        break;
      case 'body':
        camera.position.set(0, 0.9, 2.8);
        controls.target.set(0, 0.8, 0);
        break;
      case 'top':
        camera.position.set(0, 3.2, 1.5);
        controls.target.set(0, 0.8, 0);
        break;
      case 'reset':
      default:
        camera.position.set(0, 1.2, 2.5);
        controls.target.set(0, 1.0, 0);
        break;
    }
    controls.update();
  }, [cameraTargetPreset]);

  useEffect(() => {
    if (hemiLightRef.current) {
      hemiLightRef.current.intensity = Math.max(0.05, 1.0 - shadowStrength);
    }

    const shadowThreeColor = new THREE.Color(shadeColor);
    const outlineThreeColor = new THREE.Color(outlineColor);

    vrmList.forEach(vData => {
      if (!vData || !vData.vrm) return;

      const targetMaterials = new Set();
      if (vData.vrm.materials) {
        vData.vrm.materials.forEach(m => targetMaterials.add(m));
      }

      vData.vrm.scene.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => targetMaterials.add(m));
        }
      });

      targetMaterials.forEach((mat) => {
        if ('shadingToonyFactor' in mat) mat.shadingToonyFactor = toonIntensity;
        if ('shadingShiftFactor' in mat) mat.shadingShiftFactor = (toonIntensity - 0.5) * 1.5;
        if ('shadeToony' in mat) mat.shadeToony = toonIntensity;

        if (mat.shadeColorFactor && mat.shadeColorFactor.copy) {
          mat.shadeColorFactor.copy(shadowThreeColor);
        } else if (mat.shadeColor && mat.shadeColor.copy) {
          mat.shadeColor.copy(shadowThreeColor);
        }

        if ('outlineWidthFactor' in mat) {
          mat.outlineWidthFactor = outlineEnabled ? outlineWidth : 0;
        }

        if (mat.outlineColorFactor && mat.outlineColorFactor.copy) {
          mat.outlineColorFactor.copy(outlineThreeColor);
        } else if (mat.outlineColor && mat.outlineColor.copy) {
          mat.outlineColor.copy(outlineThreeColor);
        }

        if ('rimLightingMix' in mat) mat.rimLightingMix = rimIntensity;

        mat.needsUpdate = true;
      });
    });
  }, [toonIntensity, shadeColor, outlineEnabled, outlineWidth, outlineColor, rimIntensity, shadowStrength, vrmList]);

  useEffect(() => {
    if (dirLightRef.current) {
      dirLightRef.current.intensity = lightIntensity;
      dirLightRef.current.position.set(dirX, dirY, dirZ);
    }
    if (gridRef.current) {
      gridRef.current.visible = showGrid;
    }
  }, [lightIntensity, dirX, dirY, dirZ, showGrid]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    stageList.forEach(stg => {
      if (stg.scene && !scene.children.includes(stg.scene)) {
        stg.scene.traverse(child => {
          if (child.isMesh) {
            child.receiveShadow = true;
            child.castShadow = true;
            child.frustumCulled = !disableFrustumCulling;
          }
        });
        scene.add(stg.scene);
      }
    });

    propList.forEach(prp => {
      if (prp.scene && !scene.children.includes(prp.scene)) {
        prp.scene.traverse(child => {
          if (child.isMesh) {
            child.receiveShadow = true;
            child.castShadow = true;
            child.frustumCulled = !disableFrustumCulling;
          }
        });
        scene.add(prp.scene);
      }
    });

    window.__vrmList = vrmList;
    window.__activeVrmIndex = activeVrmIndex;
    window.__isEditFocusMode = isEditFocusMode;
    window.__isPlaying = isPlaying;
    window.__onTimeUpdate = onTimeUpdate;
    window.__selectedBone = selectedBone;
    window.__showBoneNodes = showBoneNodes;
    window.__ikEnabled = ikEnabled;
    window.__autoBlink = autoBlink;
    window.__lookAtCamera = lookAtCamera;
    window.__isCameraLockedToTrack = isCameraLockedToTrack;
    window.__windEnabled = windEnabled;
    window.__windStrength = windStrength;
    window.__windFrequency = windFrequency;
    window.__windDirX = windDirX;
    window.__windDirZ = windDirZ;

    // 1. Limpieza de modelos VRM huérfanos
    const activeScenes = new Set(vrmList.map((v) => v.vrm?.scene).filter(Boolean));
    const toRemove = [];
    scene.children.forEach((child) => {
      if (child.userData?.isVRMScene && !activeScenes.has(child)) {
        toRemove.push(child);
      }
    });
    toRemove.forEach((child) => scene.remove(child));

    // 2. Agregar o reposicionar avatares activos
    vrmList.forEach((vData, idx) => {
      if (vData.vrm) {
        vData.vrm.scene.userData.isVRMScene = true;
        if (!vData.hasInitialPosition) {
          vData.vrm.scene.position.set((idx - (vrmList.length - 1) / 2) * 0.8, 0, 0);
          vData.vrm.scene.rotation.y = Math.PI;
          vData.hasInitialPosition = true;
        }
        vData.vrm.scene.traverse((obj) => {
          if (obj.isMesh) {
            obj.frustumCulled = !disableFrustumCulling;
          }
        });
        if (!scene.children.includes(vData.vrm.scene)) {
          scene.add(vData.vrm.scene);
        }
      }
    });
  }, [vrmList, activeVrmIndex, isEditFocusMode, isPlaying, onTimeUpdate, stageList, propList, selectedBone, showBoneNodes, ikEnabled, autoBlink, lookAtCamera, isCameraLockedToTrack, disableFrustumCulling, windEnabled, windStrength, windFrequency, windDirX, windDirZ]);

  return (
    <div id="viewport-container" ref={mountRef} style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%', backgroundColor: 'transparent' }}>
      {bgVideoSrc && (
        <video 
          ref={videoRef} 
          src={bgVideoSrc} 
          autoPlay 
          loop 
          muted 
          playsInline
          style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)', 
            width: `${videoScale}%`, 
            height: 'auto', 
            maxHeight: '100%', 
            zIndex: 1, 
            objectFit: 'contain', 
            pointerEvents: 'none' 
          }}
        />
      )}
    </div>
  );
}
