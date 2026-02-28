const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'src', 'pos.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Update some products to active status
  db.run('UPDATE products SET status = "active" WHERE id IN (1, 2, 3, 4, 5)');
  
  // Update some stock quantities
  db.run('UPDATE stock SET current_qty = 100 WHERE product_id = 1');
  db.run('UPDATE stock SET current_qty = 50 WHERE product_id = 2');
  db.run('UPDATE stock SET current_qty = 75 WHERE product_id = 3');
  db.run('UPDATE stock SET current_qty = 30 WHERE product_id = 4');
  db.run('UPDATE stock SET current_qty = 200 WHERE product_id = 5');

  console.log('Updated products to active status and added stock quantities.');
});

setTimeout(() => {
  db.close();
  console.log('Database connection closed.');
}, 1000);