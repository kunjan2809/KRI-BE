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
const imageEndpoints = loadYamlFile(path.join(__dirname, '../docs/image-endpoints.yaml'));
const userEndpoints = loadYamlFile(path.join(__dirname, '../docs/user-endpoints.yaml'));
const analyticsEndpoints = loadYamlFile(path.join(__dirname, '../docs/analytics-endpoints.yaml'));

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
             ...imageEndpoints.components?.schemas,
             ...userEndpoints.components?.schemas,
             ...analyticsEndpoints.components?.schemas
           }
         },
           paths: {
           ...authEndpoints.paths,
           ...orderEndpoints.paths,
           ...productEndpoints.paths,
           ...imageEndpoints.paths,
           ...userEndpoints.paths,
           ...analyticsEndpoints.paths
         },
           tags: [
           ...(authEndpoints.tags || []),
           ...(orderEndpoints.tags || []),
           ...(productEndpoints.tags || []),
           ...(imageEndpoints.tags || []),
           ...(userEndpoints.tags || []),
           ...(analyticsEndpoints.tags || [])
         ]
};

module.exports = swaggerSpec; 