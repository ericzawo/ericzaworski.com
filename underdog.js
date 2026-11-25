(() => {
  const button = document.querySelector('#underdog');
  const targets = ['#chew-word', '#dapper-mark', '.toggle-wrap'].map(s => document.querySelector(s));
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const asset = name => 'assets/underdog/' + name;
  let turn = 0;
  let playing = false;
  let controller;

  // Functions returning viewport coordinates stay accurate as the camera follows the dog.
  function home() {
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.bottom };
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
    let startScroll = scrollY;
    let movedCamera = false;
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
    function move(from, to, jump, t) {
      const a = from(), b = to();
      facing = b.x > a.x ? -1 : 1;
      draw({ x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t - 4*jump*t*(1-t) });
    }

    try {
      await Promise.all(['wake.gif','walk.gif','trot.gif','prance.gif','bite.png','look-up.png'].map(pose => {
        const image = new Image();
        image.src = asset(pose);
        return image.decode();
      }));
      signal.throwIfAborted();
      button.setAttribute('aria-pressed','true');
      document.body.classList.add('dog-playing');
      document.body.append(sprite);
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

      target.classList.add('dog-target');
      await animate('wake.gif',850,() => draw(home(),.86));
      startScroll = scrollY;
      const rect = target.getBoundingClientRect();
      const fromRight = rect.right + 50 < innerWidth;
      const side = fromRight ? 1 : -1;
      const camera = rect.bottom > innerHeight-35 || rect.top < 55
        ? Math.max(0, Math.min(document.documentElement.scrollHeight-innerHeight,
            startScroll+rect.top-innerHeight*.6)) : startScroll;
      const grip = () => {
        const r = target.getBoundingClientRect();
        return { x: (fromRight ? r.right : r.left)+side*21, y:r.top+r.height/2+5 };
      };
      movedCamera = camera !== startScroll;
      // Give the paws a line of type to walk along before the pounce.
      const edge = () => {
        const p = home(), g = grip();
        return { x:p.x+Math.sign(g.x-p.x)*Math.min(68,Math.abs(g.x-p.x)), y:p.y-19 };
      };
      await animate(turn === 1 ? 'trot.gif' : 'walk.gif',1050,t => move(home,edge,3,t));
      await animate('prance.gif',800,t => {
        if (movedCamera) window.scrollTo(0,startScroll+(camera-startScroll)*t*t*(3-2*t));
        move(edge,grip,30,t);
      });
      const at = grip();
      facing = side;
      target.style.transformOrigin = (fromRight ? 'right' : 'left')+' center';
      await animate('bite.png',600,t => {
        const shake = Math.sin(6*Math.PI*t)*Math.sin(Math.PI*t);
        draw({ x:at.x+4*shake, y:at.y+3*shake });
        target.style.transform = `translate(${4*shake}px,${3*shake}px) rotate(${side*24*shake}deg)`;
      });
      await animate('look-up.png',680,t => {
        draw(at);
        target.style.transform = `translate(${side*innerWidth*.55*t}px,${-260*t*(1-t)+32*t}px) rotate(${side*300*t}deg)`;
        target.style.opacity = String(Math.min(1,(1-t)*5));
      });
      markThrown();
      const launchY = at.y + scrollY;
      await animate('trot.gif',780,t => {
        if (movedCamera) window.scrollTo(0,camera+(startScroll-camera)*t);
        move(() => ({ x:at.x, y:launchY-scrollY }),home,34,t);
      });
    } catch (error) {
      if (!signal.aborted) console.error('Underdog animation failed',error);
    } finally {
      if (movedCamera) window.scrollTo(0,startScroll);
      if (target) {
        target.classList.remove('dog-target');
        for (const key of ['transform','transform-origin','opacity']) target.style.removeProperty(key);
      }
      sprite.remove();
      document.body.classList.remove('dog-playing');
      button.setAttribute('aria-pressed','false');
      playing = false;
    }
  }

  button.disabled = false;
  button.addEventListener('click',play);
  document.addEventListener('keydown',e => { if (e.key === 'Escape') controller?.abort(); });
  window.addEventListener('pagehide',() => controller?.abort());
  motion.addEventListener('change',() => controller?.abort());
})();
