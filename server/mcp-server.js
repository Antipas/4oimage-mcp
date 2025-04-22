import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { generateImage } from "./image-service.js";
import config from "./config.js";
import open from "open";

class ImageGenerationServer {
  constructor() {
    // Empty constructor
  }
  
  async processImageGeneration(params) {
    try {
      const { prompt, imageBase64 } = params;
      const endpoint = "4oimage";
      
      console.log(`Processing image request: ${prompt.substring(0, 30)}...`);
      
      const startTime = Date.now();
      let imageBuffer = null;
      
      // Convert Base64 image to Buffer if provided
      if (imageBase64) {
        try {
          const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
          imageBuffer = Buffer.from(base64Data, 'base64');
          console.log(`Input image converted to buffer: ${imageBuffer.length} bytes`);
        } catch (error) {
          console.error(`Image conversion error:`, error);
          return {
            content: [{ 
              type: "text", 
              text: `Error converting image: ${error.message}` 
            }]
          };
        }
      }
      
      try {
        // Create progress callback
        const progressCallback = (update) => {
          console.log(`Generation progress: ${update.status}, ${Math.round(update.progress * 100)}%`);
        };

        // Wait for image generation
        console.log(`Starting image generation...`);
        const result = await generateImage(imageBuffer, prompt, { endpoint, progressCallback });

        // Process results
        if (result.success && result.imageUrl) {
          const imageUrl = result.imageUrl;
          console.log(`Image generated successfully: ${imageUrl}`);
          
          try {
            // Open image URL in browser
            await open(imageUrl);
            console.log(`Opened image URL in browser`);
          } catch (openError) {
            console.error(`Could not open URL in browser: ${openError.message}`);
          }
          
          // Return response
          const responseText = 
            `Image generated successfully!\n` +
            `The image has been opened in your default browser.\n\n` +
            `Generation details:\n` +
            `- Prompt: "${prompt}"\n` +
            `- Image URL: ${imageUrl}\n\n` +
            `Visit our website: https://4o-image.app/\n\n` +
            `You can also click the URL above to view the image again.`;
          
          return {
            content: [
              {
                type: "text",
                text: responseText
              }
            ]
          };
        } else {
          // Handle errors
          let errorMessage = "Image generation failed";
          
          if (!result.success) {
            errorMessage = result.error || "Unknown error";
          } else if (!result.imageUrl) {
            errorMessage = "Invalid image URL generated";
          }
          
          console.error(`Generation failed: ${errorMessage}`);
          return {
            content: [{ 
              type: "text", 
              text: `Image generation failed: ${errorMessage}` 
            }]
          };
        }
      } catch (error) {
        console.error(`Image generation error:`, error);
        return {
          content: [{ 
            type: "text", 
            text: `Error generating image: ${error.message}` 
          }]
        };
      }
    } catch (outerError) {
      console.error(`Request processing error:`, outerError);
      return {
        content: [{ 
          type: "text", 
          text: `Error processing image generation request: ${outerError.message}` 
        }]
      };
    }
  }
}

// Image generation tool definition
const GENERATE_IMAGE_TOOL = {
  name: "generateImage",
  description: `Generate images using the 4o-image API and automatically open the results in your browser.

This tool generates images based on your prompt and automatically opens them in your default browser, while also returning a clickable link.

The tool supports two modes:
1. Text-to-image - Create new images using just a text prompt
2. Image editing - Provide a base image and prompt for editing or style transfer

The response will include a direct link to the generated image and detailed information.

Visit our website: https://4o-image.app/`,
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "Text description of the desired image content"
      },
      imageBase64: {
        type: "string",
        description: "Optional base image (Base64 encoded) for image editing or upscaling"
      }
    },
    required: ["prompt"]
  }
};

// Create MCP server
const server = new Server({
  name: config.server.name,
  version: config.server.version
}, {
  capabilities: {
    tools: {},
  },
});

const imageServer = new ImageGenerationServer();

// Check for API key
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    console.error("Error: API_KEY environment variable is required");
    process.exit(1);
}

// Export API_KEY for image-service.js
export { API_KEY };

// Set up tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.log(`Received tools list request`);
  const response = { tools: [GENERATE_IMAGE_TOOL] };
  return response;
});

// Set up tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.log(`Tool call received: ${request.params.name}`);
  
  if (request.params.name === "generateImage") {
    try {
      const response = await imageServer.processImageGeneration(request.params.arguments);
      return response;
    } catch (error) {
      console.error(`Tool processing error:`, error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ 
          type: "text", 
          text: `Error: ${errorMessage}` 
        }],
        isError: true
      };
    }
  }
  
  // Unknown tool handler
  const errorMessage = `Unknown tool: ${request.params.name}`;
  console.error(errorMessage);
  return {
    content: [{
      type: "text",
      text: `Error: ${errorMessage}`
    }],
    isError: true
  };
});

// Run server
async function runServer() {
  try {
    console.log(`Starting 4o-image MCP server...`);
    console.log(`Server: ${config.server.name} v${config.server.version}`);
    
    // Use stdio as transport layer
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    
    console.log(`4o-image MCP server started successfully`);
  } catch (error) {
    console.error(`Server startup error:`, error);
    process.exit(1);
  }
}

export { runServer }; 