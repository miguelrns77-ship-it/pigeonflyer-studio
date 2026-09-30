const $=id=>document.getElementById(id);
const photo=$('photo'),preview=$('preview'),wrap=$('previewWrap'),removeBg=$('removeBg'),bgStatus=$('bgStatus'),marker=$('pickMarker');
const saveOriginal=$('saveOriginal'),saveCutout=$('saveCutout'),saveFlyer=$('saveFlyer'),flyerText=$('flyerText');
const eraseBtn=$('eraseBtn'),eraseTools=$('eraseTools'),brushSize=$('brushSize'),zoomSize=$('zoomSize'),undoErase=$('undoErase'),finishErase=$('finishErase'),modeErase=$('modeErase'),modeRestore=$('modeRestore');
const positionTools=$('positionTools'),pigeonSize=$('pigeonSize'),mirrorPigeon=$('mirrorPigeon'),centerPigeon=$('centerPigeon'),pigeonRotate=$('pigeonRotate'),pigeonLight=$('pigeonLight'),pigeonContrast=$('pigeonContrast'),pigeonSharp=$('pigeonSharp');
const logoUpload=$('logoUpload'),removeLogo=$('removeLogo');let logoUrl='';
logoUpload?.addEventListener('change',()=>{const f=logoUpload.files&&logoUpload.files[0];if(!f)return;if(logoUrl)URL.revokeObjectURL(logoUrl);logoUrl=URL.createObjectURL(f);removeLogo.disabled=false;bgStatus.textContent='Logótipo adicionado. ✓';});
removeLogo?.addEventListener('click',()=>{if(logoUrl)URL.revokeObjectURL(logoUrl);logoUrl='';logoUpload.value='';removeLogo.disabled=true;bgStatus.textContent='Logótipo removido.';});
let eraseCanvas=null,eraseCtx=null,originalCanvas=null,editMode='erase',erasing=false,eraseHistory=[],eraseZoom=1,panX=0,panY=0,pointers=new Map(),lastPinch=null;
let originalUrl='',cutoutUrl='',cutoutBlob=null,pick=null,restoreSourceBlob=null,restoreCrop=null,restoreCutoutBlob=null;
let pigeonX=0,pigeonY=0,pigeonScale=1,pigeonMirror=1,pigeonAngle=0,pigeonBrightness=1,pigeonContrastVal=1,pigeonSharpness=0,positionDrag=null,positionPointers=new Map(),positionPinch=null;
let selectedTemplate='premium';
document.querySelectorAll('.templateChoice').forEach(btn=>btn.addEventListener('click',()=>{
 selectedTemplate=btn.dataset.template;
 document.querySelectorAll('.templateChoice').forEach(b=>b.classList.toggle('active',b===btn));
 bgStatus.textContent='Fundo Premium azul/dourado selecionado. ✓';
}));

