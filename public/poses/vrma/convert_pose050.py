import json
import struct
import os
import math

TEMPLATE = 'pose0002.vrma'
INPUT_JSON = 'pose050.json'
OUTPUT_VRMA = 'pose050.vrma'
DOWNLOAD_OUT = '/sdcard/Download/pose050.vrma'

def euler_to_quaternion(rx_deg, ry_deg, rz_deg):
    rx = math.radians(rx_deg) / 2.0
    ry = math.radians(ry_deg) / 2.0
    rz = math.radians(rz_deg) / 2.0
    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)
    return [sx*cy*cz - cx*sy*sz, cx*sy*cz + sx*cy*sz, cx*cy*sz - sx*sy*cz, cx*cy*cz + sx*sy*sz]

if not os.path.exists(TEMPLATE):
    print(f"❌ No se encontró la plantilla '{TEMPLATE}'.")
    exit(1)

if not os.path.exists(INPUT_JSON):
    print(f"❌ No se encontró el archivo '{INPUT_JSON}'.")
    exit(1)

# 1. Cargar la plantilla exacta (pose0002.vrma)
with open(TEMPLATE, 'rb') as f:
    tmpl_bytes = f.read()

json_len = struct.unpack('<I', tmpl_bytes[12:16])[0]
tmpl_json = json.loads(tmpl_bytes[20:20+json_len].decode('utf-8'))

# Mapear nodos por nombre
nodes_list = tmpl_json.get('nodes', [])
node_map = {n['name'].lower().replace("_","").replace("-",""): i for i, n in enumerate(nodes_list) if 'name' in n}

# 2. Cargar datos de rotación desde pose050.json
with open(INPUT_JSON, 'r', encoding='utf-8', errors='ignore') as f:
    pose_data = json.load(f)

rotations_found = {}

def parse_pose(data):
    if isinstance(data, dict):
        if 'nodes' in data and isinstance(data['nodes'], list):
            for n in data['nodes']:
                if isinstance(n, dict) and 'name' in n and 'rotation' in n:
                    clean_b = n['name'].lower().replace("_","").replace("-","")
                    rotations_found[clean_b] = n['rotation']

        bones_dict = data.get('bones', data.get('pose', data))
        if isinstance(bones_dict, dict):
            for raw_b, transform in bones_dict.items():
                if isinstance(transform, dict):
                    clean_b = raw_b.lower().replace("_","").replace("-","")
                    if 'quaternion' in transform and isinstance(transform['quaternion'], list):
                        rotations_found[clean_b] = transform['quaternion']
                    elif 'rotation' in transform and isinstance(transform['rotation'], list):
                        rotations_found[clean_b] = transform['rotation']
                    elif any(k in transform for k in ['rx', 'ry', 'rz', 'x', 'y', 'z']):
                        rx = float(transform.get('rx', transform.get('x', 0.0)))
                        ry = float(transform.get('ry', transform.get('y', 0.0)))
                        rz = float(transform.get('rz', transform.get('z', 0.0)))
                        rotations_found[clean_b] = euler_to_quaternion(rx, ry, rz)

parse_pose(pose_data)

print(f"🔍 Rotaciones halladas en {INPUT_JSON}: {len(rotations_found)}")

# 3. Clonar la estructura completa de pose0002.vrma
new_nodes = json.loads(json.dumps(nodes_list))
applied = 0

for bname, q in rotations_found.items():
    if bname in node_map:
        idx = node_map[bname]
        new_nodes[idx]['rotation'] = q
        applied += 1

print(f"✅ Rotaciones aplicadas a los nodos de la plantilla: {applied}")

# 4. Construir Buffer Binario respetando accesores y la extensión VRMC_vrm_animation completa
bin_buffer = bytearray()
time_bytes = struct.pack('<2f', 0.0, 1.0)
bin_buffer.extend(time_bytes)

accessors = [{"bufferView": 0, "byteOffset": 0, "componentType": 5126, "count": 2, "type": "SCALAR", "min": [0.0], "max": [1.0]}]
buffer_views = [{"buffer": 0, "byteLength": len(time_bytes), "byteOffset": 0}]
channels, samplers = [], []

for idx, node in enumerate(new_nodes):
    q = node.get('rotation', [0.0, 0.0, 0.0, 1.0])
    q_bytes = struct.pack('<8f', q[0], q[1], q[2], q[3], q[0], q[1], q[2], q[3])
    q_offset = len(bin_buffer)
    bin_buffer.extend(q_bytes)

    acc_idx = len(accessors)
    bv_idx = len(buffer_views)
    accessors.append({"bufferView": bv_idx, "byteOffset": 0, "componentType": 5126, "count": 2, "type": "VEC4"})
    buffer_views.append({"buffer": 0, "byteLength": len(q_bytes), "byteOffset": q_offset})
    samplers.append({"input": 0, "interpolation": "LINEAR", "output": acc_idx})
    channels.append({"sampler": len(samplers)-1, "target": {"node": idx, "path": "rotation"}})

# Mantener vivas las extensiones originales (incluyendo VRMC_vrm_animation con expressions)
new_gltf = {
    "asset": tmpl_json.get("asset", {"generator": "VRMA Converter", "version": "2.0"}),
    "scenes": tmpl_json.get("scenes", [{"nodes": [0]}]),
    "nodes": new_nodes,
    "animations": [{"channels": channels, "samplers": samplers}],
    "accessors": accessors,
    "bufferViews": buffer_views,
    "buffers": [{"byteLength": len(bin_buffer)}],
    "extensionsUsed": tmpl_json.get("extensionsUsed", ["VRMC_vrm_animation"]),
    "extensions": tmpl_json.get("extensions", {})
}

json_bytes = json.dumps(new_gltf, separators=(',', ':')).encode('utf-8')
json_bytes += b' ' * ((4 - (len(json_bytes) % 4)) % 4)
bin_buffer += b'\x00' * ((4 - (len(bin_buffer) % 4)) % 4)

total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_buffer)
final_bytes = struct.pack('<4sII', b'glTF', 2, total_len) + struct.pack('<I4s', len(json_bytes), b'JSON') + json_bytes + struct.pack('<I4s', len(bin_buffer), b'BIN\x00') + bin_buffer

with open(OUTPUT_VRMA, 'wb') as f:
    f.write(final_bytes)

os.makedirs('/sdcard/Download', exist_ok=True)
with open(DOWNLOAD_OUT, 'wb') as f:
    f.write(final_bytes)

print(f"\n🎉 ¡Archivo generado con éxito!")
print(f"📄 Local: {OUTPUT_VRMA}")
print(f"📁 Copia lista para probar en visor: {DOWNLOAD_OUT}")
