const mongoose = require('mongoose');
const questionSchema = new mongoose.Schema({
    question: { type: String, required: true }
});

const usersSchema = new mongoose.Schema({
    email : String,
    username : String,
    password : String,
    phoneNumber : String,
    college : String,
    passedOutYear : String,
    mark : Number,
    questionsAttend: [questionSchema]
})

const usersModel = mongoose.model("users" , usersSchema)
module.exports = usersModel;