/**
 * PR Review Handler
 * Handles the logic for reviewing GitHub Pull Requests
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { toolDefinitions, toolHandlers } from '../tools/index.js';
import { GitHubService } from '../services/github.js';
import { AnalysisService } from '../services/analysis.js';

/**
 * Convert MCP tool definitions to Gemini function calling format
 * @param {Array} mcpToolDefinitions - Array of MCP tool definitions
 * @returns {Array} Array of Gemini function declarations
 */
function convertMCPToolsToGeminiFunctions(mcpToolDefinitions) {
  const converted = mcpToolDefinitions.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema
  }));
  
  // Debug: Log the first converted function to verify format
  if (converted.length > 0) {
    console.log('🔍 Sample converted function:', JSON.stringify(converted[0], null, 2));
  }
  
  return converted;
}

/**
 * Initialize services
 * @returns {Object} Initialized GitHub and Analysis services
 */
function initServices() {
  const github = new GitHubService(process.env.GITHUB_TOKEN);
  const analysis = new AnalysisService();
  return { github, analysis };
}

/**
 * Initialize Gemini AI client with function calling
 * @returns {Object} Initialized Gemini client and model with tools
 */
function initGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Convert MCP tools to Gemini function format
  const geminiFunctions = convertMCPToolsToGeminiFunctions(toolDefinitions);
  console.log(`🔧 Converted ${geminiFunctions.length} tools for Gemini:`, geminiFunctions.map(f => f.name).join(', '));
  
  // Initialize model with function calling capabilities
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash',
    tools: [{ functionDeclarations: geminiFunctions }]
    // Note: Removing toolConfig for now as it might be causing issues
  });
  
  return { genAI, model };
}

/**
 * Execute tool function call
 * @param {string} functionName - Name of the function to call
 * @param {Object} args - Arguments for the function
 * @param {Object} services - GitHub and Analysis services
 * @returns {Promise<Object>} Function execution result
 */
async function executeToolFunction(functionName, args, services) {
  console.log(`🛠️  Looking up handler for function: ${functionName}`);
  const handler = toolHandlers[functionName];
  
  if (!handler) {
    console.error(`❌ Unknown function: ${functionName}`);
    throw new Error(`Unknown function: ${functionName}`);
  }
  
  console.log(`⚡ Executing ${functionName} with handler found`);
  
  // Call the handler with appropriate services based on the function
  if (functionName === 'get_pr_details' || functionName === 'get_pr_files' || 
      functionName === 'get_pr_commits' || functionName === 'get_file_content' || 
      functionName === 'post_pr_review' || functionName === 'get_repo_info' ||
      functionName === 'get_review_prompts') {
    console.log(`🔗 Calling ${functionName} with GitHub service`);
    return await handler(services.github, args);
  } else {
    // Analysis tools need both services
    console.log(`🔍 Calling ${functionName} with both GitHub and Analysis services`);
    return await handler(services.github, services.analysis, args);
  }
}

/**
 * Handle function calls and continue conversation until final response
 * @param {Object} response - Initial response with function calls
 * @param {Object} model - Gemini model instance
 * @param {string} initialPrompt - The initial prompt sent
 * @param {Object} services - GitHub and Analysis services
 * @param {string} prUrl - The PR URL being reviewed
 * @returns {Promise<{message: string}>} Final review result
 */
