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
      
      // Ollama Configuration
      this.set('OLLAMA_HOST', process.env.OLLAMA_HOST || 'http://localhost:11434');
      this.set('DEFAULT_MODEL', process.env.DEFAULT_MODEL || 'llama3.1');
      
      // Review Configuration
      this.set('PROMPT_FILE_PATH', process.env.PROMPT_FILE_PATH || './prompts/review-prompt.md');
      this.set('AUTO_POST_REVIEW', process.env.AUTO_POST_REVIEW || 'false');
      
      // Cursor Configuration
      this.set('CURSOR_CLI_PATH', process.env.CURSOR_CLI_PATH || 'cursor');
      this.set('CURSOR_DEFAULT_MODEL', process.env.CURSOR_DEFAULT_MODEL || 'gpt-4');
      
      // Gemini Configuration
      this.set('GEMINI_CLI_PATH', process.env.GEMINI_CLI_PATH || 'gemini');
      this.set('GEMINI_API_KEY', process.env.GEMINI_API_KEY);
      this.set('GEMINI_DEFAULT_MODEL', process.env.GEMINI_DEFAULT_MODEL || 'gemini-pro');
      
      // General Settings
      this.set('MAX_PATCH_SIZE', parseInt(process.env.MAX_PATCH_SIZE) || 2000);
      this.set('MAX_FILES_TO_REVIEW', parseInt(process.env.MAX_FILES_TO_REVIEW) || 50);
      this.set('REVIEW_TIMEOUT', parseInt(process.env.REVIEW_TIMEOUT) || 300000); // 5 minutes
      
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
  
      // Validate Ollama host format
      const ollamaHost = this.get('OLLAMA_HOST');
      if (ollamaHost && !ollamaHost.startsWith('http')) {
        console.warn('Warning: OLLAMA_HOST should include protocol (http:// or https://)');
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
     * Get configuration for specific provider
     */
    getProviderConfig(provider) {
      switch (provider.toLowerCase()) {
        case 'ollama':
          return {
            host: this.get('OLLAMA_HOST'),
            defaultModel: this.get('DEFAULT_MODEL'),
          };
        case 'cursor':
          return {
            cliPath: this.get('CURSOR_CLI_PATH'),
            defaultModel: this.get('CURSOR_DEFAULT_MODEL'),
          };
        case 'gemini':
          return {
            cliPath: this.get('GEMINI_CLI_PATH'),
            apiKey: this.get('GEMINI_API_KEY'),
            defaultModel: this.get('GEMINI_DEFAULT_MODEL'),
          };
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
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
  
    /**
     * Get all available providers based on configuration
     */
    getAvailableProviders() {
      const providers = ['ollama']; // Ollama is always available if configured
      
      if (this.has('CURSOR_CLI_PATH')) {
        providers.push('cursor');
      }
      
      if (this.has('GEMINI_API_KEY')) {
        providers.push('gemini');
      }
      
      return providers;
    }
  
    /**
     * Check if a specific provider is configured
     */
    isProviderAvailable(provider) {
      return this.getAvailableProviders().includes(provider.toLowerCase());
    }
  }