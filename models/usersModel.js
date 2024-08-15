const mongoose = require('mongoose');
const questionSchema = new mongoose.Schema({
    question: { type: String, required: true }
});
const topicsSchema = new mongoose.Schema({
    finished: { type: String, required: true }
});

const usersSchema = new mongoose.Schema({
    email : String,
    username : String,
    password : String,
    phoneNumber : String,
    college : String,
    passedOutYear : String,
    mark : Number,
    questionsAttend: [questionSchema],
    topicsFinished : [topicsSchema],
    topics_completed : Number,
    topics_incompleted : Number,
    process : Number
})

const usersModel = mongoose.model("users" , usersSchema)
module.exports = usersModel;
