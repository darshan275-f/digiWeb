// index.js
// Usage: node index.js [baseFileNumber]
// Reads keys from keys.json and rotates them (one key per Excel file, round-robin).

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xlsx = require('xlsx');

const keysFile = 'keys.json';
if (!fs.existsSync(keysFile)) {
  console.error('keys.json not found. Save keys via the UI.');
  process.exit(1);
}
const keysObj = JSON.parse(fs.readFileSync(keysFile, 'utf-8'));
const keys = keysObj.keys || [];
if (!keys.length) {
  console.error('No keys found in keys.json');
  process.exit(1);
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const baseFileNumber = parseInt(process.argv[2]) || 1;
if (!fs.existsSync('csv')) fs.mkdirSync('csv');

const xlsxDir = 'xlsx';

function fillArrayFromExcel(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const workbook = xlsx.readFile(filePath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  return rows.flat().map(v => String(v || '').trim()).filter(Boolean);
}

async function fetchToken(client_id, client_secret) {
  const params = new URLSearchParams();
  params.append('client_id', client_id);
  params.append('client_secret', client_secret);
  params.append('grant_type', 'client_credentials');

  const resp = await axios.post('https://api.digikey.com/v1/oauth2/token', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 30000
  });
  return resp.data.access_token;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

async function fetchProductAndAppend(token, clientIdForHeader, productId, csvPath) {
  try {
    const url = `https://api.digikey.com/products/v4/search/${encodeURIComponent(productId)}/productdetails`;
    const resp = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-DIGIKEY-Client-Id': clientIdForHeader
      },
      timeout: 30000
    });

    const pd = resp.data;
    const categoryArray = (function extract(cat, res=[]) {
      if (!cat) return res;
      res.push({ Name: cat.Name || '', id: cat.ParentId || 0 });
      if (Array.isArray(cat.ChildCategories)) {
        cat.ChildCategories.forEach(c => extract(c, res));
      }
      return res;
    })(pd.Product?.Category || []);
    categoryArray.sort((a,b)=>a.id-b.id);
    const categoryString = categoryArray.map(x=>x.Name).filter(Boolean).join(' > ');

    const parameterString = (pd.Product?.Parameters || [])
      .map(p => `<tr><th>${p.ParameterText}</th><td>${p.ValueText}</td></tr>`).join('');
    const classificationString = Object.entries(pd.Product?.Classifications || {})
      .map(([k,v])=>`<tr><th>${k}</th><td>${v}</td></tr>`).join('');

    const headers = [
      'ManufacturerProductNumber','ExtraManufacturerName','ExtraDescription','ExtraDetailedDescription',
      'ExtraDatasheetUrl','UnitPrice','PhotoUrl','Category','ProductAttributes','AdditionalInformation'
    ];

    const dataRow = [
      pd.Product?.ManufacturerProductNumber || '',
      pd.Product?.Manufacturer?.Name || '',
      pd.Product?.Description?.ProductDescription || '',
      pd.Product?.Description?.DetailedDescription || '',
      pd.Product?.DatasheetUrl || '',
      pd.Product?.ProductVariations?.[0]?.StandardPricing?.[0]?.UnitPrice || '',
      pd.Product?.PhotoUrl || '',
      categoryString,
      parameterString,
      classificationString
    ];

    const exists = fs.existsSync(csvPath);
    const csvLine = dataRow.map(csvEscape).join(',') + '\n';
    if (!exists) {
      fs.appendFileSync(csvPath, headers.map(csvEscape).join(',') + '\n' + csvLine);
    } else {
      fs.appendFileSync(csvPath, csvLine);
    }

    console.log(`Appended ${productId} to ${csvPath}`);
    return true;
  } catch (err) {
    const notFoundPath = csvPath.replace(/\.csv$/, '_not_found.txt');
    const msg = `[${new Date().toISOString()}] ${productId} | ${err.response?.status || 'ERR'} | ${err.response?.data?.message || err.message}\n`;
    fs.appendFileSync(notFoundPath, msg);
    console.warn(`Failed ${productId}, written to ${notFoundPath}`);
    return false;
  }
}

async function processExcelFile(excelIndex, excelFilePath, key) {
  const baseNumber = baseFileNumber + excelIndex;
  console.log(`Processing ${excelFilePath} as baseFile ${baseNumber} using client_id=${key.client_id}`);
  const productIds = fillArrayFromExcel(excelFilePath);
  if (!productIds.length) {
    console.log(`No product IDs found in ${excelFilePath}`);
    return;
  }

  let token;
  try {
    token = await fetchToken(key.client_id, key.client_secret);
  } catch (err) {
    console.error('Skipping file due to token fetch failure:', excelFilePath);
    return;
  }

  const csvPath = path.join('csv', `${baseNumber}.csv`);
  for (const productId of productIds) {
    await fetchProductAndAppend(token, key.client_id, productId, csvPath);
     await sleep(50000); //50 seconds between requests to avoid rate limits
  }
}

async function main() {
  if (!fs.existsSync(xlsxDir)) {
    console.log('No xlsx directory found. Run converter first.');
    return;
  }

 const allExcels = fs.readdirSync(xlsxDir)
  .filter(f => f.endsWith('.xlsx'))
  .sort((a,b) => (parseInt(path.basename(a,'.xlsx'))||0) - (parseInt(path.basename(b,'.xlsx'))||0))
  .filter(f => {
    const num = parseInt(path.basename(f,'.xlsx')) || 0;
    return num >= baseFileNumber;
  });


  if (!allExcels.length) {
    console.log('No .xlsx files found in xlsx/. Run converter first.');
    return;
  }

  for (let i = 0; i < allExcels.length; i++) {
    const excelPath = path.join(xlsxDir, allExcels[i]);
    const key = keys[i % keys.length]; // round robin
    await processExcelFile(i, excelPath, key);
  }

  console.log('All Excel files processed.');
}

main().catch(err => {
  console.error('Fatal error:', err);
});
