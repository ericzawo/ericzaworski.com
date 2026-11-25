// Keep the inline button in the sentence while a pointer-transparent dog visits the text.
(() => {
  const button = document.querySelector('#underdog');
  const still = button.querySelector('source');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const asset = name => 'assets/underdog/' + name;
  const word = document.querySelector('#chew-word');
  let toy;
  let visitor;
  let frameId;
  let run = 0;

  function settle() {
    ++run;
    cancelAnimationFrame(frameId);
    visitor?.remove();
    visitor = null;
    toy?.remove();
    toy = null;
    word.classList.remove('in-mouth');
    still.srcset = asset('sleep.png');
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'Wake Underdog');
    button.title = 'Wake Underdog';
  }

  // Range rectangles follow the real line breaks, including after mobile wrapping.
  function nearbyLedges(home) {
    const ledges = [];
    const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent.trim()) continue;
      range.selectNodeContents(walker.currentNode);
      for (const rect of range.getClientRects()) {
        if (rect.width < 92 || rect.top < 62 || rect.top > innerHeight - 16) continue;
        if (Math.abs(rect.top - home.y) < 19) continue;
        ledges.push({ left: rect.left + 22, right: rect.right - 22, y: rect.top + 2 });
      }
    }
    ledges.sort((a, b) => Math.abs(a.y - home.y) - Math.abs(b.y - home.y));
    const first = ledges[0];
    return first ? [first, ledges.find(l => Math.abs(l.y - first.y) > 20)].filter(Boolean) : [];
  }

  async function wake() {
    if (button.getAttribute('aria-pressed') === 'true') return settle();
    const thisRun = ++run;
    button.setAttribute('aria-pressed', 'true');
    button.setAttribute('aria-label', 'Put Underdog back to sleep');
    button.title = 'Put Underdog back to sleep';
    if (motion.matches) {
      still.srcset = asset('look-up.png');
      return;
    }

    const sprite = new Image();
    sprite.className = 'underdog-visitor';
    sprite.alt = '';
    sprite.src = asset('wake.gif');
    const poses = ['walk.gif', 'trot.gif', 'bite.png', 'look-up.png'].map(name => {
      const image = new Image();
      image.src = asset(name);
      return image;
    });
    try {
      await Promise.all([sprite.decode(), ...poses.map(image => image.decode())]);
    } catch {
      if (thisRun === run) settle();
      return;
    }
    if (thisRun !== run) return;
    visitor = sprite;
    document.body.append(sprite);
    const rect = button.getBoundingClientRect();
    const home = { x: rect.left + rect.width / 2, y: rect.bottom };
    let position = home;
    let facing = 1;
    const steps = [];
    function step(to, ms, lift, pose, scale, action = '') {
      steps.push({ from: position, to, ms, lift, pose, scale, action });
      position = to;
    }
    step(home, 1280, 0, 'wake.gif', 1);
    const label = word.getBoundingClientRect();
    // The bow's mouth sits 21px left of center and 5px above the feet at display size.
    const grip = { x: label.right + 21, y: label.top + label.height / 2 + 5 };
    if (label.top > 50 && label.bottom < innerHeight) {
      step(grip, 650, 28, 'trot.gif', 1);
      step(grip, 230, 0, 'bite.png', 1, 'bite');
      step({ x: grip.x + 12, y: grip.y - 5 }, 750, 0, 'bite.png', 1, 'shake');
      step(position, 740, 0, 'look-up.png', 1, 'throw');
    }
    let ledgeIndex = 0;
    for (const ledge of nearbyLedges(home)) {
      const startLeft = Math.abs(position.x - ledge.left) < Math.abs(position.x - ledge.right);
      const start = { x: startLeft ? ledge.left : ledge.right, y: ledge.y };
      const end = { x: startLeft ? ledge.right : ledge.left, y: ledge.y };
      step(start, 600, 34, 'walk.gif', 1);
      const trotting = ledgeIndex++ % 2 === 1;
      step(end, Math.max(700, Math.abs(end.x - start.x) * (trotting ? 5 : 9)),
        0, trotting ? 'trot.gif' : 'walk.gif', 1);
      step(end, 600, 0, 'look-up.png', 1);
    }
    step(home, 700, 40, 'walk.gif', 40 / 54);
    let startTime;
    let previousScale = 40 / 54;
    let index = 0;
    function tick(now) {
      const s = steps[index];
      if (startTime === undefined) {
        startTime = now;
        if (sprite.getAttribute('src') !== asset(s.pose)) sprite.src = asset(s.pose);
        if (s.to.x !== s.from.x) facing = s.to.x > s.from.x ? -1 : 1;
      }
      const t = Math.min(1, (now - startTime) / s.ms);
      const progress = s.lift ? t * t * (3 - 2 * t) : t;
      let x = s.from.x + (s.to.x - s.from.x) * progress;
      let y = s.from.y + (s.to.y - s.from.y) * progress - 4 * s.lift * t * (1 - t);
      const scale = previousScale + (s.scale - previousScale) * progress;
      if (s.action) {
        facing = 1;
        if (!toy) {
          toy = document.createElement('span');
          toy.className = 'underdog-toy';
          toy.textContent = word.textContent;
          toy.setAttribute('aria-hidden', 'true');
          toy.style.font = getComputedStyle(word).font;
          toy.style.lineHeight = label.height + 'px';
          document.body.append(toy);
          word.classList.add('in-mouth');
        }
        const shake = s.action === 'shake' ? Math.sin(6 * Math.PI * t) * Math.sin(Math.PI * t) : 0;
        x += 3 * shake;
        y += 3 * shake;
        const flight = s.action === 'throw' ? t : 0;
        const distance = Math.min(175, innerWidth - grip.x - label.width - 16);
        toy.style.transform = `translate(${x - 21 - label.width + distance * flight}px, ${y - 5 - label.height / 2 - 4 * Math.min(75, label.top - 20) * flight * (1-flight) + 16 * flight}px) rotate(${shake * 24 + flight * 330}deg)`;
        toy.style.opacity = String(Math.min(1, (1 - flight) * 5));
      } else if (toy) {
        toy.remove();
        toy = null;
        word.classList.remove('in-mouth');
      }
      sprite.style.transform = `translate(${x - 27}px, calc(${y}px - 100%)) scale(${facing * scale}, ${scale})`;
      if (t === 1) {
        previousScale = s.scale;
        startTime = undefined;
        if (++index === steps.length) return settle();
      }
      frameId = requestAnimationFrame(tick);
    }
    tick(performance.now());
  }

  button.disabled = false;
  settle();
  button.addEventListener('click', wake);
  for (const event of ['resize', 'scroll', 'pagehide']) {
    window.addEventListener(event, settle, { passive: true });
  }
  motion.addEventListener('change', settle);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') settle(); });
})();
