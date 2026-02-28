const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'pos.db');
const db = new sqlite3.Database(dbPath);

function initialize() {
    db.serialize(() => {
        // ========== ROLES & USERS ==========
        db.run(`CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            role_id INTEGER NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(role_id) REFERENCES roles(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            logout_time DATETIME,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // ========== CATEGORIES & SUPPLIERS ==========
        db.run(`CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            contact_person TEXT,
            phone TEXT,
            email TEXT,
            address TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // ========== PRODUCTS ==========
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            barcode TEXT UNIQUE,
            category_id INTEGER,
            brand TEXT,
            unit TEXT DEFAULT 'pcs',
            cost_price REAL NOT NULL,
            selling_price REAL NOT NULL,
            reorder_level INTEGER DEFAULT 10,
            supplier_id INTEGER,
            tax_rate REAL DEFAULT 0.0,
            status TEXT DEFAULT 'active',
            metadata TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(category_id) REFERENCES categories(id),
            FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS stock (
            id INTEGER PRIMARY KEY,
            product_id INTEGER UNIQUE NOT NULL,
            current_qty INTEGER DEFAULT 0,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(product_id) REFERENCES products(id)
        )`);
        // attempt to alter table if metadata missing (upgrade path)
        db.run(`ALTER TABLE products ADD COLUMN metadata TEXT DEFAULT '{}'`, () => {});
        // ensure brand column exists for databases created before brand field added
        db.run(`ALTER TABLE products ADD COLUMN brand TEXT`, () => {});
        // in case older rows already exist with empty string barcodes, convert them to NULL
        db.run(`UPDATE products SET barcode = NULL WHERE barcode = ''`, () => {});

        db.run(`CREATE TABLE IF NOT EXISTS stock_movements (
            id INTEGER PRIMARY KEY,
            product_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            qty INTEGER NOT NULL,
            reference_id INTEGER,
            reference_type TEXT,
            note TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(product_id) REFERENCES products(id),
            FOREIGN KEY(created_by) REFERENCES users(id)
        )`);

        // ========== PURCHASES & PURCHASE ORDERS ==========
        db.run(`CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY,
            purchase_no TEXT UNIQUE NOT NULL,
            supplier_id INTEGER NOT NULL,
            total_amount REAL NOT NULL,
            tax_amount REAL DEFAULT 0,
            status TEXT DEFAULT 'pending',
            received_by INTEGER,
            received_at DATETIME,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
            FOREIGN KEY(received_by) REFERENCES users(id),
            FOREIGN KEY(created_by) REFERENCES users(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS purchase_items (
            id INTEGER PRIMARY KEY,
            purchase_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            qty INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            line_total REAL NOT NULL,
            FOREIGN KEY(purchase_id) REFERENCES purchases(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )`);

        // ========== SALES & BILLING ==========
        db.run(`CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY,
            bill_no TEXT UNIQUE NOT NULL,
            cashier_id INTEGER NOT NULL,
            subtotal REAL NOT NULL,
            tax_amount REAL DEFAULT 0,
            discount_amount REAL DEFAULT 0,
            total_amount REAL NOT NULL,
            status TEXT DEFAULT 'completed',
            voided_by INTEGER,
            voided_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(cashier_id) REFERENCES users(id),
            FOREIGN KEY(voided_by) REFERENCES users(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY,
            sale_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            qty INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            discount REAL DEFAULT 0,
            tax_rate REAL DEFAULT 0,
            line_total REAL NOT NULL,
            FOREIGN KEY(sale_id) REFERENCES sales(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY,
            sale_id INTEGER NOT NULL,
            method TEXT NOT NULL,
            amount REAL NOT NULL,
            reference TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(sale_id) REFERENCES sales(id)
        )`);

        // ========== ALERTS ==========
        db.run(`CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY,
            product_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            is_sent INTEGER DEFAULT 0,
            sent_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(product_id) REFERENCES products(id)
        )`);

        // ========== AUDIT LOGS ==========
        db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            action TEXT NOT NULL,
            table_name TEXT,
            record_id INTEGER,
            old_value TEXT,
            new_value TEXT,
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // ========== SETTINGS ==========
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            value TEXT,
            description TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // ========== INSERT DEFAULT DATA ==========
        db.run("INSERT OR IGNORE INTO roles (id, name) VALUES (1, 'Admin')", (err) => {
            if (err) console.error('Error inserting Admin role:', err);
        });
        db.run("INSERT OR IGNORE INTO roles (id, name) VALUES (2, 'Cashier')", (err) => {
            if (err) console.error('Error inserting Cashier role:', err);
        });
    });
}

function seedData() {
    const crypto = require('crypto');
    
    function hashPassword(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    }

    // Check if admin already exists and seed if needed
    db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
        if (result && result.count === 0) {
            console.log('🌱 Seeding database with initial data...');
            
            // Create default admin user
            const adminPassword = hashPassword('admin123');
            db.run(
                `INSERT INTO users (username, password_hash, email, phone, role_id, is_active)
                VALUES (?, ?, ?, ?, ?, ?)`,
                ['admin', adminPassword, 'admin@possystem.local', '+94771234567', 1, 1]
            );

            // Create sample categories
            const categories = ['Electronics', 'Groceries', 'Beverages', 'Snacks', 'Dairy', 'Bakery', 'Meat & Fish', 'Clothing'];
            categories.forEach(cat => {
                db.run(`INSERT INTO categories (name) VALUES (?)`, [cat]);
            });

            // Create sample suppliers
            db.run(
                `INSERT INTO suppliers (name, contact_person, phone, email, is_active)
                VALUES (?, ?, ?, ?, ?)`,
                ['Global Wholesale', 'John Smith', '+18001234567', 'sales@globalwholesale.com', 1]
            );

            console.log('✅ Default data created - Admin (admin/admin123)');
        }
    });
}

module.exports = { db, initialize, seedData };
