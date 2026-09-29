const $=id=>document.getElementById(id);
const photo=$('photo'),preview=$('preview'),wrap=$('previewWrap'),removeBg=$('removeBg'),bgStatus=$('bgStatus'),marker=$('pickMarker');
let originalUrl='',pick=null;

photo.addEventListener('change',()=>{
 const f=photo.files&&photo.files[0]; if(!f)return;
 if(originalUrl)URL.revokeObjectURL(originalUrl);
 originalUrl=URL.createObjectURL(f); preview.src=originalUrl;
 wrap.classList.remove('empty','cutout','picking'); marker.hidden=true; pick=null;
 removeBg.disabled=false; removeBg.textContent='Selecionar o pombo';
 bgStatus.textContent='Fotografia carregada. Toque em “Selecionar o pombo”.';
});

removeBg.addEventListener('click',async()=>{
 const file=photo.files&&photo.files[0]; if(!file)return;
 if(!pick){
   wrap.classList.add('picking'); marker.hidden=true;
   removeBg.textContent='Toque agora no centro do pombo ↑';
   bgStatus.textContent='Toque no corpo do pombo na fotografia.';
   return;
 }
 await processPigeon(file);
});

wrap.addEventListener('click',e=>{
 if(!wrap.classList.contains('picking')||!originalUrl)return;
 const r=wrap.getBoundingClientRect();
 pick={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};
 marker.style.left=(pick.x*100)+'%'; marker.style.top=(pick.y*100)+'%'; marker.hidden=false;
 wrap.classList.remove('picking');
 removeBg.textContent='Isolar este pombo e remover fundo';
 bgStatus.textContent='Pombo selecionado. ✓ Agora carregue no botão.';
});

async function cropAroundPick(file){
 const img=new Image(),url=URL.createObjectURL(file);
 await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url;});
 // preview uses object-fit:cover: map tap back to source coordinates
 const box=wrap.getBoundingClientRect(), sw=img.naturalWidth,sh=img.naturalHeight;
 const scale=Math.max(box.width/sw,box.height/sh);
 const shownW=sw*scale,shownH=sh*scale;
 const offX=(shownW-box.width)/2,offY=(shownH-box.height)/2;
 const cx=(pick.x*box.width+offX)/scale,cy=(pick.y*box.height+offY)/scale;
 // generous portrait region around selected pigeon, biased upward for head and downward for feet/tail
 // Keep almost the full source around the chosen pigeon. This avoids clipping tail/feet.
 // The tap still decides which side to favour when the source is wider than the flyer.
 let cw=sw, ch=sh;
 let sx=0, sy=0;
 sx=Math.max(0,Math.min(sw-cw,sx)); sy=Math.max(0,Math.min(sh-ch,sy));
 const canvas=document.createElement('canvas'),max=1800,s=Math.min(1,max/Math.max(cw,ch));
 canvas.width=Math.round(cw*s);canvas.height=Math.round(ch*s);
 canvas.getContext('2d').drawImage(img,sx,sy,cw,ch,0,0,canvas.width,canvas.height);
 URL.revokeObjectURL(url);
 return await new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(new Error('Falha ao preparar seleção.')),'image/png',1));
}

async function processPigeon(file){
 removeBg.disabled=true; removeBg.textContent='A isolar o pombo…'; bgStatus.textContent='A preparar a área selecionada…';
 try{
   const selected=await cropAroundPick(file);
   if(!window.imglyRemoveBackground){
     const mod=await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');
     window.imglyRemoveBackground=mod.removeBackground||mod.default;
   }
   const blob=await window.imglyRemoveBackground(selected,{model:'large',device:'cpu',proxyToWorker:false,output:{format:'image/png',quality:1,type:'foreground'},progress:(k,c,t)=>{if(t>0)bgStatus.textContent='A recortar o pombo inteiro… '+Math.round(c/t*100)+'%';}});
   if(!blob||!blob.size)throw new Error('Resultado vazio');
   preview.src=URL.createObjectURL(blob);wrap.classList.add('cutout');marker.hidden=true;
   bgStatus.textContent='Pombo isolado e fundo removido. ✓';removeBg.textContent='Selecionar novamente';
   pick=null;
 }catch(err){
   console.error(err);preview.src=originalUrl;wrap.classList.remove('cutout');marker.hidden=true;pick=null;
   bgStatus.textContent='Não foi possível concluir: '+(err.message||err);removeBg.textContent='Selecionar o pombo novamente';
 }finally{removeBg.disabled=false;}
}

function update(){
 $('outName').textContent=($('name').value||'NOME DO POMBO').toUpperCase();
 const n=$('number').value.trim();$('outMeta').textContent=[n,$('year').value,$('sex').value].filter(Boolean).join(' • ');
 $('outOwner').textContent=$('owner').value||'';
}
$('create').addEventListener('click',update);
['name','number','year','sex','owner'].forEach(id=>$(id).addEventListener('input',update));update();
