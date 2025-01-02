const express=require("express")
const app=express()
const PORT=8081
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

        // Step 3: If package.json or package-lock.json is modified, find the exact packages changed
        if (diffStdout.includes('package.json') || diffStdout.includes('package-lock.json')) {
          console.log("Changes detected in package.json or package-lock.json. Checking for package changes...");

          // Check for added or updated dependencies
          exec(`cd ${repoPath} && git diff HEAD~1 HEAD package.json`, (diffPackageJsonError, diffPackageJsonStdout, diffPackageJsonStderr) => {
            if (diffPackageJsonError) {
              console.error(`Error during package.json diff: ${diffPackageJsonError.message}`);
              return res.status(500).send("Error during package.json diff");
            }

            console.log(`package.json diff stdout: ${diffPackageJsonStdout}`);
            console.error(`package.json diff stderr: ${diffPackageJsonStderr}`);

            // Check for specific added/updated packages by parsing the diff
            const addedPackages = [];

            // Parse the diff to find added dependencies (for simplicity, this checks for lines starting with " + " indicating additions)
            const lines = diffPackageJsonStdout.split("\n");
            lines.forEach(line => {
              if (line.startsWith('+')) {
                if (line.includes('"dependencies"') || line.includes('"devDependencies"')) {
                  addedPackages.push(line.trim().split(':')[0].replace(/"/g, ''));
                }
              }
            });

            // If there are added packages, install them individually
            if (addedPackages.length > 0) {
              addedPackages.forEach(pkg => {
                console.log(`Installing package: ${pkg}`);
                exec(`cd ${repoPath} && npm install ${pkg}`, (installError, installStdout, installStderr) => {
                  if (installError) {
                    console.error(`Error during npm install: ${installError.message}`);
                    return res.status(500).send("Error during npm install");
                  }

                  console.log(`npm install stdout: ${installStdout}`);
                  console.error(`npm install stderr: ${installStderr}`);
                });
              });
              res.status(200).send("Git pull and selected package installs executed successfully");
            } else {
              res.status(200).send("Git pull executed successfully, no new packages detected");
            }
          });
        } else {
          res.status(200).send("Git pull executed successfully, no package changes detected");
        }
      });
    });

  } catch (error) {
    console.error("Error handling webhook:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/",async(req,res)=>{
    res.send("Hello vaneet ")
})

app.listen(PORT,()=>{
    console.log(`Server run on port ${PORT}`)
})
