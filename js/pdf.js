/* ==========================================================================
   Kishore Finance PDF Exporter - js/pdf.js
   ========================================================================== */

// Helper to convert base64 SVG (used in mock data) to standard PNG for jsPDF support
function ensureRasterImage(dataUrl, callback) {
    if (!dataUrl) {
        callback(null);
        return;
    }
    
    // If it's already a raster image data URL, pass it directly
    if (!dataUrl.startsWith("data:image/svg+xml")) {
        callback(dataUrl);
        return;
    }

    // Convert SVG string to raster PNG using HTML5 canvas
    const img = new Image();
    img.onload = function () {
        const canvas = document.createElement("canvas");
        // Maintain high resolution
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 300, 300);
        ctx.drawImage(img, 0, 0, 300, 300);
        callback(canvas.toDataURL("image/png"));
    };
    img.onerror = function () {
        callback(null);
    };
    img.src = dataUrl;
}

// PDF Exporter for Customer Profile Details
function exportCustomerProfilePDF(customerId) {
    const customer = getCustomerById(customerId);
    if (!customer) {
        alert("Customer record not found.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    // Start loading images rasterization sequentially
    ensureRasterImage(customer.photo, (photoPng) => {
        ensureRasterImage(customer.aadhaar, (aadhaarPng) => {
            
            // 1. BRAND HEADER
            doc.setFillColor(11, 15, 25); // Dark Theme Background
            doc.rect(0, 0, 210, 45, "F");
            
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.text("KISHORE FINANCE", 15, 20);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(6, 182, 212); // Accent color cyan
            doc.text("OFFICIAL BORROWER REGISTRATION RECORD & KYC CARD", 15, 26);
            
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text(`Dispatched Date: ${new Date().toLocaleDateString()} | Terminal ID: SECURE-09`, 15, 38);

            // 2. CLIENT PHOTOGRAPH
            if (photoPng) {
                // Border frame for photo
                doc.setDrawColor(99, 102, 241);
                doc.setLineWidth(0.8);
                doc.rect(154, 14, 41, 41);
                doc.addImage(photoPng, "PNG", 155, 15, 39, 39);
            }

            // 3. PERSONAL DETAILS SECTION
            let y = 60;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(13);
            doc.setTextColor(99, 102, 241); // Indigo Accent
            doc.text("I. CLIENT PRIMARY PROFILE", 15, y);
            
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.2);
            doc.line(15, y + 2, 195, y + 2);

            y += 10;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(75, 85, 99);
            
            const printMetaRow = (label, value, labelX, valX, curY) => {
                doc.setFont("helvetica", "bold");
                doc.setTextColor(75, 85, 99);
                doc.text(label, labelX, curY);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(17, 24, 39);
                doc.text(String(value || ""), valX, curY);
            };

            printMetaRow("Client ID Code:", customer.id, 15, 60, y);
            printMetaRow("Status Indicator:", customer.status, 110, 155, y);
            
            y += 8;
            printMetaRow("Full Name:", customer.name, 15, 60, y);
            printMetaRow("Primary Mobile:", customer.mobile, 110, 155, y);
            
            y += 8;
            printMetaRow("Alternative Cell:", customer.altMobile || "N/A", 15, 60, y);
            printMetaRow("Registered Date:", typeof formatDateToDMY === 'function' ? formatDateToDMY(customer.createdDate) : customer.createdDate, 110, 155, y);

            // 4. KYC ADDRESS SECTION
            y += 16;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(13);
            doc.setTextColor(99, 102, 241);
            doc.text("II. RESIDENTIAL KYC ADDRESS", 15, y);
            doc.line(15, y + 2, 195, y + 2);

            y += 10;
            printMetaRow("Street Address:", customer.address, 15, 60, y);
            
            y += 8;
            printMetaRow("City Location:", customer.city, 15, 60, y);
            printMetaRow("District Admin:", customer.district, 110, 155, y);
            
            y += 8;
            printMetaRow("State / Province:", customer.state, 15, 60, y);

            // 5. NOMINEE DETAILS
            y += 16;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(13);
            doc.setTextColor(99, 102, 241);
            doc.text("III. SECURITY NOMINEE DECLARATION", 15, y);
            doc.line(15, y + 2, 195, y + 2);

            y += 10;
            printMetaRow("Nominee Name:", customer.guarantorName, 15, 60, y);
            printMetaRow("Contact Number:", customer.guarantorMobile, 110, 155, y);
            
            y += 8;
            printMetaRow("Nominee Address:", customer.guarantorAddress || "N/A", 15, 60, y);

            // 6. AADHAAR CARD IMAGE PROOF
            y += 16;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(13);
            doc.setTextColor(99, 102, 241);
            doc.text("IV. ATTACHED KYC IDENTITY PROOF (AADHAAR)", 15, y);
            doc.line(15, y + 2, 195, y + 2);

            y += 8;
            if (aadhaarPng) {
                // Add Aadhar Card centered
                doc.setDrawColor(200, 200, 200);
                doc.rect(54, y + 1, 102, 62);
                doc.addImage(aadhaarPng, "PNG", 55, y + 2, 100, 60);
            } else {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(10);
                doc.setTextColor(156, 163, 175);
                doc.text("No Aadhaar document uploaded in digital archives.", 15, y + 8);
            }

            // Footer note
            doc.setFont("helvetica", "italic");
            doc.setFontSize(7);
            doc.setTextColor(156, 163, 175);
            doc.text("This document is a computer-generated KYC profile of Kishore Finance. Secure encrypted copy.", 15, 285);

            // Save PDF
            doc.save(`Borrower_Profile_${customer.id}.pdf`);
        });
    });
}

// PDF Exporter for Loan Accounts Ledgers
function exportCustomerLedgerPDF(customerId) {
    const customer = getCustomerById(customerId);
    if (!customer) {
        alert("Customer record not found.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    // 1. BRAND HEADER
    doc.setFillColor(11, 15, 25);
    doc.rect(0, 0, 210, 40, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("KISHORE FINANCE", 15, 18);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129); // Accent color emerald
    doc.text("OFFICIAL FINANCIAL LOAN LEDGER STATEMENT", 15, 24);

    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 34);

    // 2. CLIENT INFO SUMMARY
    let y = 50;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text("BORROWER LEDGER FILE SUMMARY", 15, y);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(15, y + 2, 195, y + 2);

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    const printCol = (l1, v1, l2, v2, curY) => {
        doc.setFont("helvetica", "bold");
        doc.text(l1, 15, curY);
        doc.setFont("helvetica", "normal");
        doc.text(String(v1 || ""), 60, curY);

        if (l2) {
            doc.setFont("helvetica", "bold");
            doc.text(l2, 110, curY);
            doc.setFont("helvetica", "normal");
            doc.text(String(v2 || ""), 155, curY);
        }
    };

    printCol("Customer ID:", customer.id, "Contact Cell:", customer.mobile, y);
    y += 6;
    printCol("Borrower Name:", customer.name, "District Location:", customer.district, y);

    // 3. LOAN ACCOUNTS DETAIL
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("LOAN ACCOUNTS LEDGER LIST", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 8;
    const clientLoans = g_loans.filter(l => l.customerId === customerId);
    
    if (clientLoans.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(156, 163, 175);
        doc.text("No loan entries associated with this account.", 15, y + 5);
        y += 10;
    } else {
        // Draw Table Header
        doc.setFillColor(243, 244, 246);
        doc.rect(15, y, 180, 8, "F");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(75, 85, 99);
        doc.text("Loan ID", 17, y + 5);
        doc.text("Category", 40, y + 5);
        doc.text("Loan Amount", 65, y + 5);
        doc.text("Rate", 85, y + 5);
        doc.text("Collection Type", 98, y + 5);
        doc.text("Collection Amt", 123, y + 5);
        doc.text("Collected", 145, y + 5);
        doc.text("Bal Due", 168, y + 5);
        doc.text("Status", 185, y + 5);

        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(17, 24, 39);

        clientLoans.forEach(l => {
            const collected = getLoanCollectedAmount(l.id);
            const outBal = getLoanOutstandingBalance(l.id);

            doc.text(l.id, 17, y + 5);
            doc.text(l.category, 40, y + 5);
            doc.text(`Rs.${l.principal}`, 65, y + 5);
            doc.text(`${l.interestRate} paisa`, 85, y + 5);
            doc.text(l.frequency, 100, y + 5);
            doc.text(`Rs.${l.installmentAmount}`, 125, y + 5);
            doc.text(`Rs.${collected}`, 145, y + 5);
            doc.text(`Rs.${outBal}`, 168, y + 5);
            doc.text(l.status, 185, y + 5);
            
            y += 8;
        });
    }

    // 4. TRANSACTION HISTORY
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("CHRONOLOGICAL TRANSACTION COLLECTION REGISTER", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 8;
    const clientTx = g_collections.filter(c => c.customerId === customerId);

    if (clientTx.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(156, 163, 175);
        doc.text("No transactions recorded on this client folder.", 15, y + 5);
    } else {
        // Draw Table Header
        doc.setFillColor(243, 244, 246);
        doc.rect(15, y, 180, 8, "F");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(75, 85, 99);
        doc.text("No.", 17, y + 5);
        doc.text("Date", 30, y + 5);
        doc.text("Loan ID", 55, y + 5);
        doc.text("Amount Collected", 85, y + 5);
        doc.text("Penalty Paid", 120, y + 5);
        doc.text("Payment Mode", 150, y + 5);
        doc.text("Remarks", 175, y + 5);

        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(17, 24, 39);

        clientTx.forEach((tx, idx) => {
            // Check page overflow
            if (y > 270) {
                doc.addPage();
                y = 20;
                
                // Re-draw subheader
                doc.setFillColor(243, 244, 246);
                doc.rect(15, y, 180, 8, "F");
                doc.setFont("helvetica", "bold");
                doc.setFontSize(8);
                doc.setTextColor(75, 85, 99);
                doc.text("No.", 17, y + 5);
                doc.text("Date", 30, y + 5);
                doc.text("Loan ID", 55, y + 5);
                doc.text("Amount Collected", 85, y + 5);
                doc.text("Penalty Paid", 120, y + 5);
                doc.text("Payment Mode", 150, y + 5);
                doc.text("Remarks", 175, y + 5);
                y += 8;
                doc.setFont("helvetica", "normal");
                doc.setTextColor(17, 24, 39);
            }

            doc.text(`${idx + 1}`, 17, y + 5);
            doc.text(formatDateToDMY(tx.transactionDate), 30, y + 5);
            doc.text(tx.loanId, 55, y + 5);
            doc.text(`Rs.${tx.amountCollected.toLocaleString()}`, 85, y + 5);
            doc.text(`Rs.${tx.penaltyPaid.toLocaleString()}`, 120, y + 5);
            doc.text(tx.paymentMode, 150, y + 5);
            doc.text(tx.notes || "-", 175, y + 5);
            
            y += 8;
        });
    }

    // Footer note
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text("This ledger report is computer-generated. System validated transaction register copy.", 15, 285);

    // Save PDF
    doc.save(`Borrower_Ledger_${customer.id}.pdf`);
}

// PDF Exporter for Official Financial Reports
function exportReportsPDF(startStr, endStr) {
    if (!startStr || !endStr) {
        alert("Please select a date range first.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    // 1. Fetch query filters from DOM
    const query = document.getElementById("report-search-query") ? document.getElementById("report-search-query").value.toLowerCase().trim() : "";
    const mode = document.getElementById("report-filter-mode") ? document.getElementById("report-filter-mode").value : "All";
    const status = document.getElementById("report-filter-status") ? document.getElementById("report-filter-status").value : "All";
    const todayStr = new Date().toISOString().split('T')[0];

    const matchSearch = (cid, lid, bName) => {
        if (!query) return true;
        return cid.toLowerCase().includes(query) || 
               lid.toLowerCase().includes(query) || 
               bName.toLowerCase().includes(query);
    };

    // 2. Filter rows
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

    const rLoans = g_loans.filter(l => {
        const borrower = getCustomerById(l.customerId);
        const name = borrower ? borrower.name : "Unknown";
        return l.startDate >= startStr && 
               l.startDate <= endStr && 
               matchSearch(l.customerId, l.id, name);
    });

    const colSum = reportRows.reduce((sum, r) => sum + r.amount, 0);
    const penaltySum = reportRows.reduce((sum, r) => sum + r.penalty, 0);
    const loanSum = rLoans.reduce((sum, l) => sum + l.principal, 0);

    // 1. BRAND HEADER
    doc.setFillColor(11, 15, 25);
    doc.rect(0, 0, 210, 40, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("KISHORE FINANCE", 15, 18);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(99, 102, 241); // Indigo accent
    doc.text("OFFICIAL FINANCIAL REPORTS STATEMENT", 15, 24);

    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Period: ${formatDateToDMY(startStr)} to ${formatDateToDMY(endStr)} | Filter: Status=${status}, Mode=${mode} | Generated: ${new Date().toLocaleString()}`, 15, 34);

    // 2. REPORT SUMMARY KPI BOXES
    let y = 50;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text("FINANCIAL STATS SUMMARY", 15, y);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(15, y + 2, 195, y + 2);

    y += 10;
    
    // Draw columns of stats
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    const kpiColLabel = (status === "Pending" || status === "Overdue") ? "Total Pending" : (status === "Settled" ? "Total Settled" : "Total Collections");
    doc.text(kpiColLabel, 15, y);
    doc.text("Total Penalties", 80, y);
    doc.text("Total Loans Disbursed", 140, y);
    
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text(`Rs.${colSum.toLocaleString()} (${reportRows.length} items)`, 15, y);
    
    doc.setTextColor(245, 158, 11); // Amber
    doc.text(`Rs.${penaltySum.toLocaleString()}`, 80, y);
    
    doc.setTextColor(99, 102, 241); // Indigo
    doc.text(`Rs.${loanSum.toLocaleString()} (${rLoans.length} loans)`, 140, y);

    // 3. LEDGER HISTORY TABLE
    y += 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text("TRANSACTIONAL COLLECTION REGISTRY", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 8;
    // Table Headers
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    doc.text("No.", 15, y);
    doc.text("Date", 25, y);
    doc.text("Cust ID", 45, y);
    doc.text("Borrower Name", 65, y);
    doc.text("Loan ID", 110, y);
    doc.text("Amount (Rs)", 130, y);
    doc.text("Penalty (Rs)", 155, y);
    doc.text("Status / Mode", 175, y);
    
    doc.setDrawColor(209, 213, 219);
    doc.line(15, y + 2, 195, y + 2);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(75, 85, 99);

    if (reportRows.length === 0) {
        doc.text("No matching report registry files.", 15, y);
    } else {
        reportRows.forEach((r, idx) => {
            if (y > 275) {
                doc.addPage();
                y = 20;
                // Repeat headers on next page
                doc.setFont("helvetica", "bold");
                doc.text("No.", 15, y);
                doc.text("Date", 25, y);
                doc.text("Cust ID", 45, y);
                doc.text("Borrower Name", 65, y);
                doc.text("Loan ID", 110, y);
                doc.text("Amount (Rs)", 130, y);
                doc.text("Penalty (Rs)", 155, y);
                doc.text("Status / Mode", 175, y);
                doc.line(15, y + 2, 195, y + 2);
                y += 8;
                doc.setFont("helvetica", "normal");
            }
            
            doc.text(`${idx + 1}`, 15, y);
            doc.text(formatDateToDMY(r.date), 25, y);
            doc.text(r.customerId, 45, y);
            doc.text(r.borrowerName.substring(0, 18), 65, y);
            doc.text(r.loanId, 110, y);
            doc.text(`Rs.${r.amount.toLocaleString()}`, 130, y);
            doc.text(`Rs.${r.penalty.toLocaleString()}`, 155, y);
            doc.text(r.mode, 175, y);
            
            y += 6;
        });
    }

    // 4. DRAW OPERATIONS REGISTER (LOANS DISBURSED) TABLE
    y += 15;
    if (y > 250) {
        doc.addPage();
        y = 20;
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text("OPERATIONS REGISTER (LOANS DISBURSED & ACCOUNTS OPENED)", 15, y);
    doc.line(15, y + 2, 195, y + 2);
    y += 8;

    // Table Headers
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    doc.text("No.", 15, y);
    doc.text("Disbursed Date", 25, y);
    doc.text("Cust ID", 52, y);
    doc.text("Borrower Name", 72, y);
    doc.text("Loan ID", 110, y);
    doc.text("Loan Amount", 130, y);
    doc.text("Handover", 155, y);
    doc.text("Status", 180, y);
    doc.line(15, y + 2, 195, y + 2);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(75, 85, 99);

    if (rLoans.length === 0) {
        doc.text("No loans disbursed in selected range.", 15, y);
    } else {
        rLoans.forEach((l, idx) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
                doc.setFont("helvetica", "bold");
                doc.text("No.", 15, y);
                doc.text("Disbursed Date", 25, y);
                doc.text("Cust ID", 52, y);
                doc.text("Borrower Name", 72, y);
                doc.text("Loan ID", 110, y);
                doc.text("Loan Amount", 130, y);
                doc.text("Handover", 155, y);
                doc.text("Status", 180, y);
                doc.line(15, y + 2, 195, y + 2);
                y += 8;
                doc.setFont("helvetica", "normal");
            }
            const borrower = getCustomerById(l.customerId);
            const name = borrower ? borrower.name : "Unknown";
            const handover = l.principal - (l.processingFee || 0) - (l.documentFee || 0);

            doc.text(`${idx + 1}`, 15, y);
            doc.text(formatDateToDMY(l.startDate), 25, y);
            doc.text(l.customerId, 52, y);
            doc.text(name.substring(0, 18), 72, y);
            doc.text(l.id, 110, y);
            doc.text(`Rs.${l.principal.toLocaleString()}`, 130, y);
            doc.text(`Rs.${handover.toLocaleString()}`, 155, y);
            doc.text(l.status, 180, y);
            y += 6;
        });
    }

    // 5. DRAW UNPAID COLLECTIONS REGISTER TABLE
    y += 15;
    if (y > 250) {
        doc.addPage();
        y = 20;
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text("UNPAID COLLECTIONS REGISTER (PENDING & OVERDUE)", 15, y);
    doc.line(15, y + 2, 195, y + 2);
    y += 8;

    // Table Headers
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    doc.text("No.", 15, y);
    doc.text("Due Date", 25, y);
    doc.text("Cust ID", 45, y);
    doc.text("Borrower Name", 65, y);
    doc.text("Loan ID", 110, y);
    doc.text("Collection Type", 126, y);
    doc.text("Collection Due", 150, y);
    doc.text("Status", 175, y);
    doc.line(15, y + 2, 195, y + 2);
    y += 6;

    // Fetch unpaid
    let unpaidRows = [];
    if (status === "All" || status === "Pending" || status === "Overdue") {
        g_loans.forEach(l => {
            const borrower = getCustomerById(l.customerId);
            const name = borrower ? borrower.name : "Unknown";
            if (matchSearch(l.customerId, l.id, name)) {
                if (l.schedule && Array.isArray(l.schedule)) {
                    l.schedule.forEach(inst => {
                        if (inst.dueDate >= startStr && inst.dueDate <= endStr) {
                            if (!inst.paid && inst.status !== "Paid") {
                                const isOverdue = inst.dueDate <= todayStr;
                                if (status === "All" || 
                                    (status === "Pending" && !isOverdue) || 
                                    (status === "Overdue" && isOverdue)) {
                                    unpaidRows.push({
                                        dueDate: inst.dueDate,
                                        customerId: l.customerId,
                                        borrowerName: name,
                                        loanId: l.id,
                                        frequency: l.frequency,
                                        amount: inst.amount,
                                        isOverdue: isOverdue
                                    });
                                }
                            }
                        }
                    });
                }
            }
        });
    }

    unpaidRows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    doc.setFont("helvetica", "normal");
    doc.setTextColor(75, 85, 99);

    if (unpaidRows.length === 0) {
        doc.text("No unpaid collections found in selected range.", 15, y);
    } else {
        unpaidRows.forEach((r, idx) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
                // Repeat headers on next page
                doc.setFont("helvetica", "bold");
                doc.text("No.", 15, y);
                doc.text("Due Date", 25, y);
                doc.text("Cust ID", 45, y);
                doc.text("Borrower Name", 65, y);
                doc.text("Loan ID", 110, y);
                doc.text("Collection Type", 126, y);
                doc.text("Collection Due", 150, y);
                doc.text("Status", 175, y);
                doc.line(15, y + 2, 195, y + 2);
                y += 8;
                doc.setFont("helvetica", "normal");
            }
            
            doc.text(`${idx + 1}`, 15, y);
            doc.text(formatDateToDMY(r.dueDate), 25, y);
            doc.text(r.customerId, 45, y);
            doc.text(r.borrowerName.substring(0, 18), 65, y);
            doc.text(r.loanId, 110, y);
            doc.text(r.frequency, 130, y);
            doc.text(`Rs.${r.amount.toLocaleString()}`, 150, y);
            doc.text(r.isOverdue ? "Overdue" : "Pending", 175, y);
            
            y += 6;
        });
    }

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text("This official report is computer-generated. System validated copy.", 15, 285);

    doc.save(`KishoreFinance_Report_${startStr}_to_${endStr}.pdf`);
}

// PDF Exporter for a Single Loan Account statement
function exportSingleLoanPDF(loanId) {
    const loan = getLoanById(loanId);
    if (!loan) return;
    const customer = getCustomerById(loan.customerId);
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    // 1. BRAND HEADER
    doc.setFillColor(11, 15, 25);
    doc.rect(0, 0, 210, 40, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("KISHORE FINANCE", 15, 18);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(99, 102, 241); // Indigo accent
    doc.text(`LOAN STATEMENT: ${loan.id}`, 15, 24);

    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 34);

    // 2. CLIENT INFO BLOCK
    let y = 50;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text("BORROWER PROFILE DETAILS", 15, y);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(15, y + 2, 195, y + 2);

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    const printCol = (l1, v1, l2, v2, curY) => {
        doc.setFont("helvetica", "bold");
        doc.text(l1, 15, curY);
        doc.setFont("helvetica", "normal");
        doc.text(String(v1 || ""), 60, curY);

        if (l2) {
            doc.setFont("helvetica", "bold");
            doc.text(l2, 110, curY);
            doc.setFont("helvetica", "normal");
            doc.text(String(v2 || ""), 155, curY);
        }
    };

    printCol("Customer ID:", loan.customerId, "Contact Cell:", customer ? customer.mobile : "N/A", y);
    y += 6;
    printCol("Borrower Name:", customer ? customer.name : "N/A", "District Location:", customer ? customer.district : "N/A", y);

    // 3. LOAN SCHEME METRIC STATS
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("LOAN ACCOUNT SCHEME PARAMETERS", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 10;
    printCol("Loan Amount:", `Rs.${loan.principal.toLocaleString()}`, "Collection Type:", loan.frequency, y);
    y += 6;
    printCol("Interest Pricing Rate:", `${loan.interestRate} paisa (${loan.calculationType})`, "Scheduled Collection Amount:", `Rs.${loan.installmentAmount.toLocaleString()}`, y);
    y += 6;
    printCol("Disbursed Date:", formatDateToDMY(loan.startDate), "Maturity Date:", formatDateToDMY(loan.endDate), y);
    y += 6;
    printCol("Duration Term:", `${loan.durationDays || 100} Days`, "Account Status:", loan.status, y);

    const collected = getLoanCollectedAmount(loan.id);
    const totalPayable = getLoanTotalPayable(loan);
    const outBal = getLoanOutstandingBalance(loan.id);

    y += 10;
    doc.setFillColor(243, 244, 246);
    doc.rect(15, y, 180, 14, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text("Handover Cost", 20, y + 5);
    doc.text("Total Payable Value", 65, y + 5);
    doc.text("Total Collections Paid", 110, y + 5);
    doc.text("Outstanding Remaining", 155, y + 5);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(99, 102, 241); // Indigo/Cyan for Handover Cost
    doc.text(`Rs.${(loan.principal - (loan.processingFee || 0) - (loan.documentFee || 0)).toLocaleString()}`, 20, y + 10);
    doc.setTextColor(17, 24, 39);
    doc.text(`Rs.${Math.round(totalPayable).toLocaleString()}`, 65, y + 10);
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text(`Rs.${collected.toLocaleString()}`, 110, y + 10);
    doc.setTextColor(245, 158, 11); // Amber
    doc.text(`Rs.${outBal.toLocaleString()}`, 155, y + 10);

    // 4. COLLECTION REGISTRY TABLE FOR THIS LOAN
    y += 22;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text("LOAN COLLECTION STATEMENT REGISTER", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 8;
    const loanTx = g_collections.filter(c => c.loanId === loan.id);

    if (loanTx.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(156, 163, 175);
        doc.text("No collections recorded on this loan account.", 15, y + 5);
    } else {
        // Table Header
        doc.setFillColor(243, 244, 246);
        doc.rect(15, y, 180, 8, "F");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(75, 85, 99);
        doc.text("No.", 17, y + 5);
        doc.text("Date", 30, y + 5);
        doc.text("Amount Collected", 70, y + 5);
        doc.text("Penalty Paid", 110, y + 5);
        doc.text("Payment Mode", 145, y + 5);
        doc.text("Remarks", 175, y + 5);

        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(17, 24, 39);

        loanTx.forEach((tx, idx) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
                // Repeat Headers
                doc.setFillColor(243, 244, 246);
                doc.rect(15, y, 180, 8, "F");
                doc.setFont("helvetica", "bold");
                doc.setFontSize(8);
                doc.setTextColor(75, 85, 99);
                doc.text("No.", 17, y + 5);
                doc.text("Date", 30, y + 5);
                doc.text("Amount Collected", 70, y + 5);
                doc.text("Penalty Paid", 110, y + 5);
                doc.text("Payment Mode", 145, y + 5);
                doc.text("Remarks", 175, y + 5);
                y += 8;
                doc.setFont("helvetica", "normal");
                doc.setTextColor(17, 24, 39);
            }

            doc.text(`${idx + 1}`, 17, y + 5);
            doc.text(formatDateToDMY(tx.transactionDate), 30, y + 5);
            doc.text(`Rs.${tx.amountCollected.toLocaleString()}`, 70, y + 5);
            doc.text(`Rs.${tx.penaltyPaid.toLocaleString()}`, 110, y + 5);
            doc.text(tx.paymentMode, 145, y + 5);
            doc.text(tx.notes || "-", 175, y + 5);
            
            y += 8;
        });
    }

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text("This loan statement is computer-generated. System validated transaction register copy.", 15, 285);

    doc.save(`Statement_Loan_${loan.id}.pdf`);
}

window.exportReportsPDF = exportReportsPDF;
window.exportSingleLoanPDF = exportSingleLoanPDF;
