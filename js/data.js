/* ==========================================================================
   Kishore Finance Data Management Layer - js/data.js
   ========================================================================== */

const SVG_PHOTO_MOCK = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%231e293b'/><circle cx='50' cy='35' r='18' fill='%236366f1'/><path d='M20 80c0-15 15-22 30-22s30 7 30 22z' fill='%236366f1'/></svg>`;
const SVG_AADHAAR_MOCK = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='100' viewBox='0 0 160 100'><rect width='160' height='100' rx='8' fill='%231e293b' stroke='%23334155' stroke-width='2'/><text x='10' y='25' fill='%2306b6d4' font-family='sans-serif' font-size='10' font-weight='bold'>AADHAAR CARD</text><rect x='10' y='35' width='25' height='30' fill='%23475569'/><text x='45' y='45' fill='%239ca3af' font-family='sans-serif' font-size='8'>Name: Kishore Kumar</text><text x='45' y='58' fill='%239ca3af' font-family='sans-serif' font-size='8'>DOB: 12/04/1988</text><text x='45' y='72' fill='%23f3f4f6' font-family='sans-serif' font-size='9' font-weight='bold'>1234 5678 9012</text><rect x='10' y='85' width='140' height='5' fill='%23e11d48'/></svg>`;

// Global state variables
let g_settings = {};
let g_customers = [];
let g_loans = [];
let g_collections = [];
let g_users = [];

// Default Initial Settings
const DEFAULT_SETTINGS = {
    companyName: "Kishore Finance",
    companyMobile: "9988776655",
    companyAddress: "12, Finance Street, Chennai, Tamil Nadu",
    currency: "₹",
    dailyTarget: 50000,
    defaultInterestRate: 2.00, // 2 Paisa per rupee per month
    defaultPenaltyRate: 100, // ₹100 penalty fee default
    adminUser: "admin",
    adminPass: "admin123"
};

// Seeding Initial Data if localStorage is empty
function seedDatabase(seedMockDemo = false) {
    console.log("Initializing Kishore Finance database...");
    
    // Seed Settings
    g_settings = { ...DEFAULT_SETTINGS };

    // Seed Users
    seedUsersOnly();

    // Clean initial databases for new records
    g_customers = [];
    g_loans = [];
    g_collections = [];

    saveToLocalStorage();
}

// Reset all customer, loan, and report data (Fresh Start)
function resetAllBusinessData() {
    g_customers = [];
    g_loans = [];
    g_collections = [];
    saveToLocalStorage();
    return true;
}

// Clear all collections / report entries
function clearAllCollections() {
    g_collections = [];
    // Reset payment allocations on all loans
    g_loans.forEach(loan => {
        if (loan.schedule && Array.isArray(loan.schedule)) {
            loan.schedule.forEach(inst => {
                inst.paid = 0;
                inst.status = "Unpaid";
            });
        }
        if ((loan.statusMode || "Auto") === "Auto") {
            loan.status = "Active";
        }
    });
    saveToLocalStorage();
    return true;
}

// Clear all loans and associated collections
function clearAllLoans() {
    g_loans = [];
    g_collections = [];
    saveToLocalStorage();
    return true;
}

// Clear all customers, loans, and collections
function clearAllCustomers() {
    g_customers = [];
    g_loans = [];
    g_collections = [];
    saveToLocalStorage();
    return true;
}

// Export database backup as JSON
function exportDatabaseBackup() {
    const backup = {
        appName: "Kishore Finance",
        version: "2.0",
        exportDate: new Date().toISOString(),
        settings: g_settings,
        users: g_users,
        customers: g_customers,
        loans: g_loans,
        collections: g_collections
    };
    return JSON.stringify(backup, null, 2);
}

// Import database backup from JSON
function importDatabaseBackup(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (data.customers && Array.isArray(data.customers)) g_customers = data.customers;
        if (data.loans && Array.isArray(data.loans)) g_loans = data.loans;
        if (data.collections && Array.isArray(data.collections)) g_collections = data.collections;
        if (data.settings && typeof data.settings === "object") g_settings = { ...DEFAULT_SETTINGS, ...data.settings };
        if (data.users && Array.isArray(data.users)) g_users = data.users;
        saveToLocalStorage();
        return true;
    } catch (e) {
        console.error("Failed to import database backup:", e);
        throw new Error("Invalid backup file format: " + e.message);
    }
}

// LocalStorage Synchronization
function saveToLocalStorage() {
    localStorage.setItem("kf_data_version", "clean_v1");
    localStorage.setItem("kf_settings", JSON.stringify(g_settings));
    localStorage.setItem("kf_customers", JSON.stringify(g_customers));
    localStorage.setItem("kf_loans", JSON.stringify(g_loans));
    localStorage.setItem("kf_collections", JSON.stringify(g_collections));
    localStorage.setItem("kf_users", JSON.stringify(g_users));
}

function loadFromLocalStorage() {
    const dataVersion = localStorage.getItem("kf_data_version");
    const settings = localStorage.getItem("kf_settings");
    const customers = localStorage.getItem("kf_customers");
    const loans = localStorage.getItem("kf_loans");
    const collections = localStorage.getItem("kf_collections");
    const users = localStorage.getItem("kf_users");

    // If version is not clean_v1, perform one-time wipe of demo mock records
    if (dataVersion !== "clean_v1") {
        console.log("First clean database initialization - wiping old demo records.");
        if (settings) {
            try { g_settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settings) }; } catch(e) { g_settings = { ...DEFAULT_SETTINGS }; }
        } else {
            g_settings = { ...DEFAULT_SETTINGS };
        }
        if (users) {
            try { g_users = JSON.parse(users); } catch(e) { seedUsersOnly(); }
        } else {
            seedUsersOnly();
        }
        g_customers = [];
        g_loans = [];
        g_collections = [];
        saveToLocalStorage();
        return;
    }

    if (settings && customers && loans && collections) {
        try {
            g_settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settings) };
            g_customers = JSON.parse(customers).map(c => {
                // Auto-clean any double-quoted broken SVGs in existing local storage
                if (c.photo && c.photo.includes('xmlns="http://www.w3.org/2000/svg"')) {
                    c.photo = SVG_PHOTO_MOCK;
                }
                if (c.aadhaar && c.aadhaar.includes('xmlns="http://www.w3.org/2000/svg"')) {
                    c.aadhaar = SVG_AADHAAR_MOCK;
                }
                return c;
            });
            g_loans = JSON.parse(loans);
            g_collections = JSON.parse(collections).map((c, idx) => {
                if (!c.txId) {
                    c.txId = "TXN-" + (7000 + idx + 1);
                }
                return c;
            });
            
            if (users) {
                g_users = JSON.parse(users);
            } else {
                console.warn("Users node not found. Seeding default admins.");
                seedUsersOnly();
            }
            console.log("Database loaded and parsed from local storage.");
        } catch (e) {
            console.error("Failed to parse local storage data, resetting.", e);
            seedDatabase(false);
        }
    } else {
        seedDatabase(false);
    }
}

// INTEREST CALCULATORS
// Paisa per Rupee per Month Calculation Helper
// Rate of 2 Paisa pm means 2% interest per month.
// Flat Interest Loan Schedule details
function calculateFlatLoanDetails(principal, ratePaisaPm, startDateStr, endDateStr, frequency, manualInstallment) {
    const P = parseFloat(principal);
    const R_pm = parseFloat(ratePaisaPm); // interest rate in % per month
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    
    // Difference in months
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (months <= 0) months = 1;

    const totalInterest = P * (R_pm / 100) * months;
    const totalPayable = P + totalInterest;

    // Determine number of installments based on frequency
    let installmentsCount = 1;
    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
    
    if (frequency === "Daily") {
        installmentsCount = diffDays;
    } else if (frequency === "Weekly") {
        installmentsCount = Math.ceil(diffDays / 7);
    } else if (frequency === "Monthly") {
        installmentsCount = months;
    } else if (frequency === "Yearly") {
        installmentsCount = Math.ceil(months / 12);
    } else { // Custom
        installmentsCount = 1;
    }
    if (installmentsCount <= 0) installmentsCount = 1;

    const autoInstallment = totalPayable / installmentsCount;
    const finalInstallment = manualInstallment ? parseFloat(manualInstallment) : autoInstallment;

    // Recalculate payable and interest dynamically if manually overridden
    const finalPayable = manualInstallment ? (finalInstallment * installmentsCount) : totalPayable;
    const finalInterest = manualInstallment ? (finalPayable - P) : totalInterest;

    return {
        principal: P,
        interest: Math.round(finalInterest * 100) / 100,
        totalPayable: Math.round(finalPayable * 100) / 100,
        installmentsCount: installmentsCount,
        installmentAmount: Math.round(finalInstallment * 100) / 100
    };
}

// Reducing Balance Calculation Helper
function calculateReducingLoanDetails(principal, ratePaisaPm, startDateStr, endDateStr, frequency, manualInstallment) {
    const P = parseFloat(principal);
    const R_pm = parseFloat(ratePaisaPm);
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (months <= 0) months = 1;

    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
    let installmentsCount = 1;
    let ratePerPeriod = R_pm / 100; // default Monthly

    if (frequency === "Daily") {
        installmentsCount = diffDays;
        ratePerPeriod = (R_pm / 100) / 30; // Daily interest rate
    } else if (frequency === "Weekly") {
        installmentsCount = Math.ceil(diffDays / 7);
        ratePerPeriod = (R_pm / 100) / 4.34; // Weekly rate
    } else if (frequency === "Monthly") {
        installmentsCount = months;
        ratePerPeriod = R_pm / 100;
    } else if (frequency === "Yearly") {
        installmentsCount = Math.ceil(months / 12);
        ratePerPeriod = (R_pm / 100) * 12;
    } else {
        installmentsCount = 1;
        ratePerPeriod = (R_pm / 100) * months;
    }

    if (installmentsCount <= 0) installmentsCount = 1;

    // EMI formula: P * r * (1+r)^n / ((1+r)^n - 1)
    let autoInstallment = 0;
    if (ratePerPeriod > 0) {
        autoInstallment = P * ratePerPeriod * Math.pow(1 + ratePerPeriod, installmentsCount) / (Math.pow(1 + ratePerPeriod, installmentsCount) - 1);
    } else {
        autoInstallment = P / installmentsCount;
    }

    const finalInstallment = manualInstallment ? parseFloat(manualInstallment) : autoInstallment;
    const totalPayable = finalInstallment * installmentsCount;
    const totalInterest = totalPayable - P;

    return {
        principal: P,
        interest: Math.round(totalInterest * 100) / 100,
        totalPayable: Math.round(totalPayable * 100) / 100,
        installmentsCount: installmentsCount,
        installmentAmount: Math.round(finalInstallment * 100) / 100
    };
}

// CUSTOMERS FUNCTIONS
function getCustomerById(id) {
    return g_customers.find(c => c.id === id);
}

function addCustomer(cust) {
    g_customers.unshift({
        id: cust.id,
        name: cust.name,
        mobile: cust.mobile,
        altMobile: cust.altMobile || "",
        address: cust.address,
        city: cust.city,
        district: cust.district,
        state: cust.state,
        guarantorName: cust.guarantorName,
        guarantorAddress: cust.guarantorAddress,
        guarantorMobile: cust.guarantorMobile,
        guarantorProof: cust.guarantorProof || "",
        photo: cust.photo || SVG_PHOTO_MOCK,
        aadhaar: cust.aadhaar || SVG_AADHAAR_MOCK,
        status: cust.status || "Active",
        createdDate: cust.createdDate || new Date().toISOString().split('T')[0]
    });
    saveToLocalStorage();
}

function updateCustomer(id, updatedCust) {
    const c = getCustomerById(id);
    if (c) {
        c.name = updatedCust.name;
        c.mobile = updatedCust.mobile;
        c.altMobile = updatedCust.altMobile || "";
        c.address = updatedCust.address;
        c.city = updatedCust.city;
        c.district = updatedCust.district;
        c.state = updatedCust.state;
        c.guarantorName = updatedCust.guarantorName;
        c.guarantorAddress = updatedCust.guarantorAddress;
        c.guarantorMobile = updatedCust.guarantorMobile;
        c.guarantorProof = updatedCust.guarantorProof || "";
        c.photo = updatedCust.photo || c.photo;
        c.aadhaar = updatedCust.aadhaar || c.aadhaar;
        c.status = updatedCust.status || c.status;
        saveToLocalStorage();
    }
}

function deleteCustomer(id) {
    g_customers = g_customers.filter(c => c.id !== id);
    const associatedLoanIds = g_loans.filter(l => l.customerId === id).map(l => l.id);
    g_loans = g_loans.filter(l => l.customerId !== id);
    g_collections = g_collections.filter(c => c.customerId !== id && !associatedLoanIds.includes(c.loanId));
    saveToLocalStorage();
}

function updateCustomerStatus(id, status) {
    const c = getCustomerById(id);
    if (c) {
        c.status = status;
        saveToLocalStorage();
    }
}

// LOANS FUNCTIONS
function getLoanById(id) {
    return g_loans.find(l => l.id === id);
}

function addLoan(loan) {
    g_loans.unshift({
        id: loan.id,
        customerId: loan.customerId,
        category: loan.category,
        principal: parseFloat(loan.principal),
        interestRate: parseFloat(loan.interestRate),
        calculationType: loan.calculationType,
        frequency: loan.frequency,
        installmentAmount: parseFloat(loan.installmentAmount),
        startDate: loan.startDate,
        endDate: loan.endDate,
        statusMode: loan.statusMode || "Auto",
        bikeNumber: loan.bikeNumber || "",
        status: loan.status || "Active",
        processingFee: parseFloat(loan.processingFee) || 0,
        documentFee: parseFloat(loan.documentFee) || 0,
        durationDays: parseInt(loan.durationDays) || 100,
        schedule: loan.schedule || [],
        createdDate: new Date().toISOString().split('T')[0]
    });
    
    // If status mode is Auto, recalculate status based on financials
    const l = g_loans[0];
    if (l.statusMode === "Auto") {
        const outBal = getLoanOutstandingBalance(l.id);
        if (outBal <= 0) {
            l.status = "Closed";
        } else {
            const overdue = getLoanOverdueBalance(l.id);
            l.status = overdue > 0 ? "Overdue" : "Active";
        }
    }

    saveToLocalStorage();
}

function updateLoan(id, updatedLoan) {
    const l = getLoanById(id);
    if (l) {
        l.customerId = updatedLoan.customerId;
        l.category = updatedLoan.category;
        l.principal = parseFloat(updatedLoan.principal);
        l.interestRate = parseFloat(updatedLoan.interestRate);
        l.calculationType = updatedLoan.calculationType;
        l.frequency = updatedLoan.frequency;
        l.installmentAmount = parseFloat(updatedLoan.installmentAmount);
        l.startDate = updatedLoan.startDate;
        l.endDate = updatedLoan.endDate;
        l.processingFee = parseFloat(updatedLoan.processingFee) || 0;
        l.documentFee = parseFloat(updatedLoan.documentFee) || 0;
        l.bikeNumber = updatedLoan.bikeNumber || "";
        l.durationDays = parseInt(updatedLoan.durationDays) || 100;
        if (updatedLoan.schedule) {
            l.schedule = updatedLoan.schedule;
        }
        
        l.statusMode = updatedLoan.statusMode || "Auto";
        if (l.statusMode === "Auto") {
            const outBal = getLoanOutstandingBalance(id);
            if (outBal <= 0) {
                l.status = "Closed";
            } else {
                const overdue = getLoanOverdueBalance(id);
                l.status = overdue > 0 ? "Overdue" : "Active";
            }
        } else {
            l.status = updatedLoan.status || "Active";
        }
        
        saveToLocalStorage();
    }
}

function deleteLoan(id) {
    g_loans = g_loans.filter(l => l.id !== id);
    g_collections = g_collections.filter(c => c.loanId !== id);
    saveToLocalStorage();
}

function getLoanTotalPayable(loan) {
    const helper = loan.calculationType === "Flat" ? calculateFlatLoanDetails : calculateReducingLoanDetails;
    const details = helper(loan.principal, loan.interestRate, loan.startDate, loan.endDate, loan.frequency, loan.installmentAmount);
    return details.totalPayable;
}

function getLoanCollectedAmount(loanId) {
    return g_collections
        .filter(c => c.loanId === loanId)
        .reduce((sum, c) => sum + parseFloat(c.amountCollected), 0);
}

function getLoanOutstandingBalance(loanId) {
    const loan = getLoanById(loanId);
    if (!loan) return 0;
    if (loan.status === "Closed") return 0;

    const totalPayable = getLoanTotalPayable(loan);
    const collected = getLoanCollectedAmount(loanId);
    const outstanding = totalPayable - collected;
    return Math.max(0, Math.round(outstanding * 100) / 100);
}

function getLoanOverdueBalance(loanId) {
    const loan = getLoanById(loanId);
    if (!loan || loan.status === "Closed") return 0;

    if (!loan.schedule || loan.schedule.length === 0) {
        return 0; // Fallback
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let totalOverdue = 0;

    loan.schedule.forEach(inst => {
        if (inst.dueDate < todayStr) {
            const unpaid = inst.amount - (inst.paid || 0);
            if (unpaid > 0) {
                totalOverdue += unpaid;
            }
        }
    });

    return Math.max(0, Math.round(totalOverdue * 100) / 100);
}

// TRANSACTION COLLECTIONS
function recalculateLoanRepaymentAllocations(loanId) {
    const loan = getLoanById(loanId);
    if (!loan) return;
    
    // 1. Reset all schedule items to unpaid/0 paid
    if (loan.schedule && Array.isArray(loan.schedule)) {
        loan.schedule.forEach(inst => {
            inst.paid = 0;
            inst.status = "Unpaid";
        });
    } else {
        // Self repair: generate schedule if missing
        const totalPay = getLoanTotalPayable(loan);
        loan.schedule = generateRepaymentSchedule(loan.principal, loan.installmentAmount, totalPay, loan.startDate, loan.frequency, loan.durationDays || 100);
    }
    
    // 2. Fetch all collections for this loan
    const txs = g_collections.filter(c => c.loanId === loanId);
    
    // Sort chronologically by date
    txs.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
    
    // 3. Re-allocate payments sequentially
    txs.forEach(c => {
        allocateCollectionToSchedule(loan, c.amountCollected);
    });
    
    // 4. Update status auto
    if ((loan.statusMode || "Auto") === "Auto") {
        const outBal = getLoanOutstandingBalance(loanId);
        if (outBal <= 0) {
            loan.status = "Closed";
        } else {
            const overdue = getLoanOverdueBalance(loanId);
            loan.status = overdue > 0 ? "Overdue" : "Active";
        }
    }
    saveToLocalStorage();
}

function addCollection(coll) {
    // Check if transaction already exists for this loan on this date
    const exists = g_collections.some(c => c.loanId === coll.loanId && c.transactionDate === coll.transactionDate);
    if (exists) {
        throw new Error(`A transaction has already been recorded for Loan ID [${coll.loanId}] on ${formatDateToDMY ? formatDateToDMY(coll.transactionDate) : coll.transactionDate}.`);
    }

    const txId = "TXN-" + (7000 + g_collections.length + 1);
    const newTx = {
        txId: txId,
        loanId: coll.loanId,
        customerId: coll.customerId,
        amountCollected: parseFloat(coll.amountCollected),
        penaltyPaid: parseFloat(coll.penaltyPaid || 0),
        paymentMode: coll.paymentMode,
        transactionDate: coll.transactionDate,
        notes: coll.notes || ""
    };
    g_collections.unshift(newTx);
    
    recalculateLoanRepaymentAllocations(coll.loanId);
    saveToLocalStorage();
    return newTx;
}

function updateCollection(txId, updatedColl) {
    const tx = g_collections.find(c => c.txId === txId);
    if (!tx) return null;
    
    // Check if changing date causes a duplicate for this loan ID on that date
    if (tx.transactionDate !== updatedColl.transactionDate) {
        const exists = g_collections.some(c => c.txId !== txId && c.loanId === tx.loanId && c.transactionDate === updatedColl.transactionDate);
        if (exists) {
            throw new Error(`A transaction has already been recorded for Loan ID [${tx.loanId}] on ${formatDateToDMY ? formatDateToDMY(updatedColl.transactionDate) : updatedColl.transactionDate}.`);
        }
    }
    
    const oldLoanId = tx.loanId;
    
    tx.amountCollected = parseFloat(updatedColl.amountCollected);
    tx.penaltyPaid = parseFloat(updatedColl.penaltyPaid || 0);
    tx.paymentMode = updatedColl.paymentMode;
    tx.transactionDate = updatedColl.transactionDate;
    tx.notes = updatedColl.notes || "";
    
    recalculateLoanRepaymentAllocations(oldLoanId);
    if (tx.loanId !== oldLoanId) {
        recalculateLoanRepaymentAllocations(tx.loanId);
    }
    
    saveToLocalStorage();
    return tx;
}

function deleteCollection(txId) {
    const idx = g_collections.findIndex(c => c.txId === txId);
    if (idx !== -1) {
        const loanId = g_collections[idx].loanId;
        g_collections.splice(idx, 1);
        recalculateLoanRepaymentAllocations(loanId);
        saveToLocalStorage();
        return true;
    }
    return false;
}

// KPI CALCULATOR FOR DASHBOARD
function calculateKPIs() {
    const totalCustomers = g_customers.length;
    
    // Total collections
    const totalCollection = g_collections.reduce((sum, c) => sum + c.amountCollected, 0);

    // Today's collections
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCollectionsList = g_collections.filter(c => c.transactionDate === todayStr);
    const todaysCollection = todayCollectionsList.reduce((sum, c) => sum + c.amountCollected, 0);
    const todaysCollectionCount = todayCollectionsList.length;

    // Outstanding, Pending, and Overdues
    let outstandingAmount = 0;
    let overdueBalance = 0;
    let overdueCount = 0;
    let activeLoansCount = 0;
    let pendingInstallmentsAmount = 0;
    let pendingInstallmentsCount = 0;

    let totalHandoverAmount = 0;
    let totalProcessingFees = 0;
    let totalPayableAmount = 0;
    let totalPrincipal = 0;
    let collectionProfit = 0;
    let completedLoansProfit = 0;
    let completedLoansCount = 0;

    g_loans.forEach(loan => {
        const principal = parseFloat(loan.principal) || 0;
        const pFee = parseFloat(loan.processingFee) || 0;
        const dFee = parseFloat(loan.documentFee) || 0;
        const upfrontFee = pFee + dFee;
        const handover = principal - upfrontFee;
        const payable = parseFloat(getLoanTotalPayable(loan)) || 0;
        const loanProfit = Math.max(0, payable - principal);

        totalHandoverAmount += handover;
        totalProcessingFees += upfrontFee;
        totalPayableAmount += payable;
        totalPrincipal += principal;

        // 1. Processing fee is entered first (upfront fee)
        // 2. Handover cost is recorded: handover = principal - upfrontFee
        // 3. Any amount collected beyond handover cost is added to collection profit after full payment is made
        const outBal = getLoanOutstandingBalance(loan.id);
        const isFullyPaid = (loan.status === "Closed") || (outBal <= 0);

        if (isFullyPaid) {
            const collected = getLoanCollectedAmount(loan.id);
            const finalCollected = collected > 0 ? collected : payable;
            const profitBeyondHandover = Math.max(0, finalCollected - handover);
            collectionProfit += upfrontFee + profitBeyondHandover;
            completedLoansProfit += upfrontFee + profitBeyondHandover;
            completedLoansCount++;
        } else {
            // For active loans: upfront fee + any collection profit beyond handover cost
            const collected = getLoanCollectedAmount(loan.id);
            const profitBeyondHandover = Math.max(0, collected - handover);
            collectionProfit += upfrontFee + profitBeyondHandover;
        }

        if (loan.status !== "Closed") {
            activeLoansCount++;
            outstandingAmount += outBal;
            const overdue = getLoanOverdueBalance(loan.id);
            if (overdue > 0) {
                overdueBalance += overdue;
                overdueCount++;
            }

            if (loan.schedule && Array.isArray(loan.schedule)) {
                loan.schedule.forEach(inst => {
                    if (inst.dueDate <= todayStr) {
                        const unpaid = inst.amount - (inst.paid || 0);
                        if (unpaid > 0) {
                            pendingInstallmentsCount++;
                            pendingInstallmentsAmount += unpaid;
                        }
                    }
                });
            }
        }
    });

    // Total Profit = Processing Fee + Total Payable Cost - Handover
    const totalProfit = totalProcessingFees + totalPayableAmount - totalHandoverAmount;

    const blockedCount = g_customers.filter(c => c.status === "Blocked").length;

    // Average loan value
    let avgLoanVal = g_loans.length > 0 ? (totalPrincipal / g_loans.length) : 0;

    // Recovery Target calculations
    const dailyTarget = g_settings.dailyTarget || 50000;
    const targetPct = Math.round((todaysCollection / dailyTarget) * 100);

    return {
        totalCustomers,
        totalCollection,
        todaysCollection,
        todaysCollectionCount,
        outstandingAmount,
        overdueBalance,
        overdueCount,
        pendingInstallmentsAmount: Math.round(pendingInstallmentsAmount * 100) / 100,
        pendingInstallmentsCount,
        blockedCount,
        activeLoansCount,
        completedLoansCount,
        totalHandoverAmount: Math.round(totalHandoverAmount * 100) / 100,
        totalProcessingFees: Math.round(totalProcessingFees * 100) / 100,
        totalPayableAmount: Math.round(totalPayableAmount * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        collectionProfit: Math.round(collectionProfit * 100) / 100,
        completedLoansProfit: Math.round(completedLoansProfit * 100) / 100,
        avgLoanVal,
        dailyTarget,
        targetPct
    };
}

// HELPER FOR PENDING PAYMENTS & SCHEDULES
function getAllPendingPayments(startDateStr = null, endDateStr = null, searchQuery = "", statusFilter = "All") {
    const todayStr = new Date().toISOString().split('T')[0];
    const pendingList = [];

    g_loans.forEach(loan => {
        if (loan.status === "Closed") return;

        const borrower = getCustomerById(loan.customerId);
        const borrowerName = borrower ? borrower.name : "Unknown Client";

        if (searchQuery) {
            const q = searchQuery.toLowerCase().trim();
            const match = loan.id.toLowerCase().includes(q) ||
                          loan.customerId.toLowerCase().includes(q) ||
                          borrowerName.toLowerCase().includes(q);
            if (!match) return;
        }

        if (loan.schedule && Array.isArray(loan.schedule)) {
            loan.schedule.forEach(inst => {
                const unpaid = inst.amount - (inst.paid || 0);
                if (unpaid > 0) {
                    const isOverdue = inst.dueDate < todayStr;
                    const isDueToday = inst.dueDate === todayStr;
                    const instStatus = isOverdue ? "Missed" : (isDueToday ? "Due Today" : "Pending");

                    // When no explicit date range is specified (e.g. Dashboard pending overview),
                    // show past unpaid missed installments (dueDate < todayStr) and today's due installment (dueDate === todayStr).
                    // Exclude future installments (dueDate > todayStr).
                    if (!startDateStr && !endDateStr && inst.dueDate > todayStr) return;

                    if (startDateStr && inst.dueDate < startDateStr) return;
                    if (endDateStr && inst.dueDate > endDateStr) return;

                    if (statusFilter === "Pending" && isOverdue) return;
                    if (statusFilter === "Overdue" && !isOverdue) return;

                    pendingList.push({
                        dueDate: inst.dueDate,
                        customerId: loan.customerId,
                        borrowerName: borrowerName,
                        loanId: loan.id,
                        frequency: loan.frequency,
                        installmentNumber: inst.installmentNumber,
                        totalAmount: inst.amount,
                        paidAmount: inst.paid || 0,
                        pendingAmount: Math.round(unpaid * 100) / 100,
                        status: instStatus,
                        isOverdue: isOverdue,
                        isDueToday: isDueToday,
                        mobile: borrower ? borrower.mobile : ""
                    });
                }
            });
        }
    });

    pendingList.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return pendingList;
}


// ==================== ADMINS MANAGEMENT ====================

function seedUsersOnly() {
    g_users = [
        {
            username: "admin",
            password: "admin123",
            mpin: "1234",
            name: "System Admin",
            mobile: "9988776655",
            status: "Active",
            createdDate: new Date().toISOString().split('T')[0]
        },
        {
            username: "admin2",
            password: "admin123",
            mpin: "5678",
            name: "Branch Admin",
            mobile: "9003001234",
            status: "Active",
            createdDate: new Date().toISOString().split('T')[0]
        }
    ];
    saveToLocalStorage();
}

function getUserByUsername(username) {
    if (!username) return null;
    return g_users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

function getUserByMpin(mpin) {
    return g_users.find(u => u.mpin === mpin);
}

function addUser(user) {
    // Check duplicates
    if (getUserByUsername(user.username)) {
        return { success: false, message: "Username already exists." };
    }
    if (getUserByMpin(user.mpin)) {
        return { success: false, message: "4-Digit MPIN is already taken by another admin." };
    }

    g_users.push({
        username: user.username,
        password: user.password,
        mpin: user.mpin,
        name: user.name,
        mobile: user.mobile,
        status: "Active",
        createdDate: new Date().toISOString().split('T')[0]
    });
    saveToLocalStorage();
    return { success: true };
}

function updateUser(username, updatedFields) {
    const user = getUserByUsername(username);
    if (user) {
        if (updatedFields.password !== undefined) user.password = updatedFields.password;
        if (updatedFields.mpin !== undefined) user.mpin = updatedFields.mpin;
        if (updatedFields.name !== undefined) user.name = updatedFields.name;
        if (updatedFields.mobile !== undefined) user.mobile = updatedFields.mobile;
        if (updatedFields.status !== undefined) user.status = updatedFields.status;
        saveToLocalStorage();
        return true;
    }
    return false;
}

function deleteUser(username) {
    g_users = g_users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
    saveToLocalStorage();
}

function generateRepaymentSchedule(principal, installmentAmount, totalPayable, startDateStr, frequency, durationUnits) {
    const schedule = [];
    const start = new Date(startDateStr);
    let remainingPayable = totalPayable;
    const totalInstallments = Math.max(1, parseInt(durationUnits) || 12);
    
    for (let count = 1; count <= totalInstallments; count++) {
        const current = new Date(start);
        
        if (frequency === "Daily") {
            current.setDate(current.getDate() + (count - 1));
        } else if (frequency === "Weekly") {
            current.setDate(current.getDate() + count * 7);
        } else if (frequency === "Monthly") {
            current.setMonth(current.getMonth() + count);
        } else if (frequency === "Yearly") {
            current.setFullYear(current.getFullYear() + count);
        }
        
        const dueDateStr = current.toISOString().split('T')[0];
        let dueAmount = Math.min(installmentAmount, remainingPayable);
        dueAmount = Math.round(dueAmount * 100) / 100;
        
        // If it's the final installment, balance outstanding exactly to zero
        if (count === totalInstallments) {
            dueAmount = Math.round(remainingPayable * 100) / 100;
        }
        
        schedule.push({
            installmentNumber: count,
            dueDate: dueDateStr,
            amount: dueAmount,
            paid: 0,
            status: "Unpaid"
        });
        
        remainingPayable -= dueAmount;
        if (remainingPayable <= 0) break;
    }
    
    return schedule;
}

function allocateCollectionToSchedule(loan, amountCollected) {
    if (!loan.schedule || loan.schedule.length === 0) {
        // Fallback: If schedule is missing, generate it dynamically to self-repair
        const totalPay = getLoanTotalPayable(loan);
        loan.schedule = generateRepaymentSchedule(loan.principal, loan.installmentAmount, totalPay, loan.startDate, loan.frequency, loan.durationDays || 365);
    }
    
    let remainingPayment = parseFloat(amountCollected) || 0;
    
    for (let i = 0; i < loan.schedule.length; i++) {
        const inst = loan.schedule[i];
        const unpaidDue = inst.amount - (inst.paid || 0);
        
        if (unpaidDue > 0) {
            if (remainingPayment >= unpaidDue) {
                inst.paid = inst.amount;
                inst.status = "Paid";
                remainingPayment -= unpaidDue;
            } else {
                inst.paid = (inst.paid || 0) + remainingPayment;
                inst.status = "Partially Paid";
                remainingPayment = 0;
                break;
            }
        }
    }
    
    // Add overpayment to last installment
    if (remainingPayment > 0.01) {
        const lastInst = loan.schedule[loan.schedule.length - 1];
        lastInst.paid = (lastInst.paid || 0) + remainingPayment;
        lastInst.amount = (lastInst.amount || 0) + remainingPayment;
    }
}

// Initial Database load on import/script load
loadFromLocalStorage();
