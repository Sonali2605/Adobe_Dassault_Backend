const zod = require("zod");

const createCourseValidate = zod.object({
    name:zod.string(),
    id: zod.string(),
    no_of_modules: zod.number(),
    module_duration:zod.number(),
    duration_between_module:zod.number(),
    instructor: zod.string(),
    content_url: zod.string(),
    published:zod.boolean(),
})

module.exports={
    createCourseValidate: createCourseValidate 
}