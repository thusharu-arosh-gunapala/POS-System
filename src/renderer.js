// Application State
const appState = {
    currentUser: null,
    currentCart: [],
    selectedPaymentMethod: null
};

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    const user = await window.api.getCurrentUser();
    
    // attach listeners regardless; if login form is not visible they won't run
    setupLoginListeners();

    if (!user) {
        showScreen('loginScreen');
    } else {
        appState.currentUser = user;
        showScreen('appScreen');
        setupAppListeners();
        loadDashboard();
    }
});

// ========== SCREEN MANAGEMENT ==========
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    // if we switch back to the login screen make sure the form listener is
    // attached, even if the appState has a user (e.g. during development when
    // the main process is still holding a session or after a logout)
    if (screenId === 'loginScreen') {
        setupLoginListeners();
    }
}

function showContentScreen(screenId) {
    console.log('[UI] switching to screen', screenId);
    document.querySelectorAll('.content-screen').forEach(s => s.classList.remove('active'));
    const target = document.querySelector('#' + screenId);
    if (target) {
        target.classList.add('active');
    } else {
        console.warn('showContentScreen: no element for', screenId);
    }
}

// ========== LOGIN HANDLERS ==========
function setupLoginListeners() {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    if (!loginForm) return;

    // remove previous listener if any by cloning
    const newForm = loginForm.cloneNode(true);
    loginForm.parentNode.replaceChild(newForm, loginForm);
    const form = document.getElementById('loginForm');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // normalize credentials: trim whitespace and make username lowercase
        // (the database lookup is now case‑insensitive but it's good to send a
        // consistent value from the UI as well)
        const username = document.getElementById('username').value.trim().toLowerCase();
        const password = document.getElementById('password').value;
        loginError.classList.remove('show');

        console.log('[UI] attempting login with', username);
        try {
            const result = await window.api.login(username, password);
            console.log('[UI] login response', result);
            if (result.success) {
                appState.currentUser = result.user;
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';
                showScreen('appScreen');
                setupAppListeners();
                loadDashboard();
            } else {
                loginError.textContent = result.error;
                loginError.classList.add('show');
            }
        } catch (error) {
            console.error('[UI] login exception', error);
            loginError.textContent = 'Login failed: ' + (error.message || 'unknown error');
            loginError.classList.add('show');
        }
    });
}

// ========== APP SETUP ==========
function setupAppListeners() {
    // Update header with user info
    document.getElementById('userDisplay').textContent = appState.currentUser.username;
    document.getElementById('roleDisplay').textContent = 
        appState.currentUser.role === 1 ? 'Administrator' : 'Cashier';

    // Setup role-based menu visibility
    const isAdmin = appState.currentUser.role === 1;
    document.getElementById('adminMenu').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('cashierMenu').style.display = isAdmin ? 'none' : 'block';

    // Logout handler
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Navigation
    setupNavigation();

    // Role-specific setup
    if (isAdmin) {
        setupAdminListeners();
        // pre-load category list for administrator
        loadCategories();
    } else {
        setupCashierListeners();
    }
}

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const screenId = item.getAttribute('data-screen');
            
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            showContentScreen(screenId);
            
            // Load data based on screen
            if (screenId === 'dashboard') loadDashboard();
            if (screenId === 'suppliers') loadSuppliers();
            if (screenId === 'categories') loadCategories();
            if (screenId === 'products') loadProducts();
            if (screenId === 'inventory') loadInventory();
            if (screenId === 'sales') loadSales();
            if (screenId === 'reports') loadReports();
            if (screenId === 'audit-logs') loadAuditLogs();
            if (screenId === 'settings') loadSettings();
            if (screenId === 'users') loadUsers();
            if (screenId === 'billing') setupBillingScreen();
        });
    });
}

// ========== ADMIN LISTENERS ==========
function setupAdminListeners() {
    const addProductBtn = document.getElementById('btnAddProduct');
    const addSupplierBtn = document.getElementById('btnAddSupplier');
    const addUserBtn = document.getElementById('btnAddUser');

    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            showAddProductModal();
        });
    }
    if (addSupplierBtn) {
        addSupplierBtn.addEventListener('click', () => {
            showAddSupplierModal();
        });
    }
    const addCategoryScreenBtn = document.getElementById('btnAddCategoryScreen');
    if (addCategoryScreenBtn) {
        addCategoryScreenBtn.addEventListener('click', () => {
            showCategoryModal();
        });
    }

    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            showAddUserModal();
        });
    }
}

// ========== CASHIER LISTENERS ==========
function setupCashierListeners() {
    document.querySelector('[data-screen="billing"]').click();
}

