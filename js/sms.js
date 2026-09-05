/* ==========================================================================
   FinFlow SMS & Multi-Channel Dispatch Engine - js/sms.js
   Simplify Finance. Streamline Business
   ========================================================================== */

// Event listener to close the phone mockup UI
document.addEventListener("DOMContentLoaded", () => {
    const closePhoneBtn = document.getElementById("btn-close-virtual-phone");
    const phoneContainer = document.getElementById("virtual-phone-container");

    if (closePhoneBtn && phoneContainer) {
        closePhoneBtn.addEventListener("click", () => {
            phoneContainer.classList.remove("active");
        });
    }

    // Close on escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && phoneContainer && phoneContainer.classList.contains("active")) {
            phoneContainer.classList.remove("active");
        }
    });
});

// Sound synthesizer chirp using Web Audio API
function playSmsNotificationChirp() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        const audioCtx = new AudioContext();
        
        // Osc 1 (Main tone)
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = "sine";
        // Dual-note upward swipe: D5 (587.33Hz) then A5 (880Hz)
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
        console.warn("Audio feedback blocked until user interacts with document.", e);
    }
}

// Clean mobile number string to 10-digit format
function cleanPhoneNumber(mobile) {
    if (!mobile) return "";
    let clean = mobile.toString().replace(/\D/g, "");
    if (clean.length > 10 && clean.startsWith("91")) {
        clean = clean.substring(2);
    }
    return clean;
}

// Compiles the template SMS message with actual transaction data
function compileSmsMessage(template, customer, tx, remainingBalance) {
    let msg = template || g_settings.smsTemplate || "Dear {CUSTOMER}, payment of {AMOUNT} received for Loan ID {LOAN}. Balance: {BALANCE}. Date: {DATE}. Thank you, {COMPANY}.";
    const currency = (g_settings && g_settings.currency) ? g_settings.currency : "₹";

    // Values dictionary
    const dict = {
        "{CUSTOMER}": (customer && customer.name) ? customer.name : "Valued Customer",
        "{AMOUNT}": currency + (tx && tx.amountCollected ? Number(tx.amountCollected).toLocaleString() : "0"),
        "{LOAN}": (tx && tx.loanId) ? tx.loanId : "N/A",
        "{PENALTY}": currency + (tx && tx.penaltyPaid ? Number(tx.penaltyPaid).toLocaleString() : "0"),
        "{MODE}": (tx && tx.paymentMode) ? tx.paymentMode : "Cash",
        "{BALANCE}": currency + (typeof remainingBalance === "number" ? Number(remainingBalance).toLocaleString() : "0"),
        "{DATE}": (tx && tx.transactionDate) ? (typeof formatDateToDMY === "function" ? formatDateToDMY(tx.transactionDate) : tx.transactionDate) : new Date().toLocaleDateString(),
        "{COMPANY}": (g_settings && g_settings.companyName) ? g_settings.companyName : "FinFlow",
        "{COMPANY_MOBILE}": (g_settings && g_settings.companyMobile) ? g_settings.companyMobile : ""
    };

    // Replace all placeholders
    Object.keys(dict).forEach(key => {
        msg = msg.replaceAll(key, dict[key]);
    });

    return msg;
}

// Compiles due / overdue reminder SMS message
function compileDueReminderMessage(customer, loan, pendingAmount, dueDate, isOverdue) {
    let template = (g_settings && g_settings.smsDueTemplate) ? g_settings.smsDueTemplate : "Dear {CUSTOMER}, reminder for Loan ID {LOAN}. Your installment of {AMOUNT} is {STATUS} on {DATE}. Outstanding Balance: {BALANCE}. Please clear dues promptly. Thank you, {COMPANY}.";
    const currency = (g_settings && g_settings.currency) ? g_settings.currency : "₹";
    const outBal = typeof getLoanOutstandingBalance === "function" ? getLoanOutstandingBalance(loan.id) : (loan.principal || 0);

    const dict = {
        "{CUSTOMER}": customer.name || "Customer",
        "{LOAN}": loan.id,
        "{AMOUNT}": currency + Number(pendingAmount || loan.installmentAmount).toLocaleString(),
        "{STATUS}": isOverdue ? "OVERDUE" : "DUE",
        "{BALANCE}": currency + Number(outBal).toLocaleString(),
        "{DATE}": typeof formatDateToDMY === "function" ? formatDateToDMY(dueDate) : dueDate,
        "{COMPANY}": g_settings.companyName || "FinFlow",
        "{COMPANY_MOBILE}": g_settings.companyMobile || ""
    };

    Object.keys(dict).forEach(key => {
        template = template.replaceAll(key, dict[key]);
    });

    return template;
}

