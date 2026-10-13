import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { createAppServer } from './server/index.js'

const apiServerKey = Symbol.for('reviewtap.local-api-server')

function localApiServer(environment, apiPort) {
  return {
    name: 'reviewtap-local-api',
    apply: (_config, environment) =>
      environment.command === 'serve' && environment.mode !== 'test',
    async configureServer(viteServer) {
      let entry = globalThis[apiServerKey]
      if (!entry?.server.listening) {
        const apiServer = createAppServer({
          adminPassword: environment.ADMIN_PASSWORD,
          sessionSecret: environment.ADMIN_SESSION_SECRET ?? environment.ADMIN_PASSWORD,
          publicBaseUrl: environment.PUBLIC_BASE_URL ?? 'http://localhost:5173',
        })

        try {
          await new Promise((resolve, reject) => {
            apiServer.once('error', reject)
            apiServer.listen(apiPort, '127.0.0.1', resolve)
          })
        } catch (error) {
          apiServer.close()
          if (error.code === 'EADDRINUSE') {
            throw new Error(
              `ReviewTap API port ${apiPort} is already in use. Stop the other server or set API_PORT to a free port.`,
              { cause: error },
            )
          }
          throw error
        }

        entry = { server: apiServer, closeHookAttached: false }
        globalThis[apiServerKey] = entry
      }

      if (!entry.closeHookAttached && viteServer.httpServer) {
        entry.closeHookAttached = true
        viteServer.httpServer.once('close', () => {
          entry.server.close(() => {
            if (globalThis[apiServerKey] === entry) delete globalThis[apiServerKey]
          })
        })
      }
      console.info(`ReviewTap API listening on http://127.0.0.1:${apiPort}`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const apiPort = Number(environment.API_PORT ?? 3001)

  return {
    plugins: [react(), localApiServer(environment, apiPort)],
    server: {
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          configure(proxy) {
            proxy.on('proxyReq', (proxyRequest, request) => {
              proxyRequest.setHeader('host', request.headers.host)
            })
          },
        },
        '/r': {
          target: `http://127.0.0.1:${apiPort}`,
          configure(proxy) {
            proxy.on('proxyReq', (proxyRequest, request) => {
              proxyRequest.setHeader('host', request.headers.host)
            })
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      globals: true,
    },
  }
})
