const { db } = require('./db');
const crypto = require('crypto');

// Password hashing
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// User queries
function findUserByUsername(username) {
    return new Promise((resolve, reject) => {
        // use a case-insensitive comparison so that users can enter
        // uppercase/lowercase variations of their username
        db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function findUserById(userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?', [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function getAllUsers() {
    return new Promise((resolve, reject) => {
        db.all('SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.created_at DESC', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function createUser(username, password, email, phone, roleId) {
    return new Promise((resolve, reject) => {
        const passwordHash = hashPassword(password);
        db.run('INSERT INTO users (username, password_hash, email, phone, role_id) VALUES (?, ?, ?, ?, ?)',
            [username, passwordHash, email, phone, roleId],
            function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

function verifyPassword(plainPassword, hashedPassword) {
    return hashPassword(plainPassword) === hashedPassword;
}

// helper for CLI or administrative operations
function updateUserPassword(userId, newHashedPassword) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHashedPassword, userId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Session queries
function createSession(userId) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO user_sessions (user_id) VALUES (?)', [userId], function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function endSession(sessionId) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE user_sessions SET logout_time = CURRENT_TIMESTAMP WHERE id = ?', [sessionId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Product queries
function getAllProducts() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT p.*, c.name as category_name, s.current_qty
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN stock s ON p.id = s.product_id
                WHERE p.status = 'active'
                ORDER BY p.created_at DESC`, [], (err, rows) => {
            if (err) reject(err);
            else {
                rows = rows.map(r => {
                    try { r.metadata = JSON.parse(r.metadata || '{}'); } catch(_) { r.metadata = {}; }
                    return r;
                });
                resolve(rows || []);
            }
        });
    });
}

function createProduct(code, name, barcode, categoryId, brand, costPrice, sellingPrice, reorderlevel, supplierId, taxRate, status = 'active', metadata = {}) {
    return new Promise((resolve, reject) => {
        // normalize empty barcode -> NULL so UNIQUE constraint doesn't treat empty string as duplicate
        const barcodeVal = (barcode && barcode.trim()) ? barcode.trim() : null;
        db.run(`INSERT INTO products (code, name, barcode, category_id, brand, cost_price, selling_price, reorder_level, supplier_id, tax_rate, status, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [code, name, barcodeVal, categoryId, brand, costPrice, sellingPrice, reorderlevel, supplierId, taxRate, status, JSON.stringify(metadata)],
            function (err) {
                if (err) reject(err);
                else {
                    // Initialize stock
                    db.run('INSERT INTO stock (product_id, current_qty) VALUES (?, 0)', [this.lastID], (err2) => {
                        if (err2) reject(err2);
                        else resolve(this.lastID);
                    });
                }
            }
        );
    });
}

function getProductByCode(code) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT p.*, s.current_qty
                FROM products p
                LEFT JOIN stock s ON p.id = s.product_id
                WHERE p.code = ? AND p.status = 'active'`, [code], (err, row) => {
            if (err) reject(err);
            else {
                if (row) {
                    try { row.metadata = JSON.parse(row.metadata || '{}'); } catch(_) { row.metadata={}; }
                }
                resolve(row);
            }
        });
    });
}

// search by barcode
function getProductByBarcode(barcode) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT p.*, s.current_qty
                FROM products p
                LEFT JOIN stock s ON p.id = s.product_id
                WHERE p.barcode = ? AND p.status = 'active'`, [barcode], (err, row) => {
            if (err) reject(err);
            else {
                if (row) {
                    try { row.metadata = JSON.parse(row.metadata || '{}'); } catch(_) { row.metadata = {}; }
                }
                resolve(row);
            }
        });
    });
}

function getProductStock(productId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT current_qty FROM stock WHERE product_id = ?', [productId], (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.current_qty : 0);
        });
    });
}

// legacy signature preserved for compatibility, but not used
function createProductLegacy(code, name, barcode, categoryId, costPrice, sellingPrice, reorderlevel, supplierId, taxRate) {
    return createProduct(code, name, barcode, categoryId, null, costPrice, sellingPrice, reorderlevel, supplierId, taxRate);
}

function generateProductCode() {
    const year = new Date().getFullYear();
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
            if (err) reject(err);
            else {
                const code = `PRD-${year}-${String(row.count + 1).padStart(6, '0')}`;
                resolve(code);
            }
        });
    });
}

