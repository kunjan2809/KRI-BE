# Swagger API Documentation

## 🚀 **Overview**

This project now includes comprehensive Swagger/OpenAPI 3.0 documentation for all authentication APIs. The documentation provides detailed information about request/response schemas, examples, and authentication requirements.

## 📍 **Accessing the Documentation**

Once your server is running, you can access the Swagger documentation at:

```
http://localhost:5000/api-docs
```

## 🔧 **What's Documented**

### **1. Authentication APIs**
- **POST /api/auth/signup** - User registration
- **POST /api/auth/login** - User login
- **POST /api/auth/forget-password** - Request password reset
- **POST /api/auth/reset-password** - Reset password with token
- **GET /api/auth/profile** - Get user profile (protected)

### **2. Product Management APIs**
- **GET /api/products/admin/all** - Get all products with filters (Admin only)
- **POST /api/products/admin/add** - Add new product (Admin only)
- **PUT /api/products/admin/edit/{productId}** - Edit product (Admin only)
- **DELETE /api/products/admin/delete/{productId}** - Soft delete product (Admin only)
- **GET /api/products/admin/details/{productId}** - Get product details with sold count (Admin only)

### **3. Product Review APIs**
- **GET /api/reviews/product/{productId}** - Get all reviews for a product
- **POST /api/reviews/product/{productId}** - Create new review
- **PUT /api/reviews/{reviewId}** - Update review
- **DELETE /api/reviews/{reviewId}** - Delete review
- **GET /api/reviews/user** - Get user's reviews

### **4. Image Management APIs**
- **POST /api/images/product/{productId}** - Upload product image
- **DELETE /api/images/product/{imageId}** - Delete product image
- **PUT /api/images/product/{imageId}** - Update product image properties
- **POST /api/images/review/{reviewId}** - Upload review image
- **DELETE /api/images/review/{imageId}** - Delete review image

## 📋 **Documentation Features**

### **Complete Schema Definitions**
- **User Schema** - Complete user object structure
- **Request Schemas** - All input validation requirements
- **Response Schemas** - All possible response formats
- **Error Schemas** - Comprehensive error handling

### **Real Examples**
- **Request Examples** - Sample request bodies for testing
- **Response Examples** - Sample responses for each endpoint
- **Error Examples** - Common error scenarios and responses

### **Authentication Details**
- **JWT Bearer Token** - Security scheme documentation
- **Role-Based Access** - Clear explanation of user vs admin access
- **Protected Routes** - Clear indication of which routes require authentication

## 🎯 **How to Use the Documentation**

### **1. Testing APIs Directly**
1. Open the Swagger UI at `/api-docs`
2. Click on any endpoint to expand it
3. Click "Try it out" button
4. Fill in the required parameters
5. Click "Execute" to test the API

### **2. Understanding Request/Response**
- **Request Body**: See exactly what fields are required and their types
- **Response Codes**: Understand all possible HTTP status codes
- **Examples**: Use the provided examples as templates

### **3. Authentication Testing**
1. First use the `/signup` or `/login` endpoint to get a JWT token
2. Copy the token from the response
3. Click the "Authorize" button at the top of the Swagger UI
4. Enter your token as `Bearer <your-token>`
5. Now test protected endpoints

## 🔐 **Security Schemes**

### **Bearer Authentication**
```yaml
type: http
scheme: bearer
bearerFormat: JWT
```

### **Usage in Protected Routes**
All protected routes show a lock icon and require the Bearer token in the Authorization header.

## 📊 **Schema References**

The documentation uses OpenAPI 3.0 schema references for consistency:

- `#/components/schemas/User` - User object structure
- `#/components/schemas/UserRegistrationRequest` - Signup request
- `#/components/schemas/UserLoginRequest` - Login request
- `#/components/schemas/ForgetPasswordRequest` - Password reset request
- `#/components/schemas/ResetPasswordRequest` - Password reset with token
- `#/components/schemas/AuthSuccessResponse` - Authentication success response
- `#/components/schemas/ProfileResponse` - Profile response
- `#/components/schemas/ErrorResponse` - Error response format

## 🧪 **Testing Scenarios**

### **User Registration Flow**
1. Test `/signup` with valid data
2. Verify response contains user info and JWT token
3. Test with duplicate email (should return 400)
4. Test with invalid data (should return 400)

### **User Login Flow**
1. Test `/login` with valid credentials
2. Verify response contains user info and JWT token
3. Test with invalid credentials (should return 401)
4. Test with missing fields (should return 400)

### **Password Reset Flow**
1. Test `/forget-password` with valid email
2. Check email for reset token
3. Test `/reset-password` with token and new password
4. Verify password was changed

### **Protected Routes Testing**
1. Test `/profile` without token (should return 401)
2. Test `/profile` with valid token (should return 200)
3. Test `/example/admin-content` with regular user (should return 403)
4. Test `/example/admin-content` with admin user (should return 200)

## 🛠 **Customization Options**

### **Swagger UI Customization**
The Swagger UI is configured with:
- Custom site title: "E-Commerce Authentication API Documentation"
- Hidden topbar for cleaner appearance
- Custom CSS styling

### **Adding New Endpoints**
To document new endpoints:
1. Add JSDoc comments above your route handlers
2. Use the `@swagger` annotation
3. Reference existing schemas where possible
4. Include examples for better understanding

## 📝 **Example JSDoc Format**

```javascript
/**
 * @swagger
 * /api/endpoint:
 *   method:
 *     summary: Brief description
 *     description: Detailed description
 *     tags: [TagName]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SchemaName'
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResponseSchema'
 */
```

## 🚨 **Important Notes**

1. **Environment Variables**: Make sure your server is configured with proper environment variables
2. **Database Connection**: Ensure MongoDB is running for full functionality
3. **Email Configuration**: Password reset emails require proper email service setup
4. **JWT Secret**: Change the default JWT secret in production

## 🔍 **Troubleshooting**

### **Swagger UI Not Loading**
- Check if `swagger-jsdoc` and `swagger-ui-express` are installed
- Verify the swagger configuration file path
- Check console for any JavaScript errors

### **Schemas Not Displaying**
- Ensure JSDoc comments are properly formatted
- Check that file paths in swagger config are correct
- Verify OpenAPI 3.0 syntax compliance

### **Authentication Issues**
- Verify JWT token format (Bearer <token>)
- Check if token is expired
- Ensure user exists in database

## 📚 **Additional Resources**

- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Swagger JSDoc Documentation](https://github.com/Surnet/swagger-jsdoc)
- [Swagger UI Express Documentation](https://github.com/scottie1984/swagger-ui-express)

---

**The Swagger documentation is now fully integrated and ready to use!** 🎉 