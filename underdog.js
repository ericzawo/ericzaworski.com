(() => {
  const button = document.querySelector('#underdog');
  const targets = ['#chew-word', '#dapper-mark', '.toggle-wrap'].map(s => document.querySelector(s));
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

  async function play() {
    if (playing) return;
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
    function draw(point, scale = 1) {
      sprite.style.transform = `translate(${point.x-27}px, calc(${point.y}px - 100%)) scale(${facing*scale}, ${scale})`;
    }
    function animate(pose, duration, render) {
      signal.throwIfAborted();
      sprite.src = asset(pose);
      return new Promise((resolve, reject) => {
        let id;
        const begin = performance.now();
        function cancel() { cancelAnimationFrame(id); reject(signal.reason); }
        signal.addEventListener('abort', cancel, { once: true });
        function tick(now) {
          const t = Math.min(1, Math.max(0, (now-begin)/duration));
          render(t);
          if (t < 1) id = requestAnimationFrame(tick);
          else { signal.removeEventListener('abort', cancel); resolve(); }
        }
        tick(begin);
      });
    }
    let feet = home();
    async function jump(to) {
      const from = feet;
      const dx = to.x-from.x, dy = to.y-from.y;
      if (dx) facing = dx>0 ? -1 : 1;
      const gravity = 3800;
      const rise = Math.max(0,-dy)+10+Math.min(13,Math.abs(dx)*.08);
      const velocity = Math.sqrt(2*gravity*rise);
      const duration = (velocity+Math.sqrt(2*gravity*(rise+dy)))/gravity;
      await animate('prance.gif',duration*1000,t => {
        const time = duration*t;
        draw({x:from.x+dx*t,y:from.y-velocity*time+gravity*time*time/2});
      });
      feet = to;
      await animate('walk.gif',70,() => draw(to));
    }
    async function traverse(rows,dest,limit) {
      for (let i=0;i<limit;i++) {
        const sign = Math.sign(dest.y-feet.y);
        const candidates = rows.filter(r => (r.y-feet.y)*sign>8 && (r.y-dest.y)*sign<4);
        if (!candidates.length) break;
        const landX = r => Math.max(r.left,Math.min(r.right,feet.x));
        const cost = r => Math.abs(r.y-feet.y)+Math.abs(landX(r)-feet.x)*.45;
        candidates.sort((a,b) => cost(a)-cost(b));
        const row = candidates[0];
        await jump({x:landX(row),y:row.y});
        const start = feet.x;
        const dir = dest.x<start ? -1 : 1;
        const end = Math.max(row.left,Math.min(row.right,start+dir*48));
        if (Math.abs(end-start)>3) {
          facing = end>start ? -1 : 1;
          await animate('trot.gif',Math.abs(end-start)*8,t => draw({x:start+(end-start)*t,y:row.y}));
          feet = {x:end,y:row.y};
        }
      }
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
        await animate('look-up.png',350,() => draw(home(),.74));
        if (target) markThrown();
        return;
      }
      if (!target) {
        await animate('look-up.png',330,() => draw(home(),.84));
        await animate('prance.gif',480,t => {
          const p = home();
          draw({ x:p.x, y:p.y-9*Math.sin(Math.PI*t) },.86);
        });
        return;
      }

      await animate('wake.gif',700,() => draw(home(),.86));
      const rows = platforms();
      const rect = target.getBoundingClientRect();
      const side = rect.right+48 < innerWidth ? 1 : -1;
      const grip = { x:side===1 ? rect.right+21 : rect.left-21, y:rect.top+rect.height/2+5 };
      // For targets below the fold, exit at the viewport edge and bring the
      // item back on screen. The reader's scroll position never changes.
      const pickup = { x:Math.max(27,Math.min(innerWidth-27,grip.x)),
        y:Math.max(-5,Math.min(innerHeight+46,grip.y)) };
      const returnPoint = home();
      // Visit a neighboring row first even when the heading is beside the dog.
      const opposite = rows.filter(r => (r.y-feet.y)*Math.sign(feet.y-pickup.y)>10)
        .sort((a,b) => Math.abs(a.y-feet.y)-Math.abs(b.y-feet.y))[0];
      if (opposite) await jump({x:Math.max(opposite.left,Math.min(feet.x,opposite.right)),y:opposite.y});
      await traverse(rows,pickup,5);
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
        const x = p.x-side*21-(side===1 ? rect.width : 0);
        toy.style.transform = `translate(${x}px,${p.y-5-rect.height/2}px) rotate(${angle}deg)`;
      };
      await animate('bite.png',390,t => {
        const shake = Math.sin(4*Math.PI*t)*Math.sin(Math.PI*t);
        const p = {x:at.x+3*shake,y:pickup.y+(at.y-pickup.y)*t+2*shake};
        draw(p); placeToy(p,side*20*shake);
      });
      await animate('look-up.png',420,t => {
        draw(at);
        placeToy({x:at.x+side*innerWidth*.55*t,y:at.y-220*t*(1-t)+32*t},side*300*t);
        toy.style.opacity = String(Math.min(1,(1-t)*5));
      });
      markThrown();
      toy.remove();
      feet = at;
      await traverse(rows,returnPoint,5);
      await jump(returnPoint);
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
