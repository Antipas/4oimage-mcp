#!/usr/bin/env node
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { runServer as runMcpServer } from "./mcp-server.js";
import config from "./config.js";

// Default MCP server startup
runMcpServer().catch((error) => {
  console.error("MCP server failed to start:", error);
  process.exit(1);
});

// Create HTTP server and MCP
const app = express();
app.use(express.json({
  // 添加JSON解析错误处理
  reviver: (key, value) => {
    return value;
  },
  // 放宽JSON解析限制
  strict: false
}));

// 基本日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  
  next();
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    // 处理JSON解析错误
    console.error('JSON解析错误:', err.message);
    return res.status(400).json({ 
      error: 'Invalid JSON data',
      details: err.message
    });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// 创建并存储每个会话的传输
const transports = {};

// MCP 端点
app.all('/mcp', async (req, res) => {
  // 设置响应头，允许跨域请求
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const transport = new StreamableHTTPServerTransport(req, res);
  const sessionId = transport.sessionId;
  
  console.log(`New MCP connection: ${sessionId}`);
  
  // 存储传输以便重用
  transports[sessionId] = transport;
  
  // 当连接关闭时清理
  res.on('close', () => {
    console.log(`MCP connection closed: ${sessionId}`);
    delete transports[sessionId];
  });
  
  try {
    // 在这里使用新的MCP服务器
    await runMcpServer();
  } catch (error) {
    console.error('MCP connection error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

// 状态检查端点
app.get('/status', (req, res) => {
  const activeConnections = Object.keys(transports).length;
  console.log(`Status check: ${activeConnections} active connections`);
  res.json({ 
    status: 'ok', 
    activeConnections, 
    serverInfo: {
      name: config.server.name,
      version: config.server.version
    }
  });
});

// 未找到路由处理
app.use((req, res) => {
  res.status(404).json({ error: 'Resource not found' });
});

// 查找可用端口
let PORT = config.server.port;
const MAX_PORT_ATTEMPTS = 10;

const findAvailablePort = async (startPort, maxAttempts) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = startPort + attempt;
    try {
      await new Promise((resolve, reject) => {
        const server = app.listen(port);
        server.once('listening', () => {
          server.close(() => resolve(port));
        });
        server.once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is in use, trying next port...`);
            reject(err);
          } else {
            reject(err);
          }
        });
      });
      return port; // 找到可用端口
    } catch (err) {
      if (attempt === maxAttempts - 1) {
        throw new Error(`Could not find available port, last attempt: ${startPort + attempt}`);
      }
    }
  }
};

// 启动服务器
findAvailablePort(PORT, MAX_PORT_ATTEMPTS)
  .then(port => {
    PORT = port;
    app.listen(PORT, () => {
      console.log(`4o-image MCP server started v${config.server.version}`);
      console.log(`Server name: ${config.server.name}`);
      console.log(`HTTP port: ${PORT}`);
      console.log(`Official website: https://4o-image.app/`);
      console.log('\nUsage:');
      console.log('1. Configure this MCP server in Claude settings');
      console.log('2. Set your API key using API_KEY environment variable');
      console.log('3. Ask Claude to generate images\n');
    });
  })
  .catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  }); 