async function handleFunctionCalls(response, model, initialPrompt, services, prUrl) {
  console.log(`🔧 Model wants to use ${response.functionCalls.length} tool(s): ${response.functionCalls.map(fc => fc.name).join(', ')}`);
  
  let conversationHistory = [
    { role: 'user', parts: [{ text: initialPrompt }] },
    { role: 'model', parts: [{ functionCall: response.functionCalls[0] }] }
  ];
  
  // Execute function calls iteratively
  console.log('⚙️ Starting initial function call execution...');
  for (const functionCall of response.functionCalls) {
    try {
      console.log(`🔄 Executing tool: ${functionCall.name} with args:`, JSON.stringify(functionCall.args, null, 2));
      const functionResult = await executeToolFunction(
        functionCall.name,
        functionCall.args,
        services
      );
      console.log(`✅ Tool ${functionCall.name} completed successfully`);
      
      // Add function response to conversation
      conversationHistory.push({
        role: 'function',
        parts: [{ functionResponse: { name: functionCall.name, response: functionResult } }]
      });
    } catch (error) {
      console.error(`❌ Error executing function ${functionCall.name}:`, error);
      conversationHistory.push({
        role: 'function',
        parts: [{ functionResponse: { name: functionCall.name, response: { error: error.message } } }]
      });
    }
  }
  
  // Continue conversation with function results until we get a text response
  console.log('💬 Starting chat session with function results...');
  const chat = model.startChat({ history: conversationHistory });
  console.log('📝 Continuing analysis - asking model to use more tools...');
  let finalResult = await chat.sendMessage(`Now call get_pr_details to get information about this PR: ${prUrl}`);
  let finalResponse = await finalResult.response;
  
  // Debug the continuation response
  console.log('🔍 Continuation response structure:');
  console.log('  - functionCalls:', finalResponse.functionCalls ? finalResponse.functionCalls.length : 'undefined');
  console.log('  - text length:', finalResponse.text() ? finalResponse.text().length : 'no text');
  console.log('  - candidates:', finalResponse.candidates ? finalResponse.candidates.length : 'undefined');
  
  // Debug candidate structure
  if (finalResponse.candidates && finalResponse.candidates.length > 0) {
    const candidate = finalResponse.candidates[0];
    console.log('🔍 Continuation candidate structure:');
    console.log('  - content parts:', candidate.content?.parts ? candidate.content.parts.length : 'undefined');
    if (candidate.content?.parts) {
      candidate.content.parts.forEach((part, idx) => {
        console.log(`  - part ${idx}:`, Object.keys(part));
        if (part.functionCall) {
          console.log(`    - functionCall: ${part.functionCall.name}`);
        }
      });
    }
  }
  
  // Check for function calls in candidates for continuation
  if ((!finalResponse.functionCalls || finalResponse.functionCalls.length === 0) && finalResponse.candidates && finalResponse.candidates.length > 0) {
    const candidate = finalResponse.candidates[0];
    if (candidate.content?.parts) {
      const candidateFunctionCalls = candidate.content.parts
        .filter(part => part.functionCall)
        .map(part => part.functionCall);
      if (candidateFunctionCalls.length > 0) {
        console.log(`🔍 Found ${candidateFunctionCalls.length} function calls in continuation candidates`);
        finalResponse.functionCalls = candidateFunctionCalls;
      }
    }
  }
  
  let iterationCount = 0;
  let toolsUsed = new Set(['get_review_prompts']); // Track which tools have been used
  
  // Keep handling function calls until we get a final text response
  while (finalResponse.functionCalls && finalResponse.functionCalls.length > 0) {
    iterationCount++;
    console.log(`🔄 Model wants to make additional function calls (iteration ${iterationCount}): ${finalResponse.functionCalls.map(fc => fc.name).join(', ')}`);
    
    // Execute any additional function calls
    for (const functionCall of finalResponse.functionCalls) {
      toolsUsed.add(functionCall.name);
      try {
        console.log(`🔄 Executing additional tool: ${functionCall.name} with args:`, JSON.stringify(functionCall.args, null, 2));
        const functionResult = await executeToolFunction(
          functionCall.name,
          functionCall.args,
          services
        );
        console.log(`✅ Additional tool ${functionCall.name} completed successfully`);
        
        // Send function response back to the chat
        console.log(`📤 Sending ${functionCall.name} result back to chat...`);
        finalResult = await chat.sendMessage([{
          functionResponse: {
            name: functionCall.name,
            response: functionResult
          }
        }]);
        finalResponse = await finalResult.response;
        console.log('📥 Received response from chat');
        
        // Check if function calls are in candidates for the next iteration
        if (!finalResponse.functionCalls || finalResponse.functionCalls.length === 0) {
          if (finalResponse.candidates && finalResponse.candidates.length > 0) {
            const candidate = finalResponse.candidates[0];
            if (candidate.content?.parts) {
              const candidateFunctionCalls = candidate.content.parts
                .filter(part => part.functionCall)
                .map(part => part.functionCall);
              if (candidateFunctionCalls.length > 0) {
                finalResponse.functionCalls = candidateFunctionCalls;
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error executing additional function ${functionCall.name}:`, error);
        // Send error response back to the chat
        console.log(`📤 Sending error response for ${functionCall.name} back to chat...`);
        finalResult = await chat.sendMessage([{
          functionResponse: {
            name: functionCall.name,
            response: { error: error.message }
          }
        }]);
        finalResponse = await finalResult.response;
        console.log('📥 Received error response from chat');
        
        // Check if function calls are in candidates for the next iteration
        if (!finalResponse.functionCalls || finalResponse.functionCalls.length === 0) {
          if (finalResponse.candidates && finalResponse.candidates.length > 0) {
            const candidate = finalResponse.candidates[0];
            if (candidate.content?.parts) {
              const candidateFunctionCalls = candidate.content.parts
                .filter(part => part.functionCall)
                .map(part => part.functionCall);
              if (candidateFunctionCalls.length > 0) {
                finalResponse.functionCalls = candidateFunctionCalls;
              }
            }
          }
        }
      }
    }
    
    // If no more function calls but we haven't used enough tools, request final review
    if ((!finalResponse.functionCalls || finalResponse.functionCalls.length === 0) && toolsUsed.size >= 3) {
      console.log(`📊 Used ${toolsUsed.size} tools: ${Array.from(toolsUsed).join(', ')}`);
      console.log('🎯 Requesting final comprehensive review...');
      finalResult = await chat.sendMessage('Now provide your comprehensive PR review based on all the analysis above. Include specific findings, recommendations, and any issues discovered.');
      finalResponse = await finalResult.response;
    }
  }
  
  console.log('🎯 Model provided final text response, completing review...');
  const finalMessage = finalResponse.text();
  console.log(`📋 Final review length: ${finalMessage.length} characters`);
  console.log('🏁 PR review completed successfully!');
  
  return {
    message: finalMessage
  };
}

/**
 * Review a GitHub Pull Request
 * @param {string} prUrl - The GitHub PR URL to review
 * @returns {Promise<{message: string}>} Review result
 */
export async function reviewPullRequest(prUrl) {
  console.log(`🚀 Starting PR review for: ${prUrl}`);
  
  // Initialize services and Gemini AI client
  console.log('📦 Initializing services and Gemini AI client...');
  const services = initServices();
  const { model } = initGeminiClient();
  console.log('✅ Services initialized successfully');
  
  // Initial prompt for PR review
  const prompt = `You are an expert code reviewer analyzing PR: ${prUrl}

You must start by calling the get_review_prompts function immediately. Do not explain what you will do - just call the function now.`;

  try {
    console.log('🤖 Sending initial prompt to Gemini...');
    const result = await model.generateContent({
      contents: [{ parts: [{ text: prompt }] }]
    });
    const response = await result.response;
    console.log('📥 Received initial response from Gemini');
    
    // Debug: Log response structure to understand what we're getting
    console.log('🔍 Response structure:');
    console.log('  - functionCalls:', response.functionCalls ? response.functionCalls.length : 'undefined');
    console.log('  - text length:', response.text() ? response.text().length : 'no text');
    console.log('  - candidates:', response.candidates ? response.candidates.length : 'undefined');
    
    // Check if function calls are in candidates
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      console.log('🔍 First candidate structure:');
      console.log('  - content parts:', candidate.content?.parts ? candidate.content.parts.length : 'undefined');
      if (candidate.content?.parts) {
        candidate.content.parts.forEach((part, idx) => {
          console.log(`  - part ${idx}:`, Object.keys(part));
          if (part.functionCall) {
            console.log(`    - functionCall: ${part.functionCall.name}`);
          }
        });
      }
    }
    
    // Handle function calls if the model wants to use tools
    // Check both response.functionCalls and in candidates
    let functionCalls = response.functionCalls;
    
    if ((!functionCalls || functionCalls.length === 0) && response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content?.parts) {
        functionCalls = candidate.content.parts
          .filter(part => part.functionCall)
          .map(part => part.functionCall);
        console.log(`🔍 Found ${functionCalls.length} function calls in candidates`);
      }
    }
    
    if (functionCalls && functionCalls.length > 0) {
      console.log('🎯 Found function calls, processing...');
      // Create a response-like object for handleFunctionCalls
      const responseWithCalls = { ...response, functionCalls };
      return await handleFunctionCalls(responseWithCalls, model, prompt, services, prUrl);
    } else {
      // No function calls, return direct response
      console.log('📝 Model provided direct text response without function calls');
      const directMessage = response.text();
      console.log(`📋 Direct response length: ${directMessage.length} characters`);
      console.log('📄 Direct response content:', directMessage);
      
      // If we get an empty or very short response, there might be an issue
      if (!directMessage || directMessage.length < 50) {
        console.log('⚠️  Response too short or empty - this might indicate a configuration issue');
        console.log('🔄 Attempting to force function calling by being more explicit...');
        
        // Try multiple strategies to trigger function calls
        const strategies = [
          `Please call the get_review_prompts function now.`,
          `Start by calling get_pr_details function with pr_url: "${prUrl}"`,
          `Use the available tools to analyze PR: ${prUrl}. Call get_pr_details first.`
        ];
        
        for (let i = 0; i < strategies.length; i++) {
          console.log(`🎯 Trying strategy ${i + 1}: ${strategies[i]}`);
          try {
            const forceResult = await model.generateContent(strategies[i]);
            const forceResponse = await forceResult.response;
            
            if (forceResponse.functionCalls && forceResponse.functionCalls.length > 0) {
              console.log(`✅ Strategy ${i + 1} successfully triggered function calls!`);
              return await handleFunctionCalls(forceResponse, model, strategies[i], services, prUrl);
            } else {
              console.log(`❌ Strategy ${i + 1} failed - no function calls generated`);
            }
          } catch (error) {
            console.error(`❌ Strategy ${i + 1} error:`, error.message);
          }
        }
        
        console.log('⚠️  All fallback strategies failed - returning empty response');
        return {
          message: "Unable to analyze PR - function calling not working properly. Please check configuration."
        };
      }
      
      console.log('🏁 PR review completed with direct response');
      return {
        message: directMessage
      };
    }
  } catch (error) {
    console.error('💥 Error during PR review:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}
