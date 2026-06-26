/**
 * Minimal Socket.IO relay for live bus tracking (matches frontend SOW).
 *
 * Run (separate terminal): `npm run transport-relay`
 * Point the app at it: `VITE_SOCKET_TRANSPORT_URL=http://localhost:3331` in `.env` / `.env.local`
 *
 * Events: subscribe-bus { busId } · driver-location { lat, lng, speed, busId, ... } · bus-location (broadcast)
 */
import http from 'http'
import { Server } from 'socket.io'

const port = Number(process.env.PORT) || 3331

const httpServer = http.createServer()
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
})

io.on('connection', (socket) => {
  socket.on('subscribe-bus', (payload) => {
    const busId = payload?.busId
    if (busId == null || String(busId).trim() === '') return
    const room = `bus:${busId}`
    socket.join(room)
  })

  socket.on('driver-location', (payload) => {
    if (!payload || payload.busId == null) return
    const room = `bus:${payload.busId}`
    io.to(room).emit('bus-location', payload)
  })
})

httpServer.listen(port, () => {
  console.log(`[transport-relay] http://localhost:${port}  (CORS: all origins)`)
})
