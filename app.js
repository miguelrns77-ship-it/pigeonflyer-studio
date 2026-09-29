const $=id=>document.getElementById(id);
const photo=$('photo'),preview=$('preview'),wrap=$('previewWrap'),removeBg=$('removeBg'),bgStatus=$('bgStatus'),marker=$('pickMarker');
const saveOriginal=$('saveOriginal'),saveCutout=$('saveCutout'),saveFlyer=$('saveFlyer'),flyerText=$('flyerText');
const eraseBtn=$('eraseBtn'),eraseTools=$('eraseTools'),brushSize=$('brushSize'),zoomSize=$('zoomSize'),undoErase=$('undoErase'),finishErase=$('finishErase'),modeErase=$('modeErase'),modeRestore=$('modeRestore');
let eraseCanvas=null,eraseCtx=null,originalCanvas=null,editMode='erase',erasing=false,eraseHistory=[],eraseZoom=1,panX=0,panY=0,pointers=new Map(),lastPinch=null;
let originalUrl='',cutoutUrl='',cutoutBlob=null,pick=null;

photo.addEventListener('change',()=>{
 const f=photo.files&&photo.files[0];if(!f)return;
 if(originalUrl)URL.revokeObjectURL(originalUrl);if(cutoutUrl)URL.revokeObjectURL(cutoutUrl);
 originalUrl=URL.createObjectURL(f);cutoutUrl='';cutoutBlob=null;preview.src=originalUrl;
 wrap.classList.remove('empty','cutout','picking');marker.hidden=true;pick=null;
 removeBg.disabled=false;saveOriginal.disabled=false;saveCutout.disabled=true;saveFlyer.disabled=false;eraseBtn.disabled=true;eraseTools.hidden=true;
 removeBg.textContent='Selecionar o pombo';bgStatus.textContent='Fotografia carregada. Toque em “Selecionar o pombo”.';
});

removeBg.addEventListener('click',async()=>{
 const file=photo.files&&photo.files[0];if(!file)return;
 if(!pick){wrap.classList.add('picking');marker.hidden=true;removeBg.textContent='Toque agora no centro do pombo ↑';bgStatus.textContent='Toque no corpo do pombo na fotografia.';return;}
 await processPigeon(file);
});

wrap.addEventListener('click',e=>{
 if(!wrap.classList.contains('picking')||!originalUrl)return;
 const r=wrap.getBoundingClientRect();pick={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};
 marker.style.left=(pick.x*100)+'%';marker.style.top=(pick.y*100)+'%';marker.hidden=false;wrap.classList.remove('picking');
 removeBg.textContent='Isolar este pombo e remover fundo';bgStatus.textContent='Pombo selecionado. ✓ Agora carregue no botão.';
});

async function prepareSource(file){
 const img=new Image(),url=URL.createObjectURL(file);await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url;});
 const max=1800,s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');
 canvas.width=Math.round(img.naturalWidth*s);canvas.height=Math.round(img.naturalHeight*s);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);
 return await new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(new Error('Falha ao preparar imagem.')),'image/png',1));
}

