// Coordenadas GeoJSON: [longitude, latitude]. Coordenadas de UI: latitude, longitude.
const validPair = ([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90;

function onSegment(point, a, b) {
  const [x,y] = point, [x1,y1] = a, [x2,y2] = b;
  const cross = (x-x1)*(y2-y1) - (y-y1)*(x2-x1);
  return Math.abs(cross) < 1e-10 && x >= Math.min(x1,x2)-1e-10 && x <= Math.max(x1,x2)+1e-10 && y >= Math.min(y1,y2)-1e-10 && y <= Math.max(y1,y2)+1e-10;
}
function inRing(point, ring) {
  let inside = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a = ring[i], b = ring[j];
    if (onSegment(point,a,b)) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) inside = !inside;
  }
  return inside;
}
function inPolygon(point, rings) {
  return rings?.length > 0 && inRing(point,rings[0]) && !rings.slice(1).some(hole => inRing(point,hole));
}
export function pointInGeometry(lat,lon,geometry) {
  const p = [lon,lat];
  if (geometry.type === 'Polygon') return inPolygon(p,geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some(rings=>inPolygon(p,rings));
  return false;
}
export function validateGeometry(geometry) {
  if (!geometry || !['Polygon','MultiPolygon'].includes(geometry.type)) throw new Error('A geometria precisa ser Polygon ou MultiPolygon.');
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let count=0;
  if (!Array.isArray(polygons) || polygons.length < 1 || polygons.length > 50) throw new Error('Geometria inválida ou muito complexa.');
  for (const rings of polygons) {
    if (!Array.isArray(rings)||!rings.length || rings.length > 100) throw new Error('Anéis de polígono inválidos.');
    for (const ring of rings) {
      if (!Array.isArray(ring)||ring.length < 4) throw new Error('Cada anel precisa ter ao menos quatro coordenadas.');
      count += ring.length;
      if (count > 12000) throw new Error('Geometria ultrapassa limite de 12 mil coordenadas.');
      for (const xy of ring) if (!Array.isArray(xy) || xy.length < 2 || !validPair(xy)) throw new Error('Coordenadas inválidas.');
      const first=ring[0], last=ring.at(-1);
      if (first[0]!==last[0] || first[1]!==last[1]) throw new Error('Cada anel deve estar fechado.');
    }
  }
  return true;
}
export function zonesAtPoint(lat,lon,zones) { return zones.filter(z=>pointInGeometry(lat,lon,z.geometry)); }
export const coordValid = (lat,lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat)<=90 && Math.abs(lon)<=180;
