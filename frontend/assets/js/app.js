const API_BASE = "/api";

const state = {
    token: localStorage.getItem("accessToken"),
    user: JSON.parse(localStorage.getItem("user") || "null"),
    pendingLogin: JSON.parse(localStorage.getItem("pendingLogin") || "null"),
};

const pageMeta = {
    dashboard: ["Command Center", "Role-aware clinical workspace for time-sensitive operational decisions."],
    patients: ["Patient Directory", "Register, find, and open longitudinal patient profiles."],
    "patient-details": ["Patient Profile", "Identity, QR verification, and high-level patient context."],
    records: ["Medical Records", "Create and review diagnosis, treatment, prescription, and care notes."],
    "care-team": ["Care Team Management", "Review assignments, add clinicians, and deactivate care-team membership."],
    vitals: ["Vitals Tracking", "Capture and review key physiological observations."],
    labs: ["Laboratory Results", "Record and review diagnostic test outcomes."],
    uploads: ["Secure Attachments", "Upload and retrieve patient-related clinical files."],
    audit: ["Compliance Audit", "Monitor access, authorization, and administrative activity."],
    "break-glass": ["Emergency Access", "Request and govern time-limited override access."],
    roles: ["Role Administration", "Create, edit, and govern system roles."],
    permissions: ["Permission Catalog", "Manage granular authorization capabilities."],
    "user-roles": ["User Role Assignment", "Assign or remove role memberships for users."],
};

const menuCatalog = {
    dashboard: ["dashboard.html", "Dashboard", "H"],
    patients: ["patients.html", "Patients", "+"],
    records: ["records.html", "Records", "M"],
    "care-team": ["care-team.html", "Care Team", "C"],
    vitals: ["vitals.html", "Vitals", "V"],
    labs: ["labs.html", "Labs", "L"],
    uploads: ["uploads.html", "Files", "F"],
    audit: ["audit.html", "Audit", "A"],
    "break-glass": ["break-glass.html", "Emergency", "!"],
    roles: ["roles.html", "Roles", "R"],
    permissions: ["permissions.html", "Permissions", "P"],
    "user-roles": ["user-roles.html", "User Roles", "U"],
};

const roleMenus = {
    Admin: ["dashboard", "patients", "records", "care-team", "vitals", "labs", "uploads", "audit", "break-glass", "roles", "permissions", "user-roles"],
    Doctor: ["dashboard", "patients", "records", "care-team", "vitals", "labs", "uploads", "break-glass"],
    Nurse: ["dashboard", "patients", "records", "care-team", "vitals", "labs", "uploads", "break-glass"],
    "Lab Technician": ["dashboard", "labs", "uploads"],
    Patient: ["dashboard"],
};

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
}[char]));

const getPage = () => document.body.dataset.page;
const getRole = () => (state.user && state.user.role ? state.user.role : "Patient");
const getInitials = () => {
    const source = (state.user && (state.user.email || state.user.role)) || "DHR";
    return source.slice(0, 2).toUpperCase();
};

let patientCache = [];

const showAlert = (message, type = "info") => {
    const target = qs("#alerts");
    if (!target) return;

    target.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert" aria-live="polite">
        ${escapeHtml(message)}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
};