function updateProduct(id, data) {
    // accept both camelCase and snake_case incoming fields
    const name = data.name || data.name;
    let barcode = data.barcode || data.barcode;
    if (barcode && typeof barcode === 'string') barcode = barcode.trim() || null;
    const categoryId = data.categoryId || data.category_id || null;
    const brand = data.brand || data.brand;
    const unit = data.unit || data.unit;
    const costPrice = data.costPrice || data.cost_price || 0;
    const sellingPrice = data.sellingPrice || data.selling_price || 0;
    const reorderLevel = data.reorderLevel || data.reorder_level || 0;
    const supplierId = data.supplierId || data.supplier_id || null;
    const taxRate = data.taxRate || data.tax_rate || 0;
    const status = data.status || data.status || 'active';
    const metadata = data.metadata || data.metadata || {};

    return new Promise((resolve, reject) => {
        const sql = `UPDATE products SET
                        name=?,
                        barcode=?,
                        category_id=?,
                        brand=?,
                        unit=?,
                        cost_price=?,
                        selling_price=?,
                        reorder_level=?,
                        supplier_id=?,
                        tax_rate=?,
                        status=?,
                        metadata=?
                     WHERE id=?`;
        const params = [
            name,
            barcode,
            categoryId,
            brand,
            unit,
            costPrice,
            sellingPrice,
            reorderLevel,
            supplierId,
            taxRate,
            status,
            JSON.stringify(metadata || {}),
            id
        ];
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function setProductInactive(id) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE products SET status = "inactive" WHERE id = ?', [id], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Category functions
function getAllCategories() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM categories ORDER BY name', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function createCategory(name) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO categories (name) VALUES (?)', [name], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

// Stock operations
function updateStock(productId, quantity) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE stock SET current_qty = current_qty + ?, last_updated = CURRENT_TIMESTAMP WHERE product_id = ?',
            [quantity, productId],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

function recordStockMovement(productId, type, qty, refId, refType, note, userId) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO stock_movements (product_id, type, qty, reference_id, reference_type, note, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [productId, type, qty, refId, refType, note, userId],
            function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

// Audit log
function recordAuditLog(userId, action, tableName, recordId, oldValue, newValue, ipAddress) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO audit_logs (user_id, action, table_name, record_id, old_value, new_value, ip_address)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, action, tableName, recordId, oldValue, newValue, ipAddress],
            function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

// Suppliers
function getAllSuppliers() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM suppliers ORDER BY name', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function createSupplier(name, contact_person, phone, email, address) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO suppliers (name, contact_person, phone, email, address)
                VALUES (?, ?, ?, ?, ?)`,
            [name, contact_person, phone, email, address], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
    });
}

function updateSupplier(id, data) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE suppliers SET name=?, contact_person=?, phone=?, email=?, address=?, is_active=? WHERE id=?`,
            [data.name, data.contact_person, data.phone, data.email, data.address, data.is_active ? 1 : 0, id],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
    });
}

function setSupplierInactive(id) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE suppliers SET is_active = 0 WHERE id = ?', [id], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Sales retrieval
function getAllSales() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT s.*, u.username as cashier_name
                FROM sales s
                LEFT JOIN users u ON s.cashier_id = u.id
                ORDER BY s.created_at DESC`, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function getSaleById(saleId) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT s.*, u.username as cashier_name
                FROM sales s
                LEFT JOIN users u ON s.cashier_id = u.id
                WHERE s.id = ?`, [saleId], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

function getSaleItems(saleId) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT si.*, p.name as product_name
                FROM sale_items si
                LEFT JOIN products p ON si.product_id = p.id
                WHERE si.sale_id = ?
                ORDER BY si.id`, [saleId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function getSaleItems(saleId) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT si.*, p.name as product_name
                FROM sale_items si
                LEFT JOIN products p ON si.product_id = p.id
                WHERE si.sale_id = ?`, [saleId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Audit logs
function getAllAuditLogs() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT al.*, u.username
                FROM audit_logs al
                LEFT JOIN users u ON al.user_id=u.id
                ORDER BY al.created_at DESC`, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Stock Management Functions
function updateStock(productId, quantityChange, reason, userId) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Update stock table
            db.run(`INSERT INTO stock_movements (product_id, quantity_change, reason, user_id)
                    VALUES (?, ?, ?, ?)`, [productId, quantityChange, reason, userId], (err) => {
                if (err) {
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                }
                
                // Update current stock
                db.run(`INSERT INTO stock (product_id, current_qty, last_updated)
                        VALUES (?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT(product_id) DO UPDATE SET
                        current_qty = current_qty + excluded.quantity_change,
                        last_updated = CURRENT_TIMESTAMP`, [productId, quantityChange], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        reject(err);
                    } else {
                        db.run('COMMIT');
                        resolve({ success: true });
                    }
                });
            });
        });
    });
}

function getStockMovements(productId) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT sm.*, u.username
                FROM stock_movements sm
                LEFT JOIN users u ON sm.user_id = u.id
                WHERE sm.product_id = ?
                ORDER BY sm.created_at DESC`, [productId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Settings
function getSetting(key) {
    return new Promise((resolve, reject) => {
        db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.value : null);
        });
    });
}

