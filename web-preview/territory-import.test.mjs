import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {extractKmlFromKmz,parseGeoJsonText,readTerritoryFile,TERRITORY_LIMITS} from './territory-import.js';

function crc32(bytes){
 let c=0xffffffff;
 for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}
 return (c^0xffffffff)>>>0;
}
function kmzOf(xml,method=8){
 const raw=Buffer.from(xml,'utf8'),payload=method===8?deflateRawSync(raw):raw;
 const filename=Buffer.from('doc.kml','utf8'),crc=crc32(raw);
 const local=Buffer.alloc(30);
 local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
 local.writeUInt16LE(method,8);local.writeUInt32LE(crc,14);
 local.writeUInt32LE(payload.length,18);local.writeUInt32LE(raw.length,22);
 local.writeUInt16LE(filename.length,26);
 const central=Buffer.alloc(46);
 central.writeUInt32LE(0x02014b50,0);
 central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);
 central.writeUInt16LE(method,10);central.writeUInt32LE(crc,16);
 central.writeUInt32LE(payload.length,20);central.writeUInt32LE(raw.length,24);
 central.writeUInt16LE(filename.length,28);
 const cOffset=local.length+filename.length+payload.length;
 const end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);
 end.writeUInt32LE(central.length+filename.length,12);end.writeUInt32LE(cOffset,16);
 return Buffer.concat([local,filename,payload,central,filename,end]);
}
const kml='<?xml version="1.0" encoding="utf-8"?><kml><Document><Placemark><name>CTO Exemplo</name><Point><coordinates>-44.3,-2.54,0</coordinates></Point></Placemark></Document></kml>';
test('KMZ comprimido abre doc.kml sem biblioteca externa',async()=>{
 const result=await extractKmlFromKmz(kmzOf(kml,8));
 assert.equal(result.internalName,'doc.kml');
 assert.equal(result.text,kml);
});
test('KMZ armazenado sem compressão também funciona',async()=>{
 const result=await extractKmlFromKmz(kmzOf(kml,0));
 assert.equal(result.text,kml);
});
test('KMZ rejeita CRC incorreto, entrada truncada e ZIP vazio',async()=>{
 const bad=kmzOf(kml,0);bad[40]^=1;
 await assert.rejects(()=>extractKmlFromKmz(bad),/CRC|integridade|ZIP/);
 await assert.rejects(()=>extractKmlFromKmz(Buffer.from('outro formato')),/KMZ/);
 await assert.rejects(()=>extractKmlFromKmz(kmzOf(kml,8).subarray(0,42)),/KMZ/);
});
test('GeoJSON conserva nomes, pastas, polígonos e distingue CTO de pontos genéricos',()=>{
 const parsed=parseGeoJsonText(JSON.stringify({type:'FeatureCollection',features:[
  {type:'Feature',properties:{name:'Área Azul',folder:'Regional / Norte'},geometry:{type:'Polygon',coordinates:[[[-44.35,-2.57],[-44.27,-2.57],[-44.27,-2.52],[-44.35,-2.52]]]}}},
  {type:'Feature',properties:{name:'CTO 010',folder:'Rede'},geometry:{type:'Point',coordinates:[-44.31,-2.54]}},
  {type:'Feature',properties:{name:'Referência da Quadra',folder:'Locais'},geometry:{type:'Point',coordinates:[-44.30,-2.55]}},
  {type:'Feature',properties:{name:'Linha de referência'},geometry:{type:'LineString',coordinates:[[-44.30,-2.55],[-44.29,-2.54]]}}
 ]}));
 assert.equal(parsed.polygons.length,1);
 assert.equal(parsed.points.length,2);
 assert.equal(parsed.ctoCandidates,1);
 assert.equal(parsed.ignored,1);
 assert.equal(parsed.polygons[0].geometry.coordinates[0].length,5);
 assert.ok(parsed.folders.includes('Regional / Norte'));
});
test('GeoJSON falha com geometria inválida e arquivo sem elementos suportados',()=>{
 assert.throws(()=>parseGeoJsonText(JSON.stringify({type:'Polygon',coordinates:[[[-200,-2],[-44,-2],[-44,-3]]]})),/Coordenada/);
 assert.throws(()=>parseGeoJsonText(JSON.stringify({type:'FeatureCollection',features:[]})),/sem polígonos/);
});
test('upload restringe formato e tamanho antes de ler conteúdo',async()=>{
 const fake=(name,size)=>({name,size,arrayBuffer:async()=>Buffer.from('{}')});
 await assert.rejects(()=>readTerritoryFile(fake('secreto.exe',100)),/Formato inválido/);
 await assert.rejects(()=>readTerritoryFile(fake('mapa.kmz',TERRITORY_LIMITS.fileBytes+1)),/12 MB/);
});
