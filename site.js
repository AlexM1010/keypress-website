document.getElementById('export-flow').addEventListener('click', () => {
  const status = document.getElementById('export-status');
  try {
    const projects = JSON.parse(localStorage.getItem('keypress-browser-tour-projects-v1') || '[]');
    const id = localStorage.getItem('keypress-browser-tour-last-project');
    const project = projects.find(item => item.id === id);
    if (!project) { status.textContent = 'Name your macro and save it in the editor first.'; return; }
    const {modifiedAt, subflow, ...flow} = project;
    const url = URL.createObjectURL(new Blob([JSON.stringify(flow, null, 2)], {type: 'application/json'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = (project.name.replace(/[^a-z0-9 -]/gi, '').trim() || 'flow') + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Saved flow downloaded. Check it in Keypress before running.';
  } catch { status.textContent = 'Browser storage is unavailable. Allow storage to save and download a flow.'; }
});

const editor=document.getElementById('tour-editor'), panel=document.getElementById('tour-panel');
const status=document.getElementById('tour-status'), progress=document.getElementById('tour-progress');
const stop=document.getElementById('tour-stop'), dismiss=document.getElementById('tour-dismiss');
const fields={'Task output':document.getElementById('task-output'),'Reply recipient':document.getElementById('reply-recipient'),'Reply subject':document.getElementById('reply-subject'),'Reply message':document.getElementById('task-output')};
const taskArea=document.getElementById('automation-lab');
const draftPreview=document.getElementById('draft-preview');
const taskState=document.getElementById('task-state'), taskLog=document.getElementById('task-log');
let running=false, hostRun=new AbortController();
const send=type=>editor.contentWindow.postMessage({channel:'keypress-tour',type},location.origin);
function end(message){
 running=false;hostRun.abort();status.textContent=message;stop.hidden=true;dismiss.hidden=false;
 document.querySelectorAll('.tour-highlight').forEach(el=>el.classList.remove('tour-highlight'));
}
function navigate(section){
 const target=document.getElementById(section);
 document.querySelectorAll('.tour-highlight').forEach(el=>el.classList.remove('tour-highlight'));
 target.classList.add('tour-highlight');
 target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
function resetTask(){
 for(const name of ['Reply recipient','Reply subject','Reply message'])fields[name].value='';
 draftPreview.hidden=true;
 taskState.textContent='Ready to draft';taskState.dataset.state='idle';
 taskLog.textContent='Task reset. Ready for your next run.';
}
document.getElementById('task-reset').addEventListener('click',resetTask);
function draftError(){
 if(!fields['Reply recipient'].value.trim()||!fields['Reply recipient'].checkValidity())return 'Add a valid recipient before saving the draft.';
 if(!fields['Reply subject'].value.trim()||!fields['Reply message'].value.trim())return 'Fill the subject and message before saving the draft.';
}
document.getElementById('reply-save').addEventListener('click',()=>{
 const error=draftError();if(error){taskState.textContent='Draft incomplete';taskLog.textContent=error;return;}
 document.getElementById('draft-recipient').textContent=fields['Reply recipient'].value;
 document.getElementById('draft-subject').textContent=fields['Reply subject'].value;
 document.getElementById('draft-message').textContent=fields['Reply message'].value;
 draftPreview.hidden=false;taskState.textContent='Draft saved';taskState.dataset.state='ready';
 taskLog.textContent='The fields are filled and the draft is ready for review. Nothing has been sent.';
 draftPreview.closest('.lab-result').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
});
for(const name of ['Reply recipient','Reply subject','Reply message'])fields[name].addEventListener('input',()=>{
 if(!running){draftPreview.hidden=true;taskState.textContent='Unsaved changes';taskState.dataset.state='idle';}
});
function pause(ms,signal){return new Promise((resolve,reject)=>{
 const abort=()=>{clearTimeout(timer);reject(signal.reason);};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
 signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
});}
async function act(action,signal){
 signal.throwIfAborted();
 if(action.kind==='click'){
  const button=[...document.querySelectorAll('[data-demo-click],[data-tour-target]')].find(el=>el.getAttribute('aria-label')===action.name||el.dataset.demoClick===action.name);
  if(!button)throw new Error('This browser flow can only click named targets on this page.');
  if(action.name==='Save draft'){const error=draftError();if(error)throw new Error(error);}
  button.click();return {};
 }
 if(action.kind==='find'){
  const field=fields[action.name];if(!field)throw new Error('Find Target can only find the task fields.');
  const disclosure=field.closest('details');if(disclosure)disclosure.open=true;
  field.scrollIntoView({behavior:'instant',block:'center'});
  const r=field.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height};
 }
 if(action.kind==='read'){
  const field=[...new Set(Object.values(fields))].find(el=>{const r=el.getBoundingClientRect();return action.x>=r.left+scrollX&&action.x<=r.right+scrollX&&action.y>=r.top+scrollY&&action.y<=r.bottom+scrollY;});
  if(!field)throw new Error('Read Element must point at a task field. Run Find Target immediately before reading.');
  field.scrollIntoView({behavior:'instant',block:'center'});
  return {text:field.value.slice(0,400)};
 }
 if(action.kind==='type'){
  if(!['Task output','Reply recipient','Reply subject','Reply message'].includes(action.name)||typeof action.text!=='string'||action.text.length>400||!Number.isFinite(action.perKeyDelay)||action.perKeyDelay<0||action.perKeyDelay>50)throw new Error('Typing is limited to the demo reply fields.');
  const field=fields[action.name];field.scrollIntoView({behavior:'instant',block:'center'});field.focus({preventScroll:true});if(field.type!=='email')field.setSelectionRange(field.value.length,field.value.length);
  draftPreview.hidden=true;taskState.textContent='Typing';taskLog.textContent='The canvas is filling '+action.name.toLowerCase()+'.';
  for(const char of action.text){signal.throwIfAborted();if(field.type==='email')field.value+=char;else field.setRangeText(char,field.selectionStart,field.selectionEnd,'end');field.dispatchEvent(new Event('input',{bubbles:true}));await pause(action.perKeyDelay,signal);}
  return {};
 }
 if(action.kind==='scroll'){
  if(!['Down','Up','Left','Right'].includes(action.direction)||!Number.isInteger(action.distance)||action.distance<0||action.distance>20)throw new Error('Unsupported browser scroll.');
  const amount=action.distance*40;window.scrollBy({top:action.direction==='Down'?amount:action.direction==='Up'?-amount:0,left:action.direction==='Right'?amount:action.direction==='Left'?-amount:0,behavior:'instant'});return {};
 }
 throw new Error('Unsupported website action.');
}
stop.addEventListener('click',()=>{hostRun.abort();send('stop');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&running){hostRun.abort();send('stop');}});
dismiss.addEventListener('click',()=>panel.hidden=true);
document.getElementById('reset-tour').addEventListener('click',()=>{
 hostRun.abort();send('stop');running=false;panel.hidden=true;taskArea.hidden=true;resetTask();
 document.querySelectorAll('.tour-highlight').forEach(el=>el.classList.remove('tour-highlight'));
 editor.src=editor.src;
});
document.querySelectorAll('[data-tour-target]').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.tourTarget)));
window.addEventListener('message',async event=>{
 if(event.origin!==location.origin||event.source!==editor.contentWindow||event.data?.channel!=='keypress-tour')return;
 const data=event.data;
 if(data.type==='started'){
  taskArea.hidden=false;
  hostRun.abort();hostRun=new AbortController();running=true;panel.hidden=false;stop.hidden=false;dismiss.hidden=true;
  progress.removeAttribute('value');status.textContent='The canvas flow is running. Stop or Esc ends the run.';
 }else if(data.type==='progress'){
  status.textContent='Step '+data.step+' · '+data.action.name.replace(/([a-z])([A-Z])/g,'$1 $2')+(data.action.iteration>1?' · visit '+data.action.iteration:'');
 }else if(data.type==='action'){
  let result,error;
  try{if(!running)throw new Error('The canvas run is no longer active.');result=await act(data.action,hostRun.signal);}catch(e){error=e.message||'Action stopped.';}
  editor.contentWindow.postMessage({channel:'keypress-tour',type:'ack',requestID:data.requestID,result,error},location.origin);
 }else if(data.type==='finished'){
  if(taskState.textContent==='Typing'){taskState.textContent='Message written';taskState.dataset.state='ready';taskLog.textContent='The flow filled its fields. Add a Click on Save draft to save it for review.';}
  progress.max=1;progress.value=1;end('Flow complete. Edit the canvas and press its Run button again.');
 }else if(data.type==='stopped')end('Flow stopped. Return to the canvas to run it again.');
 else if(data.type==='error'){panel.hidden=false;end(data.message);}
});

