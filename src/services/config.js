export class ConfigService {
    constructor() {
      this.config = new Map();
      this.loadConfig();
    }
  
    /**
     * Load configuration from environment variables
     */
    loadConfig() {
      // GitHub Configuration
      this.set('GITHUB_TOKEN', process.env.GITHUB_TOKEN);
      
      // General Settings
      this.set('MAX_PATCH_SIZE', parseInt(process.env.MAX_PATCH_SIZE) || 2000);
      this.set('MAX_FILES_TO_REVIEW', parseInt(process.env.MAX_FILES_TO_REVIEW) || 50);
      this.set('REQUEST_TIMEOUT', parseInt(process.env.REQUEST_TIMEOUT) || 30000); // 30 seconds
      
      // Logging Configuration
      this.set('LOG_LEVEL', process.env.LOG_LEVEL || 'info');
      this.set('ENABLE_DEBUG', process.env.ENABLE_DEBUG === 'true');
    }
  
    /**
     * Get configuration value
     */
    get(key, defaultValue = null) {
      return this.config.get(key) || defaultValue;
    }
  
    /**
     * Set configuration value
     */
    set(key, value) {
      this.config.set(key, value);
    }
  
    /**
     * Check if a configuration key exists and has a value
     */
    has(key) {
      return this.config.has(key) && this.config.get(key) !== null && this.config.get(key) !== undefined;
    }
  
    /**
     * Get configuration value as integer
     */
    getInt(key, defaultValue = 0) {
      const value = this.get(key, defaultValue);
      return parseInt(value) || defaultValue;
    }
  
    /**
     * Get configuration value as boolean
     */
    getBool(key, defaultValue = false) {
      const value = this.get(key);
      if (value === null || value === undefined) {
        return defaultValue;
      }
      return value === 'true' || value === true || value === '1' || value === 1;
    }
  
        /**
     * Validate required configuration
     */
    validate() {
      const required = ['GITHUB_TOKEN'];
      const missing = required.filter(key => !this.has(key));
      
      if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.join(', ')}`);
      }

      // Validate GitHub token format
      const githubToken = this.get('GITHUB_TOKEN');
      if (githubToken && !githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
        console.warn('Warning: GitHub token may not be in the expected format (should start with ghp_ or github_pat_)');
      }
    }
  
    /**
     * Get all configuration as object (safe for logging)
     */
    toObject() {
      const obj = {};
      for (const [key, value] of this.config.entries()) {
        // Don't expose sensitive values
        if (key.includes('TOKEN') || key.includes('KEY')) {
          obj[key] = value ? '[SET]' : '[NOT SET]';
        } else {
          obj[key] = value;
        }
      }
      return obj;
    }
  
        /**
     * Update configuration at runtime
     */
    update(key, value) {
      this.set(key, value);
    }

    /**
     * Reload configuration from environment
     */
    reload() {
      this.config.clear();
      this.loadConfig();
    }
  }