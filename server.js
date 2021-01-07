const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

console.log(`================================`);
// Body Parser, otherwise body will be undefined
const bodyParser = require("body-parser");
// Use body-parser to Parse POST Requests
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Install & Setup Mongoose
const mongoose = require("mongoose");
// Connect to database
mongoose.connect(process.env.DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
// Check if database configuration is ok
// 2 = connecting
console.log(`Check database configuration: ${mongoose.connection.readyState}`);
// Everything in Mongoose starts with a Schema
const Schema = mongoose.Schema;
// Each schema maps to a MongoDB collection & defines the shape of the documents within that collection
// One username can have multiple exercises!
const exerciseSchema = new Schema({
  description: {type: String, required: true},
  duration: {type: Number, required: true},
  //date: {type: Date}
  date: {type: String}  
});

const userSchema = new Schema({
  username: {type: String, required: true},
  // count property representing the number of exercises returned
  count: {type: Number},
  // log all exercises per username
  log: [exerciseSchema]
});
// Compile schema into a Model
const ExerciseModel = mongoose.model("ExerciseModel", exerciseSchema);
const UsernameModel = mongoose.model("UsernameModel", userSchema);


// POST to /api/exercise/new-user with form data username to create a new user
app.post("/api/exercise/new-user", (request, response) => {
  // <input name="username"
  const inputUsername = request.body["username"];
  //console.log(`inputUsername: ${inputUsername}`);
  
  // Check if the username already exists in the database
  // Find shortUrl using the input originalUrl
  const findUser = inputUsername;
  UsernameModel.findOne({username: findUser}, (error, data) => {
    if(error){
      return console.log(`findOne Username error: ${error}`);
    } else {
      // If username does NOT already exist
      if(!data){
        // Create record
        const usernameRecord = new UsernameModel({
          username: inputUsername
        });
        // Save data into mongodb
        usernameRecord.save( (error, data) => {
          if(error){
            console.log(`Save username error: ${error}`);
          }
          else {
            //console.log(`Saving username data`);
            // The returned response will be an object with username and _id properties
            response.json({
              _id: data["_id"],
              username: data["username"]
            })
          }
        });
      }
      // Else if this is a new database entry
      else {
        console.log("username already exists in the database");
        // Handle data in the request
        response.json({ error: "Username already taken" })
      }
    }
  });
});

// GET request to api/exercise/users to get an array of all users
app.get("/api/exercise/users", (request, response) => {
  // Find all data
  UsernameModel.find({})
    // 0 means false to hide, 1 means true to show
    .select({
      username: 1,
      _id: 1
    })
    // Execute
    .exec( (error, data) => {
      if(error){
        console.log(`find error: ${error}`);
      }
      else {
        //console.log(`Getting data`);
        // Each element in the array is an object containing a user's username and _id
        response.json(data);
      }
    });
});

// POST to /api/exercise/add with form data userId=_id, description, duration, and optionally date
app.post("/api/exercise/add", (request, response) => {
  // <input name="userId"
  const inputUserId = request.body["userId"];
  const inputDescription = request.body["description"];
  // Convert from string to number
  const inputDuration = parseInt(request.body["duration"]);
  let inputDate = request.body["date"];
  // If no date is supplied, the current date will be used
  if(!inputDate){
    // Get 2020-12-29 format
    inputDate = new Date().toISOString().slice(0, 10);
  } else {
    inputDate = inputDate.toString().slice(0, 10);
  }

  // Create record
  const exerciseRecord = new ExerciseModel({
    description: inputDescription,
    duration: inputDuration,
    //date: {type: Date}
    date: inputDate
  });

  // POST to /api/exercise/new-user with form data username to create a new user
  UsernameModel.findByIdAndUpdate(
    // Condition
    request.body["userId"],
    // Update
    {$push: {log: exerciseRecord}},
    // Return updated document
    {new: true},
    (error, updatedUser) => {
      if(error){
        console.log(`Update exercises error: ${error}`);
      } else {
        //console.log(`Saving exercises data`);
        // POST to /api/exercise/new-user with form data username to create a new user
        response.json({
          _id: updatedUser["_id"],
          username: updatedUser["username"],
          description: exerciseRecord["description"],
          duration: exerciseRecord["duration"],
          // Date needs to be in the right format for FCC test (e.g. Tue Dec 29 2020)
          //date: data["date"]
          date: new Date(exerciseRecord["date"]).toDateString()
        })
      }

    }
  );
});

// Test output
app.get("/api/exercise/add-json", (request, response) => {
  // Find all data
  UsernameModel.find({})
    // Execute
    .exec( (error, data) => {
      if(error){
        console.log(`find error: ${error}`);
      }
      else {
        //console.log(`Getting data`);
        // Each element in the array is an object containing a user's username and _id
        response.json(data);
      }
    });
});

// GET request to /api/exercise/log with a parameter of userId=_id to retrieve a full exercise log of any user
app.get("/api/exercise/log", (request, response) => {
  // Get the query, not parameter
  //const inputUserLog = request.query["asd"];
  const inputUserLog = request.query["userId"];
  console.log(`request.query["userId"]: ${request.query["userId"]}`);
  console.log(`input log/_id: ${inputUserLog}`);

  // Find the original url based on the :asd input which is the shortUrl
  UsernameModel.findById(request.query["userId"], (error, data) => {
    if(error){
      console.log(`Get exercises log error: ${error}`);
    }
    // Else
    else {
      // Initialise responseObject with all the data
      let responseObject = data;

      // If the user entered "from" or "to"
      if(request.query["from"] || request.query["to"]) {
        let fromDate = new Date(0); // 1970 Jan 1
        let toDate = new Date(); // current date
        // If there is a "from"
        if(request.query["from"]) {
          fromDate = new Date(request.query["from"]);
        }
        // If there is a "to"
        if(request.query["to"]) {
          toDate = new Date(request.query["to"]);
        }
        // Convert to UNIX timestamp (in milliseconds)
        fromDate = fromDate.getTime();
        toDate = toDate.getTime();
        console.log(`fromDate: ${fromDate}`);
        console.log(`toDate: ${toDate}`);
        responseObject["log"] = responseObject["log"].filter( (a) => {
          // Extract .date from database and convert to milliseconds
          let extractedDate = new Date(a["date"]).getTime();
          // Filter extractedDate
          return extractedDate >= fromDate && extractedDate <= toDate;
        });
      }

      // If the user entered a limit
      if(request.query["limit"]){
        responseObject["log"] = responseObject["log"].slice(0, request.query["limit"]);
      }
      console.log(`request.query["limit"]: ${request.query["limit"]}`);

      // count property representing the number of exercises returned
      responseObject["count"] = data["log"].length;
      response.json( responseObject );
    }
  });
});

console.log(`Last line of node.js app`);