const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const { google } = require("googleapis");
const usersModel = require('./models/usersModel')

const app = express();
app.use(express.json());
app.use(cors());
// app.use(bodyParser.json());
const PORT = process.env.PORT || 5000;
const dbUrl = "mongodb+srv://kathiresan:kathiresan@cluster1.axyukqe.mongodb.net/";

mongoose.connect(dbUrl+'SQLTest', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
    .then(() => {
      console.log('Connected to MongoDB successfully');
    })
    .catch((error) => {
      console.error('Error connecting to MongoDB:', error);
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
        html: `<p>Your OTP code is <b>${otp}</br>. It is valid for 5 minutes.</p>`
    };

    return transporter.sendMail(mailOptions);
}

// Middleware to check OTP validity
function checkOtpValidity(otp, email) {
    if (otpStore[email] && otpStore[email].otp === otp && otpStore[email].expires > Date.now()) {
        return true;
    }
    return false;
}


app.post('/user-already',(req, res) => {
    const email= req.body.email;
    usersModel.findOne({email : req.body.email})
    .then(user => {
        if(user){
            res.json(false);
        }else{
            const otp = generateOTP();
            const expirationTime = Date.now() + 5 * 60 * 1000; // 5 minutes from now
            otpStore[email] = { otp, expires: expirationTime };
            sendOtpEmail(email, otp);
            res.json("OTP sent successfully.");
        }
    })
    // .then(users => res.json(users))
    .catch(err => res.json(err))
});

app.post('/register',(req, res) => {
    usersModel.findOne({email : req.body.email})
    .then(user => {
        if(user){
            res.json(false);
        }else{
            if (!checkOtpValidity(req.body.user_otp, req.body.email)) {
                return res.json(false);
            }else{
                
                usersModel.create(req.body)
                .then(users => res.json(users))
                .catch(err => res.json(err))
            }
        }
    })
    // .then(users => res.json(users))
    .catch(err => res.json(err))
});

app.post('/login',(req, res) => {
    const {email,password} = req.body;
    usersModel.findOne({email : email})
    .then(user => {
        if(user){
            if(user.password === password){
                res.json({username:user.username,email:user.email,mark:user.mark});
            }else{
                res.json(false);
            }
        }else{
            res.json(false);
        }
    })
    // .then(users => res.json(users))
    .catch(err => res.json(err))
});


app.post('/update-curdetails',(req, res) => {
    const {emailId} = req.body;
    usersModel.findOne({email : emailId})
    .then(user => {
        if(user){
            res.json({username:user.username,
                email:user.email,
                mark:user.mark,
                phoneNumber:user.phoneNumber,
                college:user.college,
                passedOutYear:user.passedOutYear,
                topics_completed : user.topics_completed,
                topics_incompleted: user.topics_incompleted,
                process: user.process});
        }else{
            res.json(user);
        }
    })
    // .then(users => res.json(users))
    .catch(err => res.json(err))
});

// Update user route
app.post('/update-profile', async (req, res) => {
    const { email, name: username, phoneNumber, college, passedOutYear } = req.body;
    try {
        const user = await usersModel.findOneAndUpdate(
            { email },
            { username, phoneNumber, college, passedOutYear },
            { new: true, lean: true }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});


//Question add into to db
app.post('/add-question',(req, res) => {
    const { emailId,question } = req.body;
    usersModel.findOne({email : emailId})
    .then(async user => {
        if(user.questionsAttend.some(q => q.question === question.question)){
            res.json(false);
        }else{
            usersModel.findOneAndUpdate(
                { email: emailId },
                { $push: {questionsAttend:question},mark: user.mark+5 },
                { new: true, useFindAndModify: false }  // Return the updated document
            )
            .then(updatedUser => res.json(updatedUser))
            .catch(err => res.json(err));
        }
    })
    // .then(users => res.json(users))
    .catch(err => res.json(err))
});


//Find the Question length
app.post('/question-length',async (req, res) => {
    const { emailId, MainTopic, SubTopic } = req.body;

    try {
        const user = await usersModel.findOne({ email : emailId });

        if (user) {
            // Filter the questions that match the given Maintopic and subtopic
            const matchingQuestions = user.questionsAttend.filter(
                q => q.MainTopic === MainTopic && q.SubTopic === SubTopic
            );

            // Count the number of matching questions
            const count = matchingQuestions.length;

            res.json({ count });
        } else {
            res.json({ message: 'User not found.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error });
    }
});


//Mark as Completed
app.post('/update-topic',async (req, res) => {
    const { emailId, MainTopic, SubTopic,question } = req.body;

    try {
        const user = await usersModel.findOne({ email : emailId });
        if (user) {
            if(user.topicsFinished.some(q => q.MainTopic === MainTopic && q.SubTopic === SubTopic)){
                res.json(false);
            }else{
                usersModel.findOneAndUpdate(
                    { email: emailId },
                    { $push: {topicsFinished : question},$inc: { topics_completed: 1 ,topics_incompleted: -1} },
                    { new: true, useFindAndModify: false }  // Return the updated document
                )
                .then(updatedUser => res.json(updatedUser))
                .catch(err => res.json(err));
            }
        } else {
            res.json({ message: 'User not found.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error });
    }
});


//Execute Query api
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

  
// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
