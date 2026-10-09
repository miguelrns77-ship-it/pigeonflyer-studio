const $=id=>document.getElementById(id);
const photo=$('photo'),preview=$('preview'),wrap=$('previewWrap'),removeBg=$('removeBg'),bgStatus=$('bgStatus'),marker=$('pickMarker');
const saveOriginal=$('saveOriginal'),saveCutout=$('saveCutout'),saveFlyer=$('saveFlyer'),flyerText=$('flyerText');
const eraseBtn=$('eraseBtn'),eraseTools=$('eraseTools'),brushSize=$('brushSize'),zoomSize=$('zoomSize'),undoErase=$('undoErase'),finishErase=$('finishErase'),modeErase=$('modeErase'),modeRestore=$('modeRestore');
const positionTools=$('positionTools'),pigeonSize=$('pigeonSize'),mirrorPigeon=$('mirrorPigeon'),centerPigeon=$('centerPigeon'),pigeonRotate=$('pigeonRotate'),pigeonLight=$('pigeonLight'),pigeonContrast=$('pigeonContrast'),pigeonSharp=$('pigeonSharp');
const logoUpload=$('logoUpload'),removeLogo=$('removeLogo');let logoUrl='';
logoUpload?.addEventListener('change',()=>{const f=logoUpload.files&&logoUpload.files[0];if(!f)return;if(logoUrl)URL.revokeObjectURL(logoUrl);logoUrl=URL.createObjectURL(f);removeLogo.disabled=false;bgStatus.textContent='Logótipo adicionado. ✓';syncFinalPreview();});
removeLogo?.addEventListener('click',()=>{if(logoUrl)URL.revokeObjectURL(logoUrl);logoUrl='';logoUpload.value='';removeLogo.disabled=true;bgStatus.textContent='Logótipo removido.';syncFinalPreview();});
let eraseCanvas=null,eraseCtx=null,originalCanvas=null,editMode='erase',erasing=false,eraseHistory=[],eraseZoom=1,panX=0,panY=0,pointers=new Map(),lastPinch=null;
let originalUrl='',cutoutUrl='',cutoutBlob=null,pick=null,restoreSourceBlob=null,restoreCrop=null,restoreCutoutBlob=null;
let pigeonX=0,pigeonY=0,pigeonScale=.90,pigeonMirror=1,pigeonAngle=0,pigeonBrightness=1,pigeonContrastVal=1,pigeonSharpness=0,positionDrag=null,positionPointers=new Map(),positionPinch=null;
let selectedTemplate='premium';
const finalPreviewPanel=$('finalPreviewPanel'),finalPreview=$('finalPreview'),finalPreviewBg=$('finalPreviewBg'),finalPreviewPigeon=$('finalPreviewPigeon'),finalPreviewLogo=$('finalPreviewLogo'),finalName=$('finalName'),finalMeta=$('finalMeta'),finalOwner=$('finalOwner');
function syncFinalPreview(){
 if(!finalPreviewPanel)return;const src=cutoutUrl;if(!src){finalPreviewPanel.hidden=true;return;}finalPreviewPanel.hidden=false;
 finalPreviewBg.src=selectedTemplate==='custom2'?'./IMG_1287.jpeg?v=1':'./premium-light-approved.jpg?v=1';finalPreviewPigeon.src=src;
 const r=finalPreview.getBoundingClientRect(),iw=finalPreviewPigeon.naturalWidth||1,ih=finalPreviewPigeon.naturalHeight||1,contain=Math.min((r.width*.98)/iw,(r.height*.82)/ih),sc=contain*Math.max(.72,pigeonScale/.90);
 finalPreviewPigeon.style.width=(iw*sc)+'px';finalPreviewPigeon.style.height=(ih*sc)+'px';finalPreviewPigeon.style.left=(50+pigeonX)+'%';finalPreviewPigeon.style.top=(50+pigeonY)+'%';finalPreviewPigeon.style.transform='translate(-50%,-50%) rotate('+pigeonAngle+'deg) scaleX('+pigeonMirror+')';finalPreviewPigeon.style.filter='brightness('+pigeonBrightness+') contrast('+pigeonContrastVal+')';
 finalName.textContent=(($('name').value||'NOME DO POMBO').toUpperCase())+'  '+$('sex').value;finalMeta.textContent=[$('number').value.trim(),$('year').value].filter(Boolean).join(' • ');finalOwner.textContent=$('owner').value.trim();
 if(logoUrl){finalPreviewLogo.src=logoUrl;finalPreviewLogo.hidden=false}else finalPreviewLogo.hidden=true;
}
window.addEventListener('resize',syncFinalPreview);['name','number','year','sex','owner'].forEach(id=>$(id)?.addEventListener('input',syncFinalPreview));finalPreviewPigeon?.addEventListener('load',()=>requestAnimationFrame(syncFinalPreview));
let fpDrag=null;finalPreview?.addEventListener('pointerdown',e=>{if(!cutoutUrl)return;fpDrag={x:e.clientX,y:e.clientY,px:pigeonX,py:pigeonY};finalPreview.setPointerCapture(e.pointerId);});finalPreview?.addEventListener('pointermove',e=>{if(!fpDrag)return;const r=finalPreview.getBoundingClientRect();pigeonX=fpDrag.px+(e.clientX-fpDrag.x)/r.width*100;pigeonY=fpDrag.py+(e.clientY-fpDrag.y)/r.height*100;syncFinalPreview();applyPigeonPosition();});finalPreview?.addEventListener('pointerup',()=>fpDrag=null);

