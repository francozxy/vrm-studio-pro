import fs from 'fs';
import path from 'path';

// Al estar en /public/poses, leemos el directorio actual y guardamos en /vrma
const CARPETA_ORIGEN = './';
const CARPETA_DESTINO = './vrma';

if (!fs.existsSync(CARPETA_DESTINO)) {
  fs.mkdirSync(CARPETA_DESTINO, { recursive: true });
}

function degToRad(degrees) {
  return (degrees || 0) * (Math.PI / 180);
}

// Convertir ángulos de Euler (grados) a Cuaternión binario [x, y, z, w]
function eulerToQuaternion(rx, ry, rz) {
  const x = degToRad(rx);
  const y = degToRad(ry);
  const z = degToRad(rz);

  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);

  const qx = s1 * c2 * c3 + c1 * s2 * s3;
  const qy = c1 * s2 * c3 - s1 * c2 * s3;
  const qz = c1 * c2 * s3 + s1 * s2 * c3;
  const qw = c1 * c2 * c3 - s1 * s2 * s3;

  return [qx, qy, qz, qw];
}

async function procesarPoses() {
  console.log("🚀 Procesando 215 poses desde public/poses...\n");

  let convertidas = 0;

  for (let i = 1; i <= 215; i++) {
    const num = String(i).padStart(3, '0');
    const archivoJson = `pose${num}.json`;
    const archivoVrma = `pose${num}.vrma`;

    const rutaJson = path.join(CARPETA_ORIGEN, archivoJson);
    const rutaVrma = path.join(CARPETA_DESTINO, archivoVrma);

    if (fs.existsSync(rutaJson)) {
      try {
        const rawData = fs.readFileSync(rutaJson, 'utf-8');
        const poseData = JSON.parse(rawData);

        // Mapear los offsets a rotaciones procesadas
        const offsets = poseData.boneOffsets || {};
        const poseProcesada = {
          name: archivoVrma,
          bones: {}
        };

        for (const [boneName, transform] of Object.entries(offsets)) {
          const quat = eulerToQuaternion(transform.rx, transform.ry, transform.rz);
          poseProcesada.bones[boneName] = {
            quaternion: quat,
            position: [transform.px || 0, transform.py || 0, transform.pz || 0]
          };
        }

        fs.writeFileSync(rutaVrma, JSON.stringify(poseProcesada, null, 2));
        console.log(`✅ [${i}/215] Convertida: ${archivoJson} -> vrma/${archivoVrma}`);
        convertidas++;
      } catch (err) {
        console.error(`❌ Error en ${archivoJson}:`, err.message);
      }
    }
  }

  console.log(`\n🎉 ¡Finalizado! Se crearon ${convertidas} archivos en public/poses/vrma/`);
}

procesarPoses();
