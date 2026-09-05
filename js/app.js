/* ==========================================================================
   FinFlow App Controller - js/app.js
   Simplify Finance. Streamline Business
   ========================================================================== */

// Global Chart variables
let chartCollections = null;
let chartCategories = null;

// Current state
let currentModule = "dashboard";
let customerFilter = "all";
let loanFilter = "all";

// Date Formatter Helper: formats YYYY-MM-DD or other formats to DD/MM/YYYY
function formatDateToDMY(dateStr) {
    if (!dateStr) return "-";
    if (typeof dateStr === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
    if (typeof dateStr === "string") {
        const parts = dateStr.split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
        }
    }
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        }
    } catch(e) {}
    return dateStr;
}
window.formatDateToDMY = formatDateToDMY;

// Flatpickr global instance map & helper for strict DD/MM/YYYY display
let appDatePickers = {};

function initAppDatePicker(id, onChangeCallback) {
    const el = document.getElementById(id);
    if (!el || typeof flatpickr !== "function") return null;

    if (appDatePickers[id]) {
        try { appDatePickers[id].destroy(); } catch(e) {}
    }

    const defaultVal = el.value || "";
    const fp = flatpickr(el, {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d/m/Y",
        defaultDate: defaultVal || null,
        allowInput: true,
        monthSelectorType: "static",
        onChange: function(selectedDates, dateStr) {
            el.value = dateStr;
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("input", { bubbles: true }));
            if (typeof onChangeCallback === "function") {
                onChangeCallback(dateStr);
            }
        }
    });

    appDatePickers[id] = fp;
    return fp;
}

function setDatePickerValue(id, dateStr) {
    const el = document.getElementById(id);
    if (el) {
        el.value = dateStr || "";
    }
    const fp = appDatePickers[id];
    if (fp) {
        fp.setDate(dateStr || null, false);
    }
}
window.initAppDatePicker = initAppDatePicker;
window.setDatePickerValue = setDatePickerValue;

// Document Ready
document.addEventListener("DOMContentLoaded", () => {
    // Check Session (Auto-login option for dev)
    const loggedIn = sessionStorage.getItem("kf_logged_in");
    if (loggedIn === "true") {
        hideLoginOverlay();
    }

    // Set Date-Time Widget
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Initial load
    initRouter();
    initLogin();
    initSettings();
    initCustomers();
    initLoans();
    initCollections();
    initReports();
    updateBrandDisplay();

    // Initialize Cloud Real-Time Multi-Device Sync
    if (window.CloudSync && typeof window.CloudSync.init === "function") {
        window.CloudSync.init();
    }

    // Listen for live updates pushed from other devices
    window.addEventListener("finflow:cloud-update", (e) => {
        console.log("Real-time cloud database update received:", e.detail);
        try {
            renderDashboard();
            renderCustomersList();
            renderLoansList();
            renderCollectionsToday();
            renderReports();
            updateBrandDisplay();
        } catch (err) {
            console.warn("View re-render on cloud update caught error:", err);
        }
    });
    
    // Quick pay button routing
    document.getElementById("btn-quick-new-collection").addEventListener("click", () => {
        switchModule("collections");
    });
});

// Dynamic Branding Updater
function updateBrandDisplay() {
    const compName = (g_settings && g_settings.companyName) ? g_settings.companyName : "FinFlow";
    const compTagline = (g_settings && g_settings.companyTagline) ? g_settings.companyTagline : "Simplify Finance. Streamline Business";
    
    const sidebarTitle = document.getElementById("sidebar-brand-title");
    if (sidebarTitle) sidebarTitle.textContent = compName;
    const sidebarTag = document.getElementById("sidebar-tagline");
    if (sidebarTag) sidebarTag.textContent = compTagline;
    
    const loginSub = document.getElementById("login-card-subtitle");
    if (loginSub && !loginSub.dataset.custom) loginSub.textContent = compTagline;

    document.title = `${compName} - ${compTagline}`;
}

// Update Date-Time Clock
function updateDateTime() {
    const clockEl = document.getElementById("current-dateTime");
    if (clockEl) {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? String(hours).padStart(2, '0') : '12';
        clockEl.textContent = `${dd}/${mm}/${yyyy}, ${hours}:${minutes}:${seconds} ${ampm}`;
    }
}

// Router & Nav module switching
function initRouter() {
    const menuItems = document.querySelectorAll(".menu-item");
    const sidebar = document.querySelector(".sidebar");
    const sidebarToggle = document.getElementById("sidebar-toggle-btn");
    const settingsSubmenuBtn = document.getElementById("btn-toggle-settings-sub");
    const nestedLogoutBtn = document.getElementById("btn-nested-logout");
    const hasSubmenuItem = document.querySelector(".menu-item.has-submenu");

    // Regular menu link clicks
    menuItems.forEach(item => {
        const link = item.querySelector("a.menu-link");
        if (link) {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const target = item.getAttribute("data-target");

                // Toggle submenu if settings item
                if (item.classList.contains("has-submenu")) {
                    item.classList.toggle("open");
                } else if (hasSubmenuItem && hasSubmenuItem.classList.contains("open") && target !== "settings") {
                    hasSubmenuItem.classList.remove("open");
                }

                // Remove active classes
                menuItems.forEach(i => i.classList.remove("active"));
                item.classList.add("active");

                if (target) {
                    switchModule(target);
                }

                // Close mobile sidebar if open
                if (sidebar && sidebar.classList.contains("active")) {
                    sidebar.classList.remove("active");
                }
            });
        }
    });

    // Submenu Toggle Button
    if (settingsSubmenuBtn && hasSubmenuItem) {
        settingsSubmenuBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            hasSubmenuItem.classList.toggle("open");
        });
    }

    // Nested Logout Link
    if (nestedLogoutBtn) {
        nestedLogoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm("Are you sure you want to log out of FinFlow?")) {
                sessionStorage.removeItem("kf_logged_in");
                sessionStorage.removeItem("kf_current_user");
                showLoginOverlay();
            }
        });
    }

    // Mobile sidebar toggle click
    if (sidebarToggle) {
        sidebarToggle.addEventListener("click", () => {
            sidebar.classList.toggle("active");
        });
    }

    // Modal closes
    const closeBtns = document.querySelectorAll(".btn-close-modal");
    closeBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const modal = btn.closest(".modal-overlay");
            if (modal) {
                modal.classList.remove("active");
                modal.style.display = "";
                if (modal.id === "modal-camera-capture") {
                    stopWebcamStream();
                }
            }
        });
    });

    // Backdrop click close
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                overlay.classList.remove("active");
                overlay.style.display = "";
                if (overlay.id === "modal-camera-capture") {
                    stopWebcamStream();
                }
            }
        });
    });
}

function switchModule(moduleName) {
    currentModule = moduleName;
    
    // Hide all sections
    const sections = document.querySelectorAll(".app-section");
    sections.forEach(s => s.classList.remove("active"));

    // Show target section
    const targetSection = document.getElementById(moduleName);
    if (targetSection) {
        targetSection.classList.add("active");
    }

    // Sync active class on sidebar menu items
    const menuItems = document.querySelectorAll(".menu-item");
    menuItems.forEach(i => {
        if (i.getAttribute("data-target") === moduleName) {
            i.classList.add("active");
        } else {
            i.classList.remove("active");
        }
    });

    // Update main header title
    const heading = document.getElementById("page-title-heading");
    if (heading) {
        const titleMap = {
            dashboard: "Home Overview",
            customers: "Customers & KYC Overview",
            loans: "Loan Accounts & Ledgers",
            collections: "Daily Collections & Receipts",
            reports: "Financial Statements & Reports",
            settings: "System Settings & Configuration"
        };
        heading.textContent = titleMap[moduleName] || (moduleName.charAt(0).toUpperCase() + moduleName.slice(1) + " Overview");
    }

    // Refresh view specific data
    if (moduleName === "dashboard") {
        renderDashboard();
    } else if (moduleName === "customers") {
        renderCustomersList();
    } else if (moduleName === "loans") {
        renderLoansList();
    } else if (moduleName === "collections") {
        resetCollectionForm();
    } else if (moduleName === "reports") {
        renderReports();
    }
}

function closeAllModals() {
    const modals = document.querySelectorAll(".modal-overlay");
    modals.forEach(m => m.classList.remove("active"));
    
    // Stop live webcam streams if active
    stopWebcamStream();
}

// 1. SECURITY & LOGIN PORTAL
let tempRegUser = null;

function initLogin() {
    const loginForm = document.getElementById("pwd-login-form");
    const mpinLoginForm = document.getElementById("mpin-login-form");
    const regDetailsForm = document.getElementById("register-details-form");
    const regMpinForm = document.getElementById("register-mpin-form");

    const mpinInput = document.getElementById("login-mpin");
    const togglePassBtn = document.getElementById("toggle-password-visibility");
    const passwordInput = document.getElementById("login-password");
    const logoutBtn = document.getElementById("btn-logout");

    // Developer Backdoor (clicking the columns logo bypasses to admin)
    const loginHeader = document.querySelector(".login-header");
    if (loginHeader) {
        loginHeader.addEventListener("click", () => {
            const defaultAdmin = getUserByUsername("admin") || { username: "admin", name: "System Admin" };
            sessionStorage.setItem("kf_logged_in", "true");
            sessionStorage.setItem("kf_current_user", JSON.stringify(defaultAdmin));
            hideLoginOverlay();
        });
        loginHeader.style.cursor = "pointer";
    }

    // Panel switching links
    const linkToPwd = document.getElementById("link-to-pwd-login");
    if (linkToPwd) {
        linkToPwd.addEventListener("click", (e) => {
            e.preventDefault();
            switchLoginPanel("panel-pwd-login", "Backup Password Access");
        });
    }

    const linkToMpin = document.getElementById("link-to-mpin-login");
    if (linkToMpin) {
        linkToMpin.addEventListener("click", (e) => {
            e.preventDefault();
            switchLoginPanel("panel-mpin-login", "Secure Access Portal");
            setTimeout(() => document.getElementById("login-mpin").focus(), 50);
        });
    }

    const linkToReg = document.getElementById("link-to-register");
    if (linkToReg) {
        linkToReg.addEventListener("click", (e) => {
            e.preventDefault();
            switchLoginPanel("panel-register-details", "Admin Registration");
        });
    }

    const linkToRegPwd = document.getElementById("link-to-register-pwd");
    if (linkToRegPwd) {
        linkToRegPwd.addEventListener("click", (e) => {
            e.preventDefault();
            switchLoginPanel("panel-register-details", "Admin Registration");
        });
    }

    const backToLoginLinks = document.querySelectorAll(".link-back-to-login");
    backToLoginLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            switchLoginPanel("panel-mpin-login", "Secure Access Portal");
            setTimeout(() => document.getElementById("login-mpin").focus(), 50);
        });
    });

    // MPIN Input automatic checker
    if (mpinInput) {
        mpinInput.addEventListener("input", () => {
            const mpinVal = mpinInput.value;
            const errorEl = document.getElementById("mpin-login-error");
            errorEl.textContent = "";

            if (mpinVal.length === 4) {
                const user = getUserByMpin(mpinVal);
                if (user) {
                    if (user.status === "Blocked") {
                        errorEl.textContent = "Your admin profile is blocked. Contact another Admin.";
                        mpinInput.value = "";
                        return;
                    }
                    
                    // Success!
                    sessionStorage.setItem("kf_logged_in", "true");
                    sessionStorage.setItem("kf_current_user", JSON.stringify(user));
                    hideLoginOverlay();
                    mpinInput.value = "";
                } else {
                    errorEl.textContent = "Invalid 4-digit MPIN. Try again.";
                    mpinInput.value = "";
                }
            }
        });
    }

    // Backup Password Form Submit
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById("login-username").value.trim().toLowerCase();
            const passwordVal = passwordInput.value;
            const errorMsg = document.getElementById("login-error-msg");
            errorMsg.textContent = "";

            const user = getUserByUsername(usernameInput);

            if (user && user.password === passwordVal) {
                if (user.status === "Blocked") {
                    errorMsg.textContent = "Your admin profile is blocked. Contact another Admin.";
                    return;
                }
                
                // Login Success
                sessionStorage.setItem("kf_logged_in", "true");
                sessionStorage.setItem("kf_current_user", JSON.stringify(user));
                hideLoginOverlay();
                loginForm.reset();
            } else {
                errorMsg.textContent = "Invalid username or password. Access Denied.";
            }
        });
    }

    // Register Step 1: Details Submit
    if (regDetailsForm) {
        regDetailsForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const usernameVal = document.getElementById("reg-username").value.trim().toLowerCase();
            const nameVal = document.getElementById("reg-name").value.trim();
            const mobileVal = document.getElementById("reg-mobile").value.trim();
            const passVal = document.getElementById("reg-password").value;
            const confirmPassVal = document.getElementById("reg-confirm-password").value;
            const errorEl = document.getElementById("register-details-error");
            errorEl.textContent = "";

            if (usernameVal.length < 3) {
                errorEl.textContent = "Username must be at least 3 characters.";
                return;
            }
            if (passVal !== confirmPassVal) {
                errorEl.textContent = "Passwords do not match.";
                return;
            }
            if (getUserByUsername(usernameVal)) {
                errorEl.textContent = "Username is already taken.";
                return;
            }

            // Save details to temp storage and proceed to MPIN setup
            tempRegUser = {
                username: usernameVal,
                name: nameVal,
                mobile: mobileVal,
                password: passVal
            };

            switchLoginPanel("panel-register-mpin", "Setup Security MPIN");
            setTimeout(() => document.getElementById("reg-mpin").focus(), 50);
        });
    }

    // Register Step 2: MPIN Submit
    if (regMpinForm) {
        regMpinForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const mpinVal = document.getElementById("reg-mpin").value;
            const confirmMpinVal = document.getElementById("reg-confirm-mpin").value;
            const errorEl = document.getElementById("register-mpin-error");
            errorEl.textContent = "";

            if (mpinVal !== confirmMpinVal) {
                errorEl.textContent = "MPIN codes do not match.";
                return;
            }
            if (mpinVal.length !== 4 || isNaN(mpinVal)) {
                errorEl.textContent = "MPIN must be a 4-digit number.";
                return;
            }
            if (getUserByMpin(mpinVal)) {
                errorEl.textContent = "This MPIN is already taken. Please choose a unique code.";
                return;
            }

            // Complete registration
            tempRegUser.mpin = mpinVal;
            const res = addUser(tempRegUser);

            if (res.success) {
                alert(`Admin profile [${tempRegUser.username}] created successfully!\n\nYou can now log in using your new MPIN.`);
                
                // Go to MPIN login
                regDetailsForm.reset();
                regMpinForm.reset();
                tempRegUser = null;
                switchLoginPanel("panel-mpin-login", "Secure Access Portal");
                setTimeout(() => document.getElementById("login-mpin").focus(), 50);
            } else {
                errorEl.textContent = res.message;
            }
        });
    }

    // Password view toggle helper
    if (togglePassBtn && passwordInput) {
        togglePassBtn.addEventListener("click", () => {
            const isPassword = passwordInput.type === "password";
            passwordInput.type = isPassword ? "text" : "password";
            togglePassBtn.innerHTML = isPassword ? `<i class="fa-solid fa-eye-slash"></i>` : `<i class="fa-solid fa-eye"></i>`;
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            sessionStorage.removeItem("kf_logged_in");
            sessionStorage.removeItem("kf_current_user");
            showLoginOverlay();
        });
    }
}

function switchLoginPanel(panelId, subtitleText) {
    const panels = document.querySelectorAll(".login-panel");
    panels.forEach(p => p.classList.add("hidden"));
    
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.remove("hidden");
    
    const subTitle = document.getElementById("login-card-subtitle");
    if (subTitle) subTitle.textContent = subtitleText;
}

function showLoginOverlay() {
    const overlay = document.getElementById("login-overlay");
    const container = document.getElementById("app-container");
    if (overlay) overlay.classList.add("active");
    if (container) container.classList.remove("logged-in");
    
    // Switch to Password login panel by default
    switchLoginPanel("panel-pwd-login", "Secure Access Portal");
    const usernameInput = document.getElementById("login-username");
    if (usernameInput) {
        usernameInput.value = "";
        setTimeout(() => usernameInput.focus(), 100);
    }
}