photo.addEventListener('change',()=>{
 const f=photo.files&&photo.files[0];if(!f)return;
 if(originalUrl)URL.revokeObjectURL(originalUrl);if(cutoutUrl)URL.revokeObjectURL(cutoutUrl);
 originalUrl=URL.createObjectURL(f);cutoutUrl='';cutoutBlob=null;restoreCutoutBlob=null;restoreCrop=null;preview.src=originalUrl;
 wrap.classList.remove('empty','cutout','picking','positioning');marker.hidden=true;pick=null;positionTools.hidden=true;pigeonX=0;pigeonY=0;pigeonScale=1;pigeonMirror=1;pigeonAngle=0;pigeonBrightness=1;pigeonContrastVal=1;pigeonSharpness=0;preview.style.transform='';preview.style.filter='';
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
 // Preserve ring, feet and toes: do not destructively post-process the AI foreground.
 // Attached perches are intentionally left for the manual Apagar/Recuperar editor.
 return blob;
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
   if(seen[p]||alphaAt(p)<30)continue;
   const comp=[];stack.push(p);seen[p]=1;
   while(stack.length){
     const q=stack.pop();comp.push(q);const qx=q%W,qy=(q/W)|0;
     const ns=[q-W,q+W,q-1,q+1];
     for(let k=0;k<4;k++){const n=ns[k];if(n<0||n>=W*H||seen[n]||alphaAt(n)<30)continue;if(k===2&&qx===0)continue;if(k===3&&qx===W-1)continue;seen[n]=1;stack.push(n);}
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

async function cropToPigeon(blob){
 const img=new Image(),url=URL.createObjectURL(blob);await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url;});
 const src=document.createElement('canvas');src.width=img.naturalWidth;src.height=img.naturalHeight;const sx=src.getContext('2d',{willReadFrequently:true});sx.drawImage(img,0,0);
 const data=sx.getImageData(0,0,src.width,src.height).data;let minX=src.width,minY=src.height,maxX=-1,maxY=-1;
 for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){if(data[(y*src.width+x)*4+3]>28){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}
 URL.revokeObjectURL(url);if(maxX<minX||maxY<minY)return {blob,crop:{x:0,y:0,w:src.width,h:src.height}};
 const bw=maxX-minX+1,bh=maxY-minY+1,pad=Math.max(18,Math.round(Math.max(bw,bh)*.045));
 const x0=Math.max(0,minX-pad),y0=Math.max(0,minY-pad),x1=Math.min(src.width,maxX+pad+1),y1=Math.min(src.height,maxY+pad+1);
 const out=document.createElement('canvas');out.width=x1-x0;out.height=y1-y0;out.getContext('2d').drawImage(src,x0,y0,out.width,out.height,0,0,out.width,out.height);
 const cropped=await new Promise((ok,no)=>out.toBlob(b=>b?ok(b):no(new Error('Falha ao ajustar o recorte.')),'image/png',1));return {blob:cropped,crop:{x:x0,y:y0,w:out.width,h:out.height}};
}

async function processPigeon(file){
 removeBg.disabled=true;removeBg.textContent='A isolar o pombo…';bgStatus.textContent='A preparar a fotografia…';
 try{
  const selected=await prepareSource(file);restoreSourceBlob=selected;restoreCrop=null;
  if(!window.imglyRemoveBackground){const mod=await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');window.imglyRemoveBackground=mod.removeBackground||mod.default;}
  const raw=await window.imglyRemoveBackground(selected,{model:'large',device:'cpu',proxyToWorker:false,output:{format:'image/png',quality:1,type:'foreground'},progress:(k,c,t)=>{if(t>0)bgStatus.textContent='A recortar… '+Math.round(c/t*100)+'%';}});
  if(!raw||!raw.size)throw new Error('Resultado vazio');
  bgStatus.textContent='A fazer limpeza automática do recorte…';
  cutoutBlob=await cleanCutout(raw);const cropped=await cropToPigeon(cutoutBlob);cutoutBlob=cropped.blob;restoreCrop=cropped.crop;
  // Keep a synchronized recovery layer from the AI foreground before aggressive cleanup.
  const rawImg=new Image(),rawUrl=URL.createObjectURL(raw);await new Promise((ok,no)=>{rawImg.onload=ok;rawImg.onerror=no;rawImg.src=rawUrl;});
  const rc=restoreCrop,restoreC=document.createElement('canvas');restoreC.width=rc.w;restoreC.height=rc.h;
  restoreC.getContext('2d').drawImage(rawImg,rc.x,rc.y,rc.w,rc.h,0,0,rc.w,rc.h);URL.revokeObjectURL(rawUrl);
  restoreCutoutBlob=await new Promise((ok,no)=>restoreC.toBlob(b=>b?ok(b):no(new Error('Falha ao preparar recuperação.')),'image/png',1));if(cutoutUrl)URL.revokeObjectURL(cutoutUrl);cutoutUrl=URL.createObjectURL(cutoutBlob);
  preview.src=cutoutUrl;wrap.classList.add('cutout');marker.hidden=true;saveCutout.disabled=false;saveFlyer.disabled=false;eraseBtn.disabled=false;
  bgStatus.textContent='Pombo isolado + limpeza automática concluída. ✓';removeBg.textContent='Selecionar novamente';pick=null;positionTools.hidden=false;wrap.classList.add('positioning');applyPigeonPosition();
 }catch(err){console.error(err);preview.src=originalUrl;wrap.classList.remove('cutout');marker.hidden=true;pick=null;bgStatus.textContent='Não foi possível concluir: '+(err.message||err);removeBg.textContent='Selecionar o pombo novamente';}
 finally{removeBg.disabled=false;}
}


async function startErase(){
 if(!cutoutUrl)return;
 const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=cutoutUrl;});
 if(eraseCanvas)eraseCanvas.remove();
 eraseCanvas=document.createElement('canvas');eraseCanvas.id='eraseCanvas';eraseCanvas.width=img.naturalWidth;eraseCanvas.height=img.naturalHeight;
 eraseCtx=eraseCanvas.getContext('2d');eraseCtx.drawImage(img,0,0);
 const oi=new Image(),restoreUrl=URL.createObjectURL(restoreCutoutBlob||restoreSourceBlob);await new Promise((ok,no)=>{oi.onload=ok;oi.onerror=no;oi.src=restoreUrl;});
 originalCanvas=document.createElement('canvas');originalCanvas.width=eraseCanvas.width;originalCanvas.height=eraseCanvas.height;
 const ox=originalCanvas.getContext('2d');ox.drawImage(oi,0,0,oi.naturalWidth,oi.naturalHeight,0,0,originalCanvas.width,originalCanvas.height);URL.revokeObjectURL(restoreUrl);
 wrap.appendChild(eraseCanvas);
 editMode='erase';modeErase.classList.add('active');modeRestore.classList.remove('active');
 preview.style.visibility='hidden';flyerText.style.display='none';wrap.classList.add('editing');eraseTools.hidden=false;eraseBtn.disabled=true;eraseHistory=[];undoErase.disabled=true;eraseZoom=1;panX=0;panY=0;pointers.clear();lastPinch=null;zoomSize.value=100;applyEraseView();bgStatus.textContent='Pode ampliar até 4×. Um dedo apaga; dois dedos deslocam e ajustam o zoom.';
 const point=e=>{
 // getBoundingClientRect already includes the canvas zoom/translation transform.
 // Map the finger directly from the visible canvas rectangle to bitmap pixels.
 const r=eraseCanvas.getBoundingClientRect();
 return{x:(e.clientX-r.left)*eraseCanvas.width/r.width,y:(e.clientY-r.top)*eraseCanvas.height/r.height};
};
 let brushLast=null;
 const stamp=(p,radius)=>{
  eraseCtx.save();
  if(editMode==='erase'){
   eraseCtx.globalCompositeOperation='destination-out';eraseCtx.beginPath();eraseCtx.arc(p.x,p.y,radius/2,0,Math.PI*2);eraseCtx.fill();
  }else{
   eraseCtx.globalCompositeOperation='source-over';eraseCtx.beginPath();eraseCtx.arc(p.x,p.y,Math.max(5,radius*.42),0,Math.PI*2);eraseCtx.clip();eraseCtx.drawImage(originalCanvas,0,0);
  }
  eraseCtx.restore();
 };
 const erase=e=>{if(!erasing||pointers.size>1)return;e.preventDefault();
  const p=point(e),r=eraseCanvas.getBoundingClientRect(),radius=Number(brushSize.value)*eraseCanvas.width/r.width;
  // Fill every point between touch events. This removes Safari's apparent brush lag,
  // and uses the same exact path for both Erase and Restore at every zoom level.
  if(brushLast){
   const d=Math.hypot(p.x-brushLast.x,p.y-brushLast.y),step=Math.max(2,radius*.18),n=Math.max(1,Math.ceil(d/step));
   for(let i=1;i<=n;i++)stamp({x:brushLast.x+(p.x-brushLast.x)*i/n,y:brushLast.y+(p.y-brushLast.y)*i/n},radius);
  }else stamp(p,radius);
  brushLast=p;
 };
 eraseCanvas.onpointerdown=e=>{eraseCanvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){eraseHistory.push(eraseCtx.getImageData(0,0,eraseCanvas.width,eraseCanvas.height));if(eraseHistory.length>12)eraseHistory.shift();undoErase.disabled=false;erasing=true;brushLast=null;erase(e);}else{erasing=false;brushLast=null;lastPinch=null;}};
 eraseCanvas.onpointermove=e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){erase(e);return;}e.preventDefault();const pts=[...pointers.values()];const dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),cx=(pts[0].x+pts[1].x)/2,cy=(pts[0].y+pts[1].y)/2;if(lastPinch){const rr=wrap.getBoundingClientRect();panX+=(cx-lastPinch.cx)/rr.width*100;panY+=(cy-lastPinch.cy)/rr.height*100;eraseZoom=Math.max(1,Math.min(4,eraseZoom*(dist/lastPinch.dist)));zoomSize.value=Math.round(eraseZoom*100);applyEraseView();}lastPinch={dist,cx,cy};};
 const end=e=>{pointers.delete(e.pointerId);erasing=false;brushLast=null;if(pointers.size<2)lastPinch=null;};eraseCanvas.onpointerup=end;eraseCanvas.onpointercancel=end;
}
function clampPan(){
 // Allow extra travel so edge defects can be brought under the finger/brush.
 const maxX=eraseZoom>1?70:0,maxY=eraseZoom>1?70:0;
 panX=Math.max(-maxX,Math.min(maxX,panX));
 panY=Math.max(-maxY,Math.min(maxY,panY));
}
function applyEraseView(){
 if(!eraseCanvas)return;
 clampPan();
 // Fit the canvas with its real aspect ratio first, then zoom it.
 // This avoids stretching the cutout to the 4:5 editor frame and keeps touch coordinates exact.
 const rr=wrap.getBoundingClientRect(),iw=eraseCanvas.width,ih=eraseCanvas.height;
 const fit=Math.min(rr.width/iw,rr.height/ih);
 eraseCanvas.style.width=(iw*fit*eraseZoom)+'px';
 eraseCanvas.style.height=(ih*fit*eraseZoom)+'px';
 eraseCanvas.style.left=(50+panX)+'%';
 eraseCanvas.style.top=(50+panY)+'%';
 eraseCanvas.style.right='auto';eraseCanvas.style.bottom='auto';
 eraseCanvas.style.transform='translate(-50%,-50%)';
}
zoomSize.addEventListener('input',()=>{eraseZoom=Number(zoomSize.value)/100;if(eraseZoom===1){panX=0;panY=0;}applyEraseView();});
modeErase.addEventListener('click',()=>{editMode='erase';modeErase.classList.add('active');modeRestore.classList.remove('active');bgStatus.textContent='Modo Apagar: passe o dedo sobre os restos.';});
modeRestore.addEventListener('click',()=>{editMode='restore';modeRestore.classList.add('active');modeErase.classList.remove('active');bgStatus.textContent='Modo Recuperar: pincel fino para recuperar apenas pequenas partes junto ao contorno do pombo.';});
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
 eraseCanvas.remove();eraseCanvas=null;eraseCtx=null;originalCanvas=null;eraseHistory=[];eraseZoom=1;panX=panY=0;pointers.clear();eraseTools.hidden=true;eraseBtn.disabled=false;positionTools.hidden=false;wrap.classList.add('positioning');applyPigeonPosition();bgStatus.textContent='Limpeza manual concluída. ✓ Agora pode posicionar e redimensionar o pombo.';
});


