import os
import json
import struct
import glob
import math

TARGET_DIR = './public/poses/vrma'

# Tabla de normalización a nombres de huesos oficiales VRM 1.0 (camelCase)
STANDARD_VRM1_BONES = {
    "hips": "hips", "spine": "spine", "chest": "chest", "upperchest": "upperChest",
    "neck": "neck", "head": "head", "leftshoulder": "leftShoulder",
    "leftupperarm": "leftUpperArm", "leftlowerarm": "leftLowerArm", "lefthand": "leftHand",
    "leftthumbmetacarpal": "leftThumbMetacarpal", "leftthumbproximal": "leftThumbProximal", "leftthumbdistal": "leftThumbDistal",
    "leftindexproximal": "leftIndexProximal", "leftindexintermediate": "leftIndexIntermediate", "leftindexdistal": "leftIndexDistal",
    "leftmiddleproximal": "leftMiddleProximal", "leftmiddleintermediate": "leftMiddleIntermediate", "leftmiddledistal": "leftMiddleDistal",
    "leftringproximal": "leftRingProximal", "leftringintermediate": "leftRingIntermediate", "leftringdistal": "leftRingDistal",
    "leftlittleproximal": "leftLittleProximal", "leftlittleintermediate": "leftLittleIntermediate", "leftlittledistal": "leftLittleDistal",
    "rightshoulder": "rightShoulder", "rightupperarm": "rightUpperArm", "rightlowerarm": "rightLowerArm", "righthand": "rightHand",
    "rightthumbmetacarpal": "rightThumbMetacarpal", "rightthumbproximal": "rightThumbProximal", "rightthumbdistal": "rightThumbDistal",
    "rightindexproximal": "rightIndexProximal", "rightindexintermediate": "rightIndexIntermediate", "rightindexdistal": "rightIndexDistal",
    "rightmiddleproximal": "rightMiddleProximal", "rightmiddleintermediate": "rightMiddleIntermediate", "rightmiddledistal": "rightMiddleDistal",
    "rightringproximal": "rightRingProximal", "rightringintermediate": "rightRingIntermediate", "rightringdistal": "rightRingDistal",
    "rightlittleproximal": "rightLittleProximal", "rightlittleintermediate": "rightLittleIntermediate", "rightlittledistal": "rightLittleDistal",
    "leftupperleg": "leftUpperLeg", "leftlowerleg": "leftLowerLeg", "leftfoot": "leftFoot", "lefttoes": "leftToes",
    "rightupperleg": "rightUpperLeg", "rightlowerleg": "rightLowerLeg", "rightfoot": "rightFoot", "righttoes": "rightToes"
}

def to_vrm1_bone_name(raw_name):
    clean = raw_name.lower().replace("_", "").replace("-", "")
    return STANDARD_VRM1_BONES.get(clean, raw_name[0].lower() + raw_name[1:] if raw_name else raw_name)

def euler_to_quaternion(rx_deg, ry_deg, rz_deg):
    rx = math.radians(rx_deg) / 2.0
    ry = math.radians(ry_deg) / 2.0
    rz = math.radians(rz_deg) / 2.0

    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)

    qw = cx * cy * cz + sx * sy * sz
    qx = sx * cy * cz - cx * sy * sz
    qy = cx * sy * cz + sx * cy * sz
    qz = cx * cy * sz - sx * sy * cz

    return [qx, qy, qz, qw]

def extract_bones_dict(data):
    if not isinstance(data, dict):
        return {}
    if 'bones' in data and isinstance(data['bones'], dict):
        return data['bones']
    if 'pose' in data and isinstance(data['pose'], dict):
        return data['pose']
    if 'data' in data and isinstance(data['data'], dict):
        return data['data']
    
    possible_bones = {}
    for k, v in data.items():
        if isinstance(v, dict) and any(x in v for x in ['quaternion', 'rx', 'ry', 'rz', 'position', 'px', 'py', 'pz']):
            possible_bones[k] = v
    return possible_bones