function hideLoginOverlay() {
    const overlay = document.getElementById("login-overlay");
    const container = document.getElementById("app-container");
    if (overlay) overlay.classList.remove("active");
    if (container) container.classList.add("logged-in");
    
    // Update admin username displays from session
    let currentUser = null;
    try {
        currentUser = JSON.parse(sessionStorage.getItem("kf_current_user"));
    } catch(e) {}

    const displayEl = document.getElementById("display-admin-name");
    if (displayEl) {
        displayEl.textContent = currentUser ? currentUser.name : "Administrator";
    }
    
    // Load Dashboard details immediately
    renderDashboard();
    
    // Populate Administrators table in Settings
    renderRegisteredAdmins();
}

// 2. DASHBOARD ENGINE
function renderDashboard() {
    const kpis = calculateKPIs();

    // Set KPI Text displays
    const elTotCust = document.getElementById("kpi-total-customers");
    if (elTotCust) elTotCust.textContent = kpis.totalCustomers;

    const elTodCol = document.getElementById("kpi-todays-collection");
    if (elTodCol) elTodCol.textContent = g_settings.currency + kpis.todaysCollection.toLocaleString();

    const elTodCount = document.getElementById("kpi-todays-collection-count");
    if (elTodCount) elTodCount.textContent = `${kpis.todaysCollectionCount} Transactions Today`;

    const elPend = document.getElementById("kpi-pending-payments");
    if (elPend) elPend.textContent = g_settings.currency + kpis.pendingInstallmentsAmount.toLocaleString();

    const elPendCount = document.getElementById("kpi-pending-payments-count");
    if (elPendCount) elPendCount.textContent = `${kpis.pendingInstallmentsCount} Collections Pending`;

    // Total Pending Payment (Remaining amount across all active loans)
    const elTotPending = document.getElementById("kpi-total-pending");
    if (elTotPending) elTotPending.textContent = g_settings.currency + kpis.outstandingAmount.toLocaleString();
    const elTotPendingSub = document.getElementById("kpi-total-pending-sub");
    if (elTotPendingSub) elTotPendingSub.innerHTML = `<i class="fa-solid fa-wallet"></i> Total Remaining Dues`;

    const elOvdBal = document.getElementById("kpi-overdue-balance");
    if (elOvdBal) elOvdBal.textContent = g_settings.currency + kpis.overdueBalance.toLocaleString();

    const elOvdCount = document.getElementById("kpi-overdue-count");
    if (elOvdCount) elOvdCount.textContent = `${kpis.overdueCount} Accounts Lagging`;

    const elAssignedLoans = document.getElementById("kpi-assigned-loans");
    if (elAssignedLoans) elAssignedLoans.textContent = kpis.activeLoansCount;

    const elAssignedCount = document.getElementById("kpi-assigned-loans-count");
    if (elAssignedCount) elAssignedCount.textContent = `${kpis.activeLoansCount} Active Contracts`;

    // Total Handover Cost
    const elHandover = document.getElementById("kpi-total-handover");
    if (elHandover) elHandover.textContent = g_settings.currency + kpis.totalHandoverAmount.toLocaleString();
    const elHandoverSub = document.getElementById("kpi-total-handover-sub");
    if (elHandoverSub) elHandoverSub.innerHTML = `<i class="fa-solid fa-money-bill-transfer"></i> Net Handed Over`;

    // Total Profit (Formula: Total Payable Cost - Handover)
    const elProfit = document.getElementById("kpi-total-profit");
    if (elProfit) elProfit.textContent = g_settings.currency + kpis.totalProfit.toLocaleString();
    const elProfitSub = document.getElementById("kpi-total-profit-sub");
    if (elProfitSub) elProfitSub.innerHTML = `<i class="fa-solid fa-calculator"></i> Total - Handover`;

    // Collection Profit (Formula: Settled Loans Profit)
    const elColProfit = document.getElementById("kpi-collection-profit");
    if (elColProfit) elColProfit.textContent = g_settings.currency + kpis.collectionProfit.toLocaleString();
    const elColProfitSub = document.getElementById("kpi-collection-profit-sub");
    if (elColProfitSub) {
        if (kpis.completedLoansCount > 0) {
            elColProfitSub.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${kpis.completedLoansCount} Settled Loan${kpis.completedLoansCount > 1 ? 's' : ''}`;
        } else {
            elColProfitSub.innerHTML = `<i class="fa-solid fa-circle-check"></i> 0 Settled Loans`;
        }
    }

    // Blocked Customers
    const elBlocked = document.getElementById("kpi-blocked-customers");
    if (elBlocked) elBlocked.textContent = kpis.blockedCount;
    const elBlockedSub = document.getElementById("kpi-blocked-customers-sub");
    if (elBlockedSub) elBlockedSub.innerHTML = `<i class="fa-solid fa-ban"></i> ${kpis.blockedCount} Accounts Blocked`;


    // Recent Collections table (list all)
    const tableBody = document.querySelector("#dashboard-recent-collections-table tbody");
    if (tableBody) {
        tableBody.innerHTML = "";
        
        // List all collections
        const recentTx = g_collections;
        if (recentTx.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No collections recorded yet.</td></tr>`;
        } else {
            recentTx.forEach((tx, idx) => {
                const customer = getCustomerById(tx.customerId);
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td><strong>${idx + 1}</strong></td>
                    <td>${formatDateToDMY(tx.transactionDate)}</td>
                    <td><strong>${customer ? customer.name : 'Unknown'}</strong></td>
                    <td><span class="badge badge-indigo">${tx.loanId}</span></td>
                    <td class="text-emerald">₹${tx.amountCollected.toLocaleString()}</td>
                    <td class="text-amber">₹${tx.penaltyPaid.toLocaleString()}</td>
                    <td><span class="badge">${tx.paymentMode}</span></td>
                `;
                tableBody.appendChild(row);
            });
        }
    }

    // Pending Payments Overview table (list all)
    const pendingTableBody = document.querySelector("#dashboard-pending-payments-table tbody");
    if (pendingTableBody) {
        pendingTableBody.innerHTML = "";
        const pendingItems = getAllPendingPayments(); // list all pending
        if (pendingItems.length === 0) {
            pendingTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No pending payments found. All accounts up to date!</td></tr>`;
        } else {
            pendingItems.forEach((item, idx) => {
                const row = document.createElement("tr");
                let badgeClass = "badge badge-pending";
                let statusText = `<i class="fa-solid fa-clock"></i> Due Today`;
                let dateDisplay = `<span style="color:var(--clr-amber); font-weight:600;"><i class="fa-solid fa-calendar-day"></i> Today (${formatDateToDMY(item.dueDate)})</span>`;

                if (item.isOverdue) {
                    badgeClass = "badge badge-overdue";
                    statusText = `<i class="fa-solid fa-triangle-exclamation"></i> Missed`;
                    dateDisplay = `<span style="color:var(--clr-rose); font-weight:600;"><i class="fa-solid fa-calendar-xmark"></i> ${formatDateToDMY(item.dueDate)}</span>`;
                } else if (!item.isDueToday) {
                    badgeClass = "badge";
                    statusText = item.status;
                    dateDisplay = formatDateToDMY(item.dueDate);
                }

                row.innerHTML = `
                    <td><strong>${idx + 1}</strong></td>
                    <td>${dateDisplay}</td>
                    <td><strong>${item.borrowerName}</strong></td>
                    <td><span class="badge badge-indigo">${item.loanId}</span></td>
                    <td class="text-right text-amber">₹${item.pendingAmount.toLocaleString()}</td>
                    <td class="text-center"><span class="${badgeClass}">${statusText}</span></td>
                    <td class="text-center">
                        <button class="btn btn-primary btn-xs" onclick="openPaymentFormForLoan('${item.loanId}')" title="Record collection for this loan"><i class="fa-solid fa-indian-rupee-sign"></i> Pay</button>
                    </td>
                `;
                pendingTableBody.appendChild(row);
            });
        }
    }

    // Dashboard View All collection redirection button
    const viewAllBtn = document.getElementById("btn-dashboard-view-all-collections");
    if (viewAllBtn) {
        viewAllBtn.onclick = () => switchModule("collections");
    }

    // Dashboard View All pending redirection button
    const viewAllPendingBtn = document.getElementById("btn-dashboard-view-all-pending");
    if (viewAllPendingBtn) {
        viewAllPendingBtn.onclick = () => {
            switchModule("reports");
            const filterStatus = document.getElementById("report-filter-status");
            if (filterStatus) {
                filterStatus.value = "Pending";
            }
            renderReports();
        };
    }

    // Render Charts
    renderDashboardCharts();
}

function renderDashboardCharts() {
    const today = new Date();
    
    // Trend Labels (Last 7 days dates)
    const labels = [];
    const collectionsTrend = [];
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }));
        
        // Sum collections for that day
        const daySum = g_collections
            .filter(c => c.transactionDate === dStr)
            .reduce((sum, c) => sum + c.amountCollected, 0);
        collectionsTrend.push(daySum);
    }

    // Chart 1: Collection Trends
    const ctxCollections = document.getElementById("chart-collections");
    if (ctxCollections) {
        if (chartCollections) {
            chartCollections.destroy();
        }
        
        chartCollections = new Chart(ctxCollections, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Amount Collected (₹)',
                    data: collectionsTrend,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#06b6d4',
                    pointBorderColor: '#ffffff',
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } },
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' }, beginAtZero: true }
                }
            }
        });
    }

    // Chart 2: Category Distribution
    const ctxCategories = document.getElementById("chart-categories");
    if (ctxCategories) {
        if (chartCategories) {
            chartCategories.destroy();
        }

        // Count category shares
        const categories = ["Personal", "Business", "Gold", "Vehicle", "Property", "Microfinance"];
        const counts = categories.map(cat => g_loans.filter(l => l.category === cat && l.status !== "Closed").length);

        chartCategories = new Chart(ctxCategories, {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{
                    data: counts,
                    backgroundColor: ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#14b8a6'],
                    borderWidth: 1,
                    borderColor: '#1e293b'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'bottom',
                        labels: { color: '#f3f4f6', font: { size: 10 } }
                    }
                }
            }
        });
    }
}

// 3. CUSTOMERS MODULE
let webcamStream = null;

function initCustomers() {
    const addCustBtn = document.getElementById("btn-add-customer");
    const addCustModal = document.getElementById("modal-add-customer");
    const addCustForm = document.getElementById("form-add-customer");
    const autoIdBtn = document.getElementById("btn-generate-cust-id");
    const cameraBtn = document.getElementById("btn-camera-capture");
    const photoUploadInput = document.getElementById("cust-photo-upload");
    const aadhaarUploadInput = document.getElementById("cust-aadhaar-upload");

    const searchInput = document.getElementById("customer-search-input");

    // Open add customer modal
    if (addCustBtn) {
        addCustBtn.addEventListener("click", () => {
            addCustForm.reset();
            document.getElementById("is-edit-cust-val").value = "false";
            document.getElementById("cust-id").readOnly = false;
            document.getElementById("btn-generate-cust-id").style.display = "inline-flex";
            document.getElementById("customer-modal-title").innerHTML = `<i class="fa-solid fa-user-plus text-gradient"></i> Add New Customer Profile`;
            document.getElementById("btn-customer-submit").innerHTML = `Save Customer Profile <i class="fa-solid fa-circle-check"></i>`;
            
            document.getElementById("photo-preview-container").innerHTML = `<i class="fa-solid fa-camera"></i><span>No Photo Attached</span>`;
            document.getElementById("aadhaar-preview-container").innerHTML = `<i class="fa-solid fa-id-card"></i><span>No Proof Image Selected</span>`;
            document.getElementById("guarantor-proof-preview-container").innerHTML = `<i class="fa-solid fa-id-card"></i><span>No Nominee Proof Selected</span>`;
            document.getElementById("cust-photo-base64").value = "";
            document.getElementById("cust-aadhaar-base64").value = "";
            document.getElementById("cust-guarantor-proof-base64").value = "";
            
            // Auto generate Client ID initially
            generateCustomClientId();
            
            addCustModal.classList.add("active");
        });
    }

    if (autoIdBtn) {
        autoIdBtn.addEventListener("click", generateCustomClientId);
    }

    // Instant camera capture clicks
    if (cameraBtn) {
        cameraBtn.addEventListener("click", () => openWebcamCaptureTerminal("cust-photo-base64", "photo-preview-container", "photo"));
    }
    const aadhaarCameraBtn = document.getElementById("btn-camera-capture-aadhaar");
    if (aadhaarCameraBtn) {
        aadhaarCameraBtn.addEventListener("click", () => openWebcamCaptureTerminal("cust-aadhaar-base64", "aadhaar-preview-container", "document"));
    }
    const guarantorCameraBtn = document.getElementById("btn-camera-capture-guarantor");
    if (guarantorCameraBtn) {
        guarantorCameraBtn.addEventListener("click", () => openWebcamCaptureTerminal("cust-guarantor-proof-base64", "guarantor-proof-preview-container", "nominee"));
    }

    // File inputs changes
    if (photoUploadInput) {
        photoUploadInput.addEventListener("change", (e) => {
            handleImageFileInput(e.target.files[0], "photo-preview-container", "cust-photo-base64");
        });
    }
    if (aadhaarUploadInput) {
        aadhaarUploadInput.addEventListener("change", (e) => {
            handleImageFileInput(e.target.files[0], "aadhaar-preview-container", "cust-aadhaar-base64");
        });
    }
    const gProofUploadInput = document.getElementById("cust-guarantor-proof-upload");
    if (gProofUploadInput) {
        gProofUploadInput.addEventListener("change", (e) => {
            handleImageFileInput(e.target.files[0], "guarantor-proof-preview-container", "cust-guarantor-proof-base64");
        });
    }

    // Customer Form Submit
    if (addCustForm) {
        addCustForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const isEdit = document.getElementById("is-edit-cust-val").value === "true";
            const cid = document.getElementById("cust-id").value.trim().toUpperCase();
            
            // Verify unique Client ID only if not editing
            if (!isEdit && getCustomerById(cid)) {
                alert("Client ID already exists. Please choose a unique identification key.");
                return;
            }

            const newCust = {
                id: cid,
                name: document.getElementById("cust-name").value.trim(),
                mobile: document.getElementById("cust-mobile").value.trim(),
                altMobile: document.getElementById("cust-alt-mobile").value.trim(),
                address: document.getElementById("cust-address").value.trim(),
                city: document.getElementById("cust-city").value.trim(),
                district: document.getElementById("cust-district").value.trim(),
                state: document.getElementById("cust-state").value.trim(),
                guarantorName: document.getElementById("cust-guarantor-name").value.trim(),
                guarantorAddress: document.getElementById("cust-guarantor-address").value.trim(),
                guarantorMobile: document.getElementById("cust-guarantor-mobile").value.trim(),
                photo: document.getElementById("cust-photo-base64").value || SVG_PHOTO_MOCK,
                aadhaar: document.getElementById("cust-aadhaar-base64").value || SVG_AADHAAR_MOCK,
                guarantorProof: document.getElementById("cust-guarantor-proof-base64").value || "",
                status: document.getElementById("cust-initial-status").value
            };

            if (isEdit) {
                updateCustomer(cid, newCust);
            } else {
                addCustomer(newCust);
            }
            closeAllModals();
            renderCustomersList();
        });
    }

    // Search & Filters inputs
    if (searchInput) {
        searchInput.addEventListener("input", renderCustomersList);
    }

    const customerStatusSel = document.getElementById("select-customer-status-filter");
    if (customerStatusSel) {
        customerStatusSel.addEventListener("change", () => {
            customerFilter = customerStatusSel.value;
            renderCustomersList();
        });
    }

    // Sub-modal actions inside inspection
    const saveOverrideBtn = document.getElementById("btn-save-status-override");
    if (saveOverrideBtn) {
        saveOverrideBtn.addEventListener("click", () => {
            const cid = document.getElementById("inspect-cid").textContent;
            const newStatus = document.getElementById("inspect-status-override").value;
            updateCustomerStatus(cid, newStatus);
            
            // Re-render
            const badge = document.getElementById("inspect-status-badge");
            badge.textContent = newStatus;
            badge.className = `badge badge-${newStatus.toLowerCase()}`;
            
            renderCustomersList();
            alert("Customer status override saved successfully.");
        });
    }

    // PDF Exports event listeners
    const pdfProfileBtn = document.getElementById("btn-download-profile-pdf");
    const pdfLedgerBtn = document.getElementById("btn-download-ledger-pdf");

    if (pdfProfileBtn) {
        pdfProfileBtn.onclick = () => {
            const cid = document.getElementById("inspect-cid").textContent;
            exportCustomerProfilePDF(cid);
        };
    }
    if (pdfLedgerBtn) {
        pdfLedgerBtn.onclick = () => {
            const cid = document.getElementById("inspect-cid").textContent;
            exportCustomerLedgerPDF(cid);
        };
    }
}

