const API_BASE = "http://localhost:5000/api";
const LS_FILTER_KEY = "todo.filters.v1";
const LS_SUMMARY_KEY = "todo.summary.v1";

let tasks = [];
let currentFilters = { q: "", status: "", tag: "", sort: "created_at", order: "desc" };

const elTaskList = document.getElementById("task-list");
const elSummaryPending = document.getElementById("summary-pending");
const elSummaryDone = document.getElementById("summary-done");
const elSummaryTotal = document.getElementById("summary-total");

const elSearch = document.getElementById("search-input");
const elStatusFilter = document.getElementById("status-filter");
const elTagFilter = document.getElementById("tag-filter");
const elSortSelect = document.getElementById("sort-select");
const btnApply = document.getElementById("btn-apply-filter");
const btnClear = document.getElementById("btn-clear-filter");

const btnOpenModal = document.getElementById("btn-open-modal");
const modal = document.getElementById("task-modal");
const btnModalClose = document.getElementById("modal-close");
const btnCancel = document.getElementById("btn-cancel");
const modalTitle = document.getElementById("modal-title");

const form = document.getElementById("task-form");
const inId = document.getElementById("task-id");
const inTitle = document.getElementById("task-title");
const inDesc = document.getElementById("task-desc");
const inDue = document.getElementById("task-due");
const inPriority = document.getElementById("task-priority");
const inTags = document.getElementById("task-tags");

const appShell = document.getElementById("app-shell");
let lastActiveElement = null;

/* ---------- Init ---------- */
restoreFiltersToUI();
// บังคับค่าเริ่มต้นให้ "คงค้าง" ทุกครั้งที่เข้า/รีเฟรช
elStatusFilter.value = "todo";
applyFiltersFromUI();
saveFilters();

// แสดงสรุปครั้งล่าสุดที่จำไว้ ทันที (ก่อนโหลดจริง)
renderSummaryFromCache();

attachEvents();
loadTasks();

/* ---------- Events ---------- */
function attachEvents() {
  btnOpenModal.addEventListener("click", () => openModal());
  btnModalClose.addEventListener("click", closeModal);
  btnCancel.addEventListener("click", closeModal);
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal(); });

  btnApply.addEventListener("click", () => { applyFiltersFromUI(); saveFilters(); loadTasks(); });
  btnClear.addEventListener("click", () => {
    elSearch.value = ""; elStatusFilter.value = "todo";
    elTagFilter.value = ""; elSortSelect.value = "created_at|desc";
    applyFiltersFromUI(); saveFilters(); loadTasks();
  });
  [elSearch, elStatusFilter, elTagFilter, elSortSelect].forEach(inp => {
    inp.addEventListener("change", () => { applyFiltersFromUI(); saveFilters(); });
  });
  form.addEventListener("submit", onSubmitTaskForm);
}

/* ---------- Filters ---------- */
function applyFiltersFromUI() {
  const [sort, order] = (elSortSelect.value || "created_at|desc").split("|");
  currentFilters = {
    ...currentFilters,
    q: elSearch.value.trim(),
    status: elStatusFilter.value,
    tag: elTagFilter.value.trim(),
    sort, order
  };
}
function restoreFiltersToUI() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_FILTER_KEY));
    if (!saved) return;
    elSearch.value = saved.q || "";
    elStatusFilter.value = saved.status || "";
    elTagFilter.value = saved.tag || "";
    elSortSelect.value = `${saved.sort || "created_at"}|${saved.order || "desc"}`;
  } catch { }
}
function saveFilters() { localStorage.setItem(LS_FILTER_KEY, JSON.stringify(currentFilters)); }