// ========== DASHBOARD ==========
async function loadDashboard() {
    try {
        // update date/time
        const dtEl = document.getElementById('currentDateTime');
        if (dtEl) {
            const fmt = () => {
                const now = new Date();
                dtEl.textContent = now.toLocaleString();
            };
            fmt();
            setInterval(fmt, 1000);
        }

            // ask backend for dashboard metrics
        const resp = await window.api.getDashboardData();
        if (resp.success) {
            const data = resp.data;
            document.getElementById('totalSales').textContent = '$' + data.totalSales.toFixed(2);
            document.getElementById('totalCustomers').textContent = data.billCount;
            document.getElementById('netProfit').textContent = '$' + (data.netProfit || 0).toFixed(2);
            // calculate margin percentage
            const marginEl = document.querySelector('#kpiNetProfit .kpi-sub');
            if (marginEl) {
                const margin = data.totalSales > 0 ? ((data.netProfit / data.totalSales) * 100).toFixed(1) + '%' : '0%';
                marginEl.textContent = margin;
            }
            document.getElementById('lowStockAlert').textContent = data.lowStockCount;
        const alertEl = document.getElementById('criticalAlerts');
        if (alertEl) {
            if (data.alertCount && data.alertCount > 0) {
                alertEl.textContent = `${data.alertCount} alert(s)`;
            } else if (data.lowStockCount > 0) {
                alertEl.textContent = `${data.lowStockCount} low stock item(s)`;
            } else {
                alertEl.textContent = 'No critical alerts';
            }
        }

            // fill low stock table using returned items
            const tbl = document.getElementById('lowStockTable');
            if (tbl) {
                tbl.innerHTML = '<tr><th>Item</th><th>Stock</th><th>Reorder</th><th>Brand</th></tr>';
                data.lowStockItems.forEach(p => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${p.name}</td>
                        <td>${p.current_qty||0}</td>
                        <td>${p.reorder_level||0}</td>
                        <td>${p.brand||''}</td>
                    `;
                    tbl.appendChild(tr);
                });
            }

            // cash vs card summary - update KPI card text
            const cashCardEl = document.getElementById('kpiCashCard');
            if (cashCardEl && data.payments && data.payments.length) {
                const cash = data.payments.find(r=>r.method.toLowerCase()==='cash');
                const card = data.payments.find(r=>r.method.toLowerCase()==='card');
                cashCardEl.querySelector('.kpi-value').textContent =
                    `$${(cash?cash.total:0).toFixed(2)} / $${(card?card.total:0).toFixed(2)}`;
            }

            // draw charts using Chart.js if available
            try {
                const hourlyCtx = document.getElementById('hourlySalesChart');
                const dailyCtx = document.getElementById('dailyTrendChart');
                if (hourlyCtx && window.Chart) {
                    const hours = data.hourlySales.map(o=>o.hour);
                    const sums = data.hourlySales.map(o=>o.total);
                    new Chart(hourlyCtx, {
                        type: 'bar',
                        data: {
                            labels: hours,
                            datasets: [{ label: 'Sales', data: sums, backgroundColor: '#d4af37' }]
                        },
                        options: { responsive: true, maintainAspectRatio: false }
                    });
                }
                if (dailyCtx && window.Chart) {
                    const days = data.dailyTrend.map(o=>o.day);
                    const totals = data.dailyTrend.map(o=>o.total);
                    new Chart(dailyCtx, {
                        type: 'line',
                        data: {
                            labels: days,
                            datasets: [{ label: 'Revenue', data: totals, borderColor: '#2b8aef', fill: false }]
                        },
                        options: { responsive: true, maintainAspectRatio: false }
                    });
                }
            } catch (chartErr) {
                console.warn('chart rendering error', chartErr);
            }
        } else {
            console.error('Failed to fetch dashboard data', resp.error);
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}


// utility to close any modal
function closeModal(btn) {
    const modal = btn.closest('.modal');
    if (modal) modal.remove();
}

async function showLowStockModal() {
    try {
        const resp = await window.api.getDashboardData();
        if (!resp.success) return;
        const items = resp.data.lowStockItems || [];
        const modal = document.createElement('div');
        modal.className = 'modal';
        let rows = items.map(it =>
            `<tr><td>${it.name}</td><td>${it.current_qty}</td><td>${it.reorder_level}</td></tr>`
        ).join('');
        if (!rows) rows = '<tr><td colspan="3">None</td></tr>';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Low Stock Items</h2>
                <table class="mini-table" style="width:100%;margin-bottom:15px;">
                    <thead><tr><th>Name</th><th>Stock</th><th>Reorder</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
                <button class="btn-prev" onclick="closeModal(this)">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (err) {
        console.error('Error showing low stock modal', err);
    }
}

// ========== UTILS ==========
function ensureTableBody(id) {
    const tb = document.getElementById(id);
    if (!tb) {
        console.error('Table body not found:', id);
    }
    return tb;
}

// ========== SUPPLIERS ==========
async function loadSuppliers() {
    try {
        const res = await window.api.getAllSuppliers();
        const tbody = ensureTableBody('suppliersList');
        if (!tbody) return;
        if (res.success && res.data && res.data.length > 0) {
            tbody.innerHTML = '';
            res.data.forEach(s => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${s.name}</td>
                    <td>${s.contact_person||''}</td>
                    <td>${s.phone||''}</td>
                    <td>${s.email||''}</td>
                    <td>${s.address||''}</td>
                    <td>${s.is_active ? 'Active' : 'Inactive'}</td>
                    <td>
                        <button class="btn-edit" onclick="editSupplier(${s.id}); event.stopPropagation();">Edit</button>
                        <button class="btn-delete" onclick="deactivateSupplier(${s.id}); event.stopPropagation();">Disable</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-secondary); font-style:italic;">No suppliers found</td></tr>';
        }
    } catch (err) {
        console.error('loadSuppliers error', err);
        const tbody = ensureTableBody('suppliersList');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-secondary);">Error loading suppliers</td></tr>';
    }
}

async function showAddSupplierModal(existing) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>${existing ? 'Edit' : 'Add'} Supplier</h2>
            <label>Name<input type="text" id="supName"></label>
            <label>Contact Person<input type="text" id="supContact"></label>
            <label>Phone<input type="text" id="supPhone"></label>
            <label>Email<input type="text" id="supEmail"></label>
            <label>Address<textarea id="supAddress"></textarea></label>
            <div style="margin-top:15px; display:flex;gap:10px; justify-content:flex-end;">
                <button class="btn-success" onclick="submitSupplierForm(${existing ? existing.id : ''})">${existing ? 'Update' : 'Create'}</button>
                <button class="btn-danger" onclick="closeModal(this)">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    if (existing) {
        modal.querySelector('#supName').value = existing.name || '';
        modal.querySelector('#supContact').value = existing.contact_person || '';
        modal.querySelector('#supPhone').value = existing.phone || '';
        modal.querySelector('#supEmail').value = existing.email || '';
        modal.querySelector('#supAddress').value = existing.address || '';
    }
}

async function submitSupplierForm(editId) {
    const modal = document.querySelector('.modal-content');
    const data = {
        name: modal.querySelector('#supName').value.trim(),
        contact_person: modal.querySelector('#supContact').value.trim(),
        phone: modal.querySelector('#supPhone').value.trim(),
        email: modal.querySelector('#supEmail').value.trim(),
        address: modal.querySelector('#supAddress').value.trim(),
        is_active: true
    };
    if (!data.name) {
        alert('Name is required');
        return;
    }
    let res;
    if (editId) {
        res = await window.api.updateSupplier(editId, data);
    } else {
        res = await window.api.createSupplier(data);
    }
    if (res.success) {
        closeModal(modal.querySelector('button.btn-danger')); // any button to close
        loadSuppliers();
    } else {
        alert('Error: ' + res.error);
    }
}

async function editSupplier(id) {
    try {
        const sup = (await window.api.getAllSuppliers()).data.find(s=>s.id===id);
        if (sup) showAddSupplierModal(sup);
    } catch(e){console.error(e);}
}

async function deactivateSupplier(id) {
    if (confirm('Disable this supplier?')) {
        const res = await window.api.deactivateSupplier(id);
        if (res.success) loadSuppliers();
    }
}

// ========== CATEGORIES ==========

function showCategoryModal(existing) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>${existing ? 'Edit' : 'Add'} Category</h2>
            <label>Name<input type="text" id="catName"></label>
            <label>Image<input type="file" id="catImage" accept="image/*"></label>
            <div style="margin-top:15px; display:flex;gap:10px; justify-content:flex-end;">
                <button class="btn-success" onclick="submitCategoryForm(${existing ? existing.id : ''})">${existing ? 'Update' : 'Create'}</button>
                <button class="btn-danger" onclick="closeModal(this)">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    if (existing) {
        modal.querySelector('#catName').value = existing.name || '';
        // image not stored yet
    }
}

async function submitCategoryForm(editId) {
    const modal = document.querySelector('.modal-content');
    const name = modal.querySelector('#catName').value.trim();
    if (!name) { alert('Name required'); return; }
    // ignore image for now
    const res = await window.api.createCategory(name);
    if (res.success) {
        closeModal(modal.querySelector('button.btn-danger'));
        loadCategories();
    } else {
        alert('Error: '+res.error);
    }
}

// update loadCategories action buttons to open modal
async function loadCategories() {
    try {
        const res = await window.api.getCategories();
        const tbody = ensureTableBody('categoriesList');
        if (!tbody) return;
        if (res.success && res.data && res.data.length > 0) {
            tbody.innerHTML = '';
            res.data.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${c.name}</td><td><button class="btn-delete" onclick="showCategoryModal({id:${c.id},name:'${c.name}'})">Edit</button></td>`;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--text-secondary); font-style:italic;">No categories</td></tr>';
        }
    } catch (e) {
        console.error(e);
        const tbody = ensureTableBody('categoriesList');
        if (tbody) tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--text-secondary);">Error loading categories</td></tr>';
    }
}

