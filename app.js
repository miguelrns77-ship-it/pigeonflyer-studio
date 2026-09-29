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
  bgStatus.textContent='Fotografia carregada. ✓';
});

removeBg.addEventListener('click',async()=>{
  const file=photo.files&&photo.files[0];
  if(!file)return;
  removeBg.disabled=true;
  removeBg.textContent='A remover fundo…';
  bgStatus.textContent='A carregar o motor de remoção…';
  try{
    if(!window.imglyRemoveBackground){
      const mod=await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');
      window.imglyRemoveBackground=mod.removeBackground || mod.default;
    }
    const source = originalUrl || file;
    const blob=await window.imglyRemoveBackground(source,{
      model:'medium',
      device:'cpu',
      proxyToWorker:false,
      output:{format:'image/png',quality:1,type:'foreground'},
      progress:(key,current,total)=>{
        if(total>0) bgStatus.textContent='A processar… '+Math.round((current/total)*100)+'%';
      }
    });
    if(!blob || !blob.size) throw new Error('Resultado vazio');
    const cutoutUrl=URL.createObjectURL(blob);
    preview.src=cutoutUrl;
    wrap.classList.add('cutout');
    bgStatus.textContent='Fundo removido. ✓';
    removeBg.textContent='Fundo removido ✓';
  }catch(err){
    console.error('Background removal:',err);
    preview.src=originalUrl;
    wrap.classList.remove('cutout');
    const detail = (err && (err.stack || err.message || err.name)) ? String(err.stack || err.message || err.name) : String(err);
    bgStatus.textContent='ERRO TÉCNICO: '+detail;
    removeBg.textContent='Tentar remover fundo novamente';
  }finally{
    removeBg.disabled=false;
  }
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