// Open Native SMS App on Device (Mobile, Tablet, PC Phone Link) via standard sms: URI
function openNativeSmsApp(mobileNumber, message) {
    const cleanMobile = cleanPhoneNumber(mobileNumber);
    if (!cleanMobile) {
        alert("Invalid or missing client mobile number.");
        return;
    }

    // Cross-platform SMS URL scheme:
    // Android/Universal: sms:+919876543210?body=...
    // iOS / Mac: sms:+919876543210&body=...
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const separator = isIOS ? "&" : "?";
    const smsUrl = `sms:+91${cleanMobile}${separator}body=${encodeURIComponent(message)}`;

    // Create a temporary link element to trigger the default SMS protocol cleanly
    const tempLink = document.createElement("a");
    tempLink.href = smsUrl;
    tempLink.target = "_blank";
    tempLink.rel = "noopener noreferrer";
    document.body.appendChild(tempLink);
    tempLink.click();
    setTimeout(() => {
        document.body.removeChild(tempLink);
    }, 300);

    console.log(`[Native SMS Triggered for +91-${cleanMobile}]:`, message);
}

// Trigger WhatsApp message redirect via web/app API
function triggerWhatsAppReceipt(customer, tx, remainingBalance) {
    const template = g_settings.smsTemplate || "";
    const compiledMsg = compileSmsMessage(template, customer, tx, remainingBalance);
    openWhatsAppDirect(customer.mobile, compiledMsg);
}

// Open WhatsApp with direct mobile number and text
function openWhatsAppDirect(mobileNumber, message) {
    const cleanMobile = cleanPhoneNumber(mobileNumber);
    if (!cleanMobile) {
        alert("Invalid mobile number for WhatsApp.");
        return;
    }
    const waUrl = `https://wa.me/91${cleanMobile}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
}

// Copy SMS Text to Clipboard with visual feedback
function copySmsTextToClipboard(text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
        if (btnElement) {
            const originalHtml = btnElement.innerHTML;
            btnElement.innerHTML = `<i class="fa-solid fa-check text-emerald"></i> Copied!`;
            setTimeout(() => {
                btnElement.innerHTML = originalHtml;
            }, 2000);
        } else {
            alert("✔ SMS text copied to clipboard!");
        }
    }).catch(err => {
        console.error("Clipboard copy failed:", err);
        // Fallback for older browsers
        const tempTextArea = document.createElement("textarea");
        tempTextArea.value = text;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand("copy");
        document.body.removeChild(tempTextArea);
        alert("✔ SMS text copied to clipboard!");
    });
}

// Send SMS via Internet SMS Gateway (Fast2SMS / Twilio / Custom)
async function sendSmsViaGateway(mobileNumber, message) {
    const cleanMobile = cleanPhoneNumber(mobileNumber);
    const provider = (g_settings && g_settings.smsProvider) ? g_settings.smsProvider : "device";
    const apiKey = (g_settings && g_settings.smsGatewayApiKey) ? g_settings.smsGatewayApiKey.trim() : "";
    const senderId = (g_settings && g_settings.smsGatewaySenderId) ? g_settings.smsGatewaySenderId.trim() : "FSTSMS";
    const customUrl = (g_settings && g_settings.smsGatewayCustomUrl) ? g_settings.smsGatewayCustomUrl.trim() : "";

    // 1. Try local server proxy endpoint first (avoids CORS issues)
    try {
        const response = await fetch("/api/send-sms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                mobile: cleanMobile,
                message: message,
                provider: provider,
                apiKey: apiKey,
                senderId: senderId,
                customUrl: customUrl
            })
        });

        if (response.ok) {
            const data = await response.json();
            return data;
        }
    } catch (e) {
        console.warn("Local server proxy /api/send-sms not reachable, testing client fetch...", e);
    }

    // 2. Direct client-side fetch if Fast2SMS and API Key provided
    if (provider === "fast2sms" && apiKey) {
        try {
            const fastUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&route=q&message=${encodeURIComponent(message)}&language=english&flash=0&numbers=${cleanMobile}`;
            const res = await fetch(fastUrl, { method: "GET" });
            const data = await res.json();
            return { success: true, provider: "Fast2SMS", message: "Dispatched via Fast2SMS", data: data };
        } catch (err) {
            console.error("Fast2SMS direct fetch failed (likely CORS):", err);
            return { success: false, message: "Gateway connection failed. Please ensure the local server is running or use Device SMS app." };
        }
    }

    return { success: false, message: "No internet SMS gateway configured. Use Device SMS App or WhatsApp." };
}

