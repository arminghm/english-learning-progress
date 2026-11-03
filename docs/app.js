const el = (id) => document.getElementById(id);
const num = (n) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(n);
const dateFa = (s) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(s + 'T12:00:00'));

function statusFor(id, sessions) {
  const found = sessions.filter(s => s.kind === 'assessment' && Number.isInteger(s.ratings?.[id])).reverse();
  if (found.length < 2) return { state: 'unknown', count: found.length, score: null };
  const score = (found[0].ratings[id] + found[1].ratings[id]) / 2;
  return { state: score >= 4 ? 'strong' : score <= 2 ? 'focus' : 'growing', count: found.length, score };
}

function skillCard(skill, status) {
  const labels = { strong: 'قوت', growing: 'در حال رشد', focus: 'نیازمند تمرین', unknown: 'دادهٔ ناکافی' };
  const card = document.createElement('article');
  card.className = 'skill';
  card.dataset.state = status.state;
  const top = document.createElement('div');
  top.className = 'skill-top';
  const title = document.createElement('span');
  title.className = 'skill-name';
  title.textContent = skill.label;
  const label = document.createElement('span');
  label.className = 'skill-status';
  label.textContent = labels[status.state];
  top.append(title, label);
  const meter = document.createElement('div');
  meter.className = 'skill-meter';
  const fill = document.createElement('div');
  fill.className = 'skill-fill';
  fill.style.width = (status.score === null ? 0 : status.score * 20) + '%';
  meter.append(fill);
  const meta = document.createElement('div');
  meta.className = 'skill-meta';
  meta.textContent = status.score === null
    ? num(status.count) + ' از ۲ سنجش مستقل'
    : 'امتیاز ' + num(status.score) + ' از ۵ · ' + num(status.count) + ' سنجش';
  card.append(top, meter, meta);
  return card;
}

function renderWeek(sessions) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const current = sessions.filter(s => {
    const d = new Date(s.date + 'T12:00:00');
    return d >= start && d < end;
  });
  const minutes = current.reduce((sum, s) => sum + s.minutes, 0);
  const target = 360;
  const copy = document.createElement('div');
  copy.className = 'week-copy';
  const a = document.createElement('span');
  a.textContent = num(current.length) + ' جلسه';
  const b = document.createElement('span');
  b.textContent = num(minutes) + ' / ' + num(target) + ' دقیقه';
  copy.append(a, b);
  const bar = document.createElement('div');
  bar.className = 'week-bar';
  const fill = document.createElement('span');
  fill.style.width = Math.min(100, minutes / target * 100) + '%';
  bar.append(fill);
  el('week-progress').append(copy, bar);
}

