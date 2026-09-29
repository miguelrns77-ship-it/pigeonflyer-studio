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
  if(!photo.files||!photo.files[0]) return;
  removeBg.disabled=true;
  removeBg.textContent='A remover fundo…';
  bgStatus.textContent='A preparar a remoção automática no iPhone…';
  try{
    if(!window.imglyRemoveBackground){
      bgStatus.textContent='A carregar o motor de remoção pela primeira vez…';
      const mod=await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');
      window.imglyRemoveBackground=mod.removeBackground;
    }
    const blob=await window.imglyRemoveBackground(photo.files[0],{
      progress:(key,current,total)=>{
        if(total) bgStatus.textContent='A processar… '+Math.round(current/total*100)+'%';
      }
    });
    const cutoutUrl=URL.createObjectURL(blob);
    preview.src=cutoutUrl;
    wrap.classList.add('cutout');
    bgStatus.textContent='Fundo removido. ✓';
  }catch(err){
    console.error(err);
    bgStatus.textContent='Não foi possível remover o fundo neste dispositivo. A fotografia original foi mantida.';
    preview.src=originalUrl;
    wrap.classList.remove('cutout');
  }finally{
    removeBg.disabled=false;
    removeBg.textContent='Remover fundo automaticamente';
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