// ========== PRODUCTS ==========
async function loadProducts() {
    try {
        const result = await window.api.getAllProducts();
        const tbody = ensureTableBody('productsList');
        if (!tbody) return;

        if (result.success && result.data && result.data.length > 0) {
            tbody.innerHTML = '';
            result.data.forEach(product => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${product.code}</td>
                    <td>${product.name}</td>
                    <td>${product.category_name || ''}</td>
                    <td>${product.brand || ''}</td>
                    <td>${product.barcode || 'N/A'}</td>
                    <td>$${product.cost_price.toFixed(2)}</td>
                    <td>$${product.selling_price.toFixed(2)}</td>
                    <td>${product.current_qty || 0}</td>
                    <td>
                        <button class="btn-edit" onclick="editProduct(${product.id}); event.stopPropagation();">Edit</button>
                        <button class="btn-delete" onclick="deleteProduct(${product.id}); event.stopPropagation();">Delete</button>
                    </td>
                `;
                tbody.appendChild(row);
                row.addEventListener('click', () => showProductDetails(product));
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-secondary); font-style:italic;">No products</td></tr>';
        }
    } catch (error) {
        console.error('Load products error:', error);
        const tbody = ensureTableBody('productsList');
        if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-secondary);">Error loading products</td></tr>';
    }
}

// Inventory Management Functions
document.addEventListener('DOMContentLoaded', () => {
    const addBtn1 = document.getElementById('btnAddProductInventory');
    const addBtn2 = document.getElementById('btnAddProductInventory2');
    const adjustBtn = document.getElementById('btnAdjustStock');
    
    if (addBtn1) addBtn1.onclick = () => showAddProductModal();
    if (addBtn2) addBtn2.onclick = () => showAddProductModal();
    if (adjustBtn) adjustBtn.onclick = bulkStockAdjustment;
});

async function loadInventory() {
    // hook up alerts button when inventory screen loads
    const btnAlerts = document.getElementById('btnViewAlerts');
    if (btnAlerts) btnAlerts.onclick = showAlertsModal;
    try {
        console.log('Loading inventory...');
        const tbody = document.getElementById('inventoryTable');
        const emptyDiv = document.getElementById('inventoryEmptyState');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-secondary);">Loading inventory...</td></tr>';
        }

        const res = await window.api.getAllProducts();
        console.log('API Response:', res);

        if (!tbody) {
            console.error('Inventory table element not found!');
            return;
        }

        // reset visibility first
        if (emptyDiv) {
            emptyDiv.style.display = 'none';
        }
        tbody.style.display = '';

        // Calculate inventory overview
        let totalSKUs = 0;
        let totalStockValueSelling = 0;
        let totalStockValueCost = 0;
        let lowStockCount = 0;
        let outOfStockCount = 0;

        if (res.success && res.data && res.data.length > 0) {
            console.log('Found', res.data.length, 'products');
            tbody.innerHTML = '';
            
            res.data.forEach(p => {
                console.log('Adding product:', p.name);
                const tr = document.createElement('tr');
                const stockLevel = p.current_qty || 0;
                const reorderLevel = p.reorder_level || 10;
                const stockStatus = stockLevel <= reorderLevel ? 'low' : 'normal';
                
                // Update counters
                totalSKUs++;
                totalStockValueSelling += (p.selling_price || 0) * stockLevel;
                totalStockValueCost += (p.cost_price || 0) * stockLevel;
                if (stockLevel === 0) outOfStockCount++;
                if (stockLevel <= reorderLevel) lowStockCount++;

                tr.innerHTML = `
                    <td>${p.code}</td>
                    <td>${p.name}</td>
                    <td class="stock-${stockStatus}">${stockLevel}</td>
                    <td>${p.unit || 'pcs'}</td>
                    <td>${p.category_name || 'N/A'}</td>
                    <td>${reorderLevel}</td>
                    <td>
                        <span class="badge badge-${stockStatus}">${stockStatus === 'low' ? 'Low Stock' : 'Normal'}</span>
                    </td>
                    <td>
                        <button class="btn-edit" onclick="adjustStock(${p.id}, '${p.name}', ${stockLevel})">Adjust</button>
                        <button class="btn-primary" onclick="viewStockHistory(${p.id})">History</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else if (res.success && res.data && res.data.length === 0) {
            console.log('No products available');
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-secondary);">No products available</td></tr>';
            if (emptyDiv) {
                emptyDiv.style.display = 'block';
            }
        } else {
            console.warn('Inventory API returned failure or unexpected format', res);
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-secondary);">Unable to load inventory</td></tr>';
            if (emptyDiv) {
                emptyDiv.style.display = 'block';
            }
        }
        
        // Update overview cards
        document.getElementById('totalSKUs').textContent = totalSKUs;
        document.getElementById('totalStockValue').textContent = '$' + totalStockValueSelling.toFixed(2) + ' / $' + totalStockValueCost.toFixed(2) + ' (sell/cost)';
        document.getElementById('lowStockCount').textContent = lowStockCount;
        document.getElementById('outOfStockCount').textContent = outOfStockCount;
        
    } catch(e){
        console.error('Error in loadInventory:', e);
        const tbody = document.getElementById('inventoryTable');
        const emptyDiv = document.getElementById('inventoryEmptyState');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-secondary);">Error loading inventory</td></tr>';
        if (emptyDiv) {
            emptyDiv.style.display = 'block';
        }
        
        // Reset overview cards on error
        document.getElementById('totalSKUs').textContent = '0';
        document.getElementById('totalStockValue').textContent = '$0';
        document.getElementById('lowStockCount').textContent = '0';
        document.getElementById('outOfStockCount').textContent = '0';
    }
}

// show alerts modal
async function showAlertsModal() {
    try {
        const resp = await window.api.getAllAlerts();
        const modal = document.createElement('div');
        modal.className = 'modal';
        let rows = '';
        if (resp.success && resp.data.length) {
            rows = resp.data.map(a =>
                `<tr><td>${a.product_name||'?'}</td><td>${a.type}</td><td>${a.message}</td><td>${a.created_at}</td></tr>`
            ).join('');
        } else {
            rows = '<tr><td colspan="4" style="text-align:center;">No alerts</td></tr>';
        }
        modal.innerHTML = `<div class="modal-content">
            <h2>Alerts</h2>
            <table class="mini-table" style="width:100%;margin-bottom:15px;">
                <thead><tr><th>Product</th><th>Type</th><th>Message</th><th>Date</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <button class="btn-prev" onclick="closeModal(this)">Close</button>
        </div>`;
        document.body.appendChild(modal);
    } catch(err) {
        console.error('Error loading alerts', err);
        alert('Error loading alerts: ' + err.message);
    }
}

async function adjustStock(productId, productName, currentStock) {
    const newStock = prompt(`Current stock for ${productName}: ${currentStock}\n\nEnter new stock quantity:`, currentStock);
    if (newStock === null) return; // User cancelled
    
    const quantity = parseInt(newStock);
    if (isNaN(quantity) || quantity < 0) {
        alert('Please enter a valid positive number');
        return;
    }
    
    const reason = prompt('Enter reason for stock adjustment:');
    if (!reason) {
        alert('Reason is required');
        return;
    }
    
    try {
        const res = await window.api.updateStock(productId, quantity - currentStock, reason);
        if (res.success) {
            alert('Stock adjusted successfully!');
            loadInventory();
        } else {
            alert('Error: ' + res.error);
        }
    } catch(e) {
        alert('Error adjusting stock: ' + e.message);
    }
}

