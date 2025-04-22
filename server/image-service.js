import fetch from 'node-fetch';
import FormData from 'form-data';
import config from './config.js';
import { API_KEY } from './mcp-server.js';

export async function submitImageTask(imageBuffer, prompt = "") {
  const endpoint = "4oimage";
  
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
      return { success: true, taskId: result.task_id };
    } else {
      return { 
        success: false, 
        error: result.error || "Task submission failed",
        code: result.code 
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function checkTaskStatus(taskId) {
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
    return { success: false, error: error.message };
  }
}

export async function pollTaskUntilComplete(taskId, progressCallback, interval = 3000, maxAttempts = 50) {
  
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const checkStatus = async () => {
      try {
        const result = await checkTaskStatus(taskId);
        
        if (!result.success) {
          return reject(new Error(result.error || "Task query failed"));
        }
        
        const task = result.task;
        
        // Call progress callback
        if (progressCallback && typeof progressCallback === 'function') {
          progressCallback({
            status: task.status,
            progress: task.progress || 0
          });
        }
        
        if (task.status === 'completed') {
          
          // Validate task result
          if (task.result && typeof task.result === 'object') {
            // Check for image URL
            if (task.result.image_url) {
              
            } else if (task.result.text && typeof task.result.text === 'string') {
              // Try to extract URL from text (sometimes API puts URL in text field)
              const urlMatch = task.result.text.match(/(https?:\/\/[^\s"\)]+\.(jpg|jpeg|png|webp|gif))/i);
              if (urlMatch) {
                const extractedUrl = urlMatch[0];
                // Add to result object
                task.result.image_url = extractedUrl;
              }
            }
            
            resolve(task.result);
          } else {
            resolve(task.result || {});
          }
        } else if (task.status === 'failed') {
          reject(new Error(task.error || "Task processing failed"));
        } else if (++attempts >= maxAttempts) {
          reject(new Error("Processing timeout, please try again later"));
        } else {
          setTimeout(checkStatus, interval);
        }
      } catch (error) {
        reject(error);
      }
    };
    
    checkStatus();
  });
}

export async function generateImage(imageBuffer, prompt = "", options = {}) {
  const endpoint = "4oimage";
  const { progressCallback } = options;
  
  const startTime = Date.now();
  
  try {
    // 1. Submit task
    const submitResult = await submitImageTask(imageBuffer, prompt);
    
    if (!submitResult.success) {
      return { success: false, error: submitResult.error, code: submitResult.code };
    }
    
    const taskId = submitResult.taskId;
    
    // 2. Poll task status
    const result = await pollTaskUntilComplete(taskId, progressCallback);
    
    // 3. Return result
    if (result && typeof result === 'object') {
      // Check if image URL exists and is valid
      if (result.image_url && typeof result.image_url === 'string' && result.image_url.startsWith('http')) {
        const totalTime = Date.now() - startTime;
        return { success: true, imageUrl: result.image_url };
      } else {

        return { success: false, error: "Invalid image URL" };
      }
    } else {

      return { success: false, error: "Invalid result object" };
    }
  } catch (error) {
    const totalTime = Date.now() - startTime;
    return { success: false, error: error.message };
  }
} 