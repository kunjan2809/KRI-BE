const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Function to load and parse YAML file
const loadYamlFile = (filePath) => {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return yaml.load(fileContent);
  } catch (error) {
    console.error(`Error loading YAML file ${filePath}:`, error);
    return {};
  }
};

// Load all YAML documentation files
const schemas = loadYamlFile(path.join(__dirname, '../docs/schemas.yaml'));
const authEndpoints = loadYamlFile(path.join(__dirname, '../docs/auth-endpoints.yaml'));
const orderEndpoints = loadYamlFile(path.join(__dirname, '../docs/order-endpoints.yaml'));
const productEndpoints = loadYamlFile(path.join(__dirname, '../docs/product-endpoints.yaml'));
const reviewEndpoints = loadYamlFile(path.join(__dirname, '../docs/review-endpoints.yaml'));
const imageEndpoints = loadYamlFile(path.join(__dirname, '../docs/image-endpoints.yaml'));
const userEndpoints = loadYamlFile(path.join(__dirname, '../docs/user-endpoints.yaml'));
const analyticsEndpoints = loadYamlFile(path.join(__dirname, '../docs/analytics-endpoints.yaml'));
const categoryEndpoints = loadYamlFile(path.join(__dirname, '../docs/category-endpoints.yaml'));
const leadEndpoints = loadYamlFile(path.join(__dirname, '../docs/lead-endpoints.yaml'));
const cartEndpoints = loadYamlFile(path.join(__dirname, '../docs/cart-endpoints.yaml'));
const wishlistEndpoints = loadYamlFile(path.join(__dirname, '../docs/wishlist-endpoints.yaml'));

// Merge all documentation into a single Swagger spec
const swaggerSpec = {
  ...authEndpoints,
           components: {
           ...authEndpoints.components,
           schemas: {
             ...schemas,
             ...authEndpoints.components?.schemas,
             ...orderEndpoints.components?.schemas,
             ...productEndpoints.components?.schemas,
             ...reviewEndpoints.components?.schemas,
             ...imageEndpoints.components?.schemas,
             ...userEndpoints.components?.schemas,
             ...analyticsEndpoints.components?.schemas,
             ...categoryEndpoints.components?.schemas,
             ...leadEndpoints.components?.schemas,
             ...cartEndpoints.components?.schemas,
             ...wishlistEndpoints.components?.schemas
           }
         },
           paths: {
           ...authEndpoints.paths,
           ...orderEndpoints.paths,
           ...productEndpoints.paths,
           ...reviewEndpoints.paths,
           ...imageEndpoints.paths,
           ...userEndpoints.paths,
           ...analyticsEndpoints.paths,
           ...categoryEndpoints.paths,
           ...leadEndpoints.paths,
           ...cartEndpoints.paths,
           ...wishlistEndpoints.paths
         },
           tags: [
           ...(authEndpoints.tags || []),
           ...(orderEndpoints.tags || []),
           ...(productEndpoints.tags || []),
           ...(reviewEndpoints.tags || []),
           ...(imageEndpoints.tags || []),
           ...(userEndpoints.tags || []),
           ...(analyticsEndpoints.tags || []),
           ...(categoryEndpoints.tags || []),
           ...(leadEndpoints.tags || []),
           ...(cartEndpoints.tags || []),
           ...(wishlistEndpoints.tags || [])
         ]
};

module.exports = swaggerSpec; 