async function viewStockHistory(productId) {
    try {
        const res = await window.api.getStockMovements(productId);
        if (res.success) {
            const modal = document.createElement('div');
            modal.className = 'modal';
            
            let historyHtml = '<h3>Stock Movement History</h3>';
            if (res.data.length > 0) {
                historyHtml += '<div class="stock-history">';
                res.data.forEach(movement => {
                    const type = movement.quantity_change > 0 ? 'add' : 'remove';
                    historyHtml += `
                        <div class="movement-row ${type}">
                            <span class="date">${movement.created_at}</span>
                            <span class="change">${movement.quantity_change > 0 ? '+' : ''}${movement.quantity_change}</span>
                            <span class="reason">${movement.reason}</span>
                            <span class="user">by ${movement.username || 'System'}</span>
                        </div>
                    `;
                });
                historyHtml += '</div>';
            } else {
                historyHtml += '<p>No stock movements recorded</p>';
            }
            
            modal.innerHTML = `
                <div class="modal-content">
                    ${historyHtml}
                    <div style="margin-top:15px; display:flex;gap:10px; justify-content:flex-end;">
                        <button class="btn-danger" onclick="closeModal(this)">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
    } catch(e) {
        alert('Error loading stock history: ' + e.message);
    }
}

// Bulk Stock Adjustment
async function bulkStockAdjustment() {
    try {
        const res = await window.api.getAllProducts();
        if (!res.success) {
            alert('Error loading products for adjustment');
            return;
        }
        
        // Create modal for bulk adjustment
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        let content = `
            <div class="modal-content" style="width: 80%; max-width: 800px;">
                <h3>Bulk Stock Adjustment</h3>
                <div class="modal-body">
                    <div style="max-height: 400px; overflow-y: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Current Stock</th>
                                    <th>New Stock</th>
                                    <th>Change</th>
                                </tr>
                            </thead>
                            <tbody id="bulkAdjustTable">
        `;
        
        res.data.forEach(p => {
            const stockLevel = p.current_qty || 0;
            content += `
                <tr>
                    <td>${p.name}</td>
                    <td>${stockLevel}</td>
                    <td><input type="number" min="0" value="${stockLevel}" id="stock_${p.id}" style="width: 80px; padding: 5px;"></td>
                    <td id="change_${p.id}">${stockLevel - stockLevel}</td>
                </tr>
            `;
        });
        
        content += `
                            </tbody>
                        </table>
                    </div>
                    <div style="margin-top: 15px;">
                        <label>Reason for adjustment: <input type="text" id="bulkAdjustReason" placeholder="Enter reason" style="width: 100%; padding: 8px; margin-top: 5px;"></label>
                    </div>
                </div>
                <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn-danger" onclick="closeModal(this)">Cancel</button>
                    <button class="btn-primary" onclick="performBulkAdjustment()">Apply Adjustments</button>
                </div>
            </div>
        `;
        
        modal.innerHTML = content;
        document.body.appendChild(modal);
        
        // Add event listeners to update change values
        res.data.forEach(p => {
            const input = document.getElementById(`stock_${p.id}`);
            input.addEventListener('input', function() {
                const newValue = parseInt(this.value) || 0;
                const currentValue = p.current_qty || 0;
                const changeElement = document.getElementById(`change_${p.id}`);
                changeElement.textContent = newValue - currentValue;
            });
        });
        
    } catch(e) {
        alert('Error preparing bulk adjustment: ' + e.message);
    }
}

async function performBulkAdjustment() {
    try {
        const res = await window.api.getAllProducts();
        const reason = document.getElementById('bulkAdjustReason').value.trim();
        
        if (!reason) {
            alert('Please enter a reason for the adjustment');
            return;
        }
        
        const adjustments = [];
        
        for (const p of res.data) {
            const newStockInput = document.getElementById(`stock_${p.id}`);
            const newStock = parseInt(newStockInput.value) || 0;
            const currentStock = p.current_qty || 0;
            
            if (newStock !== currentStock) {
                adjustments.push({
                    productId: p.id,
                    newQuantity: newStock,
                    reason: reason
                });
            }
        }
        
        if (adjustments.length === 0) {
            alert('No changes detected');
            closeModal(document.querySelector('.modal')); // Close modal
            return;
        }
        
        // Process adjustments
        let successCount = 0;
        for (const adj of adjustments) {
            const result = await window.api.updateStock(adj.productId, adj.newQuantity - (adj.currentStock || 0), adj.reason);
            if (result.success) {
                successCount++;
            }
        }
        
        alert(`Successfully adjusted ${successCount} products`);
        closeModal(document.querySelector('.modal')); // Close modal
        loadInventory(); // Refresh inventory
        
    } catch(e) {
        alert('Error performing bulk adjustment: ' + e.message);
    }
}

// Audit Log Management Functions
async function loadAuditLogs() {
    try {
        const res = await window.api.getAllAuditLogs();
        const tbody = document.getElementById('auditTable');
        if (!tbody) {
            console.error('Audit logs table element not found!');
            return;
        }

        if (res.success && res.data && res.data.length > 0) {
            tbody.innerHTML = '';
            res.data.forEach(log => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${log.created_at || 'N/A'}</td>
                    <td>${log.user_name || 'System'}</td>
                    <td>${log.action || 'N/A'}</td>
                    <td>${log.table_name || 'N/A'}</td>
                    <td>${log.record_id || 'N/A'}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">No audit logs available</td></tr>';
        }
    } catch(e) {
        console.error('Error in loadAuditLogs:', e);
        const tbody = document.getElementById('auditTable');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">Error loading audit logs</td></tr>';
    }
}

// Sales Management Functions
async function loadSales() {
    try {
        const res = await window.api.getAllSales();
        const tbody = document.getElementById('salesTable');
        if (!tbody) return;

        if (res.success && res.data && res.data.length > 0) {
            tbody.innerHTML = '';
            res.data.forEach(s => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${s.bill_no}</td>
                    <td>${s.cashier_name||''}</td>
                    <td>$${s.total_amount.toFixed(2)}</td>
                    <td>${s.payment_method || 'N/A'}</td>
                    <td>${s.created_at}</td>
                    <td>
                        <button class="btn-primary" onclick="viewSaleDetails(${s.id})">View</button>
                        <button class="btn-edit" onclick="printSaleReceipt(${s.id})">Print</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            // show a clear empty message when there are no records
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary); font-style:italic;">No sales recorded</td></tr>';
        }
    } catch(e){
        console.error(e);
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary); font-style:italic;">Error loading sales</td></tr>';
    }
}


function printSaleReceipt(saleId) {
    alert('Receipt printing functionality will be implemented with thermal printer integration');
}


// load reports
async function loadReports() {
    try {
        // Generate sales summary report
        const salesRes = await window.api.getAllSales();
        const productsRes = await window.api.getAllProducts();
        
        // we will render into the placeholder div so that the outer
        // structure of the page-card remains intact and the heading stays
        // visible even when there is no data
        const reportContent = document.getElementById('reportsContent');
        if (!reportContent) return;
        
        if (salesRes.success && productsRes.success) {
            // Calculate summary statistics
            const totalSales = salesRes.data.reduce((sum, s) => sum + s.total_amount, 0);
            const totalTransactions = salesRes.data.length;
            const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;
            const totalProducts = productsRes.data.length;
            const lowStockItems = productsRes.data.filter(p => p.current_qty <= (p.reorder_level || 10)).length;
            
            // Create report content
            reportContent.innerHTML = `
                <div class="report-grid">
                    <div class="report-card">
                        <h3>Sales Summary</h3>
                        <div class="report-stat"><span>Total Sales:</span><span>$${totalSales.toFixed(2)}</span></div>
                        <div class="report-stat"><span>Total Transactions:</span><span>${totalTransactions}</span></div>
                        <div class="report-stat"><span>Average Transaction:</span><span>$${avgTransaction.toFixed(2)}</span></div>
                    </div>
                    <div class="report-card">
                        <h3>Inventory Summary</h3>
                        <div class="report-stat"><span>Total Products:</span><span>${totalProducts}</span></div>
                        <div class="report-stat"><span>Low Stock Items:</span><span>${lowStockItems}</span></div>
                        <div class="report-stat"><span>Stock Value:</span><span>$${calculateStockValue(productsRes.data).toFixed(2)}</span></div>
                    </div>
                </div>
                <div class="report-actions">
                    <button class="btn-primary" onclick="generateSalesReport()"><i class="fas fa-file-pdf"></i> Generate PDF Report</button>
                    <button class="btn-secondary" onclick="exportData()"><i class="fas fa-download"></i> Export Data</button>
                </div>
            `;
        } else {
            // if one of the calls failed or returned empty we keep the
            // placeholder text
            reportContent.innerHTML = '<p style="color:var(--text-secondary);">No report data available</p>';
        }
    } catch(e){
        console.error(e);
        const reportContent = document.getElementById('reportsContent');
        if (reportContent) reportContent.innerHTML = '<p style="color:var(--text-secondary);">Error loading reports</p>';
    }
}

// load settings list
async function loadSettings() {
    try {
        const res = await window.api.getAllSettings();
        if (res.success) {
            const tbody = document.getElementById('settingsTable');
            if (!tbody) return;
            tbody.innerHTML = '';
            res.data.forEach(s => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${s.key}</td><td>${s.value}</td><td>${s.description||''}</td><td><button class="btn-edit" onclick="editSetting('${s.key}','${encodeURIComponent(s.value)}','${encodeURIComponent(s.description||'')}')">Edit</button></td>`;
                tbody.appendChild(tr);
            });
            const addBtn = document.getElementById('btnAddSetting');
            if (addBtn) addBtn.onclick = showAddSettingModal;
        }
    } catch(e){console.error(e);}    
}

// Helper functions for reports
function calculateStockValue(products) {
    return products.reduce((total, product) => {
        const stockValue = (product.current_qty || 0) * (product.cost_price || 0);
        return total + stockValue;
    }, 0);
}

// Report generation functions
async function generateSalesReport() {
    try {
        const salesRes = await window.api.getAllSales();
        const productsRes = await window.api.getAllProducts();
        
        if (salesRes.success && productsRes.success) {
            // Create a simple CSV report
            let csvContent = "Sales Report\n\n";
            csvContent += "Date,Product,Quantity,Unit Price,Total\n";
            
            // Add sales data
            salesRes.data.forEach(sale => {
                csvContent += `${sale.created_at},Sale #${sale.bill_no},1,${sale.total_amount},${sale.total_amount}\n`;
            });
            
            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            alert('Sales report generated successfully!');
        }
    } catch(e) {
        console.error('Error generating report:', e);
        alert('Error generating report: ' + e.message);
    }
}

function exportData() {
    alert('Data export functionality coming soon!');
}

