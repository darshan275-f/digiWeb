# generate_sql.py
import csv
import sys
import os
import pandas as pd
from datetime import datetime

def escape_sql_string(value):
    if value is None or str(value).strip() == '':
        return 'NULL'
    s = str(value)
    s = s.replace("'", "''")
    return f"'{s}'"

def generate_sql_inserts(csv_file_path, max_rows_per_file=500):
    column_mapping = {
        'title': 'ManufacturerProductNumber',
        'category': 'Category',
        'price': 'UnitPrice',
        'description': 'ProductAttributes',
        'short_description': 'AdditionalInformation',
        'image_url': 'PhotoUrl',
        'post_extra_manufacturer': 'ExtraManufacturerName',
        'post_extra_description': 'ExtraDescription',
        'post_extra_detail_description': 'ExtraDetailedDescription',
        'post_extra_datasheet_url': 'ExtraDatasheetUrl'
    }
    skip_columns = {'product_id', 'product_url', 'post_extra_gpt_data'}

    if not os.path.exists('sql'):
        os.makedirs('sql', exist_ok=True)

    base_name = os.path.splitext(os.path.basename(csv_file_path))[0]
    df = pd.read_csv(csv_file_path)
    total_rows = len(df)
    if total_rows == 0:
        print(f"No rows in {csv_file_path}")
        return

    file_counter = 1
    for start in range(0, total_rows, max_rows_per_file):
        end = min(start + max_rows_per_file, total_rows)
        chunk = df.iloc[start:end]

        out_name = f"{base_name}_{file_counter}.sql"
        out_path = os.path.join('sql', out_name)

        with open(out_path, "w", encoding="utf-8") as sqlfile:
            sqlfile.write("-- Generated SQL INSERT statements\n")
            sqlfile.write(f"-- Source: {csv_file_path}\n")
            sqlfile.write(f"-- Generated on: {datetime.utcnow().isoformat()}Z\n\n")

            for _, row in chunk.iterrows():
                cols = []
                vals = []
                for col, val in row.items():
                    if col in skip_columns:
                        continue
                    cols.append(column_mapping.get(col, col))
                    vals.append(escape_sql_string(val))
                insert_stmt = f"INSERT INTO parts_table ({', '.join(cols)}) VALUES ({', '.join(vals)});\n"
                sqlfile.write(insert_stmt)

        print(f"Saved {out_path} rows {start+1}-{end}")
        file_counter += 1

def main():
    if len(sys.argv) != 2:
        print("Usage: python generate_sql.py <csv_file_path>")
        sys.exit(1)
    csv_file = sys.argv[1]
    if not os.path.exists(csv_file):
        print(f"File '{csv_file}' not found")
        sys.exit(1)
    generate_sql_inserts(csv_file)

if __name__ == "__main__":
    main()