function applyPigeonPosition(){
 preview.style.transform='translate('+pigeonX+'%,'+pigeonY+'%) rotate('+pigeonAngle+'deg) scale('+(pigeonScale*pigeonMirror)+','+pigeonScale+')';preview.style.filter='brightness('+pigeonBrightness+') contrast('+pigeonContrastVal+')';
}
pigeonSize.addEventListener('input',()=>{pigeonScale=Number(pigeonSize.value)/100;applyPigeonPosition();});
pigeonRotate.addEventListener('input',()=>{pigeonAngle=Number(pigeonRotate.value);applyPigeonPosition();});
pigeonLight.addEventListener('input',()=>{pigeonBrightness=Number(pigeonLight.value)/100;applyPigeonPosition();});
pigeonContrast.addEventListener('input',()=>{pigeonContrastVal=Number(pigeonContrast.value)/100;applyPigeonPosition();});
pigeonSharp.addEventListener('input',()=>{pigeonSharpness=Number(pigeonSharp.value)/100;applyPigeonPosition();});
mirrorPigeon.addEventListener('click',e=>{e.preventDefault();pigeonMirror=pigeonMirror===1?-1:1;applyPigeonPosition();mirrorPigeon.textContent=pigeonMirror===-1?'↔ Espelho ativo':'↔ Virar em espelho';});
centerPigeon.addEventListener('click',()=>{pigeonX=0;pigeonY=0;pigeonScale=1;pigeonMirror=1;pigeonAngle=0;pigeonBrightness=1;pigeonContrastVal=1;pigeonSharpness=0;pigeonSize.value=100;pigeonRotate.value=0;pigeonLight.value=100;pigeonContrast.value=100;pigeonSharp.value=0;mirrorPigeon.textContent='↔ Virar em espelho';applyPigeonPosition();});
preview.addEventListener('pointerdown',e=>{
 if(!wrap.classList.contains('positioning')||eraseCanvas)return;
 e.preventDefault();preview.setPointerCapture(e.pointerId);positionPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(positionPointers.size===1)positionDrag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:pigeonX,startY:pigeonY};
 else if(positionPointers.size===2){const a=[...positionPointers.values()],r=wrap.getBoundingClientRect(),cx=(a[0].x+a[1].x)/2,cy=(a[0].y+a[1].y)/2;positionDrag=null;positionPinch={dist:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),cx,cy,scale:pigeonScale,x:pigeonX,y:pigeonY,anchorX:(cx-(r.left+r.width/2))/r.width*100-pigeonX,anchorY:(cy-(r.top+r.height/2))/r.height*100-pigeonY};}
});
preview.addEventListener('pointermove',e=>{
 if(!positionPointers.has(e.pointerId))return;e.preventDefault();positionPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 const r=wrap.getBoundingClientRect();
 if(positionPointers.size===1&&positionDrag){
  pigeonX=positionDrag.startX+(e.clientX-positionDrag.x)/r.width*100;pigeonY=positionDrag.startY+(e.clientY-positionDrag.y)/r.height*100;
 }else if(positionPointers.size===2&&positionPinch){
  const a=[...positionPointers.values()],dist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),cx=(a[0].x+a[1].x)/2,cy=(a[0].y+a[1].y)/2;
  const next=Math.max(.5,Math.min(1.6,positionPinch.scale*(dist/positionPinch.dist))),ratio=next/positionPinch.scale;
  pigeonScale=next;pigeonSize.value=Math.round(next*100);
  const fingerX=(cx-(r.left+r.width/2))/r.width*100,fingerY=(cy-(r.top+r.height/2))/r.height*100;
  pigeonX=fingerX-positionPinch.anchorX*ratio;pigeonY=fingerY-positionPinch.anchorY*ratio;
 }
 pigeonX=Math.max(-70,Math.min(70,pigeonX));pigeonY=Math.max(-70,Math.min(70,pigeonY));applyPigeonPosition();
});
const endPosition=e=>{positionPointers.delete(e.pointerId);if(positionPointers.size===0){positionDrag=null;positionPinch=null;}else if(positionPointers.size===1){const a=[...positionPointers.entries()][0];positionPinch=null;positionDrag={id:a[0],x:a[1].x,y:a[1].y,startX:pigeonX,startY:pigeonY};}};
preview.addEventListener('pointerup',endPosition);preview.addEventListener('pointercancel',endPosition);

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
 // Approved cinematic background: fixed template image, then the user's real pigeon on top.
 const bg=new Image();await new Promise((ok,no)=>{bg.onload=ok;bg.onerror=()=>no(new Error('Não foi possível carregar o fundo Premium.'));bg.src='./premium-light-approved.jpg?v=1';});x.drawImage(bg,0,0,c.width,c.height);
 // Darken the lower information zone slightly for consistent text readability.
 const lower=x.createLinearGradient(0,860,0,1350);lower.addColorStop(0,'rgba(0,0,0,0)');lower.addColorStop(1,'rgba(0,0,0,.72)');x.fillStyle=lower;x.fillRect(0,820,1080,530);
 const scale=Math.min(1240/img.naturalWidth,1240/img.naturalHeight)*pigeonScale,w=img.naturalWidth*scale,h=img.naturalHeight*scale;
 const cx=c.width/2+(pigeonX/100)*c.width,cy=25+h/2+(pigeonY/100)*c.height;
 x.save();x.translate(cx,cy);x.rotate(pigeonAngle*Math.PI/180);x.scale(pigeonMirror,1);x.filter='brightness('+pigeonBrightness+') contrast('+pigeonContrastVal+')';x.drawImage(img,-w/2,-h/2,w,h);x.filter='none';if(pigeonSharpness>0){x.globalAlpha=Math.min(.22,pigeonSharpness*.22);x.filter='contrast('+(1+pigeonSharpness*.35)+')';x.drawImage(img,-w/2-.7,-h/2,w,h);x.drawImage(img,-w/2+.7,-h/2,w,h);x.globalAlpha=1;x.filter='none';}x.restore();
 const shade=x.createLinearGradient(0,760,0,1350);shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(.48,'rgba(0,0,0,.38)');shade.addColorStop(1,'rgba(0,0,0,.94)');x.fillStyle=shade;x.fillRect(0,720,1080,630);
 // Premium information block: strong name, restrained metadata and owner signature.
 const titleG=x.createLinearGradient(70,0,590,0);titleG.addColorStop(0,'#f1c66a');titleG.addColorStop(.58,'#fff7df');titleG.addColorStop(1,'#dca84a');x.fillStyle=titleG;x.font='900 82px system-ui';x.fillText([($('name').value||'NOME DO POMBO').toUpperCase(),$('sex').value].filter(Boolean).join('  '),70,1035);
 x.fillStyle='rgba(255,255,255,.95)';x.font='700 40px system-ui';x.fillText([$('number').value.trim(),$('year').value].filter(Boolean).join('  •  '),70,1100);
 x.fillStyle='rgba(255,245,220,.84)';x.font='30px system-ui';if($('owner').value.trim())x.fillText($('owner').value.trim(),70,1160);
