const $=id=>document.getElementById(id);
const photo=$('photo'), preview=$('preview'), wrap=$('previewWrap');
const removeBg=$('removeBg'), bgStatus=$('bgStatus');
let originalUrl='';

photo.addEventListener('change',()=>{
  const f=photo.files&&photo.files[0];
  if(!f)return;
  if(originalUrl) URL.revokeObjectURL(originalUrl);
  originalUrl=URL.createObjectURL(f);
  preview.src=originalUrl;
  wrap.classList.remove('empty','cutout');
  removeBg.disabled=false;
  removeBg.textContent='Isolar pombo e remover fundo';
  bgStatus.textContent='Fotografia carregada. ✓';
});

function loadScript(src){
  return new Promise((resolve,reject)=>{
    const old=document.querySelector('script[src="'+src+'"]');
    if(old){ if(old.dataset.loaded==='1') return resolve(); old.addEventListener('load',resolve,{once:true}); return; }
    const s=document.createElement('script'); s.src=src; s.async=true;
    s.onload=()=>{s.dataset.loaded='1';resolve();}; s.onerror=reject; document.head.appendChild(s);
  });
}

async function isolateBird(file){
  bgStatus.textContent='A identificar o pombo…';
  await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
  await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
  if(!window.pigeonDetector) window.pigeonDetector=await cocoSsd.load({base:'lite_mobilenet_v2'});
  const img=new Image(), url=URL.createObjectURL(file);
  await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url;});
  const predictions=await window.pigeonDetector.detect(img);
  const bird=predictions.filter(p=>p.class==='bird').sort((a,b)=>b.score-a.score)[0];
  if(!bird){URL.revokeObjectURL(url);throw new Error('Não consegui identificar automaticamente o pombo.');}
  const [x,y,w,h]=bird.bbox, margin=.08;
  const sx=Math.max(0,x-w*margin), sy=Math.max(0,y-h*margin);
  const ex=Math.min(img.naturalWidth,x+w+w*margin), ey=Math.min(img.naturalHeight,y+h+h*margin);
  const cw=ex-sx,ch=ey-sy;
  const canvas=document.createElement('canvas');
  const max=1800, scale=Math.min(1,max/Math.max(cw,ch));
  canvas.width=Math.round(cw*scale); canvas.height=Math.round(ch*scale);
  canvas.getContext('2d').drawImage(img,sx,sy,cw,ch,0,0,canvas.width,canvas.height);
  URL.revokeObjectURL(url);
  return await new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(new Error('Falha ao preparar o pombo.')),'image/png',1));
}

removeBg.addEventListener('click',async()=>{
  const file=photo.files&&photo.files[0];
  if(!file)return;
  removeBg.disabled=true;
  removeBg.textContent='A isolar o pombo…';
  try{
    const isolated=await isolateBird(file);
    bgStatus.textContent='Pombo identificado. A remover o fundo…';
    if(!window.imglyRemoveBackground){
      const mod=await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');
      window.imglyRemoveBackground=mod.removeBackground || mod.default;
    }
    const blob=await window.imglyRemoveBackground(isolated,{
      model:'medium', device:'cpu', proxyToWorker:false,
      output:{format:'image/png',quality:1,type:'foreground'},
      progress:(key,current,total)=>{if(total>0) bgStatus.textContent='A recortar o pombo… '+Math.round(current/total*100)+'%';}
    });
    if(!blob||!blob.size) throw new Error('Resultado vazio');
    preview.src=URL.createObjectURL(blob);
    wrap.classList.add('cutout');
    bgStatus.textContent='Pombo isolado e fundo removido. ✓';
    removeBg.textContent='Pombo isolado ✓';
  }catch(err){
    console.error(err);
    preview.src=originalUrl; wrap.classList.remove('cutout');
    bgStatus.textContent='Não foi possível isolar o pombo: '+(err.message||err);
    removeBg.textContent='Tentar novamente';
  }finally{removeBg.disabled=false;}
});

function update(){
  $('outName').textContent=($('name').value||'NOME DO POMBO').toUpperCase();
  const n=$('number').value.trim();
  $('outMeta').textContent=[n,$('year').value,$('sex').value].filter(Boolean).join(' • ');
  $('outOwner').textContent=$('owner').value||'';
}
$('create').addEventListener('click',update);
['name','number','year','sex','owner'].forEach(id=>$(id).addEventListener('input',update));
update();
