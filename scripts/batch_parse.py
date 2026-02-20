import os
import subprocess

# Map PDF filenames to output JSON filenames
pdf_mapping = [
    # 2024
    ("Pending_MDL_Dockets_By_District-February-1-2024.pdf", "2024-02-01.json"),
    ("Pending_MDL_Dockets_By_District-March-1-2024.pdf", "2024-03-01.json"),
    ("Pending_MDL_Dockets_By_District-April-1-2024.pdf", "2024-04-01.json"),
    ("Pending_MDL_Dockets_By_District-May-1-2024.pdf", "2024-05-01.json"),
    ("Pending_MDL_Dockets_By_District-June-3-2024.pdf", "2024-06-03.json"),
    ("Pending_MDL_Dockets_By_District-July-1-2024.pdf", "2024-07-01.json"),
    ("Pending_MDL_Dockets_By_District-August-1-2024.pdf", "2024-08-01.json"),
    ("Pending_MDL_Dockets_By_District-September-3-2024.pdf", "2024-09-03.json"),
    ("Pending_MDL_Dockets_By_District-October-1-2024.pdf", "2024-10-01.json"),
    ("Pending_MDL_Dockets_By_District-November-1-2024.pdf", "2024-11-01.json"),
    ("Pending_MDL_Dockets_By_District-December-2-2024.pdf", "2024-12-02.json"),
    # 2025
    ("Pending_MDL_Dockets_By_District-January-2-2025.pdf", "2025-01-02.json"),
    ("Pending_MDL_Dockets_By_District-February-3-2025.pdf", "2025-02-03.json"),
    ("Pending_MDL_Dockets_By_District-March-3-2025.pdf", "2025-03-03.json"),
    ("Pending_MDL_Dockets_By_District-April-1-2025.pdf", "2025-04-01.json"),
    ("Pending_MDL_Dockets_By_District-May-1-2025.pdf", "2025-05-01.json"),
    ("Pending_MDL_Dockets_By_District-June-2-2025.pdf", "2025-06-02.json"),
]

pdf_dir = "data/pdfs"
output_dir = "data/mdl"

for pdf_file, json_file in pdf_mapping:
    pdf_path = os.path.join(pdf_dir, pdf_file)
    json_path = os.path.join(output_dir, json_file)
    
    if not os.path.exists(pdf_path):
        print(f"WARNING: {pdf_file} not found, skipping")
        continue
    
    if os.path.exists(json_path):
        print(f"SKIP: {json_file} already exists")
        continue
    
    print(f"Parsing {pdf_file} → {json_file}")
    result = subprocess.run(
        ["python", "scripts/parse_mdls.py", pdf_path, json_path],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print(f"  ✓ {result.stdout.strip()}")
    else:
        print(f"  ✗ ERROR: {result.stderr}")

print("\nBatch parsing complete!")