// Generate client ID (e.g. CUST-1004)
function generateCustomClientId() {
    let maxNum = 1000;
    g_customers.forEach(c => {
        const match = c.id.match(/CUST-(\d+)/i);
        if (match) {
            const num = parseInt(match[1]);
            if (num > maxNum) maxNum = num;
        }
    });
    document.getElementById("cust-id").value = `CUST-${maxNum + 1}`;
}

// Read image files and store base64 string
function handleImageFileInput(file, previewId, hiddenInputId) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Str = e.target.result;
        document.getElementById(hiddenInputId).value = base64Str;
        document.getElementById(previewId).innerHTML = `<img src="${base64Str}" style="width:100%; height:100%; object-fit:contain;">`;
    };
    reader.readAsDataURL(file);
}

// Camera target and facing mode state
let currentCameraTarget = {
    inputId: "cust-photo-base64",
    previewId: "photo-preview-container",
    type: "photo"
};
let currentFacingMode = "user"; // 'user' (front) or 'environment' (back)

// Start camera stream for chosen facing mode
function startCameraStream(facingMode = "user") {
    currentFacingMode = facingMode;

    const videoEl = document.getElementById("webcam-live-feed");
    const screenEl = document.getElementById("webcam-simulated-screen");
    const shutterBtn = document.getElementById("btn-camera-shutter");
    const frontBtn = document.getElementById("btn-cam-front");
    const backBtn = document.getElementById("btn-cam-back");

    // Update active button indicators
    if (frontBtn && backBtn) {
        if (facingMode === "user") {
            frontBtn.classList.add("active-camera-mode");
            backBtn.classList.remove("active-camera-mode");
        } else {
            backBtn.classList.add("active-camera-mode");
            frontBtn.classList.remove("active-camera-mode");
        }
    }

    // Stop existing stream if any
    stopWebcamStream();

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const constraints = {
            video: {
                facingMode: { ideal: facingMode },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                webcamStream = stream;
                videoEl.srcObject = stream;
                videoEl.style.display = "block";
                screenEl.style.display = "none";

                // Mirror front camera preview for natural selfie feel
                if (facingMode === "user") {
                    videoEl.style.transform = "scaleX(-1)";
                } else {
                    videoEl.style.transform = "none";
                }
                
                shutterBtn.onclick = () => {
                    captureLiveWebcamSnapshot(videoEl);
                };
            })
            .catch(err => {
                console.warn("Live camera facingMode not fulfilled. Trying fallback standard camera constraints.", err);
                navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                    .then(stream => {
                        webcamStream = stream;
                        videoEl.srcObject = stream;
                        videoEl.style.display = "block";
                        screenEl.style.display = "none";
                        videoEl.style.transform = facingMode === "user" ? "scaleX(-1)" : "none";
                        shutterBtn.onclick = () => {
                            captureLiveWebcamSnapshot(videoEl);
                        };
                    })
                    .catch(fallbackErr => {
                        console.warn("Webcam blocked or hardware absent. Triggering simulated generator.", fallbackErr);
                        initSimulatedCameraCapture();
                    });
            });
    } else {
        initSimulatedCameraCapture();
    }
}

// Simulated/Live webcam modal capture entry point
function openWebcamCaptureTerminal(targetInputId = "cust-photo-base64", targetPreviewId = "photo-preview-container", captureType = "photo") {
    currentCameraTarget = {
        inputId: targetInputId,
        previewId: targetPreviewId,
        type: captureType
    };

    // Default: front camera for client photo, back camera for documents
    const defaultFacing = (captureType === "photo") ? "user" : "environment";

    const cameraModal = document.getElementById("modal-camera-capture");
    const titleEl = document.getElementById("camera-modal-title");
    const guideTextEl = document.getElementById("camera-modal-guide-text");
    const iconEl = document.getElementById("camera-modal-icon");

    if (titleEl) {
        if (captureType === "photo") {
            titleEl.innerHTML = `<i class="fa-solid fa-camera text-gradient"></i> Client Instant Photo Capture`;
        } else if (captureType === "document") {
            titleEl.innerHTML = `<i class="fa-solid fa-id-card text-gradient"></i> Proof / Aadhaar Instant Capture`;
        } else {
            titleEl.innerHTML = `<i class="fa-solid fa-file-shield text-gradient"></i> Nominee Proof Instant Capture`;
        }
    }

    if (guideTextEl) {
        if (captureType === "photo") {
            guideTextEl.textContent = "Position client face in the center of the frame";
            if (iconEl) iconEl.className = "fa-solid fa-user-circle";
        } else if (captureType === "document") {
            guideTextEl.textContent = "Position identity / Aadhaar proof in center";
            if (iconEl) iconEl.className = "fa-solid fa-id-card";
        } else {
            guideTextEl.textContent = "Position Nominee document in center";
            if (iconEl) iconEl.className = "fa-solid fa-file-shield";
        }
    }

    cameraModal.classList.add("active");

    // Close camera submodal handlers
    const closeBtns = [
        document.getElementById("btn-close-camera-modal-top"),
        document.getElementById("btn-close-camera-modal-bottom")
    ];
    closeBtns.forEach(btn => {
        if (btn) {
            btn.onclick = (e) => {
                e.preventDefault();
                cameraModal.classList.remove("active");
                stopWebcamStream();
            };
        }
    });

    // Wire camera toggle buttons
    const frontBtn = document.getElementById("btn-cam-front");
    if (frontBtn) {
        frontBtn.onclick = (e) => {
            e.preventDefault();
            startCameraStream("user");
        };
    }
    const backBtn = document.getElementById("btn-cam-back");
    if (backBtn) {
        backBtn.onclick = (e) => {
            e.preventDefault();
            startCameraStream("environment");
        };
    }
    const flipBtn = document.getElementById("btn-flip-camera");
    if (flipBtn) {
        flipBtn.onclick = (e) => {
            e.preventDefault();
            const nextMode = (currentFacingMode === "user") ? "environment" : "user";
            startCameraStream(nextMode);
        };
    }

    // Start stream with appropriate default facing mode
    startCameraStream(defaultFacing);
}

// Simulated snapshot screen logic
function initSimulatedCameraCapture() {
    const videoEl = document.getElementById("webcam-live-feed");
    const screenEl = document.getElementById("webcam-simulated-screen");
    const shutterBtn = document.getElementById("btn-camera-shutter");
    
    videoEl.style.display = "none";
    screenEl.style.display = "flex";

    shutterBtn.onclick = () => {
        let generatedData = "";
        if (currentCameraTarget.type === "photo") {
            const colors = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];
            const randColor = colors[Math.floor(Math.random() * colors.length)];
            generatedData = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%231e293b'/><circle cx='50' cy='35' r='18' fill='${encodeURIComponent(randColor)}'/><path d='M20 80c0-15 15-22 30-22s30 7 30 22z' fill='${encodeURIComponent(randColor)}'/></svg>`;
        } else if (currentCameraTarget.type === "document") {
            const docNum = Math.floor(1000 + Math.random() * 9000) + " " + Math.floor(1000 + Math.random() * 9000) + " " + Math.floor(1000 + Math.random() * 9000);
            generatedData = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='100' viewBox='0 0 160 100'><rect width='160' height='100' rx='8' fill='%231e293b' stroke='%2306b6d4' stroke-width='2'/><text x='10' y='25' fill='%2306b6d4' font-family='sans-serif' font-size='10' font-weight='bold'>AADHAAR / ID PROOF</text><rect x='10' y='35' width='25' height='30' fill='%23475569'/><text x='45' y='45' fill='%239ca3af' font-family='sans-serif' font-size='8'>Government of India</text><text x='45' y='58' fill='%239ca3af' font-family='sans-serif' font-size='8'>Instant KYC Verified</text><text x='45' y='72' fill='%23f3f4f6' font-family='sans-serif' font-size='9' font-weight='bold'>${docNum}</text><rect x='10' y='85' width='140' height='5' fill='%23e11d48'/></svg>`;
        } else {
            generatedData = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='100' viewBox='0 0 160 100'><rect width='160' height='100' rx='8' fill='%231e293b' stroke='%236366f1' stroke-width='2'/><text x='10' y='25' fill='%236366f1' font-family='sans-serif' font-size='10' font-weight='bold'>NOMINEE PROOF CARD</text><rect x='10' y='35' width='25' height='30' fill='%23475569'/><text x='45' y='45' fill='%239ca3af' font-family='sans-serif' font-size='8'>Guarantor Security</text><text x='45' y='58' fill='%239ca3af' font-family='sans-serif' font-size='8'>Verified Document</text><text x='45' y='72' fill='%23f3f4f6' font-family='sans-serif' font-size='9' font-weight='bold'>SEC-VERIFIED</text><rect x='10' y='85' width='140' height='5' fill='%2310b981'/></svg>`;
        }

        const inputEl = document.getElementById(currentCameraTarget.inputId);
        const previewEl = document.getElementById(currentCameraTarget.previewId);

        if (inputEl) inputEl.value = generatedData;
        if (previewEl) previewEl.innerHTML = `<img src="${generatedData}" style="width:100%; height:100%; object-fit:contain;">`;
        
        document.getElementById("modal-camera-capture").classList.remove("active");
        stopWebcamStream();
    };
}

function captureLiveWebcamSnapshot(videoEl) {
    const width = videoEl.videoWidth || 640;
    const height = videoEl.videoHeight || 480;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    
    // If front camera, flip canvas horizontally to produce natural photo
    if (currentFacingMode === "user") {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
    }
    
    // Draw video frame to canvas
    ctx.drawImage(videoEl, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    
    // Save to target base64 input
    const inputEl = document.getElementById(currentCameraTarget.inputId);
    const previewEl = document.getElementById(currentCameraTarget.previewId);

    if (inputEl) inputEl.value = dataUrl;
    if (previewEl) previewEl.innerHTML = `<img src="${dataUrl}" style="width:100%; height:100%; object-fit:contain;">`;
    
    document.getElementById("modal-camera-capture").classList.remove("active");
    stopWebcamStream();
}

function stopWebcamStream() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
}

