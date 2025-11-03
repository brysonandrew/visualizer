import tailwindcss from "@tailwindcss/vite"

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["./app/assets/css/main.css"],
  modules: ["nuxt-toast"],
    toast: {
    composableName: 'useNotification', // Customize the composable name
    settings: {
      position: 'topCenter',
      timeout: 3000,
    }
  },
  vite: {
    plugins: [tailwindcss()]
  }
})