document.querySelectorAll('.templateChoice').forEach(btn=>btn.addEventListener('click',()=>{
 selectedTemplate=btn.dataset.template;
 document.querySelectorAll('.templateChoice').forEach(b=>b.classList.toggle('active',b===btn));
 bgStatus.textContent=(selectedTemplate==='custom2'?'Novo fundo':'Premium claro')+' selecionado. ✓';syncFinalPreview();
}));

photo.addEventListener('change',()=>{
 const f=photo.files&&photo.files[0];if(!f)return;
 if(originalUrl)URL.revokeObjectURL(originalUrl);if(cutoutUrl)URL.revokeObjectURL(cutoutUrl);
 originalUrl=URL.createObjectURL(f);cutoutUrl='';cutoutBlob=null;restoreCutoutBlob=null;restoreCrop=null;preview.src=originalUrl;
 wrap.classList.remove('empty','cutout','picking','positioning');wrap.classList.add('source-photo','picking');marker.hidden=true;pick=null;positionTools.hidden=true;pigeonX=0;pigeonY=0;pigeonScale=.90;pigeonMirror=1;pigeonAngle=0;pigeonBrightness=1;pigeonContrastVal=1;pigeonSharpness=0;preview.style.transform='';preview.style.filter='';
 removeBg.disabled=false;saveOriginal.disabled=false;saveCutout.disabled=true;saveFlyer.disabled=false;eraseBtn.disabled=true;eraseTools.hidden=true;
 removeBg.textContent='Toque no pombo na fotografia ↑';bgStatus.textContent='Fotografia completa: toque diretamente no pombo que pretende isolar.';
});

removeBg.addEventListener('click',async()=>{
 const file=photo.files&&photo.files[0];if(!file)return;
 if(!pick){wrap.classList.add('picking');marker.hidden=true;removeBg.textContent='Toque agora no centro do pombo ↑';bgStatus.textContent='Toque no corpo do pombo na fotografia.';return;}
 await processPigeon(file);
});

wrap.addEventListener('click',e=>{
 if(!wrap.classList.contains('picking')||!originalUrl)return;
 const r=wrap.getBoundingClientRect();
 // The photo is displayed with object-fit:cover; screen coordinates are NOT
 // the same as image coordinates when the aspect ratios differ.
 const iw=preview.naturalWidth,ih=preview.naturalHeight;
 if(!iw||!ih)return;
 const scale=Math.min(r.width/iw,r.height/ih);
 const dw=iw*scale,dh=ih*scale;
 const offsetX=(r.width-dw)/2,offsetY=(r.height-dh)/2;
 const imageX=((e.clientX-r.left)-offsetX)/dw;
 const imageY=((e.clientY-r.top)-offsetY)/dh;
 pick={x:Math.min(.999,Math.max(.001,imageX)),y:Math.min(.999,Math.max(.001,imageY))};
 marker.style.left=((offsetX+pick.x*dw)/r.width*100)+'%';marker.style.top=((offsetY+pick.y*dh)/r.height*100)+'%';marker.hidden=false;wrap.classList.remove('picking');
 removeBg.textContent='Isolar este pombo e remover fundo';bgStatus.textContent='Pombo assinalado. O removedor atual ainda pode incluir madeira ou outras aves; confirme o resultado antes de guardar.';
});

async function prepareSource(file){
 const img=new Image(),url=URL.createObjectURL(file);await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url;});
 const max=1200,s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');
 canvas.width=Math.round(img.naturalWidth*s);canvas.height=Math.round(img.naturalHeight*s);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);
 return await new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(new Error('Falha ao preparar imagem.')),'image/png',1));
}

// Focus on the bird the user tapped before background removal.
// A generous region preserves the complete bird while excluding distant birds.
async function focusSelectedBird(blob,point){
 if(!point)return blob;
 const img=new Image(),url=URL.createObjectURL(blob);
 try{
  await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url;});
  const W=img.naturalWidth,H=img.naturalHeight;
  const top=Math.max(0,Math.round((point.y-.235)*H));
  const bottom=point.y>.7?Math.round(H*1.12):Math.min(H,Math.round((point.y+.235)*H));
  if(bottom-top< H*.35)return blob;
  const c=document.createElement('canvas');c.width=W;c.height=bottom-top;
  c.getContext('2d').drawImage(img,0,top,W,H-top,0,0,W,H-top);
  return await new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error('Falha na seleção')),'image/png',1));
 }finally{URL.revokeObjectURL(url);}
}
let semanticSegmenterPromise=null;
async function getSemanticSegmenter(){
 if(!semanticSegmenterPromise){
  semanticSegmenterPromise=(async()=>{
   const hf=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm');
   hf.env.allowLocalModels=false;
   return await hf.pipeline('image-segmentation','Xenova/segformer-b0-finetuned-ade-512-512',{dtype:'q8'});
  })();
 }
 return semanticSegmenterPromise;
}

async function getAnimalSemanticMask(sourceBlob){
 const segmenter=await getSemanticSegmenter();
 const url=URL.createObjectURL(sourceBlob);
 try{
  const out=await segmenter(url);
  const animal=Array.isArray(out)?out.find(x=>String(x.label||'').toLowerCase()==='animal'):null;
  if(!animal?.mask?.data)return null;
  return {data:animal.mask.data,width:animal.mask.width,height:animal.mask.height,channels:animal.mask.channels||1};
 }finally{URL.revokeObjectURL(url);}
}