// Render Customers Directory
function renderCustomersList() {
    const query = document.getElementById("customer-search-input").value.trim().toLowerCase();
    const tableBody = document.querySelector("#customers-main-table tbody");
    tableBody.innerHTML = "";

    // Filter array
    const filtered = g_customers.filter(c => {
        // Status filter
        if (customerFilter !== "all" && c.status.toLowerCase() !== customerFilter) return false;
        
        // Search query
        if (query) {
            return c.name.toLowerCase().includes(query) || 
                   c.id.toLowerCase().includes(query) || 
                   c.mobile.includes(query);
        }
        return true;
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No matching customer files found.</td></tr>`;
    } else {
        filtered.forEach(c => {
            const cleanMob = typeof cleanPhoneNumber === "function" ? cleanPhoneNumber(c.mobile) : c.mobile.replace(/\D/g, "");
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong class="text-gradient">${c.id}</strong></td>
                <td><strong>${c.name}</strong></td>
                <td><a href="tel:+91${cleanMob}" class="table-phone-link" title="Click to Call ${c.name} (+91 ${cleanMob})"><i class="fa-solid fa-phone text-emerald" style="font-size: 11px;"></i> ${c.mobile}</a></td>
                <td>${c.city}, ${c.district}</td>
                <td>${c.guarantorName}</td>
                <td><span class="badge badge-${c.status.toLowerCase()}">${c.status}</span></td>
                <td class="action-buttons-cell">
                    <button class="btn-action-icon btn-inspect" onclick="inspectCustomerProfile('${c.id}', 'inspect-info')" title="Inspect KYC & Accounts"><i class="fa-solid fa-id-card"></i></button>
                    <button class="btn-action-icon btn-edit" onclick="editCustomerProfile('${c.id}')" title="Edit Customer Details" style="color:var(--clr-amber); background:var(--clr-amber-glow);"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-action-icon btn-delete" onclick="deleteCustomerProfile('${c.id}')" title="Delete Customer Record" style="color:var(--clr-rose); background:var(--clr-rose-glow);"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
}

// Router to view and filter blocked customers from Dashboard KPI
function filterBlockedCustomersFromKPI() {
    switchModule("customers");
    const sel = document.getElementById("select-customer-status-filter");
    if (sel) {
        sel.value = "blocked";
        customerFilter = "blocked";
        renderCustomersList();
    }
}

// Inspection details handler
function inspectCustomerProfile(cid, defaultTabId = "inspect-info") {
    const customer = getCustomerById(cid);
    if (!customer) return;

    // Fill metadata headers
    document.getElementById("inspect-avatar-img").src = customer.photo;
    document.getElementById("inspect-full-name").textContent = customer.name;
    document.getElementById("inspect-cid").textContent = customer.id;
    
    // Direct Call, SMS & WhatsApp Links for Primary Phone
    const cleanMob1 = typeof cleanPhoneNumber === "function" ? cleanPhoneNumber(customer.mobile) : customer.mobile.replace(/\D/g, "");
    const phone1Link = document.getElementById("inspect-phone-1-link");
    if (phone1Link) {
        phone1Link.href = `tel:+91${cleanMob1}`;
        phone1Link.setAttribute("title", `Click to Call ${customer.name} (+91 ${cleanMob1})`);
    }
    document.getElementById("inspect-phone-1").textContent = customer.mobile;

    // Alternative Mobile Call Link
    const phone2Wrapper = document.getElementById("inspect-phone-2-wrapper");
    const phone2Link = document.getElementById("inspect-phone-2-link");
    if (customer.altMobile && customer.altMobile.trim() !== "") {
        const cleanMob2 = typeof cleanPhoneNumber === "function" ? cleanPhoneNumber(customer.altMobile) : customer.altMobile.replace(/\D/g, "");
        if (phone2Wrapper) phone2Wrapper.style.display = "inline-flex";
        if (phone2Link) {
            phone2Link.href = `tel:+91${cleanMob2}`;
            phone2Link.setAttribute("title", `Click to Call Alternative Mobile (+91 ${cleanMob2})`);
        }
        document.getElementById("inspect-phone-2").textContent = customer.altMobile;
    } else {
        if (phone2Wrapper) phone2Wrapper.style.display = "none";
    }
    
    const badge = document.getElementById("inspect-status-badge");
    badge.textContent = customer.status;
    badge.className = `badge badge-${customer.status.toLowerCase()}`;
    
    // Fill KYC Address
    document.getElementById("inspect-address-str").textContent = `${customer.address}, ${customer.city}, ${customer.district}, ${customer.state}`;
    document.getElementById("inspect-aadhaar-img").src = customer.aadhaar;

    // Fill Guarantor panel
    document.getElementById("inspect-g-name").textContent = customer.guarantorName;
    const inspectAddressEl = document.getElementById("inspect-g-address");
    if (inspectAddressEl) {
        inspectAddressEl.textContent = customer.guarantorAddress || "";
    }
    
    // Nominee Direct Call Link
    const gPhoneLink = document.getElementById("inspect-g-phone-link");
    if (customer.guarantorMobile && customer.guarantorMobile.trim() !== "") {
        const cleanGMob = typeof cleanPhoneNumber === "function" ? cleanPhoneNumber(customer.guarantorMobile) : customer.guarantorMobile.replace(/\D/g, "");
        if (gPhoneLink) {
            gPhoneLink.href = `tel:+91${cleanGMob}`;
            gPhoneLink.setAttribute("title", `Click to Call Nominee ${customer.guarantorName || ''} (+91 ${cleanGMob})`);
        }
    }
    document.getElementById("inspect-g-phone").textContent = customer.guarantorMobile || "N/A";

    const inspectGProofBox = document.getElementById("inspect-g-proof-box");
    const inspectGProofImg = document.getElementById("inspect-g-proof-img");
    if (inspectGProofBox && inspectGProofImg) {
        if (customer.guarantorProof) {
            inspectGProofBox.style.display = "block";
            inspectGProofImg.src = customer.guarantorProof;
        } else {
            inspectGProofBox.style.display = "none";
            inspectGProofImg.src = "";
        }
    }

    // Admin Status Override Dropdown value
    document.getElementById("inspect-status-override").value = customer.status;

    // Active Loans subtable
    const loansBody = document.querySelector("#inspect-loans-table tbody");
    loansBody.innerHTML = "";
    
    const clientLoans = g_loans.filter(l => l.customerId === cid);
    if (clientLoans.length === 0) {
        loansBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No registered loan files.</td></tr>`;
    } else {
        clientLoans.forEach(l => {
            const outBal = getLoanOutstandingBalance(l.id);
            const collected = getLoanCollectedAmount(l.id);
            const totalPayable = getLoanTotalPayable(l);
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong class="text-gradient">${l.id}</strong></td>
                <td>${l.category}</td>
                <td>₹${l.principal.toLocaleString()}</td>
                <td>${l.frequency}</td>
                <td>₹${l.installmentAmount.toLocaleString()}</td>
                <td>₹${collected.toLocaleString()} / ₹${totalPayable.toLocaleString()}</td>
                <td class="${outBal > 0 ? 'text-amber' : ''}">₹${outBal.toLocaleString()}</td>
                <td><span class="badge badge-${l.status.toLowerCase()}">${l.status}</span></td>
            `;
            loansBody.appendChild(row);
        });
    }

    // Ledgers transactions tab rendering - Loan Basis
    const ledgerTab = document.getElementById("inspect-ledgers");
    ledgerTab.innerHTML = ""; // Clear existing static layout

    if (clientLoans.length === 0) {
        ledgerTab.innerHTML = `<div class="text-center text-muted card-padding" style="padding: 20px;"><i class="fa-solid fa-circle-info"></i> No registered loan accounts found for this customer.</div>`;
    } else {
        // Build ledger using pure DOM (no inline onclick, no data-attribute delegation issues)
        clientLoans.forEach(l => {
            const loanBlock = document.createElement("div");
            loanBlock.className = "loan-ledger-block glass card-padding";
            loanBlock.style.background = "rgba(255, 255, 255, 0.01)";
            loanBlock.style.border = "1px solid var(--border-color)";
            loanBlock.style.borderRadius = "8px";
            loanBlock.style.marginBottom = "20px";

            const collected = getLoanCollectedAmount(l.id);
            const totalPayable = getLoanTotalPayable(l);
            const outBal = getLoanOutstandingBalance(l.id);

            const categoryLabel = l.category === "Auto" ? `Auto Finance${l.bikeNumber ? ' - Bike No: ' + l.bikeNumber : ''}` : l.category;

            // Header section
            const headerDiv = document.createElement("div");
            headerDiv.innerHTML = `
                <div class="ledger-block-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; border-bottom:1px dashed var(--border-color); padding-bottom:10px; margin-bottom:12px;">
                    <div>
                        <h4 style="font-size:14px; font-weight:600; color:var(--clr-cyan);"><i class="fa-solid fa-file-invoice"></i> Loan Account: <strong class="text-gradient">${l.id}</strong> (${categoryLabel})</h4>
                        <p class="text-muted" style="font-size:11px; margin-top:2px;">Disbursed: ${formatDateToDMY(l.startDate)} | Maturity: ${formatDateToDMY(l.endDate)} | Duration: ${l.durationDays || 100} Days | Collection Type: ${l.frequency}</p>
                    </div>
                    <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                        <div style="display:flex; gap:8px; align-items:center;">
                            <button class="btn btn-secondary btn-xs" onclick="exportSingleLoanPDF('${l.id}')" style="padding: 2px 6px; font-size: 10px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); color: var(--clr-cyan); border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                            <span class="badge badge-${l.status.toLowerCase()}">${l.status}</span>
                        </div>
                        <p class="text-muted" style="font-size:11px; margin-top:2px;">Collection Amount: <strong>₹${l.installmentAmount.toLocaleString()}</strong></p>
                    </div>
                </div>
                <div class="ledger-block-stats" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:10px; margin-bottom:12px; font-size:12px;">
                    <div>Loan Amount: <strong>₹${l.principal.toLocaleString()}</strong></div>
                    <div>Handover Cost: <strong class="text-cyan">₹${(l.principal - (l.processingFee || 0) - (l.documentFee || 0)).toLocaleString()}</strong></div>
                    <div>Total Payable: <strong>₹${Math.round(totalPayable).toLocaleString()}</strong></div>
                    <div class="text-emerald">Collected: <strong>₹${collected.toLocaleString()}</strong></div>
                    <div class="text-amber">Remaining: <strong>₹${outBal.toLocaleString()}</strong></div>
                </div>
                <h5 style="font-size:12px; font-weight:600; color:var(--clr-cyan); margin-bottom:8px; margin-top:10px;"><i class="fa-solid fa-receipt"></i> Collections Received</h5>
            `;
            loanBlock.appendChild(headerDiv);

            // Collections table
            const loanTx = g_collections.filter(c => c.loanId === l.id);

            if (loanTx.length === 0) {
                const emptyMsg = document.createElement("p");
                emptyMsg.className = "text-muted";
                emptyMsg.style.cssText = "font-size:12px; font-style:italic; padding:5px 0;";
                emptyMsg.textContent = "No collections recorded on this loan account.";
                loanBlock.appendChild(emptyMsg);
            } else {
                const tableWrapper = document.createElement("div");
                tableWrapper.className = "table-scroll-wrapper";
                tableWrapper.style.marginTop = "5px";

                const table = document.createElement("table");
                table.className = "custom-table";
                table.style.fontSize = "13px";

                table.innerHTML = `
                    <thead><tr>
                        <th style="width:50px">No.</th>
                        <th>Date</th>
                        <th>Amount Collected</th>
                        <th>Penalty Paid</th>
                        <th>Payment Mode</th>
                        <th>Remarks / Notes</th>
                        <th class="text-right" style="width:100px">Actions</th>
                    </tr></thead>
                `;

                const tbody = document.createElement("tbody");

                loanTx.forEach((tx, idx) => {
                    const tr = document.createElement("tr");

                    // Cells
                    tr.innerHTML = `
                        <td><strong>${idx + 1}</strong></td>
                        <td>${formatDateToDMY(tx.transactionDate)}</td>
                        <td class="text-emerald">₹${tx.amountCollected.toLocaleString()}</td>
                        <td class="text-amber">₹${tx.penaltyPaid.toLocaleString()}</td>
                        <td><span class="badge">${tx.paymentMode}</span></td>
                        <td><small class="text-muted">${tx.notes || '-'}</small></td>
                    `;

                    // Action cell with direct DOM buttons
                    const actionTd = document.createElement("td");
                    actionTd.className = "action-buttons-cell text-right";
                    actionTd.style.cssText = "white-space:nowrap; width:80px;";

                    // Edit button
                    const editBtn = document.createElement("button");
                    editBtn.title = "Edit Transaction";
                    editBtn.innerHTML = `<i class="fa-solid fa-pen-to-square"></i>`;
                    editBtn.style.cssText = "color:var(--clr-amber); background:var(--clr-amber-glow); padding:4px 6px; border-radius:4px; display:inline-flex; align-items:center; border:none; cursor:pointer; margin-right:4px;";
                    editBtn.addEventListener("click", function() {
                        window.openEditTransactionModal(tx.txId, l.id, tx.transactionDate, tx);
                    });

                    // Delete button
                    const delBtn = document.createElement("button");
                    delBtn.title = "Delete Transaction";
                    delBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i>`;
                    delBtn.style.cssText = "color:var(--clr-rose); background:var(--clr-rose-glow); padding:4px 6px; border-radius:4px; display:inline-flex; align-items:center; border:none; cursor:pointer;";
                    delBtn.addEventListener("click", function() {
                        window.triggerDeleteTransaction(tx.txId, l.customerId, l.id, tx.transactionDate);
                    });

                    actionTd.appendChild(editBtn);
                    actionTd.appendChild(delBtn);
                    tr.appendChild(actionTd);
                    tbody.appendChild(tr);
                });

                table.appendChild(tbody);
                tableWrapper.appendChild(table);
                loanBlock.appendChild(tableWrapper);
            }

            ledgerTab.appendChild(loanBlock);
        });
    }

    // Modal Tabs Navigation routing
    const tabBtns = document.querySelectorAll("#modal-inspect-customer .tab-btn");
    const tabContents = document.querySelectorAll("#modal-inspect-customer .tab-content");

    tabBtns.forEach(btn => {
        btn.onclick = () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const targetTab = btn.getAttribute("data-tab");
            tabContents.forEach(c => {
                c.classList.remove("active");
                if (c.id === targetTab) c.classList.add("active");
            });
        };
    });

    // Set default active tab on open
    const targetTabBtn = Array.from(tabBtns).find(btn => btn.getAttribute("data-tab") === defaultTabId);
    if (targetTabBtn) {
        targetTabBtn.click();
    } else {
        tabBtns[0].click();
    }

    // Show modal
    document.getElementById("modal-inspect-customer").classList.add("active");
}

// 4. LOAN ACCOUNTS ENGINE
function initLoans() {
    const addLoanBtn = document.getElementById("btn-add-loan");
    const addLoanModal = document.getElementById("modal-add-loan");
    const addLoanForm = document.getElementById("form-add-loan");
    const autoLidBtn = document.getElementById("btn-generate-loan-id");
    const borrowerSearchInput = document.getElementById("loan-borrower-search");
    const borrowerResultsDiv = document.getElementById("loan-borrower-results");

    const searchInput = document.getElementById("loan-search-input");

    // Open add loan modal
    if (addLoanBtn) {
        addLoanBtn.addEventListener("click", () => {
            addLoanForm.reset();
            document.getElementById("is-edit-loan-val").value = "false";
            document.getElementById("loan-id").readOnly = false;
            document.getElementById("btn-generate-loan-id").style.display = "inline-flex";
            document.getElementById("loan-modal-title").innerHTML = `<i class="fa-solid fa-hand-holding-dollar text-gradient"></i> Open New Loan Account`;
            document.getElementById("btn-loan-submit").innerHTML = `Disburse Loan Account <i class="fa-solid fa-handshake"></i>`;
            
            document.getElementById("selected-borrower-id-val").value = "";
            document.getElementById("loan-interest-rate").value = g_settings.defaultInterestRate;
            document.getElementById("loan-frequency").value = "Monthly";
            document.getElementById("loan-duration-days").value = "12";
            document.getElementById("loan-duration-label").innerHTML = `Loan Duration (Months) <span class="required">*</span>`;
            document.getElementById("loan-processing-fee").value = "0";
            
            const bikeRow = document.getElementById("row-auto-finance-fields");
            if (bikeRow) bikeRow.classList.add("hidden");
            const bikeInput = document.getElementById("loan-bike-number");
            if (bikeInput) {
                bikeInput.value = "";
                bikeInput.required = false;
            }
            const docFeeInput = document.getElementById("loan-document-fee");
            if (docFeeInput) {
                docFeeInput.value = "0";
            }
            const feeLabel = document.getElementById("label-processing-fee");
            if (feeLabel) feeLabel.textContent = "Processing Fees (₹)";
            const feeInput = document.getElementById("loan-processing-fee");
            if (feeInput) feeInput.placeholder = "Processing fees (defaults to 0)";

            document.getElementById("loan-status-mode").value = "Auto";
            document.getElementById("loan-status-val").value = "Active";
            document.getElementById("loan-status-val").disabled = true;
            
            // Set Start Date to today and Maturity Date to 12 months in DD/MM/YYYY
            const todayStr = new Date().toISOString().split('T')[0];
            const startVal = new Date();
            startVal.setMonth(startVal.getMonth() + 12);
            const endStr = startVal.toISOString().split('T')[0];

            setDatePickerValue("loan-start-date", todayStr);
            setDatePickerValue("loan-end-date", endStr);

            // Reset manual installment flag for new loan
            g_isManualInstallment = false;
            document.getElementById("loan-installment-amount").value = "";

            generateCustomLoanId();
            updateRepaymentPreview(true);
            
            addLoanModal.classList.add("active");
        });
    }

    if (autoLidBtn) {
        autoLidBtn.addEventListener("click", generateCustomLoanId);
    }

    // Status settings mode change listener
    const statusModeSel = document.getElementById("loan-status-mode");
    const statusValSel = document.getElementById("loan-status-val");
    if (statusModeSel && statusValSel) {
        statusModeSel.addEventListener("change", () => {
            if (statusModeSel.value === "Auto") {
                statusValSel.disabled = true;
            } else {
                statusValSel.disabled = false;
            }
        });
    }

    // Category change listener for dynamic field showing
    const categorySel = document.getElementById("loan-category");
    if (categorySel) {
        categorySel.addEventListener("change", () => {
            const bikeRow = document.getElementById("row-auto-finance-fields");
            const bikeInput = document.getElementById("loan-bike-number");

            if (categorySel.value === "Auto") {
                if (bikeRow) bikeRow.classList.remove("hidden");
                if (bikeInput) bikeInput.required = true;
            } else {
                if (bikeRow) bikeRow.classList.add("hidden");
                if (bikeInput) {
                    bikeInput.required = false;
                    bikeInput.value = "";
                }
                const docFeeInput = document.getElementById("loan-document-fee");
                if (docFeeInput) {
                    docFeeInput.value = "0";
                }
            }
        });
    }

    // Auto-complete borrower search in modal
    if (borrowerSearchInput) {
        borrowerSearchInput.addEventListener("input", (e) => {
            const query = e.target.value.trim().toLowerCase();
            borrowerResultsDiv.innerHTML = "";
            document.getElementById("selected-borrower-id-val").value = "";

            if (!query) return;

            const matches = g_customers.filter(c => 
                c.status === "Active" && 
                (c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query))
            );

            matches.forEach(c => {
                const row = document.createElement("div");
                row.className = "autocomplete-row";
                row.innerHTML = `
                    <span class="col-title">${c.name}</span>
                    <span class="col-desc">${c.id} - ${c.mobile}</span>
                `;
                row.onclick = () => {
                    borrowerSearchInput.value = `${c.name} (${c.id})`;
                    document.getElementById("selected-borrower-id-val").value = c.id;
                    borrowerResultsDiv.innerHTML = "";
                    updateRepaymentPreview();
                };
                borrowerResultsDiv.appendChild(row);
            });
        });
    }

    // Date-Duration Calculation inputs listeners (bidirectional and unit-aware)
    const durationInput = document.getElementById("loan-duration-days");
    const startDateInput = document.getElementById("loan-start-date");
    const endDateInput = document.getElementById("loan-end-date");
    const freqInput = document.getElementById("loan-frequency");
    const durationLabel = document.getElementById("loan-duration-label");

    initAppDatePicker("loan-start-date", () => {
        handleDateDurationCalculation();
    });
    initAppDatePicker("loan-end-date", () => {
        handleEndDateManualCalculation();
    });
    
    function handleDateDurationCalculation() {
        const startVal = startDateInput.value;
        const durationVal = parseInt(durationInput.value) || 0;
        const freq = freqInput ? freqInput.value : "Monthly";
        
        if (startVal && durationVal > 0) {
            const startD = new Date(startVal);
            if (freq === "Daily") {
                startD.setDate(startD.getDate() + durationVal);
            } else if (freq === "Weekly") {
                startD.setDate(startD.getDate() + durationVal * 7);
            } else if (freq === "Monthly") {
                startD.setMonth(startD.getMonth() + durationVal);
            } else if (freq === "Yearly") {
                startD.setFullYear(startD.getFullYear() + durationVal);
            }
            const calculatedEndStr = startD.toISOString().split('T')[0];
            setDatePickerValue("loan-end-date", calculatedEndStr);
            updateRepaymentPreview();
        }
    }

    function handleEndDateManualCalculation() {
        const startVal = startDateInput.value;
        const endVal = endDateInput.value;
        const freq = freqInput ? freqInput.value : "Monthly";
        
        if (startVal && endVal) {
            const startD = new Date(startVal);
            const endD = new Date(endVal);
            const diffTime = endD - startD;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays >= 0) {
                if (freq === "Daily") {
                    durationInput.value = diffDays;
                } else if (freq === "Weekly") {
                    durationInput.value = Math.ceil(diffDays / 7);
                } else if (freq === "Monthly") {
                    let months = (endD.getFullYear() - startD.getFullYear()) * 12 + (endD.getMonth() - startD.getMonth());
                    durationInput.value = Math.max(1, months || Math.ceil(diffDays / 30));
                } else if (freq === "Yearly") {
                    let years = endD.getFullYear() - startD.getFullYear();
                    durationInput.value = Math.max(1, years || Math.ceil(diffDays / 365));
                }
                updateRepaymentPreview();
            }
        }
    }

    function handleFrequencyChange() {
        const freq = freqInput ? freqInput.value : "Monthly";
        if (freq === "Daily") {
            durationLabel.innerHTML = `Loan Duration (Days) <span class="required">*</span>`;
            if (durationInput.value === "12" || durationInput.value === "1" || durationInput.value === "") {
                durationInput.value = "100";
            }
        } else if (freq === "Weekly") {
            durationLabel.innerHTML = `Loan Duration (Weeks) <span class="required">*</span>`;
            if (durationInput.value === "100" || durationInput.value === "1" || durationInput.value === "") {
                durationInput.value = "12";
            }
        } else if (freq === "Monthly") {
            durationLabel.innerHTML = `Loan Duration (Months) <span class="required">*</span>`;
            if (durationInput.value === "100" || durationInput.value === "1" || durationInput.value === "") {
                durationInput.value = "12";
            }
        } else if (freq === "Yearly") {
            durationLabel.innerHTML = `Loan Duration (Years) <span class="required">*</span>`;
            if (durationInput.value === "100" || durationInput.value === "12" || durationInput.value === "") {
                durationInput.value = "1";
            }
        }
        handleDateDurationCalculation();
    }

    if (durationInput) {
        durationInput.addEventListener("input", handleDateDurationCalculation);
        durationInput.addEventListener("change", handleDateDurationCalculation);
    }
    if (startDateInput) {
        startDateInput.addEventListener("change", () => {
            handleDateDurationCalculation();
        });
    }
    if (endDateInput) {
        endDateInput.addEventListener("input", handleEndDateManualCalculation);
        endDateInput.addEventListener("change", handleEndDateManualCalculation);
    }
    if (freqInput) {
        freqInput.addEventListener("change", handleFrequencyChange);
    }

    // Interest rate auto-adjustment based on fee relative to principal
    function handleInterestRateAutoAdjustment() {
        const principal = parseFloat(document.getElementById("loan-principal").value) || 0;
        const processingFee = parseFloat(document.getElementById("loan-processing-fee").value) || 0;
        const rateInput = document.getElementById("loan-interest-rate");
        
        if (principal > 0) {
            const defaultRate = parseFloat(g_settings.defaultInterestRate) || 2.00;
            const feePercent = (processingFee / principal) * 100;
            // 0.12 paisa pm discount per 1% processing fee ratio (to allow 17% fee discount to result in 0% interest)
            const discount = feePercent * 0.12;
            const adjustedRate = Math.max(0.0, defaultRate - discount);
            
            rateInput.value = Math.round(adjustedRate * 100) / 100;
            updateRepaymentPreview();
        }
    }

    const principalInput = document.getElementById("loan-principal");
    const feeInput = document.getElementById("loan-processing-fee");
    
    if (principalInput) {
        principalInput.addEventListener("input", handleInterestRateAutoAdjustment);
    }
    if (feeInput) {
        feeInput.addEventListener("input", handleInterestRateAutoAdjustment);
    }

    // Trigger recalculations on inputs changes
    const autoCalcTriggerIds = ["loan-principal", "loan-interest-rate", "loan-interest-type", "loan-frequency", "loan-start-date", "loan-end-date", "loan-duration-days", "loan-processing-fee", "loan-document-fee"];
    autoCalcTriggerIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", () => updateRepaymentPreview(false));
            if (el.tagName === "INPUT") {
                el.addEventListener("input", () => updateRepaymentPreview(false));
            }
        }
    });

    const instInput = document.getElementById("loan-installment-amount");
    if (instInput) {
        instInput.addEventListener("input", () => {
            // If user types into installment amount, treat it as manual entry
            g_isManualInstallment = (instInput.value.trim() !== "");
            updateRepaymentPreview(false);
        });
        instInput.addEventListener("change", () => {
            g_isManualInstallment = (instInput.value.trim() !== "");
            updateRepaymentPreview(false);
        });
    }

    // Recalculate manually triggered click
    const recalcBtn = document.getElementById("btn-recalc-installment");
    if (recalcBtn) {
        recalcBtn.addEventListener("click", (e) => {
            e.preventDefault();
            g_isManualInstallment = false;
            updateRepaymentPreview(true); // force autofill into installment amount
        });
    }

    // Create Loan Form Submit
    if (addLoanForm) {
        addLoanForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const isEdit = document.getElementById("is-edit-loan-val").value === "true";
            const lid = document.getElementById("loan-id").value.trim().toUpperCase();
            const customerId = document.getElementById("selected-borrower-id-val").value;

            if (!customerId) {
                alert("Please select a valid active borrower from the suggestions.");
                return;
            }

            if (!isEdit && getLoanById(lid)) {
                alert("Loan ID already exists. Please choose a unique identification key.");
                return;
            }

            const helper = document.getElementById("loan-interest-type").value === "Flat" ? calculateFlatLoanDetails : calculateReducingLoanDetails;
            const details = helper(
                parseFloat(document.getElementById("loan-principal").value),
                parseFloat(document.getElementById("loan-interest-rate").value),
                document.getElementById("loan-start-date").value,
                document.getElementById("loan-end-date").value,
                document.getElementById("loan-frequency").value,
                parseFloat(document.getElementById("loan-installment-amount").value)
            );

            const durationDays = parseInt(document.getElementById("loan-duration-days").value) || 100;
            const schedule = generateRepaymentSchedule(
                parseFloat(document.getElementById("loan-principal").value),
                details.installmentAmount,
                details.totalPayable,
                document.getElementById("loan-start-date").value,
                document.getElementById("loan-frequency").value,
                durationDays
            );

            const newLoan = {
                id: lid,
                customerId: customerId,
                category: document.getElementById("loan-category").value,
                principal: document.getElementById("loan-principal").value,
                interestRate: document.getElementById("loan-interest-rate").value,
                calculationType: document.getElementById("loan-interest-type").value,
                frequency: document.getElementById("loan-frequency").value,
                installmentAmount: document.getElementById("loan-installment-amount").value,
                startDate: document.getElementById("loan-start-date").value,
                endDate: document.getElementById("loan-end-date").value,
                processingFee: document.getElementById("loan-processing-fee").value || 0,
                documentFee: document.getElementById("loan-document-fee") ? (document.getElementById("loan-document-fee").value || 0) : 0,
                durationDays: durationDays,
                schedule: schedule,
                statusMode: document.getElementById("loan-status-mode").value,
                status: document.getElementById("loan-status-val").value,
                bikeNumber: document.getElementById("loan-category").value === "Auto" ? document.getElementById("loan-bike-number").value.trim().toUpperCase() : ""
            };

            if (isEdit) {
                // Re-allocate past collections for this loan
                const loanColl = g_collections.filter(c => c.loanId === lid).reverse();
                loanColl.forEach(c => {
                    allocateCollectionToSchedule(newLoan, c.amountCollected);
                });
                updateLoan(lid, newLoan);
            } else {
                addLoan(newLoan);
            }
            closeAllModals();
            renderLoansList();
        });
    }

    // Search and filters
    if (searchInput) {
        searchInput.addEventListener("input", renderLoansList);
    }
    const loanStatusSel = document.getElementById("select-loan-status-filter");
    if (loanStatusSel) {
        loanStatusSel.addEventListener("change", () => {
            loanFilter = loanStatusSel.value;
            renderLoansList();
        });
    }
}

