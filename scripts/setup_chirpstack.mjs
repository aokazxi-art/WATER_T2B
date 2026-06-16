// ============================================================
//  scripts/setup_chirpstack.mjs
//  ChirpStack v4 setup via gRPC-web (port 8080)
//  ChirpStack v4 does NOT expose a REST API directly — only gRPC-web.
//  Usage: node scripts/setup_chirpstack.mjs
// ============================================================

const BASE_URL = "http://localhost:8080";

// ── Enum values (confirmed from ChirpStack v4.18.0 JS bundle) ────────────
const Region         = { AS923: 7 };
const MacVersion     = { LORAWAN_1_0_2: 2 };
const RegParams      = { B: 1 };
const CodecRuntime   = { JS: 2 };

// ── Device credentials from simulator/config.mjs ─────────────────────────
const DEVICES = [
  { name: "pond_1", devEui: "aabb000000000001", devAddr: "11223301",
    nwkSKey: "01010101010101010101010101010101", appSKey: "02020202020202020202020202020202" },
  { name: "pond_2", devEui: "aabb000000000002", devAddr: "11223302",
    nwkSKey: "03030303030303030303030303030303", appSKey: "04040404040404040404040404040404" },
  { name: "pond_3", devEui: "aabb000000000003", devAddr: "11223303",
    nwkSKey: "05050505050505050505050505050505", appSKey: "06060606060606060606060606060606" },
  { name: "pond_4", devEui: "aabb000000000004", devAddr: "11223304",
    nwkSKey: "07070707070707070707070707070707", appSKey: "08080808080808080808080808080808" },
];

// ── Milesight EM500-UDL decoder (JS payload codec) ───────────────────────
const CODEC_SCRIPT = `
function decodeUplink(input) {
  var bytes = input.bytes;
  var result = {};
  var i = 0;
  while (i < bytes.length) {
    var channel = bytes[i++];
    var type    = bytes[i++];
    if (channel === 0x01 && type === 0x75) {
      result.battery = bytes[i++];
    } else if (channel === 0x03 && type === 0x82) {
      result.distance = bytes[i] | (bytes[i + 1] << 8);
      i += 2;
    } else { break; }
  }
  return { data: result };
}
`.trim();

// ══════════════════════════════════════════════════════════════════════════
//  Minimal protobuf encoder
// ══════════════════════════════════════════════════════════════════════════

function varint(n) {
  n = n >>> 0;
  if (n === 0) return Buffer.from([0]);
  const b = [];
  while (n > 0x7F) { b.push((n & 0x7F) | 0x80); n >>>= 7; }
  b.push(n & 0x7F);
  return Buffer.from(b);
}

const wStr  = (fn, v) => { if (!v) return B0; const d=Buffer.from(v,'utf8');  return cat(varint((fn<<3)|2), varint(d.length), d); };
const wU32  = (fn, v) => { if (!v) return B0; return cat(varint((fn<<3)|0), varint(v)); };
const wEnum = (fn, v) => { if (!v) return B0; return cat(varint((fn<<3)|0), varint(v)); };
const wBool = (fn, v) => { if (!v) return B0; return cat(varint((fn<<3)|0), Buffer.from([1])); };
const wMsg  = (fn, d) => { if (!d || d.length===0) return B0; return cat(varint((fn<<3)|2), varint(d.length), d); };
const cat   = (...b)  => Buffer.concat(b);
const B0    = Buffer.alloc(0);

// ── gRPC-web frame ────────────────────────────────────────────────────────

function grpcFrame(data) {
  const h = Buffer.alloc(5);
  h[0] = 0x00;
  h.writeUInt32BE(data.length, 1);
  return cat(h, data);
}

// ══════════════════════════════════════════════════════════════════════════
//  Minimal protobuf decoder
// ══════════════════════════════════════════════════════════════════════════

function readVarInt(buf, off) {
  let r=0, s=0, b;
  do { b=buf[off++]; r|=(b&0x7F)<<s; s+=7; } while (b&0x80);
  return [r>>>0, off];
}

// Returns { fieldNum -> Buffer (len-delimited) | number (varint) | Array }
function decode(buf, start=0, end=buf?.length??0) {
  const f = {};
  let o = start;
  while (o < end) {
    let tag, v, len;
    [tag, o] = readVarInt(buf, o);
    const wire = tag & 7, fn = tag >>> 3;
    if (wire === 0) { [v, o] = readVarInt(buf, o); push(f, fn, v); }
    else if (wire === 2) { [len, o] = readVarInt(buf, o); push(f, fn, buf.slice(o, o+len)); o+=len; }
    else if (wire === 1) { o+=8; }
    else if (wire === 5) { o+=4; }
    else break;
  }
  return f;
}
function push(f, fn, v) {
  if (!(fn in f)) f[fn] = v;
  else if (Array.isArray(f[fn])) f[fn].push(v);
  else f[fn] = [f[fn], v];
}
const str = (v) => Buffer.isBuffer(v) ? v.toString('utf8') : null;