async function cleanCutout(blob,sourceBlob,semantic=null){
 // Hybrid isolation: IMG.LY preserves high-resolution feather/leg/ring edges.
 // SegFormer supplies a semantic "animal" prior so a wooden perch touching the feet
 // is no longer automatically treated as part of the pigeon.
 const img=new Image(),url=URL.createObjectURL(blob);
 await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url;});
 const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);URL.revokeObjectURL(url);
 const im=ctx.getImageData(0,0,c.width,c.height),d=im.data,w=c.width,h=c.height;
 const fg=new Uint8Array(w*h);
 for(let i=0;i<w*h;i++)fg[i]=d[i*4+3]>24?1:0;

 let seedX=Math.max(0,Math.min(w-1,Math.round((pick?.x??.5)*(w-1))));
 let seedY=Math.max(0,Math.min(h-1,Math.round((pick?.y??.5)*(h-1))));

 // Mobile-safe path: keep IMG.LY's high-resolution foreground as the source of truth.
 // Do not load the additional SegFormer model here: on iPhone Safari, holding both
 // models plus their image buffers can exceed the tab memory limit and repeatedly crash the page.

 const mask=new Uint8Array(w*h);
 // Preserve the complete high-resolution foreground returned by IMG.LY.
 // The semantic model is intentionally NOT allowed to clip the silhouette:
 // on side-view pigeons its coarse animal mask can miss the tail/wing tips.
 // Semantic data remains advisory only; removing perch/background must never
 // cost real pigeon anatomy (head, body, wings, tail, legs or ring).
 for(let i=0;i<w*h;i++)mask[i]=fg[i];

 // If the exact tap is transparent, locate the nearest retained foreground pixel.
 if(!mask[seedY*w+seedX]){
  let best=-1,bestD=Infinity,step=Math.max(1,Math.floor(Math.min(w,h)/180));
  for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step)if(mask[y*w+x]){
   const dx=x-seedX,dy=y-seedY,dd=dx*dx+dy*dy;if(dd<bestD){bestD=dd;best=y*w+x;}
  }
  if(best>=0){seedX=best%w;seedY=(best/w)|0;}
 }

 // Keep only the connected object chosen by the tap.
 const keep=new Uint8Array(w*h),q=new Int32Array(w*h);let head=0,tail=0;
 const seed=seedY*w+seedX;if(mask[seed]){keep[seed]=1;q[tail++]=seed;}
 while(head<tail){
  const p=q[head++],x=p%w,y=(p/w)|0;
  if(x>0){const n=p-1;if(mask[n]&&!keep[n]){keep[n]=1;q[tail++]=n;}}
  if(x<w-1){const n=p+1;if(mask[n]&&!keep[n]){keep[n]=1;q[tail++]=n;}}
  if(y>0){const n=p-w;if(mask[n]&&!keep[n]){keep[n]=1;q[tail++]=n;}}
  if(y<h-1){const n=p+w;if(mask[n]&&!keep[n]){keep[n]=1;q[tail++]=n;}}
 }

 // Semantic animal mask is used only to reject remote non-animal material.
 // Never use it as the final silhouette: its 512px mask is too coarse for tail tips, toes and rings.
 if(semantic&&semantic.data){
  const sw=semantic.width,sh=semantic.height,sd=semantic.data;
  const semAt=(x,y)=>{
   const xx=Math.max(0,Math.min(sw-1,Math.round(x*(sw-1)/(w-1))));
   const yy=Math.max(0,Math.min(sh-1,Math.round(y*(sh-1)/(h-1))));
   const v=sd[(yy*sw+xx)*(semantic.channels||1)];
   return typeof v==='number'?(v>1?v/255:v):0;
  };
  // Protect a generous halo around semantic animal pixels so feathers/feet/ring from IMG.LY survive.
  const sem=new Uint8Array(w*h),halo=Math.max(10,Math.round(Math.min(w,h)*.025));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(semAt(x,y)>.20)sem[y*w+x]=1;
  const dilated=new Uint8Array(sem);
  for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2)if(sem[y*w+x]){
   const y0=Math.max(0,y-halo),y1=Math.min(h-1,y+halo),x0=Math.max(0,x-halo),x1=Math.min(w-1,x+halo);
   for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++)if((xx-x)*(xx-x)+(yy-y)*(yy-y)<=halo*halo)dilated[yy*w+xx]=1;
  }
  // Only remove foreground that is both outside the animal halo and well away from the tapped body.
  // This targets large wooden structures while leaving ambiguous contact pixels for manual correction.
  const safeR=Math.max(w,h)*.18,safeR2=safeR*safeR;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const p=y*w+x;if(!keep[p]||dilated[p])continue;
   const dx=x-seedX,dy=y-seedY;
   if(dx*dx+dy*dy>safeR2)keep[p]=0;
  }
 }

 // Remove background completely, but do not leave semi-transparent "ghost" areas
 // inside the selected pigeon. IMG.LY can return low alpha on patterned feathers,
 // white tail feathers, legs and ring; those pixels are real pigeon, not background.
 const solid=new Uint8Array(w*h);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const p=y*w+x;if(!keep[p])continue;
  let neighbours=0;
  for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)neighbours+=keep[(y+yy)*w+x+xx];
  if(neighbours>=7)solid[p]=1;
 }
 for(let i=0;i<w*h;i++){
  if(!keep[i])d[i*4+3]=0;
  else if(solid[i])d[i*4+3]=255;
  else if(d[i*4+3]>24)d[i*4+3]=Math.max(d[i*4+3],190);
 }
 // A second small interior pass closes tiny transparent pinholes without expanding
 // the silhouette, so the wood/background cannot grow back into the cutout.
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const p=y*w+x;if(keep[p]&&d[p*4+3]<240){
   let n=0;
   for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)if(keep[(y+yy)*w+x+xx])n++;
   if(n===9)d[p*4+3]=255;
  }
 }
 ctx.putImageData(im,0,0);
 return await new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error('Falha na limpeza do recorte.')),'image/png',1));
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


