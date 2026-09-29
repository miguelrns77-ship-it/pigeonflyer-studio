const $=id=>document.getElementById(id);
const photo=$('photo'), preview=$('preview'), wrap=$('previewWrap'), removeBtn=$('removeBg'), status=$('bgStatus');
let originalFile=null, currentUrl=null, remover=null;

function showFile(file){
  if(currentUrl){ URL.revokeObjectURL(currentUrl); currentUrl=null; }
  const reader=new FileReader();
  reader.onload=()=>{
    preview.onload=()=>wrap.classList.remove('empty');
    preview.onerror=()=>{ status.textContent='Não foi possível abrir esta fotografia. Tenta outra imagem.'; };
    preview.src=reader.result;
  };
  reader.onerror=()=>{ status.textContent='Não foi possível ler esta fotografia.'; };
  reader.readAsDataURL(file);
}

photo.addEventListener('change',()=>{
  const f=photo.files&&photo.files[0];
  if(!f)return;
  originalFile=f;
  wrap.classList.remove('cutout');
  status.textContent='Fotografia carregada. ✓';
  showFile(f);
  removeBtn.disabled=false;
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
    status.textContent='Não foi possível remover o fundo. A fotografia original continua disponível.';
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
