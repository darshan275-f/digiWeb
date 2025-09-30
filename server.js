// server.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);
const app = express();
const port = 3000;

// multer upload setup
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.static('.'));

// Ensure directories exist
for (const d of ['uploads', 'csv', 'sql', 'xlsx']) {
  if (!fs.existsSync(d)) fs.mkdirSync(d);
}

// ------------------- Save / Load Keys -------------------
app.post('/saveKeys', (req, res) => {
  try {
    const keys = req.body.keys || [];
    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).send('No keys provided');
    }
    fs.writeFileSync('keys.json', JSON.stringify({ keys }, null, 2), 'utf-8');
    res.send('Saved keys to keys.json');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to save keys');
  }
});

app.get('/loadKeys', (req, res) => {
  try {
    if (!fs.existsSync('keys.json')) return res.status(404).send('Keys not found');
    const j = JSON.parse(fs.readFileSync('keys.json', 'utf-8'));
    res.json(j);
  } catch (err) {
    res.status(500).send('Error reading keys');
  }
});

// ------------------- Upload TXT + Convert -------------------
app.post('/uploadTxt', upload.array('txtFiles'), async (req, res) => {
  try {
    const baseFileNumber = parseInt(req.body.baseFileNumber) || 1;
    if (!req.files || req.files.length === 0) {
      return res.status(400).send('No files uploaded');
    }

    // Merge all TXT files into one
    const mergedPath = path.join('uploads', `merged_${baseFileNumber}.txt`);
    const writeStream = fs.createWriteStream(mergedPath, { flags: 'w' });

    for (const f of req.files) {
      const data = fs.readFileSync(f.path, 'utf-8');
      writeStream.write(data + '\n'); // add newline between files
      fs.unlinkSync(f.path); // remove original uploaded file
    }
    writeStream.end();

    // Call Python converter on merged TXT file
    const cmd = `python excet_convertor.py "${mergedPath}" ${baseFileNumber}`;
    const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 20 });
    if (stderr) console.error('converter stderr:', stderr);

    res.send(stdout || 'Merged TXT converted to Excel successfully.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error during merge/convert: ' + err.message);
  }
});


// ------------------- Full Pipeline -------------------
app.post('/runPipeline', async (req, res) => {
  try {
    const baseFileNumber = parseInt(req.body.baseFileNumber) || 1;

    // 2) Run fetcher (node index.js)
    const { stdout: fetchOut, stderr: fetchErr } = await execAsync(`node index.js ${baseFileNumber}`, { maxBuffer: 1024 * 1024 * 50 });
    if (fetchErr) console.error('fetcher stderr:', fetchErr);

    // 3) Generate SQL from CSVs
    const csvFiles = fs.readdirSync('csv').filter(f => f.endsWith('.csv'));
    const sqlResults = [];
    for (const csvFile of csvFiles) {
      const csvPath = path.join('csv', csvFile);
      const { stdout, stderr } = await execAsync(`python generate_sql.py "${csvPath}"`, { maxBuffer: 1024 * 1024 * 20 });
      if (stderr) console.error('generate_sql stderr:', stderr);
      sqlResults.push({ csvFile, output: stdout.trim() });
    }

    res.json({
      status: 'pipeline_finished',
      fetcherOutput: fetchOut ? fetchOut.trim() : '',
      sqlResults
    });
  } catch (err) {
    console.error('Pipeline error:', err);
    res.status(500).json({ error: err.message });
  }
});

// List generated SQL files
app.get('/listSql', (req, res) => {
  try {
    const dir = path.join(__dirname, 'sql');
    if (!fs.existsSync(dir)) {
      return res.json({ files: [] });
    }
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));
    res.json({ files });
  } catch (err) {
    console.error('Error listing SQL files:', err);
    res.status(500).json({ error: 'Failed to list SQL files' });
  }
});

// Download a specific SQL file
app.get('/downloadSql/:filename', (req, res) => {
  const file = path.join(__dirname, 'sql', req.params.filename);
  if (!fs.existsSync(file)) {
    return res.status(404).send('File not found');
  }
  res.download(file);
});



// CSV Files
app.get('/listCsv', (req, res) => {
  try {
    const dir = path.join(__dirname, 'csv');
    if (!fs.existsSync(dir)) return res.json({ files: [] });
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));
    res.json({ files });
  } catch (err) {
    console.error('Error listing CSV files:', err);
    res.status(500).json({ error: 'Failed to list CSV files' });
  }
});

app.get('/downloadCsv/:filename', (req, res) => {
  const file = path.join(__dirname, 'csv', req.params.filename);
  if (!fs.existsSync(file)) return res.status(404).send('File not found');
  res.download(file);
});

// XLSX Files
app.get('/listXlsx', (req, res) => {
  try {
    const dir = path.join(__dirname, 'xlsx');
    if (!fs.existsSync(dir)) return res.json({ files: [] });
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx'));
    res.json({ files });
  } catch (err) {
    console.error('Error listing XLSX files:', err);
    res.status(500).json({ error: 'Failed to list XLSX files' });
  }
});

app.get('/downloadXlsx/:filename', (req, res) => {
  const file = path.join(__dirname, 'xlsx', req.params.filename);
  if (!fs.existsSync(file)) return res.status(404).send('File not found');
  res.download(file);
});


app.listen(port, () => {
  console.log(`Server running: http://localhost:${port}`);
});