// Settings functions
async function showAddSettingModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Add New Setting</h2>
            <label>Key<input type="text" id="settingKey" placeholder="setting_key"></label>
            <label>Value<input type="text" id="settingValue" placeholder="setting value"></label>
            <label>Description<textarea id="settingDescription" placeholder="Description of this setting"></textarea></label>
            <div style="margin-top:15px; display:flex;gap:10px; justify-content:flex-end;">
                <button class="btn-success" onclick="submitSettingForm()">Create</button>
                <button class="btn-danger" onclick="closeModal(this)">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function editSetting(key, encodedValue, encodedDescription) {
    const value = decodeURIComponent(encodedValue);
    const description = decodeURIComponent(encodedDescription);
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Edit Setting</h2>
            <label>Key<input type="text" id="settingKey" value="${key}" readonly></label>
            <label>Value<input type="text" id="settingValue" value="${value}"></label>
            <label>Description<textarea id="settingDescription">${description}</textarea></label>
            <div style="margin-top:15px; display:flex;gap:10px; justify-content:flex-end;">
                <button class="btn-success" onclick="submitSettingForm()">Update</button>
                <button class="btn-danger" onclick="closeModal(this)">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function submitSettingForm() {
    const modal = document.querySelector('.modal-content');
    const key = modal.querySelector('#settingKey').value.trim();
    const value = modal.querySelector('#settingValue').value.trim();
    const description = modal.querySelector('#settingDescription').value.trim();
    
    if (!key) {
        alert('Setting key is required');
        return;
    }
    
    try {
        const res = await window.api.setSetting(key, value, description);
        if (res.success) {
            closeModal(modal.querySelector('button.btn-danger'));
            loadSettings();
            alert('Setting saved successfully!');
        } else {
            alert('Error: ' + res.error);
        }
    } catch(e) {
        alert('Error saving setting: ' + e.message);
    }
}

// Product details modal
async function showProductDetails(product) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Product Details</h2>
            <div class="product-details">
                <div class="detail-row"><span>Code:</span><span>${product.code}</span></div>
                <div class="detail-row"><span>Name:</span><span>${product.name}</span></div>
                <div class="detail-row"><span>Category:</span><span>${product.category_name || 'N/A'}</span></div>
                <div class="detail-row"><span>Brand:</span><span>${product.brand || 'N/A'}</span></div>
                <div class="detail-row"><span>Current Stock:</span><span>${product.current_qty || 0}</span></div>
                <div class="detail-row"><span>Reorder Level:</span><span>${product.reorder_level || 'N/A'}</span></div>
                <div class="detail-row"><span>Cost Price:</span><span>$${product.cost_price?.toFixed(2) || 'N/A'}</span></div>
                <div class="detail-row"><span>Selling Price:</span><span>$${product.selling_price?.toFixed(2) || 'N/A'}</span></div>
            </div>
            <div style="margin-top:15px; display:flex;gap:10px; justify-content:flex-end;">
                <button class="btn-primary" onclick="editProduct(${product.id})">Edit Product</button>
                <button class="btn-danger" onclick="closeModal(this)">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Sale details modal
async function showSaleDetails(sale) {
    try {
        const itemsRes = await window.api.getSaleItems(sale.id);
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        let itemsHtml = '';
        if (itemsRes.success && itemsRes.data.length > 0) {
            itemsHtml = '<h3>Sale Items</h3><div class="sale-items">';
            itemsRes.data.forEach(item => {
                itemsHtml += `
                    <div class="item-row">
                        <span>${item.product_name}</span>
                        <span>Qty: ${item.quantity}</span>
                        <span>$${item.unit_price?.toFixed(2) || '0.00'}</span>
                        <span>$${(item.quantity * (item.unit_price || 0)).toFixed(2)}</span>
                    </div>
                `;
            });
            itemsHtml += '</div>';
        }
        
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Sale Details</h2>
                <div class="sale-details">
                    <div class="detail-row"><span>Bill No:</span><span>${sale.bill_no}</span></div>
                    <div class="detail-row"><span>Date:</span><span>${sale.created_at}</span></div>
                    <div class="detail-row"><span>Cashier:</span><span>${sale.cashier_name || 'N/A'}</span></div>
                    <div class="detail-row"><span>Total Amount:</span><span>$${sale.total_amount?.toFixed(2) || '0.00'}</span></div>
                    <div class="detail-row"><span>Payment Method:</span><span>${sale.payment_method || 'N/A'}</span></div>
                </div>
                ${itemsHtml}
                <div style="margin-top:15px; display:flex;gap:10px; justify-content:flex-end;">
                    <button class="btn-primary" onclick="printReceipt(${sale.id})">Print Receipt</button>
                    <button class="btn-danger" onclick="closeModal(this)">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch(e) {
        console.error('Error loading sale details:', e);
        alert('Error loading sale details: ' + e.message);
    }
}

function printReceipt(saleId) {
    alert('Receipt printing functionality coming soon!');
}
async function showAddProductModal(existing) {
    // `existing` is optional product object for editing
    const form = document.createElement('div');
    form.className = 'modal';
    form.innerHTML = `
        <div class="modal-content product-form">
            <h2>${existing ? 'Edit' : 'Add'} Product</h2>
            <div class="step-indicator">
                <div class="step active" data-step="basic">Basic</div>
                <div class="step" data-step="class-unit">Class/Unit</div>
                <div class="step" data-step="others">Others</div>
            </div>

            <div class="step-content active" id="step-basic">
                <div class="form-grid">
                    <label>Name<input type="text" id="productName" required></label>
                    <label>Search Name<input type="text" id="productSearchName"></label>
                    <label>Print Name<input type="text" id="productPrintName"></label>
                    <label>Label Name<input type="text" id="productLabelName"></label>
                    <label>Unicode Name<input type="text" id="productUnicodeName"></label>
                    <label>Barcode<input type="text" id="productBarcode"></label>
                </div>
                <button id="btnTranslate" class="btn-secondary" type="button">Translate</button>
                <div class="step-navigation">
                    <button class="btn-next-bottom" onclick="advanceStep(this)">Next: Class/Unit</button>
                </div>
            </div>

            <div class="step-content" id="step-class-unit">
                <div class="form-grid">
                    <label>Brand<input type="text" id="productBrand"></label>
                    <label>Category
                        <div style="display:flex;gap:6px;align-items:center;">
                            <select id="productCategory"></select>
                            <button type="button" class="btn-secondary" style="padding:4px 8px;" onclick="promptAddCategory()">+ Add</button>
                        </div>
                    </label>
                    <label>Unit<select id="productUnit">
                        <option value="pcs">pcs</option>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="l">l</option>
                        <option value="ml">ml</option>
                        <option value="pack">pack</option>
                    </select></label>
                    <label>Pack Size<input type="text" id="productPackSize" disabled></label>
                    <label>Image<input type="file" id="productImage" accept="image/*"></label>
                </div>
                <div class="step-navigation">
                    <button class="btn-prev" onclick="showStep('basic')">Previous</button>
                    <button class="btn-next-bottom" onclick="advanceStep(this)">Next: Others</button>
                </div>
            </div>

            <div class="step-content" id="step-others">
                <div class="form-grid">
                    <label>Cost Price<input type="number" id="productCost" step="0.01" required></label>
                    <label>Margin %<input type="number" id="productMargin" step="0.01"></label>
                    <label>Selling Price<input type="number" id="productPrice" step="0.01"></label>
                    <label>MRP<input type="number" id="productMRP" step="0.01"></label>
                    <label style="align-items:center"><input type="checkbox" id="wholesaleEnabled"> Wholesale Enabled</label>
                    <label>Wholesale Pack Size<input type="text" id="wholesalePack"></label>
                    <label>Wholesale Price<input type="number" id="wholesalePrice" step="0.01"></label>
                    <label style="align-items:center"><input type="checkbox" id="specialDiscountEnabled"> Special Discount Enabled</label>
                    <label>Discount Quantity<input type="number" id="discountQty"></label>
                    <label>Discount Price<input type="number" id="discountPrice" step="0.01"></label>
                    <label style="align-items:center"><input type="checkbox" id="stockTrackingEnabled" checked> Stock Tracking Enabled</label>
                    <label>Reorder Level<input type="number" id="productReorder" value="10"></label>
                    <label style="align-items:center"><input type="checkbox" id="expiryTracking"> Expiry Tracking</label>
                    <label>Location<input type="text" id="productLocation"></label>
                    <label style="align-items:center"><input type="checkbox" id="saleable" checked> Saleable</label>
                    <label style="align-items:center"><input type="checkbox" id="freeIssue"> Allow Free Issues</label>
                    <label style="align-items:center"><input type="checkbox" id="serviceItem"> Service Item</label>
                    <label style="align-items:center"><input type="checkbox" id="rawMaterial"> Raw Material</label>
                    <label style="align-items:center"><input type="checkbox" id="exclusiveItem"> Exclusive Item</label>
                    <label style="align-items:center"><input type="checkbox" id="taxApplicable" checked> Tax Applicable</label>
                    <label>Status<select id="productStatus">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select></label>
                </div>

                <h4>Suppliers</h4>
                <div id="supplierList"></div>
                <button id="btnAddSupplierRow" type="button">+ Add Supplier</button>

                <div class="step-navigation">
                    <button class="btn-prev" onclick="showStep('class-unit')">Previous</button>
                    <button id="submitBtn" onclick="submitProductForm(${existing ? existing.id : ''})" class="btn-success">${existing ? 'Update' : 'Create'} Product</button>
                    <button onclick="closeModal(this)" class="btn-danger">Cancel</button>
                </div>
            </div>

        </div>
    `;
    document.body.appendChild(form);

    // populate categories
    async function refreshCategories() {
        try {
            const res = await window.api.getCategories();
            const select = form.querySelector('#productCategory');
            select.innerHTML = '';
            res.data.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                select.appendChild(opt);
            });
        } catch (err) {
            console.error('failed load categories', err);
        }
    }
    await refreshCategories();

    // helper for new category via prompt
    window.promptAddCategory = async function() {
        const name = prompt('Enter new category name');
        if (name && name.trim()) {
            const res = await window.api.createCategory(name.trim());
            if (res.success) {
                await refreshCategories(res.id);
            } else {
                alert('Failed to add category: '+res.error);
            }
        }
    };

    // if editing, populate fields
    if (existing) {
        const fill = () => {
            form.querySelector('#productName').value = existing.name || '';
            form.querySelector('#productSearchName').value = existing.metadata?.searchName || '';
            form.querySelector('#productPrintName').value = existing.metadata?.printName || '';
            form.querySelector('#productLabelName').value = existing.metadata?.labelName || '';
            form.querySelector('#productUnicodeName').value = existing.metadata?.unicodeName || '';
            form.querySelector('#productBarcode').value = existing.barcode || '';
            form.querySelector('#productCost').value = existing.cost_price || '';
            form.querySelector('#productMargin').value = existing.metadata?.margin || '';
            form.querySelector('#productPrice').value = existing.selling_price || '';
            form.querySelector('#productMRP').value = existing.metadata?.mrp || '';
            form.querySelector('#wholesaleEnabled').checked = existing.metadata?.wholesaleEnabled || false;
            form.querySelector('#wholesalePack').value = existing.metadata?.wholesalePack || '';
            form.querySelector('#wholesalePrice').value = existing.metadata?.wholesalePrice || '';
            form.querySelector('#specialDiscountEnabled').checked = existing.metadata?.specialDiscountEnabled || false;
            form.querySelector('#discountQty').value = existing.metadata?.discountQty || '';
            form.querySelector('#discountPrice').value = existing.metadata?.discountPrice || '';
            form.querySelector('#stockTrackingEnabled').checked = existing.metadata?.stockTrackingEnabled !== false;
            form.querySelector('#productReorder').value = existing.reorder_level || 0;
            form.querySelector('#expiryTracking').checked = existing.metadata?.expiryTracking || false;
            form.querySelector('#productLocation').value = existing.metadata?.location || '';
            form.querySelector('#saleable').checked = existing.metadata?.saleable !== false;
            form.querySelector('#freeIssue').checked = existing.metadata?.freeIssue || false;
            form.querySelector('#serviceItem').checked = existing.metadata?.serviceItem || false;
            form.querySelector('#rawMaterial').checked = existing.metadata?.rawMaterial || false;
            form.querySelector('#exclusiveItem').checked = existing.metadata?.exclusiveItem || false;
            form.querySelector('#taxApplicable').checked = existing.metadata?.taxApplicable !== false;
            form.querySelector('#productStatus').value = existing.status || 'active';
            form.querySelector('#productBrand').value = existing.brand || '';
            form.querySelector('#productUnit').value = existing.unit || 'pcs';
            form.querySelector('#productPackSize').value = existing.metadata?.packSize || '';
            // suppliers
            if (existing.metadata?.suppliers) {
                existing.metadata.suppliers.forEach(s => addSupplierRow(s, s.default));
            }

            // show existing image preview if available
            if (existing.metadata?.image) {
                const imgHolder = document.createElement('div');
                imgHolder.style.margin = '10px 0';
                imgHolder.innerHTML = `<img src="${existing.metadata.image}" alt="product" style="max-width:100%;max-height:150px;object-fit:contain;border:1px solid #ccc;border-radius:4px;">`;
                form.querySelector('#productImage').parentNode.insertBefore(imgHolder, form.querySelector('#productImage'));
            }
        };
        fill();
    }

    // translate placeholder
    form.querySelector('#btnTranslate').addEventListener('click', () => {
        const name = form.querySelector('#productName').value;
        form.querySelector('#productUnicodeName').value = name; // stub
    });
    
    // price calculation when margin changes
    const costInput = form.querySelector('#productCost');
    const marginInput = form.querySelector('#productMargin');
    const priceInput = form.querySelector('#productPrice');
    marginInput.addEventListener('input', () => {
        const cost = parseFloat(costInput.value) || 0;
        const margin = parseFloat(marginInput.value) || 0;
        priceInput.value = (cost * (1 + margin/100)).toFixed(2);
    });
    costInput.addEventListener('input', () => {
        // recalc if margin present
        const cost = parseFloat(costInput.value) || 0;
        const margin = parseFloat(marginInput.value) || 0;
        priceInput.value = (cost * (1 + margin/100)).toFixed(2);
    });
    
    // Add supplier rows functionality
    function addSupplierRow(supplier={}, isDefault=false) {
        const div = document.createElement('div');
        div.className = 'supplier-row';
        div.innerHTML = `
            <input type="text" class="sup-name" placeholder="Supplier">
            <input type="number" class="sup-price" placeholder="Purchase Price" step="0.01">
            <label>Default<input type="radio" name="defaultSupplier"></label>
            <button type="button" class="btn-delete small">x</button>
        `;
        if (supplier.name) div.querySelector('.sup-name').value=supplier.name;
        if (supplier.price) div.querySelector('.sup-price').value=supplier.price;
        if (isDefault) div.querySelector('input[type=radio]').checked=true;
        div.querySelector('.btn-delete').addEventListener('click', () => div.remove());
        form.querySelector('#supplierList').appendChild(div);
    }
    
    // Add event listener for the add supplier button
    form.querySelector('#btnAddSupplierRow').addEventListener('click', () => addSupplierRow());
}