function generateCustomLoanId() {
    let maxNum = 5000;
    g_loans.forEach(l => {
        const match = l.id.match(/LOAN-(\d+)/i);
        if (match) {
            const num = parseInt(match[1]);
            if (num > maxNum) maxNum = num;
        }
    });
    document.getElementById("loan-id").value = `LOAN-${maxNum + 1}`;
}

// Manual installment tracking flag
let g_isManualInstallment = false;

// Live estimated interest and payable amount calculator
function updateRepaymentPreview(forceAutofillInstallment = false) {
    if (forceAutofillInstallment) {
        g_isManualInstallment = false;
    }

    const principal = parseFloat(document.getElementById("loan-principal").value) || 0;
    const rate = parseFloat(document.getElementById("loan-interest-rate").value) || 0;
    const type = document.getElementById("loan-interest-type").value;
    const freq = document.getElementById("loan-frequency").value;
    const start = document.getElementById("loan-start-date").value;
    const end = document.getElementById("loan-end-date").value;
    const processingFee = parseFloat(document.getElementById("loan-processing-fee").value) || 0;

    const previewDiv = document.getElementById("loan-calc-preview-card");
    const instInput = document.getElementById("loan-installment-amount");

    // Dynamic Disbursed Amount Preview
    const docFeeInput = document.getElementById("loan-document-fee");
    const documentFee = docFeeInput ? (parseFloat(docFeeInput.value) || 0) : 0;
    const disbursedAmt = principal - processingFee - documentFee;
    const disbursedEl = document.getElementById("loan-disbursed-amount-preview");
    if (disbursedEl) {
        disbursedEl.textContent = g_settings.currency + disbursedAmt.toLocaleString();
    }

    if (principal <= 0 || !start || !end) {
        previewDiv.classList.add("hidden");
        return;
    }

    previewDiv.classList.remove("hidden");

    let manualInst = null;
    if (g_isManualInstallment && instInput && instInput.value.trim() !== "") {
        manualInst = parseFloat(instInput.value) || null;
    }

    const helper = type === "Flat" ? calculateFlatLoanDetails : calculateReducingLoanDetails;
    // Call calculation model
    const details = helper(principal, rate, start, end, freq, manualInst);

    // Render Preview
    const processingFeeVal = parseFloat(document.getElementById("loan-processing-fee").value) || 0;
    const documentFeeVal = parseFloat(document.getElementById("loan-document-fee") ? document.getElementById("loan-document-fee").value : 0) || 0;
    const handoverVal = details.principal - processingFeeVal - documentFeeVal;

    document.getElementById("preview-calc-principal").textContent = g_settings.currency + details.principal.toLocaleString();
    document.getElementById("preview-calc-interest").textContent = g_settings.currency + processingFeeVal.toLocaleString();
    const handoverEl = document.getElementById("preview-calc-handover");
    if (handoverEl) {
        handoverEl.textContent = g_settings.currency + handoverVal.toLocaleString();
    }
    document.getElementById("preview-calc-payable").textContent = g_settings.currency + Math.round(details.totalPayable).toLocaleString();
    document.getElementById("preview-calc-count").textContent = details.installmentsCount;
    const instAmtEl = document.getElementById("preview-calc-installment");
    if (instAmtEl) {
        instAmtEl.textContent = g_settings.currency + (parseFloat(details.installmentAmount) || 0).toLocaleString();
    }

    // Fill installment input only when not manually entered or forced recalc
    if (!g_isManualInstallment || forceAutofillInstallment || !instInput.value) {
        instInput.value = details.installmentAmount;
    }
}