// Alerts helpers
function createAlert(productId, type, message) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO alerts (product_id, type, message) VALUES (?, ?, ?)`,
            [productId, type, message], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
    });
}

function getAlerts() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT a.*, p.name as product_name
                FROM alerts a
                LEFT JOIN products p ON a.product_id=p.id
                ORDER BY a.created_at DESC`, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function getAllSettings() {
    return new Promise((resolve, reject) => {
        db.all('SELECT key, value, description FROM settings', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function setSetting(key, value, description) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT OR REPLACE INTO settings (key, value, description, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
            [key, value, description],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}


// generic query helpers used by dashboard functions
function querySingle(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row || {});
        });
    });
}

function queryAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Dashboard / reporting queries
async function getDashboardData() {
    // compute a collection of metrics used on the admin dashboard
    const data = {};

    // total sales and bill count for today
    const totals = await querySingle(
        `SELECT IFNULL(SUM(total_amount),0) as totalSales,
                COUNT(*) as billCount
         FROM sales
         WHERE date(created_at)=date('now','localtime')
           AND status='completed'`
    );
    data.totalSales = totals.totalSales || 0;
    data.billCount = totals.billCount || 0;

    // cash vs card breakdown
    data.payments = await queryAll(
        `SELECT method, IFNULL(SUM(amount),0) as total
         FROM payments
         WHERE sale_id IN (
             SELECT id FROM sales
             WHERE date(created_at)=date('now','localtime')
               AND status='completed'
         )
         GROUP BY method`
    );

    // low stock count
    const low = await querySingle(
        `SELECT COUNT(*) as count
         FROM stock s
         JOIN products p ON s.product_id=p.id
         WHERE s.current_qty <= p.reorder_level`
    );
    data.lowStockCount = low.count || 0;

    // pending alerts (unsent)
    const alertCountRow = await querySingle(
        `SELECT COUNT(*) as count FROM alerts WHERE is_sent = 0`);
    data.alertCount = alertCountRow.count || 0;

    // low stock items (top 10)
    data.lowStockItems = await queryAll(
        `SELECT p.code, p.name, s.current_qty, p.reorder_level, p.brand
         FROM stock s
         JOIN products p ON s.product_id=p.id
         WHERE s.current_qty <= p.reorder_level
         ORDER BY s.current_qty ASC
         LIMIT 10`
    );

    // net profit for today (sale price minus cost price)
    const profitRow = await querySingle(
        `SELECT IFNULL(SUM((si.unit_price - p.cost_price) * si.qty),0) as netProfit
         FROM sale_items si
         JOIN sales s ON si.sale_id=s.id
         JOIN products p ON si.product_id=p.id
         WHERE date(s.created_at)=date('now','localtime')
           AND s.status='completed'`
    );
    data.netProfit = profitRow.netProfit || 0;

    // hourly sales for today
    data.hourlySales = await queryAll(
        `SELECT strftime('%H', created_at) as hour,
                IFNULL(SUM(total_amount),0) as total
         FROM sales
         WHERE date(created_at)=date('now','localtime')
           AND status='completed'
         GROUP BY hour`
    );

    // daily sales trend over last 7 days
    data.dailyTrend = await queryAll(
        `SELECT date(created_at) as day,
                IFNULL(SUM(total_amount),0) as total
         FROM sales
         WHERE date(created_at) >= date('now','localtime','-6 days')
           AND status='completed'
         GROUP BY day`
    );

    return data;
}

module.exports = {
    hashPassword,
    verifyPassword,
    findUserByUsername,
    findUserById,
    getAllUsers,
    createUser,
    createSession,
    endSession,
    getAllProducts,
    getProductByBarcode,
    getProductByCode,
    getProductStock,
    createProduct,
    generateProductCode,
    updateStock,
    recordStockMovement,
    recordAuditLog,
    updateProduct,
    setProductInactive,
    getSetting,
    setSetting,
    getAllCategories,
    createCategory,
    getDashboardData,
    getAllAuditLogs,
    // helper exports
    querySingle,
    getAlerts
};
