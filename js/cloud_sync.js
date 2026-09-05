/* ==========================================================================
   FinFlow Cloud Synchronization Engine - js/cloud_sync.js
   Real-Time Multi-Device Database Synchronization via Firebase Firestore
   ========================================================================== */

(function(window) {
    'use strict';

    const STORAGE_KEY_CONFIG = 'finflow_firebase_config';
    const STORAGE_KEY_ENABLED = 'finflow_cloud_sync_enabled';

    // State
    let isInitialized = false;
    let isSyncing = false;
    let isOnline = navigator.onLine;
    let db = null;
    let auth = null;
    let activeUnsubscribes = [];
    let isRemoteUpdateInProgress = false;

    // Default configuration (users can easily supply or override via Settings)
    const DEFAULT_FIREBASE_CONFIG = {
        apiKey: "",
        authDomain: "",
        projectId: "",
        storageBucket: "",
        messagingSenderId: "",
        appId: ""
    };

    const CloudSync = {
        status: 'disconnected', // 'connected', 'syncing', 'offline', 'disabled', 'error'
        lastSyncedAt: null,
        error: null,

        // Initialize Cloud Synchronization
        async init() {
            console.log("Initializing FinFlow Cloud Sync Engine...");
            this.updateOnlineStatus();

            window.addEventListener('online', () => {
                this.updateOnlineStatus();
                this.reconnect();
            });
            window.addEventListener('offline', () => {
                this.updateOnlineStatus();
            });

            const config = this.getConfig();
            const enabled = this.isEnabled();

            if (!enabled || !config || !config.projectId || !config.apiKey) {
                console.log("Cloud sync not fully configured or disabled. Operating in local-only mode.");
                this.status = 'unconfigured';
                this.renderStatusBadge();
                return false;
            }

            try {
                this.status = 'syncing';
                this.renderStatusBadge();

                if (!window.firebase) {
                    console.warn("Firebase SDK not loaded from CDN. Retrying in 2 seconds...");
                    setTimeout(() => this.init(), 2000);
                    return false;
                }

                // Initialize or reuse Firebase App
                let app;
                if (!window.firebase.apps.length) {
                    app = window.firebase.initializeApp(config);
                } else {
                    app = window.firebase.app();
                }

                db = window.firebase.firestore();
                auth = window.firebase.auth();

                // Enable Firestore offline persistence if supported
                try {
                    await db.enablePersistence({ synchronizeTabs: true });
                } catch (err) {
                    if (err.code === 'failed-precondition') {
                        // Multiple tabs open, persistence can only be enabled in one tab at a time.
                        console.warn('Firestore persistence enabled in another tab.');
                    } else if (err.code === 'unimplemented') {
                        console.warn('The current browser does not support all features required to enable offline persistence.');
                    }
                }

                // Anonymous auth for security rules if needed
                try {
                    if (!auth.currentUser) {
                        await auth.signInAnonymously();
                    }
                } catch (authErr) {
                    console.warn("Anonymous auth skipped or failed:", authErr.message);
                }

                isInitialized = true;
                this.status = 'connected';
                this.lastSyncedAt = new Date();
                this.renderStatusBadge();

                // Start real-time listeners across collections
                this.startRealtimeListeners();
                console.log("FinFlow Cloud Sync Engine successfully connected & listening for real-time changes!");
                return true;

            } catch (err) {
                console.error("Failed to initialize Cloud Sync Engine:", err);
                this.status = 'error';
                this.error = err.message;
                this.renderStatusBadge();
                return false;
            }
        },

        // Get saved configuration
        getConfig() {
            const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
            if (saved) {
                try { return JSON.parse(saved); } catch (e) { return DEFAULT_FIREBASE_CONFIG; }
            }
            return DEFAULT_FIREBASE_CONFIG;
        },

        // Save configuration
        saveConfig(config) {
            localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
            localStorage.setItem(STORAGE_KEY_ENABLED, 'true');
            return this.reconnect();
        },

        // Is sync enabled
        isEnabled() {
            const val = localStorage.getItem(STORAGE_KEY_ENABLED);
            return val !== 'false'; // Enabled by default if config present
        },

        setEnabled(enabled) {
            localStorage.setItem(STORAGE_KEY_ENABLED, enabled ? 'true' : 'false');
            if (enabled) {
                this.reconnect();
            } else {
                this.disconnect();
            }
        },

        // Test credentials with arbitrary config
        async testConnection(config) {
            if (!window.firebase) {
                throw new Error("Firebase SDK is not available. Please check internet connection.");
            }
            if (!config || !config.apiKey || !config.projectId) {
                throw new Error("Please provide both API Key and Project ID.");
            }

            let testApp = null;
            const testAppName = 'finflow_test_' + Date.now();

            try {
                testApp = window.firebase.initializeApp(config, testAppName);
                const testDb = testApp.firestore();
                // Test a basic read/write
                const testDoc = testDb.collection('_finflow_health_check').doc('test');
                await testDoc.set({ ping: Date.now(), client: 'FinFlow Health Check' }, { merge: true });
                await testDoc.get();

                // Clean up test app
                await testApp.delete();
                return { success: true, message: "Cloud connection successful! Firestore database is fully accessible." };
            } catch (err) {
                if (testApp) {
                    try { await testApp.delete(); } catch(e) {}
                }
                throw new Error("Connection failed: " + (err.message || err));
            }
        },

        // Start Realtime Listeners on Firestore Collections
        startRealtimeListeners() {
            if (!db) return;

            // Stop existing listeners if any
            this.stopRealtimeListeners();

            console.log("Starting real-time Firestore listeners for [customers, loans, collections, settings, users]...");

            // 1. Customers Listener
            const unsubCustomers = db.collection('customers').onSnapshot((snapshot) => {
                if (snapshot.metadata.hasPendingWrites && !snapshot.metadata.fromCache) {
                    return; // Ignore local write echoes to prevent race conditions
                }
                const remoteCustomers = [];
                snapshot.forEach(doc => {
                    remoteCustomers.push(doc.data());
                });

                if (remoteCustomers.length > 0 || (snapshot.empty && g_customers.length > 0)) {
                    this.mergeRemoteData('customers', remoteCustomers);
                }
            }, (err) => {
                console.error("Customers listener error:", err);
            });
            activeUnsubscribes.push(unsubCustomers);

            // 2. Loans Listener
            const unsubLoans = db.collection('loans').onSnapshot((snapshot) => {
                if (snapshot.metadata.hasPendingWrites && !snapshot.metadata.fromCache) {
                    return;
                }
                const remoteLoans = [];
                snapshot.forEach(doc => {
                    remoteLoans.push(doc.data());
                });

                if (remoteLoans.length > 0 || (snapshot.empty && g_loans.length > 0)) {
                    this.mergeRemoteData('loans', remoteLoans);
                }
            }, (err) => {
                console.error("Loans listener error:", err);
            });
            activeUnsubscribes.push(unsubLoans);

            // 3. Collections Transactions Listener
            const unsubCollections = db.collection('collections').onSnapshot((snapshot) => {
                if (snapshot.metadata.hasPendingWrites && !snapshot.metadata.fromCache) {
                    return;
                }
                const remoteTx = [];
                snapshot.forEach(doc => {
                    remoteTx.push(doc.data());
                });

                if (remoteTx.length > 0 || (snapshot.empty && g_collections.length > 0)) {
                    this.mergeRemoteData('collections', remoteTx);
                }
            }, (err) => {
                console.error("Collections listener error:", err);
            });
            activeUnsubscribes.push(unsubCollections);

            // 4. Settings Listener
            const unsubSettings = db.collection('settings').doc('general').onSnapshot((doc) => {
                if (doc.exists) {
                    const remoteSettings = doc.data();
                    this.mergeRemoteData('settings', remoteSettings);
                }
            }, (err) => {
                console.error("Settings listener error:", err);
            });
            activeUnsubscribes.push(unsubSettings);

            // 5. Users Listener
            const unsubUsers = db.collection('users').onSnapshot((snapshot) => {
                if (snapshot.metadata.hasPendingWrites && !snapshot.metadata.fromCache) {
                    return;
                }
                const remoteUsers = [];
                snapshot.forEach(doc => {
                    remoteUsers.push(doc.data());
                });
                if (remoteUsers.length > 0) {
                    this.mergeRemoteData('users', remoteUsers);
                }
            }, (err) => {
                console.error("Users listener error:", err);
            });
            activeUnsubscribes.push(unsubUsers);
        },

        // Stop all real-time listeners
        stopRealtimeListeners() {
            activeUnsubscribes.forEach(unsub => {
                try { unsub(); } catch(e) {}
            });
            activeUnsubscribes = [];
        },

        // Merge incoming remote cloud records into active state and trigger UI refresh
        mergeRemoteData(type, remoteData) {
            isRemoteUpdateInProgress = true;
            let changed = false;

            try {
                if (type === 'customers') {
                    if (JSON.stringify(g_customers) !== JSON.stringify(remoteData)) {
                        g_customers = remoteData;
                        localStorage.setItem('kf_customers', JSON.stringify(g_customers));
                        changed = true;
                    }
                } else if (type === 'loans') {
                    if (JSON.stringify(g_loans) !== JSON.stringify(remoteData)) {
                        g_loans = remoteData;
                        localStorage.setItem('kf_loans', JSON.stringify(g_loans));
                        changed = true;
                    }
                } else if (type === 'collections') {
                    if (JSON.stringify(g_collections) !== JSON.stringify(remoteData)) {
                        g_collections = remoteData;
                        localStorage.setItem('kf_collections', JSON.stringify(g_collections));
                        changed = true;
                    }
                } else if (type === 'settings') {
                    if (JSON.stringify(g_settings) !== JSON.stringify(remoteData)) {
                        g_settings = { ...DEFAULT_SETTINGS, ...remoteData };
                        localStorage.setItem('kf_settings', JSON.stringify(g_settings));
                        changed = true;
                    }
                } else if (type === 'users') {
                    if (JSON.stringify(g_users) !== JSON.stringify(remoteData)) {
                        g_users = remoteData;
                        localStorage.setItem('kf_users', JSON.stringify(g_users));
                        changed = true;
                    }
                }

                if (changed) {
                    this.lastSyncedAt = new Date();
                    this.renderStatusBadge();
                    
                    // Dispatch Custom Event for UI modules to update smoothly
                    window.dispatchEvent(new CustomEvent('finflow:cloud-update', {
                        detail: { type, timestamp: new Date() }
                    }));
                    console.log(`Live synced update applied from cloud for [${type}]`);
                }
            } finally {
                isRemoteUpdateInProgress = false;
            }
        },

        // Write Operations - Push directly to Firestore (and automatically cached offline)
        async saveCustomer(customer) {
            if (!db || isRemoteUpdateInProgress) return;
            try {
                await db.collection('customers').doc(String(customer.id)).set(customer, { merge: true });
                this.lastSyncedAt = new Date();
                this.renderStatusBadge();
            } catch (err) {
                console.warn("Failed to write customer to cloud:", err);
            }
        },

        async deleteCustomer(customerId) {
            if (!db || isRemoteUpdateInProgress) return;
            try {
                await db.collection('customers').doc(String(customerId)).delete();
                this.lastSyncedAt = new Date();
                this.renderStatusBadge();
            } catch (err) {
                console.warn("Failed to delete customer from cloud:", err);
            }
        },

        async saveLoan(loan) {
            if (!db || isRemoteUpdateInProgress) return;
            try {
                await db.collection('loans').doc(String(loan.id)).set(loan, { merge: true });
                this.lastSyncedAt = new Date();
                this.renderStatusBadge();
            } catch (err) {
                console.warn("Failed to write loan to cloud:", err);
            }
        },

        async deleteLoan(loanId) {
            if (!db || isRemoteUpdateInProgress) return;
            try {
                await db.collection('loans').doc(String(loanId)).delete();
                this.lastSyncedAt = new Date();
                this.renderStatusBadge();
            } catch (err) {
                console.warn("Failed to delete loan from cloud:", err);
            }
        },

        async saveCollection(tx) {
            if (!db || isRemoteUpdateInProgress) return;
            try {
                const docId = String(tx.txId || tx.id || ('TXN_' + Date.now()));
                await db.collection('collections').doc(docId).set(tx, { merge: true });
                this.lastSyncedAt = new Date();
                this.renderStatusBadge();
            } catch (err) {
                console.warn("Failed to write collection to cloud:", err);
            }
        },

        async deleteCollection(txId) {
            if (!db || isRemoteUpdateInProgress) return;
            try {
                await db.collection('collections').doc(String(txId)).delete();
                this.lastSyncedAt = new Date();
                this.renderStatusBadge();
            } catch (err) {
                console.warn("Failed to delete collection from cloud:", err);
            }
        },

        async saveSettings(settings) {
            if (!db || isRemoteUpdateInProgress) return;
            try {
                await db.collection('settings').doc('general').set(settings, { merge: true });
                this.lastSyncedAt = new Date();
                this.renderStatusBadge();
            } catch (err) {
                console.warn("Failed to write settings to cloud:", err);
            }
        },

        async saveUser(user) {
            if (!db || isRemoteUpdateInProgress) return;
            try {
                await db.collection('users').doc(String(user.username)).set(user, { merge: true });
                this.lastSyncedAt = new Date();
                this.renderStatusBadge();
            } catch (err) {
                console.warn("Failed to write user to cloud:", err);
            }
        },

        // 1-Click Upload: Push all local storage data to the Cloud database
        async syncAllLocalToCloud() {
            if (!db) {
                throw new Error("Cloud database is not connected. Please verify and save your Firebase configuration first.");
            }

            this.status = 'syncing';
            this.renderStatusBadge();

            try {
                const batch = db.batch();
                let opCount = 0;

                // 1. Settings
                const settingsRef = db.collection('settings').doc('general');
                batch.set(settingsRef, g_settings || {}, { merge: true });
                opCount++;

                // 2. Customers
                if (Array.isArray(g_customers)) {
                    g_customers.forEach(c => {
                        const ref = db.collection('customers').doc(String(c.id));
                        batch.set(ref, c, { merge: true });
                        opCount++;
                    });
                }

                // 3. Loans
                if (Array.isArray(g_loans)) {
                    g_loans.forEach(l => {
                        const ref = db.collection('loans').doc(String(l.id));
                        batch.set(ref, l, { merge: true });
                        opCount++;
                    });
                }

                // 4. Collections
                if (Array.isArray(g_collections)) {
                    g_collections.forEach(tx => {
                        const txId = String(tx.txId || tx.id || ('TXN_' + Date.now()));
                        const ref = db.collection('collections').doc(txId);
                        batch.set(ref, tx, { merge: true });
                        opCount++;
                    });
                }

                // 5. Users
                if (Array.isArray(g_users)) {
                    g_users.forEach(u => {
                        const ref = db.collection('users').doc(String(u.username));
                        batch.set(ref, u, { merge: true });
                        opCount++;
                    });
                }

                await batch.commit();
                this.status = 'connected';
                this.lastSyncedAt = new Date();
                this.renderStatusBadge();
                return { success: true, count: opCount };
            } catch (err) {
                this.status = 'error';
                this.renderStatusBadge();
                throw new Error("Failed to upload local database to cloud: " + (err.message || err));
            }
        },

        // Reconnect helper
        async reconnect() {
            this.disconnect();
            return await this.init();
        },

        disconnect() {
            this.stopRealtimeListeners();
            if (db) db = null;
            if (auth) auth = null;
            isInitialized = false;
            this.status = 'disconnected';
            this.renderStatusBadge();
        },

        updateOnlineStatus() {
            isOnline = navigator.onLine;
            if (!isOnline && this.status === 'connected') {
                this.status = 'offline';
                this.renderStatusBadge();
            }
        },

        // Render visual status badge in top navigation bar
        renderStatusBadge() {
            const badgeEl = document.getElementById('cloud-sync-status-badge');
            if (!badgeEl) return;

            let badgeHtml = '';
            if (this.status === 'connected') {
                const timeStr = this.lastSyncedAt ? this.lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Now';
                badgeHtml = `
                    <span class="cloud-badge cloud-badge-live" title="Real-time multi-device cloud sync is ACTIVE. Last sync: ${timeStr}">
                        <span class="pulse-dot online"></span>
                        <i class="fa-solid fa-cloud-check"></i>
                        <span>Live Synced</span>
                    </span>
                `;
            } else if (this.status === 'syncing') {
                badgeHtml = `
                    <span class="cloud-badge cloud-badge-syncing" title="Syncing changes with cloud database...">
                        <span class="pulse-dot syncing"></span>
                        <i class="fa-solid fa-arrows-rotate fa-spin"></i>
                        <span>Syncing...</span>
                    </span>
                `;
            } else if (this.status === 'offline') {
                badgeHtml = `
                    <span class="cloud-badge cloud-badge-offline" title="Device is offline. Changes are saved locally and will auto-sync when connection restores.">
                        <span class="pulse-dot offline"></span>
                        <i class="fa-solid fa-cloud-slash"></i>
                        <span>Offline (Cached)</span>
                    </span>
                `;
            } else if (this.status === 'error') {
                badgeHtml = `
                    <span class="cloud-badge cloud-badge-error" title="Sync error: ${this.error || 'Check configuration'}">
                        <span class="pulse-dot error"></span>
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <span>Sync Error</span>
                    </span>
                `;
            } else {
                // unconfigured or disconnected
                badgeHtml = `
                    <span class="cloud-badge cloud-badge-local" title="Operating in local mode. Click Settings > Cloud Database to enable multi-device sync.">
                        <i class="fa-solid fa-hard-drive"></i>
                        <span>Local Mode</span>
                    </span>
                `;
            }

            badgeEl.innerHTML = badgeHtml;
        }
    };

    window.CloudSync = CloudSync;

})(window);
