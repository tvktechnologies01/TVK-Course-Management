const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { Client } = require("ssh2");

const rootDir = path.resolve(__dirname, "../..");
const tarball = path.join(rootDir, "crm-deploy.tar.gz");

const host = process.env.SSH_HOST || process.argv[2] || "118.139.167.49";
const username = process.env.SSH_USER || process.argv[3] || "tvkprojects";
const password = process.env.SSH_PASS || process.argv[4];

console.log("==================================================");
console.log(` TVK Management Unified Deployment`);
console.log(` Target Host : ${host}`);
console.log(` Username    : ${username}`);
console.log("==================================================");

if (!password) {
  console.log("\n[Notice] No password passed.");
  console.log("Usage: node scripts/deploy-to-server.js [host] [username] <password>");
  console.log("Example: node scripts/deploy-to-server.js 118.139.167.49 tvkprojects YourPassword\n");
  process.exit(1);
}

// Step 1: Package latest files
console.log("\n=== Step 1: Packaging TVK Management files ===");
const tempDir = path.join(rootDir, "deploy-package");

if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

fs.copyFileSync(path.join(rootDir, "docker-compose.yml"), path.join(tempDir, "docker-compose.yml"));

const backendDest = path.join(tempDir, "backend");
fs.mkdirSync(backendDest, { recursive: true });
fs.copyFileSync(path.join(rootDir, "backend/Dockerfile"), path.join(backendDest, "Dockerfile"));
fs.copyFileSync(path.join(rootDir, "backend/package.json"), path.join(backendDest, "package.json"));
fs.copyFileSync(path.join(rootDir, "backend/package-lock.json"), path.join(backendDest, "package-lock.json"));
fs.copyFileSync(path.join(rootDir, "backend/.env.production"), path.join(backendDest, ".env.production"));
fs.cpSync(path.join(rootDir, "backend/dist"), path.join(backendDest, "dist"), { recursive: true });

const frontendDest = path.join(tempDir, "Frontend");
fs.mkdirSync(frontendDest, { recursive: true });
fs.copyFileSync(path.join(rootDir, "Frontend/Dockerfile"), path.join(frontendDest, "Dockerfile"));
fs.copyFileSync(path.join(rootDir, "Frontend/nginx.conf"), path.join(frontendDest, "nginx.conf"));
fs.cpSync(path.join(rootDir, "Frontend/dist"), path.join(frontendDest, "dist"), { recursive: true });

if (fs.existsSync(tarball)) {
  fs.unlinkSync(tarball);
}

execSync(`tar -czf "${tarball}" -C "${tempDir}" .`);

try {
  fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
} catch (e) {}

const stats = fs.statSync(tarball);
console.log(`Package ready: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

// Step 2: Upload and Deploy via SSH
console.log(`\n=== Step 2: Connecting to ${username}@${host} ===`);

const conn = new Client();

conn.on("ready", () => {
  console.log("SSH connected! Uploading package via SFTP...");

  conn.sftp((err, sftp) => {
    if (err) {
      console.error("SFTP error:", err);
      conn.end();
      return;
    }

    const remoteTarball = `/home/${username}/crm-deploy.tar.gz`;
    const remoteAppDir = `/home/${username}/CRM`;

    sftp.fastPut(tarball, remoteTarball, (uploadErr) => {
      if (uploadErr) {
        console.error("Upload error:", uploadErr);
        conn.end();
        return;
      }

      console.log("Upload complete! Executing deployment commands on server...");

      const remoteCommands = [
        `echo '--> Extracting package into ${remoteAppDir}'`,
        `mkdir -p ${remoteAppDir}`,
        `tar -xzf ${remoteTarball} -C ${remoteAppDir}`,
        `rm -f ${remoteTarball}`,
        `echo '--> Building and launching Docker containers'`,
        `cd ${remoteAppDir}`,
        `sudo docker compose up -d --build || docker compose up -d --build`,
        `echo '--> Waiting for services to stabilize'`,
        `sleep 10`,
        `echo '--> Current Running Containers:'`,
        `sudo docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}' || docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'`
      ].join(" && ");

      conn.exec(remoteCommands, (execErr, stream) => {
        if (execErr) {
          console.error("Exec error:", execErr);
          conn.end();
          return;
        }

        let output = "";
        stream.on("close", (code) => {
          console.log(output);
          console.log(`=== Deployment completed with exit code: ${code} ===`);
          conn.end();

          // Clean local tarball
          if (fs.existsSync(tarball)) {
            try { fs.unlinkSync(tarball); } catch (_) {}
          }

          if (code === 0) {
            console.log("\n=========================================");
            console.log(`TVK Management is LIVE at: http://${host}/`);
            console.log("Default Manager: manager / Manager@12345678");
            console.log("=========================================\n");
          }
        }).on("data", (d) => {
          output += d.toString();
          process.stdout.write(d.toString());
        }).stderr.on("data", (d) => {
          output += d.toString();
          process.stderr.write(d.toString());
        });
      });
    });
  });
}).on("error", (err) => {
  console.error("Connection failed:", err.message);
}).connect({
  host,
  port: 22,
  username,
  password,
  readyTimeout: 30000,
});
