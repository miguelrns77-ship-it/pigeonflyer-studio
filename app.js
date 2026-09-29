const $=id=>document.getElementById(id);
const photo=$('photo'), preview=$('preview'), wrap=$('previewWrap'), removeBtn=$('removeBg'), status=$('bgStatus');
let originalFile=null, currentUrl=null, remover=null;

function displayUrl(url){
  preview.onload=()=>{ wrap.classList.remove('empty'); status.textContent='Fotografia carregada. ✓'; };
  preview.onerror=()=>{ status.textContent='Não foi possível abrir esta fotografia. Tenta outra imagem.'; };
  preview.src=url;
}

async function showFile(file){
  wrap.classList.remove('cutout');
  // Object URLs are the most reliable/efficient preview path on iPhone Safari.
  if(currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl=URL.createObjectURL(file);
  displayUrl(currentUrl);

  // Fallback if Safari cannot decode the selected format directly.
  setTimeout(()=>{
    if(!preview.complete || !preview.naturalWidth){
      const reader=new FileReader();
      reader.onload=()=>displayUrl(reader.result);
      reader.onerror=()=>{ status.textContent='Formato da fotografia não suportado. No iPhone, tenta partilhar/guardar a fotografia como JPEG e selecionar novamente.'; };
      reader.readAsDataURL(file);
    }
  },1200);
}

photo.addEventListener('change',async()=>{
  const f=photo.files&&photo.files[0];
  if(!f)return;
  originalFile=f;
  removeBtn.disabled=false;
  status.textContent='A carregar fotografia…';
  await showFile(f);
});

async function loadRemover(){
  if(remover)return remover;
  status.textContent='A preparar a remoção de fundo…';
  const mod=await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');
  remover=mod.default;
  return remover;
}

removeBtn.addEventListener('click',async()=>{
  if(!originalFile)return;
  removeBtn.disabled=true;
  removeBtn.textContent='A remover o fundo…';
  try{
    const removeBackground=await loadRemover();
    status.textContent='A remover o fundo. Na primeira vez pode demorar um pouco…';
    const result=await removeBackground(originalFile);
    if(currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl=URL.createObjectURL(result);
    preview.onload=()=>{ wrap.classList.remove('empty'); wrap.classList.add('cutout'); };
    preview.src=currentUrl;
    status.textContent='Fundo removido. ✓';
    removeBtn.textContent='Remover novamente';
  }catch(err){
    console.error(err);
    status.textContent='Não foi possível remover o fundo desta imagem. A fotografia original continua disponível.';
    removeBtn.textContent='Tentar remover fundo novamente';
  }finally{ removeBtn.disabled=false; }
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
