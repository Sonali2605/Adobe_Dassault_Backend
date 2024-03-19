/* eslint-disable no-useless-escape */

const moduleTransform = `$.{
    "id": $.id,
    "moduleType": 'Activity',
    "visibility": "Shared",
    "title": (
        $input := $.'name';
        $result := ($length($input) > 255) ?  $replace(($substring($input, 0, 255)), /\s+\S*$/, '...')  : $input
    ),
    "author":$.instructor
}`;

const moduleVersionTransform = `$.{
    "contentType ": 'HYPERLINK',
    "duration": $.module_duration * 60,
    "desiredDuration": $.duration_between_module * 60,
    "contentUrl": $.content_url,
    "moduleVersion": "1",
    "moduleId": $.id
}`;

const courseTransform = `$.{
    "id ": $.id,
    "courseName": (
        $input := $.'name';
        $result := ($length($input) > 510) ?  $replace(($substring($input, 0, 510)), /\s+\S*$/, '...')  : $input
    ),
    "description": (
        $input := $.'description';
        $result := $replace(($substring($input, 0, 8190)), /\n|\t|\r/, '');
        $result := ($length($result) > 8190) ?  $replace(($substring($result, 0, 8190)), /\s+\S*$/, '...')  : $result
    ),
    "state": "Published",
    "author":$.instructor
}`;

const courseModuleTransform = `$.{
    "courseId ": $.id,
    "moduleId": $.id,
    "moduleVersion": "1",
    "courseModuleType": "CONTENT",
    "moduleOrderInCourse": 0
}`;

module.exports = {
  moduleTransform,
  moduleVersionTransform,
  courseTransform,
  courseModuleTransform,
};