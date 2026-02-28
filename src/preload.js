const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Auth
  login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),

  // Users
  getAllUsers: () => ipcRenderer.invoke('users:getAll'),
  createUser: (username, password, email, phone, roleId) => 
    ipcRenderer.invoke('users:create', username, password, email, phone, roleId),

  // Products
  getAllProducts: () => ipcRenderer.invoke('products:getAll'),
  searchProductByBarcode: (barcode) => ipcRenderer.invoke('products:searchByBarcode', barcode),
  searchProductByCode: (code) => ipcRenderer.invoke('products:searchByCode', code),
  createProduct: (productData) => ipcRenderer.invoke('products:create', productData),
  updateProduct: (id, productData) => ipcRenderer.invoke('products:update', id, productData),
  deleteProduct: (id) => ipcRenderer.invoke('products:delete', id),

  // Stock
  getProductStock: (productId) => ipcRenderer.invoke('stock:getProductStock', productId),
  updateStock: (productId, quantity, type, note) => 
    ipcRenderer.invoke('stock:updateStock', productId, quantity, type, note),

  // Categories
  getCategories: () => ipcRenderer.invoke('categories:getAll'),
  createCategory: (name) => ipcRenderer.invoke('categories:create', name),

  // Sales
  generateBillNo: () => ipcRenderer.invoke('sales:generateBillNo'),
  // Dashboard
  getDashboardData: () => ipcRenderer.invoke('dashboard:getData'),
  getAllAlerts: () => ipcRenderer.invoke('alerts:getAll'),

  // Suppliers
  getAllSuppliers: () => ipcRenderer.invoke('suppliers:getAll'),
  createSupplier: (sup) => ipcRenderer.invoke('suppliers:create', sup),
  updateSupplier: (id, sup) => ipcRenderer.invoke('suppliers:update', id, sup),
  deactivateSupplier: (id) => ipcRenderer.invoke('suppliers:deactivate', id),

  // Sales / Audit / Settings
  getAllSales: () => ipcRenderer.invoke('sales:getAll'),
  getSaleById: (saleId) => ipcRenderer.invoke('sales:getById', saleId),
  getSaleItems: (saleId) => ipcRenderer.invoke('sales:getItems', saleId),
  getAllAuditLogs: () => ipcRenderer.invoke('audit:getAll'),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),
  
  // Stock Management
  updateStock: (productId, quantityChange, reason) => ipcRenderer.invoke('stock:update', productId, quantityChange, reason),
  getStockMovements: (productId) => ipcRenderer.invoke('stock:getMovements', productId),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value, description) => ipcRenderer.invoke('settings:set', key, value, description)
});
