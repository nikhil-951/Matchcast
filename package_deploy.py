import os
import zipfile

ROOT_DIR = r"d:\AI Agents\matchcast-ai"
ZIP_PATH = os.path.join(ROOT_DIR, "deploy.zip")

print("Packaging deploy.zip...")

with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zipf:
    # 1. Add requirements.txt and startup.sh
    for top_file in ["requirements.txt", "startup.sh"]:
        fp = os.path.join(ROOT_DIR, top_file)
        if os.path.exists(fp):
            zipf.write(fp, arcname=top_file)
            print(f"Added {top_file}")

    # 2. Add backend (exclude __pycache__ and test cache)
    backend_dir = os.path.join(ROOT_DIR, "backend")
    for root, dirs, files in os.walk(backend_dir):
        if "__pycache__" in root or ".pytest_cache" in root:
            continue
        for f in files:
            if f.endswith(".pyc"):
                continue
            abs_p = os.path.join(root, f)
            rel_p = os.path.relpath(abs_p, ROOT_DIR).replace("\\", "/")
            zipf.write(abs_p, arcname=rel_p)

    # 3. Add data
    data_dir = os.path.join(ROOT_DIR, "data")
    for root, dirs, files in os.walk(data_dir):
        if "__pycache__" in root:
            continue
        for f in files:
            abs_p = os.path.join(root, f)
            rel_p = os.path.relpath(abs_p, ROOT_DIR).replace("\\", "/")
            zipf.write(abs_p, arcname=rel_p)

    # 4. Add frontend/dist
    dist_dir = os.path.join(ROOT_DIR, "frontend", "dist")
    for root, dirs, files in os.walk(dist_dir):
        for f in files:
            abs_p = os.path.join(root, f)
            rel_p = os.path.relpath(abs_p, ROOT_DIR).replace("\\", "/")
            zipf.write(abs_p, arcname=rel_p)

print(f"deploy.zip created successfully: {os.path.getsize(ZIP_PATH)} bytes")