async function cleanCutout(blob){
 const img=new Image(),url=URL.createObjectURL(blob);await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url;});
 const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);
 const im=x.getImageData(0,0,c.width,c.height),d=im.data;
 // Clean weak background residue while strengthening real semi-transparent feather/leg edges.
 for(let i=3;i<d.length;i+=4){
   const a=d[i];
   // Remove weak "ghost" residue more firmly, but keep confident feather/leg pixels.
   if(a<38)d[i]=0;
   else if(a<82)d[i]=Math.round((a-38)/44*58);
   else if(a<145)d[i]=Math.min(220,Math.round(a*1.12));
   else d[i]=Math.min(255,Math.round(255*Math.pow(a/255,.78)));
 }
 // Keep only alpha components connected to the main pigeon. This removes detached/weak ghost islands.
 const W=c.width,H=c.height,seen=new Uint8Array(W*H),stack=[],components=[];
 const alphaAt=p=>d[p*4+3];
 for(let p=0;p<W*H;p++){
   if(seen[p]||alphaAt(p)<48)continue;
   const comp=[];stack.push(p);seen[p]=1;
   while(stack.length){
     const q=stack.pop();comp.push(q);const qx=q%W,qy=(q/W)|0;
     const ns=[q-W,q+W,q-1,q+1];
     for(let k=0;k<4;k++){const n=ns[k];if(n<0||n>=W*H||seen[n]||alphaAt(n)<48)continue;if(k===2&&qx===0)continue;if(k===3&&qx===W-1)continue;seen[n]=1;stack.push(n);}
   }
   components.push(comp);
 }
 components.sort((a,b)=>b.length-a.length);
 if(components.length){
   const keep=new Uint8Array(W*H);for(const p of components[0])keep[p]=1;
   // Preserve soft antialias pixels only when close to the retained pigeon.
   for(let y=1;y<H-1;y++)for(let x0=1;x0<W-1;x0++){const p=y*W+x0;if(keep[p])continue;
     if(d[p*4+3]===0)continue;
     let near=false;for(let yy=-1;yy<=1&&!near;yy++)for(let xx=-1;xx<=1;xx++)if(keep[(y+yy)*W+x0+xx]){near=true;break;}
     if(!near)d[p*4+3]=0;
   }
 }
 x.putImageData(im,0,0);URL.revokeObjectURL(url);
 return await new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error('Falha na limpeza automática.')),'image/png',1));
}

