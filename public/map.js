// Mapa web de implementação própria: raster OpenStreetMap + projeção Mercator + SVG.
// Requer internet para os tiles; posições e polígonos continuam visíveis sem tiles.
const EARTH=256;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const latRad=lat=>clamp(lat,-85.05112878,85.05112878)*Math.PI/180;
function projected(lat,lon,zoom){
  const dim=EARTH*2**zoom,rad=latRad(lat);
  return {x:(lon+180)/360*dim,y:(1-Math.asinh(Math.tan(rad))/Math.PI)/2*dim};
}
function unprojected(x,y,zoom){
  const dim=EARTH*2**zoom;
  return {lon:(x/dim)*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*y/dim)))*180/Math.PI};
}
function polys(geo){return geo.type==='Polygon'?[geo.coordinates]:geo.type==='MultiPolygon'?geo.coordinates:[];}
function svgEscape(text){return String(text??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}

export class OperationMap {
  constructor(parent, options={}) {
    this.host=parent;this.options=options;this.data={zones:[],sellers:[],ctos:[]};
    this.center={lat:-2.5366,lon:-44.285};this.zoom=13;
    this.selectedPoint=options.selectedPoint||null;
    this.showZones=true;this.showSellers=true;this.showCtos=true;
    this.host.innerHTML=`<div class="map-tiles"></div><svg class="map-shapes" xmlns="http://www.w3.org/2000/svg"></svg><div class="map-markers"></div>
      <div class="map-grid"></div><div class="map-controls"><button type="button" data-map-zoom="in" title="Ampliar">+</button><button type="button" data-map-zoom="out" title="Reduzir">−</button><button type="button" data-map-zoom="home" title="Centralizar em São Luís">⌖</button></div>
      <div class="map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · tiles requerem internet</div>`;
    this.tiles=parent.querySelector('.map-tiles');this.shapes=parent.querySelector('.map-shapes');this.markers=parent.querySelector('.map-markers');
    this.handlePointerDown=this.pointerDown.bind(this);this.handlePointerMove=this.pointerMove.bind(this);this.handlePointerUp=this.pointerUp.bind(this);
    this.handleWheel=this.wheel.bind(this);
    parent.addEventListener('pointerdown',this.handlePointerDown);
    parent.addEventListener('pointermove',this.handlePointerMove);
    parent.addEventListener('pointerup',this.handlePointerUp);
    parent.addEventListener('pointercancel',this.handlePointerUp);
    parent.addEventListener('wheel',this.handleWheel,{passive:false});
    parent.querySelectorAll('[data-map-zoom]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();
      if(el.dataset.mapZoom==='home'){this.center={lat:-2.5366,lon:-44.285};this.zoom=13;this.draw();}
      else this.setZoom(this.zoom+(el.dataset.mapZoom==='in'?1:-1));
    }));
    this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(parent);
    this.draw();
  }
  destroy(){this.observer.disconnect();this.host.removeEventListener('pointerdown',this.handlePointerDown);this.host.removeEventListener('pointermove',this.handlePointerMove);this.host.removeEventListener('pointerup',this.handlePointerUp);this.host.removeEventListener('pointercancel',this.handlePointerUp);this.host.removeEventListener('wheel',this.handleWheel);}
  dims(){return {w:this.host.clientWidth||800,h:this.host.clientHeight||460};}
  toScreen(lat,lon){
    const {w,h}=this.dims(),c=projected(this.center.lat,this.center.lon,this.zoom),p=projected(lat,lon,this.zoom);
    return {x:(p.x-c.x)+w/2,y:(p.y-c.y)+h/2};
  }
  fromScreen(x,y){const {w,h}=this.dims(),c=projected(this.center.lat,this.center.lon,this.zoom);return unprojected(c.x+x-w/2,c.y+y-h/2,this.zoom);}
  setZoom(next){this.zoom=clamp(next,3,19);this.draw();}
  moveTo(lat,lon,zoom){this.center={lat,lon};if(zoom)this.zoom=zoom;this.draw();}
  updateData(data){this.data=data;this.drawOverlay();}
  selectPoint(p){this.selectedPoint=p;this.drawOverlay();}
  setLayer(key,value){this[key]=value;this.drawOverlay();}
  draw(){this.drawTiles();this.drawOverlay();}
  drawTiles(){
    const {w,h}=this.dims();if(w<1||h<1)return;
    const c=projected(this.center.lat,this.center.lon,this.zoom);
    const x0=Math.floor((c.x-w/2)/256),x1=Math.floor((c.x+w/2)/256),y0=Math.floor((c.y-h/2)/256),y1=Math.floor((c.y+h/2)/256);
    const n=2**this.zoom,keep=new Set();
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      if(y<0||y>=n)continue;
      const key=`${this.zoom}/${(x+n)%n}/${y}`;keep.add(key);
      let tile=this.tiles.querySelector(`img[data-tile="${key}"]`);
      if(!tile){tile=document.createElement('img');tile.className='map-tile';tile.dataset.tile=key;tile.alt='';tile.loading='eager';tile.draggable=false;tile.src=`https://a.tile.openstreetmap.org/${key}.png`;tile.addEventListener('error',()=>{tile.style.visibility='hidden';});this.tiles.append(tile);}
      tile.style.left=`${Math.round(x*256-c.x+w/2)}px`;tile.style.top=`${Math.round(y*256-c.y+h/2)}px`;
    }
    this.tiles.querySelectorAll('img').forEach(el=>{if(!keep.has(el.dataset.tile))el.remove();});
  }
  drawOverlay(){
    const {w,h}=this.dims();if(w<1||h<1)return;
    this.shapes.setAttribute('viewBox',`0 0 ${w} ${h}`);
    let svg='';
    if(this.showZones)for(const z of this.data.zones||[]){
      const color=/^#[0-9a-fA-F]{6}$/.test(z.color)?z.color:'#e5a749';
      for(const polygon of polys(z.geometry)){
        let d='';
        for(const ring of polygon){
          const pts=ring.map(([lon,lat])=>this.toScreen(lat,lon));
          d+=pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')+' Z ';
        }
        svg+=`<path d="${d}" fill="${color}" fill-opacity=".17" stroke="${color}" stroke-width="1.8" fill-rule="evenodd" stroke-dasharray="5 3" />`;
      }
    }
    this.shapes.innerHTML=svg;
    let markers='';
    if(this.showSellers)for(const s of this.data.sellers||[]){
      if(!s.position||!s.active)continue;
      const p=this.toScreen(s.position.lat,s.position.lon),fresh=s.position.fresh,sim=s.position.source==='SIMULADO';
      if(p.x < -45||p.x > w+45||p.y < -45||p.y>h+45)continue;
      const lastWord=s.name?.trim().split(' ').at(-1)||'V';const abbreviation=svgEscape(/^\d+$/.test(lastWord)?lastWord.slice(-2):lastWord.slice(0,1).toUpperCase());
      markers+=`<button class="geo-marker seller-marker ${fresh?'fresh':'stale'} ${sim?'sim':''}" type="button" title="${svgEscape(s.name)} • ${sim?'Simulação':fresh?'GPS recente':'GPS desatualizado'}" style="left:${p.x}px;top:${p.y}px" data-seller-id="${s.id}">${abbreviation}</button>`;
    }
    if(this.showCtos)for(const c of this.data.ctos||[]){
      const p=this.toScreen(c.lat,c.lon);if(p.x< -30||p.x>w+30||p.y< -30||p.y>h+30)continue;
      markers+=`<button class="geo-marker cto-marker ${c.ports_free>0&&c.status==='online'?'available':'unavailable'}" type="button" title="${svgEscape(c.name)} • ${c.ports_free} portas" style="left:${p.x}px;top:${p.y}px" data-cto-id="${c.id}">⌁</button>`;
    }
    if(this.selectedPoint){const p=this.toScreen(this.selectedPoint.lat,this.selectedPoint.lon);markers+=`<div class="point-pin" title="Endereço de instalação (ponto de simulação)" style="left:${p.x}px;top:${p.y}px"><span></span></div>`;}
    this.markers.innerHTML=markers;
    this.markers.querySelectorAll('[data-seller-id]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();const id=Number(el.dataset.sellerId);this.options.onSeller?.(id);}));
    this.markers.querySelectorAll('[data-cto-id]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();const id=Number(el.dataset.ctoId);this.options.onCto?.(id);}));
  }
  pointerDown(e){if(e.button!==0||e.target.closest('.map-controls')||e.target.closest('.map-marker')||e.target.closest('.geo-marker'))return;
    this.drag={x:e.clientX,y:e.clientY,lon:this.center.lon,lat:this.center.lat,moved:false};this.host.setPointerCapture(e.pointerId);
  }
  pointerMove(e){if(!this.drag)return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;
    if(Math.abs(dx)>4||Math.abs(dy)>4)this.drag.moved=true;
    if(this.drag.moved){const c=projected(this.drag.lat,this.drag.lon,this.zoom),p=unprojected(c.x-dx,c.y-dy,this.zoom);this.center={lat:p.lat,lon:p.lon};this.draw();}
  }
  pointerUp(e){if(!this.drag)return;const drag=this.drag;this.drag=null;
    if(!drag.moved){const rect=this.host.getBoundingClientRect(),pos=this.fromScreen(e.clientX-rect.left,e.clientY-rect.top);
      if(Math.abs(pos.lat)<=90&&Math.abs(pos.lon)<=180){this.selectedPoint=pos;this.drawOverlay();this.options.onPick?.(pos);}
    }
  }
  wheel(e){e.preventDefault();this.setZoom(this.zoom+(e.deltaY<0?1:-1));}
}
