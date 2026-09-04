"use strict";

const API_BASE = "https://api.frankfurter.dev/v1";
const CACHE_KEY = "dolar-mx-cache-v1";
const TIME_ZONE = "America/Merida";

const state = {
  rate: null,
  points: [],
  direction: "USD_MXN",
  period: 30,
};

const elements = {
  rate: document.querySelector("#current-rate"),
  change: document.querySelector("#rate-change"),
  date: document.querySelector("#rate-date"),
  status: document.querySelector("#market-status"),
  statusText: document.querySelector("#status-text"),
  refresh: document.querySelector("#refresh-button"),
  amount: document.querySelector("#amount-input"),
  result: document.querySelector("#conversion-result"),
  fromLabel: document.querySelector("#from-label"),
  fromCode: document.querySelector("#from-code"),
  toLabel: document.querySelector("#to-label"),
  swap: document.querySelector("#swap-button"),
  summary: document.querySelector("#chart-summary"),
  chartDescription: document.querySelector("#chart-description"),
  chartGrid: document.querySelector("#chart-grid"),
  chartArea: document.querySelector("#chart-area"),
  chartLine: document.querySelector("#chart-line"),
  chartLabels: document.querySelector("#chart-labels"),
  chartHighlight: document.querySelector("#chart-highlight"),
  chartLoading: document.querySelector("#chart-loading"),
  high: document.querySelector("#period-high"),
  highDate: document.querySelector("#period-high-date"),
  low: document.querySelector("#period-low"),
  lowDate: document.querySelector("#period-low-date"),
  average: document.querySelector("#period-average"),
  periodLabel: document.querySelector("#period-label"),
  updateTime: document.querySelector("#update-time"),
  periodButtons: [...document.querySelectorAll("[data-period]")],
};

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rateFormat = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const dateFormat = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const shortDateFormat = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "numeric", month: "short" });
const localDateTimeFormat = new Intl.DateTimeFormat("es-MX", { timeZone: TIME_ZONE, dateStyle: "medium", timeStyle: "short" });

function parseDate(dateString) {
  return new Date(`${dateString}T12:00:00Z`);
}

function isoDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function fetchJSON(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`La fuente respondió con estado ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function setStatus(type, message) {
  elements.status.className = `market-status ${type}`;
  elements.statusText.textContent = message;
}

function setLoading(loading) {
  elements.refresh.disabled = loading;
  elements.refresh.classList.toggle("loading", loading);
  elements.chartLoading.classList.toggle("hidden", !loading);
}

function saveCache(payload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), ...payload }));
  } catch (_) {
    // The app remains usable when storage is unavailable.
  }
}

function readCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (!parsed?.points?.length || Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function normalizePoints(data) {
  return Object.entries(data.rates || {})
    .map(([date, rates]) => ({ date, value: Number(rates.MXN) }))
    .filter((point) => Number.isFinite(point.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function loadRates({ force = false } = {}) {
  setLoading(true);
  setStatus("", "Consultando la fuente…");

  try {
    const bufferDays = Math.ceil(state.period * 1.55);
    const historyURL = `${API_BASE}/${isoDaysAgo(bufferDays)}..?base=USD&symbols=MXN`;
    const data = await fetchJSON(historyURL);
    const allPoints = normalizePoints(data);
    if (allPoints.length < 2) throw new Error("No hay suficiente historial disponible");

    state.points = allPoints.slice(-state.period);
    state.rate = state.points.at(-1).value;
    saveCache({ points: allPoints, sourceDate: state.points.at(-1).date });
    renderAll();
    setStatus("online", "Datos actualizados");
    elements.updateTime.textContent = `Consulta realizada ${localDateTimeFormat.format(new Date())} (hora de Mérida).`;
  } catch (error) {
    const cached = readCache();
    if (cached) {
      state.points = cached.points.slice(-state.period);
      state.rate = state.points.at(-1).value;
      renderAll();
      setStatus("cached", "Mostrando última consulta guardada");
      elements.updateTime.textContent = `Última consulta guardada: ${localDateTimeFormat.format(new Date(cached.savedAt))} (hora de Mérida).`;
    } else {
      setStatus("error", "No fue posible obtener los datos");
      elements.summary.textContent = "Intenta actualizar de nuevo en unos momentos.";
      elements.updateTime.textContent = "No hay una consulta anterior guardada en este dispositivo.";
    }
    if (force) elements.refresh.focus({ preventScroll: true });
  } finally {
    setLoading(false);
  }
}

function renderAll() {
  const latest = state.points.at(-1);
  const previous = state.points.at(-2);
  if (!latest || !previous) return;

  const delta = latest.value - previous.value;
  const percent = (delta / previous.value) * 100;
  elements.rate.textContent = rateFormat.format(latest.value);
  elements.date.textContent = `Dato del ${dateFormat.format(parseDate(latest.date))}`;
  elements.change.className = `change ${delta > 0 ? "up" : delta < 0 ? "down" : "neutral"}`;
  elements.change.textContent = `${delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} ${delta >= 0 ? "+" : ""}${delta.toFixed(4)} · ${percent >= 0 ? "+" : ""}${percent.toFixed(2)}% vs. día hábil anterior`;

  renderConversion();
  renderStats();
  renderChart();
}

function renderConversion() {
  const amount = Math.max(0, Number(elements.amount.value) || 0);
  if (!state.rate) {
    elements.result.textContent = "—";
    return;
  }

  if (state.direction === "USD_MXN") {
    elements.fromLabel.textContent = "Dólares estadounidenses";
    elements.fromCode.textContent = "USD";
    elements.toLabel.textContent = "Pesos mexicanos";
    elements.result.textContent = mxn.format(amount * state.rate);
  } else {
    elements.fromLabel.textContent = "Pesos mexicanos";
    elements.fromCode.textContent = "MXN";
    elements.toLabel.textContent = "Dólares estadounidenses";
    elements.result.textContent = usd.format(amount / state.rate);
  }
}

function renderStats() {
  const high = state.points.reduce((best, point) => point.value > best.value ? point : best);
  const low = state.points.reduce((best, point) => point.value < best.value ? point : best);
  const average = state.points.reduce((sum, point) => sum + point.value, 0) / state.points.length;
  elements.high.textContent = mxn.format(high.value);
  elements.highDate.textContent = dateFormat.format(parseDate(high.date));
  elements.low.textContent = mxn.format(low.value);
  elements.lowDate.textContent = dateFormat.format(parseDate(low.date));
  elements.average.textContent = mxn.format(average);
  elements.periodLabel.textContent = state.period === 180 ? "Últimos 6 meses" : `Últimos ${state.period} días hábiles`;
}

function renderChart() {
  const width = 720;
  const height = 280;
  const padding = { top: 28, right: 22, bottom: 36, left: 58 };
  const values = state.points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.01);
  const yMin = min - range * 0.12;
  const yMax = max + range * 0.12;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const x = (index) => padding.left + (index / Math.max(state.points.length - 1, 1)) * innerWidth;
  const y = (value) => padding.top + ((yMax - value) / (yMax - yMin)) * innerHeight;
  const coords = state.points.map((point, index) => [x(index), y(point.value)]);
  const linePath = coords.map(([cx, cy], index) => `${index ? "L" : "M"}${cx.toFixed(2)},${cy.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L${coords.at(-1)[0].toFixed(2)},${(height - padding.bottom).toFixed(2)} L${coords[0][0].toFixed(2)},${(height - padding.bottom).toFixed(2)} Z`;

  elements.chartGrid.innerHTML = "";
  elements.chartLabels.innerHTML = "";
  elements.chartHighlight.innerHTML = "";

  if (!document.querySelector("#area-gradient")) {
    const defs = svgElement("defs");
    const gradient = svgElement("linearGradient", { id: "area-gradient", x1: "0", y1: "0", x2: "0", y2: "1" });
    gradient.append(svgElement("stop", { offset: "0%", "stop-color": "#5ed9ff", "stop-opacity": ".32" }));
    gradient.append(svgElement("stop", { offset: "100%", "stop-color": "#5ed9ff", "stop-opacity": "0" }));
    defs.append(gradient);
    document.querySelector("#rate-chart").prepend(defs);
  }

  for (let index = 0; index < 4; index += 1) {
    const gridY = padding.top + (index / 3) * innerHeight;
    const labelValue = yMax - (index / 3) * (yMax - yMin);
    elements.chartGrid.append(svgElement("line", { x1: padding.left, x2: width - padding.right, y1: gridY, y2: gridY, class: "chart-grid-line" }));
    const label = svgElement("text", { x: padding.left - 10, y: gridY + 4, "text-anchor": "end", class: "chart-grid-label" });
    label.textContent = labelValue.toFixed(2);
    elements.chartLabels.append(label);
  }

  const dateIndexes = [...new Set([0, Math.floor((state.points.length - 1) / 2), state.points.length - 1])];
  dateIndexes.forEach((index) => {
    const label = svgElement("text", { x: x(index), y: height - 10, "text-anchor": index === 0 ? "start" : index === state.points.length - 1 ? "end" : "middle", class: "chart-date-label" });
    label.textContent = shortDateFormat.format(parseDate(state.points[index].date));
    elements.chartLabels.append(label);
  });

  elements.chartLine.setAttribute("d", linePath);
  elements.chartArea.setAttribute("d", areaPath);

  const latest = state.points.at(-1);
  const latestCoord = coords.at(-1);
  elements.chartHighlight.append(svgElement("circle", { cx: latestCoord[0], cy: latestCoord[1], r: 5, class: "chart-point" }));
  const valueLabel = svgElement("text", { x: latestCoord[0] - 8, y: latestCoord[1] - 13, "text-anchor": "end", class: "chart-point-label" });
  valueLabel.textContent = latest.value.toFixed(4);
  elements.chartHighlight.append(valueLabel);

  const first = state.points[0];
  const periodDelta = ((latest.value - first.value) / first.value) * 100;
  const periodText = state.period === 180 ? "seis meses" : `${state.period} días hábiles`;
  elements.summary.textContent = `${periodDelta >= 0 ? "Subió" : "Bajó"} ${Math.abs(periodDelta).toFixed(2)}% en los últimos ${periodText}.`;
  elements.chartDescription.textContent = `El tipo de cambio pasó de ${first.value.toFixed(4)} a ${latest.value.toFixed(4)} pesos por dólar; ${elements.summary.textContent.toLowerCase()}`;
}

function svgElement(tag, attributes = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

elements.amount.addEventListener("input", renderConversion);
elements.swap.addEventListener("click", () => {
  state.direction = state.direction === "USD_MXN" ? "MXN_USD" : "USD_MXN";
  renderConversion();
  elements.amount.focus();
});
elements.refresh.addEventListener("click", () => loadRates({ force: true }));
elements.periodButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const period = Number(button.dataset.period);
    if (period === state.period) return;
    state.period = period;
    elements.periodButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    loadRates();
  });
});

loadRates();
