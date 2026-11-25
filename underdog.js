(() => {
  const button = document.querySelector('#underdog');
  const targets = ['#chew-word', '#dapper-mark', '.toggle-wrap', '#toronto-word', '#founding-year', '#previously-word'].map(s => document.querySelector(s));
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const asset = name => 'assets/underdog/' + name;
  let turn = 0;
  let playing = false;
  let controller;

  function home() {
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.bottom };
  }

  // A range yields one rectangle per wrapped line. Keep the ends of each
  // text run so a paw can only land where there are actually letters.
  function platforms() {
    const rows = [];
    const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || node.parentElement.closest('.tossed, button')) continue;
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.top < 32 || r.top > innerHeight-12 || r.width < 43) continue;
        rows.push({ left:r.left+10, right:r.right-10, y:r.top+2 });
      }
    }
    return rows;
  }

  const thoughts = [
    "Don't you have anything better to do?",
    "You’re barking up the wrong homepage.",
    "I was told this was a non-clickable role.",
    "Technically, this counts as engagement.",
    "You saw me throw a button and thought, ‘Let’s give him another one.’",
    "I have a meeting at treat.",
    "Thank you for scrolling."
  ];
  const bubble = document.createElement('span');
  bubble.className = 'dog-thought';
  bubble.setAttribute('aria-hidden','true');
  let nextThought = 0;
  let bedtime;

  function positionThought() {
    if (!bubble.isConnected) return;
    const bed = button.getBoundingClientRect();
    const center = bed.left + bed.width / 2;
    const left = Math.max(8, Math.min(innerWidth-bubble.offsetWidth-8, center-bubble.offsetWidth/2));
    bubble.style.left = (left-bed.left)+'px';
    bubble.style.setProperty('--tail', (center-left)+'px');
  }

  function think() {
    if (nextThought === thoughts.length) return;
    clearTimeout(bedtime);
    const message = thoughts[nextThought++];
    const status = document.querySelector('#dog-status');
    const img = button.querySelector('img');
    const source = button.querySelector('source');
    img.src = source.srcset = asset('look-up.png');
    bubble.textContent = status.textContent = message;
    button.append(bubble);
    positionThought();
    if (nextThought === thoughts.length) {
      button.setAttribute('aria-disabled','true');
      button.title = button.ariaLabel = message;
      return;
    }
    button.title = button.ariaLabel = 'Hear another thought';
    bedtime = setTimeout(() => {
      bubble.remove();
      status.textContent = '';
      img.src = asset('sleep.gif');
      source.srcset = asset('sleep.png');
    }, Math.max(4200, message.length*85));
  }

  window.addEventListener('resize', positionThought);
  async function play() {
    if (playing) return;
    if (turn === targets.length) return think();
    playing = true;
    controller = new AbortController();
    const { signal } = controller;
    const target = targets[turn];
    const sprite = new Image();
    sprite.className = 'underdog-visitor';
    sprite.alt = '';
    let facing = 1;
    const stage = document.createElement('div');
    stage.className = 'dog-stage';
    stage.setAttribute('aria-hidden', 'true');
    stage.inert = true;
    let toy;
    let thrown = false;

    function markThrown() {
      if (thrown) return;
      target.classList.add('tossed');
      target.inert = true;
      thrown = true;
      turn++;
    }
    function draw(point) {
      sprite.style.transform = `translate(calc(${point.x}px - 50%), calc(${point.y}px - 100%)) scaleX(${facing})`;
    }
    const frameMs = 1000 / 60;
    const epoch = performance.now();
    let paintedFrame = -1;
    function animate(pose, duration, render) {
      signal.throwIfAborted();

      return new Promise((resolve, reject) => {
        let id;
        const frames = Math.max(1, Math.round(duration / frameMs));
        const start = Math.max(paintedFrame, Math.floor((performance.now()-epoch)/frameMs));
        function cancel() { cancelAnimationFrame(id); reject(signal.reason); }
        signal.addEventListener('abort', cancel, { once: true });
        function tick(now) {
          const frame = Math.floor((now-epoch+1)/frameMs);
          if (frame <= paintedFrame) { id = requestAnimationFrame(tick); return; }
          paintedFrame = frame;
          if (sprite.getAttribute('src') !== asset(pose)) sprite.src = asset(pose);
          const t = Math.min(1, Math.max(0, (frame-start)/frames));
          render(t);
          if (t < 1) id = requestAnimationFrame(tick);
          else { signal.removeEventListener('abort', cancel); resolve(); }
        }
        id = requestAnimationFrame(tick);
      });
    }
    let feet = home();
    async function jump(to, clearance) {
      const from = feet;
      const dx = to.x-from.x, dy = to.y-from.y;
      if (dx) facing = dx>0 ? -1 : 1;
      // A running leap clears the upper platform, then falls faster than it rose.
      clearance ??= Math.min(48, 22 + Math.abs(dx)*.16);
      const rise = Math.max(0, -dy) + clearance;
      const up = Math.sqrt(2*rise/2800);
      const down = Math.sqrt(2*(rise+dy)/5100);
      await animate('prance.gif',(up+down)*1000,t => {
        const time = t*(up+down);
        const y = time < up ? from.y-rise+1400*(up-time)**2
          : from.y-rise+2550*(time-up)**2;
        draw({x:Math.round(from.x+dx*t),y:Math.round(y)});
      });
      feet = to;
    }
    async function traverse(rows,dest) {
      const lineHeight = parseFloat(getComputedStyle(button.closest('p')).lineHeight);
      const stride = 3*lineHeight;
      for (let leap=0; leap<3; leap++) {
        const vertical = dest.y-feet.y;
        if (Math.abs(vertical)<stride*1.45) return;
        const sign = Math.sign(vertical);
        const dir = dest.x >= feet.x ? 1 : -1;
        const aim = feet.x + dir*Math.min(115,Math.max(52,Math.abs(dest.x-feet.x)*.5));
        const landingX = row => Math.max(row.left,Math.min(row.right,aim));
        const candidates = rows.filter(row => (row.y-feet.y)*sign >= stride*.76
          && (dest.y-row.y)*sign >= lineHeight*1.25);
        if (!candidates.length) return;
        const score = row => Math.abs(row.y-feet.y-sign*stride)
          + Math.abs(landingX(row)-aim)*.35;
        candidates.sort((a,b) => score(a)-score(b));
        const row = candidates[0];
        const start = landingX(row);
        await jump({x:start,y:row.y});
        const end = Math.max(row.left,Math.min(row.right,start+dir*38));
        if (Math.abs(end-start)>4) {
          facing = dir>0 ? -1 : 1;
          const gait = turn === 0 ? 'walk.gif' : 'trot.gif';
          await animate(gait,Math.abs(end-start)*5,t => draw({x:Math.round(start+(end-start)*t),y:row.y}));
          feet = {x:end,y:row.y};
        }
      }
    }

    async function breakWord(toy, at, side, kind) {
      const node = toy.firstChild;
      const range = document.createRange();
      // Freeze each glyph at its rendered position before separating the pieces.
      const pieces = Array.from(node.textContent, (letter, index) => {
        range.setStart(node,index);
        range.setEnd(node,index+1);
        const rect = range.getBoundingClientRect();
        const piece = document.createElement('span');
        piece.className = 'dog-fragment';
        piece.textContent = letter;
        piece.style.font = toy.style.font;
        piece.style.lineHeight = rect.height+'px';
        piece.style.left = rect.left+'px';
        piece.style.top = rect.top+'px';
        stage.prepend(piece);
        return piece;
      });
      toy.remove();
      await animate(kind===1 ? 'prance.gif' : 'bite.png',820,t => {
        draw({x:at.x,y:at.y-(kind===1 ? 12*Math.max(0,1-t*5) : 0)});
        pieces.forEach((piece,i) => {
          const middle = i-(pieces.length-1)/2;
          let x,y,angle;
          if (kind===0) { // Tear the word into two halves, then shed the letters.
            const dir = Math.sign(middle)||1;
            x = dir*(26+7*Math.abs(middle))*t;
            y = -48*t*(1-t)+90*t*t;
            angle = dir*(30+i*8)*t;
          } else { // Scatter the digits like kicked pebbles.
            x = middle*45*t;
            y = -(145+20*(i%2))*t+245*t*t;
            angle = middle*145*t;
          }
          piece.style.transform = `translate(${x}px,${y}px) rotate(${angle}deg)`;
          piece.style.opacity = String(Math.min(1,(1-t)*5));
        });
      });
    }

    try {
      await Promise.all(['wake.gif','walk.gif','trot.gif','prance.gif','bite.png','look-up.png'].map(pose => {
        const image = new Image();
        image.src = asset(pose);
        return image.decode();
      }));
      signal.throwIfAborted();
      button.setAttribute('aria-pressed','true');
      stage.append(sprite);
      document.body.append(stage);
      if (motion.matches) {
        await animate('look-up.png',350,() => draw(home()));
        markThrown();
        return;
      }

      await animate('wake.gif',700,() => draw(home()));
      const rows = platforms();
      const rect = target.getBoundingClientRect();
      const side = rect.right+48 < innerWidth ? 1 : -1;
      const grip = { x:side===1 ? rect.right+18 : rect.left-18, y:rect.top+rect.height/2+5 };
      // For targets below the fold, exit at the viewport edge and bring the
      // item back on screen. The reader's scroll position never changes.
      const pickup = { x:Math.max(27,Math.min(innerWidth-27,grip.x)),
        y:Math.max(-5,Math.min(innerHeight+46,grip.y)) };
      const returnPoint = home();
      // Give the short first trip a run-up. Later trips head straight toward the target.
      if (turn === 0) {
        const row = rows.filter(r => r.y-feet.y>48 && r.y-feet.y<110)
          .sort((a,b) => Math.abs(a.y-feet.y-72)-Math.abs(b.y-feet.y-72))[0];
        if (row) await jump({x:Math.max(row.left,Math.min(row.right,feet.x+75)),y:row.y});
      }
      await traverse(rows,pickup);
      await jump(pickup);
      facing = side;
      toy = target.cloneNode(true);
      for (const node of [toy,...toy.querySelectorAll('[id]')]) node.removeAttribute('id');
      toy.classList.add('dog-toy');
      toy.style.width = rect.width+'px';
      toy.style.height = rect.height+'px';
      toy.style.font = getComputedStyle(target).font;
      toy.style.transformOrigin = side===1 ? 'right center' : 'left center';
      stage.prepend(toy);
      target.classList.add('tossed');
      const at = {x:pickup.x,y:Math.max(54,Math.min(innerHeight-28,pickup.y))};
      const placeToy = (p,angle=0) => {
        const x = p.x-side*18-(side===1 ? rect.width : 0);
        toy.style.transform = `translate(${x}px,${p.y-5-rect.height/2}px) rotate(${angle}deg)`;
      };
      await animate('bite.png',390,t => {
        const shake = Math.sin(4*Math.PI*t)*Math.sin(Math.PI*t);
        const p = {x:at.x+3*shake,y:pickup.y+(at.y-pickup.y)*t+2*shake};
        draw(p); placeToy(p,side*20*shake);
      });
      if (target.id === 'toronto-word' || target.id === 'founding-year') {
        placeToy(at);
        await breakWord(toy,at,side,turn-3);
      } else {
        await animate('look-up.png',420,t => {
          draw(at);
          placeToy({x:at.x+side*innerWidth*.55*t,y:at.y-220*t*(1-t)+32*t},side*300*t);
          toy.style.opacity = String(Math.min(1,(1-t)*5));
        });
      }
      markThrown();
      toy.remove();
      feet = at;
      if (target === targets[0]) {
        // Land on the opening work paragraph, on the same wrapped line as the bed.
        const loyal = button.parentElement.querySelector('a').getBoundingClientRect();
        const line = rows.filter(row => Math.abs(row.y-(loyal.top+2))<8
          && row.left<returnPoint.x && row.right>=returnPoint.x-165);
        const left = Math.min(loyal.left,...line.map(row => row.left));
        const landing = { x:Math.max(left,returnPoint.x-120), y:loyal.top+2 };
        await jump(landing);
        facing = -1;
        const distance = returnPoint.x-landing.x;
        const runUp = Math.max(0,distance-Math.min(38,distance*.6));
        await animate('walk.gif',Math.max(100,runUp*8),t => {
          draw({ x:landing.x+runUp*t, y:landing.y });
        });
        feet = { x:landing.x+runUp, y:landing.y };
        await jump(returnPoint,12);
      } else {
        await traverse(rows,returnPoint);
        await jump(returnPoint);
      }
    } catch (error) {
      if (!signal.aborted) console.error('Underdog animation failed',error);
    } finally {
      if (target && !thrown) target.classList.remove('tossed');
      stage.remove();
      button.setAttribute('aria-pressed','false');
      playing = false;
    }
  }

  button.disabled = false;
  button.addEventListener('click',play);
  document.addEventListener('keydown',e => { if (e.key === 'Escape') controller?.abort(); });
  window.addEventListener('resize',() => controller?.abort());
  window.addEventListener('scroll',() => controller?.abort(), { passive: true });
  window.addEventListener('pagehide',() => controller?.abort());
  motion.addEventListener('change',() => controller?.abort());
})();
