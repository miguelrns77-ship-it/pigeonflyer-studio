const $=id=>document.getElementById(id);
const photo=$('photo'), preview=$('preview'), wrap=$('previewWrap');
photo.addEventListener('change',()=>{const f=photo.files&&photo.files[0];if(!f)return;preview.src=URL.createObjectURL(f);wrap.classList.remove('empty');});
function update(){ $('outName').textContent=($('name').value||'NOME DO POMBO').toUpperCase();const n=$('number').value.trim();$('outMeta').textContent=[n,$('year').value,$('sex').value].filter(Boolean).join(' • ');$('outOwner').textContent=$('owner').value||'';}
$('create').addEventListener('click',update);['name','number','year','sex','owner'].forEach(id=>$(id).addEventListener('input',update));update();