# Premium Desktop POS System

A feature-rich, elegant Point of Sale application built with Electron, Node.js, and SQLite. Designed for modern retail businesses requiring offline capability, role-based access, and comprehensive reporting.

## 🎯 Features

### Core Features
- ✅ **Offline-First**: Works without internet connection; syncs when available
- ✅ **Role-Based Access Control**: Admin (owner) and Cashier roles with distinct permissions
- ✅ **Local SQLite Database**: Fast, reliable data storage on disk
- ✅ **Hardware Integration**: Barcode scanner, thermal printer, cash drawer support
- ✅ **Luxury UI/UX**: Dark theme with gold accents, smooth animations
- ✅ **Comprehensive Audit Logging**: Track all critical actions with user/timestamp

### Admin Features
- Product Management (create, edit, stock levels) including a **super-admin multi-tab/step form** capturing brand, suppliers, pricing tiers, discounts, stock behavior and audit metadata; product rows are clickable to view full details and perform edit/delete actions
- Inventory & Stock Control (adjustments, history)
- User Management (create cashier accounts, manage permissions)
- Sales Reports (daily, weekly, monthly with profit analysis)
- Audit Logs (view all system activities)
- Settings (SMS gateway, email, alert thresholds)
- Low Stock Alerts (auto SMS/email to admin)
- Daily Sales Reports (auto-send at configured time)

### Cashier Features
- Fast POS Billing (barcode scanning + manual search)
- Cart Management (add, remove, qty adjustment)
- Multiple Payment Methods (Cash, Card, QR)
- Receipt Printing (thermal printer)
- Daily Summary (personal sales metrics)
- Read-Only Product View

## 📦 Tech Stack

- **Desktop Framework**: Electron (Windows/Mac/Linux)
- **Backend**: Node.js + Express IPC
- **Database**: SQLite3 (local file-based)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Security**: Password hashing (SHA-256), role-based middleware

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ (already installed)
- npm

### Installation

```bash
# Navigate to project directory
cd POS-System

# Install dependencies (if not done)
npm install

# Start the application
npm start
```

The app will open a window with the login screen.

## 🔐 Default Login

To initialize the system with an admin account, first login creates seed data:

```
Username: admin
Password: admin123
Role: Administrator
```

**Important**: Change the default password immediately after first login!

## 📁 Project Structure

```
POS-System/
├── src/
│   ├── main.js              # Electron main process & IPC handlers
│   ├── preload.js           # IPC bridge (secure)
│   ├── renderer.js          # Frontend logic & UI interactions
│   ├── db.js                # SQLite schema & initialization
│   ├── dbUtils.js           # Database utility functions
│   ├── index.html           # Main UI layout
│   └── styles.css           # Premium styling
├── package.json             # Dependencies & scripts
└── pos.db                   # SQLite database (created on first run)
```

## 🗄️ Database Schema

### Core Tables
- `users` - Cashier & admin accounts
- `roles` - Admin, Cashier roles
- `products` - Product catalog with pricing & stock
- `categories` - Product categories
- `suppliers` - Vendor information
- `stock` - Current inventory levels
- `stock_movements` - In/Out/Adjustment history
- `sales` - Bill header & totals
- `sale_items` - Individual line items
- `payments` - Payment method tracking
- `purchases` - Supplier order management
- `purchase_items` - PO line details
- `alerts` - Low stock notifications
- `audit_logs` - User action history
- `settings` - System configuration

## 🎮 User Interface

### Login Screen
- Clean, modern login form
- Username & password authentication
- Error messaging