async function processPigeon(file){
 removeBg.disabled=true;removeBg.textContent='A isolar o pombo…';bgStatus.textContent='A preparar a fotografia…';
 try{
  const selected=await prepareSource(file);
  if(!window.imglyRemoveBackground){const mod=await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');window.imglyRemoveBackground=mod.removeBackground||mod.default;}
  const raw=await window.imglyRemoveBackground(selected,{model:'large',device:'cpu',proxyToWorker:false,output:{format:'image/png',quality:1,type:'foreground'},progress:(k,c,t)=>{if(t>0)bgStatus.textContent='A recortar… '+Math.round(c/t*100)+'%';}});
  if(!raw||!raw.size)throw new Error('Resultado vazio');
  bgStatus.textContent='A fazer limpeza automática do recorte…';
  cutoutBlob=await cleanCutout(raw);if(cutoutUrl)URL.revokeObjectURL(cutoutUrl);cutoutUrl=URL.createObjectURL(cutoutBlob);
  preview.src=cutoutUrl;wrap.classList.add('cutout');marker.hidden=true;saveCutout.disabled=false;saveFlyer.disabled=false;eraseBtn.disabled=false;
  bgStatus.textContent='Pombo isolado + limpeza automática concluída. ✓';removeBg.textContent='Selecionar novamente';pick=null;
 }catch(err){console.error(err);preview.src=originalUrl;wrap.classList.remove('cutout');marker.hidden=true;pick=null;bgStatus.textContent='Não foi possível concluir: '+(err.message||err);removeBg.textContent='Selecionar o pombo novamente';}
 finally{removeBg.disabled=false;}
}


async function startErase(){
 if(!cutoutUrl)return;
 const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=cutoutUrl;});
 if(eraseCanvas)eraseCanvas.remove();
 eraseCanvas=document.createElement('canvas');eraseCanvas.id='eraseCanvas';eraseCanvas.width=img.naturalWidth;eraseCanvas.height=img.naturalHeight;
 eraseCtx=eraseCanvas.getContext('2d');eraseCtx.drawImage(img,0,0);
 const oi=new Image();await new Promise((ok,no)=>{oi.onload=ok;oi.onerror=no;oi.src=originalUrl;});
 originalCanvas=document.createElement('canvas');originalCanvas.width=eraseCanvas.width;originalCanvas.height=eraseCanvas.height;
 const ox=originalCanvas.getContext('2d');ox.drawImage(oi,0,0,originalCanvas.width,originalCanvas.height);
 wrap.appendChild(eraseCanvas);
 editMode='erase';modeErase.classList.add('active');modeRestore.classList.remove('active');
 preview.style.visibility='hidden';flyerText.style.display='none';wrap.classList.add('editing');eraseTools.hidden=false;eraseBtn.disabled=true;eraseHistory=[];undoErase.disabled=true;eraseZoom=1;panX=0;panY=0;pointers.clear();lastPinch=null;zoomSize.value=100;applyEraseView();bgStatus.textContent='Pode ampliar até 4×. Um dedo apaga; dois dedos deslocam e ajustam o zoom.';
 const point=e=>{const r=eraseCanvas.getBoundingClientRect();return{x:(e.clientX-r.left)*eraseCanvas.width/r.width,y:(e.clientY-r.top)*eraseCanvas.height/r.height};};
 const erase=e=>{if(!erasing||pointers.size>1)return;e.preventDefault();const p=point(e),radius=Number(brushSize.value)*eraseCanvas.width/eraseCanvas.getBoundingClientRect().width;eraseCtx.save();
 if(editMode==='erase'){eraseCtx.globalCompositeOperation='destination-out';eraseCtx.beginPath();eraseCtx.arc(p.x,p.y,radius/2,0,Math.PI*2);eraseCtx.fill();}
 else{eraseCtx.globalCompositeOperation='source-over';eraseCtx.beginPath();eraseCtx.arc(p.x,p.y,radius/2,0,Math.PI*2);eraseCtx.clip();eraseCtx.drawImage(originalCanvas,0,0);}
 eraseCtx.restore();};
 eraseCanvas.onpointerdown=e=>{eraseCanvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){eraseHistory.push(eraseCtx.getImageData(0,0,eraseCanvas.width,eraseCanvas.height));if(eraseHistory.length>12)eraseHistory.shift();undoErase.disabled=false;erasing=true;erase(e);}else{erasing=false;lastPinch=null;}};
 eraseCanvas.onpointermove=e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){erase(e);return;}e.preventDefault();const pts=[...pointers.values()];const dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),cx=(pts[0].x+pts[1].x)/2,cy=(pts[0].y+pts[1].y)/2;if(lastPinch){const rr=wrap.getBoundingClientRect();panX+=(cx-lastPinch.cx)/rr.width*100;panY+=(cy-lastPinch.cy)/rr.height*100;eraseZoom=Math.max(1,Math.min(4,eraseZoom*(dist/lastPinch.dist)));zoomSize.value=Math.round(eraseZoom*100);applyEraseView();}lastPinch={dist,cx,cy};};
 const end=e=>{pointers.delete(e.pointerId);erasing=false;if(pointers.size<2)lastPinch=null;};eraseCanvas.onpointerup=end;eraseCanvas.onpointercancel=end;
}
function clampPan(){
 const max=50*(eraseZoom-1)/eraseZoom;
 panX=Math.max(-max,Math.min(max,panX));
 panY=Math.max(-max,Math.min(max,panY));
}
function applyEraseView(){
 if(!eraseCanvas)return;
 clampPan();
 eraseCanvas.style.width=(eraseZoom*100)+'%';
 eraseCanvas.style.height=(eraseZoom*100)+'%';
 eraseCanvas.style.left=(50+panX)+'%';
 eraseCanvas.style.top=(50+panY)+'%';
 eraseCanvas.style.right='auto';eraseCanvas.style.bottom='auto';
 eraseCanvas.style.transform='translate(-50%,-50%)';
}
zoomSize.addEventListener('input',()=>{eraseZoom=Number(zoomSize.value)/100;if(eraseZoom===1){panX=0;panY=0;}applyEraseView();});
modeErase.addEventListener('click',()=>{editMode='erase';modeErase.classList.add('active');modeRestore.classList.remove('active');bgStatus.textContent='Modo Apagar: passe o dedo sobre os restos.';});
modeRestore.addEventListener('click',()=>{editMode='restore';modeRestore.classList.add('active');modeErase.classList.remove('active');bgStatus.textContent='Modo Recuperar: passe o dedo sobre a parte do pombo que foi cortada.';});
eraseBtn.addEventListener('click',startErase);
undoErase.addEventListener('click',()=>{
 if(!eraseCanvas||!eraseHistory.length)return;
 eraseCtx.putImageData(eraseHistory.pop(),0,0);
 undoErase.disabled=eraseHistory.length===0;
 bgStatus.textContent='Último apagamento anulado. ✓';
});
finishErase.addEventListener('click',async()=>{
 if(!eraseCanvas)return;
 cutoutBlob=await new Promise((ok,no)=>eraseCanvas.toBlob(b=>b?ok(b):no(new Error('Falha ao guardar limpeza.')),'image/png',1));
 if(cutoutUrl)URL.revokeObjectURL(cutoutUrl);cutoutUrl=URL.createObjectURL(cutoutBlob);preview.src=cutoutUrl;preview.style.visibility='visible';flyerText.style.display='';wrap.classList.remove('editing');
 eraseCanvas.remove();eraseCanvas=null;eraseCtx=null;originalCanvas=null;eraseHistory=[];eraseZoom=1;panX=panY=0;pointers.clear();eraseTools.hidden=true;eraseBtn.disabled=false;bgStatus.textContent='Limpeza manual concluída. ✓';
});