// Open Interactive SMS Dispatch Hub / Virtual Phone Modal
function openSmsDispatchHub(params) {
    const {
        customerName = "Client",
        mobile = "",
        message = "",
        title = "SMS Receipt Dispatch Hub",
        autoTriggerSms = false,
        autoTriggerWa = false,
        onSuccess = null
    } = params;

    const cleanMobile = cleanPhoneNumber(mobile);
    const phoneContainer = document.getElementById("virtual-phone-container");
    const smsConversations = document.getElementById("sms-conversations-body");

    if (!phoneContainer || !smsConversations) {
        console.error("Virtual phone mockup DOM container not found.");
        return;
    }

    // Update Header details
    const contactName = document.querySelector(".contact-details .contact-info h4");
    const contactPhone = document.querySelector(".contact-details .contact-info p");
    const contactAvatar = document.querySelector(".contact-details .contact-avatar");

    if (contactName) contactName.textContent = g_settings.companyName || "FinFlow";
    if (contactPhone) contactPhone.textContent = `From: +91 ${g_settings.companyMobile || '9988776655'}`;
    if (contactAvatar) contactAvatar.innerHTML = `<img src="icons/finflow_icon.png" style="width:24px;height:24px;object-fit:contain;">`;

    // Recipient banner
    const recipientBanner = document.createElement("div");
    recipientBanner.className = "recipient-indicator";
    recipientBanner.style.fontSize = "12px";
    recipientBanner.style.textAlign = "center";
    recipientBanner.style.padding = "8px 10px";
    recipientBanner.style.marginBottom = "12px";
    recipientBanner.style.background = "rgba(6, 182, 212, 0.08)";
    recipientBanner.style.border = "1px dashed rgba(6, 182, 212, 0.3)";
    recipientBanner.style.borderRadius = "8px";
    recipientBanner.style.color = "var(--clr-cyan)";
    recipientBanner.innerHTML = `<i class="fa-solid fa-paper-plane"></i> To: <strong>${customerName}</strong> (+91 ${cleanMobile})`;

    // Message bubble
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const bubble = document.createElement("div");
    bubble.className = "sms-bubble sms-incoming";
    bubble.style.maxWidth = "96%";
    bubble.innerHTML = `
        <p style="white-space: pre-wrap; font-family: monospace; font-size: 11.5px; line-height: 1.5; color: #f3f4f6;">${message}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 4px;">
            <span class="sms-char-count text-muted" style="font-size: 9px;">${message.length} characters</span>
            <span class="sms-timestamp">${timeStr}</span>
        </div>
    `;

    // Quick Actions Action Bar
    const actionsBar = document.createElement("div");
    actionsBar.className = "sms-hub-actions-bar";
    actionsBar.style.display = "flex";
    actionsBar.style.flexDirection = "column";
    actionsBar.style.gap = "8px";
    actionsBar.style.marginTop = "14px";

    actionsBar.innerHTML = `
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-sm flex-1" id="hub-btn-send-sms" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                <i class="fa-solid fa-comment-sms"></i> Send via SMS App
            </button>
            <button type="button" class="btn btn-secondary btn-sm flex-1" id="hub-btn-send-wa" style="background: rgba(37, 211, 102, 0.15); border-color: #25d366; color: #25d366;">
                <i class="fa-brands fa-whatsapp"></i> WhatsApp
            </button>
        </div>
        <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-xs flex-1" id="hub-btn-copy-sms">
                <i class="fa-solid fa-copy"></i> Copy SMS
            </button>
            <button type="button" class="btn btn-secondary btn-xs flex-1" id="hub-btn-gateway-sms">
                <i class="fa-solid fa-tower-broadcast"></i> SMS Gateway
            </button>
            <a href="tel:+91${cleanMobile}" class="btn btn-secondary btn-xs" style="display: flex; align-items: center; justify-content: center; width: 36px;" title="Call Client">
                <i class="fa-solid fa-phone text-cyan"></i>
            </a>
        </div>
        <div id="hub-status-feedback" style="font-size: 11px; text-align: center; color: var(--clr-cyan); margin-top: 4px;"></div>
    `;

    // Build DOM
    smsConversations.innerHTML = "";
    smsConversations.appendChild(recipientBanner);
    smsConversations.appendChild(bubble);
    smsConversations.appendChild(actionsBar);

    // Bind Hub Action Buttons
    const btnSendSms = actionsBar.querySelector("#hub-btn-send-sms");
    const btnSendWa = actionsBar.querySelector("#hub-btn-send-wa");
    const btnCopy = actionsBar.querySelector("#hub-btn-copy-sms");
    const btnGateway = actionsBar.querySelector("#hub-btn-gateway-sms");
    const statusFeedback = actionsBar.querySelector("#hub-status-feedback");

    btnSendSms.addEventListener("click", () => {
        openNativeSmsApp(cleanMobile, message);
        statusFeedback.textContent = "✔ Opened native SMS messaging app.";
        statusFeedback.style.color = "var(--clr-emerald)";
    });

    btnSendWa.addEventListener("click", () => {
        openWhatsAppDirect(cleanMobile, message);
        statusFeedback.textContent = "✔ Opening WhatsApp Web / App...";
        statusFeedback.style.color = "var(--clr-emerald)";
    });

    btnCopy.addEventListener("click", () => {
        copySmsTextToClipboard(message, btnCopy);
        statusFeedback.textContent = "✔ Message text copied to clipboard.";
        statusFeedback.style.color = "var(--clr-emerald)";
    });

    btnGateway.addEventListener("click", async () => {
        btnGateway.disabled = true;
        btnGateway.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;
        statusFeedback.textContent = "Contacting SMS gateway...";
        statusFeedback.style.color = "var(--clr-cyan)";

        const res = await sendSmsViaGateway(cleanMobile, message);
        btnGateway.disabled = false;
        btnGateway.innerHTML = `<i class="fa-solid fa-tower-broadcast"></i> SMS Gateway`;

        if (res.success) {
            statusFeedback.textContent = `✔ ${res.message || "SMS delivered via gateway!"}`;
            statusFeedback.style.color = "var(--clr-emerald)";
        } else {
            statusFeedback.textContent = `⚠ ${res.message || "Gateway failed, using Device SMS."}`;
            statusFeedback.style.color = "var(--clr-amber)";
            // Fallback to native SMS app
            openNativeSmsApp(cleanMobile, message);
        }
    });

    // Slide up Phone screen mockup
    phoneContainer.classList.add("active");

    // Play chirp sound
    playSmsNotificationChirp();

    // Auto-trigger if requested
    if (autoTriggerSms) {
        openNativeSmsApp(cleanMobile, message);
        statusFeedback.textContent = "✔ SMS App opened with client number & receipt.";
    }
    if (autoTriggerWa) {
        openWhatsAppDirect(cleanMobile, message);
    }
}

