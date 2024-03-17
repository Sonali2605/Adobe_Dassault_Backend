const express= require("express");
const cors = require("cors");
const{createCourseValidate} = require("./types")
const app = express();
const corsOptions = {
    origin: "http://54.152.80.48:3000",
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  };
app.use(express.json());
app.use(cors());
const port = 3000;
const path = require("path");
const { course } = require("./db");

const _dirname = path.dirname("");
const buildpath = path.join(_dirname,"../Adobe-Dassault-Frontend/dist");
app.use(express.static(buildpath));

app.post("/courseData", async (req, res) => {
    const createPayload = req.body;
    const parsedPayload = createCourseValidate.safeParse(createPayload);
    
    if (!parsedPayload.success) {
        res.status(411).json({
            msg: "You sent wrong inputs"
        });
        return;
    }

    try {
        const createdCourse = await course.create({
            name: createPayload.name,
            id: createPayload.id,
            no_of_modules: createPayload.no_of_modules,
            module_duration: createPayload.module_duration,
            duration_between_module: createPayload.duration_between_module,
            instructor: createPayload.instructor,
            published: createPayload.published,
        });

        res.status(201).json({
            msg: "Course Created",
            courseId: createdCourse._id // Return the unique ID of the created course
        });
    } catch (error) {
        console.error("Error creating course:", error);
        res.status(500).json({
            msg: "Internal server error. Please try again later."
        });
    }
});


app.get("/courseData", async(req, res) =>{
    console.log("getting data")
    const courses = await course.find({});

    res.json({
        courses
    })
})

app.put("/publishCourse", async (req, res) => {
    const { ids } = req.body;

    try {
        const updatedCourses = await course.updateMany(
            { _id: { $in: ids } },
            { published: true }
        );

        res.json({
            msg: "Courses published successfully",
            updatedCourses
        });
    } catch (error) {
        console.error("Error publishing courses:", error);
        res.status(500).json({
            msg: "Internal server error. Please try again later."
        });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });

console.log("inside data")

app.listen(port,()=>{
    console.log(`App is running on ${port}`)
})