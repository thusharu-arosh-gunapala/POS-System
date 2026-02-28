// Application State
const appState = {
    currentUser: null,
    currentCart: [],
    selectedPaymentMethod: null
};

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    const user = await window.api.getCurrentUser();
    
    if (!user) {
        showScreen('loginScreen');
        setupLoginListeners();
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
}

function showContentScreen(screenId) {
    document.querySelectorAll('.content-screen').forEach(s => s.classList.remove('active'));
    document.querySelector('#' + screenId).classList.add('active');
}

// ========== LOGIN HANDLERS ==========
function setupLoginListeners() {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        loginError.classList.remove('show');

        try {
            const result = await window.api.login(username, password);
            
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
            loginError.textContent = 'Login failed: ' + error.message;
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
            if (screenId === 'reports') {/* future */}
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
            if (data.lowStockCount > 0) {
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

// ========== SUPPLIERS ==========
async function loadSuppliers() {
    try {
        const res = await window.api.getAllSuppliers();
        if (res.success) {
            const tbody = document.getElementById('suppliersList');
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
        }
    } catch (err) {
        console.error('loadSuppliers error', err);
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
async function loadCategories() {
    try {
        const res = await window.api.getCategories();
        if (res.success) {
            const tbody = document.getElementById('categoriesList');
            tbody.innerHTML = '';
            res.data.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${c.name}</td><td><button class="btn-delete" onclick="editCategory(${c.id},'${c.name}')">Edit</button></td>`;
                tbody.appendChild(tr);
            });
        }
    } catch (e) { console.error(e); }
}

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
        if (res.success) {
            const tbody = document.getElementById('categoriesList');
            tbody.innerHTML = '';
            res.data.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${c.name}</td><td><button class="btn-delete" onclick="showCategoryModal({id:${c.id},name:'${c.name}'})">Edit</button></td>`;
                tbody.appendChild(tr);
            });
        }
    } catch (e) { console.error(e); }
}

    if (confirm('Disable this supplier?')) {
        const res = await window.api.deactivateSupplier(id);
        if (res.success) loadSuppliers();
    }
}

// ========== PRODUCTS ==========
async function loadProducts() {
    try {
        const result = await window.api.getAllProducts();
        
        if (result.success) {
            const tbody = document.getElementById('productsList');
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
        }
    } catch (error) {
        console.error('Load products error:', error);
    }
}

// show simple inventory list
async function loadInventory() {
    try {
        const res = await window.api.getAllProducts();
        if (res.success) {
            const tbody = document.getElementById('inventoryTable');
            if (!tbody) return;
            tbody.innerHTML = '';
            res.data.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${p.code}</td><td>${p.name}</td><td>${p.current_qty||0}</td>`;
                tbody.appendChild(tr);
            });
        }
    } catch(e){console.error(e);}
}

// load sales history
async function loadSales() {
    try {
        const res = await window.api.getAllSales();
        if (res.success) {
            const tbody = document.getElementById('salesTable');
            if (!tbody) return;
            tbody.innerHTML = '';
            res.data.forEach(s => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${s.bill_no}</td><td>${s.cashier_name||''}</td><td>$${s.total_amount.toFixed(2)}</td><td>${s.created_at}</td>`;
                tbody.appendChild(tr);
            });
        }
    } catch(e){console.error(e);}
}

// load audit logs
async function loadAuditLogs() {
    try {
        const res = await window.api.getAllAuditLogs();
        if (res.success) {
            const tbody = document.getElementById('auditTable');
            if (!tbody) return;
            tbody.innerHTML = '';
            res.data.forEach(a => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${a.created_at}</td><td>${a.username||''}</td><td>${a.action}</td><td>${a.table_name}</td><td>${a.record_id||''}</td>`;
                tbody.appendChild(tr);
            });
        }
    } catch(e){console.error(e);}
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
                tr.innerHTML = `<td>${s.key}</td><td>${s.value}</td><td>${s.description||''}</td>`;
                tbody.appendChild(tr);
            });
        }
    } catch(e){console.error(e);}
}

async function showAddProductModal(existing) {
    // `existing` is optional product object for editing
    const form = document.createElement('div');
    form.className = 'modal';
    form.innerHTML = `
        <div class="modal-content product-form">
`},{            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div><button class="btn-back" onclick="goBackToProducts(this)">←</button></div>
                <h2 style="margin:0">${existing ? 'Edit Product' : 'Add New Product'}</h2>
                <div></div>
            </div>
            <div class="step-indicator">
                <div class="step active" data-step="basic">Basic</div>
                <div class="step" data-step="class-unit">Class/Unit</div>
                <div class="step" data-step="others">Others</div>
            </div>
            
            <div class="step-content active" id="step-basic">
                <div class="form-grid">
                    <label>Product Name*<input type="text" id="productName" required></label>
                    <label>Search Name<input type="text" id="productSearchName" placeholder="alias1, alias2"></label>
                    <label>Print Name<input type="text" id="productPrintName" maxlength="30"></label>
                    <label>Label Name<input type="text" id="productLabelName"></label>
                    <label>Unicode Name<input type="text" id="productUnicodeName"></label>
                    <label style="align-items:flex-start">Translate<br><button id="btnTranslate">Translate</button></label>
                </div>
                <div class="step-navigation">
                    <div></div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <button class="btn-next-bottom" onclick="advanceStep(this)">Next: Class/Unit</button>
                    </div>
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
                    <div style="display:flex;gap:8px;align-items:center;">
                        <button class="btn-next-bottom" onclick="advanceStep(this)">Next: Others</button>
                    </div>
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
                    <div style="display:flex;gap:8px;align-items:center;">
                        <button id="submitBtn" onclick="submitProductForm(${existing ? existing.id : ''})" class="btn-success">${existing ? 'Update' : 'Create'} Product</button>
                        <button onclick="closeModal(this)" class="btn-danger">Cancel</button>
                    </div>
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
    
    // metadata pack
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
        
        if (result.success) {
            const tbody = document.getElementById('usersList');
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
        }
    } catch (error) {
        console.error('Load users error:', error);
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
                    <div class="product-image">Image</div>
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
