// Importacao territorial local: KMZ (ZIP/KML), KML e GeoJSON.
// Nao transmite os arquivos e nao determina cobertura ou capacidade da ST1.
export const TERRITORY_LIMITS = Object.freeze({
  fileBytes: 12 * 1024 * 1024,
  xmlBytes: 8 * 1024 * 1024,
  zipEntries: 5000,
  polygons: 600,
  lines: 2000,
  points: 5000,
  vertices: 75000
});

const decoder = new TextDecoder('utf-8');
const isCoord = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const validPos = p => Array.isArray(p) && p.length >= 2 && isCoord(p[0]) && isCoord(p[1]) && Math.abs(Number(p[0])) <= 180 && Math.abs(Number(p[1])) <= 90;
const cleanName = (name, fallback) => String(name || fallback).trim().slice(0,100);
const normalizeFolder = name => String(name || '').trim().slice(0,180);

function closeRing(points) {
  if (!Array.isArray(points) || points.length < 3 || points.length > TERRITORY_LIMITS.vertices) throw new Error('Anel territorial inválido.');
  const ring = points.map(p => {
    if (!validPos(p)) throw new Error('Coordenada inválida no polígono.');
    return [Number(p[0]), Number(p[1])];
  });
  const a = ring[0], b = ring[ring.length-1];
  if (a[0] !== b[0] || a[1] !== b[1]) ring.push([...a]);
  if (ring.length < 4) throw new Error('Polígono precisa de pelo menos 3 vértices.');
  return ring;
}

function normalizePolygon(geometry) {
  if (!geometry || !['Polygon','MultiPolygon'].includes(geometry.type)) throw new Error('Geometria não suportada.');
  const input = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  if (!Array.isArray(input) || input.length === 0) throw new Error('Polígono sem coordenadas.');
  let vertices = 0;
  const coords = input.map(poly => {
    if (!Array.isArray(poly) || !poly.length) throw new Error('Polígono sem anel externo.');
    return poly.map(ring => {
      const normalized = closeRing(ring);
      vertices += normalized.length;
      return normalized;
    });
  });
  return { geometry: geometry.type === 'Polygon' ? {type:'Polygon',coordinates:coords[0]} : {type:'MultiPolygon',coordinates:coords}, vertices };
}

function collectFeatures() {
  const out = {polygons:[],lines:[],points:[],ignored:0,vertices:0};
  const check = () => {
    if (out.polygons.length > TERRITORY_LIMITS.polygons || out.lines.length > TERRITORY_LIMITS.lines || out.points.length > TERRITORY_LIMITS.points || out.vertices > TERRITORY_LIMITS.vertices)
      throw new Error('Arquivo muito grande para o mapa local. Limites: 600 polígonos, 2.000 linhas, 5.000 pontos ou 75.000 vértices.');
  };
  return {
    out,
    add(name,geometry,folder) {
      const label = cleanName(name,'Elemento sem nome'), layer = normalizeFolder(folder);
      if (!geometry || typeof geometry !== 'object') {out.ignored++;return;}
      if (geometry.type === 'GeometryCollection') {
        for (const item of geometry.geometries || []) this.add(label,item,layer);
        return;
      }
      if (geometry.type === 'MultiPoint') {
        for (const p of geometry.coordinates || []) this.add(label,{type:'Point',coordinates:p},layer);
        return;
      }
      if (geometry.type === 'LineString' || geometry.type === 'MultiLineString') {
        const segments=geometry.type==='LineString' ? [geometry.coordinates] : geometry.coordinates;
        if(!Array.isArray(segments)||!segments.length)throw new Error('Linha sem coordenadas.');
        const normalized=segments.map(segment=>{
          if(!Array.isArray(segment)||segment.length<2||segment.length>TERRITORY_LIMITS.vertices)throw new Error('Linha inválida.');
          return segment.map(pos=>{
            if(!validPos(pos))throw new Error('Coordenada inválida em linha.');
            return [Number(pos[0]),Number(pos[1])];
          });
        });
        out.vertices+=normalized.reduce((sum,line)=>sum+line.length,0);
        out.lines.push({name:label,folder:layer,geometry:geometry.type==='LineString'?
          {type:'LineString',coordinates:normalized[0]}:{type:'MultiLineString',coordinates:normalized}});
        check();return;
      }
      if (geometry.type === 'Point') {
        if (!validPos(geometry.coordinates)) {out.ignored++;return;}
        const [lon,lat] = geometry.coordinates.map(Number);
        out.points.push({name:label,lat,lon,folder:layer,possibleCto:/(^|[^a-z])cto([^a-z]|$)/i.test(label+' '+layer)});
        check();return;
      }
      if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        const normalized = normalizePolygon(geometry);
        out.vertices += normalized.vertices;
        out.polygons.push({name:label,geometry:normalized.geometry,folder:layer});
        check();return;
      }
      out.ignored++;
    }
  };
}

