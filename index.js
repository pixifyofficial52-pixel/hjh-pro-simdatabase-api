const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============================================================
// ===== HJH-HACKER BRANDING =====
// ============================================================
const BRANDING = {
  developed_by: "HJ-HACKER",
  whatsapp_channel: "https://whatsapp.com/channel/0029VbAaNJ6C1FuB0mIAx93M",
  main_site: "https://hamza-jutt-7d6.pages.dev/",
  note: "🔥 Follow HJ-HACKER for more tools, apps & tech updates!",
  version: "2.0.0"
};

// ============================================================
// ===== API ENDPOINTS =====
// ============================================================

// PRIMARY SIM DB — aapka existing API (num= parameter)
const SIMDB_API = 'https://ftgm-simdb-api.vercel.app/api/sim?num=';

// FALLBACK — Truecaller
const TRUECALLER_API = 'https://faisal-ali-truecaller.ftgmhacks.workers.dev/';
const TRUECALLER_KEY = 'pak-digital.store';

// ============================================================
// ===== PRIVATE / BLOCKED NUMBERS =====
// ===== In numbers ka data kisi bhi source se return nahi hoga =====
// ============================================================
const BLOCKED_NUMBERS = [
  '923266571331',
  '923035481601'
];

// ============================================================
// ===== HELPER FUNCTIONS =====
// ============================================================

/**
 * Normalize number to 923XXXXXXXXX format (12 digits, international)
 */
function normalizeToIntl(number) {
  if (!number) return '';
  let n = number.toString().replace(/\D/g, '');
  
  if (n.length === 11 && n.startsWith('03')) {
    n = '92' + n.slice(1);
  } else if (n.length === 10 && n.startsWith('3')) {
    n = '92' + n;
  }
  
  return n;
}

/**
 * Normalize number to 03XXXXXXXXX format (local, for SIM DB)
 */
function normalizeToLocal(number) {
  const intl = normalizeToIntl(number);
  if (intl.length === 12 && intl.startsWith('92')) {
    return '0' + intl.slice(2);
  }
  return intl;
}

/**
 * Check if number is blocked (privacy)
 */
function isBlocked(number) {
  const intl = normalizeToIntl(number);
  return BLOCKED_NUMBERS.some(b => normalizeToIntl(b) === intl);
}

/**
 * Detect search type
 * Phone: 12 digits (923XXXXXXXXX)
 * CNIC: 13 digits
 */
function detectSearchType(query) {
  const clean = query.toString().replace(/\D/g, '');
  
  if (clean.length === 12 && clean.startsWith('92')) {
    return { type: 'phone', value: clean };
  }
  
  if (clean.length === 13) {
    return { type: 'cnic', value: clean };
  }
  
  return null;
}

// ============================================================
// ===== SIM DATABASE FETCH (ftgm-simdb-api) =====
// Response format: { status: "success", records: [...] }
// ============================================================
async function fetchFromSimDb(phoneNumber) {
  try {
    // ftgm-simdb-api needs local format (03XXXXXXXXX)
    const localFormat = normalizeToLocal(phoneNumber);
    const url = SIMDB_API + encodeURIComponent(localFormat);
    
    console.log('🔄 SIM DB:', url);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 20000,
      validateStatus: () => true
    });
    
    const data = response.data;
    console.log('📥 SIM DB status:', data?.status, '| records:', data?.count || (data?.records?.length || 0));
    
    // ===== ftgm-simdb-api STRUCTURE =====
    // { status: "success", records: [{ name, mobile, cnic, address, network }] }
    if (
      data &&
      (data.status === 'success' || data.status === true) &&
      Array.isArray(data.records) &&
      data.records.length > 0
    ) {
      const records = data.records.map(r => ({
        full_name: r.name || r.full_name || 'Not Available',
        phone: r.mobile || r.number || r.phone || 'Not Available',
        cnic: r.cnic || 'Not Available',
        address: r.address || 'Not Available',
        network: r.network || 'Not Available'
      }));
      
      return records;
    }
    
    // ===== Agar aapki koi nayi API { results: { data: { records } } } format use kare =====
    if (
      data &&
      (data.status === true || data.success === true) &&
      data.results &&
      data.results.data &&
      Array.isArray(data.results.data.records) &&
      data.results.data.records.length > 0
    ) {
      const records = data.results.data.records.map(r => ({
        full_name: r.full_name || r.name || 'Not Available',
        phone: r.phone || r.mobile || r.number || 'Not Available',
        cnic: r.cnic || 'Not Available',
        address: r.address || 'Not Available',
        network: r.network || 'Not Available'
      }));
      
      return records;
    }
    
    return null;
  } catch (err) {
    console.log('⚠️ SIM DB failed:', err.message);
    return null;
  }
}

