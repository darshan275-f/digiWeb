import os
import sys
import pandas as pd

xlsx_dir = "xlsx"
if not os.path.exists(xlsx_dir):
    os.makedirs(xlsx_dir)

# Arguments
merged_file = sys.argv[1]              # merged TXT file
base_number = int(sys.argv[2]) if len(sys.argv) > 2 else 1

# Read merged TXT
with open(merged_file, "r", encoding="utf-8", errors="ignore") as f:
    lines = [line.strip() for line in f if line.strip()]

# Split into chunks of 500
chunk_size = 500
chunks = [lines[i:i+chunk_size] for i in range(0, len(lines), chunk_size)]

file_counter = base_number
for idx, chunk in enumerate(chunks):
    df = pd.DataFrame(chunk, columns=["productId"])
    out_file = os.path.join(xlsx_dir, f"{file_counter}.xlsx")
    df.to_excel(out_file, index=False)
    print(f"Created {out_file} (part {idx+1})")
    file_counter += 1
