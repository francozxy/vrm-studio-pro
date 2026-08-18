import struct
import json
import os

FILE = 'pose050.vrma'

if not os.path.exists(FILE):
    print(f"❌ No existe '{FILE}' en la carpeta actual.")
    exit(1)

with open(FILE, 'rb') as f:
    data = f.read()

print("=" * 65)
print(f"🔎 AUDITORÍA Y ESCANEO COMPLETO DE: {FILE}")
print("=" * 65)

# 1. Cabecera GLB
magic, version, total_len = struct.unpack('<4sII', data[:12])
json_len, json_type = struct.unpack('<I4s', data[12:20])

print(f"📦 Cabecera GLB:")
print(f"  - Magic: {magic.decode()}")
print(f"  - Versión GLB: {version}")
print(f"  - Tamaño total: {total_len} bytes")
print(f"  - Tamaño JSON: {json_len} bytes")

# Parsear JSON
gltf = json.loads(data[20:20+json_len].decode('utf-8', errors='ignore'))

# 2. Extensiones
exts = gltf.get('extensions', {})
print(f"\n🧩 Extensiones Usadas: {gltf.get('extensionsUsed', [])}")
print(f"🧩 Claves en 'extensions': {list(exts.keys())}")

vrm_anim = exts.get('VRMC_vrm_animation', {})
if vrm_anim:
    print("\n--- 📄 EXTENSIÓN VRMC_vrm_animation ---")
    print(json.dumps(vrm_anim, indent=2))
else:
    print("❌ NO tiene 'VRMC_vrm_animation'")

# 3. Nodos
nodes = gltf.get('nodes', [])
print(f"\n🦴 Nodos Totales: {len(nodes)}")
print("--- Muestra de Nodos (primeros 5) ---")
print(json.dumps(nodes[:5], indent=2))

# 4. Animaciones, Canales y Samplers
anims = gltf.get('animations', [])
print(f"\n🎬 Animaciones ({len(anims)} bloque/s):")
if anims:
    channels = anims[0].get('channels', [])
    samplers = anims[0].get('samplers', [])
    print(f"  - Canales: {len(channels)}")
    print(f"  - Samplers: {len(samplers)}")
    print("--- Muestra de Canales (primeros 3) ---")
    print(json.dumps(channels[:3], indent=2))

# 5. Accessors y BufferViews
accessors = gltf.get('accessors', [])
buffer_views = gltf.get('bufferViews', [])
print(f"\n📊 Accessors: {len(accessors)} | BufferViews: {len(buffer_views)}")

print("=" * 65)
