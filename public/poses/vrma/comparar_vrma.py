import sys, os, struct, json

def inspect(path):
    if not os.path.exists(path): return {"error": f"No existe {path}"}
    with open(path, "rb") as f: data = f.read()
    if not data.startswith(b'glTF'): return {"error": "No es GLB/VRMA válido"}
    try:
        j_len = struct.unpack('<I', data[12:16])[0]
        gltf = json.loads(data[20:20+j_len].decode('utf-8', errors='ignore'))
        vrm_ext = gltf.get('extensions', {}).get('VRMC_vrm_animation', {})
        h_bones = vrm_ext.get('humanoid', {}).get('humanBones', {})
        nodes = gltf.get('nodes', [])
        anims = gltf.get('animations', [])
        channels = anims[0].get('channels', []) if anims else []
        return {
            "name": os.path.basename(path)[:22],
            "size": len(data),
            "nodes": len(nodes),
            "vrm_bones": len(h_bones),
            "channels": len(channels),
            "spec": vrm_ext.get("specVersion", "Sin spec")
        }
    except Exception as e: return {"error": str(e)}

if len(sys.argv) >= 3:
    i1, i2 = inspect(sys.argv[1]), inspect(sys.argv[2])
    print("="*60)
    print(f"{'PROPIEDAD':<20} | {i1.get('name','-'):<18} | {i2.get('name','-'):<18}")
    print("-" * 60)
    for k in ["size", "nodes", "vrm_bones", "channels", "spec"]:
        print(f"{k:<20} | {str(i1.get(k,'-')):<18} | {str(i2.get(k,'-')):<18}")
    print("="*60)