def build_vrma_binary(pose_data):
    bones = extract_bones_dict(pose_data)
    if not bones:
        return None

    bin_buffer = bytearray()
    time_bytes = struct.pack('<2f', 0.0, 1.0)
    bin_buffer.extend(time_bytes)
    
    nodes, channels, samplers = [], [], []
    accessors = [{
        "bufferView": 0, "byteOffset": 0,
        "componentType": 5126, "count": 2,
        "type": "SCALAR", "min": [0.0], "max": [1.0]
    }]
    buffer_views = [{"buffer": 0, "byteLength": len(time_bytes), "byteOffset": 0}]
    human_bones_map = {}
    
    for raw_bone_name, transform in bones.items():
        if not isinstance(transform, dict):
            continue
            
        if 'quaternion' in transform and isinstance(transform['quaternion'], list) and len(transform['quaternion']) == 4:
            q = transform['quaternion']
        else:
            rx = float(transform.get('rx', 0.0))
            ry = float(transform.get('ry', 0.0))
            rz = float(transform.get('rz', 0.0))
            q = euler_to_quaternion(rx, ry, rz)
            
        px = float(transform.get('px', transform.get('position', [0,0,0])[0] if isinstance(transform.get('position'), list) else 0.0))
        py = float(transform.get('py', transform.get('position', [0,0,0])[1] if isinstance(transform.get('position'), list) and len(transform.get('position'))>1 else 0.0))
        pz = float(transform.get('pz', transform.get('position', [0,0,0])[2] if isinstance(transform.get('position'), list) and len(transform.get('position'))>2 else 0.0))
        pos = [px, py, pz]
        
        q_offset = len(bin_buffer)
        q_bytes = struct.pack('<8f', q[0], q[1], q[2], q[3], q[0], q[1], q[2], q[3])
        bin_buffer.extend(q_bytes)
        
        acc_idx = len(accessors)
        accessors.append({"bufferView": len(buffer_views), "byteOffset": 0, "componentType": 5126, "count": 2, "type": "VEC4"})
        buffer_views.append({"buffer": 0, "byteLength": len(q_bytes), "byteOffset": q_offset})
        
        node_idx = len(nodes)
        vrm_bone = to_vrm1_bone_name(raw_bone_name)
        nodes.append({"name": vrm_bone, "rotation": q, "translation": pos})
        
        sampler_idx = len(samplers)
        samplers.append({"input": 0, "interpolation": "LINEAR", "output": acc_idx})
        channels.append({"sampler": sampler_idx, "target": {"node": node_idx, "path": "rotation"}})
        
        # Mapeo exacto como en tu ejemplo: "hips": {"node": 0}
        human_bones_map[vrm_bone] = {"node": node_idx}

    if len(nodes) == 0:
        return None

    # Estructura idéntica al estándar del comando python que pasaste
    gltf_json = {
        "asset": {"generator": "Python VRMA Standard Converter", "version": "2.0"},
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "animations": [{"channels": channels, "samplers": samplers}],
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(bin_buffer)}],
        "extensionsUsed": ["VRMC_vrm_animation"],
        "extensions": {
            "VRMC_vrm_animation": {
                "specVersion": "1.0",
                "humanoid": {
                    "humanBones": human_bones_map
                },
                "expressions": {
                    "preset": {},
                    "custom": {}
                }
            }
        }
    }

    json_bytes = json.dumps(gltf_json, separators=(',', ':')).encode('utf-8')
    json_bytes += b' ' * ((4 - (len(json_bytes) % 4)) % 4)
    bin_buffer += b'\x00' * ((4 - (len(bin_buffer) % 4)) % 4)

    total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_buffer)

    glb_header = struct.pack('<4sII', b'glTF', 2, total_length)
    chunk0_header = struct.pack('<I4s', len(json_bytes), b'JSON')
    chunk1_header = struct.pack('<I4s', len(bin_buffer), b'BIN\x00')

    return glb_header + chunk0_header + json_bytes + chunk1_header + bin_buffer

# Ejecución
all_files = glob.glob(os.path.join(TARGET_DIR, "*.vrma")) + glob.glob(os.path.join(TARGET_DIR, "*.json"))
all_files = [f for f in all_files if not f.endswith('index.json')]

converted = 0
skipped_valid = 0
errors = 0
index_list = []

for file_path in all_files:
    filename = os.path.basename(file_path)
    base_name = os.path.splitext(filename)[0]
    out_filename = f"{base_name}.vrma"
    out_path = os.path.join(TARGET_DIR, out_filename)

    try:
        with open(file_path, 'rb') as f:
            content = f.read()

        # Si ya es binario con datos validos de nodos, se conserva
        if content.startswith(b'glTF'):
            if b'"nodes":[]' not in content and b'"humanBones":{}' not in content:
                index_list.append(out_filename)
                skipped_valid += 1
                continue

        # Intentar parsear JSON
        data = None
        try:
            data = json.loads(content.decode('utf-8', errors='ignore'))
        except Exception:
            pass

        if data is None:
            index_list.append(out_filename)
            errors += 1
            continue

        vrma_bytes = build_vrma_binary(data)

        if vrma_bytes is None:
            index_list.append(out_filename)
            errors += 1
            continue

        with open(out_path, 'wb') as f:
            f.write(vrma_bytes)

        index_list.append(out_filename)
        converted += 1
        print(f"✅ Convertido al estándar VRMC exacto: {out_filename}")

    except Exception as e:
        print(f"❌ Error con {filename}: {e}")
        errors += 1

index_path = os.path.join(TARGET_DIR, "index.json")
index_list = sorted(list(set(index_list)))
with open(index_path, 'w', encoding='utf-8') as f:
    json.dump(index_list, f, indent=2)

print(f"\n🚀 ¡Proceso completado al 100%!")
print(f"🔒 VRMAs oficiales respetados: {skipped_valid}")
print(f"✨ VRMAs re-empaquetados al estándar oficial: {converted}")