// Function to validate basic step before proceeding
function validateBasicStep() {
    const productName = document.getElementById('productName').value.trim();
    if (!productName) {
        alert('Product name is required');
        return false;
    }
    return true;
}

// Function to show specific step with validation
function showStep(stepName) {
    if (stepName === 'class-unit' && !validateBasicStep()) {
        return;
    }
    
    // Hide all steps
    document.querySelectorAll('.step-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all step indicators
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Show the selected step
    document.getElementById('step-' + stepName).classList.add('active');
    
    // Activate the corresponding step indicator
    document.querySelector('.step[data-step="' + stepName + '"]').classList.add('active');
    
    // Update bottom Next button labels & visibility
    const nextBtns = document.querySelectorAll('.btn-next-bottom');
    nextBtns.forEach(b => { b.style.display = 'none'; });
    if (stepName === 'basic') {
        const btn = document.querySelector('.btn-next-bottom');
        if (btn) { btn.textContent = 'Next: Class/Unit'; btn.style.display = '' }
    } else if (stepName === 'class-unit') {
        const btns = document.querySelectorAll('.btn-next-bottom');
        if (btns && btns.length) { btns.forEach(b=>{ b.textContent='Next: Others'; b.style.display=''} ) }
    }
}

function advanceStep(btn) {
    // find current active step from indicators
    const steps = ['basic', 'class-unit', 'others'];
    const active = document.querySelector('.step.active');
    let cur = 'basic';
    if (active && active.dataset && active.dataset.step) cur = active.dataset.step;
    const idx = steps.indexOf(cur);
    const next = steps[idx+1];
    if (next) showStep(next);
}

async function submitProductForm(editId) {
    const form = document.querySelector('.modal-content.product-form');
    const data = {};
    // basic
    data.name = form.querySelector('#productName').value.trim();
    if (!data.name) {
        alert('Product name is required');
        return;
    }
    data.searchName = form.querySelector('#productSearchName').value;
    data.printName = form.querySelector('#productPrintName').value;
    data.labelName = form.querySelector('#productLabelName').value;
    data.unicodeName = form.querySelector('#productUnicodeName').value;
    // barcode may be optional; if input exists and has value use it, otherwise null
    const barcodeInput = form.querySelector('#productBarcode');
    data.barcode = barcodeInput ? (barcodeInput.value.trim() || null) : null;
    // class
    data.brand = form.querySelector('#productBrand').value;
    data.categoryId = parseInt(form.querySelector('#productCategory').value) || null;
    data.unit = form.querySelector('#productUnit').value;
    data.packSize = form.querySelector('#productPackSize').value;
    // pricing
    data.costPrice = parseFloat(form.querySelector('#productCost').value) || 0;
    data.margin = parseFloat(form.querySelector('#productMargin').value) || 0;
    data.sellingPrice = parseFloat(form.querySelector('#productPrice').value) || 0;
    data.mrp = parseFloat(form.querySelector('#productMRP').value) || 0;
    data.wholesaleEnabled = form.querySelector('#wholesaleEnabled').checked;
    data.wholesalePack = form.querySelector('#wholesalePack').value;
    data.wholesalePrice = parseFloat(form.querySelector('#wholesalePrice').value) || 0;
    // discount
    data.specialDiscountEnabled = form.querySelector('#specialDiscountEnabled').checked;
    data.discountQty = parseFloat(form.querySelector('#discountQty').value) || 0;
    data.discountPrice = parseFloat(form.querySelector('#discountPrice').value) || 0;
    // stock
    data.stockTrackingEnabled = form.querySelector('#stockTrackingEnabled').checked;
    data.reorderLevel = parseInt(form.querySelector('#productReorder').value) || 0;
    data.expiryTracking = form.querySelector('#expiryTracking').checked;
    data.location = form.querySelector('#productLocation').value;
    // behavior
    data.saleable = form.querySelector('#saleable').checked;
    data.freeIssue = form.querySelector('#freeIssue').checked;
    data.serviceItem = form.querySelector('#serviceItem').checked;
    data.rawMaterial = form.querySelector('#rawMaterial').checked;
    data.exclusiveItem = form.querySelector('#exclusiveItem').checked;
    // tax/status
    data.taxApplicable = form.querySelector('#taxApplicable').checked;
    data.status = form.querySelector('#productStatus').value;
    data.taxRate = data.taxApplicable ? 0 : 0; // placeholder for future rate input
    data.supplierId = null; // currently not linked

    // handle image file
    const imgInput = form.querySelector('#productImage');
    if (imgInput && imgInput.files && imgInput.files[0]) {
        const file = imgInput.files[0];
        // convert to base64
        const reader = new FileReader();
        await new Promise((res, rej) => {
            reader.onload = () => { data.image = reader.result; res(); };
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });
    }
    // suppliers
    const supRows = form.querySelectorAll('.supplier-row');
    const suppliers = [];
    supRows.forEach(r => {
        const name = r.querySelector('.sup-name').value.trim();
        const price = parseFloat(r.querySelector('.sup-price').value)||0;
        const def = r.querySelector('input[type=radio]').checked;
        if (name) suppliers.push({ name, price, default: def });
    });
    data.suppliers = suppliers;
    
    // metadata pack (include image if present, and preserve existing image on edit)
    const metadata = {
        searchName: data.searchName,
        printName: data.printName,
        labelName: data.labelName,
        unicodeName: data.unicodeName,
        packSize: data.packSize,
        margin: data.margin,
        mrp: data.mrp,
        wholesaleEnabled: data.wholesaleEnabled,
        wholesalePack: data.wholesalePack,
        wholesalePrice: data.wholesalePrice,
        specialDiscountEnabled: data.specialDiscountEnabled,
        discountQty: data.discountQty,
        discountPrice: data.discountPrice,
        stockTrackingEnabled: data.stockTrackingEnabled,
        expiryTracking: data.expiryTracking,
        location: data.location,
        saleable: data.saleable,
        freeIssue: data.freeIssue,
        serviceItem: data.serviceItem,
        rawMaterial: data.rawMaterial,
        exclusiveItem: data.exclusiveItem,
        taxApplicable: data.taxApplicable,
        suppliers: data.suppliers
    };
    if (data.image) {
        metadata.image = data.image;
    } else if (existing && existing.metadata && existing.metadata.image) {
        // preserve current image when editing and no new file chosen
        metadata.image = existing.metadata.image;
    }

    // attach metadata to payload
    data.metadata = metadata;

    try {
        let result;
        if (editId) {
            result = await window.api.updateProduct(editId, data);
        } else {
            result = await window.api.createProduct(data);
        }
        if (result.success) {
            const msg = editId ? 'Product updated' : ('Product created: ' + (result.code || ''));
            alert(msg);
            closeModal(document.querySelector('.modal'));
            loadProducts();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (err) {
        alert((editId? 'Update' : 'Create') + ' error: ' + err.message);
    }
}


async function createProduct() {
    try {
        const productData = {
            name: document.getElementById('productName').value,
            barcode: document.getElementById('productBarcode').value,
            costPrice: parseFloat(document.getElementById('productCost').value),
            sellingPrice: parseFloat(document.getElementById('productPrice').value),
            reorderLevel: parseInt(document.getElementById('productReorder').value) || 10,
            taxRate: parseFloat(document.getElementById('productTax').value) || 0,
            categoryId: null,
            supplierId: null
        };

        const result = await window.api.createProduct(productData);
        
        if (result.success) {
            alert('Product created successfully!');
            closeModal(document.querySelector('.modal'));
            loadProducts();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Create product error: ' + error.message);
    }
}

// ========== USERS ==========
async function loadUsers() {
    try {
        const result = await window.api.getAllUsers();
        const tbody = ensureTableBody('usersList');
        if (!tbody) return;
        if (result.success && result.data && result.data.length > 0) {
            tbody.innerHTML = '';
            result.data.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td>${user.email || 'N/A'}</td>
                    <td>${user.phone || 'N/A'}</td>
                    <td>${user.role_name}</td>
                    <td>${user.is_active ? 'Active' : 'Inactive'}</td>
                    <td>
                        <button class="btn-edit">Edit</button>
                        <button class="btn-delete">Delete</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary); font-style:italic;">No users</td></tr>';
        }
    } catch (error) {
        console.error('Load users error:', error);
        const tbody = ensureTableBody('usersList');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">Error loading users</td></tr>';
    }
}

function showAddUserModal() {
    const form = document.createElement('div');
    form.className = 'modal';
    form.innerHTML = `
        <div class="modal-content">
            <h2>Add New User</h2>
            <input type="text" id="newUsername" placeholder="Username" required>
            <input type="email" id="newEmail" placeholder="Email">
            <input type="tel" id="newPhone" placeholder="Phone">
            <input type="password" id="newPassword" placeholder="Password" required>
            <select id="newRole" required>
                <option value="">Select Role</option>
                <option value="1">Admin</option>
                <option value="2">Cashier</option>
            </select>
            <button onclick="createUser()">Create User</button>
            <button onclick="closeModal(this)">Cancel</button>
        </div>
    `;
    document.body.appendChild(form);
}

async function createUser() {
    try {
        const result = await window.api.createUser(
            document.getElementById('newUsername').value,
            document.getElementById('newPassword').value,
            document.getElementById('newEmail').value,
            document.getElementById('newPhone').value,
            parseInt(document.getElementById('newRole').value)
        );

        if (result.success) {
            alert('User created successfully!');
            closeModal(document.querySelector('.modal'));
            loadUsers();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Create user error: ' + error.message);
    }
}

// ========== BILLING ==========
function setupBillingScreen() {
    const searchInput = document.getElementById('productSearch');
    
    searchInput.addEventListener('keyup', debounce(async (e) => {
        const searchTerm = e.target.value.trim();
        if (searchTerm.length === 0) return;

        try {
            let product;
            // Try barcode first
            if (searchTerm.match(/^\d+$/)) {
                const result = await window.api.searchProductByBarcode(searchTerm);
                product = result.data;
            }
            
            // If not found, try code
            if (!product) {
                const result = await window.api.searchProductByCode(searchTerm);
                product = result.data;
            }

            if (product) {
                addToCart(product);
                searchInput.value = '';
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    }, 300));

    // Payment method handlers
    document.querySelectorAll('.btn-payment').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-payment').forEach(b => b.style.background = '');
            e.target.closest('.btn-payment').style.background = 'rgba(212, 175, 55, 0.3)';
            appState.selectedPaymentMethod = e.target.closest('.btn-payment').textContent.trim().split('\n')[0];
        });
    });

    // Complete sale
    document.getElementById('btnCompleteSale').addEventListener('click', completeSale);
    document.getElementById('btnCancelSale').addEventListener('click', cancelSale);
}

function addToCart(product) {
    // Check if product already in cart
    const existingItem = appState.currentCart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        appState.currentCart.push({
            id: product.id,
            name: product.name,
            price: product.selling_price,
            tax_rate: product.tax_rate,
            qty: 1
        });
    }

    updateCartDisplay();
}

function removeFromCart(productId) {
    appState.currentCart = appState.currentCart.filter(item => item.id !== productId);
    updateCartDisplay();
}

function updateCartDisplay() {
    const cartDiv = document.getElementById('cartItems');
    cartDiv.innerHTML = '';

    if (appState.currentCart.length === 0) {
        cartDiv.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Cart is empty</p>';
        updateBillSummary();
        return;
    }

    appState.currentCart.forEach(item => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        const itemTotal = item.price * item.qty;
        
        div.innerHTML = `
            <div class="cart-item-name">${item.name}</div>
            <div>$${(item.price * item.qty).toFixed(2)}</div>
            <div class="cart-item-qty">
                <button onclick="updateQty(${item.id}, -1)">−</button>
                <span style="width: 30px; text-align: center;">${item.qty}</span>
                <button onclick="updateQty(${item.id}, 1)">+</button>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${item.id})">Remove</button>
        `;
        cartDiv.appendChild(div);
    });

    updateBillSummary();
}