async function shareOrSave(blob,name){
 const file=new File([blob],name,{type:blob.type||'image/png'});
 if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:name});return;}catch(e){if(e.name==='AbortError')return;}}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
saveOriginal.addEventListener('click',()=>{const f=photo.files&&photo.files[0];if(f)shareOrSave(f,'pombo-original.'+(f.name.split('.').pop()||'jpg'));});
saveCutout.addEventListener('click',()=>{if(cutoutBlob)shareOrSave(cutoutBlob,'pombo-sem-fundo.png');});

async function makeFlyer(){
 const src=cutoutUrl||originalUrl;if(!src)throw new Error('Adicione uma fotografia primeiro.');
 const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=src;});
 const c=document.createElement('canvas');c.width=1080;c.height=1350;const x=c.getContext('2d');
 const g=x.createLinearGradient(0,0,0,c.height);g.addColorStop(0,'#202733');g.addColorStop(1,'#080a0e');x.fillStyle=g;x.fillRect(0,0,c.width,c.height);
 const scale=Math.min(900/img.naturalWidth,900/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;x.drawImage(img,(c.width-w)/2,70,w,h);
 const shade=x.createLinearGradient(0,800,0,1350);shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(0,0,0,.92)');x.fillStyle=shade;x.fillRect(0,760,1080,590);
 x.fillStyle='white';x.font='bold 66px system-ui';x.fillText(($('name').value||'NOME DO POMBO').toUpperCase(),70,1110);
 x.font='bold 38px system-ui';x.fillText([$('number').value.trim(),$('year').value,$('sex').value].filter(Boolean).join(' • '),70,1170);
 x.font='32px system-ui';x.fillText($('owner').value||'',70,1225);
 return await new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error('Falha ao criar flyer.')),'image/png',1));
}
saveFlyer.addEventListener('click',async()=>{try{bgStatus.textContent='A criar o flyer final…';const b=await makeFlyer();await shareOrSave(b,'pigeonflyer.png');bgStatus.textContent='Flyer pronto para guardar em Fotos. ✓';}catch(e){bgStatus.textContent=e.message||e;}});

function update(){$('outName').textContent=($('name').value||'NOME DO POMBO').toUpperCase();const n=$('number').value.trim();$('outMeta').textContent=[n,$('year').value,$('sex').value].filter(Boolean).join(' • ');$('outOwner').textContent=$('owner').value||'';}
$('create').addEventListener('click',update);['name','number','year','sex','owner'].forEach(id=>$(id).addEventListener('input',update));update();
