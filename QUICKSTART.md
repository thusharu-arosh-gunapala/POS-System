## 🚀 Quick Start Guide - POS System

### 📋 Prerequisites
- Node.js 16+ (check with `node -v`)
- npm (included with Node.js)

### ⚡ 30-Second Setup

```bash
# Terminal 1: Start the application
npm start
```

That's it! The app should launch with a login window.

---

## 🔑 Default Login Credentials

```
Username: admin
Password: admin123
Role: Administrator
```

**⚠️ IMPORTANT**: Change the password immediately after first login!

---

## 🎯 First Steps After Login

### As Admin (Owner)
1. **View Dashboard** - See today's sales metrics
2. **Add Products** - Click "Products" → "Add Product"
3. **Create Cashier Account** - Click "Users" → "Add User"
4. **Configure Settings** - Settings tab for SMS/Email setup

### As Cashier
1. **Start Billing** - Automatically shown on login
2. **Scan Products** - Click search, scan barcode or type code
3. **Add to Cart** - Click product to add
4. **Checkout** - Select payment method → Complete Sale

---

## 🛒 Sample Product Barcodes

If you used the seed data, these barcodes are pre-loaded:

| Product | Barcode |
|---------|---------|
| Coca Cola 500ml | 1234567890001 |
| Milk 1L | 1234567890002 |
| Bread Loaf | 1234567890003 |
| Rice 5kg | 1234567890004 |
| Chicken Breast 1kg | 1234567890005 |

Try scanning these in the billing screen!

---

## 🧪 Testing Workflow

### Scenario 1: Simple Sale
1. Login as **admin**
2. Click **"Billing"** (in sidebar)
3. Type barcode `1234567890001` in search
4. Click the item (it adds to cart)
5. Click **"Complete Sale"** → Select payment → Done!

### Scenario 2: Create User & Login
1. Login as **admin**
2. Go to **"Users"** → **"Add User"**
3. Create: username `cashier1`, password `test123`, role **Cashier**
4. Logout
5. Login with `cashier1 / test123`
6. See billing screen only (limited access)

### Scenario 3: Add New Product
1. Login as **admin**
2. Go to **"Products"** → **"Add Product"**
3. Fill in:
   - Name: `Test Product`
   - Barcode: `9999999999999`
   - Cost: `5.00`
   - Price: `14.99`
   - Reorder Level: `10`
4. Click **"Create Product"**
5. New product appears in list with auto-generated code

---

## 📊 UI Navigation

```
┌─────────────────────────────────────────┐
│  POS System    User: admin [Admin] [X]  │
├──────────────┬────────────────────────┤
│ ▶ Dashboard  │                        │
│ ▶ Products   │  Main Content Area     │
│ ▶ Inventory  │  (changes based on     │
│ ▶ Sales      │   selected menu item)  │
│ ▶ Reports    │                        │
│ ▶ Users      │                        │
│ ▶ Audit Logs │                        │
│ ▶ Settings   │                        │
└──────────────┴────────────────────────┘
```

---

## 🎨 Color Scheme

- **Gold Accent** (#d4af37) - Premium feel
- **Dark Blue Background** - Easy on eyes
- **White Text** - High contrast
- **Success Green** - Approved actions
- **Danger Red** - Destructive actions

---

## 📱 Hardware Testing

### Barcode Scanner
- Just plug in USB barcode scanner
- Makes the search field active
- Type barcode, scanner auto-appends newline
- Product adds to cart automatically

### Thermal Printer
- Configure in **Settings** → **Printer Setup**
- "Complete Sale" shows print dialog
- Select printer, print receipt

### Cash Drawer
- Connects via RJ11
- Opens automatically after payment
- Configure port in **Settings**

---

## 🐛 Troubleshooting

### App Won't Start
```bash
# 1. Check Node.js
node -v

# 2. Reinstall dependencies
rm -rf node_modules
npm install

# 3. Start again
npm start
```

### Database Issues
```bash
# 1. Delete old database
rm pos.db

# 2. Run app (creates fresh DB + seed data)
npm start
```

### Blank Screen
```bash
# Open developer console
Press: Ctrl + Shift + I

# Check for errors in Console tab
```

### Can't Login
- Verify you typed `admin` and `admin123` exactly
- Check database file exists (`pos.db` in project root)
- Try resetting: delete `pos.db` and restart app

---

## 📚 File Locations

```
POS-System/
├── src/
│   ├── main.js           ← App launcher & IPC handlers
│   ├── renderer.js       ← UI interaction logic
│   ├── db.js             ← Database schema
│   ├── dbUtils.js        ← Database functions
│   ├── index.html        ← UI layout
│   └── styles.css        ← Styling
├── pos.db                ← Your data (SQLite file)
└── README.md             ← Full documentation
```

---

## 🔄 Workflow Example: Complete a Sale

```
1. Admin Creates Products
   ├── Dashboard → Click "Products"
   ├── Click "Add Product"
   ├── Fill Name, Barcode, Price
   └── Click "Create Product"

2. Admin Creates Cashier User
   ├── Dashboard → Click "Users"
   ├── Click "Add User"
   ├── Username: cashier1, Password: pass123, Role: Cashier
   └── Click "Create User"

3. Cashier Logs In
   ├── Window opens → Login with cashier1/pass123
   ├── Automatically shows "Billing" screen
   └── Cart is empty, ready for scan

4. Cashier Scans & Sells
   ├── Scan barcode or type product code
   ├── Item adds to shopping cart
   ├── Adjust quantity if needed
   ├── Select payment method (Cash/Card/QR)
   └── Click "Complete Sale"

5. Admin Reviews
   ├── Logout cashier
   ├── Login as admin
   ├── Go to "Sales" to see transaction
   ├── Go to "Inventory" to verify stock decreased
   ├── Check "Audit Logs" for who did what
   └── View "Reports" for daily summary
```

---

## 🔐 Security Notes

- **Never share default password** with anyone
- Always **change `admin123`** immediately
- **Cashiers can't** see price/cost details
- **Admins can't be created by cashiers**
- All actions logged with username & timestamp

---

## ⏰ Tips & Tricks

- **Fast barcode scanning**: Search field auto-focuses
- **Quick logout**: Click logout button in header (top right)
- **Edit quantities**: Use +/- buttons in cart
- **Remove item**: Click red "Remove" button
- **Cancel sale**: Click red "Cancel" button (empties cart)
- **View stock**: Products table shows in-stock quantities

---

## 📞 Common Questions

**Q: How do I print receipts?**
A: After clicking "Complete Sale", a print dialog appears. Select your thermal printer.

**Q: Can I use barcode scanner without special drivers?**
A: Yes! USB scanners work as keyboard input. Just plug and scan.

**Q: How do I add multiple products quickly?**
A: Scan each one rapidly. Each scan adds or increases quantity.

**Q: What if I make a mistake in a sale?**
A: Click "Cancel" to clear cart and start over. Never delete completed sales (audit trail).

**Q: How do I see other users' sales?**
A: Go to "Sales" or "Reports". Only your own summary visible as cashier.

---

## 🎓 Next Learning Steps

1. Read [README.md](README.md) for detailed feature documentation
2. Explore the Settings screen
3. Check "Audit Logs" to understand action tracking
4. Try creating a sale and reviewing it in reports

---

## 🚀 You're Ready!

Everything is set up and working. Start by:
1. Creating a few test cashiers
2. Adding some products
3. Processing test sales
4. Reviewing the reports

Enjoy your Premium POS System! 🎉

---

**Version**: 1.0.0  
**Last Updated**: February 2026