/* ---------- Summary cache ---------- */
function renderSummaryFromCache() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_SUMMARY_KEY));
    if (!saved) return;
    if (typeof saved.pending === "number") elSummaryPending.textContent = saved.pending;
    if (typeof saved.done === "number") elSummaryDone.textContent = saved.done;
    if (typeof saved.total === "number") elSummaryTotal.textContent = saved.total;
  } catch { }
}
function saveSummaryToCache({ pending, done, total }) {
  try {
    localStorage.setItem(LS_SUMMARY_KEY, JSON.stringify({ pending, done, total }));
  } catch { }
}

/* ---------- API helpers (พร้อม error message ที่ชัดเจน) ---------- */
async function apiGetTasks(q) {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => { if (v !== undefined && v !== null && String(v).trim() !== "") params.append(k, v); });
  const url = `${API_BASE}/tasks${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(`Unexpected response (${res.status}) ${text.slice(0, 120)}`);
  }
  const data = await res.json();
  if (!res.ok || data.ok === false) { throw new Error(data?.error?.message || `โหลดงานล้มเหลว (${res.status})`); }
  return data.data || [];
}

async function apiCreateTask(payload) {
  try {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const text = await res.text().catch(() => "");
      throw new Error(`Unexpected response (${res.status}) ${text.slice(0, 120)}`);
    }
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      throw new Error(data?.error?.message || `สร้างงานล้มเหลว (${res.status})`);
    }
    return data.data;
  } catch (e) {
    if (e.message.includes("Failed to fetch") || e.name === "TypeError") {
      throw new Error("เชื่อมต่อแบ็กเอนด์ไม่สำเร็จ (connection dropped / ERR_EMPTY_RESPONSE)");
    }
    throw e;
  }
}

async function apiUpdateTask(id, payload) {
  try {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      throw new Error(data?.error?.message || `อัปเดตงานล้มเหลว (${res.status})`);
    }
    return data.data;
  } catch (e) {
    if (e.message.includes("Failed to fetch") || e.name === "TypeError") {
      throw new Error("เชื่อมต่อแบ็กเอนด์ไม่สำเร็จ (connection dropped / ERR_EMPTY_RESPONSE)");
    }
    throw e;
  }
}


async function apiToggleTask(id) {
  const res = await fetch(`${API_BASE}/tasks/${id}/toggle`, { method: "PATCH" });
  const data = await res.json();
  if (!res.ok || data.ok === false) { throw new Error(data?.error?.message || `สลับสถานะล้มเหลว (${res.status})`); }
  return data.data;
}

async function apiDeleteTask(id) {
  const res = await fetch(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
  if (res.status === 204) return true;
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) { throw new Error(data?.error?.message || `ลบงานล้มเหลว (${res.status})`); }
  return true;
}

/* ---------- Load & Render ---------- */
async function loadTasks() {
  try {
    tasks = await apiGetTasks(currentFilters);
    renderSummary(tasks);
  } catch (e) {
    console.error(e);
    // แสดงข้อความใน list แทน และคงค่า summary ล่าสุดไว้
    elTaskList.innerHTML = `<div class="empty">โหลดไม่สำเร็จ: ${escapeHtml(e.message || "Unknown error")}</div>`;
  }
  renderTasks(tasks || []);
}

function renderSummary(list) {
  const total = list.length;
  const done = list.filter(t => t.status === "done").length;
  const pending = total - done;

  elSummaryTotal.textContent = total;
  elSummaryDone.textContent = done;
  elSummaryPending.textContent = pending;

  saveSummaryToCache({ pending, done, total });
}

function renderTasks(list) {
  if (!list.length) {
    elTaskList.innerHTML = "<div class='empty'>ไม่มีงาน</div>";
    return;
  }
  elTaskList.innerHTML = list.map(taskToCardHTML).join("");
  list.forEach(t => {
    document.querySelector(`#chk-${t.id}`).onchange = () => onToggleTask(t.id);
    document.querySelector(`#edit-${t.id}`).onclick = () => openModal(t);
    document.querySelector(`#del-${t.id}`).onclick = () => onDeleteTask(t.id);
  });
}

