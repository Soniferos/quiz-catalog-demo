import { defineConfig, loadEnv } from "vite";
import { contactConfig, createContactMiddleware } from "./server/contacts.mjs";

export default defineConfig(({ mode }) => {
  const config = contactConfig({
    ...loadEnv(mode, process.cwd(), ""),
    ...process.env,
  });
  const install = (server) => {
    server.middlewares.use(createContactMiddleware({ config }));
  };
  return {
    plugins: [
      {
        name: "local-contact-check",
        configureServer: install,
        configurePreviewServer: install,
      },
    ],
  };
});
