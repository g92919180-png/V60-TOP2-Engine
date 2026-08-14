const https = require("https");

const SYMBOLS = [
  ["2317", "鴻海"],
  ["00631L", "元大台灣50正2"],
  ["2330", "台積電"],
  ["2454", "聯發科"],
  ["2382", "廣達"],
  ["2308", "台達電"]
];

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 V60-TOP2-Engine",
          "Accept": "application/json,text/plain,*/*"
        }
      },
      res => {
        let body = "";

        res.on("data", chunk => {
          body += chunk;
        });

        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    ).on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const ex_ch = SYMBOLS
    .map(x => `tse_${x[0]}.tw`)
    .join("|");

  const url =
    "https://mis.twse.com.tw/stock/api/getStockInfo.jsp" +
    `?ex_ch=${encodeURIComponent(ex_ch)}&json=1&delay=0&_=${Date.now()}`;

  try {
    const data = await getJSON(url);

    const rows = Array.isArray(data.msgArray)
      ? data.msgArray
      : [];

    const map = new Map();

    rows.forEach(row => {
      const code = String(row.c || "").toUpperCase();

      if (!code) return;

      const found = SYMBOLS.find(
        x => x[0].toUpperCase() === code
      );

      if (!found) return;

      const price = Number(row.z) || 0;
      const prev = Number(row.y) || 0;
      const volume = Number(row.v) || 0;

      const change = prev
        ? ((price - prev) / prev) * 100
        : 0;

      map.set(code, {
        code,
        name: found[1],
        price,
        prev,
        volume,
        change,
        source: "TWSE MIS",
        updatedAt: new Date().toISOString()
      });
    });

    const result = SYMBOLS.map(([code, name]) => {
      return (
        map.get(code) || {
          code,
          name,
          price: 0,
          prev: 0,
          volume: 0,
          change: 0,
          source: "TWSE MIS",
          updatedAt: new Date().toISOString()
        }
      );
    });

    return res.status(200).json(result);

  } catch (error) {
    return res.status(503).json({
      error: "TWSE MIS unavailable",
      message: error.message,
      quotes: []
    });
  }
};
