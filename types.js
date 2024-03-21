const zod = require("zod");

const createCourseValidate = zod.object({
    name:zod.string(),
    id: zod.string(),
    no_of_modules: zod.number(),
    instructor: zod.string(),
    published:zod.boolean(),
})

module.exports={
    createCourseValidate: createCourseValidate 
}