export function parseGeoJsonText(text) {
  let json;
  try {json=JSON.parse(text);} catch {throw new Error('GeoJSON inválido: não foi possível ler o JSON.');}
  const accumulator = collectFeatures();
  const items = json?.type === 'FeatureCollection' ? json.features : json?.type === 'Feature' ? [json] : [{geometry:json,properties:{}}];
  if (!Array.isArray(items) || items.length > TERRITORY_LIMITS.points+TERRITORY_LIMITS.polygons+TERRITORY_LIMITS.lines) throw new Error('Quantidade excessiva de elementos no GeoJSON.');
  for (let i=0; i<items.length; i++) {
    const f=items[i] || {}, p=f.properties || {};
    accumulator.add(p.name || p.nome || 'Elemento '+(i+1),f.geometry,p.folder || p.pasta || p.layer || p.camada || '');
  }
  return finish(accumulator.out);
}

function children(node,name) {
  return Array.from(node?.children || []).filter(el => el.localName === name);
}
function descendants(node,name) {
  if (!node) return [];
  const namespaced = Array.from(node.getElementsByTagNameNS('*',name));
  return namespaced.length ? namespaced : Array.from(node.getElementsByTagName(name));
}
function elementName(node) {
  return children(node,'name')[0]?.textContent?.trim() || '';
}
function folderPath(node) {
  const folderNames=[];
  for (let parent=node?.parentElement;parent;parent=parent.parentElement) {
    if (parent.localName === 'Folder') folderNames.unshift(elementName(parent));
  }
  return folderNames.filter(Boolean).join(' / ');
}
function parseCoords(source) {
  if (!source || !source.trim()) throw new Error('Coordenadas ausentes no KML.');
  return source.trim().split(/\s+/).map(chunk => {
    const parts=chunk.split(',');
    if (parts.length<2 || !validPos(parts)) throw new Error('Coordenada inválida no KML.');
    return [Number(parts[0]),Number(parts[1])];
  });
}
function parsePolygonKml(poly) {
  const outer=descendants(poly,'outerBoundaryIs')[0];
  const ring=descendants(outer,'coordinates')[0];
  if (!ring) throw new Error('Polígono KML sem limites externos.');
  const rings=[closeRing(parseCoords(ring.textContent))];
  for(const inner of descendants(poly,'innerBoundaryIs')) {
    const coords=descendants(inner,'coordinates')[0];
    if (coords) rings.push(closeRing(parseCoords(coords.textContent)));
  }
  return {type:'Polygon',coordinates:rings};
}
export function parseKmlText(text) {
  if (typeof DOMParser === 'undefined') throw new Error('Leitura de KML indisponível neste ambiente.');
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('KML com entidades externas não é permitido.');
  const xml=new DOMParser().parseFromString(text,'application/xml');
  if (descendants(xml,'parsererror').length || xml.getElementsByTagName('parsererror').length) throw new Error('Arquivo KML inválido.');
  const placemarks=descendants(xml,'Placemark'), accumulator=collectFeatures();
  if (placemarks.length > 10000) throw new Error('KML possui placemarks demais para importação local.');
  for (let i=0;i<placemarks.length;i++) {
    const pm=placemarks[i], name=elementName(pm) || 'Elemento '+(i+1), folder=folderPath(pm);
    const polygons=descendants(pm,'Polygon'), points=descendants(pm,'Point'), lines=descendants(pm,'LineString');
    for (const poly of polygons) accumulator.add(name,parsePolygonKml(poly),folder);
    for (const pt of points) {
      const coords=descendants(pt,'coordinates')[0];
      if (!coords) {accumulator.out.ignored++;continue;}
      const positions=parseCoords(coords.textContent);
      if (!positions.length) continue;
      accumulator.add(name,{type:'Point',coordinates:positions[0]},folder);
    }
    for(const line of lines){
      const coords=descendants(line,'coordinates')[0];
      if(!coords){accumulator.out.ignored++;continue;}
      accumulator.add(name,{type:'LineString',coordinates:parseCoords(coords.textContent)},folder);
    }
    if (!polygons.length && !points.length && !lines.length) accumulator.out.ignored++;
  }
  return finish(accumulator.out);
}
function finish(out) {
  if (!out.polygons.length && !out.points.length && !out.lines.length) throw new Error('Arquivo sem polígonos, linhas ou pontos compatíveis.');
  return {
    polygons:out.polygons, lines:out.lines, points:out.points,ignored:out.ignored,vertices:out.vertices,
    ctoCandidates:out.points.filter(p=>p.possibleCto).length,
    folders:[...new Set([...out.polygons,...out.lines,...out.points].map(f=>f.folder).filter(Boolean))].slice(0,200)
  };
}

