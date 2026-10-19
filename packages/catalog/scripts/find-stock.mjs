// Finds CC0 / public-domain photo candidates for each demo film on Openverse (openverse.org).
// Writes packages/catalog/stock/candidates.json and saves small thumbnails for a human (or
// Claude) to review before any full image is downloaded. Run: node packages/catalog/scripts/find-stock.mjs <thumbDir> [filmId …]
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const here = new URL('../stock/', import.meta.url);
const queries = JSON.parse(readFileSync(new URL('queries.json', here), 'utf8'));
const thumbDir = process.argv[2];
if (!thumbDir) throw new Error('usage: find-stock.mjs <thumbDir>');
mkdirSync(thumbDir, {recursive: true});

// No people, faces, logos or brands (hackathon rule: no third-party trademarks), nothing adult.
const AVOID = /\b(sexy|nude|naked|model|lingerie|bikini|girl|boy|woman|women|man|men|lady|portrait|selfie|face|people|person|child|kid|baby|wedding couple|bride|groom|logo|brand|advert|poster|cover|screenshot|text|sign|label)\b/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Optional film ids to (re)search; the rest of candidates.json is kept.
const only = process.argv.slice(3);
const candidatesUrl = new URL('candidates.json', here);
let out = {};
try {
  out = JSON.parse(readFileSync(candidatesUrl, 'utf8'));
} catch {
  // first run
}
for (const [id, q] of Object.entries(queries)) {
  if (only.length && !only.includes(id)) continue;
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&page_size=20&mature=false`;
  const res = await fetch(url, {headers: {'user-agent': 'CouchConsensus-demo-art/1.0 (hackathon; github.com/vermilion4/couchconsensus)'}});
  if (!res.ok) {
    console.log(id, 'search failed', res.status);
    await sleep(5000);
    continue;
  }
  const {results} = await res.json();
  const picks = results
    .filter(r => r.width >= 800 && r.height >= 500)
    .filter(r => !AVOID.test(`${r.title ?? ''} ${(r.tags ?? []).map(t => t.name).join(' ')}`))
    .slice(0, 3)
    .map(r => ({
      oid: r.id,
      url: r.url,
      title: r.title,
      creator: r.creator ?? 'unknown',
      license: r.license,
      landing: r.foreign_landing_url,
      source: r.source,
      width: r.width,
      height: r.height,
    }));
  out[id] = picks;
  for (const [i, p] of picks.entries()) {
    // Flickr serves small sizes by suffix; elsewhere use Openverse's thumbnail.
    const thumb = p.source === 'flickr' ? p.url.replace(/_[a-z]\.jpg$|\.jpg$/, '_n.jpg') : `https://api.openverse.org/v1/images/${p.oid}/thumb/`;
    const t = await fetch(thumb);
    if (t.ok) writeFileSync(`${thumbDir}/${id}-${i}.jpg`, Buffer.from(await t.arrayBuffer()));
  }
  console.log(id, q, '→', picks.length, 'candidates');
  await sleep(3200); // stay well under the anonymous rate limit
}
writeFileSync(candidatesUrl, JSON.stringify(out, null, 2) + '\n');