### Dashboard (Admin)
- Sales summary cards (today's metrics)
- Low stock alerts
- Transaction count
- Revenue display

### Products Module (Admin)
- View all products with code, barcode, pricing
- Add new products (auto-generates code: `PRD-YYYY-000001`)
- Edit/delete functionality
- Stock level visibility

### POS Billing (Cashier)
- **Search Bar**: Scan barcodes or type product code
- **Shopping Cart**: Qty up/down, remove items
- **Bill Summary**: Subtotal, tax, discount, total
- **Payment Methods**: Cash, Card, QR options
- **Receipt Printing**: Send to thermal printer

### Inventory Module (Admin)
- Stock adjustments with notes
- Stock movement history
- Reorder level alerts
- Product performance

### Reports (Admin)
- Daily sales by cashier
- Weekly/monthly aggregates
- Profit analysis (Sales - Cost)
- Low stock inventory
- Product performance metrics

### Users Management (Admin)
- Create cashier accounts
- Assign roles
- Enable/disable users
- View user activity

### Audit Logs (Admin)
- Who did what, when
- Product changes
- Price updates
- Stock adjustments
- Void & refund records
- Login/logout attempts

## 🔌 Hardware Integration

### USB Barcode Scanner
- Plug & play (acts as keyboard)
- Auto-focus to search field on barcode
- No special drivers needed

### Thermal Printer (80mm)
- ESC/POS compatible printers
- Receipt printing via system print dialog
- Custom formatting support

### Cash Drawer
- Standard RJ11 connection
- Opening triggered after successful payment
- Serial port communication

## 🛠️ IPC API Reference

### Authentication (`auth:`)
```javascript
// Login
await window.api.login(username, password)
// Returns: { success, user, sessionId, error }

// Logout
await window.api.logout()

// Get current user
await window.api.getCurrentUser()
```

### Products (`products:`)
```javascript
await window.api.getAllProducts()
await window.api.searchProductByBarcode(barcode)
await window.api.searchProductByCode(code)
await window.api.createProduct(productData)
```

### Stock (`stock:`)
```javascript
await window.api.getProductStock(productId)
await window.api.updateStock(productId, quantity, type, note)
```

### Sales (`sales:`)
```javascript
await window.api.generateBillNo()
```

### Settings (`settings:`)
```javascript
await window.api.getSetting(key)
await window.api.setSetting(key, value, description)
```

## 📧 SMS/Email Setup (Future)

### Supported Gateways
1. **Twilio** (Global)
   - REST API
   - Scheduled messaging support

2. **SMSlenz** (Sri Lanka)
   - Desktop/web API
   - Local delivery

3. **Send.lk** (Sri Lanka)
   - REST endpoint
   - Unicode support (Sinhala)

4. **SMSway.lk** (Sri Lanka)
   - Direct API
   - Bulk SMS support

### Configuration
Settings → SMS Configuration
- API Key
- Sender ID
- Gateway selection
- Alert trigger thresholds

## 🚨 Alert Rules

### Low Stock Alert
- Triggered when: `stock <= reorder_level`
- Sends to: Admin (phone + email)
- Frequency: Once per day per product
- Reset on stock update

### Daily Sales Report
- Scheduled time: 9:00 PM (configurable)
- Recipients: Admin
- Format: PDF email + SMS summary
- Includes: Sales, cash/card breakdown, low stock count

## 🔒 Security Features

- Password hashing (SHA-256)
- IPC context isolation (no node integration in renderer)
- Secure preload bridge
- Audit logging of all critical actions
- Role-based access control
- Session management with login/logout tracking

## 🧪 Testing

### Test Scenarios

1. **Create Test User**
   - Admin login → Users → Add User
   - Create "cashier1" account

2. **Add Test Products**
   - Admin login → Products → Add Product
   - Add 5-10 dummy products with barcodes

3. **Test Billing**
   - Cashier login (cashier1)
   - Scan/search products
   - Complete sale with payment

4. **Verify Data**
   - Check `pos.db` in SQLite browser
   - Confirm stock levels updated
   - Check audit logs

## 📚 Development Guide

### Adding New Features

1. **Database side**:
   - Add table in `db.js` (initialize function)
   - Add utility functions in `dbUtils.js`

2. **IPC side**:
   - Add handler in `main.js` (ipcMain.handle)
   - Export via preload.js

3. **Frontend side**:
   - Add HTML element in `index.html`
   - Add styles in `styles.css`
   - Add JavaScript in `renderer.js`

### Example: Adding a new table
```javascript
// In db.js
db.run(`CREATE TABLE IF NOT EXISTS new_table (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// In dbUtils.js
function createNewRecord(name) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO new_table (name) VALUES (?)', [name], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

// In main.js
ipcMain.handle('newtable:create', async (event, name) => {
    try {
        const id = await dbUtils.createNewRecord(name);
        return { success: true, id };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// In preload.js
createNewRecord: (name) => ipcRenderer.invoke('newtable:create', name),

// In renderer.js
const result = await window.api.createNewRecord(name);
```

## 📦 Packaging & Distribution

### Build as EXE (Windows)
```bash
npm install --save-dev electron-builder

# In package.json:
"build": {
  "appId": "com.pos.system",
  "productName": "POS System",
  "files": ["src/**/*", "node_modules/**/*"],
  "win": {
    "target": ["nsis"]
  }
}

# Then:
npm run dist
```

### Build as DMG (Mac)
```bash
npm run dist
# Creates .dmg installer
```

## 🐛 Troubleshooting

### SQLite errors
- Check `pos.db` file exists in project root
- Ensure sqlite3 npm module is installed
- Run `npm install sqlite3 --build-from-source` if issues persist

### Blank screen
- Check browser console (Ctrl+Shift+I)
- Verify `index.html` path in main.js
- Clear Electron cache: `npm cache clean --force`

### Module not found
- Ensure all files exist in `src/`
- Check require paths (use relative paths)
- Run `npm install` again

## 📞 Support & Contribution

For feature requests, bug reports, or contributions:
1. Create detailed issue description
2. Include error logs
3. Describe expected vs. actual behavior
4. Suggest solution if possible

## 📄 License

This project is provided as-is for retail POS operations.

## 🎓 Next Steps

1. **Customize Branding**
   - Update logo in UI
   - Modify color scheme in styles.css

2. **Add Reports**
   - Implement profit analysis
   - Create PDF export functionality

3. **SMS Integration**
   - Choose SMS gateway
   - Implement scheduler
   - Test alert flows

4. **Printer Integration**
   - Configure printer name
   - Custom receipt format
   - Logo & branding in receipts

5. **Backup & Recovery**
   - Implement database backup
   - Restore from backup feature
   - Cloud sync option (future)

---

**Version**: 1.0.0  
**Last Updated**: February 2026  
**Developed with ❤️ for modern retail businesses**
