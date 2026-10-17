import "dotenv/config";
import { hostedConfig } from "../server/hosted-config.js";
try {
  hostedConfig(process.env);
  console.log(
    "Hosting configuration is valid. This does not connect to Neon or deploy the site.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