// Render Loans ledger Book
function renderLoansList() {
    const query = document.getElementById("loan-search-input").value.trim().toLowerCase();
    const tableBody = document.querySelector("#loans-main-table tbody");
    tableBody.innerHTML = "";

    const filtered = g_loans.filter(l => {
        const borrower = getCustomerById(l.customerId);
        const name = borrower ? borrower.name.toLowerCase() : "";

        // Status Filter
        if (loanFilter !== "all" && l.status.toLowerCase() !== loanFilter) return false;

        // Search Filter
        if (query) {
            return l.id.toLowerCase().includes(query) || 
                   l.customerId.toLowerCase().includes(query) || 
                   name.includes(query) ||
                   l.category.toLowerCase().includes(query);
        }
        return true;
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No loans registers.</td></tr>`;
    } else {
        filtered.forEach(l => {
            const borrower = getCustomerById(l.customerId);
            const collected = getLoanCollectedAmount(l.id);
            const totalPayable = getLoanTotalPayable(l);
            const outBal = getLoanOutstandingBalance(l.id);

            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong class="text-gradient">${l.id}</strong></td>
                <td>
                    <div>
                        <strong>${borrower ? borrower.name : 'Deleted Client'}</strong>
                        <p class="text-muted" style="font-size: 11px; margin-top: 2px;">CID: ${l.customerId}</p>
                    </div>
                </td>
                <td>${l.category}</td>
                <td class="text-right">₹${l.principal.toLocaleString()}</td>
                <td class="text-center">${l.frequency}</td>
                <td class="text-right"><strong>₹${l.installmentAmount.toLocaleString()}</strong></td>
                <td class="text-center"><span class="badge badge-${l.status.toLowerCase()}">${l.status}</span></td>
                <td class="action-buttons-cell">
                    <button class="btn-action-icon btn-pdf" onclick="inspectCustomerProfile('${l.customerId}', 'inspect-ledgers')" title="View & Download Ledger"><i class="fa-solid fa-file-invoice"></i></button>
                    <button class="btn-action-icon btn-edit" onclick="editLoanAccount('${l.id}')" title="Edit Loan Parameters" style="color:var(--clr-amber); background:var(--clr-amber-glow);"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-action-icon btn-delete" onclick="deleteLoanAccount('${l.id}')" title="Delete Loan File" style="color:var(--clr-rose); background:var(--clr-rose-glow);"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
}

// Quick Payment Action click router
function openPaymentFormForLoan(lid) {
    switchModule("collections");
    
    const searchInput = document.getElementById("collection-loan-search");
    const loan = getLoanById(lid);
    if (!loan) return;
    
    const borrower = getCustomerById(loan.customerId);

    // Auto trigger search input selection
    searchInput.value = `${loan.id} - ${borrower ? borrower.name : ''}`;
    selectCollectionLoanTarget(loan);
}

// 5. COLLECTIONS ENGINE
function initCollections() {
    const searchInput = document.getElementById("collection-loan-search");
    const resultsDiv = document.getElementById("collection-autocomplete-results");
    const collForm = document.getElementById("collection-form");

    // Dynamic Autocomplete loan search input
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.trim().toLowerCase();
            resultsDiv.innerHTML = "";
            hideCollectionSummaryBox();

            if (!query) return;

            const matches = g_loans.filter(l => l.status !== "Closed");
            
            const results = matches.filter(l => {
                const borrower = getCustomerById(l.customerId);
                const name = borrower ? borrower.name.toLowerCase() : "";
                return l.id.toLowerCase().includes(query) || 
                       l.customerId.toLowerCase().includes(query) || 
                       name.includes(query);
            });

            results.forEach(l => {
                const borrower = getCustomerById(l.customerId);
                const row = document.createElement("div");
                row.className = "autocomplete-row";
                row.innerHTML = `
                    <span class="col-title">${l.id}</span>
                    <span class="col-desc">${borrower ? borrower.name : 'Unknown'} (${l.customerId})</span>
                `;
                row.onclick = () => {
                    searchInput.value = `${l.id} - ${borrower ? borrower.name : ''}`;
                    resultsDiv.innerHTML = "";
                    selectCollectionLoanTarget(l);
                };
                resultsDiv.appendChild(row);
            });
        });
    }

    // Submit payment collection
    if (collForm) {
        collForm.addEventListener("submit", (e) => {
            e.preventDefault();
            
            const loanId = document.getElementById("selected-loan-id-val").value;
            const loan = getLoanById(loanId);
            if (!loan) return;

            const newTx = {
                loanId: loanId,
                customerId: loan.customerId,
                amountCollected: parseFloat(document.getElementById("collect-amount").value),
                penaltyPaid: parseFloat(document.getElementById("collect-penalty").value) || 0,
                paymentMode: document.getElementById("collect-mode").value,
                transactionDate: document.getElementById("collect-date").value,
                notes: document.getElementById("collect-notes").value
            };

            const errorMsgEl = document.getElementById("collection-error-msg");
            if (errorMsgEl) errorMsgEl.textContent = "";

            try {
                const tx = addCollection(newTx);
                resetCollectionForm();
                renderCollectionsToday();
                renderDashboard();
            } catch (err) {
                if (errorMsgEl) {
                    errorMsgEl.textContent = err.message;
                } else {
                    alert(err.message);
                }
            }
        });
    }

    // Set transaction date field default to today with Flatpickr
    setDatePickerValue("collect-date", new Date().toISOString().split('T')[0]);
    initAppDatePicker("collect-date");
}

function selectCollectionLoanTarget(loan) {
    const borrower = getCustomerById(loan.customerId);
    
    document.getElementById("selected-loan-id-val").value = loan.id;
    
    // Set UI preview values
    document.getElementById("sum-borrower-photo").src = borrower ? borrower.photo : SVG_PHOTO_MOCK;
    document.getElementById("sum-borrower-name").textContent = borrower ? borrower.name : "Unknown Client";
    document.getElementById("sum-borrower-id").textContent = `CID: ${loan.customerId}`;
    document.getElementById("sum-loan-id").textContent = loan.id;
    document.getElementById("sum-principal").textContent = `₹${loan.principal.toLocaleString()}`;
    document.getElementById("sum-installment-due").textContent = `₹${loan.installmentAmount.toLocaleString()}`;
    
    const outBal = getLoanOutstandingBalance(loan.id);
    document.getElementById("sum-total-balance").textContent = `₹${outBal.toLocaleString()}`;

    // Prefill payment amount
    document.getElementById("collect-amount").value = loan.installmentAmount;
    
    // Enable submit
    document.getElementById("btn-submit-collection").removeAttribute("disabled");

    // Show summary box
    document.getElementById("collection-loan-summary-box").classList.remove("hidden");
}

function hideCollectionSummaryBox() {
    document.getElementById("collection-loan-summary-box").classList.add("hidden");
    document.getElementById("btn-submit-collection").setAttribute("disabled", "true");
    document.getElementById("selected-loan-id-val").value = "";
}

function resetCollectionForm() {
    document.getElementById("collection-form").reset();
    setDatePickerValue("collect-date", new Date().toISOString().split('T')[0]);
    hideCollectionSummaryBox();
    renderCollectionsToday();
}

function renderCollectionsToday() {
    const todayStr = new Date().toISOString().split('T')[0];
    const tableBody = document.querySelector("#collections-today-table tbody");
    const totalTodayEl = document.getElementById("collect-today-total");
    
    tableBody.innerHTML = "";
    
    const todays = g_collections.filter(c => c.transactionDate === todayStr);
    const totalSum = todays.reduce((sum, c) => sum + c.amountCollected, 0);
    totalTodayEl.textContent = `Today: ₹${totalSum.toLocaleString()}`;

    if (todays.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No collections recorded today.</td></tr>`;
    } else {
        todays.forEach((c, idx) => {
            const borrower = getCustomerById(c.customerId);
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${idx + 1}</strong></td>
                <td><span class="badge badge-indigo">${c.loanId}</span></td>
                <td><strong>${borrower ? borrower.name : 'Unknown'}</strong></td>
                <td class="text-emerald text-right">₹${c.amountCollected.toLocaleString()}</td>
                <td><span class="badge">${c.paymentMode}</span></td>
            `;
            tableBody.appendChild(row);
        });
    }
}

// 6. REPORTS SECTION
function initReports() {
    // Set default dates: first day of month to today
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    
    setDatePickerValue("report-start-date", firstDay.toISOString().split('T')[0]);
    setDatePickerValue("report-end-date", now.toISOString().split('T')[0]);

    initAppDatePicker("report-start-date", () => renderReports());
    initAppDatePicker("report-end-date", () => renderReports());

    // Event listener
    const applyFilterBtn = document.getElementById("btn-apply-report-filter");
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener("click", renderReports);
    }

    const searchQuery = document.getElementById("report-search-query");
    if (searchQuery) {
        searchQuery.addEventListener("input", renderReports);
    }

    const filterMode = document.getElementById("report-filter-mode");
    if (filterMode) {
        filterMode.addEventListener("change", renderReports);
    }

    const filterStatus = document.getElementById("report-filter-status");
    if (filterStatus) {
        filterStatus.addEventListener("change", renderReports);
    }

    const exportPdfBtn = document.getElementById("btn-report-export-pdf");
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener("click", () => {
            const startStr = document.getElementById("report-start-date").value;
            const endStr = document.getElementById("report-end-date").value;
            exportReportsPDF(startStr, endStr);
        });
    }

    // Individual Register Table PDF Exporters
    const exportDailyBtn = document.getElementById("btn-export-daily-collections-pdf");
    if (exportDailyBtn) {
        exportDailyBtn.addEventListener("click", () => {
            const startStr = document.getElementById("report-start-date").value;
            const endStr = document.getElementById("report-end-date").value;
            exportDailyCollectionsPDF(startStr, endStr);
        });
    }

    const exportOpsBtn = document.getElementById("btn-export-operations-pdf");
    if (exportOpsBtn) {
        exportOpsBtn.addEventListener("click", () => {
            const startStr = document.getElementById("report-start-date").value;
            const endStr = document.getElementById("report-end-date").value;
            exportOperationsPDF(startStr, endStr);
        });
    }

    const exportUnpaidBtn = document.getElementById("btn-export-unpaid-collections-pdf");
    if (exportUnpaidBtn) {
        exportUnpaidBtn.addEventListener("click", () => {
            const startStr = document.getElementById("report-start-date").value;
            const endStr = document.getElementById("report-end-date").value;
            exportUnpaidCollectionsPDF(startStr, endStr);
        });
    }

    const printBtn = document.getElementById("btn-report-print");
    if (printBtn) {
        printBtn.addEventListener("click", () => {
            window.print();
        });
    }
}

function renderReports() {
    const startStr = document.getElementById("report-start-date").value;
    const endStr = document.getElementById("report-end-date").value;
    const tableBody = document.querySelector("#reports-main-table tbody");
    
    tableBody.innerHTML = "";

    if (!startStr || !endStr) return;

    // 1. Fetch query filters
    const query = document.getElementById("report-search-query") ? document.getElementById("report-search-query").value.toLowerCase().trim() : "";
    const mode = document.getElementById("report-filter-mode") ? document.getElementById("report-filter-mode").value : "All";
    const status = document.getElementById("report-filter-status") ? document.getElementById("report-filter-status").value : "All";
    const todayStr = new Date().toISOString().split('T')[0];

    // Search query match helper
    const matchSearch = (cid, lid, bName) => {
        if (!query) return true;
        return cid.toLowerCase().includes(query) || 
               lid.toLowerCase().includes(query) || 
               bName.toLowerCase().includes(query);
    };

    // Calculate Mode Breakdown stats for collections within date range and search filter
    const modeCounts = { Cash: { count: 0, sum: 0 }, UPI: { count: 0, sum: 0 }, Card: { count: 0, sum: 0 }, NetBanking: { count: 0, sum: 0 } };
    
    const baseCollections = g_collections.filter(c => {
        const borrower = getCustomerById(c.customerId);
        const name = borrower ? borrower.name : "Unknown";
        return c.transactionDate >= startStr && 
               c.transactionDate <= endStr && 
               matchSearch(c.customerId, c.loanId, name);
    });

    baseCollections.forEach(c => {
        let mKey = c.paymentMode;
        if (mKey === "UPI / GPay" || mKey === "UPI/GPay") mKey = "UPI";
        if (mKey === "Net Banking" || mKey === "NetBanking") mKey = "NetBanking";
        
        if (modeCounts[mKey]) {
            modeCounts[mKey].count++;
            modeCounts[mKey].sum += c.amountCollected;
        } else {
            if (!modeCounts[mKey]) {
                modeCounts[mKey] = { count: 0, sum: 0 };
            }
            modeCounts[mKey].count++;
            modeCounts[mKey].sum += c.amountCollected;
        }
    });

    const breakdownEl = document.getElementById("report-mode-breakdown");
    if (breakdownEl) {
        let breakdownHTML = `<span style="font-weight:600; color:var(--clr-cyan);"><i class="fa-solid fa-chart-pie"></i> Mode Share:</span>`;
        const segments = [];
        Object.keys(modeCounts).forEach(k => {
            const displayLabel = k === "NetBanking" ? "Net Banking" : k;
            segments.push(`<span><strong>${displayLabel}</strong>: ${modeCounts[k].count} tx (₹${modeCounts[k].sum.toLocaleString()})</span>`);
        });
        breakdownEl.innerHTML = breakdownHTML + " " + segments.join(" | ");
    }

    // 2. Prepare report rows based on status selection
    let reportRows = [];
    
    if (status === "All" || status === "Paid") {
        g_collections.forEach(c => {
            if (c.transactionDate >= startStr && c.transactionDate <= endStr) {
                const borrower = getCustomerById(c.customerId);
                const name = borrower ? borrower.name : "Unknown";
                if (matchSearch(c.customerId, c.loanId, name)) {
                    if (mode === "All" || c.paymentMode === mode || 
                        (mode === "UPI" && (c.paymentMode === "UPI" || c.paymentMode === "UPI / GPay" || c.paymentMode === "UPI/GPay")) || 
                        (mode === "NetBanking" && (c.paymentMode === "NetBanking" || c.paymentMode === "Net Banking"))) {
                        
                        reportRows.push({
                            txId: c.txId,
                            date: c.transactionDate,
                            customerId: c.customerId,
                            borrowerName: name,
                            loanId: c.loanId,
                            amount: c.amountCollected,
                            penalty: c.penaltyPaid,
                            mode: c.paymentMode,
                            remarks: c.notes || "Received"
                        });
                    }
                }
            }
        });
    }

    if (status === "Pending" || status === "Overdue") {
        const pendingItems = getAllPendingPayments(startStr, endStr, query, status);
        pendingItems.forEach(item => {
            reportRows.push({
                txId: null,
                date: item.dueDate,
                customerId: item.customerId,
                borrowerName: item.borrowerName,
                loanId: item.loanId,
                amount: item.pendingAmount,
                penalty: 0,
                mode: item.status,
                remarks: `Collection #${item.installmentNumber} (${item.frequency}) Due`
            });
        });
    }
    
    if (status === "Settled") {
        g_loans.forEach(l => {
            if (l.status === "Closed" || l.status === "Settled") {
                if (l.endDate >= startStr && l.endDate <= endStr) {
                    const borrower = getCustomerById(l.customerId);
                    const name = borrower ? borrower.name : "Unknown";
                    if (matchSearch(l.customerId, l.id, name)) {
                        reportRows.push({
                            txId: null,
                            date: l.endDate,
                            customerId: l.customerId,
                            borrowerName: name,
                            loanId: l.id,
                            amount: l.principal,
                            penalty: 0,
                            mode: "Settled",
                            remarks: "Loan Account Closed"
                        });
                    }
                }
            }
        });
    }

    // 3. Filter loans disbursed in range for loan statistics box
    const rLoans = g_loans.filter(l => {
        const borrower = getCustomerById(l.customerId);
        const name = borrower ? borrower.name : "Unknown";
        return l.startDate >= startStr && 
               l.startDate <= endStr && 
               matchSearch(l.customerId, l.id, name);
    });

    // 4. Update KPI Summaries
    const colSum = reportRows.reduce((sum, r) => sum + r.amount, 0);
    const penaltySum = reportRows.reduce((sum, r) => sum + r.penalty, 0);
    const loanSum = rLoans.reduce((sum, l) => sum + l.principal, 0);

    const kpiTitle = document.querySelector(".report-summary-box h4");
    if (kpiTitle) {
        if (status === "Pending") {
            kpiTitle.textContent = "Pending Payments Total";
        } else if (status === "Overdue") {
            kpiTitle.textContent = "Overdue Dues Total";
        } else if (status === "Settled") {
            kpiTitle.textContent = "Settled Portfolio";
        } else {
            kpiTitle.textContent = "Collections Selected";
        }
    }

    document.getElementById("report-summary-collections").textContent = `₹${colSum.toLocaleString()}`;
    document.getElementById("report-summary-collections-count").textContent = `${reportRows.length} ${status === "Pending" ? "Pending Dues" : (status === "Overdue" ? "Overdue Dues" : "Records")}`;
    
    document.getElementById("report-summary-penalties").textContent = `₹${penaltySum.toLocaleString()}`;
    
    document.getElementById("report-summary-loans").textContent = `₹${loanSum.toLocaleString()}`;
    document.getElementById("report-summary-loans-count").textContent = `${rLoans.length} Loans disbursed`;

    // 5. Render report rows
    if (reportRows.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">No matching reports registry history.</td></tr>`;
    } else {
        reportRows.forEach((r, idx) => {
            const row = document.createElement("tr");
            
            // Format status badge class
            let badgeClass = "badge";
            if (r.mode === "Overdue") badgeClass = "badge badge-overdue";
            else if (r.mode === "Pending") badgeClass = "badge badge-pending";
            else if (r.mode === "Settled") badgeClass = "badge badge-indigo";
            
            const amountColorClass = (r.mode === "Pending" || r.mode === "Overdue") ? "text-amber" : "text-emerald";

            let actionHtml = `<span class="text-muted">-</span>`;
            if (r.txId) {
                actionHtml = `
                    <div style="display:flex; gap:6px; justify-content:flex-end;">
                        <button class="btn-action-icon btn-edit" onclick="openEditTransactionModal('${r.txId}', '${r.loanId}')" title="Edit Transaction" style="color:var(--clr-amber); background:var(--clr-amber-glow); width:28px; height:28px; font-size:11px;"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="btn-action-icon btn-delete" onclick="deleteReportTransaction('${r.txId}', '${r.customerId}', '${r.loanId}')" title="Delete Transaction Receipt" style="color:var(--clr-rose); background:var(--clr-rose-glow); width:28px; height:28px; font-size:11px;"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                `;
            }

            row.innerHTML = `
                <td><strong>${idx + 1}</strong></td>
                <td>${formatDateToDMY(r.date)}</td>
                <td><strong>${r.customerId}</strong></td>
                <td><strong>${r.borrowerName}</strong></td>
                <td><span class="badge badge-indigo">${r.loanId}</span></td>
                <td class="${amountColorClass}">₹${r.amount.toLocaleString()}</td>
                <td class="text-amber">₹${r.penalty.toLocaleString()}</td>
                <td><span class="${badgeClass}">${r.mode}</span></td>
                <td><small class="text-muted">${r.remarks}</small></td>
                <td class="text-right">${actionHtml}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    // 6. Render separate Operations Register (Loans Disbursed) Table
    const opsTableBody = document.querySelector("#reports-operations-table tbody");
    if (opsTableBody) {
        opsTableBody.innerHTML = "";
        if (rLoans.length === 0) {
            opsTableBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">No loans disbursed in selected period.</td></tr>`;
        } else {
            rLoans.forEach((l, idx) => {
                const borrower = getCustomerById(l.customerId);
                const name = borrower ? borrower.name : "Unknown";
                const handover = l.principal - (l.processingFee || 0) - (l.documentFee || 0);
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td><strong>${idx + 1}</strong></td>
                    <td>${formatDateToDMY(l.startDate)}</td>
                    <td><strong>${l.customerId}</strong></td>
                    <td><strong>${name}</strong></td>
                    <td><span class="badge badge-indigo">${l.id}</span></td>
                    <td>${l.category}</td>
                    <td class="text-right">₹${l.principal.toLocaleString()}</td>
                    <td class="text-right text-cyan">₹${handover.toLocaleString()}</td>
                    <td class="text-right">₹${(l.installmentAmount || 0).toLocaleString()}</td>
                    <td class="text-center"><span class="badge badge-${l.status.toLowerCase()}">${l.status}</span></td>
                `;
                opsTableBody.appendChild(row);
            });
        }
    }

    // 7. Render separate Unpaid Collections table
    const unpaidTableBody = document.querySelector("#reports-unpaid-table tbody");
    if (unpaidTableBody) {
        unpaidTableBody.innerHTML = "";
        
        let unpaidRows = [];
        if (status === "All" || status === "Pending" || status === "Overdue") {
            unpaidRows = getAllPendingPayments(startStr, endStr, query, status);
        }

        if (unpaidRows.length === 0) {
            unpaidTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No unpaid collections found.</td></tr>`;
        } else {
            unpaidRows.forEach((r, idx) => {
                const row = document.createElement("tr");
                let statusBadge = `<span class="badge badge-pending"><i class="fa-solid fa-clock"></i> Due Today</span>`;
                let dateDisplay = `<span style="color:var(--clr-amber); font-weight:600;"><i class="fa-solid fa-calendar-day"></i> Today (${formatDateToDMY(r.dueDate)})</span>`;
                if (r.isOverdue) {
                    statusBadge = `<span class="badge badge-overdue"><i class="fa-solid fa-triangle-exclamation"></i> Missed Due</span>`;
                    dateDisplay = `<span style="color:var(--clr-rose); font-weight:600;"><i class="fa-solid fa-calendar-xmark"></i> ${formatDateToDMY(r.dueDate)}</span>`;
                } else if (!r.isDueToday) {
                    statusBadge = `<span class="badge badge-pending">${r.status}</span>`;
                    dateDisplay = formatDateToDMY(r.dueDate);
                }
                row.innerHTML = `
                    <td><strong>${idx + 1}</strong></td>
                    <td>${dateDisplay}</td>
                    <td><strong>${r.customerId}</strong></td>
                    <td><strong>${r.borrowerName}</strong></td>
                    <td><span class="badge badge-indigo">${r.loanId}</span></td>
                    <td>${r.frequency}</td>
                    <td class="text-right" style="color:var(--clr-amber)">₹${r.pendingAmount.toLocaleString()}</td>
                    <td class="text-center">${statusBadge}</td>
                    <td class="text-center">
                        <button class="btn btn-secondary btn-xs" onclick="triggerDueReminderFromReport('${r.loanId}', '${r.customerId}', ${r.pendingAmount}, '${r.dueDate}', ${r.isOverdue})" title="Send Due Reminder SMS to Client">
                            <i class="fa-solid fa-comment-sms text-cyan"></i> Due SMS
                        </button>
                    </td>
                `;
                unpaidTableBody.appendChild(row);
            });
        }
    }
}

function triggerDueReminderFromReport(loanId, customerId, pendingAmount, dueDate, isOverdue) {
    const customer = getCustomerById(customerId);
    const loan = getLoanById(loanId);
    if (!customer || !loan) {
        alert("Borrower or loan details not found.");
        return;
    }
    dispatchDueReminderSMS(customer, loan, pendingAmount, dueDate, isOverdue);
}
window.triggerDueReminderFromReport = triggerDueReminderFromReport;

// Export CSV Report builder
function exportReportsCSV() {
    const startStr = document.getElementById("report-start-date").value;
    const endStr = document.getElementById("report-end-date").value;
    
    if (!startStr || !endStr) return;

    const start = new Date(startStr);
    const end = new Date(endStr);
    end.setHours(23, 59, 59, 999);

    const rCollections = g_collections.filter(c => {
        const d = new Date(c.transactionDate);
        return d >= start && d <= end;
    });

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Transaction Date,Transaction ID,Customer ID,Customer Name,Loan ID,Amount Collected (Rs),Penalty Paid (Rs),Payment Mode,Notes\r\n";

    rCollections.forEach(c => {
        const borrower = getCustomerById(c.customerId);
        const name = borrower ? borrower.name.replace(/,/g, " ") : "Unknown";
        const notes = c.notes ? c.notes.replace(/,/g, " ") : "";
        csvContent += `${c.transactionDate},${c.txId},${c.customerId},${name},${c.loanId},${c.amountCollected},${c.penaltyPaid},${c.paymentMode},${notes}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `FinFlow_Report_${startStr}_to_${endStr}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
}

// 7. SYSTEM SETTINGS
function initSettings() {
    const sysForm = document.getElementById("settings-system-form");
    const secForm = document.getElementById("settings-security-form");
    const smsForm = document.getElementById("settings-sms-form");

    // Populate values
    if (sysForm) {
        document.getElementById("set-company-name").value = g_settings.companyName || "FinFlow";
        const tagEl = document.getElementById("set-company-tagline");
        if (tagEl) tagEl.value = g_settings.companyTagline || "Simplify Finance. Streamline Business";
        document.getElementById("set-company-mobile").value = g_settings.companyMobile || "";
        document.getElementById("set-currency").value = g_settings.currency;
        const addressEl = document.getElementById("set-company-address");
        if (addressEl) addressEl.value = g_settings.companyAddress || "";
        const interestEl = document.getElementById("set-def-interest");
        if (interestEl) interestEl.value = g_settings.defaultInterestRate;
        const penaltyEl = document.getElementById("set-def-penalty");
        if (penaltyEl) penaltyEl.value = g_settings.defaultPenaltyRate;
    }

    if (secForm) {
        document.getElementById("set-username").value = g_settings.adminUser;
    }



    // Saves
    if (sysForm) {
        sysForm.addEventListener("submit", (e) => {
            e.preventDefault();
            g_settings.companyName = document.getElementById("set-company-name").value.trim() || "FinFlow";
            const tagEl = document.getElementById("set-company-tagline");
            if (tagEl) {
                g_settings.companyTagline = tagEl.value.trim() || "Simplify Finance. Streamline Business";
            }
            g_settings.companyMobile = document.getElementById("set-company-mobile").value.trim();
            g_settings.currency = document.getElementById("set-currency").value.trim();
            const addressEl = document.getElementById("set-company-address");
            if (addressEl) {
                g_settings.companyAddress = addressEl.value.trim();
            }
            const interestEl = document.getElementById("set-def-interest");
            if (interestEl) {
                g_settings.defaultInterestRate = parseFloat(interestEl.value);
            }
            const penaltyEl = document.getElementById("set-def-penalty");
            if (penaltyEl) {
                g_settings.defaultPenaltyRate = parseFloat(penaltyEl.value);
            }

            saveToLocalStorage();
            updateBrandDisplay();
            alert("General company settings updated successfully.");
            renderDashboard();
        });
    }

    if (secForm) {
        secForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const currentPass = document.getElementById("set-old-pass").value;
            const newPass = document.getElementById("set-new-pass").value;
            const confirmPass = document.getElementById("set-confirm-pass").value;
            const errorDiv = document.getElementById("settings-pass-error");
            const successDiv = document.getElementById("settings-pass-success");

            errorDiv.textContent = "";
            successDiv.textContent = "";

            if (currentPass !== g_settings.adminPass) {
                errorDiv.textContent = "Current verification password incorrect.";
                return;
            }

            if (newPass) {
                if (newPass !== confirmPass) {
                    errorDiv.textContent = "New passwords do not match.";
                    return;
                }
                g_settings.adminPass = newPass;
            }

            g_settings.adminUser = document.getElementById("set-username").value.trim();
            saveToLocalStorage();
            successDiv.textContent = "Administrative security profile updated.";
            secForm.reset();
            document.getElementById("set-username").value = g_settings.adminUser;
        });
    }



    const mpinForm = document.getElementById("settings-mpin-form");
    if (mpinForm) {
        mpinForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const currentMpin = document.getElementById("set-current-mpin").value;
            const newMpin = document.getElementById("set-new-mpin").value;
            const confirmMpin = document.getElementById("set-confirm-mpin").value;
            const errorDiv = document.getElementById("settings-mpin-error");
            const successDiv = document.getElementById("settings-mpin-success");

            errorDiv.textContent = "";
            successDiv.textContent = "";

            let currentSessionUser = null;
            try {
                currentSessionUser = JSON.parse(sessionStorage.getItem("kf_current_user"));
            } catch(e) {}

            if (!currentSessionUser) {
                errorDiv.textContent = "Session expired. Please log in again.";
                return;
            }

            const user = g_users.find(u => u.username.toLowerCase() === currentSessionUser.username.toLowerCase());
            if (!user) {
                errorDiv.textContent = "Active admin user profile not found.";
                return;
            }

            if (user.mpin !== currentMpin) {
                errorDiv.textContent = "Current 4-Digit MPIN is incorrect.";
                return;
            }

            if (!/^[0-9]{4}$/.test(newMpin)) {
                errorDiv.textContent = "New MPIN must be exactly 4 digits (0-9).";
                return;
            }

            if (newMpin !== confirmMpin) {
                errorDiv.textContent = "New MPIN fields do not match.";
                return;
            }

            // Update user in DB
            user.mpin = newMpin;
            saveToLocalStorage();

            // Update session storage
            sessionStorage.setItem("kf_current_user", JSON.stringify(user));

            successDiv.textContent = "4-Digit login MPIN updated successfully.";
            mpinForm.reset();
        });
    }

    // Cloud Database & Multi-Device Real-Time Sync Handlers
    const cloudForm = document.getElementById("settings-cloud-sync-form");
    const cloudTestBtn = document.getElementById("btn-cloud-test-connection");
    const cloudSyncAllBtn = document.getElementById("btn-cloud-sync-all");
    const cloudGuideBtn = document.getElementById("btn-toggle-cloud-guide");
    const cloudGuideDiv = document.getElementById("cloud-setup-guide");
    const cloudFeedback = document.getElementById("cloud-sync-feedback");

    if (window.CloudSync) {
        const savedCfg = window.CloudSync.getConfig();
        if (savedCfg) {
            if (document.getElementById("cloud-sync-project-id")) document.getElementById("cloud-sync-project-id").value = savedCfg.projectId || "";
            if (document.getElementById("cloud-sync-api-key")) document.getElementById("cloud-sync-api-key").value = savedCfg.apiKey || "";
            if (document.getElementById("cloud-sync-auth-domain")) document.getElementById("cloud-sync-auth-domain").value = savedCfg.authDomain || "";
            if (document.getElementById("cloud-sync-storage-bucket")) document.getElementById("cloud-sync-storage-bucket").value = savedCfg.storageBucket || "";
            if (document.getElementById("cloud-sync-app-id")) document.getElementById("cloud-sync-app-id").value = savedCfg.appId || "";
        }
    }

    if (cloudGuideBtn && cloudGuideDiv) {
        cloudGuideBtn.addEventListener("click", () => {
            cloudGuideDiv.style.display = cloudGuideDiv.style.display === "none" ? "block" : "none";
        });
    }

    function showCloudFeedback(message, isSuccess = true) {
        if (!cloudFeedback) return;
        cloudFeedback.style.display = "block";
        cloudFeedback.className = isSuccess ? "cloud-feedback-box cloud-feedback-success" : "cloud-feedback-box cloud-feedback-error";
        cloudFeedback.innerHTML = `<i class="fa-solid ${isSuccess ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i> <span>${message}</span>`;
    }

    if (cloudTestBtn) {
        cloudTestBtn.addEventListener("click", async () => {
            const config = {
                projectId: document.getElementById("cloud-sync-project-id").value.trim(),
                apiKey: document.getElementById("cloud-sync-api-key").value.trim(),
                authDomain: document.getElementById("cloud-sync-auth-domain").value.trim() || `${document.getElementById("cloud-sync-project-id").value.trim()}.firebaseapp.com`,
                storageBucket: document.getElementById("cloud-sync-storage-bucket").value.trim() || `${document.getElementById("cloud-sync-project-id").value.trim()}.appspot.com`,
                appId: document.getElementById("cloud-sync-app-id").value.trim() || ""
            };

            if (!config.projectId || !config.apiKey) {
                showCloudFeedback("Please enter both Project ID and Web API Key before testing.", false);
                return;
            }

            cloudTestBtn.disabled = true;
            cloudTestBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Testing...`;

            try {
                const res = await window.CloudSync.testConnection(config);
                showCloudFeedback(res.message || "Connection successful! Firestore database is accessible.", true);
            } catch (err) {
                showCloudFeedback(err.message || "Failed to connect to Firebase Firestore.", false);
            } finally {
                cloudTestBtn.disabled = false;
                cloudTestBtn.innerHTML = `<i class="fa-solid fa-bolt text-amber"></i> Test Connection`;
            }
        });
    }

    if (cloudForm) {
        cloudForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const config = {
                projectId: document.getElementById("cloud-sync-project-id").value.trim(),
                apiKey: document.getElementById("cloud-sync-api-key").value.trim(),
                authDomain: document.getElementById("cloud-sync-auth-domain").value.trim() || `${document.getElementById("cloud-sync-project-id").value.trim()}.firebaseapp.com`,
                storageBucket: document.getElementById("cloud-sync-storage-bucket").value.trim() || `${document.getElementById("cloud-sync-project-id").value.trim()}.appspot.com`,
                appId: document.getElementById("cloud-sync-app-id").value.trim() || ""
            };

            const submitBtn = document.getElementById("btn-cloud-save-config");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Connecting...`;
            }

            try {
                const success = await window.CloudSync.saveConfig(config);
                if (success) {
                    showCloudFeedback("Cloud credentials saved and live multi-device sync connected successfully!", true);
                } else {
                    showCloudFeedback("Credentials saved. Operating with cloud connection.", true);
                }
            } catch (err) {
                showCloudFeedback("Failed to save and connect: " + err.message, false);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Save & Connect Cloud`;
                }
            }
        });
    }

    if (cloudSyncAllBtn) {
        cloudSyncAllBtn.addEventListener("click", async () => {
            if (!confirm("Push all local customers, loans, and collections to the cloud database?\n\nThis will synchronize all local records with Firestore so other devices can access them.")) {
                return;
            }

            cloudSyncAllBtn.disabled = true;
            cloudSyncAllBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Syncing to Cloud...`;

            try {
                const res = await window.CloudSync.syncAllLocalToCloud();
                showCloudFeedback(`Successfully pushed ${res.count} records to the cloud! All connected devices will now see this data.`, true);
            } catch (err) {
                showCloudFeedback("Upload failed: " + err.message, false);
            } finally {
                cloudSyncAllBtn.disabled = false;
                cloudSyncAllBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Push All Local Data to Cloud`;
            }
        });
    }

    // Data Management: Reset All Business Data (Fresh Start)
    const resetAllBtn = document.getElementById("btn-reset-all-data");
    if (resetAllBtn) {
        resetAllBtn.addEventListener("click", () => {
            if (confirm("⚠️ DANGER ZONE: Are you sure you want to PERMANENTLY RESET ALL BUSINESS DATA?\n\nThis will permanently delete:\n• All Customer Profiles & KYC Documents\n• All Loan Accounts & Repayment Schedules\n• All Collection Receipts & Reports History\n\nYour Admin Login and System Settings will be preserved.\n\nClick OK to confirm and start fresh.")) {
                resetAllBusinessData();
                alert("All business data (customers, loans, collections, reports) has been reset. You now have a fresh clean slate.");
                renderDashboard();
                renderCustomersList();
                renderLoansList();
                renderReports();
                renderCollectionsToday();
            }
        });
    }

    // Data Management: Clear Collections & Reports
    const clearCollsBtn = document.getElementById("btn-clear-all-collections");
    if (clearCollsBtn) {
        clearCollsBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to clear all Collections & Reports history?\n\nThis will remove all transaction receipts and reset loan repayment progress, while keeping your Customer Accounts and Loan Files intact.")) {
                clearAllCollections();
                alert("Collections and reports history have been cleared.");
                renderDashboard();
                renderLoansList();
                renderReports();
                renderCollectionsToday();
            }
        });
    }

    // Data Management: Delete All Loans
    const clearLoansBtn = document.getElementById("btn-clear-all-loans");
    if (clearLoansBtn) {
        clearLoansBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to delete ALL Loan Accounts and collection receipts?\n\nCustomer KYC profiles will be preserved.")) {
                clearAllLoans();
                alert("All loan accounts and associated transaction records have been deleted.");
                renderDashboard();
                renderLoansList();
                renderReports();
                renderCollectionsToday();
            }
        });
    }

    // Data Management: Export Database Backup (JSON)
    const exportBackupBtn = document.getElementById("btn-export-backup");
    if (exportBackupBtn) {
        exportBackupBtn.addEventListener("click", () => {
            const jsonStr = exportDatabaseBackup();
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const dateStr = new Date().toISOString().split('T')[0];
            a.href = url;
            a.download = `finflow_backup_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // Data Management: Restore Database Backup (JSON)
    const restoreInput = document.getElementById("input-restore-backup-file");
    if (restoreInput) {
        restoreInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    importDatabaseBackup(evt.target.result);
                    alert("Database restored successfully from backup.");
                    renderDashboard();
                    renderCustomersList();
                    renderLoansList();
                    renderReports();
                    renderCollectionsToday();
                } catch (err) {
                    alert("Restore failed: " + err.message);
                }
            };
            reader.readAsText(file);
            restoreInput.value = "";
        });
    }
}

