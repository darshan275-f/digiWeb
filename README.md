# DigiKey Data Processing Pipeline

A complete web-based application for processing DigiKey API data with file conversion and SQL generation capabilities.

## Features

- **Web Interface**: Simple HTML interface for entering client credentials and managing files
- **Client Credentials Management**: Enter up to any number of DigiKey client ID/secret pairs
- **Text to Excel Conversion**: Upload multiple text files and convert them to Excel format (500 rows per file)
- **API Data Fetching**: Automatically fetch product data from DigiKey API using your credentials and divide the data into .csv and not_fund.txt
- **SQL Generation**: Generate SQL INSERT statements from the processed CSV data

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

or
```bash
node server.js
```


3. Open your browser and go to: `http://localhost:3000`

## How It Works

### Step 1: Client Credentials
Enter your DigiKey client IDs and client secrets in the web interface.You can click on the Add API Key Button to add more pairs and then click on the LoadKeys and Save Keys button

### Step 2: File Upload
Upload your text files (.txt) that contain product data. Specify the starting file number (default: 1).

### Step 3: Processing Pipeline
Choose from:
- **Complete Process**: Runs all steps automatically
- **Upload & Convert (TXT → XLSX)**: Converts the text files into .xlsx file

## File Structure

```
├── index.html          # Web interface
├── server.js           # Express server handling all API endpoints
├── index.js            # DigiKey API integration
├── excet_convertor.py  # Text to Excel conversion
├── generate_sql.py     # SQL generation from CSV
├── package.json        # Node.js dependencies
└── uploads/            # Temporary file uploads
└── csv/               # Generated CSV and error files
└── sql/
```

## API Endpoints

-`POST /saveKeys` - Save API keys to keys.json
- `POST /uploadTxt` - Upload and merge TXT files, then convert to Excel
- `POST /runPipeline` - Run complete pipeline (API fetching + SQL generation)
- `GET /loadKeys` - Load saved API keys from keys.json 
- `GET /listSql` - List generated SQL files in sql/directory
- `GET /listCsv` - List generated CSV files in csv/directory
- `GET /listXlsx` - List generated XLSX files in xlsx/directory

## Output Files

- `GET /downloadSql/:filename` - Download specific SQL file
- `GET /downloadCsv/:filename` - Download specific CSV file
- `GET /downloadXlsx/:filename` - Download specific XLSX file

NOTE: These are also stored locally in your specific folders


## Requirements

- Node.js
- Python 3
- pandas library: `pip install pandas openpyxl`
- DigiKey API credentials

## Usage Tips

1. **File Numbering**: Use different starting file numbers to avoid overwriting existing files
2. **Credentials**: Make sure all client credential pairs are valid DigiKey API credentials
3. **File Formats**: Only .txt files are accepted for upload
4. **Processing Time**: API fetching can take several minutes depending on the number of products

## Error Handling

The application includes comprehensive error handling:
- Invalid file formats are rejected
- Missing credentials are validated
- API errors are logged to `_not_found.txt` files
- Processing status is shown in real-time

## Security

- Client secrets are handled securely
- File uploads are validated
- Temporary files are cleaned up after processing