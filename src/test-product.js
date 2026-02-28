const dbUtils = require('./dbUtils');
const { initialize } = require('./db');

// ensure database schema is prepared (adds missing columns)
initialize();

async function runTest() {
    try {
        console.log('Fetching categories...');
        const cats = await dbUtils.getAllCategories();
        console.log('Categories:', cats);

        console.log('Creating temp category...');
        const newCatId = await dbUtils.createCategory('TestCat_' + Date.now());
        console.log('Created category id', newCatId);

        console.log('Generating product code...');
        const code = await dbUtils.generateProductCode();
        console.log('Code:', code);

        console.log('Creating product using new enhanced form fields...');
        const prodId = await dbUtils.createProduct(
            code,
            'Test Product ' + Date.now(),
            'BC' + Date.now(),
            newCatId,
            'TestBrand',
            1.23,
            2.34,
            5,
            null,
            0.0,
            'active',
            { sampleFlag: true }
        );
        console.log('Created product id', prodId);

        let prod = await dbUtils.getProductByCode(code);
        console.log('Retrieved product record:', prod);

        console.log('Updating product name and price...');
        await dbUtils.updateProduct(prodId, {
            ...prod,
            name: prod.name + ' (Updated)',
            sellingPrice: 3.00,
            metadata: { ...prod.metadata, updated: true }
        });
        prod = await dbUtils.getProductByCode(code);
        console.log('After update:', prod);

        console.log('Setting product inactive...');
        await dbUtils.setProductInactive(prodId);
        const prod2 = await dbUtils.getProductByCode(code);
        console.log('Fetch after inactive (should still return or null):', prod2);
    } catch (err) {
        console.error('Test error:', err);
    }
}

runTest();
