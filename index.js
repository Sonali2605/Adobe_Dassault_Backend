const express= require("express");
const cors = require("cors");
const moment = require('moment');
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
const {moduleTransform, moduleVersionTransform, courseTransform,courseModuleTransform} = require("./transforms");
const jsonata = require('jsonata');
const promiseRetry = require('promise-retry');
const _dirname = path.dirname("");
const buildpath = path.join(_dirname,"../Adobe-Dassault-Frontend/dist");
app.use(express.static(buildpath));
const  {isEmpty,keys} = require("lodash");
const { stringify } = require('csv-stringify/sync');
const SftpClient = require('ssh2-sftp-client');
const axios = require("axios")
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; 
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
            content_url: createPayload.content_url,
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
    const { ids, catalogId} = req.body;

    try {
        // Update the courses
        const updatedCourses = await course.updateMany(
            { _id: { $in: ids } },
            { published: true }
        );

        // Fetch the updated courses' data
        const publishedCourses = await course.find({ _id: { $in: ids } });

        // Call transformUdemyMetadataToALM after data is returned
        const transformedData = await transformUdemyMetadataToALM(publishedCourses);

        const activeSftpConnection = await createSFTPConnection();
        console.log("activeSftpConnection",activeSftpConnection)
        await moveAndRenameExistingFilesToArchived({sftp:activeSftpConnection,filePath:"/migration/Adobe_Dassault/Adobe_Dassault",files:["module","module_version","course","course_module"]})
        await generateAndPushFilesToSFTP({activeSftpConnection, sftpConfig:{path:"/migration/Adobe_Dassault/Adobe_Dassault"},courseData: transformedData})
        const params = new URLSearchParams({
          client_id: "eabb3668-a036-45c5-ba10-7a4160827517",
          client_secret:"5ec25713-5718-4d71-91bd-c18f703b3407",
          refresh_token:"371390c98a8c3a4a24922adf11fb6b08",
        });
    
        const url = `https://learningmanager.adobe.com/oauth/token/refresh`;
        const responseToken = await axios.post(
          url,
          params,
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );
    
        const accessToken = await responseToken.data.access_token;
        console.log("Before start migration", accessToken)
        const data = await startMigration({baseUrl:"https://learningmanager.adobe.com",accessToken, catalogId})
        console.log("------------",data)
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

async function refreshToken() {
  try {
    const params = new URLSearchParams({
      client_id: "eabb3668-a036-45c5-ba10-7a4160827517",
      client_secret:"5ec25713-5718-4d71-91bd-c18f703b3407",
      refresh_token:"371390c98a8c3a4a24922adf11fb6b08",
    });

    const url = `https://learningmanager.adobe.com/oauth/token/refresh`;
    const responseToken = await axios.post(
      url,
      params,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const tokenData = await responseToken.data.access_token;
    console.log("token", tokenData)
    console.log(tokenData); // Output the token data
  } catch (error) {
    console.error('Error refreshing token:', error);
  }
}

const startMigration = async ({ baseUrl, accessToken,catalogId }) => {
  let response;
  console.log("Insode start migration", baseUrl, accessToken);

  let urlPath;
  if(catalogId === undefined){
    urlPath= `${baseUrl}/primeapi/v2/bulkimport/startrun`;
  } else {
    urlPath= `${baseUrl}/primeapi/v2/bulkimport/startrun?catalogid=${catalogId}`;
  }
  try {
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: urlPath,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    };
    console.log("COnfig", config)
    response = await axios.request(config);
  } catch (err) {
    console.log(
      'Error in calling Udemy GraphQL Query - Courses API: ',
      err.message,
    );
    throw new Error('Error in getCourseMetadataFromUdemy!');
  }
  return response && response.data ? response.data : {};
};
const transformDate = (date) => {
    return moment(new Date(date), 'YYYY-MM-DDTHH:mm:ssZ').toISOString();
};


const transformUdemyMetadataToALM = async (coursesMetadata) => {
     
    const moduleTransformFinalResult = [];
    const moduleVersionTransformFinalResult = [];
    const courseTransformFinalResult = [];
    const courseModuleTransformFinalResult = [];
  
    console.log("22222222222222", coursesMetadata);
    try {
      await Promise.allSettled(coursesMetadata.map(async (ele) => {
        const importDate = new Date();
        const formattedDate = importDate.toISOString().slice(0, 10);
  console.log("llllllll",importDate, formattedDate)
        const moduleTransformExpression = jsonata(moduleTransform);
        console.log("moduleTranform",moduleTransformExpression )
        const moduleTransformResult = await moduleTransformExpression.evaluate(ele);
        console.log("moduleTranform2",moduleTransformResult )
        moduleTransformFinalResult.push({
          ...moduleTransformResult,
          lastModifiedDate: importDate,
        });
        console.log("moduleTranform3",moduleTransformFinalResult )
        const moduleVersionTransformExpression = jsonata(moduleVersionTransform);
        const moduleVersionTransformResult = await moduleVersionTransformExpression.evaluate(ele);
        moduleVersionTransformFinalResult.push({
          ...moduleVersionTransformResult,
          dateCreated: importDate,
        });
  
        const courseTransformExpression = jsonata(courseTransform);
        const courseTransformResult = await courseTransformExpression.evaluate(ele);
        courseTransformFinalResult.push({
          ...courseTransformResult,
          courseCreationDate: importDate,
        });
  
        const courseModuleTransformExpression = jsonata(courseModuleTransform);
        const courseModuleTransformResult = await courseModuleTransformExpression.evaluate(ele);
        courseModuleTransformFinalResult.push({
          ...courseModuleTransformResult,
        });
      }));
    } catch (err) {
      console.log(
        `There was an error in transforming courses metadata for Udemy Org Id `,
        err.message,
      );
      throw new Error(
        `There was an error in transforming courses metadata for Udemy Org Id at transformUdemyMetadataToALM`,
      );
    }
    const transformedData = {
      moduleData: moduleTransformFinalResult,
      moduleVersion: moduleVersionTransformFinalResult,
      course: courseTransformFinalResult,
      courseModule: courseModuleTransformFinalResult,
    };
  
    return transformedData;
  };

  const moveAndRenameExistingFilesToArchived = async ({
    sftp, filePath, files
  }) => {
    console.log(`Moving existing files to archived folder on SFTP for Udemy Org Id `, sftp, filePath,files);
    const now = moment.utc();
    try {
      const archivedExist = await sftp.exists(`${filePath}/Archived`);
      if (!archivedExist) {
        console.log(`Archived folder does not exists on SFTP for Udemy Org Id - . Creating new folder!`);
        await sftp.mkdir(`${filePath}/Archived`);
      }
      console.log(`Archived folder exists on SFTP for Udemy Org Id `);
  
      await Promise.allSettled(files.map(async (file) => {
        const fileExist = await sftp.exists(`${filePath}/${file}.csv`);
        if (fileExist) {
          await sftp.rcopy(`${filePath}/${file}.csv`, `${filePath}/Archived/${file}.csv`);
          await sftp.rename(`${filePath}/Archived/${file}.csv`, `${filePath}/Archived/${file}_${now.toISOString()}.csv`);
          await sftp.delete(`${filePath}/${file}.csv`);
        }
        return {};
      }));
      console.log(`Moved and Renamed existing files on SFTP for Udemy Org Id `);
    } catch (err) {
      console.log(`Error in moving and renaming file from SFTP for Udemy Org Id ! Error at moveAndRenameExistingFilesToArchived -`, err.message);
      throw new Error('Error in moving and renaming file from SFTP!');
    }
    return {};
  };

  const generateAndPushFilesToSFTP = async ({
    activeSftpConnection, sftpConfig,courseData
  }) => {
    try {
      // Write new files
      console.log("111111111111111111111111111",courseData);
      const promiseArray = [];
      if (courseData && !isEmpty(courseData.moduleData)) {
        promiseArray.push(writeToSftp({
          sftp: activeSftpConnection,
          sftpData: courseData.moduleData,
          filePath: sftpConfig.path,
          fileName: 'module',
        }));
      }
  
      if (courseData && !isEmpty(courseData.moduleVersion)) {
        promiseArray.push(writeToSftp({
          sftp: activeSftpConnection,
          sftpData: courseData.moduleVersion,
          filePath: sftpConfig.path,
          fileName: "module_version",
        }));
      }
  
      if (courseData && !isEmpty(courseData.course)) {
        promiseArray.push(writeToSftp({
          sftp: activeSftpConnection,
          sftpData: courseData.course,
          filePath: sftpConfig.path,
          fileName: "course",
        }));
      }
  
      if (courseData && !isEmpty(courseData.courseModule)) {
        promiseArray.push(writeToSftp({
          sftp: activeSftpConnection,
          sftpData: courseData.courseModule,
          filePath: sftpConfig.path,
          fileName: "course_module",
        }));
      }
  
     
      await Promise.allSettled(promiseArray);
    } catch (err) {
      console.log(`Unable to push files to SFTP for Udemy Org Id! Error in generateAndPushFilesToSFTP - `, err.message);
      throw new Error('Unable to push files to SFTP!');
    }
    return { message: `Files generated on SFTP for Udemy Org Id -` };
  };

  const writeToSftp = async ({
    sftp, sftpData, filePath, fileName
  }) => {
    try {
      const fileNameWithPath = `${filePath}/${fileName}.csv`;
      const fileHeaders = `${keys(sftpData[0]).toString()}\n`;
  
      await sftp.put(Buffer.from(fileHeaders), fileNameWithPath, {
        writeStreamOptions: {
          flags: 'a',
        },
      });
      await sftp.put(Buffer.from(stringify(sftpData)), fileNameWithPath, {
        writeStreamOptions: {
          flags: 'a',
        },
      });
      console.log(`File ${fileName}.csv for Udemy Org Id - placed in sftp location at ${filePath}`);
    } catch (err) {
      console.log(`Error placing the file ${fileName} at ${filePath} for Udemy Org Id - `, err.message);
      throw new Error(`Error in placing the file ${fileName} at ${filePath} on SFTP!`);
    }
    return {};
  };
  const createSFTPConnection = async () => {
    let sftp = new SftpClient();
   
    try {
      // check for the connection and re-try
      await promiseRetry(async (retry, attempt) => sftp.connect({host: 'almftp.adobelearningmanager.com',port: '22',username: 'FTP-Connection-107442',password: 'Adobe@1234'}).catch((err) => {
        console.log(
          `Error connecting to SFTP, attempt ${attempt}:`,
          err,
        );
        retry(err);
      }));
      sftp.on('error', (err) => console.log('SFTP Client Error event', err.message));
      sftp.on('end', () => console.log('SFTP Client disconnected.'));
    } catch (err) {
      console.log('Error connecting to SFTP, giving up:', err);
      sftp = null;
    }
    return sftp;
  };
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });

console.log("inside data")

app.listen(port,()=>{
    console.log(`App is running on ${port}`)
})