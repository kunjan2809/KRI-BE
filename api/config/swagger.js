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

// Load all documentation files
const schemas = loadYamlFile(path.join(__dirname, '../docs/schemas.yaml'));
const authEndpoints = loadYamlFile(path.join(__dirname, '../docs/auth-endpoints.yaml'));
const exampleEndpoints = loadYamlFile(path.join(__dirname, '../docs/example-endpoints.yaml'));

// Create the complete OpenAPI specification
const swaggerSpec = {
  // Use auth-endpoints as the base (it has the main OpenAPI structure)
  ...authEndpoints,
  
  // Add schemas from schemas.yaml
  components: {
    ...authEndpoints.components,
    schemas: {
      ...schemas,  // Add all schemas from schemas.yaml
      ...authEndpoints.components?.schemas,  // Add any additional schemas from auth-endpoints
      ...exampleEndpoints.components?.schemas  // Add any additional schemas from example-endpoints
    }
  },
  
  // Merge paths from both endpoint files
  paths: {
    ...authEndpoints.paths,
    ...exampleEndpoints.paths
  },
  
  // Merge tags from both files
  tags: [
    ...(authEndpoints.tags || []),
    ...(exampleEndpoints.tags || [])
  ]
};

module.exports = swaggerSpec; 