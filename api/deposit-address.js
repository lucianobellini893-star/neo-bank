// Neo — deposit address from a custody provider (BitGo).
// The browser never sees the provider token: it calls this function, the function calls BitGo.
//
// Vercel → Project → Settings → Environment Variables:
//   BITGO_ACCESS_TOKEN   long-lived access token from BitGo (Settings → Developer Options)
//   BITGO_ENV            "test" (app.bitgo-test.com, testnet coins) or "prod" (app.bitgo.com)
//   BITGO_WALLET_BTC     wallet id for Bitcoin; same for ETH, SOL, XRP, ADA, LTC, DOGE, DOT, TRX,
//                        XLM, ATOM, BSC, POLYGON, ARB, BASE, AVAX — only the ones you created.
// Tokens (USDC, LINK, UNI …) use the address of the network wallet they live on (ETH, SOL, BASE …).

const COINS = { // our network id → BitGo coin [prod, test]
  btc: ['btc', 'tbtc4'], eth: ['eth', 'hteth'], sol: ['sol', 'tsol'], xrp: ['xrp', 'txrp'],
  ada: ['ada', 'tada'], ltc: ['ltc', 'tltc'], doge: ['doge', 'tdoge'], dot: ['dot', 'tdot'],
  trx: ['trx', 'ttrx'], xlm: ['xlm', 'txlm'], atom: ['atom', 'tatom'], bsc: ['bsc', 'tbsc'],
  polygon: ['polygon', 'tpolygon'], arb: ['arbeth', 'tarbeth'], base: ['baseeth', 'tbaseeth'],
  avax: ['avaxc', 'tavaxc'],
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const net = String(body.net || '').toLowerCase();
  const map = COINS[net];
  if (!map) return res.status(400).json({ error: 'unknown_network' });

  const token = process.env.BITGO_ACCESS_TOKEN;
  const wallet = process.env['BITGO_WALLET_' + net.toUpperCase()];
  if (!token || !wallet) return res.status(501).json({ error: 'not_configured', net });

  const test = (process.env.BITGO_ENV || 'test') !== 'prod';
  const host = test ? 'https://app.bitgo-test.com' : 'https://app.bitgo.com';
  const coin = test ? map[1] : map[0];
  const label = String(body.label || 'neo').replace(/[^\w\- .@]/g, '').slice(0, 60);

  try {
    const r = await fetch(`${host}/api/v2/${coin}/wallet/${encodeURIComponent(wallet)}/address`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.address) return res.status(502).json({ error: 'provider', status: r.status, message: j.error || j.message || null });
    return res.status(200).json({ address: j.address, coin, testnet: test, pending: !!j.pendingChainInitialization });
  } catch (e) {
    return res.status(502).json({ error: 'provider_unreachable' });
  }
};