// Experimental on-device point-guided object segmentation (MediaPipe MagicTouch).
// The model runs in the browser; photographs are not uploaded to a processing API.
let openBrushAfterCutout=false;
async function confirmLocalMask(blob,channel,confidence,sourceBlob,segmenter){
 const sourceUrl=URL.createObjectURL(sourceBlob);
 const sourceImg=new Image();
 try{await new Promise((ok,no)=>{sourceImg.onload=ok;sourceImg.onerror=no;sourceImg.src=sourceUrl;});}
 catch(e){URL.revokeObjectURL(sourceUrl);throw e;}
 const canvas=document.createElement('canvas');canvas.width=sourceImg.naturalWidth;canvas.height=sourceImg.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const originalCutout=new Image(),initialUrl=URL.createObjectURL(blob);
 await new Promise((ok,no)=>{originalCutout.onload=ok;originalCutout.onerror=no;originalCutout.src=initialUrl;});
 ctx.drawImage(originalCutout,0,0,canvas.width,canvas.height);
 const initial=ctx.getImageData(0,0,canvas.width,canvas.height);
 const panel=document.createElement('section');
 panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Confirmar recorte local');
 panel.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(5,7,12,.97);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:14px;color:white;text-align:center';
 panel.innerHTML='<strong style="font-size:19px">Confirmar recorte</strong><span style="font-size:12px">Canal '+channel+' · resposta ao toque '+Math.round(confidence*100)+'% (não avalia a qualidade do recorte)</span><img data-preview alt="Recorte" style="max-width:94vw;max-height:55vh;object-fit:contain;background:repeating-conic-gradient(#aaa 0% 25%,#666 0% 50%) 50% / 20px 20px;border-radius:12px"><span data-status style="font-size:12px">Verifique se o pombo está completo e se não há madeira. A seleção automática pode falhar; não guarde um recorte incorreto.</span><div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px"><button type="button" data-exclude style="padding:10px;background:#594a2c;color:white;border-radius:10px">Excluir madeira</button><button type="button" data-brush style="padding:10px;background:#35635a;color:white;border-radius:10px">Corrigir com pincel</button><button type="button" data-undo style="padding:10px;background:#333;color:white;border-radius:10px">Desfazer</button><button type="button" data-no style="padding:10px;background:#333;color:white;border-radius:10px">Rejeitar</button><button type="button" data-yes style="padding:10px;background:#cba75c;color:#111;border-radius:10px">Usar recorte</button></div>';
 const display=panel.querySelector('[data-preview]'),status=panel.querySelector('[data-status]');
 let currentUrl=initialUrl,excludeMode=false,busy=false;
 display.src=currentUrl;document.body.appendChild(panel);
 const history=[];
 const redraw=()=>{const next=canvas.toDataURL('image/png');display.src=next;};
 const cleanup=()=>{panel.remove();URL.revokeObjectURL(sourceUrl);URL.revokeObjectURL(initialUrl);};
 return await new Promise(resolve=>{
  const finish=async ok=>{
   if(busy)return;
   if(!ok){cleanup();resolve(null);return;}
   const output=await new Promise(r=>canvas.toBlob(r,'image/png'));cleanup();resolve(output);
  };
  panel.querySelector('[data-no]').onclick=()=>finish(false);
  panel.querySelector('[data-yes]').onclick=()=>finish(true);
  panel.querySelector('[data-brush]').onclick=()=>{if(busy)return;openBrushAfterCutout=true;finish(true);};
  panel.querySelector('[data-exclude]').onclick=()=>{excludeMode=true;status.textContent='Toque numa zona de madeira que pretende excluir.';};
  panel.querySelector('[data-undo]').onclick=()=>{if(!history.length)return;ctx.putImageData(history.pop(),0,0);redraw();status.textContent='Última exclusão anulada.';};
  display.onclick=async e=>{
   if(!excludeMode||busy)return;
   excludeMode=false;busy=true;status.textContent='A analisar madeira no iPhone…';
   try{
    const rect=display.getBoundingClientRect(),w=sourceImg.naturalWidth,h=sourceImg.naturalHeight;
    const scale=Math.min(rect.width/w,rect.height/h),dw=w*scale,dh=h*scale;
    const x=((e.clientX-rect.left)-(rect.width-dw)/2)/dw;
    const y=((e.clientY-rect.top)-(rect.height-dh)/2)/dh;
    if(x<0||x>1||y<0||y>1)throw Error('Toque dentro da fotografia.');
    const result=segmenter.segment(sourceImg,{keypoint:{x,y}});
    const masks=result.confidenceMasks||[];
    if(!masks.length)throw Error('Sem máscara para este ponto.');
    const mw=masks[0].width,mh=masks[0].height,sx=Math.min(mw-1,Math.floor(x*mw)),sy=Math.min(mh-1,Math.floor(y*mh));
    const idx=sy*mw+sx,arrays=masks.map(m=>m.getAsFloat32Array());
    let selected=0;for(let k=1;k<arrays.length;k++)if(arrays[k][idx]>arrays[selected][idx])selected=k;
    const values=arrays[selected],previous=ctx.getImageData(0,0,w,h),d=previous.data;
    // Restrict the negative mask to a small connected patch around the tapped
    // piece of wood. The full MagicTouch mask can also include the bird.
    const radius=Math.max(18,Math.round(Math.min(mw,mh)*.30));
    const region=new Uint8Array(mw*mh),seen=new Uint8Array(mw*mh);
    const queue=new Int32Array(mw*mh);let front=0,back=0;
    const seed=sy*mw+sx,threshold=.72;
    if(values[seed]<threshold)throw Error('Ponto de madeira sem confiança suficiente.');
    queue[back++]=seed;seen[seed]=1;
    let overlap=0;
    while(front<back){
     const p=queue[front++],xx=p%mw,yy=(p/mw)|0;
     if(Math.hypot(xx-sx,yy-sy)>radius||values[p]<threshold)continue;
     const ox=Math.min(w-1,Math.floor((xx+.5)*w/mw)),oy=Math.min(h-1,Math.floor((yy+.5)*h/mh));
     if(d[(oy*w+ox)*4+3]<70)continue;
     region[p]=1;overlap++;
     for(const n of [xx>0?p-1:-1,xx<mw-1?p+1:-1,yy>0?p-mw:-1,yy<mh-1?p+mw:-1]){
      if(n>=0&&!seen[n]){seen[n]=1;queue[back++]=n;}
     }
    }
    if(overlap<12)throw Error('Área de madeira insuficiente; toque mais ao centro da tábua.');
    if(overlap>mw*mh*.075)throw Error('Área demasiado grande; escolha uma zona mais afastada do pombo.');
    const next=ctx.getImageData(0,0,w,h),out=next.data;
    let removed=0;
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
     const mx=Math.min(mw-1,Math.floor(xx*mw/w)),my=Math.min(mh-1,Math.floor(yy*mh/h));
     if(region[my*mw+mx]){out[(yy*w+xx)*4+3]=0;removed++;}
    }
    // Guard against an unexpectedly large removal even on high-resolution photos.
    if(removed>w*h*.085)throw Error('Remoção demasiado extensa; operação cancelada.');
    history.push(previous);ctx.putImageData(next,0,0);redraw();
    status.textContent='Zona de madeira removida. Confirme que as patas e a cauda continuam intactas.';
    result.close?.();
   }catch(err){status.textContent='Exclusão não aplicada: '+String(err.message||err);}
   finally{busy=false;}
  };
 });
}
let localInteractiveSegmenterPromise=null;
let localSegmentationError='';
async function segmentSelectedPigeonLocally(sourceBlob,point){
 if(!point)throw new Error('Selecione o pombo primeiro.');
 if(!localInteractiveSegmenterPromise){
  localInteractiveSegmenterPromise=(async()=>{
   const mp=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/+esm');
   const vision=await mp.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
   const model='https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite';
   const segmenter=await mp.InteractiveSegmenter.createFromOptions(vision,{
    baseOptions:{modelAssetPath:model,delegate:'CPU'},outputConfidenceMasks:true,outputCategoryMask:false
   });
   return {segmenter};
  })().catch(e=>{localInteractiveSegmenterPromise=null;throw e;});
 }
 const {segmenter}=await localInteractiveSegmenterPromise;
 const img=new Image(),url=URL.createObjectURL(sourceBlob);
 try{
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
  const w=img.naturalWidth,h=img.naturalHeight;
  const px=Math.min(.999,Math.max(.001,point.x)),py=Math.min(.999,Math.max(.001,point.y));
  const result=segmenter.segment(img,{keypoint:{x:px,y:py}});
  const masks=result.confidenceMasks||[];
  if(!masks.length){result.close?.();throw new Error('O modelo não devolveu máscara.');}
  const mw=masks[0].width,mh=masks[0].height;
  const candidates=masks.map(m=>m.getAsFloat32Array());
  if(!mw||!mh||candidates.some(x=>!x?.length)){result.close?.();throw new Error('Máscara local inválida.');}
  // The first confidence mask may describe background, not the selected object.
  // Select the channel that actually has highest confidence at the user's tap.
  const sx=Math.min(mw-1,Math.floor(px*mw)),sy=Math.min(mh-1,Math.floor(py*mh));
  const seedIndex=sy*mw+sx;
  let chosen=0;
  for(let k=1;k<candidates.length;k++)if(candidates[k][seedIndex]>candidates[chosen][seedIndex])chosen=k;
  const scores=candidates[chosen];
  const seedScore=scores[seedIndex];
  const binary=new Uint8Array(mw*mh),visited=new Uint8Array(mw*mh),queue=new Int32Array(mw*mh);
  let total=0;
  for(let i=0;i<binary.length;i++){if(scores[i]>.52){binary[i]=1;total++;}}
  // Reject broad background masks instead of displaying a mutilated pigeon.
  if(!binary[seedIndex]||total<binary.length*.006||total>binary.length*.38){
   result.close?.();throw new Error('Máscara não corresponde ao pombo selecionado ('+Math.round(total/binary.length*100)+'% da imagem; canal '+chosen+', toque '+seedScore.toFixed(2)+').');
  }
  // Reject suspicious selections that extend far above the tapped bird:
  // a common failure is selecting the wooden roof/perch as part of the pigeon.
  // This is a safety gate, not an automatic anatomical classifier.
  let above=0,below=0,uppermost=mh;
  const splitY=Math.max(0,Math.floor(py*mh));
  for(let yy=0;yy<mh;yy++)for(let xx=0;xx<mw;xx++){
   if(!binary[yy*mw+xx])continue;
   if(yy<splitY){above++;uppermost=Math.min(uppermost,yy);}else below++;
  }
  if(py>.58 && uppermost<py*mh-.34*mh && above>below*.65){
   result.close?.();
   throw new Error('O recorte inclui uma estrutura grande acima do pombo (possível poleiro). Experimente outra fotografia ou use o recorte alternativo e confirme antes de guardar.');
  }
  // Keep the connected region around the selected bird, rejecting distant birds.
  let head=0,tail=0;queue[tail++]=seedIndex;visited[seedIndex]=1;
  while(head<tail){
   const p=queue[head++],x=p%mw,y=(p/mw)|0;
   const neighbors=[x>0?p-1:-1,x<mw-1?p+1:-1,y>0?p-mw:-1,y<mh-1?p+mw:-1];
   for(const n of neighbors)if(n>=0&&binary[n]&&!visited[n]){visited[n]=1;queue[tail++]=n;}
  }
  if(tail<binary.length*.005){result.close?.();throw new Error('O pombo ficou fragmentado; recorte local rejeitado.');}
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
  const data=ctx.getImageData(0,0,w,h),rgba=data.data;
  for(let y=0;y<h;y++){
   const my=Math.min(mh-1,Math.floor(y*mh/h));
   for(let x=0;x<w;x++){
    const mx=Math.min(mw-1,Math.floor(x*mw/w)),mi=my*mw+mx;
    const alpha=visited[mi]?Math.max(0,Math.min(1,(scores[mi]-.45)/.20)):0;
    rgba[(y*w+x)*4+3]=Math.round(255*alpha);
   }
  }
  result.close?.();
  ctx.putImageData(data,0,0);
  // Show the actual candidate cutout before it can enter the final flyer.
  const candidate=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('Falha ao criar PNG local.')),'image/png'));
  const confirmed=await confirmLocalMask(candidate,chosen,seedScore,sourceBlob,segmenter);
  if(!confirmed)throw new Error('RECORTE_REJEITADO');
  return confirmed;
 }finally{URL.revokeObjectURL(url);}
}

