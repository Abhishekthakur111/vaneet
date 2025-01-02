const express = require("express");
const app = express();
const PORT = 8081;
const { exec } = require("child_process");
const path = require("path");

app.post("/gitWebhook", (req, res) => {
  try {
    const repoPath = path.resolve(__dirname); // This resolves the path of the current directory where the script is running
    console.log("repoPath", repoPath);

    // Step 1: Perform git pull to update the repository
    exec(`cd ${repoPath} && git pull`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error during git pull: ${error.message}`);
        return res.status(500).send("Error during git pull");
      }

      console.log(`Git pull stdout: ${stdout}`);
      console.error(`Git pull stderr: ${stderr}`);

      // Step 2: Check if package.json or package-lock.json changed
      exec(`cd ${repoPath} && git diff --name-only HEAD~1 HEAD`, (diffError, diffStdout, diffStderr) => {
        if (diffError) {
          console.error(`Error during git diff: ${diffError.message}`);
          return res.status(500).send("Error checking for changes in package.json");
        }

        console.log(`Git diff stdout: ${diffStdout}`);
        console.error(`Git diff stderr: ${diffStderr}`);

        // Step 3: If package.json or package-lock.json is modified, handle dependency installation
        const packagesChanged = diffStdout.includes("package.json") || diffStdout.includes("package-lock.json");

        const installDependencies = packagesChanged
          ? `npm install`
          : `echo "No new dependencies to install"`;
      });
       // Step 4: Perform PM2 restart after all operations
       exec(
        `cd ${repoPath} && pm2 restart all`,
        (pm2Error, pm2Stdout, pm2Stderr) => {
          if (pm2Error) {
            console.error(`Error during PM2 restart: ${pm2Error.message}`);
            return res.status(500).send("Error during PM2 restart");
          }

          console.log(`PM2 restart stdout: ${pm2Stdout}`);
          console.error(`PM2 restart stderr: ${pm2Stderr}`);
          res.status(200).send("Git pull, and PM2 restart executed successfully");
        }
      );
    });
  } catch (error) {
    console.error("Error handling webhook:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/", async (req, res) => {
  res.send("Hello vaneet test");
});

app.listen(PORT, () => {
  console.log(`Server run on port ${PORT}`);
});
