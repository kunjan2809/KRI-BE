# Authentication System Documentation

## Overview
This authentication system provides secure user authentication with JWT tokens and role-based access control for your e-commerce backend.

## Features
- User registration and login
- JWT token-based authentication
- Role-based access control (User/Admin)
- Password reset functionality via email
- Secure password hashing with bcrypt
- Rate limiting protection

## API Endpoints

### Public Routes (No Authentication Required)

#### 1. User Registration
```
POST /api/auth/signup
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "mobile_number": "+1234567890",
  "password": "password123"
}
```

#### 2. User Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### 3. Forget Password
```
POST /api/auth/forget-password
Content-Type: application/json

{
  "email": "john@example.com"
}
```

#### 4. Reset Password
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset_token_from_email",
  "new_password": "newpassword123"
}
```

### Protected Routes (Authentication Required)

#### 5. Get User Profile
```
GET /api/auth/profile
Authorization: Bearer <jwt_token>
```

#### 6. Example Routes (Demonstrating Role-Based Access)

**User Content (accessible to both users and admins):**
```
GET /api/example/user-content
Authorization: Bearer <jwt_token>
```

**Admin Content (accessible only to admins):**
```
GET /api/example/admin-content
Authorization: Bearer <jwt_token>
```

## Middleware Usage

### For User-Only Access (both regular users and admins)
```javascript
const { auth } = require('./middlewares/auth');

router.get('/user-route', auth('user'), (req, res) => {
  // Route accessible to authenticated users
});
```

### For Admin-Only Access
```javascript
router.get('/admin-route', auth('admin'), (req, res) => {
  // Route accessible only to admins
});
```

### For Mixed Access
```javascript
// Route accessible to both users and admins
router.get('/mixed-route', auth('user'), (req, res) => {
  // Both user types can access
});

// Route accessible only to admins
router.get('/admin-only', auth('admin'), (req, res) => {
  // Only admins can access
});
```

## Configuration

Create a `.env` file in your project root with the following variables:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Email Configuration (for password reset)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:3000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/ecommerce

# Server Configuration
PORT=5000
NODE_ENV=development
```

## Database Schema Changes

The User model has been updated with the following new fields:
- `reset_token`: Temporary token for password reset
- `reset_token_expires`: Expiration time for reset token
- `password`: Renamed from `password_hash` for clarity

## Security Features

1. **Password Hashing**: All passwords are hashed using bcrypt with salt rounds of 12
2. **JWT Tokens**: Secure JWT tokens with 7-day expiration
3. **Rate Limiting**: Built-in rate limiting protection
4. **Input Validation**: Comprehensive input validation and sanitization
5. **Secure Headers**: Helmet.js for security headers
6. **CORS Protection**: Configurable CORS settings

## Error Handling

The system provides consistent error responses:
```json
{
  "success": false,
  "message": "Error description"
}
```

## Testing the System

1. **Start your server** with the updated code
2. **Register a new user** using the signup endpoint
3. **Login** to get a JWT token
4. **Test protected routes** using the Authorization header
5. **Test role-based access** by creating both regular users and admin users

## Admin User Creation

To create an admin user, you can either:
1. Manually set `is_admin: true` in the database
2. Create a script to promote users to admin
3. Use the first registered user as admin (modify the signup logic)

## Email Configuration

For password reset emails to work:
1. Configure your email service (Gmail, SendGrid, etc.)
2. Set the appropriate environment variables
3. For Gmail, use an App Password instead of your regular password

## Production Considerations

1. **Change JWT_SECRET** to a strong, unique secret
2. **Use environment variables** for all configuration
3. **Set up proper email service** (SendGrid, AWS SES, etc.)
4. **Enable HTTPS** for production
5. **Set up proper logging** and monitoring
6. **Regular security audits** of the authentication system 