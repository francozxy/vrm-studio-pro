import sys
import json
import struct

def inspect_file(filepath):
    print("=" * 50)
    print(f"🔍 INSPECCIONANDO: {filepath}")
    print("=" * 50)

    try:
        with open(filepath, 'rb') as f:
            content = f.read()

        if not content:
            print("❌ El archivo está VACÍO (0 bytes).")
            return

        is_binary = content.startswith(b'glTF')

        if is_binary:
            print("📦 Formato: BINARIO GLB / VRMA (.vrma)")
            magic, version, total_len = struct.unpack('<4sII', content[:12])
            json_len, _ = struct.unpack('<I4s', content[12:20])
            json_raw = content[20:20+json_len].decode('utf-8', errors='ignore')
            data = json.loads(json_raw)
        else:
            print("📄 Formato: TEXTO PLANO JSON (.json / .vrma texto)")
            data = json.loads(content.decode('utf-8', errors='ignore'))

        if not isinstance(data, dict):
            print(f"⚠️ El contenido raíz no es un objeto JSON (es una lista de {len(data)} elementos).")
            return

        print(f"\n🔑 Llaves en la raíz del objeto:")
        print(f"   {list(data.keys())}")

        # 1. Extensión VRMC_vrm_animation
        vrma_ext = data.get('extensions', {}).get('VRMC_vrm_animation', {})
        if vrma_ext:
            print("\n✅ Extensión VRMC_vrm_animation encontrada:")
            human_bones = vrma_ext.get('humanoid', {}).get('humanBones', {})
            print(f"   - HumanBones mapeados: {len(human_bones)}")
            if human_bones:
                sample_vrm = dict(list(human_bones.items())[:3])
                print(f"   - Muestra: {sample_vrm}")

        # 2. Nodos
        nodes = data.get('nodes', [])
        if nodes:
            print(f"\n🦴 Nodos ('nodes') encontrados: {len(nodes)}")
            nodes_with_rot = [n for n in nodes if isinstance(n, dict) and 'rotation' in n]
            print(f"   - Nodos con 'rotation': {len(nodes_with_rot)}")
            if nodes_with_rot:
                print(f"   - Ejemplo nodo 0 con rotación: {nodes_with_rot[0]}")

        # 3. Diccionario de Huesos (bones / pose)
        bones_dict = data.get('bones', data.get('pose', None))
        if bones_dict and isinstance(bones_dict, dict):
            print(f"\n🦴 Diccionario de huesos 'bones/pose' ({len(bones_dict)} elementos):")
            sample_bones = dict(list(bones_dict.items())[:3])
            print(f"{json.dumps(sample_bones, indent=2)}")
        elif not nodes and not vrma_ext:
            # Imprimir primeras 3 llaves por si los huesos estaban en la raíz
            print("\n🦴 Muestra de llaves del objeto raíz (posibles huesos directo en raíz):")
            sample_root = dict(list(data.items())[:3])
            print(f"{json.dumps(sample_root, indent=2)}")

        # 4. Animaciones
        anims = data.get('animations', [])
        if anims:
            print(f"\n🎬 Animaciones encontradas: {len(anims)}")
            channels = anims[0].get('channels', []) if len(anims) > 0 else []
            print(f"   - Canales de animación (channels): {len(channels)}")

    except Exception as e:
        print(f"❌ Error al analizar el archivo: {e}")

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'pose050.json'
    inspect_file(target)