// Keep illustrative connections attached to their ports at every viewport size.
const heroStage=document.querySelector('.hero-art');
const heroWires=heroStage.querySelector('.hero-lines');
function drawHeroConnections(){
 const stage=heroStage.getBoundingClientRect();if(!stage.width||!stage.height)return;
 heroWires.setAttribute('viewBox','0 0 '+stage.width+' '+stage.height);
 const point=selector=>{const box=heroStage.querySelector(selector).getBoundingClientRect();return {x:box.left+box.width/2-stage.left,y:box.top+box.height/2-stage.top};};
 const connect=(from,to,selector)=>{
  const a=point(from),b=point(to),r=12,turn=Math.max(a.x+4,Math.min(Math.max(a.x,b.x)+20,stage.width+1)),approach=b.y-18;
  heroWires.querySelector(selector).setAttribute('d',
   'M '+a.x+' '+a.y+' H '+turn+' Q '+(turn+r)+' '+a.y+' '+(turn+r)+' '+(a.y+r)+' V '+(approach-r)+' Q '+(turn+r)+' '+approach+' '+turn+' '+approach+' H '+(b.x+r)+' Q '+b.x+' '+approach+' '+b.x+' '+(approach+r)+' V '+b.y);
 };
 connect('.start [data-port=output]','.middle [data-port=input]','[data-connection=first]');
 connect('.middle [data-port=output]','.end [data-port=input]','[data-connection=second]');
}
new ResizeObserver(()=>requestAnimationFrame(drawHeroConnections)).observe(heroStage);
document.fonts.ready.then(drawHeroConnections);