// ── Parse gRPC-web response frames ───────────────────────────────────────
// ChirpStack sends gRPC status in TWO places depending on whether there is a
// response body:
//   • With body  → 0x80 trailer frame embedded in the body
//   • No body    → plain HTTP response headers (grpc-status, grpc-message)

function parseGrpcWeb(buf) {
  let off=0, data=null, trailer='';
  while (off < buf.length) {
    if (off+5 > buf.length) break;
    const type = buf[off];
    const len  = buf.readUInt32BE(off+1);
    off += 5;
    const chunk = buf.slice(off, off+len); off+=len;
    if (type === 0x00) data    = chunk;
    if (type === 0x80) trailer = chunk.toString('utf8');
  }
  const sm = trailer.match(/grpc-status:(\d+)/);
  const mm = trailer.match(/grpc-message:([^\r\n]*)/);
  const status = sm ? parseInt(sm[1]) : -1;   // -1 = not found in body
  const msg    = mm ? decodeURIComponent(mm[1].trim()) : '';
  return { data, status, msg };
}

// ══════════════════════════════════════════════════════════════════════════
//  gRPC-web caller
// ══════════════════════════════════════════════════════════════════════════

async function grpc(service, method, payload, token) {
  const url = `${BASE_URL}/${service}/${method}`;
  const hdrs = { 'Content-Type': 'application/grpc-web+proto', 'X-Grpc-Web': '1' };
  if (token) hdrs['authorization'] = `Bearer ${token}`;

  const res  = await fetch(url, { method: 'POST', headers: hdrs, body: grpcFrame(payload) });
  const buf  = Buffer.from(await res.arrayBuffer());
  const { data, status: bodyStatus, msg: bodyMsg } = parseGrpcWeb(buf);

  // Fall back to HTTP response headers when there is no body trailer frame
  const httpStatus = parseInt(res.headers.get('grpc-status') ?? '-1');
  const httpMsg    = decodeURIComponent(res.headers.get('grpc-message') ?? '');

  const status = bodyStatus !== -1 ? bodyStatus : (httpStatus !== -1 ? httpStatus : 0);
  const msg    = bodyMsg || httpMsg;

  if (status !== 0) {
    throw Object.assign(new Error(`gRPC ${status}: ${msg || 'error'} [${service}/${method}]`), { grpcStatus: status });
  }
  return data ?? B0;
}

// ══════════════════════════════════════════════════════════════════════════
//  Step 1 — Login
// ══════════════════════════════════════════════════════════════════════════

async function login() {
  console.log("\n[1] Logging in as admin...");
  const req  = cat(wStr(1, "admin"), wStr(2, "admin"));
  const resp = await grpc("api.InternalService", "Login", req, null);
  const jwt  = str(decode(resp)[1]);
  if (!jwt) throw new Error("Login returned no JWT");
  console.log("  JWT obtained.");
  return jwt;
}

// ══════════════════════════════════════════════════════════════════════════
//  Step 2 — Get tenant ID
// ══════════════════════════════════════════════════════════════════════════

async function getTenantId(token) {
  console.log("\n[2] Fetching tenants...");
  const req  = wU32(1, 10); // limit=10
  const resp = await grpc("api.TenantService", "List", req, token);
  const top  = decode(resp);
  // field 2 = repeated TenantListItem; field 4 in item = name
  const raw  = top[2];
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!first) throw new Error("No tenants found");
  const item = decode(first);
  const id   = str(item[1]);
  const name = str(item[4]) ?? "(unnamed)";
  console.log(`  Tenant: "${name}" (${id})`);
  return id;
}

// ══════════════════════════════════════════════════════════════════════════
//  Step 3 — Create device profile (idempotent)
// ══════════════════════════════════════════════════════════════════════════

async function getOrCreateDeviceProfile(token, tenantId) {
  console.log("\n[3] Device profile \"Milesight-EM500-ABP\"...");

  // List existing profiles for this tenant
  const listReq  = cat(wU32(1, 100), wStr(4, tenantId));
  const listResp = await grpc("api.DeviceProfileService", "List", listReq, token);
  const listTop  = decode(listResp);
  const items    = listTop[2];
  const itemArr  = !items ? [] : Array.isArray(items) ? items : [items];
  for (const raw of itemArr) {
    const it   = decode(raw);
    const name = str(it[4]);
    if (name === "Milesight-EM500-ABP") {
      const id = str(it[1]);
      console.log(`  Already exists (${id}), skipping.`);
      return id;
    }
  }

  // Create
  const profile = cat(
    wStr (2,  tenantId),
    wStr (3,  "Milesight-EM500-ABP"),
    wEnum(4,  Region.AS923),
    wEnum(5,  MacVersion.LORAWAN_1_0_2),
    wEnum(6,  RegParams.B),
    wEnum(8,  CodecRuntime.JS),
    wStr (9,  CODEC_SCRIPT),
    wU32 (11, 3600),
    wStr (26, "Milesight EM500-UDL ultrasonic sensor, ABP"),
  );
  const req  = wMsg(1, profile);
  const resp = await grpc("api.DeviceProfileService", "Create", req, token);
  const id   = str(decode(resp)[1]);
  console.log(`  Created (${id})`);
  return id;
}

