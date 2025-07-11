// Environment-specific application configuration for development and production.
// Provides CORS settings and other app-level configuration based on NODE_ENV.

// Development configuration
const devConfig = {
  cors: {
    origin: 'http://localhost:8484',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization'],
    credentials: true,
  },
};

// Production configuration
const prodConfig = {
  cors: {
    origin: 'https://cliprr.example.com', // This will be updated for production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization'],
    credentials: true,
  },
};

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';
const config = isProduction ? prodConfig : devConfig;

export default config;