// Optional breeder logo in the premium top-right panel.
x.save();x.strokeStyle='rgba(235,188,92,.95)';x.lineWidth=3;x.fillStyle='rgba(3,16,32,.72)';x.beginPath();x.roundRect(760,55,260,145,22);x.fill();x.stroke();
if(logoUrl){const li=new Image();await new Promise((ok,no)=>{li.onload=ok;li.onerror=no;li.src=logoUrl;});const ls=Math.min(220/li.naturalWidth,105/li.naturalHeight);const lw=li.naturalWidth*ls,lh=li.naturalHeight*ls;x.drawImage(li,890-lw/2,127-lh/2,lw,lh);}else{x.fillStyle='rgba(244,205,125,.9)';x.font='700 23px system-ui';x.textAlign='center';x.fillText('LOGÓTIPO',890,135);x.textAlign='left';}x.restore();
 x.fillStyle='rgba(255,255,255,.42)';x.textAlign='right';x.font='600 20px system-ui';x.fillText('PIGEONFLYER STUDIO',920,1272);x.font='500 13px system-ui';x.fillText('09/2026',1010,1272);x.font='500 18px system-ui';x.fillText('Miguel Silva  +351 965851701',1010,1304);x.textAlign='left';
 return await new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error('Falha ao criar flyer.')),'image/png',1));
}
saveFlyer.addEventListener('click',async()=>{
 if(saveFlyer.disabled)return;
 saveFlyer.disabled=true;const oldText=saveFlyer.textContent;saveFlyer.textContent='A criar flyer…';bgStatus.textContent='A criar o flyer final…';
 try{
  const b=await makeFlyer();
  bgStatus.textContent='Flyer criado. A abrir opções para guardar…';
  await shareOrSave(b,'pigeonflyer.png');
  bgStatus.textContent='Flyer pronto para guardar em Fotos. ✓';
 }catch(e){
  console.error('Guardar flyer:',e);
  bgStatus.textContent='Erro ao guardar: '+(e&&e.message?e.message:String(e));
  alert('Não foi possível guardar o flyer. '+(e&&e.message?e.message:'Tente novamente.'));
 }finally{saveFlyer.disabled=false;saveFlyer.textContent=oldText;}
});

function update(){$('outName').textContent=[($('name').value||'NOME DO POMBO').toUpperCase(),$('sex').value].filter(Boolean).join('  ');const n=$('number').value.trim();$('outMeta').textContent=[n,$('year').value].filter(Boolean).join(' • ');$('outOwner').textContent=$('owner').value||'';}
$('create').addEventListener('click',update);['name','number','year','sex','owner'].forEach(id=>$(id).addEventListener('input',update));update();