// ══════════════════════════════════════════════════════════════════════════
//  Step 4 — Create application (idempotent)
// ══════════════════════════════════════════════════════════════════════════

async function getOrCreateApplication(token, tenantId) {
  console.log("\n[4] Application \"water-t2b\"...");

  // List existing applications
  const listReq  = cat(wU32(1, 100), wStr(4, tenantId));
  const listResp = await grpc("api.ApplicationService", "List", listReq, token);
  const listTop  = decode(listResp);
  const items    = listTop[2];
  const itemArr  = !items ? [] : Array.isArray(items) ? items : [items];
  const normalize = (n) => n?.replace(/-/g, "_");
  for (const raw of itemArr) {
    const it   = decode(raw);
    const name = str(it[4]);
    if (normalize(name) === "water_t2b") {
      const id = str(it[1]);
      console.log(`  Already exists as "${name}" (${id}), skipping.`);
      return id;
    }
  }

  // Create
  const app  = cat(wStr(2, tenantId), wStr(3, "water-t2b"), wStr(4, "Water level monitoring - T2B"));
  const req  = wMsg(1, app);
  let id;
  try {
    const resp = await grpc("api.ApplicationService", "Create", req, token);
    id = str(decode(resp)[1]);
  } catch (e) {
    if (e.grpcStatus !== 6) throw e;
  }

  // Some ChirpStack builds return empty body on create; list to find the id
  if (!id) {
    const lr   = await grpc("api.ApplicationService", "List", cat(wU32(1, 100), wStr(4, tenantId)), token);
    const lf   = decode(lr);
    const raw2 = lf[2];
    const arr2 = !raw2 ? [] : Array.isArray(raw2) ? raw2 : [raw2];
    for (const r of arr2) {
      const it = decode(r);
      if (normalize(str(it[4])) === "water_t2b") { id = str(it[1]); break; }
    }
  }

  console.log(`  Created (${id})`);
  return id;
}

// ══════════════════════════════════════════════════════════════════════════
//  Step 5 — Register device + ABP activation (idempotent)
// ══════════════════════════════════════════════════════════════════════════

async function registerDevice(token, device, applicationId, deviceProfileId) {
  console.log(`\n[5] Device "${device.name}" (${device.devEui})...`);

  // Create device
  const dev = cat(
    wStr (1, device.devEui),
    wStr (2, device.name),
    wStr (3, `Pond sensor - ${device.name}`),
    wStr (4, applicationId),
    wStr (5, deviceProfileId),
    wBool(6, true),   // skipFcntCheck
  );
  try {
    await grpc("api.DeviceService", "Create", wMsg(1, dev), token);
    console.log("  Created.");
  } catch (e) {
    if (e.grpcStatus === 6) console.log("  Already exists, skipping create.");
    else throw e;
  }

  // ABP activation (all three NwkS keys = same key for LoRaWAN 1.0.x)
  const act = cat(
    wStr(1, device.devEui),
    wStr(2, device.devAddr),
    wStr(3, device.appSKey),
    wStr(4, device.nwkSKey),   // nwkSEncKey
    wStr(5, device.nwkSKey),   // sNwkSIntKey
    wStr(6, device.nwkSKey),   // fNwkSIntKey
  );
  await grpc("api.DeviceService", "Activate", wMsg(1, act), token);
  console.log(`  ABP activated (devAddr: ${device.devAddr})`);
}

// ══════════════════════════════════════════════════════════════════════════
//  Main
// ══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("=== ChirpStack v4 setup (gRPC-web) ===");
  console.log(`Target: ${BASE_URL}`);

  try {
    const token     = await login();
    const tenantId  = await getTenantId(token);
    const profileId = await getOrCreateDeviceProfile(token, tenantId);
    const appId     = await getOrCreateApplication(token, tenantId);

    for (const d of DEVICES) {
      await registerDevice(token, d, appId, profileId);
    }

    console.log("\n=== Setup complete ===");
    console.log(`Application ID:    ${appId}`);
    console.log(`Device Profile ID: ${profileId}`);
    console.log("Devices:");
    for (const d of DEVICES) {
      console.log(`  ${d.name}  devEui=${d.devEui}  devAddr=${d.devAddr}`);
    }
  } catch (err) {
    console.error("\nSetup failed:", err.message);
    process.exit(1);
  }
}

main();
