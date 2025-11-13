const express = require('express');
const router = express.Router();
const shippingAddressController = require('../controllers/shippingAddressController');
const { auth } = require('../middlewares/auth');

// All shipping address routes require user authentication (accessible to both users and admins)
router.use(auth('user'));

// 1. Create Shipping Address
// POST /api/addresses
router.post('/', shippingAddressController.createAddress);

// 2. Get All Addresses for User
// GET /api/addresses
router.get('/', shippingAddressController.getUserAddresses);

// 3. Get Default Address for User (must be before /:addressId route)
// GET /api/addresses/default
router.get('/default', shippingAddressController.getDefaultAddress);

// 4. Get Address by ID
// GET /api/addresses/:addressId
router.get('/:addressId', shippingAddressController.getAddressById);

// 5. Update Shipping Address
// PUT /api/addresses/:addressId
router.put('/:addressId', shippingAddressController.updateAddress);

// 6. Delete Shipping Address
// DELETE /api/addresses/:addressId
router.delete('/:addressId', shippingAddressController.deleteAddress);

module.exports = router;

