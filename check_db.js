const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'src', 'pos.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Check active products with stock
  db.all("SELECT p.name, p.code, s.current_qty, p.status FROM products p LEFT JOIN stock s ON p.id = s.product_id WHERE p.status = 'active' LIMIT 10", (err, rows) => {
    if (err) console.error('Error fetching active products:', err);
    else {
      console.log('Active products with stock:');
      rows.forEach(row => console.log('- ' + row.name + ' (' + row.code + '): ' + row.current_qty + ' units'));
    }
  });
});

setTimeout(() => {
  db.close();
}, 1000);