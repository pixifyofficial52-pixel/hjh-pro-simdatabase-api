const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===== ONLY HJ-HACKER BRANDING =====
const BRANDING = {
  developed_by: "HJ-HACKER",
  whatsapp_channel: "https://whatsapp.com/channel/0029VbAaNJ6C1FuB0mIAx93M",
  main_site: "https://hamza-jutt-7d6.pages.dev/",
  note: "🔥 Follow HJ-HACKER for more tools, apps & tech updates!",
  version: "2.0.0"
};

// ============================================================
// ===== PRIVATE / BLOCKED NUMBERS =====
// ===== In numbers ka data kisi bhi source se return nahi hoga =====
// ============================================================
const BLOCKED_NUMBERS = [
  '923266571331',
  '03035481601'
];

// Normalize number: sab formats ko ek shape mein laao
// 03035481601  -> 03035481601
// 923266571331 -> 03266571331
function normalizeNumber(num) {
  if (!num) return '';
  let n = num.toString().replace(/\D/g, '');

  // 92xxxxxxxxxx -> 0xxxxxxxxxx
  if (n.startsWith('92') && n.length === 12) {
    n = '0' + n.slice(2);
  }
  // 3xxxxxxxxx (10 digits, missing 0) -> 03xxxxxxxxx
  else if (n.length === 10 && n.startsWith('3')) {
    n = '0' + n;
  }
  return n;
}

// Check karo ke number blocked hai ya nahi (dono formats compare karo)
function isBlocked(num) {
  const normalized = normalizeNumber(num);
  const raw = num.toString().replace(/\D/g, '');

  return BLOCKED_NUMBERS.some(blocked => {
    const bNorm = normalizeNumber(blocked);
    const bRaw = blocked.replace(/\D/g, '');
    return (
      normalized === bNorm ||
      raw === bRaw ||
      normalized === bRaw ||
      raw === bNorm
    );
  });
}

// ============================================================
// ===== TRUECALLER FALLBACK =====
// ============================================================
async function fetchFromTruecaller(number) {
  try {
    // Truecaller API ko international format chahiye (92xxxxxxxxxx)
    const normalized = normalizeNumber(number); // 03xxxxxxxxx
    const intlFormat = '92' + normalized.slice(1); // 92xxxxxxxxxx

    const url = `https://faisal-ali-truecaller.ftgmhacks.workers.dev/?key=pak-digital.store&number=${intlFormat}`;
    console.log('📞 Trying Truecaller:', url);

    const response = await axios.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 15000,
      validateStatus: () => true
    });

    console.log('📥 Truecaller raw:', JSON.stringify(response.data).slice(0, 500));
    return response.data;
  } catch (err) {
    console.log('⚠️ Truecaller failed:', err.message);
    return null;
  }
}