// Master Dispatch Function for Collection Receipt
function dispatchSMSReceipt(customer, tx, remainingBalance, channel = "sms") {
    if (!customer) {
        console.error("dispatchSMSReceipt: Customer profile not provided.");
        return;
    }

    const template = g_settings.smsTemplate || "";
    const compiledMsg = compileSmsMessage(template, customer, tx, remainingBalance);
    const cleanMobile = cleanPhoneNumber(customer.mobile);

    console.log(`[Dispatching Receipt for ${customer.name} (+91 ${cleanMobile}) via ${channel}]:`, compiledMsg);

    const shouldTriggerSms = (channel === "sms" || channel === "both");
    const shouldTriggerWa = (channel === "whatsapp" || channel === "both");

    // If Fast2SMS gateway configured and user picked SMS, attempt automatic API dispatch
    if (shouldTriggerSms && g_settings.smsProvider === "fast2sms" && g_settings.smsGatewayApiKey) {
        sendSmsViaGateway(cleanMobile, compiledMsg).then(res => {
            console.log("Gateway auto-dispatch result:", res);
        });
    }

    // Open Interactive Dispatch Hub with automatic launch of SMS app / WhatsApp
    openSmsDispatchHub({
        customerName: customer.name,
        mobile: cleanMobile,
        message: compiledMsg,
        title: "Collection Receipt Dispatch",
        autoTriggerSms: shouldTriggerSms,
        autoTriggerWa: shouldTriggerWa
    });
}

