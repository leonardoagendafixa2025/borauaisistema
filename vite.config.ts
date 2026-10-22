import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

function apiDevMiddleware(): Plugin {
  return {
    name: "api-dev-middleware",
    configureServer(server) {
      server.middlewares.use(async (req: any, res: any, next) => {
        if (req.url && req.url.startsWith("/api/")) {
          const endpoint = req.url.slice(5).split("?")[0].replace(/\.js$/, "");
          try {
            const apiFilePath = path.resolve(__dirname, "api", `${endpoint}.js`);
            const { pathToFileURL } = await import("url");
            const module = await import(`${pathToFileURL(apiFilePath).href}?t=${Date.now()}`);
            const handler = module.default;
            if (!handler) {
              return next();
            }

            let body: any = {};
            if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
              const buffers: any[] = [];
              for await (const chunk of req) {
                buffers.push(chunk);
              }
              const raw = Buffer.concat(buffers).toString();
              try {
                body = raw ? JSON.parse(raw) : {};
              } catch {
                body = {};
              }
            }
            req.body = body;
            res.status = (code: number) => {
              res.statusCode = code;
              return res;
            };
            res.json = (data: any) => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(data));
              return res;
            };
            return handler(req, res);
          } catch (err: any) {
            if (err?.code === 'ERR_MODULE_NOT_FOUND' || err?.message?.includes('Cannot find module')) {
              return next();
            }
            console.error(`[dev-api] Erro ao executar /api/${endpoint}:`, err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), apiDevMiddleware()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
