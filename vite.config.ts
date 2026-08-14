import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({plugins:[react(),VitePWA({registerType:'autoUpdate',includeAssets:['icon.svg','brand/sebda-icon.png','brand/sebda-wordmark.jpg'],manifest:{name:'SEBDA — Praca brygad',short_name:'SEBDA',theme_color:'#005b83',background_color:'#f6fbfd',display:'standalone',start_url:'/',icons:[{src:'/brand/sebda-icon.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]}})]})
