/* ============================================================
   LIET — Product Video engine
   - fits 1080x1920 stages to viewport
   - swipe / dot / edge-tap / keyboard nav
   - replays entrance choreography every time a page lands
   - page-specific animatics: live transcription, scrub,
     count-up, timeline
   ============================================================ */

(function(){
  'use strict';

  /* ---------- responsive scale ---------- */
  function scaleStages(){
    const sw = window.innerWidth, sh = window.innerHeight;
    const scale = Math.min(sw/1080, sh/1920);
    document.querySelectorAll('.stage').forEach(s=>{
      s.style.transform = 'scale('+scale+')';
      s.style.transformOrigin = 'center';
    });
  }
  window.addEventListener('resize', scaleStages);
  scaleStages();

  /* ---------- page model ---------- */
  const track = document.getElementById('track');
  const pages = Array.from(document.querySelectorAll('.page'));
  const PAGES = pages.length;
  let cur = 0;

  const nav = document.getElementById('nav');
  for(let i=0;i<PAGES;i++){
    const d=document.createElement('div');
    d.className='ndot'+(i===0?' active':'');
    d.addEventListener('click',()=>go(i));
    nav.appendChild(d);
  }
  const dots = Array.from(nav.children);
  const progress = document.getElementById('progress');

  function go(n){
    n = Math.max(0, Math.min(PAGES-1, n));
    pages.forEach((p,i)=>p.classList.toggle('active', i===n));
    cur = n;
    dots.forEach((d,i)=>d.classList.toggle('active', i===n));
    progress.style.width = ((n+1)/PAGES*100)+'%';
    transToken++;          // stop any running transcription
    animatePage(n);        // replay this page's entrance every time it lands
  }

  /* ---------- entrance choreography (replayable, inline + fallback) ---------- */
  function fromTransform(el){
    const tx = el.classList.contains('lf') ? '-40px' : el.classList.contains('rt') ? '40px' : '0px';
    const ty = el.classList.contains('up') ? '34px' : el.classList.contains('dn') ? '-26px' : '0px';
    const sc = el.classList.contains('sc') ? ' scale(0.9)' : '';
    return 'translate('+tx+','+ty+')'+sc;
  }
  function animatePage(idx){
    const stage = pages[idx].querySelector('.stage');
    const els = Array.prototype.slice.call(stage.querySelectorAll('.a, .draw, .nf'));
    // reset page-specific bits
    if(idx===2) resetScrub();
    if(idx===5){ document.getElementById('bignum').textContent='0'; resetTimeline(); }

    // 1) snap to hidden start state (no transition)
    els.forEach(el=>{
      el.style.transition='none';
      if(el.classList.contains('draw')){ el.style.transform='scaleX(0)'; }
      else { el.style.opacity='0'; el.style.transform=fromTransform(el); }
    });
    void stage.offsetWidth; // commit

    // 2) play in, staggered via per-element transition-delay
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      els.forEach(el=>{
        let delay = parseInt(el.getAttribute('data-d')||'0',10);
        if(el.classList.contains('nf')) delay = 760 + parseInt(el.getAttribute('data-nf')||'0',10)*150;
        if(el.classList.contains('draw')){
          el.style.transition='transform .8s cubic-bezier(.7,0,.2,1) '+delay+'ms';
          el.style.transform='scaleX(1)';
        } else {
          el.style.transition='opacity .7s ease '+delay+'ms, transform .85s cubic-bezier(.16,.84,.3,1) '+delay+'ms';
          el.style.opacity='1';
          el.style.transform='none';
        }
      });
    });});

    // 3) safety net: guarantee fully visible even if transitions stall
    clearTimeout(stage.__fb);
    stage.__fb = setTimeout(function(){
      els.forEach(el=>{
        el.style.transition='none';
        el.style.opacity='1';
        el.style.transform = el.classList.contains('draw') ? 'scaleX(1)' : 'none';
      });
    }, 2900);

    // page-specific animatics
    if(idx===1) startTranscription();
    if(idx===2) startScrub();
    if(idx===3) startNoteFill();
    if(idx===5){ startCountUp(); startTimeline(); }
  }

  /* ---------- navigation inputs ---------- */
  // manual swipe (touch + pointer drag) — robust, no scroll/transform dependency
  let sx=0, sy=0, tracking=false;
  function down(x,y){ sx=x; sy=y; tracking=true; }
  function up(x,y){
    if(!tracking) return; tracking=false;
    const dx=x-sx, dy=y-sy;
    if(Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)) go(cur+(dx<0?1:-1));
  }
  track.addEventListener('touchstart',e=>down(e.touches[0].clientX,e.touches[0].clientY),{passive:true});
  track.addEventListener('touchend',e=>up(e.changedTouches[0].clientX,e.changedTouches[0].clientY),{passive:true});
  track.addEventListener('mousedown',e=>down(e.clientX,e.clientY));
  window.addEventListener('mouseup',e=>up(e.clientX,e.clientY));

  document.addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'||e.key==='ArrowDown'||e.key===' ') go(cur+1);
    if(e.key==='ArrowLeft'||e.key==='ArrowUp') go(cur-1);
    if(e.key==='r'||e.key==='R') animatePage(cur); // replay current page
  });

  /* ---------- waveform (page 2) + mic equaliser (page 1) ---------- */
  const wave = document.getElementById('wave');
  const BARS = 130, bars=[];
  for(let i=0;i<BARS;i++){const s=document.createElement('span');wave.appendChild(s);bars.push(s);}
  const micEq = document.getElementById('micEq');
  const EQ = 40, eqbars=[];
  if(micEq){ for(let i=0;i<EQ;i++){const s=document.createElement('i');micEq.appendChild(s);eqbars.push(s);} }
  let phase=0;
  function animateWave(){
    phase+=0.055;
    for(let i=0;i<BARS;i++){
      const travel=Math.sin((i*0.20)-phase);
      const swell=Math.sin((i*0.03)-phase*0.4);
      const env=0.55+0.45*Math.sin(phase*0.5+i*0.012);
      const h=8+(Math.abs(travel)*0.7+Math.abs(swell)*0.3)*30*env;
      bars[i].style.height=h.toFixed(1)+'px';
      bars[i].style.opacity=(0.45+0.5*Math.abs(travel)).toFixed(2);
    }
    for(let i=0;i<eqbars.length;i++){
      const v=Math.abs(Math.sin((i*0.45)-phase*1.6))*0.7 + Math.abs(Math.sin((i*0.13)-phase*0.8))*0.3;
      eqbars[i].style.height=(8+v*46).toFixed(1)+'px';
      eqbars[i].style.opacity=(0.5+0.45*v).toFixed(2);
    }
    requestAnimationFrame(animateWave);
  }
  animateWave();

  /* ---------- live multilingual transcription (page 2) ---------- */
  const langs=[
    {tag:"TAMIL → ENGLISH",chip:"EN ⇄ TA",cls:"tamil",text:"வணக்கம் டாக்டர். கடந்த நான்கு மாதமா ரெண்டு கையிலயும் மூட்டு வலி, காலையில ஒரு மணி நேரத்துக்கு மேல விறைப்பு. முகத்துல வெயிலுல அதிகமாகுற சொறி, கடந்த ஒரு மாசமா நுரை மாதிரி சிறுநீர்."},
    {tag:"GERMAN → ENGLISH",chip:"EN ⇄ DE",cls:"latin",text:"Hallo Frau Doktor. Seit vier Monaten Gelenkschmerzen in beiden Händen, morgens über eine Stunde Steifheit. Ein Gesichtsausschlag, der sich in der Sonne verschlimmert, und seit einem Monat schaumiger Urin."},
    {tag:"KANNADA → ENGLISH",chip:"EN ⇄ KN",cls:"kannada",text:"ಹಲೋ ಡಾಕ್ಟರ್. ನಾಲ್ಕು ತಿಂಗಳಿಂದ ಎರಡೂ ಕೈಗಳಲ್ಲಿ ಕೀಲು ನೋವು, ಬೆಳಿಗ್ಗೆ ಒಂದು ಗಂಟೆ ಬಿಗಿತ. ಬಿಸಿಲಿನಲ್ಲಿ ಹೆಚ್ಚಾಗುವ ಮುಖದ ದದ್ದು, ಒಂದು ತಿಂಗಳಿಂದ ನೊರೆ ಮೂತ್ರ."},
    {tag:"LUXEMBOURGISH → ENGLISH",chip:"EN ⇄ LB",cls:"latin",text:"Moien Dokter. Zënter véier Méint hunn ech Gelenkschmerzen an deenen zwou Hänn a moies méi wéi eng Stonn Steifheet."},
    {tag:"MALAYALAM → ENGLISH",chip:"EN ⇄ ML",cls:"malayalam",text:"ഹലോ ഡോക്ടർ. നാല് മാസമായി രണ്ട് കൈകളിലും സന്ധി വേദന, രാവിലെ ഒരു മണിക്കൂർ കാഠിന്യം. വെയിലിൽ കൂടുന്ന മുഖത്തെ ചുണങ്ങ്, ഒരു മാസമായി നുരയുള്ള മൂത്രം."},
    {tag:"FRENCH → ENGLISH",chip:"EN ⇄ FR",cls:"latin",text:"Bonjour docteur. Depuis quatre mois, douleurs articulaires aux deux mains et plus d'une heure de raideur le matin. Une éruption au visage qui s'aggrave au soleil et, depuis un mois, des urines mousseuses."},
    {tag:"TELUGU → ENGLISH",chip:"EN ⇄ TE",cls:"telugu",text:"హలో డాక్టర్. నాలుగు నెలలుగా రెండు చేతుల్లో కీళ్ల నొప్పి, ఉదయం ఒక గంట బిగుతు. ఎండలో పెరిగే ముఖ దద్దుర్లు, ఒక నెలగా నురుగు మూత్రం."},
    {tag:"SPANISH → ENGLISH",chip:"EN ⇄ ES",cls:"latin",text:"Hola doctora. Desde hace cuatro meses dolor articular en ambas manos y más de una hora de rigidez matinal. Un sarpullido facial que empeora con el sol y, desde hace un mes, orina espumosa."},
    {tag:"HINDI → ENGLISH",chip:"EN ⇄ HI",cls:"deva",text:"नमस्ते डॉक्टर। चार महीने से दोनों हाथों में जोड़ों का दर्द, सुबह एक घंटे से ज़्यादा अकड़न। धूप में बढ़ने वाले चेहरे के दाने, और एक महीने से झागदार पेशाब।"},
    {tag:"ITALIAN → ENGLISH",chip:"EN ⇄ IT",cls:"latin",text:"Salve dottoressa. Da quattro mesi dolori articolari a entrambe le mani e oltre un'ora di rigidità mattutina. Un'eruzione al viso che peggiora al sole e, da un mese, urine schiumose."},
    {tag:"MARATHI → ENGLISH",chip:"EN ⇄ MR",cls:"deva",text:"नमस्कार डॉक्टर. चार महिन्यांपासून दोन्ही हातांत सांधेदुखी, सकाळी एक तासाहून अधिक जखडण. उन्हात वाढणारे चेहऱ्यावरचे पुरळ, आणि एक महिन्यापासून फेसाळ लघवी."},
    {tag:"ENGLISH",chip:"EN",cls:"latin",text:"Hello doctor. I've been having joint pain for about four months and morning stiffness for over an hour each morning."}
  ];
  const spoken=document.getElementById('spoken');
  const langtag=document.getElementById('langtag');
  const enchip=document.getElementById('enchip');
  let transToken=0;

  function startTranscription(){
    const my=++transToken;
    let idx=0;
    function run(){
      if(my!==transToken) return;
      const L=langs[idx];
      langtag.textContent=L.tag;
      enchip.textContent=L.chip;
      spoken.className='spoken '+L.cls;
      typeWords(spoken, firstSentence(L.text), my, ()=>{
        if(my!==transToken) return;
        const last = idx===langs.length-1;
        idx=(idx+1)%langs.length;
        setTimeout(run, last?1800:1300);
      });
    }
    run();
  }

  function firstSentence(text){
    // pick the first MEANINGFUL sentence (skip a short greeting)
    const parts = text.match(/[^.।]+[.।]?/g) || [text];
    let s = (parts[0]||text).trim();
    if(s.replace(/[.।]/g,'').trim().length < 20 && parts[1]) s = parts[1].trim();
    return s;
  }

  function typeWords(el, text, token, done){
    const words = text.split(' ');
    let i=0;
    el.innerHTML='';
    function step(){
      if(token!==transToken) return;
      const shown = words.slice(0,i+1).map(w=>'<span class="w" style="animation:none;opacity:1">'+w+'</span>').join(' ');
      el.innerHTML = shown + '<span class="caret"></span>';
      i++;
      if(i<words.length){
        setTimeout(step, 26+Math.random()*30);
      } else if(done){
        setTimeout(done, 120);
      }
    }
    step();
  }

  /* ---------- identifier scrub (page 3) ---------- */
  function resetScrub(){
    const s=document.getElementById('scrub');
    const p=document.getElementById('pseud');
    if(s) s.classList.remove('go');
    if(p) p.classList.remove('show');
  }
  function startScrub(){
    const s=document.getElementById('scrub');
    const p=document.getElementById('pseud');
    if(!s) return;
    setTimeout(()=>{ s.classList.add('go'); }, 1500);
    setTimeout(()=>{ p.classList.add('show'); }, 2300);
  }

  /* ---------- count-up (page 6) ---------- */
  function startCountUp(){
    const el=document.getElementById('bignum');
    if(!el) return;
    const target=45, dur=1500, start=performance.now();
    function tick(t){
      const pr=Math.min(1,(t-start)/dur);
      const e=1-Math.pow(1-pr,3);
      el.textContent=Math.round(e*target);
      if(pr<1) requestAnimationFrame(tick);
      else el.textContent=target;
    }
    setTimeout(()=>requestAnimationFrame(tick), 620);
  }

  /* ---------- note fill scan (page 4) ---------- */
  function startNoteFill(){
    const scan=document.getElementById('fillscan');
    const note=pages[3].querySelector('.note');
    if(!scan||!note) return;
    const start=performance.now(), dur=2000, travel=note.offsetHeight;
    scan.style.opacity='0';
    function tick(t){
      if(cur!==3){ scan.style.opacity='0'; return; }
      const pr=Math.min(1,(t-start)/dur);
      scan.style.top=(pr*travel-120)+'px';
      scan.style.opacity=(pr>0.04 && pr<0.96)?'1':'0';
      if(pr<1) requestAnimationFrame(tick); else scan.style.opacity='0';
    }
    setTimeout(()=>requestAnimationFrame(tick), 700);
  }

  /* ---------- timeline (page 6) ---------- */
  function resetTimeline(){
    pages[5].querySelectorAll('.tnode').forEach(n=>n.classList.remove('on'));
    pages[5].querySelectorAll('.tseg').forEach(s=>s.classList.remove('on'));
  }
  function startTimeline(){
    const nodes=pages[5].querySelectorAll('.tnode');
    const segs=pages[5].querySelectorAll('.tseg');
    const seq=[[nodes[0],1400],[segs[0],1750],[nodes[1],2150],[segs[1],2500],[nodes[2],2900]];
    seq.forEach(([el,delay])=>setTimeout(()=>{ if(cur===5) el.classList.add('on'); }, delay));
  }

  /* ---------- kick off page 1 ---------- */
  progress.style.width = (1/PAGES*100)+'%';
  function boot(){ scaleStages(); go(0); }
  if(document.readyState==='complete') boot();
  else window.addEventListener('load', boot);

})();