// Master Dispatch Function for Due / Overdue Reminders
function dispatchDueReminderSMS(customer, loan, pendingAmount, dueDate, isOverdue = false) {
    if (!customer || !loan) return;

    const compiledMsg = compileDueReminderMessage(customer, loan, pendingAmount, dueDate, isOverdue);
    const cleanMobile = cleanPhoneNumber(customer.mobile);

    console.log(`[Dispatching Due Reminder for ${customer.name} (+91 ${cleanMobile})]:`, compiledMsg);

    openSmsDispatchHub({
        customerName: customer.name,
        mobile: cleanMobile,
        message: compiledMsg,
        title: isOverdue ? "Overdue Payment Notice" : "Payment Due Reminder",
        autoTriggerSms: true
    });
}

// Test SMS Gateway with arbitrary number
async function testSmsGateway(testMobile, testMessage) {
    const cleanMobile = cleanPhoneNumber(testMobile);
    if (!cleanMobile || cleanMobile.length < 10) {
        return { success: false, message: "Please enter a valid 10-digit mobile number." };
    }

    const msg = testMessage || `[Test SMS] FinFlow SMS Gateway verification for +91-${cleanMobile}. System active!`;
    const res = await sendSmsViaGateway(cleanMobile, msg);
    return res;
}

// Backward compatibility aliases
function triggerSimulatedSMSReceipt(customer, tx, remainingBalance) {
    dispatchSMSReceipt(customer, tx, remainingBalance, "sms");
}

// Bind to window scope for accessibility from all modules
window.compileSmsMessage = compileSmsMessage;
window.compileDueReminderMessage = compileDueReminderMessage;
window.cleanPhoneNumber = cleanPhoneNumber;
window.openNativeSmsApp = openNativeSmsApp;
window.triggerWhatsAppReceipt = triggerWhatsAppReceipt;
window.openWhatsAppDirect = openWhatsAppDirect;
window.copySmsTextToClipboard = copySmsTextToClipboard;
window.sendSmsViaGateway = sendSmsViaGateway;
window.openSmsDispatchHub = openSmsDispatchHub;
window.dispatchSMSReceipt = dispatchSMSReceipt;
window.dispatchDueReminderSMS = dispatchDueReminderSMS;
window.testSmsGateway = testSmsGateway;
window.triggerSimulatedSMSReceipt = triggerSimulatedSMSReceipt;