// ============================================================
// ===== TRUECALLER FETCH (fallback) =====
// Response format: { status: "success", data: { name, sim, success } }
// ============================================================
async function fetchFromTruecaller(phoneNumber) {
  try {
    const intlFormat = normalizeToIntl(phoneNumber);
    const url = `${TRUECALLER_API}?key=${encodeURIComponent(TRUECALLER_KEY)}&number=${encodeURIComponent(intlFormat)}`;
    
    console.log('📞 Truecaller:', url);
    
    const response = await axios.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 20000,
      validateStatus: () => true
    });
    
    const data = response.data;
    console.log('📥 Truecaller raw:', JSON.stringify(data).slice(0, 300));
    
    // ===== Truecaller structure =====
    // { status: "success", data: { name, sim, success: true } }
    if (
      data &&
      data.status === 'success' &&
      data.data &&
      data.data.success === true
    ) {
      const tc = data.data;
      const callerName = (tc.name || '').trim();
      
      // Reject "Unknown" / empty names
      if (!callerName || /^(unknown|n\/a|not available)$/i.test(callerName)) {
        console.log('⚠️ Truecaller returned Unknown name');
        return null;
      }
      
      // Clean SIM info
      const simInfo = (tc.sim && !/unknown/i.test(tc.sim)) ? tc.sim : 'Not Available';
      
      return [{
        full_name: callerName,
        phone: intlFormat,
        cnic: 'Not Available',
        address: 'Not Available',
        network: simInfo
      }];
    }
    
    return null;
  } catch (err) {
    console.log('⚠️ Truecaller failed:', err.message);
    return null;
  }
}

// ============================================================
// ===== MAIN API ENDPOINT =====
// ============================================================
app.get('/api/sim', async (req, res) => {
  const { q, number, search, num } = req.query;
  const query = q || number || search || num;
  
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Search parameter is required',
      usage: {
        phone: '/api/sim?q=923XXXXXXXXX',
        cnic: '/api/sim?q=13-digit-cnic'
      },
      credits: BRANDING
    });
  }
  
  const cleanQuery = query.toString().trim();
  const detected = detectSearchType(cleanQuery);
  
  if (!detected) {
    return res.status(400).json({
      success: false,
      error: 'Invalid format. Use 923XXXXXXXXX (phone) or 13-digit CNIC',
      credits: BRANDING
    });
  }
  
  console.log('📱 Query:', detected.type, detected.value);
  
  // ===== PRIVACY CHECK =====
  if (detected.type === 'phone' && isBlocked(detected.value)) {
    console.log('🔒 Blocked number requested');
    return res.status(403).json({
      success: false,
      error: 'This number is private. Data access is not allowed.',
      credits: BRANDING
    });
  }
  
  try {
    // ===== STEP 1: SIM DATABASE =====
    let records = await fetchFromSimDb(detected.value);
    let source = null;
    
    if (records && records.length > 0) {
      source = 'sim_database';
    }
    
    // ===== STEP 2: TRUECALLER FALLBACK (sirf phone) =====
    if ((!records || records.length === 0) && detected.type === 'phone') {
      console.log('⚠️ SIM DB empty, trying Truecaller...');
      records = await fetchFromTruecaller(detected.value);
      if (records && records.length > 0) {
        source = 'truecaller';
      }
    }
    
    // ===== DONO FAIL =====
    if (!records || records.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No records found in any database',
        credits: BRANDING,
        query: detected.value,
        tried: ['sim_database', 'truecaller']
      });
    }
    
    // ===== SUCCESS =====
    const firstRecord = records[0];
    
    return res.json({
      credits: BRANDING,
      status: true,
      success: true,
      source: source,
      results: {
        status: true,
        data: {
          search_type: detected.type,
          records_count: records.length,
          queried_number: detected.value,
          records: records,
          summary: {
            name: firstRecord.full_name,
            phone: firstRecord.phone,
            cnic: firstRecord.cnic,
            address: firstRecord.address,
            network: firstRecord.network
          }
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch records. Please try again later.',
      credits: BRANDING,
      debug: {
        number: cleanQuery,
        error_details: error.message
      }
    });
  }
});

// ============================================================
// ===== HOME PAGE =====
// ============================================================
app.get('/', (req, res) => {
  res.json({
    name: "HJH-HACKER SIM + Truecaller API",
    version: "2.0.0",
    status: "🟢 Online",
    developer: "HJ-HACKER",
    website: "https://hamza-jutt-7d6.pages.dev/",
    whatsapp: "https://whatsapp.com/channel/0029VbAaNJ6C1FuB0mIAx93M",
    endpoints: {
      sim: "/api/sim?q=923XXXXXXXXX"
    },
    examples: {
      phone: "/api/sim?q=923217558607",
      cnic: "/api/sim?q=3520137181423"
    },
    flow: "SIM Database → Truecaller → No Data Found"
  });
});

// ============================================================
// ===== 404 HANDLER =====
// ============================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found. Available: /api/sim',
    credits: BRANDING
  });
});

// ============================================================
// ===== START SERVER =====
// ============================================================
app.listen(PORT, () => {
  console.log(`🚀 HJH-HACKER API running on port ${PORT}`);
  console.log(`🌐 Website: https://hamza-jutt-7d6.pages.dev/`);
  console.log(`📱 WhatsApp: ${BRANDING.whatsapp_channel}`);
  console.log(`\n🔒 Blocked numbers:`);
  BLOCKED_NUMBERS.forEach(n => console.log(`  → ${n}`));
  console.log(`\n📌 Endpoint: /api/sim?q=923XXXXXXXXX`);
  console.log(`\n🔄 Flow: SIM DB (ftgm) → Truecaller → 404`);
});