// ==================== EDIT & DELETE ACTIONS ====================

function editCustomerProfile(cid) {
    const customer = getCustomerById(cid);
    if (!customer) return;

    const addCustForm = document.getElementById("form-add-customer");
    addCustForm.reset();
    
    document.getElementById("is-edit-cust-val").value = "true";
    document.getElementById("cust-id").value = customer.id;
    document.getElementById("cust-id").readOnly = true;
    document.getElementById("btn-generate-cust-id").style.display = "none";
    document.getElementById("customer-modal-title").innerHTML = `<i class="fa-solid fa-pen-to-square text-gradient"></i> Edit Customer Profile`;
    document.getElementById("btn-customer-submit").innerHTML = `Update Profile Details <i class="fa-solid fa-circle-check"></i>`;

    // Fill form fields
    document.getElementById("cust-name").value = customer.name;
    document.getElementById("cust-mobile").value = customer.mobile;
    document.getElementById("cust-alt-mobile").value = customer.altMobile || "";
    document.getElementById("cust-address").value = customer.address;
    document.getElementById("cust-city").value = customer.city;
    document.getElementById("cust-district").value = customer.district;
    document.getElementById("cust-state").value = customer.state;
    document.getElementById("cust-guarantor-name").value = customer.guarantorName;
    const addressInput = document.getElementById("cust-guarantor-address");
    if (addressInput) {
        addressInput.value = customer.guarantorAddress || "";
    }
    document.getElementById("cust-guarantor-mobile").value = customer.guarantorMobile;
    
    // Media previews
    document.getElementById("cust-photo-base64").value = customer.photo;
    document.getElementById("photo-preview-container").innerHTML = `<img src="${customer.photo}" style="width:100%; height:100%; object-fit:contain;">`;
    
    document.getElementById("cust-aadhaar-base64").value = customer.aadhaar;
    document.getElementById("aadhaar-preview-container").innerHTML = `<img src="${customer.aadhaar}" style="width:100%; height:100%; object-fit:contain;">`;
    
    document.getElementById("cust-initial-status").value = customer.status;

    document.getElementById("cust-guarantor-proof-base64").value = customer.guarantorProof || "";
    const gPreviewBox = document.getElementById("guarantor-proof-preview-container");
    if (gPreviewBox) {
        if (customer.guarantorProof) {
            gPreviewBox.innerHTML = `<img src="${customer.guarantorProof}" style="width:100%; height:100%; object-fit:contain;">`;
        } else {
            gPreviewBox.innerHTML = `<i class="fa-solid fa-id-card"></i><span>No Nominee Proof Selected</span>`;
        }
    }

    // Reveal modal overlay
    document.getElementById("modal-add-customer").classList.add("active");
}

