const mongoose = require("mongoose");
//mongodb+srv://sonali:<password>@cluster0.ttvbing.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
mongoose.connect("mongodb+srv://sonali:sonali@cluster0.yxzgt9y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");
const courseSchema= mongoose.Schema({
    name:String,
    id: String,
    no_of_modules: Number,
    module_duration:Number,
    duration_between_module:Number,
    instructor: String,
    published:Boolean,
})


const course = mongoose.model('Course', courseSchema, 'courses');

module.exports = { course };