function updateQty(productId, change) {
    const item = appState.currentCart.find(i => i.id === productId);
    if (item) {
        item.qty += change;
        if (item.qty <= 0) {
            removeFromCart(productId);
        } else {
            updateCartDisplay();
        }
    }
}

function updateBillSummary() {
    let subtotal = 0;
    let taxTotal = 0;

    appState.currentCart.forEach(item => {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;
        taxTotal += (itemTotal * item.tax_rate) / 100;
    });

    const total = subtotal + taxTotal;

    document.getElementById('billSubtotal').textContent = '$' + subtotal.toFixed(2);
    document.getElementById('billTax').textContent = '$' + taxTotal.toFixed(2);
    document.getElementById('billTotal').textContent = '$' + total.toFixed(2);
}

async function completeSale() {
    if (appState.currentCart.length === 0) {
        alert('Cart is empty!');
        return;
    }

    if (!appState.selectedPaymentMethod) {
        alert('Please select a payment method!');
        return;
    }

    try {
        const billNo = await window.api.generateBillNo();
        alert(`Sale completed!\nBill No: ${billNo.billNo}\nTotal: $${calculateTotal().toFixed(2)}`);
        
        appState.currentCart = [];
        appState.selectedPaymentMethod = null;
        updateCartDisplay();
    } catch (error) {
        alert('Error completing sale: ' + error.message);
    }
}

