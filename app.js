const express = require("express");
const crypto = require("crypto");
const { exec } = require("child_process");
const path = require("path");

const app = express();
const PORT = 8081;

// Your webhook secret key (it can be loaded from the environment variable if needed)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Middleware to parse JSON payloads from GitHub
app.use(express.json({ verify: (req, res, buf) => (req.rawBody = buf) }));

app.post("/gitWebhook", (req, res) => {
  try {
    const signature = req.headers["x-hub-signature-256"]; // GitHub provides this header
    const payload = req.rawBody;

    if (!signature) {
      console.error("Signature missing from headers.");
      return res.status(400).send("Signature missing");
    }

    // Generate the HMAC digest from the payload and compare it with the provided signature
    const computedSignature = crypto.createHmac("sha256", WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");

    // Compare the computed signature with the one sent by GitHub
    if (`sha256=${computedSignature}` === signature) {
      console.log("Signature verified successfully.");

      const repoPath = path.resolve(__dirname); // Path to the repository
      console.log("repoPath", repoPath);

      // Step 1: Perform git pull to update the repository
      exec(`cd ${repoPath} && git pull`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error during git pull: ${error.message}`);
          return res.status(500).send("Error during git pull");
        }
        // Step 2: Check if package.json or package-lock.json changed (optional)
        exec(`cd ${repoPath} && git diff --name-only HEAD~1 HEAD`, (diffError, diffStdout, diffStderr) => {
          if (diffError) {
            console.error(`Error during git diff: ${diffError.message}`);
            return res.status(500).send("Error checking for changes in package.json");
          }

          // Step 3: Install dependencies if package.json or package-lock.json changed
          const packagesChanged = diffStdout.includes("package.json") || diffStdout.includes("package-lock.json");
          if (packagesChanged) {
            exec(`cd ${repoPath} && npm install`, (installError, installStdout, installStderr) => {
              if (installError) {
                console.error(`Error during npm install: ${installError.message}`);
                return res.status(500).send("Error during npm install");
              }

              console.log(`NPM install stdout: ${installStdout}`);
              console.error(`NPM install stderr: ${installStderr}`);
            });
          }

          // Step 4: Restart PM2 *in both cases* (whether package.json changed or not)
          exec(`cd ${repoPath} && pm2 restart all`, (pm2Error, pm2Stdout, pm2Stderr) => {
            if (pm2Error) {
              console.error(`Error during PM2 restart: ${pm2Error.message}`);
              return res.status(500).send("Error during PM2 restart");
            }
            console.log(`PM2 restart stdout: ${pm2Stdout}`);
            console.error(`PM2 restart stderr: ${pm2Stderr}`);
            res.status(200).send("Git pull, dependency installation (if needed), and PM2 restart executed successfully");
          });
        });
      });
    } else {
      console.error("Signature mismatch.");
      res.status(403).send("Forbidden: Invalid signature");
    }
  } catch (error) {
    console.error("Error handling webhook:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/", (req, res) => {
  res.send("Hello pm2 restart all test");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
