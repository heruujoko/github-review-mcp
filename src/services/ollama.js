import { Ollama } from 'ollama';

export class OllamaService {
  constructor(host = 'http://localhost:11434') {
    this.ollama = new Ollama({ host });
    this.host = host;
  }

  /**
   * List available models
   */
  async listModels() {
    try {
      const response = await this.ollama.list();
      return response.models.map(model => model.name);
    } catch (error) {
      console.error('Error listing Ollama models:', error);
      return [];
    }
  }

  /**
   * Generate response using Ollama
   */
  async generate(model, prompt, options = {}) {
    const defaultOptions = {
      temperature: 0.1,
      top_p: 0.9,
      num_predict: 4096,
      ...options,
    };

    try {
      const response = await this.ollama.generate({
        model,
        prompt,
        options: defaultOptions,
        stream: false,
      });

      return {
        response: response.response,
        model,
        created_at: response.created_at,
        done: response.done,
        context: response.context,
        total_duration: response.total_duration,
        load_duration: response.load_duration,
        prompt_eval_count: response.prompt_eval_count,
        prompt_eval_duration: response.prompt_eval_duration,
        eval_count: response.eval_count,
        eval_duration: response.eval_duration,
      };
    } catch (error) {
      console.error(`Error generating with Ollama model ${model}:`, error);
      throw new Error(`Ollama generation failed: ${error.message}`);
    }
  }

  /**
   * Check if model is available
   */
  async hasModel(modelName) {
    const models = await this.listModels();
    return models.includes(modelName);
  }

  /**
   * Pull a model if not available
   */
  async ensureModel(modelName) {
    const hasModel = await this.hasModel(modelName);
    
    if (!hasModel) {
      console.log(`Pulling model ${modelName}...`);
      try {
        await this.ollama.pull({ model: modelName });
        console.log(`Model ${modelName} pulled successfully`);
      } catch (error) {
        throw new Error(`Failed to pull model ${modelName}: ${error.message}`);
      }
    }
    
    return true;
  }

  /**
   * Get model info
   */
  async getModelInfo(modelName) {
    try {
      const response = await this.ollama.show({ model: modelName });
      return {
        name: response.modelfile,
        size: response.size,
        digest: response.digest,
        modified_at: response.modified_at,
      };
    } catch (error) {
      console.error(`Error getting model info for ${modelName}:`, error);
      return null;
    }
  }

  /**
   * Test connection to Ollama
   */
  async testConnection() {
    try {
      await this.listModels();
      return true;
    } catch (error) {
      console.error('Cannot connect to Ollama:', error);
      return false;
    }
  }
}