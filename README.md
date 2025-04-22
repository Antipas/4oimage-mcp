# 4o-image MCP Server

An MCP server implementation that integrates with 4o-image API, enabling LLMs and other AI systems to generate and edit images through a standardized protocol. Create high-quality art, 3D characters, and custom images using simple text prompts.

<a href="https://glama.ai/mcp/servers/@Antipas/4oimage-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@Antipas/4oimage-mcp/badge" alt="mcp-4o-Image-Generator MCP server" />
</a>

[![npm version](https://img.shields.io/npm/v/4oimage-mcp.svg)](https://www.npmjs.com/package/4oimage-mcp)
[![Node.js Version](https://img.shields.io/node/v/4oimage-mcp.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

* **Text-to-Image Generation**: Create images from text descriptions with AI
* **Image Editing**: Transform existing images using text prompts
* **Real-time Progress Updates**: Get feedback on generation status
* **Browser Integration**: Automatically open generated images in your default browser


## Tools

* **generateImage**
  * Generate images based on text prompts with optional image editing
  * Inputs:
    * `prompt` (string, required): Text description of the desired image
    * `imageBase64` (string, optional): Base64-encoded image for editing or style transfer

## Configuration

### Getting an API Key

1. Register for an account at [4o-image.app](https://4o-image.app/dashboard/)
2. Obtain your API key from the user dashboard
3. Set the API key as an environment variable when running the server

### Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "4o-image": {
      "command": "npx",
      "args": [
        "-y",
        "4oimage-mcp"
      ],
      "env": {
        "API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

## Example Usage

Here's an example of using this MCP server with Claude:

```
Generate an image of a dog running on the beach at sunset
```

Claude will use the MCP server to generate the image, which will automatically open in your default browser. You'll also get a direct link to the image in Claude's response.

For image editing, you can include a base image and prompt Claude to modify it:

```
Edit this image to make the sky more dramatic with storm clouds
```

## License

This MCP server is licensed under the MIT License. You are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License.