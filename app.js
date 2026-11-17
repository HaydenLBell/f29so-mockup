const stations = {
  inverness: { name: "Inverness", x: 158.7, y: 93.2, label: "left" },
  aberdeen: { name: "Aberdeen", x: 232.5, y: 113.0, label: "right" },
  edinburgh: { name: "Edinburgh", x: 194.6, y: 185.0, label: "right" },
  glasgow: { name: "Glasgow", x: 157.6, y: 190.4, label: "left" },
  newcastle: { name: "Newcastle", x: 249.6, y: 243.8, label: "right" },
  manchester: { name: "Manchester", x: 227.7, y: 333.2, label: "left" },
  birmingham: { name: "Birmingham", x: 239.9, y: 393.2, label: "right" },
  cardiff: { name: "Cardiff", x: 194.9, y: 453.2, label: "left" },
  london: { name: "London", x: 301.2, y: 451.4, label: "right" }
};

const routes = [
  { a: "inverness", b: "aberdeen", train: { minutes: 135, price: 32 }, bus: { minutes: 195, price: 18 } },
  { a: "inverness", b: "edinburgh", train: { minutes: 210, price: 45 }, bus: { minutes: 240, price: 22 } },
  { a: "inverness", b: "glasgow", bus: { minutes: 225, price: 21 } },
  { a: "aberdeen", b: "edinburgh", train: { minutes: 150, price: 38 }, bus: { minutes: 180, price: 20 } },
  { a: "edinburgh", b: "glasgow", train: { minutes: 50, price: 15 }, bus: { minutes: 75, price: 8 } },
  { a: "edinburgh", b: "newcastle", train: { minutes: 90, price: 35 }, bus: { minutes: 165, price: 16 } },
  { a: "glasgow", b: "manchester", train: { minutes: 210, price: 55 }, bus: { minutes: 300, price: 25 } },
  { a: "newcastle", b: "manchester", train: { minutes: 150, price: 30 }, bus: { minutes: 240, price: 17 } },
  { a: "newcastle", b: "london", train: { minutes: 170, price: 70 } },
  { a: "manchester", b: "birmingham", train: { minutes: 90, price: 28 }, bus: { minutes: 150, price: 12 } },
  { a: "manchester", b: "london", train: { minutes: 130, price: 75 }, bus: { minutes: 270, price: 22 } },
  { a: "birmingham", b: "london", train: { minutes: 85, price: 45 }, bus: { minutes: 165, price: 14 } },
  { a: "birmingham", b: "cardiff", train: { minutes: 120, price: 30 }, bus: { minutes: 165, price: 15 } },
  { a: "cardiff", b: "london", train: { minutes: 120, price: 55 }, bus: { minutes: 210, price: 18 } }
];

const changeMinutes = 10;

const state = {
  mode: "train",
  from: null,
  to: null,
  day: 0,
  booking: null,
  tickets: []
};

const map = document.getElementById("map");
const panel = document.getElementById("panel");
const modal = document.getElementById("modal");
const modalContent = document.getElementById("modal-content");

function findRoute(first, second) {
  return routes.find(route =>
    (route.a === first && route.b === second) || (route.a === second && route.b === first)
  );
}

function connectionsFrom(id) {
  return routes
    .filter(route => route[state.mode] && (route.a === id || route.b === id))
    .map(route => (route.a === id ? route.b : route.a));
}

function shortestPath(start, end) {
  const minutes = {};
  const previous = {};
  const unvisited = Object.keys(stations);
  for (const id of unvisited) {
    minutes[id] = Infinity;
  }
  minutes[start] = 0;

  while (unvisited.length > 0) {
    unvisited.sort((first, second) => minutes[first] - minutes[second]);
    const current = unvisited.shift();
    if (current === end || minutes[current] === Infinity) break;

    for (const next of connectionsFrom(current)) {
      const total = minutes[current] + findRoute(current, next)[state.mode].minutes;
      if (total < minutes[next]) {
        minutes[next] = total;
        previous[next] = current;
      }
    }
  }

  if (minutes[end] === Infinity) return null;

  const path = [end];
  while (path[0] !== start) {
    path.unshift(previous[path[0]]);
  }
  return path;
}