const request = async (path, options = {}) => {
    const headers = options.body instanceof FormData ? {} : { "Content-Type": "application/json" };

    if (state.token) {
        headers.Authorization = `Bearer ${state.token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...headers, ...(options.headers || {}) },
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
        const message = payload && payload.message ? payload.message : "Request failed";
        throw new Error(message);
    }

    return payload;
};

const unwrap = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (!payload || payload.data === undefined) return payload;
    return payload.data;
};

const normalizeFormBody = (form) => {
    const body = Object.fromEntries(new FormData(form).entries());

    Object.keys(body).forEach((key) => {
        if (body[key] === "") {
            delete body[key];
        }
    });

    return body;
};

const bindJsonForm = (selector, handler, options = {}) => {
    const form = qs(selector);
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitter = form.querySelector("[type=submit]");
        const originalText = submitter ? submitter.textContent : "";

        if (submitter) {
            submitter.disabled = true;
            submitter.textContent = options.loadingText || "Saving...";
        }

        try {
            await handler(normalizeFormBody(form), form);
            showAlert(options.successMessage || "Saved successfully", "success");
            if (options.reset !== false) {
                form.reset();
            }
        } catch (error) {
            showAlert(error.message, "danger");
        } finally {
            if (submitter) {
                submitter.disabled = false;
                submitter.textContent = originalText;
            }
        }
    });
};

const enhanceForms = () => {
    qsa("input, select, textarea").forEach((field) => {
        if (!field.id && field.name) {
            field.id = field.name;
        }

        if (!field.getAttribute("aria-label")) {
            const label = field.closest(".mb-2, .mb-3, .col, .modal-body")?.querySelector(`label[for="${field.id}"]`);
            field.setAttribute("aria-label", label ? label.textContent.trim() : field.placeholder || field.name || "Field");
        }
    });

    qsa("table").forEach((table) => {
        if (!table.closest(".table-responsive")) {
            const wrapper = document.createElement("div");
            wrapper.className = "table-responsive";
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });
};

const renderNavbar = () => {
    const nav = qs("#mainNav");
    if (!nav) return;

    const role = getRole();
    const menu = (roleMenus[role] || roleMenus.Patient).map((key) => menuCatalog[key]);
    const current = window.location.pathname.split("/").pop() || "dashboard.html";

    nav.innerHTML = `
        <div class="clinical-app">
            <a class="skip-link" href="#mainContent">Skip to main content</a>
            <aside class="clinical-sidebar" id="clinicalSidebar" aria-label="Primary navigation">
                <div class="brand-lockup">
                    <span class="brand-mark" aria-hidden="true">D</span>
                    <div>
                        <p class="brand-title">Digital Health</p>
                        <p class="brand-subtitle mb-0">Clinical record system</p>
                    </div>
                </div>
                <nav class="clinical-nav">
                    ${menu.map(([href, label, glyph]) => `<a class="${href === current ? "active" : ""}" href="${href}">
                        <span class="nav-glyph" aria-hidden="true">${glyph}</span>
                        <span>${label}</span>
                    </a>`).join("")}
                </nav>
                <div class="sidebar-footer">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <span class="status-dot" aria-hidden="true"></span>
                        <strong>Secure session</strong>
                    </div>
                    <p class="brand-subtitle mb-0">JWT authenticated with role-aware access controls.</p>
                </div>
            </aside>
            <section class="clinical-main">
                <header class="topbar">
                    <button class="btn btn-outline-primary mobile-menu-button" id="menuToggle" type="button" aria-controls="clinicalSidebar" aria-expanded="false">Menu</button>
                    <div class="topbar-search">
                        <div class="search-wrap">
                            <input class="form-control" id="globalSearch" type="search" placeholder="Search patients, records, labs" aria-label="Global search">
                        </div>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <div class="user-chip">
                            <span class="avatar" aria-hidden="true">${getInitials()}</span>
                            <div class="d-none d-sm-block">
                                <div class="fw-bold">${escapeHtml(role)}</div>
                                <div class="brand-subtitle">${escapeHtml(state.user ? state.user.email || "Authenticated user" : "Authenticated user")}</div>
                            </div>
                        </div>
                        <button class="btn btn-outline-secondary btn-sm" id="logoutBtn" type="button">Sign out</button>
                    </div>
                </header>
                <div class="content-wrap" id="mainContent" tabindex="-1">
                    <div id="pageHeader"></div>
                    <div id="appContentMount"></div>
                </div>
            </section>
        </div>`;

    const originalMain = document.querySelector("body > main");
    const mount = qs("#appContentMount");
    if (originalMain && mount) {
        originalMain.classList.remove("container", "page-shell", "py-4", "py-5");
        mount.appendChild(originalMain);
    }

    const sidebar = qs("#clinicalSidebar");
    const toggle = qs("#menuToggle");
    if (toggle && sidebar) {
        toggle.addEventListener("click", () => {
            sidebar.classList.toggle("open");
            toggle.setAttribute("aria-expanded", sidebar.classList.contains("open") ? "true" : "false");
        });
    }

    qs("#logoutBtn").addEventListener("click", () => {
        localStorage.clear();
        window.location.href = "login.html";
    });
};

const renderPageHeader = () => {
    const target = qs("#pageHeader");
    if (!target) return;

    const [title, description] = pageMeta[getPage()] || ["Workspace", "Clinical workflow"];
    target.innerHTML = `
        <div class="page-header">
            <div>
                <div class="page-kicker">${escapeHtml(getRole())} workspace</div>
                <h1 class="page-title">${escapeHtml(title)}</h1>
                <p class="page-description">${escapeHtml(description)}</p>
            </div>
            <span class="badge text-bg-success"><span class="status-dot" aria-hidden="true"></span>Operational</span>
        </div>`;
};

const protectPage = () => {
    const page = getPage();
    if (!["login", "otp", "register"].includes(page) && !state.token) {
        window.location.href = "login.html";
    }
};

const renderRows = (selector, rows, columns, emptyText = "No records found") => {
    const tbody = qs(selector);
    if (!tbody) return;

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${columns.length}"><div class="empty-state">${escapeHtml(emptyText)}</div></td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((row) => `<tr>${columns.map((column) => `<td>${column(row) || ""}</td>`).join("")}</tr>`).join("");
};

const statusBadge = (status) => {
    const value = String(status || "").toUpperCase();
    const type = value === "APPROVED" || value === "SUCCESS" ? "success" : value === "PENDING" ? "warning" : value === "REJECTED" || value === "DENIED" ? "danger" : "secondary";
    return `<span class="badge text-bg-${type}">${escapeHtml(value || "UNKNOWN")}</span>`;
};

const clinicalText = (value) => {
    if (!value) {
        return `<span class="clinical-note-empty">Not documented</span>`;
    }

    return `<div class="clinical-note">${escapeHtml(value)}</div>`;
};

const renderPatients = (patients) => {
    renderRows("#patientsTable", patients, [
        (p) => `<span class="fw-bold">${p.id}</span>`,
        (p) => `<span class="badge text-bg-secondary">${escapeHtml(p.patient_code)}</span>`,
        (p) => `<div class="patient-identity">
            <div class="patient-name">${escapeHtml(p.full_name)}</div>
            <div class="patient-meta">${escapeHtml(p.gender || "Gender not set")} - DOB ${escapeHtml(p.date_of_birth || "not set")}</div>
        </div>`,
        (p) => `<div>${escapeHtml(p.phone || "No phone")}</div><div class="patient-meta">${escapeHtml(p.address || "No address")}</div>`,
        (p) => escapeHtml(p.emergency_contact || "Not listed"),
        (p) => `<a class="btn btn-sm btn-outline-primary" href="patient-details.html?id=${p.id}" aria-label="Open patient ${escapeHtml(p.full_name)}">Open</a>`,
    ]);
};

const loadPatients = async () => {
    patientCache = unwrap(await request("/patients"));
    renderPatients(patientCache);
};

const renderCareTeamRows = (members) => {
    renderRows("#careTeamTable", members, [
        (member) => `<span class="fw-bold">${member.id}</span>`,
        (member) => `<div class="fw-bold">${escapeHtml(member.staff_name || member.staff_email || `User ${member.user_id}`)}</div><div class="brand-subtitle">${escapeHtml(member.staff_email || "")}</div>`,
        (member) => `<span class="badge text-bg-secondary">${escapeHtml(member.staff_role || "Staff")}</span>`,
        (member) => escapeHtml(member.assignment_role),
        (member) => escapeHtml(member.created_at || ""),
        (member) => member.is_active ? statusBadge("APPROVED").replace("APPROVED", "ACTIVE") : statusBadge("DENIED").replace("DENIED", "INACTIVE"),
        (member) => member.is_active ? `<button class="btn btn-sm btn-outline-danger" data-care-team-id="${member.id}" data-bs-toggle="modal" data-bs-target="#deactivateCareTeamModal">Deactivate</button>` : "",
    ], "No care-team assignments found for this patient");

    qsa("[data-care-team-id]").forEach((button) => button.addEventListener("click", () => {
        qs("#deactivateCareTeamId").value = button.dataset.careTeamId;
    }));
};

const loadCareTeamStaff = async () => {
    const select = qs("#staffUserId");
    if (!select) return;

    const staff = unwrap(await request("/care-team/staff"));
    select.innerHTML = `<option value="">Select healthcare professional</option>${staff.map((member) =>
        `<option value="${member.id}">${escapeHtml(member.username || member.email)} - ${escapeHtml(member.roles || "Staff")}</option>`
    ).join("")}`;
};

const loadCareTeamForPatient = async (patientId) => {
    const patient = unwrap(await request(`/patients/${patientId}`));
    const summary = qs("#careTeamPatientSummary");
    if (summary) {
        summary.innerHTML = `
            <span class="badge text-bg-secondary mb-2">${escapeHtml(patient.patient_code || `Patient ${patient.id}`)}</span>
            <h2 class="h5 mb-1">${escapeHtml(patient.full_name)}</h2>
            <p class="section-subtitle mb-0">${escapeHtml(patient.gender || "Gender not set")} - ${escapeHtml(patient.phone || "No phone")}</p>`;
    }

    const hiddenPatient = qs("#careTeamPatientId");
    if (hiddenPatient) {
        hiddenPatient.value = patientId;
    }

    const members = unwrap(await request(`/care-team/patient/${patientId}`));
    renderCareTeamRows(members);
};

const loadRoles = async () => {
    const roles = unwrap(await request("/roles"));
    renderRows("#rolesTable", roles, [
        (r) => `<span class="fw-bold">${r.id}</span>`,
        (r) => `<span class="badge text-bg-secondary">${escapeHtml(r.name)}</span>`,
        (r) => escapeHtml(r.description || "No description"),
        (r) => `<button class="btn btn-sm btn-outline-secondary me-1" data-edit-role="${r.id}" data-role-name="${escapeHtml(r.name)}" data-role-description="${escapeHtml(r.description || "")}" data-bs-toggle="modal" data-bs-target="#roleModal">Edit</button><button class="btn btn-sm btn-outline-danger" data-delete-role="${r.id}">Delete</button>`,
    ]);
    qsa("[data-edit-role]").forEach((button) => button.addEventListener("click", () => {
        qs("#editRoleId").value = button.dataset.editRole;
        qs("#editRoleName").value = button.dataset.roleName;
        qs("#editRoleDescription").value = button.dataset.roleDescription;
    }));
    qsa("[data-delete-role]").forEach((button) => button.addEventListener("click", async () => {
        try {
            await request(`/roles/${button.dataset.deleteRole}`, { method: "DELETE" });
            await loadRoles();
            showAlert("Role deleted", "success");
        } catch (error) {
            showAlert(error.message, "danger");
        }
    }));
};

const loadPermissions = async () => {
    const permissions = unwrap(await request("/permissions"));
    renderRows("#permissionsTable", permissions, [
        (p) => `<span class="fw-bold">${p.id}</span>`,
        (p) => `<code>${escapeHtml(p.name)}</code>`,
        (p) => escapeHtml(p.description || "No description"),
    ]);
};

const initLogin = () => {
    bindJsonForm("#loginForm", async (body) => {
        const payload = await request("/auth/login", {
            method: "POST",
            body: JSON.stringify(body),
        });

        if (payload.requiresOtp) {
            localStorage.setItem("pendingLogin", JSON.stringify({ email: body.email, role: body.role }));
            window.location.href = "otp.html";
            return;
        }

        localStorage.setItem("accessToken", payload.accessToken || payload.token);
        localStorage.setItem("user", JSON.stringify(payload.user));
        window.location.href = "dashboard.html";
    }, { loadingText: "Checking...", successMessage: "Authenticated", reset: false });
};

const initRegister = () => {
    bindJsonForm("#registerForm", async (body) => {
        await request("/auth/register", {
            method: "POST",
            body: JSON.stringify(body),
        });

        showAlert("Account created. You can now sign in as Patient.", "success");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 900);
    }, { loadingText: "Creating...", successMessage: "Account created", reset: false });
};

const initOtp = () => {
    const emailInput = qs("[name=email]");
    if (emailInput && state.pendingLogin) {
        emailInput.value = state.pendingLogin.email;
    }

    bindJsonForm("#otpForm", async (body) => {
        const payload = await request("/auth/verify-otp", {
            method: "POST",
            body: JSON.stringify(body),
        });
        localStorage.setItem("accessToken", payload.accessToken || payload.token);
        localStorage.setItem("user", JSON.stringify(payload.user));
        localStorage.removeItem("pendingLogin");
        window.location.href = "dashboard.html";
    }, { loadingText: "Verifying...", successMessage: "OTP verified", reset: false });
};

const initDashboard = () => {
    const role = getRole();
    const menu = roleMenus[role] || roleMenus.Patient;
    const cards = qs("#dashboardCards");
    const metrics = qs("#dashboardMetrics");

    if (metrics) {
        metrics.innerHTML = [
            ["Active role", role, "Verified access scope"],
            ["Session", "Live", "JWT protected workspace"],
            ["MFA", role === "Patient" ? "Optional" : "Enabled", "Staff routes require OTP"],
            ["Compliance", "Audited", "Sensitive actions logged"],
        ].map(([label, value, caption]) => `<div class="metric-card">
            <div class="metric-label">${escapeHtml(label)}</div>
            <div class="metric-value">${escapeHtml(value)}</div>
            <div class="brand-subtitle">${escapeHtml(caption)}</div>
        </div>`).join("");
    }

    if (!cards) return;
    cards.innerHTML = menu.filter((key) => key !== "dashboard").map((key) => {
        const [href, label, glyph] = menuCatalog[key];
        return `<div class="col-md-6 col-xl-4">
            <div class="card clinical-module-card h-100">
                <div class="card-body">
                    <span class="badge text-bg-secondary mb-3">${escapeHtml(role)}</span>
                    <div class="nav-glyph mb-3" aria-hidden="true">${glyph}</div>
                    <h2 class="h5">${escapeHtml(label)}</h2>
                    <p class="section-subtitle">Open ${escapeHtml(label.toLowerCase())} workflow.</p>
                    <a class="btn btn-outline-primary btn-sm" href="${href}">Open</a>
                </div>
            </div>
        </div>`;
    }).join("");
};

const initPatients = async () => {
    await loadPatients();
    const codeButton = qs("#generatePatientCode");
    const codeInput = qs("#patient_code");
    if (codeButton && codeInput) {
        codeButton.addEventListener("click", () => {
            codeInput.value = `PAT-${Date.now().toString().slice(-6)}`;
        });
    }

    const searchInput = qs("#patientSearch");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const query = searchInput.value.trim().toLowerCase();
            const filtered = patientCache.filter((patient) => [
                patient.patient_code,
                patient.full_name,
                patient.phone,
                patient.emergency_contact,
            ].some((value) => String(value || "").toLowerCase().includes(query)));
            renderPatients(filtered);
        });
    }

    bindJsonForm("#patientForm", async (body) => {
        await request("/patients", { method: "POST", body: JSON.stringify(body) });
        await loadPatients();
    }, { successMessage: "Patient registered" });
};

const initPatientDetails = async () => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;

    const patient = unwrap(await request(`/patients/${id}`));
    qs("#patientSummary").innerHTML = `
        <div class="d-flex align-items-start justify-content-between gap-3">
            <div>
                <span class="badge text-bg-secondary mb-3">${escapeHtml(patient.patient_code || "No code")}</span>
                <h1 class="h3 mb-2">${escapeHtml(patient.full_name)}</h1>
                <p class="text-muted mb-0">${escapeHtml(patient.gender || "Gender not set")} - ${escapeHtml(patient.phone || "No phone")}</p>
                <a class="btn btn-outline-primary btn-sm mt-3" href="care-team.html?patient_id=${patient.id}">Manage care team</a>
            </div>
            <span class="badge text-bg-success">Verified profile</span>
        </div>`;

    try {
        const qr = unwrap(await request(`/patients/${id}/qr`));
        qs("#qrImage").src = qr.qrImage;
        qs("#qrImage").alt = `QR identifier ${qr.qrIdentifier}`;
        qs("#qrIdentifier").textContent = qr.qrIdentifier;
    } catch (error) {
        qs("#qrIdentifier").textContent = error.message;
    }
};

const loadRecordsForPatient = async (patientId) => {
    const records = unwrap(await request(`/records/patient/${patientId}`));
    renderRows("#recordsTable", records, [
        (r) => `<span class="fw-bold">${r.id}</span>`,
        (r) => `<div class="record-summary">
            <span class="badge text-bg-secondary">Patient ${escapeHtml(r.patient_id)}</span>
            <div class="record-summary-title">${escapeHtml(r.diagnosis)}</div>
            <div class="brand-subtitle">Doctor ${escapeHtml(r.doctor_id || "Unassigned")}</div>
        </div>`,
        (r) => clinicalText(r.treatment),
        (r) => clinicalText(r.prescription),
        (r) => clinicalText(r.notes),
        (r) => `<div class="brand-subtitle">${escapeHtml(r.updated_at || r.created_at || "")}</div>`,
    ], "No medical records found for this patient");
};

const initRecords = () => {
    bindJsonForm("#recordSearchForm", async ({ patient_id }) => {
        await loadRecordsForPatient(patient_id);
    }, { successMessage: "Records loaded", reset: false });
    bindJsonForm("#recordForm", async (body) => {
        await request("/records", { method: "POST", body: JSON.stringify(body) });
        if (body.patient_id) {
            await loadRecordsForPatient(body.patient_id);
        }
    }, { successMessage: "Record created" });
};

const initCareTeam = async () => {
    await loadCareTeamStaff();

    const patientId = new URLSearchParams(window.location.search).get("patient_id");
    if (patientId) {
        await loadCareTeamForPatient(patientId);
    }

    bindJsonForm("#careTeamPatientForm", async ({ patient_id }) => {
        await loadCareTeamForPatient(patient_id);
    }, { successMessage: "Care team loaded", reset: false });

    bindJsonForm("#careTeamAssignForm", async (body) => {
        await request("/care-team", {
            method: "POST",
            body: JSON.stringify(body),
        });
        await loadCareTeamForPatient(body.patient_id);
    }, { successMessage: "Care-team member assigned" });

    bindJsonForm("#deactivateCareTeamForm", async ({ careTeamId }) => {
        await request(`/care-team/${careTeamId}/deactivate`, { method: "PUT" });
        bootstrap.Modal.getInstance(qs("#deactivateCareTeamModal")).hide();
        const patientValue = qs("#careTeamPatientId") && qs("#careTeamPatientId").value;
        if (patientValue) {
            await loadCareTeamForPatient(patientValue);
        }
    }, { successMessage: "Care-team assignment deactivated" });
};

const initVitals = () => {
    bindJsonForm("#vitalsSearchForm", async ({ patient_id }) => {
        const vitals = unwrap(await request(`/vitals/patient/${patient_id}`));
        renderRows("#vitalsTable", vitals, [(v) => v.id, (v) => escapeHtml(v.blood_pressure), (v) => v.temperature, (v) => v.pulse, (v) => escapeHtml(v.created_at)]);
    }, { successMessage: "Vitals loaded", reset: false });
    bindJsonForm("#vitalForm", async (body) => {
        await request("/vitals", { method: "POST", body: JSON.stringify(body) });
    }, { successMessage: "Vitals recorded" });
};

const initLabs = () => {
    bindJsonForm("#labsSearchForm", async ({ patient_id }) => {
        const labs = unwrap(await request(`/labs/patient/${patient_id}`));
        renderRows("#labsTable", labs, [(l) => l.id, (l) => escapeHtml(l.test_type), (l) => escapeHtml(l.result), (l) => escapeHtml(l.created_at)]);
    }, { successMessage: "Lab results loaded", reset: false });
    bindJsonForm("#labForm", async (body) => {
        await request("/labs", { method: "POST", body: JSON.stringify(body) });
    }, { successMessage: "Lab result saved" });
};

const initUploads = () => {
    const form = qs("#uploadForm");
    if (form) {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            try {
                await request("/uploads", { method: "POST", body: new FormData(form) });
                showAlert("Attachment uploaded", "success");
                form.reset();
            } catch (error) {
                showAlert(error.message, "danger");
            }
        });
    }

    bindJsonForm("#uploadsSearchForm", async ({ patient_id }) => {
        const uploads = unwrap(await request(`/uploads/patient/${patient_id}`));
        renderRows("#uploadsTable", uploads, [
            (u) => u.id,
            (u) => escapeHtml(u.file_name),
            (u) => `<span class="badge text-bg-secondary">${escapeHtml(u.file_type)}</span>`,
            (u) => `<a class="btn btn-sm btn-outline-primary" href="/api/uploads/${u.id}" target="_blank" rel="noopener">Download</a>`,
        ]);
    }, { successMessage: "Attachments loaded", reset: false });
};

const initAudit = async () => {
    const data = unwrap(await request("/audit"));
    renderRows("#auditTable", data.logs || [], [
        (a) => a.user,
        (a) => escapeHtml(a.action),
        (a) => escapeHtml(a.resource_type),
        (a) => statusBadge(a.status),
        (a) => escapeHtml(a.created_at),
    ]);
};

const initBreakGlass = async () => {
    bindJsonForm("#breakGlassForm", async (body) => {
        await request("/break-glass/request", { method: "POST", body: JSON.stringify(body) });
    }, { successMessage: "Emergency access request submitted" });

    try {
        const payload = unwrap(await request(state.user && state.user.role === "Admin" ? "/break-glass" : "/break-glass/my-requests"));
        renderRows("#breakGlassTable", payload.requests || [], [
            (r) => r.id,
            (r) => r.patient_id,
            (r) => escapeHtml(r.reason),
            (r) => statusBadge(r.status),
            (r) => r.status === "PENDING" && state.user.role === "Admin"
                ? `<button class="btn btn-sm btn-outline-success me-1" data-approve="${r.id}">Approve</button><button class="btn btn-sm btn-outline-danger" data-reject="${r.id}">Reject</button>`
                : "",
        ]);
        qsa("[data-approve]").forEach((button) => button.addEventListener("click", () => request(`/break-glass/${button.dataset.approve}/approve`, { method: "POST" }).then(() => location.reload())));
        qsa("[data-reject]").forEach((button) => button.addEventListener("click", () => request(`/break-glass/${button.dataset.reject}/reject`, { method: "POST" }).then(() => location.reload())));
    } catch (error) {
        showAlert(error.message, "danger");
    }
};

const initRoles = async () => {
    await loadRoles();
    bindJsonForm("#roleForm", async (body) => {
        await request("/roles", { method: "POST", body: JSON.stringify(body) });
        await loadRoles();
    }, { successMessage: "Role created" });
    bindJsonForm("#rolePermissionForm", async (body) => {
        await request(`/roles/${body.roleId}/permissions`, {
            method: "POST",
            body: JSON.stringify({ permissionId: Number(body.permissionId) }),
        });
    }, { successMessage: "Permission assigned" });
    bindJsonForm("#editRoleForm", async (body) => {
        const roleId = body.roleId;
        delete body.roleId;
        await request(`/roles/${roleId}`, { method: "PUT", body: JSON.stringify(body) });
        await loadRoles();
        bootstrap.Modal.getInstance(qs("#roleModal")).hide();
    }, { successMessage: "Role updated" });
};

const initPermissions = async () => {
    await loadPermissions();
    bindJsonForm("#permissionForm", async (body) => {
        await request("/permissions", { method: "POST", body: JSON.stringify(body) });
        await loadPermissions();
    }, { successMessage: "Permission created" });
};

const initUserRoles = () => {
    bindJsonForm("#userRoleSearchForm", async ({ userId }) => {
        const roles = unwrap(await request(`/users/${userId}/roles`));
        renderRows("#userRolesTable", roles, [
            (r) => r.id,
            (r) => `<span class="badge text-bg-secondary">${escapeHtml(r.name)}</span>`,
            (r) => `<button class="btn btn-sm btn-outline-danger" data-user-id="${userId}" data-role-id="${r.id}">Remove</button>`,
        ]);
        qsa("[data-role-id]").forEach((button) => button.addEventListener("click", async () => {
            await request(`/users/${button.dataset.userId}/roles/${button.dataset.roleId}`, { method: "DELETE" });
            showAlert("Role removed", "success");
        }));
    }, { successMessage: "User roles loaded", reset: false });
    bindJsonForm("#assignUserRoleForm", async (body) => {
        await request(`/users/${body.userId}/roles`, {
            method: "POST",
            body: JSON.stringify({ roleId: Number(body.roleId) }),
        });
    }, { successMessage: "Role assigned" });
};

document.addEventListener("DOMContentLoaded", async () => {
    protectPage();

    if (!["login", "otp", "register"].includes(getPage())) {
        renderNavbar();
        renderPageHeader();
    }

    enhanceForms();

    const handlers = {
        login: initLogin,
        register: initRegister,
        otp: initOtp,
        dashboard: initDashboard,
        patients: initPatients,
        "patient-details": initPatientDetails,
        records: initRecords,
        "care-team": initCareTeam,
        vitals: initVitals,
        labs: initLabs,
        uploads: initUploads,
        audit: initAudit,
        "break-glass": initBreakGlass,
        roles: initRoles,
        permissions: initPermissions,
        "user-roles": initUserRoles,
    };

    try {
        if (handlers[getPage()]) {
            await handlers[getPage()]();
        }
    } catch (error) {
        showAlert(error.message, "danger");
    }
});