function deleteCustomerProfile(cid) {
    if (confirm(`Are you sure you want to permanently delete Customer Profile [${cid}]?\n\nWARNING: All loans and payment transactions associated with this customer will also be deleted!`)) {
        deleteCustomer(cid);
        renderCustomersList();
        renderDashboard();
    }
}

function editLoanAccount(lid) {
    const loan = getLoanById(lid);
    if (!loan) return;

    const addLoanForm = document.getElementById("form-add-loan");
    addLoanForm.reset();

    document.getElementById("is-edit-loan-val").value = "true";
    document.getElementById("loan-id").value = loan.id;
    document.getElementById("loan-id").readOnly = true;
    document.getElementById("btn-generate-loan-id").style.display = "none";
    document.getElementById("loan-modal-title").innerHTML = `<i class="fa-solid fa-pen-to-square text-gradient"></i> Edit Loan Account Details`;
    document.getElementById("btn-loan-submit").innerHTML = `Save Loan Adjustments <i class="fa-solid fa-circle-check"></i>`;

    // Fill form fields
    const borrower = getCustomerById(loan.customerId);
    document.getElementById("loan-borrower-search").value = borrower ? `${borrower.name} (${borrower.id})` : loan.customerId;
    document.getElementById("selected-borrower-id-val").value = loan.customerId;

    document.getElementById("loan-category").value = loan.category;
    document.getElementById("loan-principal").value = loan.principal;
    document.getElementById("loan-interest-rate").value = loan.interestRate;
    document.getElementById("loan-interest-type").value = loan.calculationType;
    document.getElementById("loan-frequency").value = loan.frequency;
    document.getElementById("loan-installment-amount").value = loan.installmentAmount;
    setDatePickerValue("loan-start-date", loan.startDate);
    setDatePickerValue("loan-end-date", loan.endDate);
    document.getElementById("loan-duration-days").value = loan.durationDays || 12;
    document.getElementById("loan-processing-fee").value = loan.processingFee || 0;

    const category = loan.category;
    const bikeRow = document.getElementById("row-auto-finance-fields");
    const bikeInput = document.getElementById("loan-bike-number");
    const docFeeInput = document.getElementById("loan-document-fee");

    if (category === "Auto") {
        if (bikeRow) bikeRow.classList.remove("hidden");
        if (bikeInput) {
            bikeInput.value = loan.bikeNumber || "";
            bikeInput.required = true;
        }
        if (docFeeInput) {
            docFeeInput.value = loan.documentFee || 0;
        }
    } else {
        if (bikeRow) bikeRow.classList.add("hidden");
        if (bikeInput) {
            bikeInput.value = "";
            bikeInput.required = false;
        }
        if (docFeeInput) {
            docFeeInput.value = "0";
        }
    }

    const statusMode = loan.statusMode || "Auto";
    document.getElementById("loan-status-mode").value = statusMode;
    const statusValDropdown = document.getElementById("loan-status-val");
    statusValDropdown.value = loan.status || "Active";
    statusValDropdown.disabled = (statusMode === "Auto");

    // Dynamically update label on edit loading
    const freq = loan.frequency;
    const durationLabel = document.getElementById("loan-duration-label");
    if (durationLabel) {
        if (freq === "Daily") durationLabel.innerHTML = `Loan Duration (Days) <span class="required">*</span>`;
        else if (freq === "Weekly") durationLabel.innerHTML = `Loan Duration (Weeks) <span class="required">*</span>`;
        else if (freq === "Monthly") durationLabel.innerHTML = `Loan Duration (Months) <span class="required">*</span>`;
        else if (freq === "Yearly") durationLabel.innerHTML = `Loan Duration (Years) <span class="required">*</span>`;
    }

    // Refresh calculator preview card preserving loaded installment
    g_isManualInstallment = true;
    updateRepaymentPreview(false);

    // Reveal modal overlay
    document.getElementById("modal-add-loan").classList.add("active");
}

function deleteLoanAccount(lid) {
    if (confirm(`Are you sure you want to permanently delete Loan Account [${lid}]?\n\nWARNING: All transaction payment receipts for this loan will also be deleted!`)) {
        deleteLoan(lid);
        renderLoansList();
        renderDashboard();
    }
}

// Bind to window scope so they work in table inline click events
window.inspectCustomerProfile = inspectCustomerProfile;
window.editCustomerProfile = editCustomerProfile;
window.deleteCustomerProfile = deleteCustomerProfile;
window.editLoanAccount = editLoanAccount;
window.deleteLoanAccount = deleteLoanAccount;

// ==================== MULTI-ADMINS MANAGEMENT VIEW ====================

function renderRegisteredAdmins() {
    const tableBody = document.querySelector("#settings-users-table tbody");
    if (!tableBody) return;
    
    tableBody.innerHTML = "";
    
    // Safety check for empty g_users
    if (!g_users || g_users.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No administrators registered.</td></tr>`;
        return;
    }
    
    g_users.forEach(u => {
        const row = document.createElement("tr");
        
        // Highlight active session user
        let currentSessionUser = null;
        try {
            currentSessionUser = JSON.parse(sessionStorage.getItem("kf_current_user"));
        } catch(e) {}
        
        const isSelf = currentSessionUser && currentSessionUser.username.toLowerCase() === u.username.toLowerCase();
        const selfTag = isSelf ? ' <span class="badge badge-indigo" style="margin-left:5px;">You</span>' : '';
        const statusClass = u.status === "Active" ? "text-emerald" : "text-rose";
        
        // Disable delete/block for self to avoid self-locking
        const disableActions = isSelf ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : '';
        const toggleBtnText = u.status === "Active" ? "Block" : "Activate";
        const toggleBtnClass = u.status === "Active" ? "btn-warning" : "btn-secondary";
        
        row.innerHTML = `
            <td><strong>${u.username}</strong>${selfTag}</td>
            <td>${u.name}</td>
            <td>${u.mobile}</td>
            <td><code>${u.mpin}</code></td>
            <td>${u.createdDate || '-'}</td>
            <td><strong class="${statusClass}">${u.status}</strong></td>
            <td class="text-right">
                <button class="btn ${toggleBtnClass} btn-xs" onclick="toggleAdminStatus('${u.username}')" ${disableActions}>${toggleBtnText}</button>
                <button class="btn btn-danger btn-xs" onclick="deleteAdminAccount('${u.username}')" ${disableActions}><i class="fa-solid fa-trash-can"></i> Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function toggleAdminStatus(username) {
    const user = getUserByUsername(username);
    if (!user) return;
    const newStatus = user.status === "Active" ? "Blocked" : "Active";
    updateUser(username, { status: newStatus });
    renderRegisteredAdmins();
}

function deleteAdminAccount(username) {
    if (confirm(`Are you sure you want to permanently delete Admin account [${username}]?`)) {
        deleteUser(username);
        renderRegisteredAdmins();
    }
}

// Bind to window scope so they work in table inline click events
window.toggleAdminStatus = toggleAdminStatus;
window.deleteAdminAccount = deleteAdminAccount;
window.renderRegisteredAdmins = renderRegisteredAdmins;

function showLoanSchedule(loanId) {
    const loan = getLoanById(loanId);
    if (!loan) return;
    const borrower = getCustomerById(loan.customerId);

    const loanIdEl = document.getElementById("sched-modal-loan-id");
    const borrowerEl = document.getElementById("sched-modal-borrower-name");
    if (loanIdEl) loanIdEl.textContent = loan.id;
    if (borrowerEl) borrowerEl.textContent = borrower ? borrower.name : "Unknown";

    const tableBody = document.querySelector("#view-schedule-table tbody");
    if (tableBody) {
        tableBody.innerHTML = "";

        if (!loan.schedule || loan.schedule.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No repayment schedule generated.</td></tr>`;
        } else {
            loan.schedule.forEach(inst => {
                let statusColor = "text-rose";
                if (inst.status === "Paid") statusColor = "text-emerald";
                else if (inst.status === "Partially Paid") statusColor = "text-amber";
                
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td><strong>${inst.installmentNumber}</strong></td>
                    <td>${formatDateToDMY(inst.dueDate)}</td>
                    <td>₹${inst.amount.toLocaleString()}</td>
                    <td>₹${(inst.paid || 0).toLocaleString()}</td>
                    <td><strong class="${statusColor}">${inst.status}</strong></td>
                `;
                tableBody.appendChild(row);
            });
        }
    }

    const modal = document.getElementById("modal-view-schedule");
    if (modal) modal.classList.add("active");
}

window.showLoanSchedule = showLoanSchedule;

window.openEditTransactionModal = function(txId, loanId, txDate, txObj) {
    // If a direct transaction object was passed (from DOM button), use it immediately
    let tx = txObj || null;
    if (!tx) {
        if (txId && txId !== 'undefined' && txId !== 'null' && txId !== '') {
            tx = g_collections.find(c => String(c.txId) === String(txId));
        }
        if (!tx && loanId && txDate) {
            tx = g_collections.find(c => c.loanId === loanId && c.transactionDate === txDate);
        }
        if (!tx && loanId) {
            tx = g_collections.find(c => c.loanId === loanId);
        }
    }
    if (!tx) {
        alert("Transaction record could not be found.");
        return;
    }
    
    // Ensure txId exists
    if (!tx.txId) {
        tx.txId = "TXN-" + (7000 + g_collections.indexOf(tx) + 1);
        if (typeof saveToLocalStorage === "function") saveToLocalStorage();
    }
    
    const idEl = document.getElementById("edit-tx-id");
    const loanIdEl = document.getElementById("edit-tx-loan-id");
    const amountEl = document.getElementById("edit-tx-amount");
    const penaltyEl = document.getElementById("edit-tx-penalty");
    const modeEl = document.getElementById("edit-tx-mode");
    const dateEl = document.getElementById("edit-tx-date");
    const notesEl = document.getElementById("edit-tx-notes");
    const errorEl = document.getElementById("edit-tx-error-msg");
    
    if (idEl) idEl.value = tx.txId;
    if (loanIdEl) loanIdEl.value = tx.loanId;
    if (amountEl) amountEl.value = tx.amountCollected;
    if (penaltyEl) penaltyEl.value = tx.penaltyPaid || 0;
    
    if (modeEl) {
        const pm = (tx.paymentMode || "").toLowerCase();
        if (pm.includes("upi") || pm.includes("gpay") || pm.includes("phonepe")) {
            modeEl.value = "UPI";
        } else if (pm.includes("card")) {
            modeEl.value = "Card";
        } else if (pm.includes("net") || pm.includes("bank")) {
            modeEl.value = "NetBanking";
        } else {
            modeEl.value = "Cash";
        }
    }

    setDatePickerValue("edit-tx-date", tx.transactionDate);
    initAppDatePicker("edit-tx-date");
    if (notesEl) notesEl.value = tx.notes || "";
    if (errorEl) errorEl.textContent = "";
    
    const editModal = document.getElementById("modal-edit-transaction");
    if (editModal) {
        editModal.style.display = "flex";
        editModal.classList.add("active");
    }
};

window.triggerDeleteTransaction = function(txId, customerId, loanId, txDate) {
    let tx = null;
    if (txId && txId !== 'undefined' && txId !== 'null' && txId !== '') {
        tx = g_collections.find(c => String(c.txId) === String(txId));
    }
    if (!tx && loanId && txDate) {
        tx = g_collections.find(c => c.loanId === loanId && c.transactionDate === txDate);
    }
    if (!tx && loanId) {
        tx = g_collections.find(c => c.loanId === loanId);
    }
    const realTxId = tx ? tx.txId : txId;
    if (confirm("Are you sure you want to permanently delete this collection transaction? This will undo the collection payment allocations.")) {
        if (deleteCollection(realTxId)) {
            alert("Transaction deleted successfully.");
            // Re-render inspection window
            if (customerId) {
                inspectCustomerProfile(customerId, 'inspect-ledgers');
            }
            // Re-render lists
            renderCollectionsToday();
            renderLoansList();
            renderReports();
            renderDashboard();
        } else {
            alert("Error: Transaction not found.");
        }
    }
};

window.deleteReportTransaction = function(txId, customerId, loanId) {
    if (confirm(`Are you sure you want to permanently delete Collection Transaction [${txId}]?\n\nThis will remove the transaction from records and recalculate loan account balances.`)) {
        if (deleteCollection(txId)) {
            alert("Transaction deleted successfully.");
            renderReports();
            renderCollectionsToday();
            renderLoansList();
            renderDashboard();
        } else {
            alert("Error: Transaction record not found.");
        }
    }
};

// Listen to edit transaction form submit
document.addEventListener("DOMContentLoaded", () => {
    const editTxForm = document.getElementById("form-edit-transaction");
    if (editTxForm) {
        editTxForm.addEventListener("submit", (e) => {
            e.preventDefault();
            
            const txId = document.getElementById("edit-tx-id").value;
            const loanId = document.getElementById("edit-tx-loan-id").value;
            const amount = parseFloat(document.getElementById("edit-tx-amount").value);
            const penalty = parseFloat(document.getElementById("edit-tx-penalty").value) || 0;
            const mode = document.getElementById("edit-tx-mode").value;
            const date = document.getElementById("edit-tx-date").value;
            const notes = document.getElementById("edit-tx-notes").value;
            
            const errorMsgEl = document.getElementById("edit-tx-error-msg");
            if (errorMsgEl) errorMsgEl.textContent = "";
            
            const updated = {
                amountCollected: amount,
                penaltyPaid: penalty,
                paymentMode: mode,
                transactionDate: date,
                notes: notes
            };
            
            try {
                const tx = updateCollection(txId, updated);
                if (tx) {
                    // Close only the edit transaction modal
                    const editModal = document.getElementById("modal-edit-transaction");
                    if (editModal) {
                        editModal.classList.remove("active");
                        editModal.style.display = "";
                    }
                    
                    alert("Transaction updated successfully.");
                    
                    // Find customerId for this loan to reload inspection view seamlessly
                    const loan = getLoanById(loanId);
                    if (loan) {
                        inspectCustomerProfile(loan.customerId, 'inspect-ledgers');
                    }
                    renderCollectionsToday();
                    renderLoansList();
                    renderReports();
                    renderDashboard();
                } else {
                    if (errorMsgEl) errorMsgEl.textContent = "Transaction not found.";
                }
            } catch (err) {
                if (errorMsgEl) errorMsgEl.textContent = err.message;
            }
        });
    }
});