function pathRoutes(path) {
  const result = [];
  for (let i = 0; i < path.length - 1; i++) {
    result.push(findRoute(path[i], path[i + 1]));
  }
  return result;
}

function pathTotals(path) {
  let minutes = 0;
  let price = 0;
  for (const route of pathRoutes(path)) {
    minutes += route[state.mode].minutes;
    price += route[state.mode].price;
  }
  return { minutes, price };
}

function changesText(path) {
  const stops = path.slice(1, -1).map(id => stations[id].name);
  if (stops.length === 0) return "Direct";
  const label = stops.length === 1 ? "1 change" : stops.length + " changes";
  return label + " at " + stops.join(", ");
}

function departures(route) {
  const offset = (routes.indexOf(route) * 7) % 30;
  const first = state.mode === "train" ? 6 * 60 : 7 * 60;
  const gap = state.mode === "train" ? 60 : 120;
  const times = [];
  for (let time = first + offset; time <= 23 * 60; time += gap) {
    times.push(time);
  }
  return times;
}

function journeyOptions(path) {
  const routesOnPath = pathRoutes(path);
  const options = [];

  for (const firstDeparture of departures(routesOnPath[0])) {
    const legs = [];
    let readyAt = firstDeparture;

    for (let i = 0; i < routesOnPath.length; i++) {
      const route = routesOnPath[i];
      const depart = departures(route).find(time => time >= readyAt);
      if (depart === undefined) break;

      const trip = route[state.mode];
      legs.push({ from: path[i], to: path[i + 1], depart: depart, arrive: depart + trip.minutes, price: trip.price });
      readyAt = depart + trip.minutes + changeMinutes;
    }

    if (legs.length === routesOnPath.length) {
      options.push({
        legs: legs,
        depart: legs[0].depart,
        arrive: legs[legs.length - 1].arrive,
        price: legs.reduce((sum, leg) => sum + leg.price, 0),
        changes: changesText(path)
      });
    }
  }

  return options.filter((option, index) =>
    index === options.length - 1 || option.arrive !== options[index + 1].arrive
  );
}

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const nextDay = minutes >= 24 * 60 ? " (next day)" : "";
  return String(hours).padStart(2, "0") + ":" + String(mins).padStart(2, "0") + nextDay;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return mins + " min";
  if (mins === 0) return hours + "h";
  return hours + "h " + mins + "m";
}

function formatPrice(price) {
  return "£" + price.toFixed(2);
}

