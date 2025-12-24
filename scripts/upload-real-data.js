const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = "http://localhost:3111/api/process";
const FILE_PATH = "/home/ubuntu/example/car_ins_demo.csv"; 

async function uploadFile() {
  try {
    // Check if file exists
    if (!fs.existsSync(FILE_PATH)) {
      console.error(`Error: File not found at ${FILE_PATH}`);
      process.exit(1);
    }

    console.log(`Reading file: ${FILE_PATH}...`);
    const textContent = fs.readFileSync(FILE_PATH, 'utf-8');

    if (!textContent.trim()) {
      console.error("Error: File is empty.");
      process.exit(1);
    }

    console.log(`File size: ${textContent.length} characters.`);
    console.log(`Uploading to ${API_URL}...`);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        textContent: textContent,
        fileName: path.basename(FILE_PATH),
        approvedMapping: [] 
      }),
    });

    if (response.ok) {
        const result = await response.json();
        console.log("\nUpload Successful!");
        console.log("--------------------------------------------------");
        console.log(`Entities Inserted:     ${result.stats?.entitiesInserted || 0}`);
        console.log(`Relationships Inserted: ${result.stats?.relsInserted || 0}`);
        console.log("--------------------------------------------------");
        console.log("Check your SurrealDB now. You should see all tables.");
    } else {
        const text = await response.text();
        console.error("\nServer Error:", text.slice(0, 500));
    }

  } catch (error) {
    console.error("\nNetwork Error:", error.message);
    if (error.cause) console.error("Cause:", error.cause);
    console.log("Make sure your Next.js server is running (npm run dev)");
  }
}

uploadFile();