function svg(name, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function renderTrend(sessions, skills) {
  const wrap = el('trend');
  if (!sessions.length) {
    wrap.textContent = 'هنوز جلسه‌ای ثبت نشده است. روند تمرین پس از نخستین جلسه نمایش داده می‌شود.';
    return;
  }
  wrap.style.display = 'block';
  const select = document.createElement('select');
  select.className = 'trend-select';
  select.setAttribute('aria-label', 'انتخاب روند');
  select.add(new Option('زمان تمرین تجمعی', 'minutes'));
  for (const skill of skills) {
    if (sessions.some(s => Number.isInteger(s.ratings?.[skill.id]))) {
      select.add(new Option('امتیاز: ' + skill.label, skill.id));
    }
  }
  const chart = document.createElement('div');
  wrap.append(select, chart);
  function draw() {
    chart.replaceChildren();
    let total = 0;
    const points = select.value === 'minutes'
      ? sessions.map(s => ({ date: s.date, value: (total += s.minutes) / 60 }))
      : sessions.filter(s => Number.isInteger(s.ratings?.[select.value]))
        .map(s => ({ date: s.date, value: s.ratings[select.value] }));
    const width = 520, height = 190, left = 36, right = 12, top = 14, bottom = 33;
    const max = select.value === 'minutes' ? Math.max(1, ...points.map(p => p.value)) : 5;
    const canvas = svg('svg', { viewBox: '0 0 520 190', role: 'img',
      'aria-label': select.value === 'minutes' ? 'روند زمان تمرین' : 'روند امتیاز مهارت' });
    for (let i = 0; i <= 4; i++) {
      const y = top + (height - top - bottom) * i / 4;
      canvas.append(svg('line', { x1: left, y1: y, x2: width - right, y2: y, stroke: '#355052' }));
      const label = svg('text', { x: left - 7, y: y + 4, 'text-anchor': 'end' });
      label.textContent = num(max * (1 - i / 4));
      canvas.append(label);
    }
    const positions = points.map((p, i) => ({
      ...p,
      x: left + (points.length === 1 ? .5 : i / (points.length - 1)) * (width - left - right),
      y: top + (1 - p.value / max) * (height - top - bottom)
    }));
    if (positions.length > 1) canvas.append(svg('polyline', {
      points: positions.map(p => p.x + ',' + p.y).join(' '),
      fill: 'none', stroke: '#a8e5bc', 'stroke-width': 3,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));
    for (const p of positions) {
      const circle = svg('circle', { cx: p.x, cy: p.y, r: 5, fill: '#a8e5bc' });
      const tip = svg('title');
      tip.textContent = p.date + ': ' + num(p.value) + (select.value === 'minutes' ? ' ساعت' : ' از ۵');
      circle.append(tip);
      canvas.append(circle);
    }
    const first = svg('text', { x: left, y: height - 5, 'text-anchor': 'start' });
    first.textContent = points[0].date;
    canvas.append(first);
    if (points.length > 1) {
      const last = svg('text', { x: width - right, y: height - 5, 'text-anchor': 'end' });
      last.textContent = points.at(-1).date;
      canvas.append(last);
    }
    chart.append(canvas);
  }
  select.addEventListener('change', draw);
  draw();
}

function renderSessions(sessions) {
  const list = el('session-list');
  if (!sessions.length) {
    list.innerHTML = '<div class="empty"><strong>هنوز شاهدی ثبت نشده است.</strong><br>سنجش اولیه قوت و ضعف را از پاسخ واقعی شما مشخص می‌کند.</div>';
    return;
  }
  for (const s of [...sessions].reverse()) {
    const row = document.createElement('article');
    row.className = 'session';
    const time = document.createElement('time');
    time.dateTime = s.date;
    time.textContent = dateFa(s.date);
    const body = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = s.topic;
    const summary = document.createElement('p');
    summary.textContent = s.summary;
    const evidence = document.createElement('p');
    evidence.textContent = 'شاهد: ' + s.evidence;
    body.append(title, summary, evidence);
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = (s.kind === 'assessment' ? 'سنجش' : 'تمرین') + ' · ' + num(s.minutes) + ' دقیقه';
    row.append(time, body, tag);
    list.append(row);
  }
}

async function main() {
  try {
    const response = await fetch('./data/progress.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    const sessions = [...data.sessions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const results = data.skills.map(skill => ({ skill, ...statusFor(skill.id, sessions) }));
    el('session-count').textContent = num(sessions.length);
    el('total-hours').textContent = num(sessions.reduce((sum, s) => sum + s.minutes, 0) / 60);
    el('strength-count').textContent = num(results.filter(r => r.state === 'strong').length);
    el('focus-count').textContent = num(results.filter(r => r.state === 'focus').length);
    el('profile-line').textContent = 'سطح خوداظهاری: متوسط · تمرین روزانه: ' + num(data.profile.dailyMinutes) + ' دقیقه';
    el('skill-grid').append(...results.map(r => skillCard(r.skill, r)));
    renderWeek(sessions);
    renderTrend(sessions, data.skills);
    renderSessions(sessions);
    if (!sessions.some(s => s.kind === 'assessment')) {
      el('next-step').innerHTML = '<strong>سنجش اولیه را شروع کنید.</strong> به انگلیسی خودتان را در ۹۰ ثانیه معرفی کنید؛ سپس دربارهٔ یک پروژه، تصمیم فنی و تجربهٔ همکاری پاسخ دهید.';
    } else {
      el('next-step').textContent = sessions.at(-1).nextFocus;
    }
    el('last-updated').textContent = sessions.length
      ? 'آخرین جلسه: ' + dateFa(sessions.at(-1).date)
      : 'آماده برای سنجش اولیه';
  } catch (error) {
    el('next-step').textContent = 'داده‌ها بارگذاری نشدند. داشبورد را از خروجی build و از طریق وب‌سرور باز کنید.';
    console.error(error);
  }
}

main();