function travelDate(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function modeName(mode) {
  return mode === "train" ? "Train" : "Bus";
}

function drawMap() {
  const chosenPath = state.to ? shortestPath(state.from, state.to) : [];
  const chosenRoutes = state.to ? pathRoutes(chosenPath) : [];
  map.setAttribute("class", state.mode);

  document.getElementById("routes").innerHTML = routes
    .filter(route => route[state.mode])
    .map(route => {
      const start = stations[route.a];
      const end = stations[route.b];
      let classes = "route";
      if (chosenRoutes.includes(route)) classes += " active chosen " + state.mode;
      else if (!state.to && (state.from === route.a || state.from === route.b)) classes += " active " + state.mode;
      return `<line class="${classes}" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"/>`;
    })
    .join("");

  document.getElementById("stops").innerHTML = Object.entries(stations)
    .map(([id, station]) => {
      let classes = "stop";
      if (id === state.from) classes += " origin";
      else if (id === state.to) classes += " destination";
      else if (chosenPath.includes(id)) classes += " reachable";
      else if (state.from && !state.to) classes += " reachable";
      const left = station.label === "left";
      const textX = left ? station.x - 12 : station.x + 12;
      const anchor = left ? "end" : "start";
      return `
        <g class="${classes}" data-id="${id}">
          <circle cx="${station.x}" cy="${station.y}" r="8"/>
          <text x="${textX}" y="${station.y + 4}" text-anchor="${anchor}">${station.name}</text>
        </g>`;
    })
    .join("");
}

function modeToggle() {
  return `
    <div class="segmented">
      <button data-action="mode" data-value="train" class="${state.mode === "train" ? "selected" : ""}">Train</button>
      <button data-action="mode" data-value="bus" class="${state.mode === "bus" ? "selected" : ""}">Bus</button>
    </div>`;
}

function originStep() {
  const rows = Object.entries(stations)
    .map(([id, station]) => `
      <button class="row" data-action="stop" data-value="${id}">
        <strong>${station.name}</strong>
        <span class="muted">${connectionsFrom(id).length} direct routes</span>
      </button>`)
    .join("");

  return `
    <p class="step">Step 1 of 3</p>
    <h2>Where are you starting from?</h2>
    <p class="muted">Tap a stop on the map, or pick one below.</p>
    <div class="list">${rows}</div>`;
}

function destinationStep() {
  const rows = Object.keys(stations)
    .filter(id => id !== state.from)
    .map(id => ({ id: id, path: shortestPath(state.from, id) }))
    .filter(item => item.path)
    .map(item => ({ ...item, totals: pathTotals(item.path) }))
    .sort((first, second) => first.totals.minutes - second.totals.minutes)
    .map(item => `
      <button class="row" data-action="stop" data-value="${item.id}">
        <span>
          <strong>${stations[item.id].name}</strong>
          <small>${changesText(item.path)}, about ${formatDuration(item.totals.minutes)}</small>
        </span>
        <span class="price">from ${formatPrice(item.totals.price)}</span>
      </button>`)
    .join("");

  return `
    <p class="step">Step 2 of 3</p>
    <h2>From ${stations[state.from].name}, where to?</h2>
    <p class="muted">Pick any stop. If there is no direct ${state.mode}, the quickest route with changes is planned for you.</p>
    <div class="list">${rows}</div>
    <button class="link" data-action="reset">Change starting point</button>`;
}

function timesStep() {
  const path = shortestPath(state.from, state.to);

  const days = [0, 1, 2]
    .map(day => {
      const label = day === 0 ? "Today" : day === 1 ? "Tomorrow" : travelDate(day);
      return `<button class="chip ${state.day === day ? "selected" : ""}" data-action="day" data-value="${day}">${label}</button>`;
    })
    .join("");

  const options = journeyOptions(path);
  const rows = options
    .map((journey, index) => `
      <button class="row" data-action="depart" data-value="${index}">
        <span>
          <span class="time">${formatTime(journey.depart)}</span>
          <small>Arrives ${formatTime(journey.arrive)}, ${formatDuration(journey.arrive - journey.depart)}</small>
          <small>${journey.changes}</small>
        </span>
        <span class="price">${formatPrice(journey.price)}</span>
      </button>`)
    .join("");

  return `
    <p class="step">Step 3 of 3</p>
    <h2>${stations[state.from].name} to ${stations[state.to].name}</h2>
    <p class="muted"><span class="badge ${state.mode}">${modeName(state.mode)}</span> ${changesText(path)}. Choose a departure time.</p>
    <div class="chips">${days}</div>
    <div class="list">${rows || `<p class="muted">No journeys can be completed in one day on this route.</p>`}</div>
    <button class="link" data-action="back">Change destination</button>`;
}

function renderPanel() {
  let content = modeToggle();
  if (!state.from) content += originStep();
  else if (!state.to) content += destinationStep();
  else content += timesStep();
  panel.innerHTML = content;
}

function update() {
  drawMap();
  renderPanel();
}

function selectStop(id) {
  if (id === state.from) {
    state.from = null;
    state.to = null;
  } else if (state.from && shortestPath(state.from, id)) {
    state.to = id;
  } else {
    state.from = id;
    state.to = null;
  }
  update();
}

function setMode(mode) {
  state.mode = mode;
  if (state.to && !shortestPath(state.from, state.to)) state.to = null;
  update();
}

function makeRandom(seed) {
  let value = 1;
  for (const char of seed) {
    value = (value * 31 + char.charCodeAt(0)) % 2147483647;
  }
  return function () {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

function finderPattern(x, y) {
  return `
    <rect x="${x}" y="${y}" width="7" height="7"/>
    <rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/>
    <rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
}

function fakeQrCode(text) {
  const size = 25;
  const random = makeRandom(text);
  let cells = "";

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const top = row < 8;
      const left = col < 8;
      const right = col >= size - 8;
      const bottom = row >= size - 8;
      const inCorner = (top && left) || (top && right) || (bottom && left);
      if (!inCorner && random() > 0.5) {
        cells += `<rect x="${col}" y="${row}" width="1" height="1"/>`;
      }
    }
  }

  return `
    <svg class="qr" viewBox="-2 -2 ${size + 4} ${size + 4}">
      <rect x="-2" y="-2" width="${size + 4}" height="${size + 4}" fill="#fff"/>
      ${cells}
      ${finderPattern(0, 0)}
      ${finderPattern(size - 7, 0)}
      ${finderPattern(0, size - 7)}
    </svg>`;
}

function legsList(journey) {
  const items = journey.legs
    .map(leg => `
      <li>
        <strong>${formatTime(leg.depart)}</strong> ${stations[leg.from].name}
        to <strong>${formatTime(leg.arrive)}</strong> ${stations[leg.to].name}
      </li>`)
    .join("");
  return `<ol class="legs">${items}</ol>`;
}

function ticketCard(ticket, showQr) {
  return `
    <div class="ticket">
      <div class="ticket-head ${ticket.mode}">
        <small>${modeName(ticket.mode)} ticket, ${ticket.fare}</small>
        <h3>${stations[ticket.from].name} to ${stations[ticket.to].name}</h3>
      </div>
      <div class="ticket-body">
        <div class="details">
          <span><small>Date</small>${ticket.date}</span>
          <span><small>Paid</small>${formatPrice(ticket.price)}</span>
          <span><small>Departs</small>${formatTime(ticket.journey.depart)}</span>
          <span><small>Arrives</small>${formatTime(ticket.journey.arrive)}</span>
        </div>
        ${legsList(ticket.journey)}
        ${showQr
          ? fakeQrCode(ticket.reference) + `<p class="ticket-ref">Ref ${ticket.reference}. Valid for every leg of this journey.</p>`
          : `<button class="button secondary full" data-action="show-ticket" data-value="${ticket.reference}">Show QR code</button>`}
      </div>
    </div>`;
}

function renderTickets() {
  const list = document.getElementById("ticket-list");
  if (state.tickets.length === 0) {
    list.innerHTML = `<p class="muted">No tickets yet. Book a journey to see it here.</p>`;
    return;
  }
  list.innerHTML = state.tickets.map(ticket => ticketCard(ticket, false)).join("");
}

function openModal(content) {
  modalContent.innerHTML = content;
  modal.classList.add("open");
}

function closeModal() {
  modal.classList.remove("open");
}

function bookingPrice() {
  const single = state.booking.journey.price;
  return state.booking.fare === "return" ? single * 1.8 : single;
}

function showCheckout() {
  const booking = state.booking;
  const fareButton = (fare, label) =>
    `<button data-action="fare" data-value="${fare}" class="${booking.fare === fare ? "selected" : ""}">${label}</button>`;

  openModal(`
    <h2>Checkout</h2>
    <div class="summary">
      <div><span class="muted">Journey</span><strong>${stations[booking.from].name} to ${stations[booking.to].name}</strong></div>
      <div><span class="muted">Date</span><strong>${booking.date}</strong></div>
      <div><span class="muted">Travel by</span><strong>${modeName(booking.mode)}</strong></div>
      <div><span class="muted">Changes</span><strong>${booking.journey.changes}</strong></div>
    </div>
    ${legsList(booking.journey)}
    <h3>Ticket type</h3>
    <div class="segmented">
      ${fareButton("single", "Single")}
      ${fareButton("return", "Return")}
    </div>
    <h3>Payment</h3>
    <div class="fake-input">Visa ending 4242</div>
    <button class="button primary full" data-action="pay">Pay ${formatPrice(bookingPrice())}</button>
    <button class="button secondary full" data-action="close">Cancel</button>`);
}

function startBooking(index) {
  const path = shortestPath(state.from, state.to);
  state.booking = {
    from: state.from,
    to: state.to,
    mode: state.mode,
    date: travelDate(state.day),
    fare: "single",
    journey: journeyOptions(path)[index]
  };
  showCheckout();
}

function pay(button) {
  button.disabled = true;
  button.textContent = "Processing payment...";

  setTimeout(() => {
    const ticket = {
      ...state.booking,
      price: bookingPrice(),
      reference: "WP" + Math.floor(100000 + Math.random() * 900000)
    };
    state.tickets.unshift(ticket);
    renderTickets();

    openModal(`
      <h2 class="success">Payment successful</h2>
      <p class="muted">Your ticket has been added to My tickets.</p>
      ${ticketCard(ticket, true)}
      <button class="button primary full" data-action="view-tickets">View my tickets</button>
      <button class="button secondary full" data-action="close">Book another journey</button>`);
  }, 1200);
}

function showView(name) {
  document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
  document.getElementById(name + "-view").classList.add("active");
  document.querySelectorAll(".nav-link[data-view]").forEach(link => {
    link.classList.toggle("active", link.dataset.view === name);
  });
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
  document.getElementById(name + "-screen").classList.add("active");
}

map.addEventListener("click", event => {
  const stop = event.target.closest(".stop");
  if (stop) selectStop(stop.dataset.id);
});

panel.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const value = button.dataset.value;

  if (button.dataset.action === "mode") setMode(value);
  if (button.dataset.action === "stop") selectStop(value);
  if (button.dataset.action === "day") {
    state.day = Number(value);
    renderPanel();
  }
  if (button.dataset.action === "depart") startBooking(Number(value));
  if (button.dataset.action === "back") {
    state.to = null;
    update();
  }
  if (button.dataset.action === "reset") {
    state.from = null;
    state.to = null;
    update();
  }
});

modal.addEventListener("click", event => {
  if (event.target === modal) closeModal();
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const value = button.dataset.value;

  if (button.dataset.action === "fare") {
    state.booking.fare = value;
    showCheckout();
  }
  if (button.dataset.action === "pay") pay(button);
  if (button.dataset.action === "close") closeModal();
  if (button.dataset.action === "view-tickets") {
    closeModal();
    showView("tickets");
  }
});

document.getElementById("ticket-list").addEventListener("click", event => {
  const button = event.target.closest("[data-action='show-ticket']");
  if (!button) return;
  const ticket = state.tickets.find(item => item.reference === button.dataset.value);
  openModal(ticketCard(ticket, true) + `<button class="button secondary full" data-action="close">Close</button>`);
});

document.querySelectorAll(".nav-link[data-view]").forEach(link => {
  link.addEventListener("click", () => showView(link.dataset.view));
});

document.getElementById("login-button").addEventListener("click", () => showScreen("app"));

document.getElementById("logout-button").addEventListener("click", () => {
  closeModal();
  showView("plan");
  showScreen("login");
});

update();
renderTickets();
