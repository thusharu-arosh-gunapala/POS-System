const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

const dbPath = path.join(__dirname, 'pos.db');
const db = new sqlite3.Database(dbPath);

console.log('🌱 Seeding database with initial data...\n');

db.serialize(() => {
    // Check if admin already exists
    db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
        if (!row) {
            // Create default admin user
            const adminPassword = hashPassword('admin123');
            db.run(
                `INSERT INTO users (username, password_hash, email, phone, role_id, is_active)
                VALUES (?, ?, ?, ?, ?, ?)`,
                ['admin', adminPassword, 'admin@possystem.local', '+94771234567', 1, 1],
                (err) => {
                    if (err) console.error('Error creating admin:', err);
                    else console.log('✅ Default admin user created');
                    console.log('   Username: admin');
                    console.log('   Password: admin123');
                }
            );
        }
    });

    // Create sample categories if not exist
    db.get('SELECT COUNT(*) as count FROM categories', (err, result) => {
        if (result.count === 0) {
            const categories = [
                'Electronics',
                'Groceries',
                'Beverages',
                'Snacks',
                'Dairy',
                'Bakery',
                'Meat & Fish',
                'Clothing'
            ];

            categories.forEach(cat => {
                db.run(
                    `INSERT INTO categories (name) VALUES (?)`,
                    [cat],
                    (err) => {
                        if (!err) console.log(`✅ Category created: ${cat}`);
                    }
                );
            });
        }
    });

    // Create sample suppliers
    db.get('SELECT COUNT(*) as count FROM suppliers', (err, result) => {
        if (result.count === 0) {
            const suppliers = [
                { name: 'Global Wholesale', contact: 'John Smith', phone: '+18001234567', email: 'sales@globalwholesale.com' },
                { name: 'Local Distributor', contact: 'Rajesh Kumar', phone: '+94771234567', email: 'info@localdist.lk' },
                { name: 'Premium Foods Ltd', contact: 'Sarah Johnson', phone: '+18003334444', email: 'orders@premiumfoods.com' }
            ];

            suppliers.forEach(supplier => {
                db.run(
                    `INSERT INTO suppliers (name, contact_person, phone, email, is_active)
                    VALUES (?, ?, ?, ?, ?)`,
                    [supplier.name, supplier.contact, supplier.phone, supplier.email, 1],
                    (err) => {
                        if (!err) console.log(`✅ Supplier created: ${supplier.name}`);
                    }
                );
            });
        }
    });

    // Create sample products
    db.get('SELECT COUNT(*) as count FROM products', (err, result) => {
        if (result.count === 0) {
            const products = [
                { code: 'PRD-2026-000001', name: 'Coca Cola 500ml', barcode: '1234567890001', categoryId: 3, costPrice: 0.40, sellingPrice: 1.50, reorderLevel: 50, tax: 0.15 },
                { code: 'PRD-2026-000002', name: 'Milk 1L', barcode: '1234567890002', categoryId: 5, costPrice: 0.80, sellingPrice: 2.50, reorderLevel: 30, tax: 0.05 },
                { code: 'PRD-2026-000003', name: 'Bread Loaf', barcode: '1234567890003', categoryId: 6, costPrice: 0.50, sellingPrice: 1.75, reorderLevel: 25, tax: 0.10 },
                { code: 'PRD-2026-000004', name: 'Rice 5kg', barcode: '1234567890004', categoryId: 2, costPrice: 3.00, sellingPrice: 8.50, reorderLevel: 15, tax: 0.03 },
                { code: 'PRD-2026-000005', name: 'Chicken Breast 1kg', barcode: '1234567890005', categoryId: 7, costPrice: 4.50, sellingPrice: 12.00, reorderLevel: 20, tax: 0.15 },
                { code: 'PRD-2026-000006', name: 'Cheese 500g', barcode: '1234567890006', categoryId: 5, costPrice: 2.50, sellingPrice: 7.99, reorderLevel: 10, tax: 0.10 },
                { code: 'PRD-2026-000007', name: 'Orange Juice 1L', barcode: '1234567890007', categoryId: 3, costPrice: 0.60, sellingPrice: 2.25, reorderLevel: 40, tax: 0.12 },
                { code: 'PRD-2026-000008', name: 'T-Shirt XL', barcode: '1234567890008', categoryId: 8, costPrice: 3.00, sellingPrice: 12.50, reorderLevel: 20, tax: 0.15 },
                { code: 'PRD-2026-000009', name: 'Pasta 500g', barcode: '1234567890009', categoryId: 2, costPrice: 0.45, sellingPrice: 1.50, reorderLevel: 50, tax: 0.08 },
                { code: 'PRD-2026-000010', name: 'Butter 250g', barcode: '1234567890010', categoryId: 5, costPrice: 1.20, sellingPrice: 3.99, reorderLevel: 15, tax: 0.05 }
            ];

            // Get category IDs first
            db.all('SELECT id, name FROM categories LIMIT 10', (err, categories) => {
                const categoryMap = {};
                categories.forEach(cat => {
                    categoryMap[cat.name.toLowerCase()] = cat.id;
                });

                products.forEach(product => {
                    const categoryId = categoryMap['beverages'] || 1; // default to first category

                    db.run(
                        `INSERT INTO products (code, name, barcode, category_id, cost_price, selling_price, reorder_level, tax_rate, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [product.code, product.name, product.barcode, product.categoryId, product.costPrice, product.sellingPrice, product.reorderLevel, product.tax, 'active'],
                        function (err) {
                            if (!err) {
                                // Initialize stock for this product
                                db.run(
                                    `INSERT INTO stock (product_id, current_qty) VALUES (?, ?)`,
                                    [this.lastID, product.reorderLevel * 2],
                                    (err) => {
                                        if (!err) console.log(`✅ Product created: ${product.name} (${product.code})`);
                                    }
                                );
                            }
                        }
                    );
                });
            });
        }
    });

    // Create default settings
    db.get('SELECT COUNT(*) as count FROM settings WHERE key = ?', ['admin_phone'], (err, result) => {
        if (result && result.count === 0) {
            const settings = [
                { key: 'admin_phone', value: '+94771234567', description: 'Admin phone for alerts' },
                { key: 'admin_email', value: 'admin@possystem.local', description: 'Admin email for reports' },
                { key: 'sms_gateway', value: 'twilio', description: 'SMS gateway provider' },
                { key: 'alert_time', value: '21:00', description: 'Daily report send time' },
                { key: 'low_stock_threshold', value: 'reorder_level', description: 'Alert trigger level' }
            ];

            settings.forEach(setting => {
                db.run(
                    `INSERT INTO settings (key, value, description) VALUES (?, ?, ?)`,
                    [setting.key, setting.value, setting.description],
                    (err) => {
                        if (!err) console.log(`✅ Setting created: ${setting.key}`);
                    }
                );
            });
        }
    });

    // Close database after a short delay
    setTimeout(() => {
        db.close((err) => {
            if (err) console.error('Error closing database:', err);
            else console.log('\n🎉 Database seeding completed successfully!\n');
        });
    }, 1000);
});
