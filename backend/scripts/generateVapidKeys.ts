import webpush from "web-push";
import fs from "fs";
import path from "path";

const vapidKeys = webpush.generateVAPIDKeys();

console.log("Generated VAPID Keys:");
console.log("Public Key:", vapidKeys.publicKey);
console.log("Private Key:", vapidKeys.privateKey);

const backendEnvPath = path.join(__dirname, "../../backend/.env");
const frontendEnvPath = path.join(__dirname, "../../frontend/.env.local");

// Helper to append or update keys in .env
function updateEnvFile(filePath: string, keys: Record<string, string>) {
  let content = "";
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf8");
  }

  for (const [key, value] of Object.entries(keys)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (content.match(regex)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}\n`;
    }
  }

  fs.writeFileSync(filePath, content.trim() + "\n");
  console.log(`Updated ${filePath}`);
}

updateEnvFile(backendEnvPath, {
  VAPID_PUBLIC_KEY: vapidKeys.publicKey,
  VAPID_PRIVATE_KEY: vapidKeys.privateKey,
  VAPID_EMAIL: "admin@29land.local", // dummy email
});

updateEnvFile(frontendEnvPath, {
  NEXT_PUBLIC_VAPID_KEY: vapidKeys.publicKey,
});

console.log("Keys have been successfully injected into .env files.");
