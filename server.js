const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const { google } = require("googleapis");


const app = express();
const PORT = process.env.PORT || 5024;


app.use(cors());
app.use(bodyParser.json());

// app.get('/api/data', async(req, res) => {
//     const {inputquery} = req.query;
//     console.log(inputquery)
//     // console.log('Received data:', dataInput);
//     // res.json({ message: 'Data received successfully', receivedData: dataInput });
//     db.all(inputquery, [], (err, rows) => {
//         if (err) {
//             res.json({ error: err.message });
//             return;
//         }
//         data = rows; // Store the result in the data variable
    
//         // Transformation function
//         const transformData = (data) => {
//             if (!data || data.length === 0) return []; // Handle empty data
//             const columnNames = Object.keys(data[0]);
//             const result = [columnNames];
//             data.forEach(item => {
//                 const row = columnNames.map(column => item[column]);
//                 result.push(row);
//             });
//             return result;
//         };
    
//         // Convert data
//         const transformedData = transformData(data);
//         res.json(transformedData);
//     });
//   });

    app.get("/execute-query", (req, res) => {
    const db = new sqlite3.Database('./test.db', sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            console.error(err.message);
        }
    });
    
    const userQuery = req.query.sql;


    if (!userQuery) {
        return res.json("SQL query is required.");
    }

    let data = [];
    let viewNameMatch = userQuery.match(/CREATE VIEW (\w+)/i);
    let viewName = viewNameMatch ? viewNameMatch[1] : null;

    const transformData = (data) => {
        if (!data || data.length === 0) return []; // Handle empty data
        const columnNames = Object.keys(data[0]);
        const result = [columnNames];
        data.forEach(item => {
            const row = columnNames.map(column => item[column]);
            result.push(row);
        });
        return result;
    };

    if (viewName) {
        // Execute the user's query to create the view
        db.all(userQuery, [], (err, rows) => {
            if (err) {
                console.error(err.message);
                return res.json("Failed to execute the query.");
            }

            // Query the newly created view to get data
            let selectSql = `SELECT * FROM ${viewName}`;
            db.all(selectSql, [], (err, rows) => {
                if (err) {
                    console.error(err.message);
                    return res.json("Failed to retrieve data from the view.");
                }
                data = rows; // Store the result in the data variable
                const transformedData = transformData(data);

                // Drop the view after data retrieval
                let dropViewSql = `DROP VIEW ${viewName}`;
                db.all(dropViewSql, [], (err, rows) => {
                    if (err) {
                        console.error(err.message);
                    }
                    res.json(transformedData); // Send the transformed data as the response
                });
            });
        });
    } else {
        db.all(userQuery, [], (err, rows) => {
            if (err) {
                // console.error(err.message);
                return res.json([false,err.message]);
            }
            data = rows; // Store the result in the data variable
            const transformedData = transformData(data);
            res.json([true,transformedData]); // Send the transformed data as the response
        });
    }
});

  let otpStore = {}; // Store OTPs with expiration times

  // Configure Nodemailer
  const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
          user: "harijo560@gmail.com", // replace with your email
          pass: "wdlujrkaxkwooalf" // replace with your app-specific password
      }
  });
  
  // Generate a random 6-digit OTP
  function generateOTP() {
      return Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  // Send OTP email
  function sendOtpEmail(to, otp) {
      const mailOptions = {
          from: "harijo560@gmail.com",
          to: to,
          subject: "Your OTP Code",
          html: `<p>Your OTP code is <b>${otp}</b>. It is valid for 5 minutes.</p>`
      };
  
      return transporter.sendMail(mailOptions);
  }
  
  // Middleware to check OTP validity
  function checkOtpValidity(otp, gmail) {
      if (otpStore[gmail] && otpStore[gmail].otp === otp && otpStore[gmail].expires > Date.now()) {
          return true;
      }
      return false;
  }
  
  // Google Sheets authentication setup
  async function getGoogleSheetsClient() {
      const auth = new google.auth.GoogleAuth({
          keyFile: "credentials.json",
          scopes: "https://www.googleapis.com/auth/spreadsheets",
      });
  
      const client = await auth.getClient();
      return google.sheets({ version: "v4", auth: client });
  }
  
  // Function to get all rows from the sheet
  async function getAllRows(googleSheets, spreadsheetId, sheetName) {
      const result = await googleSheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}`,
      });
      return result.data.values || [];
  }
  
  // Function to check if a user already exists based on Gmail
  async function userExists(googleSheets, spreadsheetId, sheetName, gmail) {
      const rows = await getAllRows(googleSheets, spreadsheetId, sheetName);
      const header = rows[0]; // assuming the first row is the header
      const gmailColumnIndex = header.indexOf("Gmail");
  
      if (gmailColumnIndex === -1) {
          throw new Error("Gmail column not found");
      }
  
      for (let i = 1; i < rows.length; i++) {
          if (rows[i][gmailColumnIndex] === gmail) {
              return true;
          }
      }
      return false;
  }
  
  // Function to append a new user
  async function appendNewUser(googleSheets, spreadsheetId, sheetName, newUser) {
      await googleSheets.spreadsheets.values.append({
          spreadsheetId,
          range: sheetName,
          valueInputOption: "USER_ENTERED",
          resource: {
              values: [newUser],
          },
      });
  }
  
  // Function to create a new table in SQLite for the user
  function createUserTable(username, mobile) {
    const sanitizedUsername = username.replace(/\s+/g, ''); // Remove spaces from username
    const tableName = `${sanitizedUsername}${mobile}`;
    const db = new sqlite3.Database('./test.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('Connected to the SQLite database.');
        }
    });

    const createTableQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        questions TEXT
    );`;

    db.run(createTableQuery, (err) => {
        if (err) {
            console.error(`Failed to create table ${tableName}:, err.message`);
        } else {
            console.log(`Table ${tableName} created successfully.`);
        }
    });

    db.close((err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('Closed the database connection.');
        }
    });

    return tableName;
}
async function getTableNameAndUsernameFromGmail(googleSheets, spreadsheetId, sheetName, gmail) {
    const rows = await getAllRows(googleSheets, spreadsheetId, sheetName);
    const header = rows[0];
    const gmailIndex = header.indexOf("Gmail");
    const tableNameIndex = header.indexOf("Table Name");
    const usernameIndex = header.indexOf("Username");

    if (gmailIndex === -1 || tableNameIndex === -1 || usernameIndex === -1) {
        throw new Error("Required columns not found in the sheet");
    }

    for (const row of rows) {
        if (row[gmailIndex] && row[gmailIndex].toLowerCase() === gmail.toLowerCase()) {
            return { tableName: row[tableNameIndex], username: row[usernameIndex] };
        }
    }
    throw new Error("Table name not found for the given Gmail");
}

  
  async function getTableNameFromGmail(googleSheets, spreadsheetId, sheetName, gmail) {
      const rows = await getAllRows(googleSheets, spreadsheetId, sheetName);
      const header = rows[0]; // assuming the first row is the header
      const gmailColumnIndex = header.indexOf("Gmail");
      const tableNameColumnIndex = header.indexOf("Table Name");
  
      if (gmailColumnIndex === -1 || tableNameColumnIndex === -1) {
          throw new Error("Required columns not found");
      }
  
      for (let i = 1; i < rows.length; i++) {
          if (rows[i][gmailColumnIndex] === gmail) {
              return rows[i][tableNameColumnIndex];
          }
      }
  
      throw new Error(`No table name found for Gmail: ${gmail}`);
  }

  async function updateUserMarks(googleSheets, spreadsheetId, sheetName, gmail) {
    const rows = await getAllRows(googleSheets, spreadsheetId, sheetName);
    const header = rows[0];
    const gmailIndex = header.indexOf("Gmail");
    const marksIndex = header.indexOf("Marks");

    if (gmailIndex === -1 || marksIndex === -1) {
        throw new Error("Required columns not found in the sheet");
    }

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row[gmailIndex] && row[gmailIndex].toLowerCase() === gmail.toLowerCase()) {
            let currentMarks = parseInt(row[marksIndex], 10) || 0;
            currentMarks += 5;

            await googleSheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!${String.fromCharCode(65 + marksIndex)}${i + 1}`,
                valueInputOption: "USER_ENTERED",
                resource: {
                    values: [[currentMarks]],
                },
            });
            return currentMarks;
        }
    }
}

  app.get("/user-login", async (req, res) => {
    const { gmail, password } = req.query;

    if (!gmail || !password) {
        return res.json(false);
    }

    try {
        const googleSheets = await getGoogleSheetsClient();
        const spreadsheetId = "1c9U8Q1aarvT7ODGxDEKcaCxkOvPN4ueKdg5VWKluUEY";
        const sheetName = "Sheet1";

        const rows = await getAllRows(googleSheets, spreadsheetId, sheetName);
        const header = rows[0]; // Assuming the first row is the header
        const gmailColumnIndex = header.indexOf("Gmail");
        const passwordColumnIndex = header.indexOf("Password");
        const usernameColumnIndex = header.indexOf("Username");
        const marksColumnIndex = header.indexOf("Marks");

        if (gmailColumnIndex === -1 || passwordColumnIndex === -1 || usernameColumnIndex === -1 || marksColumnIndex === -1) {
            return res.json(false);
        }

        const inputGmail = gmail.toLowerCase();
        let loginSuccess = false;
        let loggedInUsername = "";
        let recentMarks = 0;

        rows.forEach(row => {
            if (row[gmailColumnIndex].toLowerCase() === inputGmail && row[passwordColumnIndex] === password) {
                loginSuccess = true;
                loggedInUsername = row[usernameColumnIndex];
                recentMarks = row[marksColumnIndex];
            }
        });

        if (loginSuccess) {
            res.json([true, gmail, loggedInUsername, recentMarks]);
        } else {
            res.json(false);
        }
    } catch (error) {
        console.error(error);
        res.json(false);
    }
});

  
  // Route to send OTP
  app.get("/check-user", async (req, res) => {
      const { gmail } = req.query;
  
      if (!gmail) {
          return res.status(400).send("Gmail is required.");
      }
  
      const googleSheets = await getGoogleSheetsClient();
      const spreadsheetId = "1c9U8Q1aarvT7ODGxDEKcaCxkOvPN4ueKdg5VWKluUEY";
      const sheetName = "Sheet1";
  
      try {
          const exists = await userExists(googleSheets, spreadsheetId, sheetName, gmail);
          if (exists) {
            return res.json(false);
          }

          const otp = generateOTP();
          const expirationTime = Date.now() + 5 * 60 * 1000; // 5 minutes from now
          otpStore[gmail] = { otp, expires: expirationTime };
  
          await sendOtpEmail(gmail, otp);
          res.json(true);
      } catch (error) {
          console.error(error);
          res.json("Failed to send OTP.");
      }
  });
  
  // Route to verify OTP and register user
  app.get("/register-user", async(req, res) => {
    const { user_otp, username, password, mobile, gmail, college, yearOfGraduation } = req.query;

    if (!user_otp || !username || !password || !mobile || !gmail || !college || !yearOfGraduation) {
        return res.json(false);
    }

    if (!checkOtpValidity(user_otp, gmail)) {
        return res.json(false);
    }

    const googleSheets = await getGoogleSheetsClient();
    const spreadsheetId = "1c9U8Q1aarvT7ODGxDEKcaCxkOvPN4ueKdg5VWKluUEY";
    const sheetName = "Sheet1";

    try {
        const newMark = 0;
        const tableName = await createUserTable(username, mobile);
        const newUser = [username, password, mobile, gmail, college, yearOfGraduation, tableName, newMark];
        await appendNewUser(googleSheets, spreadsheetId, sheetName, newUser);
        delete otpStore[gmail]; // OTP is valid and user is registered, remove it from the store
        res.json([true, gmail, username, newMark]);
    } catch (error) {
        console.error(error);
        res.json(false);
    }
});
  
app.get("/questions-add", async (req, res) => {
    const { gmail, questions } = req.query;

    if (!gmail || !questions) {
        return res.json("Gmail and questions are required.");
    }

    try {
        const googleSheets = await getGoogleSheetsClient();
        const spreadsheetId = "1c9U8Q1aarvT7ODGxDEKcaCxkOvPN4ueKdg5VWKluUEY";
        const sheetName = "Sheet1";

        const { tableName, username } = await getTableNameAndUsernameFromGmail(googleSheets, spreadsheetId, sheetName, gmail);

        const db = new sqlite3.Database('./test.db', sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                return console.error(err.message);
            }
        });

        const insertQuestionQuery = `INSERT INTO ${tableName} (questions) VALUES (?)`;
        db.run(insertQuestionQuery, [questions], async function (err) {
            if (err) {
                return res.json("Failed to insert question into the database.");
            }

            // Update marks in the Google Sheet and get the updated marks
            const updatedMarks = await updateUserMarks(googleSheets, spreadsheetId, sheetName, gmail);

            // Return the Gmail, username, and updated marks in a list object
            res.json([true, updatedMarks]);
        });

        db.close((err) => {
            if (err) {
                return console.error(err.message);
            }
        });

    } catch (error) {
        console.error(error);
        res.send("Failed to add question.");
    }
});
  
  app.get("/question-status", async (req, res) => {
      const { gmail, questions } = req.query;
        console.log(gmail);
        console.log(questions);
      if (!gmail || !questions) {
          return res.json("Gmail and questions are required.");
      }
  
      try {
          const googleSheets = await getGoogleSheetsClient();
          const spreadsheetId = "1c9U8Q1aarvT7ODGxDEKcaCxkOvPN4ueKdg5VWKluUEY";
          const sheetName = "Sheet1";
  
          const tableName = await getTableNameFromGmail(googleSheets, spreadsheetId, sheetName, gmail);
  
          const db = new sqlite3.Database('./test.db', sqlite3.OPEN_READWRITE, (err) => {
              if (err) {
                  return res.json(err.message);
              }
          });
  
          const checkQuestionQuery = `SELECT * FROM ${tableName} WHERE questions = ?`;
          db.get(checkQuestionQuery, [questions], (err, row) => {
              if (err) {
                  return res.json("Failed to check question in the database.");
              }
              if (row) {
                  res.json(false); // Question exists
              } else {
                  res.json(true); // Question does not exist
              }
          });
  
          db.close((err) => {
              if (err) {
                  return console.error(err.message);
              }
          });
  
      } catch (error) {
          console.error(error);
          res.json("Failed to check question status.");
      }
  });
  
// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