function crc32(bytes) {
  let c=0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for(let i=0;i<8;i++) c = (c >>> 1) ^ ((c&1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function zipView(buffer) {
  const bytes=buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return {bytes,view:new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)};
}
async function rawInflate(compressed,maxBytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não suporta a descompactação KMZ. Atualize o navegador ou importe o KML extraído.');
  let stream;
  try {stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}
  catch {throw new Error('Descompactação ZIP não suportada neste navegador. Importe um KML ou use um navegador atualizado.');}
  const reader=stream.getReader(),chunks=[];
  let total=0;
  try {
    while (true) {
      const {value,done}=await reader.read();
      if (done) break;
      total+=value.byteLength;
      if (total>maxBytes) throw new Error('KML descompactado excede 8 MB.');
      chunks.push(value);
    }
  } catch(e) {try {await reader.cancel();} catch {} throw e;}
  const out=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}
  return out;
}

export async function extractKmlFromKmz(input) {
  const {bytes,view}=zipView(input);
  const len=bytes.byteLength;
  if (len<22 || view.getUint32(0,true)!==0x04034b50) throw new Error('KMZ inválido: o arquivo não contém um ZIP válido.');
  let end=-1;
  for(let i=len-22;i>=Math.max(0,len-65557);i--) {
    if(view.getUint32(i,true)===0x06054b50 && i+22+view.getUint16(i+20,true)===len){end=i;break;}
  }
  if (end<0) throw new Error('KMZ inválido: índice ZIP não encontrado.');
  const num=view.getUint16(end+10,true),offset=view.getUint32(end+16,true),size=view.getUint32(end+12,true);
  if(view.getUint16(end+4,true)!==0 || view.getUint16(end+6,true)!==0) throw new Error('KMZ dividido em vários volumes não é suportado.');
  if(num> TERRITORY_LIMITS.zipEntries || num===65535 || offset===0xffffffff || size===0xffffffff)
    throw new Error('KMZ grande demais ou ZIP64 não suportado.');
  if (offset+size>end) throw new Error('KMZ inválido: índice fora do arquivo.');
  let cursor=offset;
  const entries=[];
  for(let i=0;i<num;i++){
    if(cursor+46>len || view.getUint32(cursor,true)!==0x02014b50) throw new Error('KMZ inválido: índice de arquivo incorreto.');
    const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true);
    const crc=view.getUint32(cursor+16,true),compressed=view.getUint32(cursor+20,true),original=view.getUint32(cursor+24,true);
    const nameLen=view.getUint16(cursor+28,true),extraLen=view.getUint16(cursor+30,true),commentLen=view.getUint16(cursor+32,true);
    const localOffset=view.getUint32(cursor+42,true);
    const next=cursor+46+nameLen+extraLen+commentLen;
    if(next>len)throw new Error('KMZ inválido: nome fora do arquivo.');
    const filename=decoder.decode(bytes.subarray(cursor+46,cursor+46+nameLen));
    if(/\.kml$/i.test(filename) && !(flags&1)) entries.push({filename,method,crc,compressed,original,localOffset});
    cursor=next;
  }
  if(!entries.length)throw new Error('KMZ não contém arquivo .kml legível.');
  entries.sort((a,b)=>Number(!/(^|\/)doc\.kml$/i.test(a.filename))-Number(!/(^|\/)doc\.kml$/i.test(b.filename)));
  const entry=entries[0];
  if(entry.original > TERRITORY_LIMITS.xmlBytes || entry.compressed > TERRITORY_LIMITS.fileBytes)
    throw new Error('KML interno excede o limite de 8 MB.');
  if (![0,8].includes(entry.method)) throw new Error('KMZ usa um tipo de compressão incompatível.');
  const pos=entry.localOffset;
  if(pos+30>len || view.getUint32(pos,true)!==0x04034b50)throw new Error('KMZ inválido: entrada KML ausente.');
  const start=pos+30+view.getUint16(pos+26,true)+view.getUint16(pos+28,true);
  if(start+entry.compressed>len)throw new Error('KMZ inválido: conteúdo truncado.');
  const payload=bytes.slice(start,start+entry.compressed);
  const unpacked=entry.method===0?payload:await rawInflate(payload,TERRITORY_LIMITS.xmlBytes);
  if(unpacked.byteLength> TERRITORY_LIMITS.xmlBytes || unpacked.byteLength !== entry.original || crc32(unpacked) !== entry.crc)
    throw new Error('KMZ inválido: tamanho ou integridade CRC do KML incorreto.');
  return {text:decoder.decode(unpacked),internalName:entry.filename};
}

export async function readTerritoryFile(file) {
  if(!file || typeof file.name!=='string' || typeof file.arrayBuffer!=='function') throw new Error('Selecione um arquivo KMZ, KML ou GeoJSON.');
  if(file.size<1 || file.size> TERRITORY_LIMITS.fileBytes) throw new Error('Arquivo vazio ou maior que 12 MB.');
  const extension=file.name.toLowerCase().split('.').pop();
  if(!['kmz','kml','geojson','json'].includes(extension))throw new Error('Formato inválido. Aceitos: KMZ, KML e GeoJSON.');
  const input=await file.arrayBuffer();
  let parsed,internalName='';
  if(extension==='kmz'){
    const kmz=await extractKmlFromKmz(input);
    parsed=parseKmlText(kmz.text);internalName=kmz.internalName;
  } else {
    if(input.byteLength > TERRITORY_LIMITS.xmlBytes) throw new Error('Arquivo geográfico excede o limite de 8 MB.');
    const text=decoder.decode(input);
    parsed=extension==='kml'?parseKmlText(text):parseGeoJsonText(text);
  }
  return {...parsed,format:extension.toUpperCase(),fileName:file.name.slice(0,120),internalName};
}
