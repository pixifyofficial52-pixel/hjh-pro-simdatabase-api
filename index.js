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

  try {
    const cleanQuery = query.toString().trim();
    console.log('📱 SIM Search:', cleanQuery);

    // ===== FTGM API CALL (ONLY FOR DATA - CREDITS REMOVED) =====
    const apiUrl = `https://ftgm-stock.vercel.app/api/sim?num=${encodeURIComponent(cleanQuery)}`;
    console.log('🔄 Fetching data...');

    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 15000
    });

    const data = response.data;
    console.log('✅ Data received');

    // ===== CHECK IF DATA FOUND =====
    if (!data.success || !data.data || data.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No records found for this number',
        credits: BRANDING,
        number: cleanQuery
      });
    }

    // ===== FORMAT RESPONSE - ONLY HJ-HACKER =====
    const records = data.data.map(record => ({
      full_name: record.name || 'N/A',
      phone: record.number || 'N/A',
      cnic: record.cnic || 'N/A',
      address: record.address || 'N/A'
    }));

    const firstRecord = records[0] || {};

    // ===== RESPONSE WITH ONLY HJ-HACKER BRANDING =====
    res.json({
      credits: BRANDING,
      status: true,
      results: {
        status: true,
        data: {
          search_type: 'phone',
          records_count: records.length,
          queried_number: cleanQuery,
          records: records,
          summary: {
            name: firstRecord.full_name || 'N/A',
            phone: firstRecord.phone || 'N/A',
            cnic: firstRecord.cnic || 'N/A',
            address: firstRecord.address || 'N/A'
          }
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    let errorMessage = 'Failed to fetch records. Please try again later.';
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout. The server is taking too long to respond.';
    }

    res.status(500).json({
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
  console.log(`\n📌 Endpoint:`);
  console.log(`  → SIM DB:  /api/sim?q=03217558607`);
});
