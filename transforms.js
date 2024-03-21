/* eslint-disable no-useless-escape */

const moduleTransform = `$.{
    "id": $.modId,
    "moduleType": 'Activity',
    "visibility": "Shared",
    "title": (
        $input := $.'module_name';
        $result := ($length($input) > 255) ?  $replace(($substring($input, 0, 255)), /\s+\S*$/, '...')  : $input
    ),
    "author":$.instructor
}`;

const moduleVersionTransform = `$.{
    "contentType ": 'HYPERLINK',
    "duration": 600,
    "desiredDuration": 120,
    "contentUrl": $.contentUrl,
    "moduleVersion":  $.modVersion,
    "moduleId": $.modId
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
    "moduleId": $.modId,
    "moduleVersion": $.modVersion,
    "courseModuleType": "CONTENT",
    "moduleOrderInCourse": 0
}`;

module.exports = {
  moduleTransform,
  moduleVersionTransform,
  courseTransform,
  courseModuleTransform,
};