// ============================================================
// ===== SIM DATABASE API =====
// ============================================================
app.get('/api/sim', async (req, res) => {
  const { q, number, search, num } = req.query;
  const query = q || number || search || num;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Search parameter is required',
      usage: {
        by_phone: '/api/sim?q=03001234567',
        by_number: '/api/sim?number=03001234567',
        by_search: '/api/sim?search=03001234567',
        by_num: '/api/sim?num=03001234567'
      },
      credits: BRANDING,
      example: '/api/sim?q=03217558607'
    });
  }

  const cleanQuery = query.toString().trim();

  // ===== PRIVACY CHECK — blocked number? =====
  if (isBlocked(cleanQuery)) {
    console.log('🔒 Blocked number requested:', cleanQuery);
    return res.status(403).json({
      success: false,
      error: 'This number is private. Data access is not allowed.',
      credits: BRANDING
    });
  }

  console.log('📱 SIM Search:', cleanQuery);

  try {
    // ===== STEP 1: SIM DATABASE TRY KARO =====
    const apiUrl = `https://ftgm-simdb-api.vercel.app/api/sim?num=${encodeURIComponent(cleanQuery)}`;
    console.log('🔄 Fetching SIM DB:', apiUrl);

    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 15000,
      validateStatus: () => true
    });

    const data = response.data;
    console.log('📥 SIM DB status:', data.status, '| records:', data.count);

    // ===== CHECK: SIM DB MEIN DATA MILA? =====
    const simDbHasData =
      (data.status === 'success' || data.status === true || data.success === true) &&
      Array.isArray(data.records) &&
      data.records.length > 0;

    if (simDbHasData) {
      // ===== NORMALIZE SIM DB RECORDS =====
      const records = data.records.map(r => ({
        full_name: r.name || 'N/A',
        phone: r.mobile || r.number || r.phone || 'N/A',
        cnic: r.cnic || 'N/A',
        address: r.address || 'N/A',
        network: r.network || 'N/A'
      }));

      const firstRecord = records[0];

      return res.json({
        credits: BRANDING,
        status: true,
        success: true,
        source: 'sim_database',
        results: {
          status: true,
          data: {
            search_type: 'phone',
            records_count: records.length,
            queried_number: cleanQuery,
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
    }

    // ===== STEP 2: SIM DB MEIN NAHI MILA → TRUECALLER TRY KARO =====
    console.log('⚠️ SIM DB empty, falling back to Truecaller...');
    const tcData = await fetchFromTruecaller(cleanQuery);

    // ===== TRUECALLER RESPONSE PARSE — actual structure =====
    // {
    //   status: "success",
    //   data: { name, sim, success, timestamp, developer }
    // }
    if (
      tcData &&
      tcData.status === 'success' &&
      tcData.data &&
      tcData.data.success === true &&
      tcData.data.name
    ) {
      const tc = tcData.data;

      // "Unknown SIM" / "Unknown" ko N/A treat karo
      const simInfo = tc.sim && !/unknown/i.test(tc.sim) ? tc.sim : 'N/A';
      const callerName =
        tc.name && !/unknown/i.test(tc.name) ? tc.name : 'N/A';

      // Agar name bhi N/A hai to 404
      if (callerName === 'N/A') {
        return res.status(404).json({
          success: false,
          error: 'No records found for this number in any database',
          credits: BRANDING,
          number: cleanQuery,
          tried: ['sim_database', 'truecaller']
        });
      }

      const tcRecord = {
        full_name: callerName,
        phone: cleanQuery,
        cnic: 'N/A',           // Truecaller CNIC nahi deta
        address: 'N/A',        // Truecaller address nahi deta
        network: simInfo       // "sim" field = network/carrier info
      };

      return res.json({
        credits: BRANDING,
        status: true,
        success: true,
        source: 'truecaller',
        results: {
          status: true,
          data: {
            search_type: 'phone',
            records_count: 1,
            queried_number: cleanQuery,
            records: [tcRecord],
            summary: tcRecord
          },
          timestamp: new Date().toISOString()
        }
      });
    }

    // ===== DONO FAIL → 404 =====
    return res.status(404).json({
      success: false,
      error: 'No records found for this number in any database',
      credits: BRANDING,
      number: cleanQuery,
      tried: ['sim_database', 'truecaller']
    });

  } catch (error) {
    console.error('❌ Error:', error.message);

    const errorMessage = error.code === 'ECONNABORTED'
      ? 'Request timeout. The server is taking too long to respond.'
      : 'Failed to fetch records. Please try again later.';

    return res.status(500).json({
      success: false,
      error: errorMessage,
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
    name: "HJ-HACKER SIM Database API",
    version: "2.0.0",
    status: "🟢 Online",
    developer: "HJ-HACKER",
    website: "https://hamza-jutt-7d6.pages.dev/",
    whatsapp: "https://whatsapp.com/channel/0029VbAaNJ6C1FuB0mIAx93M",
    endpoints: {
      sim_database: "/api/sim?q=PHONE_NUMBER"
    },
    examples: {
      phone: "/api/sim?q=03217558607"
    }
  });
});

// ============================================================
// ===== 404 HANDLER =====
// ============================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found. Available endpoint: /api/sim',
    credits: BRANDING,
    available_endpoints: {
      sim: "/api/sim?q=PHONE_NUMBER"
    },
    examples: {
      phone: "/api/sim?q=03217558607"
    }
  });
});

// ============================================================
// ===== START SERVER =====
// ============================================================
app.listen(PORT, () => {
  console.log(`🚀 HJ-HACKER SIM Database API running on port ${PORT}`);
  console.log(`🌐 Website: https://hamza-jutt-7d6.pages.dev/`);
  console.log(`📱 WhatsApp Channel: ${BRANDING.whatsapp_channel}`);
  console.log(`\n🔒 Blocked numbers (privacy):`);
  BLOCKED_NUMBERS.forEach(n => console.log(`  → ${n}`));
  console.log(`\n📌 Endpoint:`);
  console.log(`  → SIM DB + Truecaller:  /api/sim?q=03217558607`);
});
