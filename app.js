import removeBackground from 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';

const $=id=>document.getElementById(id);
const photo=$('photo'), preview=$('preview'), wrap=$('previewWrap'), removeBtn=$('removeBg'), status=$('bgStatus');
let originalFile=null, currentUrl=null;

function showBlob(blob){
  if(currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl=URL.createObjectURL(blob);
  preview.src=currentUrl;
  wrap.classList.remove('empty');
}

photo.addEventListener('change',()=>{
  const f=photo.files&&photo.files[0];
  if(!f)return;
  originalFile=f;
  showBlob(f);
  removeBtn.disabled=false;
  status.textContent='';
});

removeBtn.addEventListener('click',async()=>{
  if(!originalFile)return;
  removeBtn.disabled=true;
  removeBtn.textContent='A remover o fundo…';
  status.textContent='Na primeira vez pode demorar um pouco. Mantém esta página aberta.';
  try{
    const result=await removeBackground(originalFile);
    showBlob(result);
    wrap.classList.add('cutout');
    status.textContent='Fundo removido. ✓';
    removeBtn.textContent='Remover novamente';
  }catch(err){
    console.error(err);
    status.textContent='Não foi possível remover o fundo nesta fotografia. Tenta novamente.';
    removeBtn.textContent='Tentar remover fundo novamente';
  }finally{
    removeBtn.disabled=false;
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