async function processPigeon(file){
 removeBg.disabled=true;removeBg.textContent='A isolar o pombo…';bgStatus.textContent='A preparar a fotografia completa sem cortar cabeça, cauda ou patas…';
 try{
  let selected=await prepareSource(file);restoreSourceBlob=selected;restoreCrop=null;
  let raw=null;let usedLocal=false;localSegmentationError='';openBrushAfterCutout=false;
  try{bgStatus.textContent='A testar segmentação local por toque (MagicTouch)…';const cropped=await focusSelectedBird(selected,pick);const y0=Math.max(0,pick.y-.235),y1=pick.y>.7?1.12:Math.min(1,pick.y+.235);const croppedPoint=cropped===selected?pick:{x:pick.x,y:(pick.y-y0)/(y1-y0)};raw=await segmentSelectedPigeonLocally(cropped,croppedPoint);if(cropped!==selected){selected=cropped;restoreSourceBlob=cropped;}usedLocal=true;}
  catch(localError){if(localError?.message==='RECORTE_REJEITADO'){bgStatus.textContent='Recorte rejeitado. Toque novamente no corpo do pombo para repetir a seleção.';removeBg.textContent='Selecionar novamente';pick=null;wrap.classList.remove('picking');return;}localSegmentationError=String(localError?.message||localError).slice(0,260);console.warn('Local point segmentation unavailable',localError);bgStatus.textContent='MagicTouch falhou: '+localSegmentationError+' — a usar recorte anterior…';}
  if(!raw){
   // Restrict the generic remover to the selected bird's vertical zone.
   // Unlike MagicTouch, IMG.LY removes background globally and can retain other pigeons.
   // Rebase the original photo for recovery painting in the same cropped coordinates.
   const focused=await focusSelectedBird(selected,pick);
   if(focused!==selected){selected=focused;restoreSourceBlob=focused;}
   if(!window.imglyRemoveBackground){const mod=await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');window.imglyRemoveBackground=mod.removeBackground||mod.default;}
  raw=await window.imglyRemoveBackground(selected,{model:'large',proxyToWorker:true,output:{format:'image/png',quality:1,type:'foreground'},progress:(k,c,t)=>{if(t>0)bgStatus.textContent='Recorte de alta precisão… '+Math.round(c/t*100)+'%';}}).catch(async e=>{console.warn('High precision unavailable; reverting to medium',e);bgStatus.textContent='A usar modo compatível com iPhone…';return window.imglyRemoveBackground(selected,{model:'medium',proxyToWorker:true,output:{format:'image/png',quality:1,type:'foreground'}});});
  }
  if(!raw||!raw.size)throw new Error('Resultado vazio');
  bgStatus.textContent='A separar o pombo do poleiro…';
  // First use the high-resolution remover, then ask the lightweight semantic model
  // for an animal-only prior. This second pass is best-effort: if Safari cannot
  // load it, we safely fall back to the high-resolution cutout.
  // Keep the iPhone path stable: the extra semantic model can exhaust Safari memory
  // and make the selected photo disappear. Use the proven high-resolution cutout here.
  // Ambiguous attached perch material can still be removed with the manual correction tool.
  // Anatomy-first mode: keep IMG.LY's original high-resolution foreground untouched.
  // Do not run any extra connected-component or semantic pruning here; those passes
  // caused real tail/feet/ring pixels to be lost on difficult perch photos.
  cutoutBlob=raw;const cropped=await cropToPigeon(cutoutBlob);cutoutBlob=cropped.blob;restoreCrop=cropped.crop;
  // Recovery must come from the ORIGINAL prepared photo, not the AI cutout.
  // This lets the user paint back a real ring, toes or leg even if segmentation removed them.
  const sourceImg=new Image(),sourceUrl=URL.createObjectURL(selected);await new Promise((ok,no)=>{sourceImg.onload=ok;sourceImg.onerror=no;sourceImg.src=sourceUrl;});
  const rc=restoreCrop,restoreC=document.createElement('canvas');restoreC.width=rc.w;restoreC.height=rc.h;
  restoreC.getContext('2d').drawImage(sourceImg,rc.x,rc.y,rc.w,rc.h,0,0,rc.w,rc.h);URL.revokeObjectURL(sourceUrl);
  restoreCutoutBlob=await new Promise((ok,no)=>restoreC.toBlob(b=>b?ok(b):no(new Error('Falha ao preparar recuperação.')),'image/png',1));if(cutoutUrl)URL.revokeObjectURL(cutoutUrl);cutoutUrl=URL.createObjectURL(cutoutBlob);syncFinalPreview();
  preview.src=cutoutUrl;wrap.classList.remove('source-photo');wrap.classList.add('cutout');marker.hidden=true;finalPreviewPanel.hidden=false;requestAnimationFrame(()=>{syncFinalPreview();finalPreviewPanel.scrollIntoView({behavior:'smooth',block:'start'});});saveCutout.disabled=false;saveFlyer.disabled=false;eraseBtn.disabled=false;
  bgStatus.textContent=usedLocal?'Teste MagicTouch local concluído. Confirme cabeça, cauda, patas, anilha e ausência de madeira antes de guardar.':'Recorte anterior utilizado. Erro MagicTouch: '+(localSegmentationError||'desconhecido')+'. Confirme madeira e outras aves.';removeBg.textContent='Selecionar novamente';pick=null;positionTools.hidden=false;wrap.classList.add('positioning');applyPigeonPosition();
  if(openBrushAfterCutout){openBrushAfterCutout=false;requestAnimationFrame(()=>startErase().catch(e=>{console.error(e);bgStatus.textContent='Não foi possível abrir o pincel: '+e.message;}));}
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
 preview.style.visibility='hidden';flyerText.style.display='none';wrap.classList.add('editing');eraseTools.hidden=false;eraseBtn.disabled=true;eraseHistory=[];undoErase.disabled=true;eraseZoom=1.6;panX=0;panY=0;pointers.clear();lastPinch=null;zoomSize.value=160;brushSize.value=44;applyEraseView();bgStatus.textContent='Correção aberta a 1,6×. Um dedo apaga a madeira; dois dedos movem e ampliam até 5×.';
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
   eraseCtx.globalCompositeOperation='source-over';
   const rr=Math.max(3,radius*.24),g=eraseCtx.createRadialGradient(p.x,p.y,0,p.x,p.y,rr);
   g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.72,'rgba(0,0,0,.95)');g.addColorStop(1,'rgba(0,0,0,0)');
   eraseCtx.save();eraseCtx.beginPath();eraseCtx.arc(p.x,p.y,rr,0,Math.PI*2);eraseCtx.clip();
   const patch=document.createElement('canvas');patch.width=eraseCanvas.width;patch.height=eraseCanvas.height;
   const px=patch.getContext('2d');px.drawImage(originalCanvas,0,0);px.globalCompositeOperation='destination-in';px.fillStyle=g;px.fillRect(p.x-rr,p.y-rr,rr*2,rr*2);
   eraseCtx.drawImage(patch,0,0);eraseCtx.restore();
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
 eraseCanvas.onpointermove=e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){erase(e);return;}e.preventDefault();const pts=[...pointers.values()];const dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),cx=(pts[0].x+pts[1].x)/2,cy=(pts[0].y+pts[1].y)/2;if(lastPinch){const rr=wrap.getBoundingClientRect();panX+=(cx-lastPinch.cx)/rr.width*100;panY+=(cy-lastPinch.cy)/rr.height*100;eraseZoom=Math.max(1,Math.min(5,eraseZoom*(dist/lastPinch.dist)));zoomSize.value=Math.round(eraseZoom*100);applyEraseView();}lastPinch={dist,cx,cy};};
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
modeErase.addEventListener('click',()=>{editMode='erase';modeErase.classList.add('active');modeRestore.classList.remove('active');bgStatus.textContent='Apagar madeira: passe um dedo apenas sobre o poleiro. Pode ampliar até 5×.';});
modeRestore.addEventListener('click',()=>{editMode='restore';modeRestore.classList.add('active');modeErase.classList.remove('active');bgStatus.textContent='Modo Recuperar de precisão: repõe a fotografia original com pincel fino e borda suave. Amplie e passe apenas sobre a anilha, pata ou dedo.';});
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
 if(cutoutUrl)URL.revokeObjectURL(cutoutUrl);cutoutUrl=URL.createObjectURL(cutoutBlob);syncFinalPreview();preview.src=cutoutUrl;preview.style.visibility='visible';flyerText.style.display='';wrap.classList.remove('editing');
 eraseCanvas.remove();eraseCanvas=null;eraseCtx=null;originalCanvas=null;eraseHistory=[];eraseZoom=1;panX=panY=0;pointers.clear();eraseTools.hidden=true;eraseBtn.disabled=false;positionTools.hidden=false;wrap.classList.add('positioning');applyPigeonPosition();bgStatus.textContent='Limpeza manual concluída. ✓ Agora pode posicionar e redimensionar o pombo.';
});


