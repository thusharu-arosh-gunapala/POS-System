const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initialize, seedData } = require('./db');
const dbUtils = require('./dbUtils');

let mainWindow;
let currentUser = null;
let currentSession = null;

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  initialize();
  seedData();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ========== AUTH IPC HANDLERS ==========
ipcMain.handle('auth:login', async (event, username, password) => {
  try {
    console.log('[AUTH] login attempt for:', username);
    const user = await dbUtils.findUserByUsername(username);
    console.log('[AUTH] db returned user:', !!user, user && { id: user.id, username: user.username, is_active: user.is_active });
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    const pwdOk = dbUtils.verifyPassword(password, user.password_hash);
    console.log('[AUTH] password valid:', pwdOk);
    if (!pwdOk) {
      return { success: false, error: 'Invalid password' };
    }

    if (!user.is_active) {
      return { success: false, error: 'User account is inactive' };
    }

    const sessionId = await dbUtils.createSession(user.id);
    currentUser = user;
    currentSession = sessionId;

    await dbUtils.recordAuditLog(user.id, 'LOGIN', 'users', user.id, null, null, null);

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role_id
      },
      sessionId
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:logout', async (event) => {
  try {
    if (currentSession) {
      await dbUtils.endSession(currentSession);
    }
    if (currentUser) {
      await dbUtils.recordAuditLog(currentUser.id, 'LOGOUT', 'users', currentUser.id, null, null, null);
    }
    currentUser = null;
    currentSession = null;
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:getCurrentUser', async (event) => {
  return currentUser ? {
    id: currentUser.id,
    username: currentUser.username,
    email: currentUser.email,
    role: currentUser.role_id,
    phone: currentUser.phone
  } : null;
});

// ========== USER MANAGEMENT IPC HANDLERS ==========
ipcMain.handle('users:getAll', async (event) => {
  try {
    const users = await dbUtils.getAllUsers();
    return { success: true, data: users };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('users:create', async (event, username, password, email, phone, roleId) => {
  try {
    if (!currentUser || currentUser.role_id !== 1) {
      return { success: false, error: 'Only admins can create users' };
    }
    
    const userId = await dbUtils.createUser(username, password, email, phone, roleId);
    await dbUtils.recordAuditLog(currentUser.id, 'CREATE_USER', 'users', userId, null, JSON.stringify({ username, email, phone, roleId }), null);
    
    return { success: true, userId };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ========== PRODUCT IPC HANDLERS ==========
ipcMain.handle('products:getAll', async (event) => {
  try {
    const products = await dbUtils.getAllProducts();
    return { success: true, data: products };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('products:searchByBarcode', async (event, barcode) => {
  try {
    const product = await dbUtils.getProductByBarcode(barcode);
    return { success: true, data: product };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('products:searchByCode', async (event, code) => {
  try {
    const product = await dbUtils.getProductByCode(code);
    return { success: true, data: product };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('products:create', async (event, productData) => {
  try {
    if (!currentUser || currentUser.role_id !== 1) {
      return { success: false, error: 'Only admins can create products' };
    }

    const code = await dbUtils.generateProductCode();
    const productId = await dbUtils.createProduct(
      code,
      productData.name,
      productData.barcode,
      productData.categoryId,
      productData.brand,
      productData.costPrice,
      productData.sellingPrice,
      productData.reorderLevel,
      productData.supplierId,
      productData.taxRate,
      productData.status || 'active',
      productData.metadata || {}
    );

    await dbUtils.recordAuditLog(currentUser.id, 'CREATE_PRODUCT', 'products', productId, null, JSON.stringify(productData), null);

    return { success: true, productId, code };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('products:update', async (event, productId, productData) => {
  try {
    if (!currentUser || currentUser.role_id !== 1) {
      return { success: false, error: 'Only admins can update products' };
    }
    const changes = await dbUtils.updateProduct(productId, productData);
    await dbUtils.recordAuditLog(currentUser.id, 'UPDATE_PRODUCT', 'products', productId, null, JSON.stringify(productData), null);
    return { success: true, changes };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('products:delete', async (event, productId) => {
  try {
    if (!currentUser || currentUser.role_id !== 1) {
      return { success: false, error: 'Only admins can delete products' };
    }
    const changes = await dbUtils.setProductInactive(productId);
    await dbUtils.recordAuditLog(currentUser.id, 'DELETE_PRODUCT', 'products', productId, null, null, null);
    return { success: true, changes };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ========== CATEGORY IPC HANDLERS ==========
ipcMain.handle('categories:getAll', async (event) => {
  try {
    const cats = await dbUtils.getAllCategories();
    return { success: true, data: cats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('categories:create', async (event, name) => {
  try {
    if (!currentUser || currentUser.role_id !== 1) {
      return { success: false, error: 'Only admins can create categories' };
    }
    const id = await dbUtils.createCategory(name);
    await dbUtils.recordAuditLog(currentUser.id, 'CREATE_CATEGORY', 'categories', id, null, JSON.stringify({ name }), null);
    return { success: true, id };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ========== STOCK IPC HANDLERS ==========
ipcMain.handle('stock:getProductStock', async (event, productId) => {
  try {
    const qty = await dbUtils.getProductStock(productId);
    return { success: true, quantity: qty };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stock:updateStock', async (event, productId, quantity, type, note) => {
  try {
    if (!currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    await dbUtils.updateStock(productId, quantity);
    await dbUtils.recordStockMovement(productId, type, quantity, null, null, note, currentUser.id);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ========== SALES IPC HANDLERS ==========
ipcMain.handle('sales:generateBillNo', async (event) => {
  try {
    const date = new Date();
    const dateStr = date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0');
    return { success: true, billNo: `BILL-${dateStr}-${Math.floor(Math.random() * 10000)}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ========== DASHBOARD IPC HANDLERS ==========
ipcMain.handle('dashboard:getData', async (event) => {
  try {
    const data = await dbUtils.getDashboardData();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ========== SUPPLIER IPC HANDLERS ==========
ipcMain.handle('suppliers:getAll', async () => {
  try {
    const data = await dbUtils.getAllSuppliers();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('suppliers:create', async (event, supplier) => {
  try {
    const id = await dbUtils.createSupplier(supplier.name, supplier.contact_person, supplier.phone, supplier.email, supplier.address);
    await dbUtils.recordAuditLog(currentUser?.id, 'CREATE_SUPPLIER', 'suppliers', id, null, JSON.stringify(supplier), null);
    return { success: true, id };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('suppliers:update', async (event, id, supplier) => {
  try {
    const changes = await dbUtils.updateSupplier(id, supplier);
    await dbUtils.recordAuditLog(currentUser?.id, 'UPDATE_SUPPLIER', 'suppliers', id, null, JSON.stringify(supplier), null);
    return { success: true, changes };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('suppliers:deactivate', async (event, id) => {
  try {
    const changes = await dbUtils.setSupplierInactive(id);
    await dbUtils.recordAuditLog(currentUser?.id, 'DEACTIVATE_SUPPLIER', 'suppliers', id, null, null, null);
    return { success: true, changes };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ========== SALES/AUDIT/SETTINGS IPC HANDLERS ==========
ipcMain.handle('sales:getAll', async () => {
  try {
    const data = await dbUtils.getAllSales();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('audit:getAll', async () => {
  try {
    const data = await dbUtils.getAllAuditLogs();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('settings:get', async (event, key) => {
  try {
    const value = await dbUtils.getSetting(key);
    return { success: true, value };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('settings:getAll', async () => {
  try {
    const data = await dbUtils.getAllSettings();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('settings:set', async (event, key, value, description) => {
  try {
    if (!currentUser || currentUser.role_id !== 1) {
      return { success: false, error: 'Only admins can change settings' };
    }

    await dbUtils.setSetting(key, value, description);
    await dbUtils.recordAuditLog(currentUser.id, 'UPDATE_SETTING', 'settings', null, null, JSON.stringify({ key, value }), null);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