function cancelSale() {
    if (appState.currentCart.length > 0 && !confirm('Cancel this sale?')) {
        return;
    }
    appState.currentCart = [];
    appState.selectedPaymentMethod = null;
    updateCartDisplay();
}

function calculateTotal() {
    let total = 0;
    appState.currentCart.forEach(item => {
        const itemTotal = item.price * item.qty;
        const tax = (itemTotal * item.tax_rate) / 100;
        total += itemTotal + tax;
    });
    return total;
}

// ========== LOGOUT ==========
async function handleLogout() {
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }

    try {
        await window.api.logout();
        appState.currentUser = null;
        appState.currentCart = [];
        showScreen('loginScreen');
        // clear form fields
        const u = document.getElementById('username');
        const p = document.getElementById('password');
        if (u) u.value = '';
        if (p) p.value = '';
        setupLoginListeners();
    } catch (error) {
        alert('Logout error: ' + error.message);
    }
}

// ========== UTILITY FUNCTIONS ==========
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function closeModal(btn) {
    btn.closest('.modal').remove();
}

function goBackToProducts(btn) {
    const modalEl = btn.closest('.modal');
    if (modalEl) modalEl.remove();
    const nav = document.querySelector('.nav-item[data-screen="products"]');
    if (nav) {
        nav.click();
    } else {
        // fallback: show the products content directly
        try { showContentScreen('products'); loadProducts(); } catch (e) {}
    }
}

async function editProduct(productId) {
    try {
        // reload all and find by id
        const all = await window.api.getAllProducts();
        const prod = all.data.find(p => p.id === productId);
        if (prod) {
            showAddProductModal(prod);
        } else alert('Product not found');
    } catch (err) {
        console.error(err);
        alert('Cannot fetch product for editing');
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
        const res = await window.api.deleteProduct(productId);
        if (res.success) {
            alert('Product deleted');
            loadProducts();
        } else {
            alert('Delete failed: ' + res.error);
        }
    } catch (err) {
        alert('Delete error: ' + err.message);
    }
}

function showProductDetails(product) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    const m = product.metadata || {};

    const supplierRows = (m.suppliers || []).map(s => `
        <tr>
            <td>${s.name}</td>
            <td>$${(s.price || 0).toFixed(2)}</td>
            <td>${s.default ? 'Yes' : 'No'}</td>
        </tr>
    `).join('');

    // show badges for status and stock
    const statusBadge = `<span class="badge ${product.status === 'active' ? 'badge-active' : 'badge-inactive'}">${product.status}</span>`;
    const stockBadge = `<span class="badge ${((product.current_qty||0) <= (product.reorder_level||0)) ? 'badge-warning' : 'badge-ok'}">Stock: ${product.current_qty||0}</span>`;

    modal.innerHTML = `
        <div class="modal-content product-details">
            <div class="details-header">
                <div style="display:flex;flex-direction:column;gap:6px;">
                    <div style="display:flex;justify-content:flex-start;">
                        <button class="btn-back" onclick="goBackToProducts(this)">←</button>
                    </div>
                    <h2>Product Details</h2>
                    <div class="badges">${statusBadge} ${stockBadge}</div>
                </div>
                <div class="actions">
                    <button class="btn-success" onclick="editProduct(${product.id});closeModal(this)">Edit</button>
                    <button class="btn-danger" onclick="deleteProduct(${product.id});closeModal(this)">Delete</button>
                </div>
            </div>

            <div class="details-grid">
                <div class="left">
                    <div class="product-image">
                        ${m.image ? `<img src="${m.image}" alt="${product.name}">` : 'Image'}
                    </div>
                    <h3 class="name">${product.name}</h3>
                    <p class="muted"><strong>Code:</strong> ${product.code}</p>
                    <p class="muted"><strong>Category:</strong> ${product.category_name || '<em>n/a</em>'}</p>
                    <p class="muted"><strong>Brand:</strong> ${product.brand || '<em>n/a</em>'}</p>
                    <p class="muted"><strong>Barcode:</strong> ${product.barcode || '<em>n/a</em>'}</p>
                </div>
                <div class="right">
                    <div class="price-row">
                        <div><strong>Cost</strong><div class="price">$${(product.cost_price||0).toFixed(2)}</div></div>
                        <div><strong>Price</strong><div class="price">$${(product.selling_price||0).toFixed(2)}</div></div>
                        <div><strong>Reorder</strong><div class="price">${product.reorder_level||0}</div></div>
                    </div>

                    <h4>Metadata</h4>
                    <div class="meta-chips">
                        <span class="meta-chip">Search: ${m.searchName || 'n/a'}</span>
                        <span class="meta-chip">Print: ${m.printName || 'n/a'}</span>
                        <span class="meta-chip">Pack: ${m.packSize || 'n/a'}</span>
                        <span class="meta-chip">Margin: ${m.margin || 0}%</span>
                        <span class="meta-chip">MRP: $${(m.mrp||0).toFixed ? (m.mrp||0).toFixed(2) : (m.mrp||0)}</span>
                    </div>

                    <h4>Suppliers</h4>
                    <table class="suppliers-table">
                        <thead><tr><th>Name</th><th>Price</th><th>Default</th></tr></thead>
                        <tbody>
                            ${supplierRows || '<tr><td colspan="3" style="text-align:center">No suppliers</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <details>
                <summary>Show raw metadata JSON</summary>
                <pre>${JSON.stringify(m, null, 2)}</pre>
            </details>
        </div>
    `;
    document.body.appendChild(modal);
}
