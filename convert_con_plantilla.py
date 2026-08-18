import os
import json
import struct
import glob
import math

TARGET_DIR = './public/poses/vrma'

# Tu archivo ORO con tres ceros (INTOCABLE, solo se usa como lectura)
TEMPLATE_PATH = os.path.join(TARGET_DIR, 'pose0002.vrma')

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

# 1. Cargar la plantilla intocable pose0002.vrma
if not os.path.exists(TEMPLATE_PATH):
    print(f"❌ Error: No se encontró la plantilla en '{TEMPLATE_PATH}'.")
    print("Asegúrate de haber ejecutado el comando cp para traer pose0002.vrma.")
    exit(1)

with open(TEMPLATE_PATH, 'rb') as f:
    tmpl_bytes = f.read()

# Desempaquetar cabecera y trozos JSON y BIN de pose0002.vrma
magic, ver, total_len = struct.unpack('<4sII', tmpl_bytes[:12])
json_len, json_type = struct.unpack('<I4s', tmpl_bytes[12:20])
tmpl_json = json.loads(tmpl_bytes[20:20+json_len].decode('utf-8'))

bin_hdr_offset = 20 + json_len
bin_len, bin_type = struct.unpack('<I4s', tmpl_bytes[bin_hdr_offset:bin_hdr_offset+8])
tmpl_bin = bytearray(tmpl_bytes[bin_hdr_offset+8 : bin_hdr_offset+8+bin_len])

# Mapear nodos de la plantilla
nodes_map = {}
for idx, node in enumerate(tmpl_json.get('nodes', [])):
    if 'name' in node:
        nodes_map[node['name'].lower()] = idx

# Mapear canales de animación
channels_map = {}
if 'animations' in tmpl_json and len(tmpl_json['animations']) > 0:
    for channel in tmpl_json['animations'][0]['channels']:
        node_idx = channel['target']['node']
        path_type = channel['target']['path']
        sampler_idx = channel['sampler']
        output_acc_idx = tmpl_json['animations'][0]['samplers'][sampler_idx]['output']
        accessor = tmpl_json['accessors'][output_acc_idx]
        buffer_view_idx = accessor['bufferView']
        buffer_view = tmpl_json['bufferViews'][buffer_view_idx]
        channels_map[(node_idx, path_type)] = (buffer_view['byteOffset'], buffer_view['byteLength'], accessor['count'])

# 2. Escanear todos los archivos en la carpeta
all_files = glob.glob(os.path.join(TARGET_DIR, "*.vrma")) + glob.glob(os.path.join(TARGET_DIR, "*.json"))
all_files = [f for f in all_files if not f.endswith('index.json')]

print(f"📦 Usando 'pose0002.vrma' como molde perfecto para procesar {len(all_files)-1} poses...")

converted = 0

for file_path in all_files:
    filename = os.path.basename(file_path)
    
    # PROTEGER pose0002.vrma: ¡No modificarlo bajo ninguna circunstancia!
    if filename == "pose0002.vrma":
        continue

    base_name = os.path.splitext(filename)[0]
    out_filename = f"{base_name}.vrma"
    out_path = os.path.join(TARGET_DIR, out_filename)

    rotations_found = {}

    try:
        with open(file_path, 'rb') as f:
            content = f.read()

        parsed_data = None

        if content.startswith(b'glTF'):
            try:
                j_len, _ = struct.unpack('<I4s', content[12:20])
                parsed_data = json.loads(content[20:20+j_len].decode('utf-8', errors='ignore'))
            except Exception:
                pass
        else:
            try:
                parsed_data = json.loads(content.decode('utf-8', errors='ignore'))
            except Exception:
                pass

        if parsed_data:
            # Extraer rotaciones si vienen de un árbol de nodos
            if 'nodes' in parsed_data and isinstance(parsed_data['nodes'], list):
                for node in parsed_data['nodes']:
                    if isinstance(node, dict) and 'name' in node:
                        bname = node['name'].lower().replace("_", "").replace("-", "")
                        if 'rotation' in node and isinstance(node['rotation'], list) and len(node['rotation']) == 4:
                            rotations_found[bname] = node['rotation']

            # Extraer rotaciones si vienen de un diccionario de huesos
            bones_dict = parsed_data.get('bones', parsed_data.get('pose', parsed_data))
            if isinstance(bones_dict, dict):
                for raw_bone, transform in bones_dict.items():
                    if isinstance(transform, dict):
                        bname = raw_bone.lower().replace("_", "").replace("-", "")
                        if 'quaternion' in transform and isinstance(transform['quaternion'], list) and len(transform['quaternion']) == 4:
                            rotations_found[bname] = transform['quaternion']
                        elif any(k in transform for k in ['rx', 'ry', 'rz']):
                            rx = float(transform.get('rx', 0.0))
                            ry = float(transform.get('ry', 0.0))
                            rz = float(transform.get('rz', 0.0))
                            rotations_found[bname] = euler_to_quaternion(rx, ry, rz)

        # Inyectar datos en una copia fresca de la plantilla pose0002.vrma
        new_json = json.loads(json.dumps(tmpl_json))
        new_bin = bytearray(tmpl_bin)

        if rotations_found:
            for bname, q in rotations_found.items():
                if bname in nodes_map:
                    node_idx = nodes_map[bname]
                    new_json['nodes'][node_idx]['rotation'] = q

                    if (node_idx, 'rotation') in channels_map:
                        byte_offset, byte_len, count = channels_map[(node_idx, 'rotation')]
                        quat_bytes = struct.pack('<4f', q[0], q[1], q[2], q[3])
                        full_track_bytes = quat_bytes * count
                        new_bin[byte_offset : byte_offset + byte_len] = full_track_bytes[:byte_len]

        # Empaquetar el nuevo GLB binario (.vrma)
        json_bytes = json.dumps(new_json, separators=(',', ':')).encode('utf-8')
        json_padding = (4 - (len(json_bytes) % 4)) % 4
        json_bytes += b' ' * json_padding

        bin_padding = (4 - (len(new_bin) % 4)) % 4
        new_bin += b'\x00' * bin_padding

        new_total_len = 12 + 8 + len(json_bytes) + 8 + len(new_bin)

        glb_hdr = struct.pack('<4sII', b'glTF', 2, new_total_len)
        chunk0_hdr = struct.pack('<I4s', len(json_bytes), b'JSON')
        chunk1_hdr = struct.pack('<I4s', len(new_bin), b'BIN\x00')

        final_vrma = glb_hdr + chunk0_hdr + json_bytes + chunk1_hdr + new_bin

        with open(out_path, 'wb') as f:
            f.write(final_vrma)

        converted += 1

    except Exception as e:
        print(f"❌ Error procesando {filename}: {e}")

# Re-generar index.json incluyendo todas las poses .vrma
index_path = os.path.join(TARGET_DIR, "index.json")
all_vrmas = sorted(list(set([os.path.basename(f) for f in glob.glob(os.path.join(TARGET_DIR, "*.vrma"))])))
with open(index_path, 'w', encoding='utf-8') as f:
    json.dump(all_vrmas, f, indent=2)

print(f"\n🎉 ¡Proceso completado! Se convirtieron {converted} poses clonando la plantilla 'pose0002.vrma'.")
print(f"🔒 'pose0002.vrma' se mantuvo intacto.")