function applyPigeonPosition(){
 // Preview and export use the same 4:5 coordinate system.
 // Translation is relative to the flyer frame (not to the image itself), preventing drift between preview and final PNG.
 const r=wrap.getBoundingClientRect(),dx=(pigeonX/100)*r.width,dy=(pigeonY/100)*r.height;
 preview.style.transform='translate('+dx+'px,'+dy+'px) rotate('+pigeonAngle+'deg) scale('+(pigeonScale*pigeonMirror)+','+pigeonScale+')';
 preview.style.filter='brightness('+pigeonBrightness+') contrast('+pigeonContrastVal+')';
 syncFinalPreview();
}
pigeonSize.addEventListener('input',()=>{pigeonScale=Number(pigeonSize.value)/100;applyPigeonPosition();});
pigeonRotate.addEventListener('input',()=>{pigeonAngle=Number(pigeonRotate.value);applyPigeonPosition();});
pigeonLight.addEventListener('input',()=>{pigeonBrightness=Number(pigeonLight.value)/100;applyPigeonPosition();});
pigeonContrast.addEventListener('input',()=>{pigeonContrastVal=Number(pigeonContrast.value)/100;applyPigeonPosition();});
pigeonSharp.addEventListener('input',()=>{pigeonSharpness=Number(pigeonSharp.value)/100;applyPigeonPosition();});
mirrorPigeon.addEventListener('click',e=>{e.preventDefault();pigeonMirror=pigeonMirror===1?-1:1;applyPigeonPosition();mirrorPigeon.textContent=pigeonMirror===-1?'↔ Espelho ativo':'↔ Virar em espelho';});
centerPigeon.addEventListener('click',()=>{pigeonX=0;pigeonY=0;pigeonScale=.90;pigeonMirror=1;pigeonAngle=0;pigeonBrightness=1;pigeonContrastVal=1;pigeonSharpness=0;pigeonSize.value=90;pigeonRotate.value=0;pigeonLight.value=100;pigeonContrast.value=100;pigeonSharp.value=0;mirrorPigeon.textContent='↔ Virar em espelho';applyPigeonPosition();});
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
 const bg=new Image();await new Promise((ok,no)=>{bg.onload=ok;bg.onerror=()=>no(new Error('Não foi possível carregar o fundo Premium.'));bg.src=selectedTemplate==='custom2'?'./IMG_1287.jpeg?v=1':'./premium-light-approved.jpg?v=1';});x.drawImage(bg,0,0,c.width,c.height);
 // Darken the lower information zone slightly for consistent text readability.
 const lower=x.createLinearGradient(0,860,0,1350);lower.addColorStop(0,'rgba(0,0,0,0)');lower.addColorStop(1,'rgba(0,0,0,.72)');x.fillStyle=lower;x.fillRect(0,820,1080,530);
 // Match the preview exactly: first contain the whole cutout in the 1080×1350 flyer, then apply the user's scale and translation.
 // This removes the old top-anchoring that could cut the head, tail or feet in the exported flyer.
 // Fill a generous subject zone: large commercial presence, while preserving the whole cutout.
 // 98% of flyer width / 82% of flyer height is the maximum safe subject envelope.
 const containScale=Math.min((c.width*.98)/img.naturalWidth,(c.height*.82)/img.naturalHeight);
 // Treat the 90% UI default as the commercial baseline, so the exported pigeon uses the available space.
 const exportScale=Math.max(.72,pigeonScale/.90);
 let scale=containScale*exportScale,w=img.naturalWidth*scale,h=img.naturalHeight*scale;
 const fit=Math.min(1,(c.width-36)/w,(c.height-36)/h);if(fit<1){scale*=fit;w=img.naturalWidth*scale;h=img.naturalHeight*scale;}
 let cx=c.width/2+(pigeonX/100)*c.width,cy=c.height/2+(pigeonY/100)*c.height;
 cx=Math.max(w/2+18,Math.min(c.width-w/2-18,cx));
 cy=Math.max(h/2+18,Math.min(c.height-h/2-18,cy));
 x.save();x.translate(cx,cy);x.rotate(pigeonAngle*Math.PI/180);x.scale(pigeonMirror,1);x.filter='brightness('+pigeonBrightness+') contrast('+pigeonContrastVal+')';x.drawImage(img,-w/2,-h/2,w,h);x.filter='none';if(pigeonSharpness>0){x.globalAlpha=Math.min(.22,pigeonSharpness*.22);x.filter='contrast('+(1+pigeonSharpness*.35)+')';x.drawImage(img,-w/2-.7,-h/2,w,h);x.drawImage(img,-w/2+.7,-h/2,w,h);x.globalAlpha=1;x.filter='none';}x.restore();
 const shade=x.createLinearGradient(0,760,0,1350);shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(.48,'rgba(0,0,0,.38)');shade.addColorStop(1,'rgba(0,0,0,.94)');x.fillStyle=shade;x.fillRect(0,720,1080,630);
 // Information panel: top-right, as requested.
 // Keep it compact so it does not cover the pigeon unnecessarily.
 const infoRight=1000,infoTop=105;
 x.save();x.textAlign='right';
 const titleG=x.createLinearGradient(600,0,1010,0);titleG.addColorStop(0,'#f1c66a');titleG.addColorStop(.58,'#fff7df');titleG.addColorStop(1,'#dca84a');
 x.fillStyle=titleG;x.font='900 52px system-ui';
 x.fillText([($('name').value||'NOME DO POMBO').toUpperCase(),$('sex').value].filter(Boolean).join('  '),infoRight,infoTop);
 x.fillStyle='rgba(255,255,255,.96)';x.font='700 31px system-ui';
 x.fillText([$('number').value.trim(),$('year').value].filter(Boolean).join('  •  '),infoRight,infoTop+52);
 const ownerText=$('owner').value.trim();if(ownerText){x.fillStyle='rgba(255,245,220,.96)';x.font='600 27px system-ui';x.fillText(ownerText,infoRight,infoTop+100);}
 x.restore();

 // Breeder logo: bottom-right.
 if(logoUrl){
  const li=new Image();await new Promise((ok,no)=>{li.onload=ok;li.onerror=no;li.src=logoUrl;});
  const maxW=220,maxH=125,ls=Math.min(maxW/li.naturalWidth,maxH/li.naturalHeight);
  const lw=li.naturalWidth*ls,lh=li.naturalHeight*ls;
  x.drawImage(li,1010-lw,1300-lh,lw,lh);
 }
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
