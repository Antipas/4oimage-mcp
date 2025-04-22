import fetch from 'node-fetch';
import FormData from 'form-data';
import config from './config.js';
import { API_KEY } from './mcp-server.js';

export async function submitImageTask(imageBuffer, prompt = "") {
  const endpoint = "4oimage";
  console.log(`Submitting image task with prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
  
  try {
    // Normalize prompt text
    const normalizedPrompt = prompt.replace(/\r\n/g, '').replace(/\r/g, '').replace(/\n/g, '');
    
    // Create FormData
    const formData = new FormData();
    if (imageBuffer) {
      formData.append('image', imageBuffer, {
        filename: 'image.jpg',
        contentType: 'image/jpeg',
      });
      console.log(`Added image to form: ${imageBuffer.length} bytes`);
    }
    if (normalizedPrompt) {
      formData.append('prompt', normalizedPrompt);
    }

    // Send request
    const response = await fetch(`${config.api.baseUrl}/api/image/api/${endpoint}`, {
      method: 'POST',
      headers: {
        'X-Subscription-Token': API_KEY
      },
      body: formData
    });
    
    // Parse response
    const result = await response.json();
    
    if (result.success) {
      console.log(`Task submitted successfully, ID: ${result.task_id}`);
      return { success: true, taskId: result.task_id };
    } else {
      console.error(`Task submission failed: ${result.error || "Unknown error"}`);
      return { 
        success: false, 
        error: result.error || "Task submission failed",
        code: result.code 
      };
    }
  } catch (error) {
    console.error(`Task submission error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function checkTaskStatus(taskId) {
  console.log(`Checking task status: ${taskId}`);
  try {
    const requestUrl = `${config.api.baseUrl}/api/image/api/task/${taskId}`;
    
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        'X-Subscription-Token': API_KEY
      }
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`Status check error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function pollTaskUntilComplete(taskId, progressCallback, interval = 3000, maxAttempts = 50) {
  console.log(`Polling task status, ID: ${taskId}`);
  
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const checkStatus = async () => {
      try {
        const result = await checkTaskStatus(taskId);
        
        if (!result.success) {
          console.error(`Query failed: ${result.error || "Unknown error"}`);
          return reject(new Error(result.error || "Task query failed"));
        }
        
        const task = result.task;
        console.log(`Task status: ${task.status}, progress: ${Math.round((task.progress || 0) * 100)}%`);
        
        // Call progress callback
        if (progressCallback && typeof progressCallback === 'function') {
          progressCallback({
            status: task.status,
            progress: task.progress || 0
          });
        }
        
        if (task.status === 'completed') {
          console.log(`Task completed!`);
          
          // Validate task result
          if (task.result && typeof task.result === 'object') {
            // Check for image URL
            if (task.result.image_url) {
              console.log(`Image URL: ${task.result.image_url}`);
            } else if (task.result.text && typeof task.result.text === 'string') {
              // Try to extract URL from text (sometimes API puts URL in text field)
              const urlMatch = task.result.text.match(/(https?:\/\/[^\s"\)]+\.(jpg|jpeg|png|webp|gif))/i);
              if (urlMatch) {
                const extractedUrl = urlMatch[0];
                console.log(`Extracted image URL from text: ${extractedUrl}`);
                // Add to result object
                task.result.image_url = extractedUrl;
              }
            }
            
            resolve(task.result);
          } else {
            console.warn(`Warning: Task completed but result format is invalid`);
            resolve(task.result || {});
          }
        } else if (task.status === 'failed') {
          console.error(`Task failed: ${task.error || "Unknown error"}`);
          reject(new Error(task.error || "Task processing failed"));
        } else if (++attempts >= maxAttempts) {
          console.error(`Reached maximum attempts (${maxAttempts}), timeout`);
          reject(new Error("Processing timeout, please try again later"));
        } else {
          console.log(`Task not completed yet, checking again in ${interval}ms`);
          setTimeout(checkStatus, interval);
        }
      } catch (error) {
        console.error(`Polling error: ${error.message}`);
        reject(error);
      }
    };
    
    checkStatus();
  });
}

export async function generateImage(imageBuffer, prompt = "", options = {}) {
  const endpoint = "4oimage";
  const { progressCallback } = options;
  console.log(`Starting image generation with prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
  
  const startTime = Date.now();
  
  try {
    // 1. Submit task
    const submitResult = await submitImageTask(imageBuffer, prompt);
    
    if (!submitResult.success) {
      console.error(`Task submission failed: ${submitResult.error}`);
      return { success: false, error: submitResult.error, code: submitResult.code };
    }
    
    const taskId = submitResult.taskId;
    
    // 2. Poll task status
    console.log(`Polling task status`);
    const result = await pollTaskUntilComplete(taskId, progressCallback);
    
    // 3. Return result
    if (result && typeof result === 'object') {
      // Check if image URL exists and is valid
      if (result.image_url && typeof result.image_url === 'string' && result.image_url.startsWith('http')) {
        const totalTime = Date.now() - startTime;
        console.log(`Image generated successfully: ${result.image_url} (${totalTime}ms)`);
        return { success: true, imageUrl: result.image_url };
      } else {
        console.error(`Invalid image URL: ${result.image_url}`);
        return { success: false, error: "Invalid image URL" };
      }
    } else {
      console.error(`Invalid result object`);
      return { success: false, error: "Invalid result object" };
    }
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`Image generation failed: ${error.message} (${totalTime}ms)`);
    return { success: false, error: error.message };
  }
} 