// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// export default defineConfig({
//   plugins: [react()],
// })



// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// export default defineConfig({
//   plugins: [react()],
//   server: {
//     host: '0.0.0.0',   // sab IPs pe allow karega
//     port: 5173         // default port, tum change bhi kar sakte ho
//   }
// })

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',              // sab IPs pe allow karega
    port: 5173,                   // default port, tum change bhi kar sakte ho
    allowedHosts: ['.loca.lt']    // localtunnel ke links allow karne ke liye
  }
})