// Motion illustrates the product's flow without moving the real editor.
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const motionToggle=document.getElementById('motion-toggle');
let motionPaused=false;
function updateMotion(){
 document.body.classList.toggle('motion-paused',motionPaused||motionPreference.matches||document.hidden);
 motionToggle.setAttribute('aria-pressed',String(motionPaused));
 motionToggle.setAttribute('aria-label',motionPaused?'Resume decorative animations':'Pause decorative animations');
 motionToggle.firstChild.textContent=motionPaused?'Motion off':'Motion on';
}
motionToggle.addEventListener('click',()=>{motionPaused=!motionPaused;updateMotion();});
motionPreference.addEventListener('change',updateMotion);
document.addEventListener('visibilitychange',updateMotion);
updateMotion();

if('IntersectionObserver' in window){
 const reveals=document.querySelectorAll('.section-top,.steps article,.feature,.target-ladder article,.depth-grid article,.privacy-band,.download-inner,.faq-section h2');
 const revealObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('revealed');revealObserver.unobserve(entry.target);}
 },{threshold:0.08});
 reveals.forEach(element=>{
  // Content already on screen is immediately visible, including anchor arrivals.
  const box=element.getBoundingClientRect();
  if(box.top<innerHeight&&box.bottom>0)element.classList.add('revealed');
  element.classList.add('reveal');
  revealObserver.observe(element);
 });
 const illustrationObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)entry.target.classList.toggle('motion-visible',entry.isIntersecting);
 },{threshold:0.15});
 document.querySelectorAll('.hero-copy,.hero-art,.feature-art,.value-pipeline,.download-line').forEach(element=>illustrationObserver.observe(element));
}