function taskToCardHTML(t) {
  const isDone = t.status === "done";
  return `
    <article class="task-card">
      <div class="task-head">
        <div class="task-title">
          <input id="chk-${t.id}" type="checkbox" ${isDone ? "checked" : ""}>
          <div class="title-text ${isDone ? "title-done" : ""}">${escapeHtml(t.title || "")}</div>
        </div>
        <div class="task-actions">
          <button id="edit-${t.id}" class="btn small">แก้ไข</button>
          <button id="del-${t.id}" class="btn small ghost">ลบ</button>
        </div>
      </div>
      <div class="task-meta">
        ${t.due_date ? `<span class="badge ${dueDateBadge(t.due_date).cls}">ครบกำหนด: ${escapeHtml(t.due_date)}</span>` : ""}
        ${priorityBadge(t.priority).html}
        ${(t.tags || "").split(",").map(s => s.trim()).filter(Boolean).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
    </article>`;
}

function dueDateBadge(d) {
  if (!d) return { cls: "", status: "none" };
  const today = new Date(), due = new Date(d + "T00:00:00");
  const diff = (due - today) / (1000 * 60 * 60 * 24);
  if (diff < -0.1) return { cls: "overdue", status: "overdue" };
  if (diff <= 3) return { cls: "due-soon", status: "soon" };
  return { cls: "", status: "future" };
}
function priorityBadge(p) {
  const map = { 2: { cls: "priority-2", label: "ด่วน" }, 1: { cls: "priority-1", label: "สูง" }, 0: { cls: "priority-0", label: "ปกติ" } };
  const m = map[Number(p) || 0];
  return { html: `<span class="badge ${m.cls}">ความสำคัญ: ${m.label}</span>` };
}

/* ---------- Modal ---------- */
function openModal(task = null) {
  if (task) {
    modalTitle.textContent = "แก้ไขงาน";
    inId.value = task.id || ""; inTitle.value = task.title || "";
    inDesc.value = task.description || ""; inDue.value = task.due_date || "";
    inPriority.value = String(task.priority ?? 0); inTags.value = task.tags || "";
  } else {
    modalTitle.textContent = "เพิ่มงาน"; form.reset(); inId.value = "";
  }
  lastActiveElement = document.activeElement;

  modal.classList.remove("hidden");
  requestAnimationFrame(() => modal.classList.add("show"));

  appShell.setAttribute("inert", ""); appShell.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "hidden";

  modal.querySelector(".modal-content")?.focus();
  setTimeout(() => inTitle.focus(), 30);
}
function closeModal() {
  modal.classList.remove("show");
  setTimeout(() => modal.classList.add("hidden"), 180);

  appShell.removeAttribute("inert"); appShell.removeAttribute("aria-hidden");
  document.body.style.overflow = "";

  if (lastActiveElement) setTimeout(() => lastActiveElement.focus(), 0);
}

/* ---------- Form ---------- */
async function onSubmitTaskForm(e) {
  e.preventDefault();
  const id = inId.value.trim();
  const payload = {
    title: inTitle.value.trim(),
    description: inDesc.value.trim(),
    due_date: inDue.value || null,
    priority: Number(inPriority.value || 0),
    tags: (inTags.value || "").trim()
  };
  if (!payload.title) { alert("กรอกหัวข้องาน"); return; }
  try {
    if (id) await apiUpdateTask(id, payload);
    else await apiCreateTask(payload);
    closeModal(); loadTasks();
  } catch (err) {
    alert(err.message || "บันทึกไม่สำเร็จ");
  }
}

/* ---------- Actions ---------- */
async function onToggleTask(id) { try { await apiToggleTask(id); await loadTasks(); } catch (e) { alert(e.message); } }
async function onDeleteTask(id) { if (confirm("ลบงานนี้?")) { try { await apiDeleteTask(id); await loadTasks(); } catch (e) { alert(e.message); } } }

/* ---------- Utils ---------- */
function escapeHtml(str = "") { return str.replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
